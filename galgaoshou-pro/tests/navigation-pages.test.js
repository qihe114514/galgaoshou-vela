const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'))
const index = fs.readFileSync('src/pages/index/index.ux', 'utf8')
const detail = fs.readFileSync('src/pages/detail/detail.ux', 'utf8')
const saves = fs.readFileSync('src/pages/saves/saves.ux', 'utf8')
const settings = fs.readFileSync('src/pages/settings/settings.ux', 'utf8')
const about = fs.readFileSync('src/pages/about/about.ux', 'utf8')

test('registers the independent navigation pages', () => {
  for (const page of ['pages/index', 'pages/detail', 'pages/settings', 'pages/saves', 'pages/about']) {
    assert.ok(manifest.pages.includes(page))
    assert.ok(manifest.router.pages[page])
  }
  assert.match(index, /uri: 'pages\/saves', params: \{ mode: 'load' \}/)
  assert.match(index, /uri: 'pages\/settings'/)
  assert.match(index, /uri: 'pages\/about'/)
  assert.equal(manifest.router.entry, 'pages/index')
})

test('keeps save routing and new pages local to the device', () => {
  assert.match(saves, /protected:\s*\{\s*mode:\s*'load'\s*\}/)
  assert.match(detail, /key: 'pendingSave'/)
  assert.match(saves, /key: 'pendingSave'/)
  assert.match(saves, /storage\.delete\(\{ key: 'pendingSave'/)
  assert.match(saves, /<list class="save-list" if="\{\{autoSaveRow \|\| saveRows\.length\}\}">/)
  assert.match(saves, /<div class="page" @swipe="blockSystemBack">/)
  assert.match(saves, /blockSystemBack\(\) \{\}/)
  assert.match(saves, /@longpress="requestDeleteSlot\(\$idx\)"/)
  assert.match(saves, /deleteSlotIndex: -1/)
  assert.match(saves, /<div class="delete-dialog" if="\{\{deleteSlotIndex >= 0\}\}">/)
  assert.match(saves, /confirmDelete\(\)/)
  for (const source of [settings, saves, about]) {
    assert.doesNotMatch(source, /https?:\/\//)
    assert.doesNotMatch(source, /animation-name|animation-duration|animation-iteration-count|@keyframes/)
  }
  for (const source of [settings, saves, about]) {
    assert.doesNotMatch(source, /page-motion|motionStaticClass|playIntro|translateY/)
  }
  assert.doesNotMatch(settings, /id="settings-(?:content|preview|actions)"/)
  assert.doesNotMatch(saves, /id="saves-(?:list|empty)"/)
  assert.doesNotMatch(about, /id="about-content"/)
  assert.equal(fs.existsSync('src/common/page-motion.js'), false)
  assert.doesNotMatch(index, /from '@system\.folme'/)
  assert.doesNotMatch(index, /@keyframes|animation-name|animation-duration|animation-delay|animation-fill-mode/)
  assert.doesNotMatch(detail, /(?:^|[;{]\s*)animation\s*:/m)
  assert.doesNotMatch(detail, /animation[^\n}]*opacity|opacity[^\n}]*animation/)
  assert.doesNotMatch(detail, /toState: \{[^}]*opacity/)
  assert.doesNotMatch(detail, /from '@system\.folme'|folme\./)
})

test('keeps the settings preview close to the reader dialogue layer', () => {
  assert.match(settings, /<div class="preview-screen">[\s\S]*<div class="preview-panel"><\/div>[\s\S]*class="preview-name"[\s\S]*<scroll class="preview-scroll"/)
  assert.doesNotMatch(settings, /style="font-size:/)
  assert.match(settings, /preview-dialogue-small" if="\{\{textSmall\}\}"/)
  assert.match(settings, /preview-dialogue-medium" if="\{\{textMedium\}\}"/)
  assert.match(settings, /preview-dialogue-large" if="\{\{textLarge\}\}"/)
  assert.match(settings, /textSmall = textSize <= 22/)
  assert.match(settings, /textMedium = textSize > 22 && textSize <= 30/)
  assert.match(settings, /textLarge = textSize > 30/)
  assert.match(settings, /\.preview-dialogue-small \{[^}]*font-size: 20px;/)
  assert.match(settings, /\.preview-dialogue-medium \{[^}]*font-size: 24px;[^}]*line-height: 34px;/)
  assert.match(settings, /\.preview-dialogue-large \{[^}]*font-size: 28px;[^}]*line-height: 38px;/)
  assert.match(settings, /\.preview-panel \{[^}]*background-color: rgba\(18,13,19,0\.30\);/)
  assert.match(settings, /\.preview-screen \{[^}]*width: 212px;/)
  assert.match(settings, /\.preview-scroll \{[^}]*left: 0px;[^}]*width: 212px;/)
  assert.match(settings, /这是一段较长的对白预览/)
})

test('provides compact rectangular-screen layouts without changing page logic', () => {
  for (const source of [index, detail, settings, saves, about]) {
    assert.match(source, /@media \(shape: rect\) \{[\s\S]*?\.page \{ width: 212px; height: 303px; \}/)
  }
  assert.match(index, /@media \(shape: rect\) \{[\s\S]*?\.home-panel \{ top: 118px; width: 212px; height: 185px;/)
  assert.match(saves, /@media \(shape: rect\) \{[\s\S]*?\.save-list, \.empty \{ width: 188px; height: 204px;/)
  assert.match(settings, /@media \(shape: rect\) \{[\s\S]*?\.content \{ width: 212px; flex: 1; overflow: hidden; \}/)
  assert.match(about, /@media \(shape: rect\) \{[\s\S]*?\.content \{ width: 188px; flex: 1; overflow: hidden; \}/)
})

test('enlarges interface text without changing reader dialogue sizes', () => {
  assert.match(index, /\.primary-action \{[^}]*font-size: 22px;/)
  assert.match(saves, /\.slot-title \{[^}]*font-size: 21px;/)
  assert.match(settings, /\.primary-btn, \.secondary-btn, \.back-btn \{[^}]*font-size: 20px;/)
  assert.match(detail, /\.choice \{[^}]*font-size: 18px;[^}]*line-height: 23px;/)
  assert.match(detail, /\.menu-btn \{[^}]*font-size: 19px;/)
  assert.match(detail, /\.dialogue-text-small \{ font-size: 20px; \}/)
  assert.match(detail, /\.dialogue-text-medium \{ font-size: 24px; line-height: 34px; \}/)
  assert.match(detail, /\.dialogue-text-large \{ font-size: 28px; line-height: 38px; \}/)
})

test('reloads saved text settings after returning to an existing reader page', () => {
  assert.match(detail, /onInit\(\) \{\s*this\.loadSettings\(\)/)
  assert.match(detail, /onShow\(\) \{\s*this\.loadSettings\(\)/)
  assert.match(detail, /loadSettings\(\)[\s\S]*?normalizeReaderSettings\(saved\)/)
  assert.match(detail, /this\.setTextSize\(this\.settings\.textSize\)/)
})
