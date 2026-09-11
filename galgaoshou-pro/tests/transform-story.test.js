const assert = require('node:assert/strict')
const test = require('node:test')
const { characterIdentity } = require('../tools/transform-story')
const story = require('../tools/data/generated/story.json')

function node(id) {
  const result = story.nodes.find((item) => item.id === id)
  assert.ok(result, `missing ${id}`)
  return result
}

test('normalizes stage variants to one character identity', () => {
  assert.equal(characterIdentity('MCL2d2'), 'MCL')
  assert.equal(characterIdentity('HXC1g1'), 'HXC')
  for (const scene of story.nodes) {
    const identities = (scene.characters || []).map((character) => characterIdentity(character.key))
    assert.equal(new Set(identities).size, identities.length, `${scene.id} contains duplicate character identities`)
  }
})

test('fixes the reported duplicate-character scenes', () => {
  assert.deepEqual(node('d-1453').characters.map((character) => characterIdentity(character.key)), ['MCL'])
  assert.deepEqual(node('d-1463').characters.map((character) => characterIdentity(character.key)), ['HXC'])
  assert.equal(node('d-1486').characters.some((character) => characterIdentity(character.key) === 'HXC'), false)
})
