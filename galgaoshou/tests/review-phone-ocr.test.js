const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { createCatalog, createServer } = require('../tools/review-phone-ocr')

function request(port, method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const data = body && JSON.stringify(body)
    const request = http.request({ host: '127.0.0.1', port, path: requestPath, method, headers: data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {} }, (response) => {
      let result = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { result += chunk })
      response.on('end', () => resolve({ status: response.statusCode, body: result }))
    })
    request.on('error', reject)
    if (data) request.write(data)
    request.end()
  })
}

test('creates an ordered catalog for phone overlays only', () => {
  const catalog = createCatalog([
    { key: '手机10_2', kind: 'centerOverlay', output: 'second.png' },
    { key: '手机2_1', kind: 'centerOverlay', output: 'first.png' },
    { key: 'CG1', kind: 'cg', output: 'cg.png' }
  ], { 手机10_2: '第二条', 手机2_1: '第一条' })
  assert.deepEqual(catalog, [
    { key: '手机2_1', image: 'first.png', text: '第一条' },
    { key: '手机10_2', image: 'second.png', text: '第二条' }
  ])
})

test('saves a reviewed entry to the OCR data and correction overlay', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gal-ocr-review-'))
  const manifestPath = path.join(root, 'assets.json')
  const ocrPath = path.join(root, 'phone-ocr.json')
  const correctionsPath = path.join(root, 'phone-ocr-corrections.json')
  fs.writeFileSync(manifestPath, JSON.stringify([{ key: '手机1_1', kind: 'centerOverlay', output: 'phone.png' }]))
  fs.writeFileSync(ocrPath, JSON.stringify({ 手机1_1: '错误文本' }))
  fs.writeFileSync(path.join(root, 'phone.png'), 'png')
  const server = createServer({ manifestPath, ocrPath, correctionsPath, imagesDir: root })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const port = server.address().port
    const before = await request(port, 'GET', '/api/entries')
    assert.deepEqual(JSON.parse(before.body), [{ key: '手机1_1', image: 'phone.png', text: '错误文本' }])
    const saved = await request(port, 'PUT', '/api/entries/%E6%89%8B%E6%9C%BA1_1', { text: '已校对文本' })
    assert.equal(saved.status, 200)
    assert.equal(JSON.parse(fs.readFileSync(ocrPath, 'utf8')).手机1_1, '已校对文本')
    assert.equal(JSON.parse(fs.readFileSync(correctionsPath, 'utf8')).手机1_1, '已校对文本')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
