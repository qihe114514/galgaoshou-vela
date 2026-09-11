const assert = require('node:assert/strict')
const test = require('node:test')
const { STOP_TEXT, convert } = require('../tools/transform-prologue')
const { validate } = require('../tools/validate-story')
const { spriteCrop, target } = require('../tools/export-assetripper-resources')

function dialogue(index, text, next = index + 1, extra = {}) {
  return {
    dialogueIndex: index,
    dialogue: text,
    dialogueCharacterCode: 'MM',
    characterIndex: '',
    dialogueBackground: { Index: '' },
    dialogueNextIndex: next,
    dialogueSelectOptions: [],
    effectInterActions: [],
    ...extra
  }
}

test('converts the sequence through the exact prologue ending line', () => {
  const input = { m_Structure: { MainDataList: [
    dialogue(0, '开场', 1, { dialogueBackground: { Index: '商3' }, effectInterActions: [{ Value00: 'StageResource', Value01: 'MM1a1', Value02: 'Show', Value03: 'Default', Value04: '中' }] }),
    dialogue(1, STOP_TEXT, -1),
    dialogue(2, '后续章节')
  ] } }
  const { story, assets } = convert(input)
  assert.equal(story.nodes.length, 2)
  assert.equal(story.endId, 'd-1')
  assert.equal(story.nodes.at(-1).text, STOP_TEXT)
  assert.equal(story.nodes[0].background, `/common/images/${assets.find((asset) => asset.key === '商3').output}`)
  assert.equal(story.nodes[0].characters[0].slot, 'center')
  assert.deepEqual(validate(story), [])
})

test('persists stage resources and includes the thunder standee overlay', () => {
  const input = { m_Structure: { MainDataList: [
    dialogue(0, '那一瞬间，天空传来一声巨响。', 1, { dialogueBackground: { Index: '商3' }, effectInterActions: [{ Value00: 'StageResource', Value01: 'MCL1a2', Value02: 'Show', Value03: 'Default', Value04: '中' }] }),
    dialogue(1, '', 2, { effectInterActions: [{ Value00: 'OverlayImage', Value01: '立牌', Value02: 'Show', Value03: 'SceneOverlay' }] }),
    dialogue(2, STOP_TEXT, -1)
  ] } }
  const { story, assets } = convert(input)
  assert.equal(story.nodes[1].characters[0].key, 'MCL1a2')
  assert.equal(story.nodes[1].sceneOverlay.key, '立牌')
  assert.equal(assets.some((asset) => asset.kind === 'standee'), true)
})

test('removes ShowOnce overlays after their node', () => {
  const input = { m_Structure: { MainDataList: [
    dialogue(0, '日历出现', 1, { dialogueBackground: { Index: '商3' }, effectInterActions: [{ Value00: 'OverlayImage', Value01: '日历1', Value02: 'ShowOnce', Value03: 'TopRight' }] }),
    dialogue(1, STOP_TEXT, -1)
  ] } }
  const { story } = convert(input)
  assert.equal(story.nodes[0].topRightOverlay.key, '日历1')
  assert.equal(story.nodes[1].topRightOverlay, null)
})

test('uses BGMotion for the opening background and keeps its date in a fixed slot', () => {
  const input = { m_Structure: { MainDataList: [
    dialogue(0, 'opening', 1, { effectInterActions: [
      { Value00: 'BGMotion', Value01: 'street', Value02: 'Pan', Value03: '10', Value04: 'LeftToRight' },
      { Value00: 'OverlayImage', Value01: 'calendar', Value02: 'ShowOnce', Value03: 'TopRight' }
    ] }),
    dialogue(1, STOP_TEXT, -1)
  ] } }
  const { story } = convert(input)
  assert.match(story.nodes[0].background, /images/)
  assert.equal(story.nodes[0].backgroundMotion, 'horizontal')
  assert.equal(story.nodes[0].topRightOverlay.key, 'calendar')
  assert.equal(story.nodes[1].topRightOverlay, null)
})

test('returns to horizontal panning after a vertical running motion stops', () => {
  const input = { m_Structure: { MainDataList: [
    dialogue(0, 'run', 1, { effectInterActions: [{ Value00: 'BGMotion', Value01: 'street', Value02: 'RunShakeStart', Value04: 'Vertical' }] }),
    dialogue(1, 'stop', 2, { effectInterActions: [{ Value00: 'BGMotion', Value01: 'CurrentBG', Value02: 'StopMotion' }] }),
    dialogue(2, STOP_TEXT, -1)
  ] } }
  const { story } = convert(input)
  assert.equal(story.nodes[0].backgroundMotion, 'vertical')
  assert.equal(story.nodes[1].backgroundMotion, 'horizontal')
})

test('uses a single replacement layer for standees, CGs, and phone screens', () => {
  const input = { m_Structure: { MainDataList: [
    dialogue(0, 'run', 1, { effectInterActions: [
      { Value00: 'BGMotion', Value01: 'street', Value02: 'RunShakeStart', Value04: 'Vertical' },
      { Value00: 'OverlayImage', Value01: 'standee', Value02: 'Show', Value03: 'SceneOverlay' },
      { Value00: 'CgSdDisplay', Value01: 'cg-1', Value02: 'Show', Value03: 'FullScreen' },
      { Value00: 'OverlayImage', Value01: 'phone-1', Value02: 'Show', Value03: 'Center' }
    ] }),
    dialogue(1, 'replace', 2, { effectInterActions: [
      { Value00: 'CgSdDisplay', Value01: 'cg-2', Value02: 'Show', Value03: 'FullScreen' },
      { Value00: 'OverlayImage', Value01: 'phone-2', Value02: 'Show', Value03: 'Center' }
    ] }),
    dialogue(2, STOP_TEXT, -1)
  ] } }
  const { story } = convert(input)
  assert.equal(story.nodes[0].backgroundMotion, 'vertical')
  assert.equal(story.nodes[0].sceneOverlay.key, 'standee')
  assert.equal(story.nodes[0].cgImage.key, 'cg-1')
  assert.equal(story.nodes[0].centerOverlay.key, 'phone-1')
  assert.equal(story.nodes[1].cgImage.key, 'cg-2')
  assert.equal(story.nodes[1].centerOverlay.key, 'phone-2')
})

test('deduplicates a character when a later stage command moves it to another slot', () => {
  const input = { m_Structure: { MainDataList: [
    dialogue(0, 'first', 1, { effectInterActions: [{ Value00: 'StageResource', Value01: 'heroine', Value02: 'Show', Value03: 'Center', Value04: 'near' }] }),
    dialogue(1, 'second', 2, { effectInterActions: [
      { Value00: 'StageResource', Value01: 'heroine', Value02: 'Show', Value03: 'Right', Value04: 'near' },
      { Value00: 'StageResource', Value01: 'friend', Value02: 'Show', Value03: 'Left', Value04: 'near' }
    ] }),
    dialogue(2, STOP_TEXT, -1)
  ] } }
  const { story } = convert(input)
  assert.deepEqual(story.nodes[1].characters.map((character) => `${character.slot}:${character.key}`).sort(), ['left:friend', 'right:heroine'])
})

test('ignores full-screen black-border transition overlays', () => {
  const input = { m_Structure: { MainDataList: [
    dialogue(0, 'black border', 1, { effectInterActions: [{ Value00: 'OverlayImage', Value01: '黑边', Value02: 'Show', Value03: 'FullScreen' }] }),
    dialogue(1, STOP_TEXT, -1)
  ] } }
  const { story, assets } = convert(input)
  assert.equal(story.nodes[0].sceneOverlay, null)
  assert.equal(assets.some((asset) => asset.key === '黑边'), false)
})

test('converts Unity bottom-origin sprite rectangles and preserves wide backgrounds', () => {
  assert.deepEqual(spriteCrop({ m_X: 10, m_Y: 20, m_Width: 30, m_Height: 40 }, 100), { left: 10, top: 40, width: 30, height: 40 })
  assert.deepEqual(target('background'), { width: 416, height: 312, fit: 'cover', position: 'centre', background: { r: 0, g: 0, b: 0, alpha: 1 } })
  assert.deepEqual(target('cg'), { width: 576, height: 324, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
  assert.deepEqual(target('stage'), { width: 138, height: 358, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  assert.deepEqual(target('standee'), { width: 192, height: 490, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  assert.deepEqual(target('centerOverlay'), { width: 205, height: 324, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
})

test('rejects a source that does not contain the configured ending line', () => {
  assert.throws(() => convert({ m_Structure: { MainDataList: [dialogue(0, '没有终点')] } }), /未找到序章终止台词/)
})
