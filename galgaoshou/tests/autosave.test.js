const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const test = require('node:test')

const detail = fs.readFileSync('src/pages/detail/detail.ux', 'utf8')
const index = fs.readFileSync('src/pages/index/index.ux', 'utf8')
const script = detail.split('<script>')[1].split('</script>')[0]
  .replace(/^import .*\r?\n/gm, '')
  .replace('export default {', 'module.exports = {')

function createPage(writes) {
  const context = {
    module: { exports: {} }, exports: {}, console, JSON, Number, Object, Array, setTimeout,
    storage: { set(options) { writes.push(options) } }, prompt: { showToast() {} }, router: {}, file: {}
  }
  vm.runInNewContext(script, context)
  const definition = context.module.exports
  const page = Object.assign({}, definition.private)
  for (const [key, value] of Object.entries(definition)) if (typeof value === 'function') page[key] = value
  return page
}

test('writes the latest state to one independent auto-save key', () => {
  const writes = []
  const page = createPage(writes)
  page.chapter = 2
  page.currentScene = 10
  page.currentDialogue = 3
  page.choice = [4]
  page.routeState = { 'day-route-first': [4], 'day-route-second': [] }
  page.settings = { textSpeed: 25, textSize: 22 }
  page.saveAutoSave()
  page.currentScene = 11
  page.saveAutoSave()

  assert.equal(writes.length, 2)
  assert.deepEqual(writes.map((write) => write.key), ['autoSave', 'autoSave'])
  assert.equal(JSON.parse(writes.at(-1).value).currentScene, 11)
  assert.deepEqual(JSON.parse(writes[0].value).routeState, { 'day-route-first': [4], 'day-route-second': [] })
})

test('writes auto-save after every ten newly shown dialogues', () => {
  const writes = []
  const page = createPage(writes)
  page.currentScene = 18
  page.currentDialogue = 4

  for (let index = 0; index < 9; index += 1) page.recordAutoSaveDialogue()
  assert.equal(writes.length, 0)
  assert.equal(page.autoSaveDialogueCount, 9)

  page.recordAutoSaveDialogue()
  page.flushAutoSave()
  assert.equal(writes.length, 1)
  assert.equal(JSON.parse(writes[0].value).currentScene, 18)
  assert.equal(page.autoSaveDialogueCount, 0)

  page.recordAutoSaveDialogue()
  assert.equal(writes.length, 1)
  assert.equal(page.autoSaveDialogueCount, 1)
})

test('homepage prioritizes auto-save and passes its load flag', () => {
  assert.match(index, /autoSaveData/)
  assert.match(index, /if \(this\.autoSaveData\)/)
  assert.match(index, /params: \{ auto: '1' \}/)
  assert.match(index, /if \(this\.autoSaveData\) \{[\s\S]*?this\.primaryAction = '继续阅读'/)
})

test('homepage does not fall back to a manual save when auto-save is unavailable', () => {
  assert.doesNotMatch(index, /params: \{ load: String\(this\.latestSlot\) \}/)
  assert.doesNotMatch(index, /findLatestSlot\(/)
})
