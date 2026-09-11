const fs = require('node:fs')
const path = require('node:path')

const CHUNK_SIZE = 128

function assertTarget(indexById, id, label) {
  if (!indexById.has(id)) throw new Error(`${label}：${id}`)
  return indexById.get(id)
}

function visualScene(node, previousBackground) {
  return {
    chapter: Number.isInteger(node.chapter) ? node.chapter : 0,
    chapterStart: node.chapterStart === true,
    background: node.background || previousBackground,
    backgroundMotion: node.backgroundMotion || '',
    characters: (node.characters || []).slice(0, 3),
    sceneOverlay: node.sceneOverlay || null,
    topRightOverlay: node.topRightOverlay || null,
    centerOverlay: node.centerOverlay || null,
    cgImage: node.cgImage || null
  }
}

function convert(story) {
  if (!story || !Array.isArray(story.nodes) || !story.nodes.length) throw new Error('完整剧本缺少节点数组。')
  const indexById = new Map()
  story.nodes.forEach((node, index) => {
    if (!node.id || indexById.has(node.id)) throw new Error(`节点 ID 无效：${node.id}`)
    indexById.set(node.id, index)
  })
  assertTarget(indexById, story.entryId, '入口节点不存在')
  assertTarget(indexById, story.endId, '结束节点不存在')
  let previousBackground = ''
  const scenes = story.nodes.map((node, index) => {
    if (node.type === 'dialogue') {
      const target = assertTarget(indexById, node.next, '无效后续节点')
      const dialogue = { character: node.speaker || '', text: node.text || '' }
      if (node.phoneText) dialogue.phoneText = node.phoneText
      if (target !== index + 1) dialogue.toScenes = target - index
      if (node.background) previousBackground = node.background
      return { ...visualScene(node, previousBackground), dialogues: [dialogue] }
    }
    if (node.type === 'choice') {
      if (!Array.isArray(node.choices) || !node.choices.length) throw new Error(`选择节点为空：${node.id}`)
      const scene = {
        ...visualScene(node, previousBackground),
        choices: node.choices.map((choice, choiceIndex) => ({ text: choice.text || '', sourceIndex: Number.isInteger(choice.sourceIndex) ? choice.sourceIndex : choiceIndex, nextScene: assertTarget(indexById, choice.target, '无效选择节点') - index }))
      }
      if (node.choiceGroup) scene.choiceGroup = node.choiceGroup
      if (node.choiceCompleteTarget) scene.choiceCompleteScene = assertTarget(indexById, node.choiceCompleteTarget, '无效选择完成节点')
      return scene
    }
    if (node.type === 'end') return { ...visualScene(node, previousBackground), dialogues: [{ character: '', text: node.text || '游戏结束', END: '游戏结束' }] }
    throw new Error(`节点类型无效：${node.type}`)
  })
  const chapterStarts = new Set((story.chapters || []).map((chapter) => chapter.start))
  for (let index = 0; index < story.nodes.length; index += 1) {
    const visited = new Set([index])
    let current = index
    while (true) {
      const node = story.nodes[current]
      if (!node || node.type !== 'dialogue') break
      const target = indexById.get(node.next)
      if (!Number.isInteger(target) || visited.has(target)) break
      if (chapterStarts.has(target)) { scenes[index].safeNextChapter = target; break }
      visited.add(target)
      current = target
    }
    if (!Number.isInteger(scenes[index].safeNextChapter)) scenes[index].safeNextChapter = -1
  }
  return scenes
}

function writeChunks(scenes, story, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true })
  for (const file of fs.readdirSync(outputDir)) if (/^story-\d+\.txt$/.test(file)) fs.unlinkSync(path.join(outputDir, file))
  const chunks = []
  for (let start = 0, part = 0; start < scenes.length; start += CHUNK_SIZE, part += 1) {
    const chunk = scenes.slice(start, start + CHUNK_SIZE)
    const file = `story-${String(part).padStart(3, '0')}.txt`
    fs.writeFileSync(path.join(outputDir, file), `${JSON.stringify(chunk)}\n`)
    chunks.push({ file: `/common/story/chunks/${file}`, start, count: chunk.length })
  }
  const index = {
    formatVersion: 1,
    storyId: story.id,
    title: story.title,
    entryScene: Math.max(0, story.nodes.findIndex((node) => node.id === story.entryId)),
    endScene: Math.max(0, story.nodes.findIndex((node) => node.id === story.endId)),
    nodeCount: scenes.length,
    chunkSize: CHUNK_SIZE,
    chapters: story.chapters || [],
    chunks
  }
  fs.writeFileSync(path.join(outputDir, '..', 'story-index.txt'), `${JSON.stringify(index)}\n`)
  return index
}

function main() {
  const [input, outputDir] = process.argv.slice(2)
  if (!input || !outputDir) throw new Error('用法：node tools/convert-story-to-asunabi.js <story.json> <chunks-dir>')
  const story = JSON.parse(fs.readFileSync(input, 'utf8'))
  writeChunks(convert(story), story, outputDir)
}

if (require.main === module) main()

module.exports = { CHUNK_SIZE, convert, writeChunks }
