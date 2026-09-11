const fs = require('node:fs')

function validate(story, resourceRoot = '') {
  const errors = []
  if (!story || !Array.isArray(story.nodes)) return ['剧本缺少 nodes 数组。']
  const nodes = new Map(story.nodes.map((node) => [node.id, node]))
  if (!nodes.has(story.entryId)) errors.push('入口节点不存在。')
  if (!nodes.has(story.endId)) errors.push('结束节点不存在。')

  const visit = (id, seen) => {
    if (seen.has(id) || !nodes.has(id)) return
    seen.add(id)
    const node = nodes.get(id)
    if (node.type === 'dialogue') {
      if (typeof node.text !== 'string') errors.push(`${id} 缺少文本。`)
      if (!node.next || !nodes.has(node.next)) errors.push(`${id} 的后续节点无效。`)
      if (node.next) visit(node.next, seen)
    } else if (node.type === 'choice') {
      if (!Array.isArray(node.choices) || !node.choices.length) errors.push(`${id} 没有选项。`)
      for (const choice of node.choices || []) {
        if (!choice.text || !nodes.has(choice.target)) errors.push(`${id} 包含无效选项。`)
        visit(choice.target, seen)
      }
    } else if (node.type !== 'end') {
      errors.push(`${id} 的节点类型无效。`)
    }
  }
  const reachable = new Set()
  visit(story.entryId, reachable)
  if (!reachable.has(story.endId)) errors.push('序章结束节点不可达。')
  for (const node of story.nodes) if (!reachable.has(node.id)) errors.push(`${node.id} 不可达。`)
  if (resourceRoot) {
    for (const node of story.nodes) {
      for (const image of [node.background, ...(node.characters || []).map((character) => character.image)]) {
        if (image && !fs.existsSync(`${resourceRoot}${image.replace('/common', '')}`)) errors.push(`${node.id} 缺少资源：${image}`)
      }
    }
  }
  return errors
}

if (require.main === module) {
  const file = process.argv[2]
  if (!file) throw new Error('用法：node tools/validate-story.js <prologue.json> [src/common]')
  const errors = validate(JSON.parse(fs.readFileSync(file, 'utf8')), process.argv[3] || '')
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else {
    console.log('剧本校验通过。')
  }
}

module.exports = { validate }
