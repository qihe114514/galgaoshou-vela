const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

const settings = fs.readFileSync('src/common/reader-settings.js', 'utf8')
const detail = fs.readFileSync('src/pages/detail/detail.ux', 'utf8')
const settingsPage = fs.readFileSync('src/pages/settings/settings.ux', 'utf8')

test('defines shared reader settings and bounded auto-play delays', () => {
  assert.match(settings, /autoPlay: false/)
  assert.match(settings, /autoPlaySpeed: 'medium'/)
  assert.match(settings, /Math\.max\(1400, Math\.min\(9000/)
  assert.match(settings, /slow: 1\.35/)
  assert.match(settings, /fast: 0\.7/)
})

test('persists auto-play speed controls in the settings page', () => {
  assert.match(settingsPage, /setAutoPlaySpeed\('slow'\)/)
  assert.match(settingsPage, /setAutoPlaySpeed\('medium'\)/)
  assert.match(settingsPage, /setAutoPlaySpeed\('fast'\)/)
  assert.match(settingsPage, /normalizeReaderSettings\(this\.settings\)/)
})

test('supports auto-play, long-press hiding, and CG suppression', () => {
  assert.match(detail, /@longpress="enableUIHidden"/)
  assert.match(detail, /if="\{\{dialogueVisible && !isUIHidden\}\}"/)
  assert.match(detail, /clearAutoPlayTimer\(\)/)
  assert.match(detail, /scheduleAutoPlay\(\)/)
  assert.match(detail, /toggleAutoPlay/)
  assert.match(detail, /if="\{\{stageSingleImage && !isFullScreenCg\}\}"/)
})

