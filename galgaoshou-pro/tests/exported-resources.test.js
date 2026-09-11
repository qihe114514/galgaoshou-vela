const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const test = require('node:test')
const sharp = require('sharp')
const { cleanOcr, cropStageAtKnees, mergePhoneOcr, pngOptions, stageOffset, target } = require('../tools/export-assetripper-resources')
const { dedupeBackgrounds } = require('../tools/dedupe-background-assets')
const { optimizeVisualVariants } = require('../tools/optimize-visual-variants')

function pngColorType(file) {
  return fs.readFileSync(file)[25]
}

test('trades 20 percent resolution for 64-color scene PNGs and lowers stage layers', () => {
  const compressed = { compressionLevel: 9, palette: true, quality: 75, colours: 64, dither: 0.25, effort: 10, adaptiveFiltering: true }
  assert.deepEqual(target('background'), { width: 416, height: 312, fit: 'cover', position: 'centre', background: { r: 0, g: 0, b: 0, alpha: 1 } })
  assert.deepEqual(target('cg'), { width: 576, height: 324, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
  assert.deepEqual(target('centerOverlay'), { width: 205, height: 324, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  assert.deepEqual(pngOptions('centerOverlay'), compressed)
  assert.deepEqual(pngOptions('cg'), compressed)
  assert.deepEqual(target('stage'), { width: 152, height: 380, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  assert.equal(stageOffset('stage'), 0)
  assert.equal(stageOffset('standee'), 30)
})

test('keeps only readable OCR lines for phone overlays', () => {
  assert.equal(cleanOcr('  第 一 行 \r\n\n 第 二  行 ， 你好 ！\n'), '第一行\n第二行，你好！')
})

test('keeps reviewed phone OCR when refreshing exported resources', () => {
  assert.deepEqual(mergePhoneOcr({ 手机1_1: '新的识别文本', 手机1_2: '保留新识别' }, { 手机1_1: '人工修订', 手机9_9: '无效条目' }), { 手机1_1: '人工修订', 手机1_2: '保留新识别' })
  assert.deepEqual(mergePhoneOcr({ 手机1_1: '新的识别文本' }, { 手机1_1: '' }), { 手机1_1: '' })
})

test('aliases visually equivalent backgrounds but never phone overlays', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gal-backgrounds-'))
  await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 120, g: 80, b: 90 } } }).png().toFile(path.join(root, 'a.png'))
  await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 120, g: 80, b: 91 } } }).png().toFile(path.join(root, 'b.png'))
  await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } }).png().toFile(path.join(root, 'phone.png'))
  const result = await dedupeBackgrounds({ nodes: [
    { background: '/common/images/a.png', centerOverlay: { image: '/common/images/phone.png' } },
    { background: '/common/images/b.png', centerOverlay: { image: '/common/images/phone.png' } }
  ] }, [
    { kind: 'background', output: 'a.png' }, { kind: 'background', output: 'b.png' }, { kind: 'centerOverlay', output: 'phone.png' }
  ], root, 1)
  assert.equal(result.story.nodes[1].background, '/common/images/a.png')
  assert.equal(result.story.nodes[1].centerOverlay.image, '/common/images/phone.png')
  assert.deepEqual(result.assets.map((asset) => asset.output), ['a.png', 'phone.png'])
})

test('keeps whole stage images and aliases face-only CG changes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gal-variants-'))
  const stage = async (file, face, bodyShift = 0) => sharp({ create: { width: 212, height: 520, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([
    { input: { create: { width: 90, height: 300, channels: 4, background: { r: 50, g: 80, b: 120, alpha: 1 } } }, left: 60 + bodyShift, top: 180 },
    { input: { create: { width: 42, height: 44, channels: 4, background: { r: face, g: 40, b: 80, alpha: 1 } } }, left: 84 + bodyShift, top: 70 }
  ]).png().toFile(path.join(root, file))
  const cg = async (file, face, shift = 0) => sharp({ create: { width: 576, height: 324, channels: 3, background: { r: 120, g: 130, b: 140 } } }).composite([{ input: { create: { width: 44, height: 40, channels: 3, background: { r: face, g: 30, b: 50 } } }, left: 260 + shift, top: 60 }]).png().toFile(path.join(root, file))
  await stage('hero1.png', 230)
  await stage('hero2.png', 120)
  await stage('walk1.png', 160)
  await stage('walk2.png', 120, 70)
  await cg('cg1.png', 220)
  await cg('cg2.png', 150)
  const assets = [
    { id: 'stage:hero1', key: 'hero1', kind: 'stage', output: 'hero1.png' }, { id: 'stage:hero2', key: 'hero2', kind: 'stage', output: 'hero2.png' }, { id: 'stage:walk1', key: 'walk1', kind: 'stage', output: 'walk1.png' }, { id: 'stage:walk2', key: 'walk2', kind: 'stage', output: 'walk2.png' },
    { id: 'cg:CG1_1', key: 'CG1_1', kind: 'cg', output: 'cg1.png' }, { id: 'cg:CG1_2', key: 'CG1_2', kind: 'cg', output: 'cg2.png' }
  ]
  const story = { nodes: [{ characters: [{ image: '/common/images/hero1.png' }, { image: '/common/images/hero2.png' }, { image: '/common/images/walk2.png' }], cgImage: { image: '/common/images/cg2.png' } }] }
  const result = await optimizeVisualVariants(story, assets, root)
  assert.ok(result.assets.every((asset) => asset.kind !== 'stageFace'))
  assert.notEqual(result.story.nodes[0].characters[0].image, result.story.nodes[0].characters[1].image)
  assert.equal(result.story.nodes[0].characters[0].face, undefined)
  assert.notEqual(result.story.nodes[0].characters[0].image, result.story.nodes[0].characters[2].image)
  assert.equal(result.story.nodes[0].cgImage.image, '/common/images/cg1.png')
})

test('crops stage art at the knees and removes transparent side margins', async () => {
  const source = sharp({ create: { width: 100, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([
    { input: { create: { width: 40, height: 160, channels: 4, background: { r: 80, g: 100, b: 120, alpha: 1 } } }, left: 30, top: 20 }
  ])
  const cropped = await cropStageAtKnees(source)
  const metadata = await sharp(await cropped.png().toBuffer()).metadata()
  assert.equal(metadata.width, 40)
  assert.equal(metadata.height, 122)
})

test('exports compact wide PNG scenes and transparent PNG layers', async () => {
  assert.ok(fs.statSync('src/common/home.png').size < 150000)
  assert.equal(fs.existsSync('src/common/home.jpg'), false)
  const assets = JSON.parse(fs.readFileSync('tools/data/generated/assets.json', 'utf8'))
  assert.ok(assets.length > 0 && assets.length <= 516)
  assert.equal(fs.readdirSync('src/common/images').some((file) => /\.jpe?g$/i.test(file)), false)
  assert.equal(new Set(assets.map((asset) => asset.id)).size, assets.length)
  let totalBytes = 0
  for (const asset of assets) {
    const file = path.join('src/common/images', asset.output)
    assert.ok(fs.existsSync(file), `missing ${asset.key}`)
    totalBytes += fs.statSync(file).size
    const metadata = await sharp(file).metadata()
    if (asset.kind === 'background') {
      assert.equal(path.extname(asset.output), '.png')
      assert.equal(metadata.width, 416)
      assert.equal(metadata.height, 312)
      assert.ok(fs.statSync(file).size < 100000, `${asset.key} is too large`)
    } else if (asset.kind === 'cg') {
      assert.equal(path.extname(asset.output), '.png')
      assert.equal(metadata.width, 576)
      assert.equal(metadata.height, 324)
      assert.ok(fs.statSync(file).size < 120000, `${asset.key} is too large`)
    } else if (asset.kind === 'stage') {
      assert.equal(metadata.width, 152)
      assert.equal(metadata.height, 380)
      assert.equal(pngColorType(file), 3, `${asset.key} must be a palette PNG`)
      assert.ok(fs.statSync(file).size < 25000, `${asset.key} is too large`)
    } else if (asset.kind === 'standee') {
      assert.equal(metadata.width, 212)
      assert.equal(metadata.height, 520)
      assert.equal(pngColorType(file), 3, `${asset.key} must be a palette PNG`)
      assert.ok(fs.statSync(file).size < 40000, `${asset.key} is too large`)
    } else {
      assert.equal(path.extname(asset.output), '.png')
      assert.equal(metadata.channels, 4)
    }
  }
  assert.ok(totalBytes < 10000000, `expected images below 10 MB, received ${totalBytes}`)
})

test('exports the static home screen, circular icon, and transparent logo', async () => {
  assert.deepEqual((await sharp('src/common/home.png').metadata()).width, 212)
  assert.equal((await sharp('src/common/home.png').metadata()).height, 520)
  const iconSource = fs.readFileSync('tools/data/icon.png')
  const iconOutput = fs.readFileSync('src/common/icon.png')
  assert.deepEqual(iconOutput, iconSource)
  assert.equal(require('node:crypto').createHash('sha256').update(iconOutput).digest('hex'), '5749bdeab38ae0b7bcc0f6315e9136be7e14fa7792934a37d519b8f7f8e90790')
  const icon = await sharp('src/common/icon.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.deepEqual({ width: icon.info.width, height: icon.info.height }, { width: 256, height: 256 })
  assert.equal((await sharp('src/common/icon.png').metadata()).isPalette, false)
  assert.equal(icon.data[3], 0)
  assert.equal(icon.data[(icon.info.width - 1) * 4 + 3], 0)
  const optimizeHome = fs.readFileSync('tools/optimize-home.js', 'utf8')
  assert.match(optimizeHome, /copyFileSync\(path\.join\(data, 'icon\.png'\), path\.join\(outputs, 'icon\.png'\)\)/)
  assert.doesNotMatch(optimizeHome, /icon\.png'\)\.resize\(/)
  const logo = await sharp('src/common/logo.png').metadata()
  assert.deepEqual({ width: logo.width, height: logo.height }, { width: 180, height: 102 })
  assert.equal(logo.hasAlpha, true)
})
