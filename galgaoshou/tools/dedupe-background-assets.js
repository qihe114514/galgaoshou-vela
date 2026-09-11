const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

async function fingerprint(file) {
  const metadata = await sharp(file).metadata()
  const data = await sharp(file).resize(48, 36, { fit: 'fill' }).removeAlpha().raw().toBuffer()
  return { width: metadata.width, height: metadata.height, data }
}

function averageDifference(left, right) {
  if (left.width !== right.width || left.height !== right.height || left.data.length !== right.data.length) return Infinity
  let total = 0
  for (let index = 0; index < left.data.length; index += 1) total += Math.abs(left.data[index] - right.data[index])
  return total / left.data.length
}

function replaceBackgroundPaths(story, aliases) {
  for (const node of story.nodes || []) {
    if (!node.background) continue
    const output = path.basename(node.background)
    if (aliases[output]) node.background = `/common/images/${aliases[output]}`
  }
}

async function dedupeBackgrounds(story, assets, imageRoot, threshold = 5) {
  const aliases = {}
  const canonical = []
  for (const asset of assets.filter((item) => item.kind === 'background')) {
    const current = { asset, fingerprint: await fingerprint(path.join(imageRoot, asset.output)) }
    const match = canonical.find((candidate) => averageDifference(candidate.fingerprint, current.fingerprint) <= threshold)
    if (match) aliases[asset.output] = match.asset.output
    else canonical.push(current)
  }
  replaceBackgroundPaths(story, aliases)
  return { story, assets: assets.filter((asset) => !aliases[asset.output]), aliases }
}

async function main() {
  const [storyPath, assetsPath, imageRoot, aliasesPath] = process.argv.slice(2)
  if (!storyPath || !assetsPath || !imageRoot || !aliasesPath) throw new Error('用法：node tools/dedupe-background-assets.js <story.json> <assets.json> <images-dir> <aliases.json>')
  const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'))
  const assets = JSON.parse(fs.readFileSync(assetsPath, 'utf8'))
  const result = await dedupeBackgrounds(story, assets, imageRoot)
  const keyAliases = {}
  for (const [output, canonicalOutput] of Object.entries(result.aliases)) {
    const source = assets.find((asset) => asset.output === output)
    const canonical = assets.find((asset) => asset.output === canonicalOutput)
    if (source && canonical) keyAliases[source.key] = canonical.key
    fs.unlinkSync(path.join(imageRoot, output))
  }
  fs.writeFileSync(storyPath, `${JSON.stringify(result.story)}\n`)
  fs.writeFileSync(assetsPath, `${JSON.stringify(result.assets, null, 2)}\n`)
  fs.writeFileSync(aliasesPath, `${JSON.stringify(keyAliases, null, 2)}\n`)
  console.log(`已合并 ${Object.keys(result.aliases).length} 个近似背景。`)
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1 })

module.exports = { averageDifference, dedupeBackgrounds, fingerprint }
