const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

test('targets the Xiaomi Band 9 viewport and compact launcher icon', () => {
  const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'))
  assert.equal(manifest.config.designWidth, 192)
  assert.equal(manifest.icon, '/common/icon-128.png')
})

test('declares each system module imported by the pages', () => {
  const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'))
  const features = new Set(manifest.features.map((feature) => feature.name))
  for (const page of ['src/pages/index/index.ux', 'src/pages/detail/detail.ux', 'src/pages/settings/settings.ux', 'src/pages/saves/saves.ux', 'src/pages/about/about.ux']) {
    const source = fs.readFileSync(page, 'utf8')
    for (const match of source.matchAll(/from '(@system\.[^']+)'/g)) {
      const feature = match[1].replace('@', '')
      assert.ok(features.has(feature), `${page} 缺少 ${feature} feature`)
    }
  }
})
