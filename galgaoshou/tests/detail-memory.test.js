const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const detail = fs.readFileSync('src/pages/detail/detail.ux', 'utf8')
const index = fs.readFileSync('src/pages/index/index.ux', 'utf8')

test('keeps direct image mounting and a one-chunk prefetch window', () => {
  const renderScene = detail.match(/renderScene\(sceneIndex, scene\)\s*\{([\s\S]*?)\r?\n\s*\},\r?\n\s*nextDialogue/)
  assert.ok(renderScene)
  assert.match(renderScene[1], /this\.stageSingleImage\s*=\s*layout\.stageSingleImage/)
  assert.match(renderScene[1], /this\.showBackground\(scene\.cgImage/)
  assert.match(renderScene[1], /this\.prefetchNextChunk\(sceneIndex\)/)
  assert.match(detail, /const keep = new Set\(\[current && current\.start,[\s\S]*position >= 0[\s\S]*position \+ 1/)
  assert.doesNotMatch(detail, /clearRenderedLayers\(\)/)
  assert.doesNotMatch(detail, /renderToken\s*:/)
})

test('defines independent auto-save loading and writing', () => {
  assert.match(detail, /protected:\s*\{\s*load:\s*'',\s*auto:\s*''\s*\}/)
  assert.match(detail, /key:\s*'autoSave'/)
  assert.match(detail, /recordAutoSaveDialogue\(\)/)
  assert.match(index, /key:\s*'autoSave'/)
  assert.match(index, /params:\s*\{\s*auto:\s*'1'\s*\}/)
})
