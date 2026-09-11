const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const dxt = require('dxt-js')

const baseUrl = process.env.ASSETRIPPER_URL || 'http://127.0.0.1:48567'

function decode(value) {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
}

async function findAssetPath(key) {
  const html = await (await fetch(`${baseUrl}/Search/View?q=${encodeURIComponent(key)}`)).text()
  const rows = html.match(/<tr[^>]*>.*?<\/tr>/gs) || []
  const exactName = new RegExp(`>${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`)
  const sprites = rows
    .filter((row) => /data-class="Sprite"/.test(row) && exactName.test(row))
    .map((row) => decode(row.match(/href="([^"?]+\?Path=[^"]+)"/)[1].split('Path=')[1]))
  if (sprites.length) {
    const candidates = await Promise.all(sprites.map(async (sourcePath) => {
      const asset = await (await fetch(`${baseUrl}/Assets/Json?Path=${sourcePath}`)).json()
      const rect = asset.m_Rect || {}
      return { sourcePath, area: Number(rect.m_Width || 0) * Number(rect.m_Height || 0) }
    }))
    return candidates.sort((left, right) => right.area - left.area)[0].sourcePath
  }
  for (const row of rows) {
    if (!/data-class="Texture2D"/.test(row) || !exactName.test(row)) continue
    const match = row.match(/href="([^"?]+\?Path=[^"]+)"/)
    if (match) return decode(match[1].split('Path=')[1])
  }
  return ''
}

function texturePath(spritePath, textureId) {
  return encodeURIComponent(decodeURIComponent(spritePath).replace(/"D":-?\d+}/, `"D":${textureId}}`))
}

function decodeTexture(texture, raw) {
  const width = texture.m_Width
  const height = texture.m_Height
  let baseLevelLength
  let pixels
  if (texture.m_Format === 4) {
    baseLevelLength = width * height * 4
    pixels = raw.subarray(0, baseLevelLength)
  } else if (texture.m_Format === 12) {
    baseLevelLength = Math.ceil(width / 4) * Math.ceil(height / 4) * 16
    pixels = Buffer.from(dxt.decompress(raw.subarray(0, baseLevelLength), width, height, dxt.flags.DXT5))
  } else throw new Error(`不支持的纹理格式：${texture.m_Format}`)
  if (raw.length < baseLevelLength) throw new Error('纹理像素数据不完整。')
  return { width, height, pixels }
}

function target(kind) {
  if (kind === 'background') return { width: 416, height: 312, fit: 'cover', position: 'centre', background: { r: 0, g: 0, b: 0, alpha: 1 } }
  if (kind === 'cg') return { width: 576, height: 324, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } }
  if (kind === 'stage') return { width: 152, height: 380, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
  if (kind === 'standee') return { width: 212, height: 520, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
  if (kind === 'topRightOverlay') return { width: 100, height: 60, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
  if (kind === 'centerOverlay') return { width: 205, height: 324, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
  if (kind === 'overlay') return { width: 212, height: 335, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
  return { width: 212, height: 520, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
}

function pngOptions(kind) {
  if (kind === 'background' || kind === 'cg' || kind === 'centerOverlay') return { compressionLevel: 9, palette: true, quality: 75, colours: 64, dither: 0.25, effort: 10, adaptiveFiltering: true }
  if (kind === 'stage') return { compressionLevel: 9, palette: true, quality: 75, colours: 64, dither: 0.25, effort: 10, adaptiveFiltering: true }
  if (kind === 'standee') return { compressionLevel: 9, palette: true, quality: 75, colours: 128, dither: 0.5, effort: 10, adaptiveFiltering: true }
  return { compressionLevel: 9, palette: false, effort: 10, adaptiveFiltering: true }
}

function stageOffset(kind) {
  return kind === 'standee' ? 30 : 0
}

async function cropStageAtKnees(image) {
  const { data, info } = await image.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let left = info.width
  let top = info.height
  let right = -1
  let bottom = -1
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] === 0) continue
    const pixel = (offset - 3) / 4
    const x = pixel % info.width
    const y = Math.floor(pixel / info.width)
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x)
    bottom = Math.max(bottom, y)
  }
  if (right < left || bottom < top) return image
  const knee = Math.min(info.height, top + Math.max(1, Math.ceil((bottom - top + 1) * 0.76)))
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract({ left, top, width: right - left + 1, height: knee - top })
}

function spriteCrop(rect, textureHeight) {
  return {
    left: Math.round(rect.m_X),
    top: Math.round(textureHeight - rect.m_Y - rect.m_Height),
    width: Math.round(rect.m_Width),
    height: Math.round(rect.m_Height)
  }
}

async function exportAsset(assetPath, kind, output) {
  const assetText = await (await fetch(`${baseUrl}/Assets/Json?Path=${assetPath}`)).text()
  const asset = JSON.parse(assetText)
  let texture = asset
  let sourcePath = assetPath
  let rect
  if (!asset.m_Width) {
    const textureMatch = assetText.match(/"m_RD"[\s\S]*?"m_Texture": \{ "m_FileID": 0, "m_PathID": (-?\d+) \}/)
    if (!textureMatch) throw new Error('Sprite 不包含纹理。')
    sourcePath = texturePath(assetPath, textureMatch[1])
    texture = await (await fetch(`${baseUrl}/Assets/Json?Path=${sourcePath}`)).json()
    rect = asset.m_Rect
  }
  const raw = Buffer.from(await (await fetch(`${baseUrl}/Assets/Image?Path=${sourcePath}`)).arrayBuffer())
  const { width, height, pixels } = decodeTexture(texture, raw)
  const sourceRect = rect || { m_X: 0, m_Y: 0, m_Width: width, m_Height: height }
  const crop = spriteCrop(sourceRect, height)
  const resize = target(kind)
  const offset = stageOffset(kind)
  const imageResize = offset ? Object.assign({}, resize, { height: resize.height - offset }) : resize
  const sourceImage = sharp(pixels, { raw: { width, height, channels: 4 } })
    .flip()
    .extract(crop)
  if (kind === 'centerOverlay' && exportAsset.onPhoneSource) await exportAsset.onPhoneSource(await sourceImage.clone().png().toBuffer())
  const imageForExport = kind === 'stage' ? await cropStageAtKnees(sourceImage) : sourceImage
  let outputImage = imageForExport
    .resize(imageResize)
  if (offset) {
    const rendered = await outputImage.png().toBuffer()
    outputImage = sharp({ create: { width: 212, height: 520, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: rendered, left: 0, top: offset }])
  }
  await outputImage.png(pngOptions(kind)).toFile(output)
}

async function main() {
  const [manifestPath, outputDir] = process.argv.slice(2)
  if (!manifestPath || !outputDir) throw new Error('用法：node tools/export-assetripper-resources.js <assets.json> <outputDir>')
  const assets = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const phoneAssets = assets.filter((asset) => asset.kind === 'centerOverlay')
  const phoneOcr = {}
  const correctionsPath = path.join(path.dirname(manifestPath), 'phone-ocr-corrections.json')
  const corrections = fs.existsSync(correctionsPath) ? JSON.parse(fs.readFileSync(correctionsPath, 'utf8')) : {}
  let worker
  if (phoneAssets.length) {
    const { createWorker } = require('tesseract.js')
    worker = await createWorker('chi_sim', 1, { langPath: path.join(__dirname, '..', 'node_modules', '@tesseract.js-data', 'chi_sim', '4.0.0_best_int') })
  }
  fs.mkdirSync(outputDir, { recursive: true })
  const expected = new Set(assets.map((asset) => asset.output))
  for (const file of fs.readdirSync(outputDir)) {
    if (/^asset-[a-f0-9]+\.(png|jpg)$/.test(file) && !expected.has(file)) fs.unlinkSync(path.join(outputDir, file))
  }
  const missing = []
  for (const asset of assets) {
    const output = path.join(outputDir, asset.output)
    const assetPath = await findAssetPath(asset.key)
    if (!assetPath) { missing.push(asset.key); continue }
    try {
      if (asset.kind === 'centerOverlay') {
        exportAsset.onPhoneSource = async (buffer) => {
          const result = await worker.recognize(buffer)
          phoneOcr[asset.key] = cleanOcr(result.data.text)
        }
      } else exportAsset.onPhoneSource = null
      await exportAsset(assetPath, asset.kind, output)
      console.log(`已导出 ${asset.key}`)
    } catch (error) {
      console.error(`${asset.key}: ${error.message}`)
      missing.push(asset.key)
    }
  }
  const missingPath = path.join(outputDir, 'missing-assets.json')
  if (missing.length) {
    fs.writeFileSync(missingPath, `${JSON.stringify(missing, null, 2)}\n`)
    throw new Error(`未导出 ${missing.length} 个资源，详见 missing-assets.json。`)
  }
  if (fs.existsSync(missingPath)) fs.unlinkSync(missingPath)
  if (worker) await worker.terminate()
  fs.writeFileSync(path.join(path.dirname(manifestPath), 'phone-ocr.json'), `${JSON.stringify(mergePhoneOcr(phoneOcr, corrections), null, 2)}\n`)
}

function mergePhoneOcr(generated, corrections) {
  const result = Object.assign({}, generated)
  for (const [key, text] of Object.entries(corrections || {})) if (Object.prototype.hasOwnProperty.call(generated, key) && typeof text === 'string') result[key] = text
  return result
}

function cleanOcr(text) {
  return String(text || '').replace(/\r/g, '').split('\n').map((line) => {
    let cleaned = line.replace(/\s+/g, ' ').trim()
    while (/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/.test(cleaned)) cleaned = cleaned.replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, '$1$2')
    return cleaned.replace(/\s+([，。！？；：、])/g, '$1').replace(/([，。！？；：、])\s+/g, '$1')
  }).filter(Boolean).join('\n')
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1 })

module.exports = { cleanOcr, cropStageAtKnees, mergePhoneOcr, pngOptions, spriteCrop, stageOffset, target }
