const assert = require('node:assert/strict')
const test = require('node:test')
const { convert } = require('../tools/convert-prologue-to-asunabi')

test('converts stable nodes to Asunabi scenes with a five-choice relative jump', () => {
  const story = {
    entryId: 'a',
    endId: 'end',
    nodes: [
      { id: 'a', type: 'dialogue', background: '/common/images/bg.png', characters: [{ slot: 'center', image: '/common/images/a.png' }], speaker: '晓夜', text: '开始', next: 'choice' },
      { id: 'choice', type: 'choice', choices: [{ text: '甲', target: 'b' }, { text: '乙', target: 'end' }, { text: '丙', target: 'b' }, { text: '丁', target: 'end' }, { text: '戊', target: 'b' }] },
      { id: 'b', type: 'dialogue', background: '/common/images/bg.png', characters: [], speaker: '', text: '分支', next: 'end' },
      { id: 'end', type: 'end', text: '收下钥匙扣后，我们相互道别。' }
    ]
  }

  const scenes = convert(story)
  assert.equal(scenes.length, 4)
  assert.equal(scenes[0].dialogues[0].character, '晓夜')
  assert.equal(scenes[0].characters[0].slot, 'center')
  assert.equal(scenes[1].choices.length, 5)
  assert.deepEqual(scenes[1].choices.map((choice) => choice.nextScene), [1, 2, 1, 2, 1])
  assert.equal(scenes[3].dialogues[0].END, '序章结束')
})

test('rejects invalid dialogue and choice targets', () => {
  assert.throws(() => convert({ entryId: 'a', endId: 'end', nodes: [
    { id: 'a', type: 'dialogue', text: '开始', next: 'missing' },
    { id: 'end', type: 'end', text: '结束' }
  ] }), /无效后续节点/)
})

test('keeps explicit visual layers for the Vela player', () => {
  const scenes = convert({
    entryId: 'a',
    endId: 'end',
    nodes: [
      { id: 'a', type: 'dialogue', background: '/common/images/bg.jpg', backgroundMotion: 'vertical', sceneOverlay: { image: '/common/images/sign.png' }, topRightOverlay: { image: '/common/images/date.png' }, cgImage: { image: '/common/images/cg.png' }, centerOverlay: { image: '/common/images/phone.png' }, next: 'end' },
      { id: 'end', type: 'end', text: 'end' }
    ]
  })
  assert.equal(scenes[0].backgroundMotion, 'vertical')
  assert.equal(scenes[0].sceneOverlay.image, '/common/images/sign.png')
  assert.equal(scenes[0].cgImage.image, '/common/images/cg.png')
  assert.equal(scenes[0].centerOverlay.image, '/common/images/phone.png')
})
