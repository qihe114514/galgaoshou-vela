const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const sharp = require('sharp')

const index = fs.readFileSync('src/pages/index/index.ux', 'utf8')
const detail = fs.readFileSync('src/pages/detail/detail.ux', 'utf8')

test('renders a static compact home dock', () => {
  assert.match(index, /\.page \{ width: 212px; height: 520px;[^}]*overflow: hidden;/)
  assert.match(index, /id="home-bg" static class="home-background" src="\/common\/home-pro\.png"><\/image>/)
  assert.doesNotMatch(index, /home-shade/)
  assert.match(index, /<image static class="home-logo" src="\/common\/logo\.png"><\/image>/)
  assert.doesNotMatch(index, /home-logo-backplate/)
  assert.match(index, /<div class="home-panel">/)
  assert.match(index, /<text class="resume-copy">\{\{resumeCopy\}\}<\/text>/)
  assert.match(index, /<text class="primary-action" @click="continueGame">\{\{primaryAction\}\}<\/text>/)
  assert.match(index, /<div class="secondary-row">/)
  assert.match(index, /<div class="action-row">/)
  assert.match(index, /<text class="exit-action" @click="exit">退出<\/text>/)
  assert.match(index, /\.home-logo \{[^}]*top: 96px;[^}]*left: 16px;[^}]*width: 180px;[^}]*height: 102px;/)
  assert.match(index, /\.home-panel \{[^}]*top: 284px;[^}]*left: 0px;[^}]*width: 212px;[^}]*height: 236px;/)
  assert.match(index, /\.primary-action \{[^}]*width: 176px;[^}]*height: 50px;/)
  assert.match(index, /\.primary-action \{[^}]*border-radius: 10px;/)
  assert.match(index, /\.secondary-row \{[^}]*width: 176px;/)
  assert.match(index, /\.secondary-action \{[^}]*width: 84px;[^}]*border-radius: 10px;/)
  assert.match(index, /\.exit-action \{[^}]*width: 176px;[^}]*height: 40px;/)
  assert.match(index, /refreshAutoSave\(\)/)
  assert.match(index, /key: 'autoSave'/)
  assert.doesNotMatch(index, /key: 'recoveryData'/)
  assert.match(index, /continueGame\(\)/)
  assert.match(index, /openSaves\(\)/)
  assert.match(index, /openSettings\(\)/)
  assert.match(index, /openAbout\(\)/)
  assert.doesNotMatch(index, /import folme|HOME_MOTION_IDS|HOME_INITIAL_STATE|HOME_FINAL_STATE|homeIntroToken|playHomeIntro|scheduleHomeMotion|runHomeMotion|setHomeInitialState|cancelHomeIntro/)
  assert.doesNotMatch(index, /homeStaticClass|home-static/)
  assert.match(index, /\.home-panel \{[^}]*background-color: #f5e1e8;[^}]*border-radius: 14px 14px 0px 0px;/)
  assert.doesNotMatch(index, /\.home-panel \{[^}]*opacity:/)
  assert.doesNotMatch(index, /transform\s*:/)
  assert.doesNotMatch(index, /setTimeout\(|clearTimeout\(/)
  assert.doesNotMatch(index, /@keyframes|animation-name|animation-duration|animation-delay|animation-fill-mode|scaleX|scaleY|rotate/)
})

test('uses a top-cropped background image for the 10 Pro home screen', async () => {
  const metadata = await sharp('src/common/home-pro.png').metadata()
  assert.equal(metadata.width, 212)
  assert.equal(metadata.height, 303)
  const [source, crop] = await Promise.all([
    sharp('src/common/home.png').extract({ left: 0, top: 0, width: 212, height: 303 }).raw().toBuffer(),
    sharp('src/common/home-pro.png').raw().toBuffer()
  ])
  assert.deepEqual(crop, source)
})

test('keeps the reader layers and makes dialogue readable above a dark panel', () => {
  const template = detail.slice(0, detail.indexOf('</template>'))
  const horizontalBackground = template.match(/<scroll id="bg-horizontal-scroll"[^>]*>/)[0]
  const verticalBackground = template.match(/<scroll id="bg-vertical-scroll"[^>]*>/)[0]
  const staticBackground = template.match(/<image id="bg-static"[^>]*>/)[0]
  const cgScroll = template.match(/<scroll id="cg-scroll"[^>]*>/)[0]

  assert.doesNotMatch(template, /class="reader-status"/)
  assert.match(template, /<div class="dialogue-panel" if="\{\{dialogueVisible(?: && !isUIHidden)?\}\}"/)
  assert.doesNotMatch(template, /class="text-bg"/)
  for (const background of [horizontalBackground, verticalBackground, staticBackground, cgScroll]) assert.match(background, /@swipe="blockSystemBack"/)
  for (const layer of ['stageSingleImage', 'stageDuoLeftImage', 'stageDuoRightImage', 'stageTrioLeftImage', 'stageTrioCenterImage', 'stageTrioRightImage', 'stageOverlayImage']) {
    assert.ok(template.includes(`src="{{${layer}}}" if="{{${layer} && !isFullScreenCg}}"`))
  }
  assert.match(detail, /\.dialogue-panel \{[^}]*top: 326px;[^}]*height: 194px;[^}]*background-color: #120d13;[^}]*opacity: 0\.30;/)
  assert.match(detail, /\.character-name \{[^}]*left: 10px;[^}]*width: 192px;/)
  assert.match(detail, /\.scroll \{[^}]*top: 360px;[^}]*left: 5px;[^}]*width: 202px;[^}]*height: 152px;/)
  assert.match(detail, /\.top-right-overlay \{[^}]*top: 76px;[^}]*left: 70px;[^}]*width: 100px;[^}]*height: 60px;/)
  assert.match(detail, /\.menu-trigger-hit \{[^}]*left: 74px;[^}]*width: 64px;[^}]*height: 64px;/)
  assert.match(detail, /chapterLabel: '第1章'/)
  assert.match(detail, /sceneProgress: '场景 1'/)
})

test('renders choice options as compact vertically centered buttons', () => {
  const template = detail.slice(0, detail.indexOf('</template>'))

  assert.doesNotMatch(template, /class="choice-title"/)
  assert.match(template, /<scroll scroll-y="true" bounces="true" class="choice-list">\s*<div class="choice-grid">\s*<text class="choice" for="\{\{choices\}\}" @click="selectChoice\(\$idx\)">\{\{\$item\.text\}\}<\/text>/)
  assert.match(detail, /\.choice-list \{[^}]*top: 72px;[^}]*left: 14px;[^}]*width: 184px;[^}]*height: 376px;/)
  assert.match(detail, /\.choice-grid \{[^}]*width: 184px;[^}]*min-height: 376px;[^}]*flex-direction: column;[^}]*flex-wrap: nowrap;[^}]*justify-content: center;[^}]*align-items: center;/)
  assert.match(detail, /\.choice \{[^}]*width: 88px;[^}]*height: 64px;[^}]*font-size: 18px;[^}]*line-height: 23px;/)
  assert.match(detail, /selectChoice\(choiceIndex\)/)
})

test('maps the 336 by 480 reader layout to a 212 by 303 design canvas', () => {
  const rect = detail.match(/@media \(shape: rect\) \{([\s\S]*?)\n\}/)
  assert.ok(rect)
  assert.match(rect[1], /\.page \{ width: 212px; height: 303px; \}/)
  assert.match(rect[1], /\.dialogue-panel \{ top: 187px; width: 212px; height: 116px;/)
  assert.match(rect[1], /\.scroll \{ top: 214px; left: 8px; width: 196px; height: 82px;/)
  assert.match(rect[1], /\.choice-list \{ top: 34px; left: 16px; width: 180px; height: 224px;/)
  assert.match(rect[1], /\.menu-close \{ width: 164px; height: 32px; line-height: 32px;/)
})

test('frames characters and the home logo for the 336 by 480 rect screen', () => {
  const rect = detail.match(/@media \(shape: rect\) \{([\s\S]*?)\n\}/)
  assert.ok(rect)
  assert.match(rect[1], /\.person-single \{ top: -8px; left: -53px; width: 318px; height: 338px; \}/)
  assert.match(rect[1], /\.person-duo-left \{ bottom: -29px; left: -38px; width: 180px; height: 368px; \}/)
  assert.match(rect[1], /\.person-duo-right \{ bottom: -29px; left: 70px; width: 180px; height: 368px; \}/)
  assert.match(rect[1], /\.person-trio-left \{ bottom: -26px; left: -43px; width: 145px; height: 327px; \}/)
  assert.match(rect[1], /\.person-trio-center \{ bottom: -26px; left: 33px; width: 145px; height: 327px; \}/)
  assert.match(rect[1], /\.person-trio-right \{ bottom: -26px; left: 110px; width: 145px; height: 327px; \}/)
  assert.match(index, /@media \(shape: rect\) \{[\s\S]*?\.home-logo \{ top: 18px; left: 36px; width: 140px; height: 80px; \}/)
})

test('uses one scroll-clipped horizontal background for the 10 Pro', () => {
  const template = detail.slice(0, detail.indexOf('</template>'))
  assert.match(template, /<scroll id="bg-horizontal-scroll" scroll-x="true" scroll-y="false" bounces="false" class="background-scroll" if="\{\{Img && backgroundMode === 'horizontal'\}\}" @swipe="blockSystemBack">/)
  assert.match(template, /<image class="background-horizontal" src="\{\{Img\}\}"><\/image>/)
  assert.doesNotMatch(template, /bg-horizontal-(?:pill|rect)/)
  assert.match(detail, /if \(motion === 'horizontal'\) return this\.startHorizontalBackgroundMotion\(token\)/)
  assert.match(template, /<scroll id="bg-vertical-scroll" scroll-x="false" scroll-y="true" bounces="false" class="background-vertical-scroll"/)
  assert.match(template, /<div class="background-vertical-track"><image class="background-vertical" src="\{\{Img\}\}"><\/image><\/div>/)
  assert.match(detail, /return this\.startVerticalBackgroundMotion\(token\)/)
  assert.match(detail, /const travel = 8/)
  assert.match(detail, /this\.scrollBackground\('bg-vertical-scroll', 0, top\)/)
  assert.match(detail, /scrollBackground\(id, left, top\)/)
  assert.match(detail, /const travel = 308/)
  assert.match(detail, /const duration = 5000/)
  assert.match(detail, /this\.scrollBackground\('bg-horizontal-scroll', left, 0\)/)
  assert.match(detail, /setTimeout\(tick, 50\)/)
  const rect = detail.match(/@media \(shape: rect\) \{([\s\S]*?)\n\}/)
  assert.ok(rect)
  assert.match(rect[1], /\.background-scroll \{ width: 212px; height: 303px; \}/)
  assert.match(rect[1], /\.background-horizontal \{ width: 520px; height: 303px; object-fit: cover; \}/)
  assert.match(rect[1], /\.background-vertical-scroll \{ width: 212px; height: 303px; \}/)
  assert.match(rect[1], /\.background-vertical-track \{ width: 405px; height: 311px; \}/)
  assert.match(rect[1], /\.background-vertical \{ width: 405px; height: 303px; \}/)
})

test('uses a full-screen menu and preserves performant reader behavior', () => {
  const template = detail.slice(0, detail.indexOf('</template>'))
  const horizontalBackground = template.match(/<scroll id="bg-horizontal-scroll"[^>]*>/)[0]
  const verticalBackground = template.match(/<scroll id="bg-vertical-scroll"[^>]*>/)[0]
  const staticBackground = template.match(/<image id="bg-static"[^>]*>/)[0]
  const cgScroll = template.match(/<scroll id="cg-scroll"[^>]*>/)[0]
  const cgImage = template.match(/<image class="cg-image"[^>]*>/)[0]
  assert.match(template, /<div class="page menu-page" if="\{\{menu\}\}" @swipe="back">/)
  assert.match(template, /<div class="menu-status">[\s\S]*class="chapter-label"[\s\S]*class="scene-progress"/)
  assert.match(template, /@click="openSavePage"/)
  assert.match(template, /@click="openLoadPage"/)
  assert.match(template, /@click="openSettingsPage"/)
  assert.doesNotMatch(template, /openAboutPage/)
  assert.match(detail, /\.menu-page \{[^}]*top: 0px;[^}]*left: 0px;[^}]*background-color: #171119;/)
  assert.match(detail, /openSavePage\(\)[\s\S]*?key: 'pendingSave'/)
  assert.match(detail, /openLoadPage\(\) \{ this\.menu = false; router\.push\(\{ uri: 'pages\/saves', params: \{ mode: 'load' \} \}\) \}/)
  assert.match(detail, /openSettingsPage\(\) \{ this\.menu = false; router\.push\(\{ uri: 'pages\/settings' \}\) \}/)
  assert.match(detail, /\.menu-page \{[^}]*justify-content: center;/)
  assert.match(detail, /\.menu-close \{[^}]*width: 184px;[^}]*height: 50px;[^}]*background-color: #302b33;[^}]*border-radius: 10px;/)
  assert.match(detail, /if \(!this\.canContinue\) return this\.finishTyping\(\)/)
  assert.match(detail, /if \(this\.settings\.textSpeed === 0\) \{\s*this\.finishTyping\(\)\s*if \(countForAutoSave\) this\.recordAutoSaveDialogue\(\)\s*return\s*\}/)
  assert.match(detail, /prefetchNextChunk\(sceneIndex\)/)
  assert.match(detail, /trimChunkCache\(sceneIndex\)/)
  assert.match(detail, /loadSettings\(\) \{\s*storage\.get\(\{ key: 'settings'/)
  for (const background of [horizontalBackground, verticalBackground, staticBackground, cgScroll, cgImage]) assert.doesNotMatch(background, /background-(?:horizontal|vertical)-motion/)
  assert.doesNotMatch(detail, /import folme from '@system\.folme'|folme\./)
  assert.match(detail, /backgroundMotionToken: 0/)
  assert.match(detail, /startBackgroundMotion\(motion\)/)
  assert.match(detail, /startHorizontalBackgroundMotion\(token\)/)
  assert.match(detail, /startVerticalBackgroundMotion\(token\)/)
  assert.match(detail, /const travel = 8/)
  assert.match(detail, /scrollBackground\('bg-vertical-scroll', 0, top\)/)
  assert.match(detail, /if \(token !== this\.backgroundMotionToken\) return/)
  assert.match(detail, /if \(!isCg && \(motion === 'horizontal' \|\| motion === 'vertical'\)\) this\.startBackgroundMotion\(motion\)/)
  assert.match(detail, /if \(this\.isCg \|\| !this\.Img \|\| !this\.backgroundMode\) return/)
  assert.match(detail, /if \(this\.Img === image && this\.backgroundMode === motion && this\.isCg === isCg && this\.isFullScreenCg === isFullScreenCg\) return/)
  assert.match(detail, /onHide\(\) \{[^}]*this\.stopBackgroundMotion\(\); this\.flushAutoSave\(\); this\.clearAutoPlayTimer\(\) \}/)
  assert.match(detail, /onDestroy\(\) \{[^}]*this\.stopBackgroundMotion\(\); this\.flushAutoSave\(\); this\.clearAutoPlayTimer\(\);/)
  assert.doesNotMatch(detail, /animation-name|animation-duration|animation-iteration-count|@keyframes/)
  assert.match(detail, /blockSystemBack\(\) \{\}/)
  assert.match(detail, /nextSafeChapter\(\)/)
})

test('uses the moved date overlay slot for every calendar scene', () => {
  const keys = []
  const chunkDir = path.join('src', 'common', 'story', 'chunks')
  for (const file of fs.readdirSync(chunkDir)) {
    for (const scene of JSON.parse(fs.readFileSync(path.join(chunkDir, file), 'utf8'))) {
      if (scene.topRightOverlay) keys.push(scene.topRightOverlay.key)
    }
  }
  assert.equal(keys.length, 10)
  assert.ok(keys.every((key) => /^日历/.test(key)))
})
