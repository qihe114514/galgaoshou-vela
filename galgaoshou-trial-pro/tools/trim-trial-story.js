const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const storyDir = path.join(root, 'src', 'common', 'story')
const chunksDir = path.join(storyDir, 'chunks')
const imagesDir = path.join(root, 'src', 'common', 'images')
const limit = 315
const allScenes = fs.readdirSync(chunksDir).filter((file) => /^story-\d+\.txt$/.test(file)).sort().flatMap((file) => JSON.parse(fs.readFileSync(path.join(chunksDir, file), 'utf8')))
const scenes = allScenes.slice(0, limit)
const usedImages = new Set()

for (const scene of scenes) {
  for (const image of [scene.background, scene.sceneOverlay && scene.sceneOverlay.image, scene.topRightOverlay && scene.topRightOverlay.image, scene.centerOverlay && scene.centerOverlay.image, scene.cgImage && scene.cgImage.image]) if (image) usedImages.add(path.basename(image))
  for (const character of scene.characters || []) if (character.image) usedImages.add(path.basename(character.image))
}

for (const file of fs.readdirSync(chunksDir)) if (/^story-\d+\.txt$/.test(file)) fs.rmSync(path.join(chunksDir, file))
for (let start = 0; start < scenes.length; start += 128) fs.writeFileSync(path.join(chunksDir, `story-${String(start / 128).padStart(3, '0')}.txt`), JSON.stringify(scenes.slice(start, start + 128)))

const index = {
  formatVersion: 1,
  storyId: 'gal-master-trial',
  title: '《难道你是gal高手》试玩版',
  entryScene: 0,
  endScene: limit - 1,
  nodeCount: limit,
  chunkSize: 128,
  chapters: [{ id: 'chapter-1', title: '第1章', startId: 'd-0', start: 0 }],
  chunks: Array.from({ length: Math.ceil(limit / 128) }, (_, index) => ({ file: `/common/story/chunks/story-${String(index).padStart(3, '0')}.txt`, start: index * 128, count: Math.min(128, limit - index * 128) }))
}
fs.writeFileSync(path.join(storyDir, 'story-index.txt'), `${JSON.stringify(index)}\n`)
for (const file of fs.readdirSync(imagesDir)) if (!usedImages.has(file)) fs.rmSync(path.join(imagesDir, file))
console.log(`保留 ${scenes.length} 个场景和 ${usedImages.size} 个图片资源`)
