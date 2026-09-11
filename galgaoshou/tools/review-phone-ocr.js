const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
}

function writeJson(file, data) {
  const temporary = `${file}.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`)
  fs.renameSync(temporary, file)
}

function createCatalog(assets, ocr) {
  return assets
    .filter((asset) => asset.kind === 'centerOverlay' && asset.key.startsWith('手机'))
    .map((asset) => ({ key: asset.key, image: asset.output, text: ocr[asset.key] || '' }))
    .sort((left, right) => left.key.localeCompare(right.key, 'zh-Hans-CN', { numeric: true }))
}

function page() {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>手机 OCR 校对</title><style>
* { box-sizing: border-box; } body { margin: 0; color: #20252c; background: #edf0f2; font: 16px system-ui, sans-serif; }
header { display: flex; align-items: center; gap: 16px; padding: 12px 18px; background: #fff; border-bottom: 1px solid #d7dde0; } h1 { margin: 0; font-size: 18px; } #search { width: 280px; max-width: 45vw; padding: 8px; border: 1px solid #aeb8bd; border-radius: 4px; } #count, #status { margin-left: auto; color: #53626b; font-size: 13px; }
main { display: grid; grid-template-columns: 250px minmax(0, 1fr); height: calc(100vh - 51px); } nav { overflow: auto; background: #fff; border-right: 1px solid #d7dde0; } nav button { display: block; width: 100%; padding: 10px 14px; text-align: left; color: #303940; background: #fff; border: 0; border-bottom: 1px solid #edf0f2; cursor: pointer; } nav button.active { color: #075f76; background: #e1f4f4; font-weight: 700; } section { display: grid; grid-template-columns: minmax(250px, .8fr) minmax(300px, 1fr); gap: 18px; overflow: auto; padding: 18px; } .image-panel, .edit-panel { min-width: 0; } img { display: block; width: min(100%, 520px); max-height: calc(100vh - 130px); object-fit: contain; margin: auto; background: #c9d0d3; } h2 { margin: 0 0 10px; font-size: 18px; } textarea { width: 100%; min-height: 330px; resize: vertical; padding: 12px; color: #20252c; background: #fff; border: 1px solid #aeb8bd; border-radius: 4px; font: 16px/1.5 ui-monospace, Consolas, monospace; } .actions { display: flex; gap: 8px; margin-top: 10px; } .actions button { padding: 8px 14px; color: #fff; background: #087e8b; border: 0; border-radius: 4px; cursor: pointer; } .actions button.secondary { color: #253037; background: #dbe2e5; } @media (max-width: 720px) { header { gap: 8px; padding: 10px; } main { grid-template-columns: 130px minmax(0, 1fr); } section { grid-template-columns: 1fr; padding: 12px; } nav button { padding: 9px; font-size: 13px; } #status { display: none; } textarea { min-height: 200px; } img { max-height: 360px; } }
</style></head><body><header><h1>手机 OCR 校对</h1><input id="search" placeholder="搜索编号或文字"><span id="count"></span><span id="status"></span></header><main><nav id="list"></nav><section><div class="image-panel"><h2 id="key"></h2><img id="image" alt="手机界面原图"></div><div class="edit-panel"><textarea id="text" spellcheck="false"></textarea><div class="actions"><button id="save">保存</button><button id="previous" class="secondary" title="上一张">上一张</button><button id="next" class="secondary" title="下一张">下一张</button></div></div></section></main><script>
let entries = [], visible = [], selected = 0
const list = document.querySelector('#list'), text = document.querySelector('#text'), image = document.querySelector('#image'), key = document.querySelector('#key'), status = document.querySelector('#status')
function current() { return visible[selected] }
function render() { const entry = current(); document.querySelector('#count').textContent = visible.length + ' / ' + entries.length; list.replaceChildren(...visible.map((item, index) => { const button = document.createElement('button'); button.textContent = item.key; button.className = index === selected ? 'active' : ''; button.onclick = () => { selected = index; render() }; return button })); if (!entry) { key.textContent = '没有匹配项'; image.removeAttribute('src'); text.value = ''; return } key.textContent = entry.key; image.src = '/images/' + encodeURIComponent(entry.image); text.value = entry.text; document.querySelector('.active').scrollIntoView({ block: 'nearest' }) }
function filter() { const query = document.querySelector('#search').value.trim().toLowerCase(); const oldKey = current() && current().key; visible = entries.filter((entry) => !query || entry.key.toLowerCase().includes(query) || entry.text.toLowerCase().includes(query)); selected = Math.max(0, visible.findIndex((entry) => entry.key === oldKey)); render() }
async function save() { const entry = current(); if (!entry) return; status.textContent = '保存中'; const response = await fetch('/api/entries/' + encodeURIComponent(entry.key), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: text.value }) }); if (!response.ok) { status.textContent = '保存失败'; return } entry.text = text.value; status.textContent = '已保存'; setTimeout(() => { if (status.textContent === '已保存') status.textContent = '' }, 1500) }
document.querySelector('#search').addEventListener('input', filter); document.querySelector('#save').onclick = save; document.querySelector('#previous').onclick = () => { if (selected > 0) { selected -= 1; render() } }; document.querySelector('#next').onclick = () => { if (selected + 1 < visible.length) { selected += 1; render() } }; document.addEventListener('keydown', (event) => { if (event.ctrlKey && event.key.toLowerCase() === 's') { event.preventDefault(); save() } })
fetch('/api/entries').then((response) => response.json()).then((data) => { entries = data; visible = data; render() })
</script></body></html>`
}

function respond(response, status, body, contentType = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' })
  response.end(body)
}

function requestBody(request) {
  return new Promise((resolve, reject) => {
    let data = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => { data += chunk; if (data.length > 1024 * 1024) reject(new Error('请求内容过大')) })
    request.on('end', () => resolve(data))
    request.on('error', reject)
  })
}

function createServer({ manifestPath, ocrPath, correctionsPath, imagesDir }) {
  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname
    const assets = () => readJson(manifestPath)
    const catalog = () => createCatalog(assets(), readJson(ocrPath))
    if (request.method === 'GET' && pathname === '/') return respond(response, 200, page(), 'text/html; charset=utf-8')
    if (request.method === 'GET' && pathname === '/api/entries') return respond(response, 200, JSON.stringify(catalog()))
    if (request.method === 'GET' && pathname.startsWith('/images/')) {
      const name = decodeURIComponent(pathname.slice('/images/'.length))
      if (!catalog().some((entry) => entry.image === name)) return respond(response, 404, 'Not found', 'text/plain; charset=utf-8')
      const imagePath = path.join(imagesDir, name)
      if (!fs.existsSync(imagePath)) return respond(response, 404, 'Not found', 'text/plain; charset=utf-8')
      return respond(response, 200, fs.readFileSync(imagePath), 'image/png')
    }
    if (request.method === 'PUT' && pathname.startsWith('/api/entries/')) {
      const key = decodeURIComponent(pathname.slice('/api/entries/'.length))
      if (!catalog().some((entry) => entry.key === key)) return respond(response, 404, JSON.stringify({ error: '未知手机界面' }))
      try {
        const body = JSON.parse(await requestBody(request))
        if (typeof body.text !== 'string') return respond(response, 400, JSON.stringify({ error: 'text 必须是字符串' }))
        const ocr = readJson(ocrPath)
        const corrections = readJson(correctionsPath)
        ocr[key] = body.text.replace(/\r/g, '')
        corrections[key] = ocr[key]
        writeJson(ocrPath, ocr)
        writeJson(correctionsPath, corrections)
        return respond(response, 200, JSON.stringify({ key, text: ocr[key] }))
      } catch (error) { return respond(response, 400, JSON.stringify({ error: error.message })) }
    }
    return respond(response, 404, 'Not found', 'text/plain; charset=utf-8')
  })
}

function main() {
  const root = path.join(__dirname, '..')
  const port = Number(process.env.PORT || 4173)
  const server = createServer({ manifestPath: path.join(__dirname, 'data', 'generated', 'assets.json'), ocrPath: path.join(__dirname, 'data', 'generated', 'phone-ocr.json'), correctionsPath: path.join(__dirname, 'data', 'generated', 'phone-ocr-corrections.json'), imagesDir: path.join(root, 'src', 'common', 'images') })
  server.listen(port, '127.0.0.1', () => console.log(`手机 OCR 校对页：http://127.0.0.1:${port}`))
}

if (require.main === module) main()

module.exports = { createCatalog, createServer }
