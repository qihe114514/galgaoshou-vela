const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const index = fs.readFileSync('src/pages/index/index.ux', 'utf8')
const detail = fs.readFileSync('src/pages/detail/detail.ux', 'utf8')

test('renders a compact home dock with the 2048N Folme opening animation', () => {
  assert.match(index, /\.page \{ width: 192px; height: 490px;[^}]*overflow: hidden;/)
  assert.match(index, /id="home-bg" static class="home-background" src="\/common\/home\.png"><\/image>/)
  assert.match(index, /<div id="home-shade" class="home-shade"><\/div>/)
  assert.match(index, /<image id="home-logo" static class="home-logo \{\{homeStaticClass\}\}" src="\/common\/logo\.png"><\/image>/)
  assert.doesNotMatch(index, /home-logo-backplate/)
  assert.match(index, /<div id="home-panel" class="home-panel \{\{homeStaticClass\}\}">/)
  assert.match(index, /id="home-resume" class="home-resume-layer \{\{homeStaticClass\}\}"/)
  assert.match(index, /id="home-primary" class="home-primary-layer \{\{homeStaticClass\}\}"/)
  assert.match(index, /id="home-secondary-row" class="secondary-row \{\{homeStaticClass\}\}"/)
  assert.match(index, /id="home-action-row" class="action-row \{\{homeStaticClass\}\}"/)
  assert.match(index, /id="home-exit" class="home-exit-layer \{\{homeStaticClass\}\}"/)
  assert.match(index, /\.home-logo \{[^}]*top: 90px;[^}]*left: 14px;[^}]*width: 163px;[^}]*height: 93px;[^}]*background-color: transparent;/)
  assert.match(index, /\.home-panel \{[^}]*top: 267px;[^}]*left: 0px;[^}]*width: 192px;[^}]*height: 223px;/)
  assert.match(index, /\.home-primary-layer \{[^}]*width: 159px;[^}]*height: 47px;/)
  assert.match(index, /\.primary-action \{[^}]*border-radius: 10px;/)
  assert.match(index, /\.secondary-row \{[^}]*width: 159px;/)
  assert.match(index, /\.secondary-action \{[^}]*width: 76px;[^}]*border-radius: 10px;/)
  assert.match(index, /\.home-exit-layer \{[^}]*width: 159px;[^}]*height: 38px;/)
  assert.match(index, /refreshAutoSave\(\)/)
  assert.match(index, /key: 'autoSave'/)
  assert.doesNotMatch(index, /key: 'recoveryData'/)
  assert.match(index, /continueGame\(\)/)
  assert.match(index, /openSaves\(\)/)
  assert.match(index, /openSettings\(\)/)
  assert.match(index, /openAbout\(\)/)
  assert.match(index, /import folme from '@system\.folme'/)
  assert.match(index, /homeIntroToken: 0/)
  assert.match(index, /setTimeout\(\(\) => \{[\s\S]*?setHomeInitialState\(\)/)
  assert.match(index, /folme\.setTo\(\{ id, toState: \{ translateY: HOME_INITIAL_STATE\[id\]\.translateY \} \}\)/)
  assert.match(index, /folme\.startGroup\(frames\)/)
  assert.match(index, /folme\.to\(frame\)/)
  assert.match(index, /this\.runHomeMotion\(ids, HOME_FINAL_STATE, 0\.25\)/)
  assert.match(index, /'home-logo': \{ translateY: '0px' \}/)
  assert.match(index, /'home-panel': \{ translateY: '0px' \}/)
  assert.match(index, /toState: \{ translateY: \{ value: targets\[id\]\.translateY \} \}, config: \{ duration \}/)
  assert.doesNotMatch(index, /HOME_MID_STATE|runHomeMotion\([^\n]*0\.10|\}, 100\)/)
  assert.doesNotMatch(index, /ease-out/)
  for (const delay of ['200', '360', '420', '480', '540', '600']) assert.match(index, new RegExp(`scheduleHomeMotion\([^\n]+, ${delay}\)`))
  assert.match(index, /if \(token !== this\.homeIntroToken\) return/)
  assert.match(index, /onHide\(\) \{[^}]*cancelHomeIntro\(\)/)
  assert.match(index, /homeStaticClass = 'home-static'/)
  assert.doesNotMatch(index, /@keyframes|animation-name|animation-duration|animation-delay|animation-fill-mode|scaleX|scaleY|rotate/)
})

test('keeps the reader layers and makes dialogue readable above a dark panel', () => {
  const template = detail.slice(0, detail.indexOf('</template>'))
  const horizontalBackground = template.match(/<image id="bg-horizontal"[^>]*>/)[0]
  const verticalBackground = template.match(/<image id="bg-vertical"[^>]*>/)[0]
  const staticBackground = template.match(/<image id="bg-static"[^>]*>/)[0]
  const cgScroll = template.match(/<scroll id="cg-scroll"[^>]*>/)[0]

  assert.doesNotMatch(template, /class="reader-status"/)
  assert.match(template, /<div class="dialogue-panel" if="\{\{dialogueVisible(?: && !isUIHidden)?\}\}"/)
  assert.doesNotMatch(template, /class="text-bg"/)
  for (const background of [horizontalBackground, verticalBackground, staticBackground, cgScroll]) assert.match(background, /@swipe="blockSystemBack"/)
  for (const layer of ['stageSingleImage', 'stageDuoLeftImage', 'stageDuoRightImage', 'stageTrioLeftImage', 'stageTrioCenterImage', 'stageTrioRightImage', 'stageOverlayImage']) {
    assert.ok(template.includes(`src="{{${layer}}}" if="{{${layer} && !isFullScreenCg}}"`))
  }
  assert.match(detail, /\.dialogue-panel \{[^}]*top: 307px;[^}]*height: 183px;[^}]*background-color: #120d13;[^}]*opacity: 0\.30;/)
  assert.match(detail, /\.character-name \{[^}]*left: 9px;[^}]*width: 174px;/)
  assert.match(detail, /\.scroll \{[^}]*top: 339px;[^}]*left: 5px;[^}]*width: 182px;[^}]*height: 143px;/)
  assert.match(detail, /\.top-right-overlay \{[^}]*top: 72px;[^}]*left: 63px;[^}]*width: 91px;[^}]*height: 57px;/)
  assert.match(detail, /\.menu-trigger-hit \{[^}]*left: 67px;[^}]*width: 58px;[^}]*height: 60px;/)
  assert.match(detail, /chapterLabel: '第1章'/)
  assert.match(detail, /sceneProgress: '场景 1'/)
})

test('renders choice options as compact vertically centered buttons', () => {
  const template = detail.slice(0, detail.indexOf('</template>'))

  assert.doesNotMatch(template, /class="choice-title"/)
  assert.match(template, /<scroll scroll-y="true" bounces="true" class="choice-list">\s*<div class="choice-grid">\s*<text class="choice" for="\{\{choices\}\}" @click="selectChoice\(\$idx\)">\{\{\$item\.text\}\}<\/text>/)
  assert.match(detail, /\.choice-list \{[^}]*top: 68px;[^}]*left: 13px;[^}]*width: 166px;[^}]*height: 353px;/)
  assert.match(detail, /\.choice-grid \{[^}]*width: 166px;[^}]*min-height: 353px;[^}]*flex-direction: column;[^}]*flex-wrap: nowrap;[^}]*justify-content: center;[^}]*align-items: center;/)
  assert.match(detail, /\.choice \{[^}]*width: 80px;[^}]*height: 60px;[^}]*font-size: 18px;[^}]*line-height: 23px;/)
  assert.match(detail, /selectChoice\(choiceIndex\)/)
})

test('uses a full-screen menu and preserves performant reader behavior', () => {
  const template = detail.slice(0, detail.indexOf('</template>'))
  const horizontalBackground = template.match(/<image id="bg-horizontal"[^>]*>/)[0]
  const verticalBackground = template.match(/<image id="bg-vertical"[^>]*>/)[0]
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
  assert.match(detail, /\.menu-close \{[^}]*width: 166px;[^}]*height: 47px;[^}]*background-color: #302b33;[^}]*border-radius: 10px;/)
  assert.match(detail, /if \(!this\.canContinue\) return this\.finishTyping\(\)/)
  assert.match(detail, /if \(this\.settings\.textSpeed === 0\) \{\s*this\.finishTyping\(\)\s*if \(countForAutoSave\) this\.recordAutoSaveDialogue\(\)\s*return\s*\}/)
  assert.match(detail, /prefetchNextChunk\(sceneIndex\)/)
  assert.match(detail, /trimChunkCache\(sceneIndex\)/)
  assert.match(detail, /loadSettings\(\) \{\s*storage\.get\(\{ key: 'settings'/)
  for (const background of [horizontalBackground, verticalBackground, staticBackground, cgScroll, cgImage]) assert.doesNotMatch(background, /background-(?:horizontal|vertical)-motion/)
  assert.match(detail, /import folme from '@system\.folme'/)
  assert.match(detail, /backgroundMotionToken: 0/)
  assert.match(detail, /startBackgroundMotion\(motion\)/)
  assert.match(detail, /motion === 'vertical' \? 'bg-vertical' : 'bg-horizontal'/)
  assert.match(detail, /motion === 'vertical' \? 'translateY' : 'translateX'/)
  assert.match(detail, /motion === 'vertical' \? '-8px' : '-460px'/)
  assert.match(detail, /folme\.to\(\{ id, toState: \{ \[property\]: target \}, config: \{ duration: 5 \} \}\)/)
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
