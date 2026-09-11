const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')
const sharp = require('sharp')

const index = fs.readFileSync('src/pages/index/index.ux', 'utf8')
const detail = fs.readFileSync('src/pages/detail/detail.ux', 'utf8')

test('targets the REDMI Watch 5 216x257 canvas', async () => {
  const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'))
  assert.equal(manifest.config.designWidth, 216)
  assert.match(index, /\.page \{ width: 216px; height: 257px;[^}]*overflow: hidden;/)
  assert.match(detail, /\.page \{ width: 216px; height: 257px;[^}]*overflow: hidden;/)
  assert.doesNotMatch(index, /@media \(shape: rect\)/)
  assert.doesNotMatch(detail, /@media \(shape: rect\)/)

  const metadata = await sharp('src/common/home-pro.png').metadata()
  assert.equal(metadata.width, 216)
  assert.equal(metadata.height, 257)
})

test('keeps reader layers and compact controls inside the canvas', () => {
  const template = detail.slice(0, detail.indexOf('</template>'))
  for (const layer of ['stageSingleImage', 'stageDuoLeftImage', 'stageDuoRightImage', 'stageTrioLeftImage', 'stageTrioCenterImage', 'stageTrioRightImage', 'stageOverlayImage']) {
    assert.ok(template.includes(`src="{{${layer}}}" if="{{${layer} && !isFullScreenCg}}"`))
  }
  assert.match(detail, /\.dialogue-panel \{[^}]*top: 166px;[^}]*width: 216px;[^}]*height: 91px;/)
  assert.match(detail, /\.scroll \{[^}]*top: 190px;[^}]*left: 8px;[^}]*width: 200px;[^}]*height: 62px;/)
  assert.match(detail, /\.choice-list \{[^}]*top: 28px;[^}]*left: 16px;[^}]*width: 184px;[^}]*height: 196px;/)
  assert.match(detail, /const travel = 216/)
})
