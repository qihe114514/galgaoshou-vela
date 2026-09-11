const fs = require('node:fs')

function assertTarget(indexById, id, label) {
  if (!indexById.has(id)) throw new Error(`${label}：${id}`)
  return indexById.get(id)
}

function visualScene(node, previousBackground) {
  return {
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
  if (!story || !Array.isArray(story.nodes)) throw new Error('剧本缺少节点数组。')
  const indexById = new Map()
  story.nodes.forEach((node, index) => {
    if (!node.id || indexById.has(node.id)) throw new Error(`节点 ID 无效：${node.id}`)
    indexById.set(node.id, index)
  })
  assertTarget(indexById, story.entryId, '入口节点不存在')
  assertTarget(indexById, story.endId, '结束节点不存在')

  let previousBackground = ''
  return story.nodes.map((node, index) => {
    if (node.type === 'dialogue') {
      const target = assertTarget(indexById, node.next, '无效后续节点')
      const dialogue = { character: node.speaker || '', text: node.text || '' }
      if (target !== index + 1) dialogue.toScenes = target - index
      if (node.background) previousBackground = node.background
      return { ...visualScene(node, previousBackground), dialogues: [dialogue] }
    }
    if (node.type === 'choice') {
      if (!Array.isArray(node.choices) || !node.choices.length) throw new Error(`选项节点为空：${node.id}`)
      return {
        ...visualScene(node, previousBackground),
        choices: node.choices.map((choice) => ({
          text: choice.text || '',
          nextScene: assertTarget(indexById, choice.target, '无效选项节点') - index
        }))
      }
    }
    if (node.type === 'end') {
      return { ...visualScene(node, previousBackground), dialogues: [{ character: '', text: node.text || '', END: '序章结束' }] }
    }
    throw new Error(`节点类型无效：${node.type}`)
  })
}

if (require.main === module) {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) throw new Error('用法：node tools/convert-prologue-to-asunabi.js <输入剧本> <输出场景>')
  const scenes = convert(JSON.parse(fs.readFileSync(input, 'utf8')))
  fs.writeFileSync(output, `${JSON.stringify(scenes, null, 2)}\n`)
}

module.exports = { convert }
