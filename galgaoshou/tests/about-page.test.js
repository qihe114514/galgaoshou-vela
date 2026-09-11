const assert = require('node:assert/strict')
const fs = require('node:fs')
const sharp = require('sharp')
const test = require('node:test')

const about = fs.readFileSync('src/pages/about/about.ux', 'utf8')
const aboutTextSource = fs.readFileSync('tools/about-text.html', 'utf8')
const aboutImagePath = 'src/common/about-text.png'
const groupQrPath = 'src/common/qq-group-qrcode.png'

test('keeps the complete about copy in the HTML text source', () => {
  for (const value of [
    '难道你是GAL高手',
    'Could You Be a Gal',
    'Master?',
    'GAL高手制作组',
    'Nyads Games',
    '移植作者：@其核',
    '@liuyuze61',
    '玩了多年游戏还是负KD的无口少女、顶级水平却不擅长画大雷的美少女画师想打一辈子旮旯的富家千金努力理解二次元为何物的现充妹妹。玩家将成为她们的男主，在名为“掐楼之家”的周边店里一同努力让店铺爆火，感情逐渐升温。'
  ]) assert.match(aboutTextSource, value.includes('@') ? /<span class="label">[^<]+<\/span><span class="value">@[^<]+<\/span>/ : value.length > 100 ? new RegExp(value.slice(0, 12)) : new RegExp(value))

  assert.match(aboutTextSource, /width: 188px/)
  assert.match(aboutTextSource, /font-family: "苹方UI-简", "PingFang UI"/)
  assert.match(aboutTextSource, /font-size: 18px;[\s\S]*line-height: 1\.7;/)
  assert.match(aboutTextSource, /\.section-title[\s\S]*margin: 14px 0 4px/)
  assert.doesNotMatch(aboutTextSource, /https?:\/\//)
})

test('uses a transparent static text image inside the scroll area', async () => {
  const metadata = await sharp(aboutImagePath).metadata()

  assert.equal(metadata.format, 'png')
  assert.equal(metadata.width, 188)
  assert.equal(metadata.height, 800)
  assert.equal(metadata.hasAlpha, true)
  assert.match(about, /<scroll[^>]*class="content \{\{motionStaticClass\}\}"[^>]*scroll-y="true"[^>]*>\s*<image static class="about-text" src="\/common\/about-text\.png"><\/image>/)
  assert.doesNotMatch(about, /content-inner/)
  assert.match(about, /\.content \{[^}]*width: 188px;[^}]*height: 396px;[^}]*flex-direction: column;[^}]*flex-wrap: nowrap;/)
  assert.match(about, /\.about-text \{[^}]*width: 188px;[^}]*height: 800px;/)
  assert.match(about, /<text class="back-btn" @click="back">返回<\/text>/)
  assert.match(about, /back\(\) \{ router\.back\(\) \}/)
  assert.match(about, /blockSystemBack\(\) \{\}/)
  assert.doesNotMatch(about, /text-overflow|lines="|class="description"|class="section-title"/)
  assert.doesNotMatch(about, /<image[^>]+src="https?:\/\//)
})

test('includes the official QQ group QR code after the about copy', async () => {
  const metadata = await sharp(groupQrPath).metadata()

  assert.equal(metadata.format, 'png')
  assert.equal(metadata.width, 170)
  assert.equal(metadata.height, 170)
  assert.match(about, /<text class="group-title">加入官方QQ群<\/text>/)
  assert.match(about, /<image static class="group-qr" src="\/common\/qq-group-qrcode\.png"><\/image>/)
  assert.match(about, /<text class="group-number">群号 1105166284<\/text>/)
})
