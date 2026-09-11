const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'))
const detail = fs.readFileSync('src/pages/detail/detail.ux', 'utf8')
const home = fs.readFileSync('src/pages/trial-home/trial-home.ux', 'utf8')
const end = fs.readFileSync('src/pages/trial-end/trial-end.ux', 'utf8')
const settings = fs.readFileSync('src/pages/settings/settings.ux', 'utf8')
const about = fs.readFileSync('src/pages/about/about.ux', 'utf8')
const index = JSON.parse(fs.readFileSync('src/common/story/story-index.txt', 'utf8'))

function pngSize(file) {
  const data = fs.readFileSync(file)
  assert.equal(data.readUInt32BE(0), 0x89504e47)
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
}

test('targets the Xiaomi Band 9 viewport and compact launcher icon', () => {
  assert.equal(manifest.config.designWidth, 192)
  assert.equal(manifest.icon, '/common/icon-128.png')
  assert.deepEqual(pngSize('src/common/icon-128.png'), { width: 128, height: 128 })
  assert.deepEqual(pngSize('src/common/home.png'), { width: 192, height: 490 })
})

test('ships only the trial navigation flow', () => {
  assert.equal(manifest.versionCode, 59)
  assert.equal(manifest.router.entry, 'pages/trial-home')
  assert.deepEqual(manifest.pages, ['pages/trial-home', 'pages/trial-end', 'pages/detail', 'pages/settings', 'pages/about'])
  assert.match(home, />试玩版</)
  assert.match(detail, />试玩版</)
  assert.doesNotMatch(`${home}\n${detail}\n${end}`, /activation|license|激活/)
})

test('ends the trial at scene 315 with AstroBox and official QQ group entry points', () => {
  assert.match(detail, /sceneIndex >= 315\) return router\.replace\(\{ uri: 'pages\/trial-end' \}\)/)
  assert.match(end, /完整版前往AstroBox购买/)
  assert.match(end, /value="https:\/\/astrobox\.online\/"/)
  assert.match(end, /扫码了解AstroBox/)
  assert.match(end, /加入官方QQ群/)
  assert.match(end, /群内抽取Steam原作CDK/)
  assert.match(end, /群号 1105166284/)
  assert.match(end, /src="\/common\/qq-group-qrcode\.png"/)
  assert.ok(fs.existsSync('src/common/qq-group-qrcode.png'))
  assert.equal(fs.existsSync('src/common/qq-group-qrcode.jpg'), false)
  assert.match(end, />返回首页<\/text>/)
  assert.doesNotMatch(end, /试玩首页|exit-btn|exitApp/)
  assert.match(end, /uri: 'pages\/trial-home'/)
})

test('opens the purchase page from independently animated home actions', () => {
  assert.match(home, /\.page \{ width: 192px; height: 490px;/)
  assert.match(home, /\.home-logo \{[^}]*width: 163px;[^}]*height: 93px;/)
  assert.match(home, /id="trial-purchase"[^>]*@click="openPurchase">购买完整版<\/text>/)
  assert.match(home, /id="trial-exit"[^>]*@click="exitApp">退出<\/text>/)
  assert.match(home, /'trial-purchase': '223px'/)
  assert.match(home, /'trial-exit': '223px'/)
  assert.match(home, /ids: \['trial-action-row'\], delay: 180/)
  assert.match(home, /ids: \['trial-purchase'\], delay: 260/)
  assert.match(home, /ids: \['trial-exit'\], delay: 340/)
  assert.match(home, /openPurchase\(\) \{ router\.push\(\{ uri: 'pages\/trial-end' \}\) \}/)
  assert.match(home, /\.exit-action[^}]*width: 130px[^}]*background-color: #ead1da[^}]*color: #722c4b/)
})

test('shows settings and about content without intro animation', () => {
  assert.doesNotMatch(settings, /createPageMotion|motionStaticClass|translateY\(/)
  assert.doesNotMatch(about, /createPageMotion|motionStaticClass|translateY\(/)
})

test('keeps text reveal and background motion off the JavaScript animation loop', () => {
  assert.match(detail, /if \(!this\.canContinue\) return this\.finishTyping\(\)/)
  assert.match(detail, /this\.index = Math\.min\(this\.typingText\.length, Math\.max\(this\.index \+ 1, Math\.floor\(elapsed \/ speed\) \+ 1\)\)/)
  assert.match(detail, /this\.showText = this\.typingText\.slice\(0, this\.index\)/)
  assert.match(detail, /setTimeout\(\(\) => this\.zhuzi\(token\), 50\)/)
  assert.doesNotMatch(detail, /showText \+= this\.typingText\.charAt/)
  assert.match(detail, /import folme from '@system\.folme'/)
  assert.match(detail, /stopBackgroundMotion\(\)/)
  assert.match(detail, /folme\.to\(\{ id, toState: \{ \[property\]: '0px' \}, config: \{ duration: 5 \} \}\)/)
  assert.match(detail, /folme\.to\(\{ id, toState: \{ \[property\]: firstTarget \}, config: \{ duration: 5 \} \}\)/)
  assert.match(detail, /setTimeout\(\(\) => moveToStart\(\), 5000\)/)
  assert.match(detail, /setTimeout\(\(\) => moveToEnd\(\), 5000\)/)
  assert.doesNotMatch(detail, /animation-duration|@keyframes|background-horizontal-motion/)
  assert.match(detail, /firstTarget = motion === 'vertical' \? '-8px' : '-460px'/)
})

test('contains only trial scenes and their image resources', () => {
  assert.equal(index.storyId, 'gal-master-trial')
  assert.equal(index.nodeCount, 315)
  assert.equal(index.endScene, 314)
  assert.equal(index.chunks.length, 3)
  assert.equal(fs.readdirSync('src/common/story/chunks').filter((file) => /^story-\d+\.txt$/.test(file)).length, 3)
  const scenes = index.chunks.flatMap((chunk) => JSON.parse(fs.readFileSync(`src${chunk.file}`, 'utf8')))
  const used = new Set()
  for (const scene of scenes) {
    for (const image of [scene.background, scene.sceneOverlay && scene.sceneOverlay.image, scene.topRightOverlay && scene.topRightOverlay.image, scene.centerOverlay && scene.centerOverlay.image, scene.cgImage && scene.cgImage.image]) if (image) used.add(image.split('/').at(-1))
    for (const character of scene.characters || []) if (character.image) used.add(character.image.split('/').at(-1))
  }
  const images = new Set(fs.readdirSync('src/common/images'))
  assert.deepEqual(images, used)
})
