const fs = require('node:fs')

function validate(scenes, resourceRoot = '') {
  const errors = []
  if (!Array.isArray(scenes) || !scenes.length) return ['场景数组为空。']
  let hasEnd = false
  scenes.forEach((scene, index) => {
    if (scene.choices) {
      if (!Array.isArray(scene.choices) || !scene.choices.length) errors.push(`${index} 号选项场景为空。`)
      for (const choice of scene.choices || []) {
        const target = index + choice.nextScene
        if (!choice.text || !Number.isInteger(choice.nextScene) || target < 0 || target >= scenes.length) errors.push(`${index} 号场景包含无效选项。`)
      }
      return
    }
    if (!Array.isArray(scene.dialogues) || !scene.dialogues.length) errors.push(`${index} 号场景缺少对话。`)
    if ((scene.characters || []).length > 3) errors.push(`${index} 号场景角色超过三名。`)
    const dialogue = (scene.dialogues || [])[scene.dialogues.length - 1]
    if (dialogue && dialogue.END) hasEnd = true
    if (dialogue && dialogue.toScenes !== undefined) {
      const target = index + dialogue.toScenes
      if (!Number.isInteger(dialogue.toScenes) || target < 0 || target >= scenes.length) errors.push(`${index} 号场景后续跳转无效。`)
    } else if (!dialogue || (!dialogue.END && index === scenes.length - 1)) {
      errors.push(`${index} 号场景没有结束标记。`)
    }
    if (resourceRoot) {
      const layers = [scene.sceneOverlay, scene.topRightOverlay, scene.centerOverlay, scene.cgImage]
      for (const image of [scene.background, ...(scene.characters || []).map((character) => character.image), ...layers.map((layer) => layer && layer.image)]) {
        if (image && !fs.existsSync(`${resourceRoot}${image.replace('/common', '')}`)) errors.push(`${index} 号场景缺少资源：${image}`)
      }
    }
  })
  if (!hasEnd) errors.push('未找到序章结束场景。')
  return errors
}

if (require.main === module) {
  const [file, resourceRoot] = process.argv.slice(2)
  if (!file) throw new Error('用法：node tools/validate-asunabi-story.js <场景文件> [src/common]')
  const errors = validate(JSON.parse(fs.readFileSync(file, 'utf8')), resourceRoot || '')
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else {
    console.log('Asunabi 场景校验通过。')
  }
}

module.exports = { validate }
