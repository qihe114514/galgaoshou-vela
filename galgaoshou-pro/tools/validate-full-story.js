const fs = require('node:fs')
const path = require('node:path')

function validate(story, scenes, resourceRoot = '') {
  const errors = []
  if (!story || !Array.isArray(story.nodes) || !story.nodes.length) return ['完整剧本缺少节点数组。']
  const nodes = new Map(story.nodes.map((node) => [node.id, node]))
  if (!nodes.has(story.entryId)) errors.push('入口节点不存在。')
  if (!nodes.has(story.endId)) errors.push('结束节点不存在。')
  const visited = new Set()
  const visit = (id) => {
    if (visited.has(id)) return
    const node = nodes.get(id)
    if (!node) { errors.push(`跳转目标不存在：${id}`); return }
    visited.add(id)
    if (node.type === 'dialogue') {
      if (typeof node.text !== 'string') errors.push(`${id} 缺少文本。`)
      if (!node.next) errors.push(`${id} 缺少后续节点。`)
      else visit(node.next)
    } else if (node.type === 'choice') {
      if (!Array.isArray(node.choices) || !node.choices.length) errors.push(`${id} 没有选项。`)
      for (const choice of node.choices || []) {
        if (!choice.text || !choice.target) errors.push(`${id} 包含无效选项。`)
        else visit(choice.target)
      }
      if (node.choiceCompleteTarget) visit(node.choiceCompleteTarget)
    } else if (node.type !== 'end') errors.push(`${id} 节点类型无效。`)
  }
  visit(story.entryId)
  if (!visited.has(story.endId)) errors.push('游戏结束节点不可达。')
  if (visited.size !== story.nodes.length) errors.push(`存在 ${story.nodes.length - visited.size} 个不可达节点。`)
  const endNodes = story.nodes.filter((node) => node.type === 'end')
  if (endNodes.length !== 1 || endNodes[0].id !== story.endId) errors.push('结束节点数量或 ID 不符合完整故事约束。')
  if (!Array.isArray(story.chapters) || !story.chapters.length) errors.push('完整剧本缺少章节索引。')
  else {
    const starts = new Set()
    for (const chapter of story.chapters) {
      if (!Number.isInteger(chapter.start) || chapter.start < 0 || chapter.start >= story.nodes.length || !nodes.has(chapter.startId) || story.nodes[chapter.start]?.id !== chapter.startId || !visited.has(chapter.startId) || starts.has(chapter.start)) errors.push(`章节入口无效：${chapter.id || ''}`)
      starts.add(chapter.start)
    }
  }
  if (resourceRoot) {
    for (const node of story.nodes) {
      const layers = [node.background, ...(node.characters || []).map((character) => character.image), node.sceneOverlay?.image, node.topRightOverlay?.image, node.centerOverlay?.image, node.cgImage?.image]
      for (const image of layers) if (image && !fs.existsSync(path.join(resourceRoot, image.replace('/common/', '')))) errors.push(`${node.id} 缺少资源：${image}`)
      if ((node.characters || []).length > 3) errors.push(`${node.id} 角色数量超过三名。`)
    }
  }
  if (Array.isArray(scenes) && scenes.length !== story.nodes.length) errors.push('场景分块数量与剧本节点数量不一致。')
  return errors
}

if (require.main === module) {
  const [storyPath, scenesPath, resourceRoot] = process.argv.slice(2)
  const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'))
  let scenes = []
  if (fs.statSync(scenesPath).isDirectory()) {
    const files = fs.readdirSync(scenesPath).filter((file) => /^story-\d+\.txt$/.test(file)).sort()
    for (const file of files) scenes.push(...JSON.parse(fs.readFileSync(path.join(scenesPath, file), 'utf8')))
  } else scenes = JSON.parse(fs.readFileSync(scenesPath, 'utf8'))
  const errors = validate(story, scenes, resourceRoot || '')
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 } else console.log('完整剧本校验通过。')
}

module.exports = { validate }
