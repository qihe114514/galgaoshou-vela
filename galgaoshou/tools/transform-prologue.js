const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const STOP_TEXT = '收下钥匙扣后，我们相互道别。'
const SPEAKERS = { MM: '晓夜', MCL: '莫楚玲', BXY: '白纤语', LM: '黎铭' }
const CHOICE_TARGETS = { 193: [194, 199, 203, 211, 216] }

function assetName(key, kind) {
  return `asset-${crypto.createHash('sha1').update(key).digest('hex').slice(0, 16)}.png`
}

function assetFor(key, kind, assets) {
  if (!key) return ''
  if (!assets[key]) assets[key] = { key, output: assetName(key, kind), kind }
  return `/common/images/${assets[key].output}`
}

function asText(value) {
  return typeof value === 'string' ? value.replace(/<br\s*\/?>/gi, '\n') : ''
}

function stageSlot(action) {
  const values = [asText(action.Value03), asText(action.Value04)]
  if (values.includes('Left') || values.includes('左')) return 'left'
  if (values.includes('Right') || values.includes('右')) return 'right'
  return 'center'
}

function stageDistance(action) {
  const values = [asText(action.Value03), asText(action.Value04)]
  return values.includes('远') ? 'far' : 'near'
}

function snapshot(state) {
  return {
    background: state.background,
    backgroundMotion: state.backgroundMotion,
    characters: [...state.stages.values()].map(({ key, slot, distance, image }) => ({ key, slot, distance, image })),
    sceneOverlay: state.sceneOverlay,
    topRightOverlay: state.topRightOverlay,
    centerOverlay: state.centerOverlay,
    cgImage: state.cgImage
  }
}

function applyActions(item, state, assets) {
  let hasCurrentCharacter = false
  const transientSlots = []
  for (const action of item.effectInterActions || []) {
    const type = asText(action.Value00)
    const key = asText(action.Value01)
    const command = asText(action.Value02)
    if (type === 'BGMotion') {
      if (key && key !== 'CurrentBG') state.background = assetFor(key, 'background', assets)
      if (command === 'StopMotion') state.backgroundMotion = 'horizontal'
      else if (asText(action.Value04) === 'Vertical') state.backgroundMotion = 'vertical'
      else if (command === 'Pan' || asText(action.Value04) === 'Horizontal') state.backgroundMotion = 'horizontal'
    } else if (type === 'StageResource') {
      const slot = stageSlot(action)
      if (command === 'Show') {
        for (const [name, character] of state.stages) if (name !== slot && character.key === key) state.stages.delete(name)
        state.stages.set(slot, { key, slot, distance: stageDistance(action), image: assetFor(key, 'stage', assets) })
        if (key === asText(item.characterIndex)) hasCurrentCharacter = true
      } else if (command === 'Hide') {
        if (state.stages.get(slot)?.key === key) state.stages.delete(slot)
        else {
          for (const [name, character] of state.stages) if (character.key === key) state.stages.delete(name)
        }
      }
    } else if (type === 'OverlayImage') {
      if (key === '黑边') continue
      const anchor = asText(action.Value03)
      const slot = anchor === 'TopRight' ? 'topRightOverlay' : anchor === 'Center' ? 'centerOverlay' : 'sceneOverlay'
      if (command === 'Hide') {
        if (!key || state[slot]?.key === key) state[slot] = null
      }
      else if (command === 'Show' || command === 'ShowOnce') {
        const isStandee = key.includes('\u7acb\u724c')
        const kind = slot === 'topRightOverlay' ? 'topRightOverlay' : slot === 'centerOverlay' ? 'centerOverlay' : isStandee ? 'standee' : 'overlay'
        state[slot] = { key, image: assetFor(key, kind, assets), anchor, presentation: isStandee ? 'stage' : 'overlay' }
        if (command === 'ShowOnce') transientSlots.push(slot)
      }
    } else if (type === 'CgSdDisplay') {
      if (command === 'Hide') {
        if (!key || state.cgImage?.key === key) state.cgImage = null
      } else if (command === 'Show') state.cgImage = { key, image: assetFor(key, 'cg', assets), anchor: asText(action.Value03) }
    }
  }

  const characterKey = asText(item.characterIndex)
  if (characterKey && !hasCurrentCharacter && ![...state.stages.values()].some((character) => character.key === characterKey)) {
    state.stages.set('center', { key: characterKey, slot: 'center', distance: 'near', image: assetFor(characterKey, 'stage', assets) })
  }
  return transientSlots
}

function convert(source) {
  const all = source.m_Structure && source.m_Structure.MainDataList
  if (!Array.isArray(all)) throw new Error('MainData_SO 缺少 MainDataList。')

  const stop = all.find((item) => asText(item.dialogue) === STOP_TEXT)
  if (!stop) throw new Error(`未找到序章终止台词：${STOP_TEXT}`)
  const entries = all.filter((item) => Number.isInteger(item.dialogueIndex) && item.dialogueIndex <= stop.dialogueIndex)
  const byIndex = new Map(entries.map((item) => [item.dialogueIndex, item]))
  const assets = {}
  const state = { background: '', backgroundMotion: '', stages: new Map(), sceneOverlay: null, topRightOverlay: null, centerOverlay: null, cgImage: null }

  const nodes = entries.map((item) => {
    const index = item.dialogueIndex
    const backgroundKey = item.dialogueBackground && asText(item.dialogueBackground.Index)
    if (backgroundKey) {
      state.background = assetFor(backgroundKey, 'background', assets)
      state.backgroundMotion = 'horizontal'
    }
    const transientSlots = applyActions(item, state, assets)
    const visual = snapshot(state)
    for (const slot of transientSlots) state[slot] = null

    if (index === stop.dialogueIndex) return { id: `d-${index}`, type: 'end', text: STOP_TEXT, ...visual }

    const choices = Array.isArray(item.dialogueSelectOptions) ? item.dialogueSelectOptions.filter(Boolean) : []
    if (choices.length) {
      const targets = CHOICE_TARGETS[index]
      if (!targets || targets.length !== choices.length || targets.some((target) => !byIndex.has(target))) throw new Error(`选择节点 ${index} 缺少可验证的分支映射。`)
      return { id: `d-${index}`, type: 'choice', ...visual, choices: choices.map((text, choiceIndex) => ({ text, target: `d-${targets[choiceIndex]}` })) }
    }

    const nextIndex = item.dialogueNextIndex
    return {
      id: `d-${index}`,
      type: 'dialogue',
      ...visual,
      speaker: SPEAKERS[asText(item.dialogueCharacterCode)] || '',
      text: asText(item.dialogue),
      next: byIndex.has(nextIndex) ? `d-${nextIndex}` : `d-${stop.dialogueIndex}`
    }
  })

  return {
    story: { id: 'gal-master-prologue', title: '《难道你是gal高手》序章', entryId: `d-${entries[0].dialogueIndex}`, endId: `d-${stop.dialogueIndex}`, nodes },
    assets: Object.values(assets).sort((left, right) => left.key.localeCompare(right.key, 'zh-Hans-CN'))
  }
}

function main() {
  const [sourcePath, storyPath, manifestPath] = process.argv.slice(2)
  if (!sourcePath || !storyPath || !manifestPath) throw new Error('用法：node tools/transform-prologue.js <MainData_SO.json> <prologue.json> <assets.json>')
  const result = convert(JSON.parse(fs.readFileSync(sourcePath, 'utf8')))
  fs.mkdirSync(path.dirname(storyPath), { recursive: true })
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
  fs.writeFileSync(storyPath, `${JSON.stringify(result.story, null, 2)}\n`)
  fs.writeFileSync(manifestPath, `${JSON.stringify(result.assets, null, 2)}\n`)
}

if (require.main === module) main()

module.exports = { STOP_TEXT, convert }
