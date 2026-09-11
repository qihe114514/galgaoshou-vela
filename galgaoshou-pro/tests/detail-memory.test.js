const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const detail = fs.readFileSync('src/pages/detail/detail.ux', 'utf8')
const index = fs.readFileSync('src/pages/index/index.ux', 'utf8')
const storyIndex = JSON.parse(fs.readFileSync('src/common/story/story-index.txt', 'utf8'))
const storyScenes = storyIndex.chunks.flatMap((chunk) => JSON.parse(fs.readFileSync(`src${chunk.file}`, 'utf8')))

const visualBackgroundKey = (scene) => `${scene.cgImage ? 'cg' : 'bg'}:${scene.cgImage ? scene.cgImage.image : scene.background || ''}`

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

test('batches text reveal and keeps scroll-based background motion active', () => {
  assert.match(detail, /typingStartedAt:\s*0/)
  assert.match(detail, /this\.typingStartedAt = Date\.now\(\)/)
  assert.match(detail, /Math\.floor\(elapsed \/ speed\) \+ 1/)
  assert.match(detail, /this\.showText = this\.typingText\.slice\(0, this\.index\)/)
  assert.match(detail, /typingTimer = setTimeout\(\(\) => \{ this\.typingTimer = null; this\.zhuzi\(token\) \}, 50\)/)
  assert.doesNotMatch(detail, /this\.showText \+= this\.typingText\.charAt/)
  assert.match(detail, /stopBackgroundMotion\(\) \{\s*this\.backgroundMotionToken \+= 1/)
  assert.match(detail, /backgroundTimer: null/)
  assert.match(detail, /typingTimer: null/)
  assert.match(detail, /cgCenterTimer: null/)
  assert.match(detail, /stopTyping\(\)/)
  assert.match(detail, /stopCgCenter\(\)/)
  assert.match(detail, /if \(motion === 'horizontal'\) return this\.startHorizontalBackgroundMotion\(token\)/)
  assert.doesNotMatch(detail, /import folme from '@system\.folme'|folme\./)
  assert.match(detail, /const travel = 356[\s\S]*scrollBackground\('bg-horizontal-scroll'/)
  assert.match(detail, /const travel = 48[\s\S]*scrollBackground\('bg-vertical-scroll'/)
  assert.match(detail, /<scroll id="bg-vertical-scroll" scroll-x="false" scroll-y="true"/)
  assert.match(detail, /startVerticalBackgroundMotion\(token\)/)
  assert.match(detail, /onHide\(\) \{[^}]*this\.stopBackgroundMotion\(\)/)
})

test('skips to the next visible background or CG boundary', () => {
  let target = 1
  while (visualBackgroundKey(storyScenes[target]) === visualBackgroundKey(storyScenes[0])) target += 1
  const cgIndex = storyScenes.findIndex((scene) => scene.cgImage)

  assert.equal(target, 5)
  assert.ok(cgIndex > 0)
  assert.notEqual(visualBackgroundKey(storyScenes[cgIndex]), visualBackgroundKey(storyScenes[cgIndex - 1]))
  assert.match(detail, /<text class="menu-btn" @click="skipScene">跳过场景<\/text>/)
  assert.match(detail, /visualBackgroundKey\(scene\)[\s\S]*scene\.cgImage[\s\S]*'cg'[\s\S]*'bg'/)
  assert.match(detail, /findNextBackgroundScene\(sceneIndex, backgroundKey, complete\)[\s\S]*this\.readChunk\(chunk/)
  assert.match(detail, /if \(this\.visualBackgroundKey\(scene\) !== backgroundKey\) return complete\(chunk\.start \+ index\)[\s\S]*if \(!this\.canSkipScene\(scene\)\) return complete\(-1\)/)
  assert.match(detail, /this\.findNextBackgroundScene\(chunk\.start \+ chunk\.count, backgroundKey, complete\)/)
  assert.match(detail, /this\.trimChunkCache\(this\.currentScene\)/)
  assert.doesNotMatch(detail, /skipScene\(step\)|currentScene \+ step/)
})
