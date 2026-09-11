const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const test = require('node:test')

const detail = fs.readFileSync('src/pages/detail/detail.ux', 'utf8')
const index = fs.readFileSync('src/pages/index/index.ux', 'utf8')
const saves = fs.readFileSync('src/pages/saves/saves.ux', 'utf8')
const indexScript = index.split('<script>')[1].split('</script>')[0]
  .replace(/^import .*\r?\n/gm, '')
  .replace('export default {', 'module.exports = {')
const savesScript = saves.split('<script>')[1].split('</script>')[0]
  .replace(/^import .*\r?\n/gm, '')
  .replace('export default {', 'module.exports = {')
const script = detail.split('<script>')[1].split('</script>')[0]
  .replace(/^import .*\r?\n/gm, '')
  .replace('export default {', 'module.exports = {')

function createPage(file = { readText() {} }, storage = {}, router = {}) {
  const context = { module: { exports: {} }, exports: {}, console, JSON, Number, Object, Array, setTimeout, prompt: { showToast() {} }, router, storage, file }
  vm.runInNewContext(script, context)
  const definition = context.module.exports
  const page = Object.assign({}, definition.private)
  for (const [key, value] of Object.entries(definition)) if (typeof value === 'function') page[key] = value
  page.saveData = (message) => { page.savedMessage = message }
  return page
}

function createIndexPage() {
  const context = { module: { exports: {} }, exports: {}, JSON, Number, Object, Array }
  vm.runInNewContext(indexScript, context)
  const definition = context.module.exports
  const page = Object.assign({}, definition.private)
  for (const [key, value] of Object.entries(definition)) if (typeof value === 'function') page[key] = value
  return page
}

function createSavesPage(pushes) {
  const context = { module: { exports: {} }, exports: {}, JSON, Number, Object, Array, Date, router: { push(options) { pushes.push(options) } }, storage: {}, prompt: { showToast() {} } }
  vm.runInNewContext(savesScript, context)
  const definition = context.module.exports
  const page = Object.assign({}, definition.private)
  for (const [key, value] of Object.entries(definition)) if (typeof value === 'function') page[key] = value
  return page
}

test('reads Vela load and auto-save parameters and routes manual loads through the saves page', () => {
  assert.match(detail, /protected:\s*\{\s*load:\s*'',\s*auto:\s*''\s*\}/)
  assert.match(saves, /protected:\s*\{\s*mode:\s*'load'\s*\}/)
  assert.doesNotMatch(detail, /\$page\.params/)
  assert.match(index, /uri: 'pages\/saves', params: \{ mode: 'load' \}/)
  assert.match(saves, /uri: 'pages\/detail', params: \{ load: String\(slot\) \}/)
})

test('shows save timestamps and keeps both save actions on the saves page', () => {
  const savesTemplate = saves.split('<template>')[1].split('</template>')[0]
  assert.match(savesTemplate, /<text class="slot-title">存档 \{\{\$idx \+ 1\}\}<\/text>[\s\S]*<text class="slot-info">场景 \{\{\$item\.sceneNumber\}\}<\/text>[\s\S]*<text class="slot-time">\{\{\$item\.savedTime\}\}<\/text>/)
  assert.doesNotMatch(savesTemplate, /currentDialogue/)
  assert.match(saves, /updated\[slot\] = this\.freshPendingSave\(\)/)
  assert.match(saves, /this\.persist\(updated, '覆盖成功'\)/)
  assert.match(saves, /this\.persist\(this\.recoveryData\.concat\(\[this\.freshPendingSave\(\)\]\), '保存成功'\)/)
  assert.match(saves, /refreshSaveRows\(\)/)
  assert.match(saves, /freshPendingSave\(\) \{ return Object\.assign\(\{\}, this\.pendingSave, \{ savedAt: Date\.now\(\) \}\) \}/)
  assert.match(saves, /back\(\) \{ storage\.delete\(\{ key: 'pendingSave'/)
  const persistBody = saves.split('persist(data, message)')[1].split('freshPendingSave')[0]
  assert.doesNotMatch(persistBody, /this\.pendingSave = null|storage\.delete/)
  assert.match(saves, /return '时间未知'/)
  assert.match(saves, /return `\$\{month\}-\$\{day\} \$\{hours\}:\$\{minutes\}`/)
  assert.match(saves, /twoDigits\(value\) \{ return value < 10 \? `0\$\{value\}` : String\(value\) \}/)
  assert.doesNotMatch(saves, /persist\(data, message, returnAfter\)|if \(returnAfter\) router\.back\(\)/)
})

test('shows a separate auto-save row that only loads in read mode', () => {
  const savesTemplate = saves.split('<template>')[1].split('</template>')[0]
  assert.match(savesTemplate, /自动存档[\s\S]*for="\{\{saveRows\}\}"/)

  const pushes = []
  const page = createSavesPage(pushes)
  page.autoSaveData = { currentScene: 9 }
  page.selectAutoSave()
  assert.equal(JSON.stringify(pushes), JSON.stringify([{ uri: 'pages/detail', params: { auto: '1' } }]))

  page.isSaveMode = true
  page.selectAutoSave()
  assert.equal(pushes.length, 1)
})

test('consumes the click emitted after a long press before loading the manual slot', () => {
  const pushes = []
  const page = createSavesPage(pushes)
  page.recoveryData = [{ currentScene: 7 }]

  page.requestDeleteSlot(0)
  page.selectSlot(0)
  assert.equal(page.deleteSlotIndex, 0)
  assert.equal(pushes.length, 0)

  page.cancelDelete()
  page.selectSlot(0)
  assert.equal(JSON.stringify(pushes), JSON.stringify([{ uri: 'pages/detail', params: { load: '0' } }]))
})

test('uses auto-save state only for the homepage resume copy', () => {
  const page = createIndexPage()
  page.autoSaveData = null
  page.refreshResumeState()
  assert.equal(page.primaryAction, '开始阅读')
  page.autoSaveData = { chapter: 1, currentScene: 12 }
  page.refreshResumeState()
  assert.equal(page.primaryAction, '继续阅读')
})


test('round-trips save, overwrite, delete, and restore state', () => {
  const page = createPage()
  page.chapter = 3
  page.currentScene = 100
  page.currentDialogue = 2
  page.choice = [8, 12]
  page.routeState = { 'day-route-first': [8], 'day-route-second': [2] }
  page.saveRecoveryData('new')
  assert.equal(page.recoveryData.length, 1)
  assert.equal(page.recoveryData[0].currentScene, 100)
  assert.equal(page.recoveryData[0].currentDialogue, 2)
  assert.equal(typeof page.recoveryData[0].savedAt, 'number')

  page.currentScene = 200
  page.currentDialogue = 4
  page.choice.push(99)
  page.saveRecoveryData(0)
  assert.equal(page.recoveryData[0].currentScene, 200)
  assert.deepEqual(page.recoveryData[0].choice, [8, 12, 99])

  page.loadScene = (scene) => { page.loadedScene = scene }
  page.currentScene = 0
  page.currentDialogue = 0
  page.loadRecoveryData(0)
  assert.equal(page.currentScene, 200)
  assert.equal(page.currentDialogue, 4)
  assert.equal(page.loadedScene, 200)

  page.deleteRecoveryData(0)
  assert.equal(page.recoveryData.length, 0)
})

test('copies choices and route state when saving', () => {
  const page = createPage()
  page.choice = [1]
  page.routeState = { 'day-route-first': [1], 'day-route-second': [3] }
  page.saveRecoveryData('new')
  page.choice.push(2)
  page.routeState['day-route-first'].push(2)
  page.routeState['day-route-second'].push(0)
  assert.equal(JSON.stringify(page.recoveryData[0].choice), JSON.stringify([1]))
  assert.equal(JSON.stringify(page.recoveryData[0].routeState), JSON.stringify({ 'day-route-first': [1], 'day-route-second': [3] }))
})

test('keeps the two route menus independent and migrates legacy saves to the first menu', () => {
  const page = createPage()
  page.prefetchNextChunk = () => {}
  page.trimChunkCache = () => {}
  page.showBackground = () => {}
  page.setTextSize = () => {}
  page.stageLayout = () => ({})
  page.overlayLayout = () => ({})
  page.routeState = { 'day-route-first': [0, 3], 'day-route-second': [0, 2] }
  const choices = ['a', 'b', 'c', 'd'].map((text, sourceIndex) => ({ text, sourceIndex, nextScene: 1 }))

  page.renderScene(10, { choices, choiceGroup: 'day-route-first', characters: [] })
  assert.deepEqual(page.choices.map((choice) => choice.text), ['b', 'c'])
  page.renderScene(20, { choices, choiceGroup: 'day-route-second', characters: [] })
  assert.deepEqual(page.choices.map((choice) => choice.text), ['b', 'd'])

  page.routeState['day-route-first'] = [0, 1, 2, 3]
  page.loadScene = (scene) => { page.loadedScene = scene }
  page.renderScene(30, { choices, choiceGroup: 'day-route-first', choiceCompleteScene: 77, characters: [] })
  assert.equal(page.loadedScene, 77)

  page.restoreData({ currentScene: 0, currentDialogue: 0, choice: [], routeState: { 'day-route': [0, 3] }, settings: {} })
  assert.equal(JSON.stringify(page.routeState), JSON.stringify({ 'day-route-first': [0, 3], 'day-route-second': [] }))
})

test('clears end and choice overlays before loading a save', () => {
  const page = createPage()
  page.recoveryData = [{ currentScene: 42, currentDialogue: 0, choice: [], routeState: {}, settings: {} }]
  page.END = 'ending'
  page.showEnd = true
  page.showChoice = true
  page.dialogueVisible = true
  page.menu = true
  page.recovery = 2
  page.loadScene = (scene) => { page.loadedScene = scene }

  page.loadRecoveryData(0)

  assert.equal(page.END, '')
  assert.equal(page.showEnd, false)
  assert.equal(page.showChoice, false)
  assert.equal(page.dialogueVisible, false)
  assert.equal(page.menu, false)
  assert.equal(page.recovery, 0)
  assert.equal(page.loadedScene, 42)
})

test('does not count the restored dialogue toward the next auto-save', () => {
  const page = createPage()
  page.prefetchNextChunk = () => {}
  page.trimChunkCache = () => {}
  page.showBackground = () => {}
  page.setTextSize = () => {}
  page.stageLayout = () => ({})
  page.overlayLayout = () => ({})
  page.restoring = true
  page.showDialogue = (dialogue, countForAutoSave) => { page.countForAutoSave = countForAutoSave }

  page.renderScene(42, { chapter: 0, characters: [], dialogues: [{ text: '恢复的对白' }] })

  assert.equal(page.countForAutoSave, false)
})

test('centers CG only on entry or a CG group change', async () => {
  const page = createPage()
  const scrolls = []
  page.$element = () => ({ scrollTo: (position) => scrolls.push(position) })

  page.showBackground('/cg/one.png', '', { key: 'CG1_1', anchor: 'FullScreen' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  page.showBackground('/cg/two.png', '', { key: 'CG1_2', anchor: 'FullScreen' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  page.showBackground('/cg/three.png', '', { key: 'CG2_1', anchor: 'Overlay' })
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(scrolls.length, 2)
  assert.equal(scrolls[0].left, 178)
  assert.equal(scrolls[1].left, 178)
  assert.equal(page.isFullScreenCg, false)
})

test('coalesces concurrent reads for the same story chunk and clears pending state', () => {
  let calls = 0
  let request
  const page = createPage({ readText(options) { calls += 1; request = options } })
  const results = []
  const chunk = { start: 128, count: 1, file: '/common/story/chunks/story-001.txt' }

  page.readChunk(chunk, (scenes) => results.push(['first', scenes]), () => results.push(['first-fail']))
  page.readChunk(chunk, (scenes) => results.push(['second', scenes]), () => results.push(['second-fail']))
  assert.equal(calls, 1)
  assert.equal(page.chunkRequests[128].length, 2)

  request.success({ text: '[{"dialogues":[]}]' })
  assert.equal(page.chunkRequests[128], undefined)
  assert.equal(results.length, 2)
  assert.equal(results[0][1], results[1][1])

  page.readChunk({ start: 256, count: 1, file: '/common/story/chunks/story-002.txt' }, () => results.push(['third']), () => results.push(['third-fail']))
  request.fail()
  assert.equal(page.chunkRequests[256], undefined)
  assert.deepEqual(results.at(-1), ['third-fail'])
})
