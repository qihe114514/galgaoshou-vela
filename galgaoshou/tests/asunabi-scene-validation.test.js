const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { validate } = require('../tools/validate-full-story')

function readFullScenes() {
  const directory = 'src/common/story/chunks'
  return fs.readdirSync(directory).filter((file) => /^story-\d+\.txt$/.test(file)).sort().flatMap((file) => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')))
}

test('the converted full story has valid chunked scenes and assets', () => {
  const story = JSON.parse(fs.readFileSync('tools/data/generated/story.json', 'utf8'))
  const scenes = readFullScenes()
  assert.deepEqual(validate(story, scenes, 'src/common'), [])
  assert.equal(scenes.length, 4537)
  assert.equal(scenes.find((scene) => scene.choices?.length === 5).choices.length, 5)
  assert.equal(scenes.at(-1).dialogues[0].END, '游戏结束')
})

test('rejects a story with a choice that escapes its nodes', () => {
  const story = { entryId: 'start', endId: 'end', nodes: [
    { id: 'start', type: 'choice', choices: [{ text: '继续', target: 'missing' }] },
    { id: 'end', type: 'end' }
  ] }
  assert.match(validate(story).join('\n'), /跳转目标不存在/)
})
