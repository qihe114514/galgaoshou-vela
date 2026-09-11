const path = require('node:path')
const fs = require('node:fs')
const sharp = require('sharp')

const root = path.resolve(__dirname, '..')
const data = path.join(root, 'tools', 'data')
const outputs = path.join(root, 'src', 'common')
const palettePng = { compressionLevel: 9, palette: true, quality: 75, colours: 128, dither: 0.25, effort: 10, adaptiveFiltering: true }

Promise.all([
  sharp(path.join(data, 'home.png')).resize(192, 490, { fit: 'cover', position: 'centre' }).png(palettePng).toFile(path.join(outputs, 'home.png')),
  sharp(path.join(data, 'logo.png')).resize(163, 93, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png(palettePng).toFile(path.join(outputs, 'logo.png')),
  sharp(path.join(data, 'icon.png')).resize(128, 128, { fit: 'fill' }).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(path.join(outputs, 'icon-128.png'))
]).then(() => fs.rmSync(path.join(root, 'src', 'common', 'home.jpg'), { force: true }))
  .catch((error) => { console.error(error.message); process.exitCode = 1 })
