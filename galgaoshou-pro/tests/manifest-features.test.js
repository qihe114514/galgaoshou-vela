const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

test('declares each system module imported by the pages', () => {
  const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'))
  assert.equal(manifest.versionCode, 73)
  assert.equal(manifest.versionName, '1.3')
  assert.equal(manifest.config.designWidth, 336)
  const features = new Set(manifest.features.map((feature) => feature.name))
  assert.equal(features.has('system.folme'), false)
  for (const page of ['src/pages/index/index.ux', 'src/pages/detail/detail.ux', 'src/pages/settings/settings.ux', 'src/pages/saves/saves.ux', 'src/pages/about/about.ux']) {
    const source = fs.readFileSync(page, 'utf8')
    for (const match of source.matchAll(/from '(@system\.[^']+)'/g)) {
      const feature = match[1].replace('@', '')
      assert.ok(features.has(feature), `${page} 缺少 ${feature} feature`)
    }
  }
})

test('builds release JavaScript and styles inline for the Band 10 Pro runtime', () => {
  const scripts = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts
  for (const name of ['build', 'build:debug', 'release']) {
    assert.doesNotMatch(scripts[name], /--enable-(?:jsc|protobuf)/)
  }
})
