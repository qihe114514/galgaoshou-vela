const fs = require('node:fs')
const path = require('node:path')

const baseUrl = process.env.ASSETRIPPER_URL || 'http://127.0.0.1:48567'
const mainDataPath = encodeURIComponent(JSON.stringify({ C: { B: { P: [] }, I: 1 }, D: 1565 }))

async function main() {
  const [output] = process.argv.slice(2)
  if (!output) throw new Error('用法：node tools/extract-prologue-from-assetripper.js <MainData_SO.json>')
  const response = await fetch(`${baseUrl}/Assets/Json?Path=${mainDataPath}`)
  if (!response.ok) throw new Error(`无法读取 MainData_SO：${response.status}`)
  const source = await response.json()
  if (!source.m_Structure || !Array.isArray(source.m_Structure.MainDataList)) throw new Error('AssetRipper 返回的 MainData_SO 无效。')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, `${JSON.stringify(source, null, 2)}\n`)
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })
