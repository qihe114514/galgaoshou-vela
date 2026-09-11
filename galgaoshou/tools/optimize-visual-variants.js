const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const { pngOptions } = require('./export-assetripper-resources')

const DIFFERENCE_THRESHOLD = 20

function groupKey(key) {
  const match = String(key).match(/^(.*?)(?:_)?\d+$/)
  return match ? match[1] : String(key)
}

function assetPath(output) { return `/common/images/${output}` }

function faceOnly(bounds, width, height) {
  if (!bounds || bounds.count === 0) return true
  return bounds.count <= width * height * 0.12 && bounds.width <= width * 0.45 && bounds.height <= height * 0.36 && bounds.top <= height * 0.64
}

function differenceBounds(left, right, width, height, threshold = DIFFERENCE_THRESHOLD) {
  let leftEdge = width
  let top = height
  let rightEdge = -1
  let bottom = -1
  let count = 0
  let outsideHead = 0
  for (let offset = 0; offset < left.length; offset += 4) {
    let different = false
    for (let channel = 0; channel < 4; channel += 1) if (Math.abs(left[offset + channel] - right[offset + channel]) > threshold) different = true
    if (!different) continue
    const pixel = offset / 4
    const x = pixel % width
    const y = Math.floor(pixel / width)
    leftEdge = Math.min(leftEdge, x)
    top = Math.min(top, y)
    rightEdge = Math.max(rightEdge, x)
    bottom = Math.max(bottom, y)
    count += 1
    if (y > height * 0.48) outsideHead += 1
  }
  if (!count) return { left: 0, top: 0, width: 0, height: 0, count: 0, outsideHead: 0 }
  return { left: leftEdge, top, width: rightEdge - leftEdge + 1, height: bottom - top + 1, count, outsideHead }
}

async function imageData(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function rewriteCgs(story, replacements) {
  for (const node of story.nodes) if (node.cgImage && replacements[node.cgImage.image]) node.cgImage.image = replacements[node.cgImage.image]
}

async function optimizeCgs(story, assets, imageRoot) {
  const groups = new Map()
  for (const asset of assets) {
    if (asset.kind !== 'cg') continue
    const group = groupKey(asset.key)
    groups.set(group, (groups.get(group) || []).concat([asset]))
  }
  const replacements = {}
  const removed = new Set()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const files = await Promise.all(group.map((asset) => imageData(path.join(imageRoot, asset.output))))
    for (let index = 1; index < group.length; index += 1) {
      const baseIndex = files.findIndex((_, candidate) => candidate < index && !removed.has(group[candidate].output))
      if (baseIndex < 0 || files[index].width !== files[baseIndex].width || files[index].height !== files[baseIndex].height) continue
      const bounds = differenceBounds(files[baseIndex].data, files[index].data, files[index].width, files[index].height)
      if (!faceOnly(bounds, files[index].width, files[index].height)) continue
      replacements[assetPath(group[index].output)] = assetPath(group[baseIndex].output)
      removed.add(group[index].output)
    }
  }
  for (const file of removed) fs.unlinkSync(path.join(imageRoot, file))
  rewriteCgs(story, replacements)
  return { assets: assets.filter((asset) => !removed.has(asset.output)), replacements }
}

async function optimizeVisualVariants(story, assets, imageRoot) {
  for (const file of fs.readdirSync(imageRoot)) if (/^stage-face-[a-f0-9]+\.png$/.test(file)) fs.unlinkSync(path.join(imageRoot, file))
  for (const node of story.nodes) for (const character of node.characters || []) delete character.face
  const cgs = await optimizeCgs(story, assets.filter((asset) => asset.kind !== 'stageFace'), imageRoot)
  return { story, assets: cgs.assets, cgReplacements: cgs.replacements }
}

async function main() {
  const [storyPath, assetsPath, imageRoot] = process.argv.slice(2)
  if (!storyPath || !assetsPath || !imageRoot) throw new Error('usage: node tools/optimize-visual-variants.js <story.json> <assets.json> <image-dir>')
  const result = await optimizeVisualVariants(JSON.parse(fs.readFileSync(storyPath, 'utf8')), JSON.parse(fs.readFileSync(assetsPath, 'utf8')), imageRoot)
  fs.writeFileSync(storyPath, `${JSON.stringify(result.story)}\n`)
  fs.writeFileSync(assetsPath, `${JSON.stringify(result.assets, null, 2)}\n`)
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1 })

module.exports = { differenceBounds, faceOnly, groupKey, optimizeVisualVariants }
