const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const END_INDEX = 4597
const CHAPTER_INTERVAL = 512
const CHOICE_TARGETS = {
  193: [194, 199, 203, 211, 216],
  808: [809, 813, 821],
  1601: [1602],
  2061: [2062],
  2145: [2146],
  2483: [2484],
  2543: [2544],
  3374: [3375],
  3542: [3769, 3855, 3707, 3543],
  3714: [3715],
  3722: [3723],
  3730: [3731],
  3735: [3736],
  3986: [4035, 4077, 3987, 4117],
  4453: [4454]
}
const STATEFUL_CHOICES = { 3542: { group: 'day-route-first', completeTarget: 4146 }, 3986: { group: 'day-route-second' } }
const SPEAKERS = { MM: '晓夜', MCL: '莫楚玲', BXY: '白纤语', LM: '黎铭', HXC: '韩小澄', L: '老师' }

function asText(value) { return typeof value === 'string' ? value.replace(/<br\s*\/?\s*>/gi, '\n') : '' }

function characterIdentity(key) {
  return asText(key).match(/^[A-Za-z]+/)?.[0] || asText(key)
}

function assetName(kind, key) {
  return `asset-${crypto.createHash('sha1').update(`${kind}:${key}`).digest('hex').slice(0, 16)}.png`
}

function assetFor(key, kind, assets, backgroundAliases = {}) {
  if (!key) return ''
  const resolvedKey = kind === 'background' ? backgroundAliases[key] || key : key
  const id = `${kind}:${resolvedKey}`
  if (!assets[id]) assets[id] = { id, key: resolvedKey, kind, output: assetName(kind, resolvedKey) }
  return `/common/images/${assets[id].output}`
}

function stageSlot(action) {
  const values = [asText(action.Value03), asText(action.Value04)]
  if (values.includes('Left') || values.includes('左')) return 'left'
  if (values.includes('Right') || values.includes('右')) return 'right'
  if (values.includes('Center') || values.includes('中')) return 'center'
  return 'default'
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

function applyActions(item, state, assets, backgroundAliases, phoneOcr) {
  const currentCharacterKey = asText(item.characterIndex)
  let hasCurrentCharacterCommand = false
  const transientSlots = []
  let phoneText = ''
  for (const action of item.effectInterActions || []) {
    const type = asText(action.Value00)
    const key = asText(action.Value01)
    const command = asText(action.Value02)
    if (type === 'ScreenTransition' && key === 'PPT') {
      state.stages.clear()
      state.sceneOverlay = null
      state.topRightOverlay = null
      state.centerOverlay = null
      state.cgImage = null
    } else if (type === 'BGMotion') {
      if (key && key !== 'CurrentBG') state.background = assetFor(key, 'background', assets, backgroundAliases)
      if (command === 'StopMotion') state.backgroundMotion = 'horizontal'
      else if (asText(action.Value04) === 'Vertical') state.backgroundMotion = 'vertical'
      else if (command === 'Pan' || asText(action.Value04) === 'Horizontal' || asText(action.Value04) === 'LeftToRight' || asText(action.Value04) === 'RightToLeft') state.backgroundMotion = 'horizontal'
    } else if (type === 'StageResource') {
      if (key === currentCharacterKey) hasCurrentCharacterCommand = true
      const identity = characterIdentity(key)
      const requestedSlot = stageSlot(action)
      if (command === 'Show') {
        const existing = [...state.stages.entries()].find(([, character]) => characterIdentity(character.key) === identity)
        const slot = requestedSlot === 'default' ? existing?.[1].slot || 'center' : requestedSlot
        for (const [name, character] of state.stages) if (characterIdentity(character.key) === identity || name === slot) state.stages.delete(name)
        state.stages.set(slot, { key, slot, distance: stageDistance(action), image: assetFor(key, 'stage', assets, backgroundAliases) })
      } else if (command === 'Hide') {
        for (const [name, character] of state.stages) if (character.key === key) state.stages.delete(name)
      }
    } else if (type === 'OverlayImage') {
      if (key === '黑边') continue
      const anchor = asText(action.Value03)
      const slot = anchor === 'TopRight' ? 'topRightOverlay' : anchor === 'Center' ? 'centerOverlay' : 'sceneOverlay'
      if (command === 'Hide') {
        if (!key || state[slot]?.key === key) state[slot] = null
        if (slot === 'centerOverlay' && key.startsWith('手机') && state.sceneOverlay?.key?.startsWith('手机')) state.sceneOverlay = null
      } else if (command === 'Show' || command === 'ShowOnce') {
        const isStandee = key.includes('立牌')
        const kind = slot === 'topRightOverlay' ? 'topRightOverlay' : slot === 'centerOverlay' ? 'centerOverlay' : isStandee ? 'standee' : 'overlay'
        state[slot] = { key, image: assetFor(key, kind, assets, backgroundAliases), anchor, presentation: isStandee ? 'stage' : 'overlay' }
        if (slot === 'centerOverlay') phoneText = phoneOcr[key] || ''
        if (command === 'ShowOnce') transientSlots.push(slot)
      }
    } else if (type === 'CgSdDisplay') {
      if (command === 'Hide') {
        if (!key || state.cgImage?.key === key) state.cgImage = null
      } else if (command === 'Show') state.cgImage = { key, image: assetFor(key, 'cg', assets, backgroundAliases), anchor: asText(action.Value03) }
    }
  }
  if (currentCharacterKey && !hasCurrentCharacterCommand && ![...state.stages.values()].some((character) => characterIdentity(character.key) === characterIdentity(currentCharacterKey))) {
    state.stages.set('center', { key: currentCharacterKey, slot: 'center', distance: 'near', image: assetFor(currentCharacterKey, 'stage', assets, backgroundAliases) })
  }
  return { phoneText, transientSlots }
}

function buildChapters(nodes) {
  const starts = new Set([0])
  nodes.forEach((node, index) => {
    if (index > 0 && (index % CHAPTER_INTERVAL === 0 || node.type === 'choice')) starts.add(index)
  })
  return [...starts].sort((left, right) => left - right).map((start, chapter) => ({ id: `chapter-${chapter + 1}`, title: `第${chapter + 1}章`, startId: nodes[start].id, start }))
}

function convert(source, backgroundAliases = {}, phoneOcr = {}) {
  const all = source.m_Structure && source.m_Structure.MainDataList
  if (!Array.isArray(all)) throw new Error('MainData_SO 缺少 MainDataList。')
  const entries = all.filter((item) => Number.isInteger(item.dialogueIndex)).sort((left, right) => left.dialogueIndex - right.dialogueIndex)
  if (entries.length !== 4537) throw new Error(`原始节点数量异常：${entries.length}，预期 4537。`)
  const byIndex = new Map(entries.map((item) => [item.dialogueIndex, item]))
  if (!byIndex.has(0) || !byIndex.has(END_INDEX)) throw new Error('缺少完整剧情入口或终点。')
  const assets = {}
  const state = { background: '', backgroundMotion: '', stages: new Map(), sceneOverlay: null, topRightOverlay: null, centerOverlay: null, cgImage: null }
  const nodes = entries.map((item) => {
    const index = item.dialogueIndex
    const backgroundKey = asText(item.dialogueBackground && item.dialogueBackground.Index)
    if (backgroundKey) { state.background = assetFor(backgroundKey, 'background', assets, backgroundAliases); state.backgroundMotion = 'horizontal' }
    const { transientSlots, phoneText } = applyActions(item, state, assets, backgroundAliases, phoneOcr)
    const visual = snapshot(state)
    for (const slot of transientSlots) state[slot] = null
    if (index === END_INDEX) return { id: `d-${index}`, type: 'end', text: asText(item.dialogue) || '游戏结束', ...visual }
    const choices = Array.isArray(item.dialogueSelectOptions) ? item.dialogueSelectOptions.filter(Boolean) : []
    if (choices.length) {
      const targets = CHOICE_TARGETS[index]
      if (!targets || targets.length !== choices.length || targets.some((target) => !byIndex.has(target))) throw new Error(`选择节点 ${index} 缺少可验证的分支映射。`)
      const stateful = STATEFUL_CHOICES[index]
      return { id: `d-${index}`, type: 'choice', ...visual, choiceGroup: stateful?.group || '', choiceCompleteTarget: stateful?.completeTarget ? `d-${stateful.completeTarget}` : '', choices: choices.map((text, choiceIndex) => ({ text: asText(text), sourceIndex: choiceIndex, target: `d-${targets[choiceIndex]}` })) }
    }
    const nextIndex = item.dialogueNextIndex
    if (!byIndex.has(nextIndex)) throw new Error(`节点 ${index} 指向不存在的节点 ${nextIndex}。`)
    return { id: `d-${index}`, type: 'dialogue', ...visual, speaker: SPEAKERS[asText(item.dialogueCharacterCode)] || '', text: asText(item.dialogue), phoneText, next: `d-${nextIndex}` }
  })
  const chapters = buildChapters(nodes)
  let chapter = 0
  for (let index = 0; index < nodes.length; index += 1) {
    if (chapter + 1 < chapters.length && chapters[chapter + 1].start === index) chapter += 1
    nodes[index].chapter = chapter
    nodes[index].chapterStart = chapters[chapter].start === index
  }
  return { story: { id: 'gal-master-full', title: '《难道你是gal高手》', entryId: 'd-0', endId: `d-${END_INDEX}`, chapters, nodes }, assets: Object.values(assets).sort((left, right) => left.id.localeCompare(right.id, 'zh-Hans-CN')) }
}

function main() {
  const [sourcePath, storyPath, manifestPath] = process.argv.slice(2)
  if (!sourcePath || !storyPath || !manifestPath) throw new Error('用法：node tools/transform-story.js <MainData_SO.json> <story.json> <assets.json>')
  const aliasesPath = path.join(path.dirname(storyPath), 'background-aliases.json')
  const aliases = fs.existsSync(aliasesPath) ? JSON.parse(fs.readFileSync(aliasesPath, 'utf8')) : {}
  const phoneOcrPath = path.join(path.dirname(storyPath), 'phone-ocr.json')
  const phoneOcr = fs.existsSync(phoneOcrPath) ? JSON.parse(fs.readFileSync(phoneOcrPath, 'utf8')) : {}
  const result = convert(JSON.parse(fs.readFileSync(sourcePath, 'utf8')), aliases, phoneOcr)
  fs.mkdirSync(path.dirname(storyPath), { recursive: true })
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
  fs.writeFileSync(storyPath, `${JSON.stringify(result.story)}\n`)
  fs.writeFileSync(manifestPath, `${JSON.stringify(result.assets, null, 2)}\n`)
}

if (require.main === module) main()

module.exports = { CHAPTER_INTERVAL, END_INDEX, CHOICE_TARGETS, buildChapters, characterIdentity, convert, assetName }
