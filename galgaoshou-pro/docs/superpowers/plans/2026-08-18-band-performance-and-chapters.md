# Band Performance and Chapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the full-story Band 10 RPK size and scene-switch latency while adding reliable typing controls and automatic safe chapter navigation.

**Architecture:** Keep the existing Asunabi-style Vela player. The conversion pipeline will assign chapter metadata and canonicalize only near-identical background images. The runtime will hold the current and next story chunks, while the resource exporter emits smaller indexed PNGs without changing the PNG-only device contract.

**Tech Stack:** Vela JS Quick App (`.ux`), Node.js, Sharp, Node test runner, AIoT Toolkit.

## Global Constraints

- Device layout remains `212x520`; resources remain PNG only, with no JPG/JPEG output.
- The author’s Asunabi/ATRI page framework remains in place.
- Phone text must remain readable; do not apply approximate deduplication to phone, CG, calendar, or overlay images.
- Approximate deduplication applies only to backgrounds and only with a conservative pixel threshold.
- Existing saves keep working through their stored global scene number.
- Increment `src/manifest.json` `versionCode` once immediately before the final RPK packaging action.

---

### Task 1: Make exporter compression and stage composition testable

**Files:**
- Modify: `tools/export-assetripper-resources.js:55-105`
- Modify: `tests/exported-resources.test.js`

**Interfaces:**
- Produces: `target(kind)` dimensions and `pngOptions(kind)` encoder options.
- Produces: `composeStage(rendered, offset)` to place a transparent stage or standee on a `212x520` canvas.

- [ ] **Step 1: Add failing compression and placement tests**

```javascript
const { target, pngOptions, stageOffset } = require('../tools/export-assetripper-resources')

test('uses indexed high-quality PNGs for phone images and preserves their canvas', () => {
  assert.deepEqual(target('centerOverlay'), { width: 256, height: 405, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  assert.deepEqual(pngOptions('centerOverlay'), { compressionLevel: 9, palette: true, quality: 95, colours: 256, dither: 0, effort: 10, adaptiveFiltering: true })
})

test('places stage and standee assets 30 pixels lower on their fixed canvas', () => {
  assert.equal(stageOffset('stage'), 30)
  assert.equal(stageOffset('standee'), 30)
})
```

- [ ] **Step 2: Run the focused test and confirm it fails because the helpers do not exist**

Run: `node --test tests/exported-resources.test.js`

Expected: FAIL with `pngOptions is not a function`.

- [ ] **Step 3: Add minimal exporter helpers and use them in `exportAsset`**

```javascript
function pngOptions(kind) {
  if (kind === 'background' || kind === 'cg') return { compressionLevel: 9, palette: true, quality: 50, colours: 32, dither: 0, effort: 10, adaptiveFiltering: true }
  if (kind === 'stage' || kind === 'standee') return { compressionLevel: 9, palette: true, quality: 75, colours: 128, dither: 0.5, effort: 10, adaptiveFiltering: true }
  if (kind === 'centerOverlay') return { compressionLevel: 9, palette: true, quality: 95, colours: 256, dither: 0, effort: 10, adaptiveFiltering: true }
  return { compressionLevel: 9, palette: false, effort: 10, adaptiveFiltering: true }
}

function stageOffset(kind) { return kind === 'stage' || kind === 'standee' ? 30 : 0 }
```

Render the transparent stage at `height: 520 - stageOffset(kind)` before compositing it at `top: stageOffset(kind)`, then call `outputImage.png(pngOptions(kind)).toFile(output)`.

- [ ] **Step 4: Run focused and resource tests**

Run: `node --test tests/exported-resources.test.js`

Expected: PASS.

### Task 2: Canonicalize near-identical background resources

**Files:**
- Create: `tools/dedupe-background-assets.js`
- Modify: `package.json:6-15`
- Modify: `tests/exported-resources.test.js`

**Interfaces:**
- Produces: `dedupeBackgrounds(story, assets, imageRoot, threshold)` returning `{ story, assets, aliases }`.
- Consumes: generated story JSON and generated assets JSON.

- [ ] **Step 1: Add failing deduplication tests**

```javascript
const { dedupeBackgrounds } = require('../tools/dedupe-background-assets')

test('aliases visually equivalent backgrounds but never phone overlays', async () => {
  const result = await dedupeBackgrounds({ nodes: [
    { background: '/common/images/a.png', centerOverlay: { image: '/common/images/phone.png' } },
    { background: '/common/images/b.png', centerOverlay: { image: '/common/images/phone.png' } }
  ] }, [
    { kind: 'background', output: 'a.png' }, { kind: 'background', output: 'b.png' }, { kind: 'centerOverlay', output: 'phone.png' }
  ], fixtureRoot, 1)
  assert.equal(result.story.nodes[1].background, '/common/images/a.png')
  assert.equal(result.story.nodes[1].centerOverlay.image, '/common/images/phone.png')
})
```

- [ ] **Step 2: Run the focused test and confirm the module is missing**

Run: `node --test tests/exported-resources.test.js`

Expected: FAIL with `Cannot find module '../tools/dedupe-background-assets'`.

- [ ] **Step 3: Implement conservative background aliasing**

```javascript
async function fingerprint(file) {
  const { data, info } = await sharp(file).resize(48, 36, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function averageDifference(left, right) {
  if (left.data.length !== right.data.length) return Infinity
  let total = 0
  for (let index = 0; index < left.data.length; index += 1) total += Math.abs(left.data[index] - right.data[index])
  return total / left.data.length
}
```

Compare only `asset.kind === 'background'`; at a maximum average channel difference of `1`, map later paths to the first canonical path. Rewrite `story.nodes[*].background`, remove unused aliased asset entries, and delete only files whose output is no longer referenced.

- [ ] **Step 4: Insert the dedupe step after export and before chunk conversion**

```json
"dedupe:assets": "node tools/dedupe-background-assets.js tools/data/generated/story.json tools/data/generated/assets.json src/common/images",
"refresh:story": "npm run extract:source && npm run transform:story && npm run export:assets && npm run dedupe:assets && npm run convert:story",
"check": "npm run transform:story && npm run convert:story && npm run validate:story && npm test"
```

Keep `check` non-destructive: it validates the currently exported assets without contacting AssetRipper.

- [ ] **Step 5: Run deduplication and resource tests**

Run: `npm run dedupe:assets && node --test tests/exported-resources.test.js`

Expected: PASS; no phone, CG, date, or overlay filename is removed.

### Task 3: Add chapter metadata during story conversion

**Files:**
- Modify: `tools/transform-story.js:1-145`
- Modify: `tools/convert-story-to-asunabi.js:1-95`
- Modify: `tools/validate-full-story.js:1-75`
- Modify: `tests/full-story.test.js`

**Interfaces:**
- Produces: `story.chapters`, each `{ id, title, startId }`.
- Produces: every converted scene with `chapter` and `chapterStart` fields.
- Consumes: `chapterStart` in the Vela player for safe chapter skipping.

- [ ] **Step 1: Add failing chapter conversion tests**

```javascript
test('creates automatic chapters at large stable intervals and choice nodes', () => {
  const result = convert(source)
  assert.equal(result.story.chapters[0].startId, 'd-0')
  assert.ok(result.story.chapters.some((chapter) => chapter.startId === 'd-193'))
  assert.ok(result.story.chapters.every((chapter) => result.story.nodes.some((node) => node.id === chapter.startId)))
})

test('carries chapter metadata into chunked scenes', () => {
  const scenes = convertScenes(convert(source).story)
  assert.equal(typeof scenes[0].chapter, 'number')
  assert.equal(scenes[0].chapterStart, true)
})
```

- [ ] **Step 2: Run focused story tests and confirm the metadata assertions fail**

Run: `node --test tests/full-story.test.js`

Expected: FAIL because `chapters` and scene `chapter` fields are absent.

- [ ] **Step 3: Implement deterministic automatic boundaries**

```javascript
const CHAPTER_INTERVAL = 512

function buildChapters(nodes) {
  const starts = new Set([0])
  nodes.forEach((node, index) => { if (index > 0 && (index % CHAPTER_INTERVAL === 0 || node.type === 'choice')) starts.add(index) })
  return [...starts].sort((left, right) => left - right).map((start, chapter) => ({ id: `chapter-${chapter + 1}`, title: `第${chapter + 1}章`, startId: nodes[start].id, start }))
}
```

Attach `chapter` and `chapterStart` to nodes from this ordered list. Extend the chunk index with `chapters`, and copy each node’s chapter properties to the corresponding output scene. Extend validation to reject an absent, duplicate, or unreachable chapter start.

- [ ] **Step 4: Run full story conversion tests**

Run: `node --test tests/full-story.test.js tests/asunabi-scene-validation.test.js`

Expected: PASS with 4,537 scenes and a reachable first chapter at scene `0`.

### Task 4: Fix Vela text interaction, home loading, chunk caching, and chapter skip

**Files:**
- Modify: `src/pages/index/index.ux:2-84`
- Modify: `src/pages/detail/detail.ux:1-238`
- Modify: `tests/band-layout.test.js`

**Interfaces:**
- Consumes: `storyIndex.chapters`, scene `chapter`, and scene `chapterStart`.
- Produces: `readChunk(chunk, callback)`, `prefetchNextChunk(sceneIndex)`, `finishTyping()`, and `nextSafeChapter()`.

- [ ] **Step 1: Add failing source-level regression assertions**

```javascript
assert.match(index, /@complete="onHomeBackgroundReady"/)
assert.match(index, /onHomeBackgroundReady\(\) \{ this\.startHomePan\(\) \}/)
assert.match(detail, /Number\.isFinite\(Number\(saved\.textSpeed\)\) \? Number\(saved\.textSpeed\) : DEFAULT_SETTINGS\.textSpeed/)
assert.match(detail, /if \(!this\.canContinue\) return this\.finishTyping\(\)/)
assert.match(detail, /prefetchNextChunk\(sceneIndex\)/)
assert.match(detail, /nextSafeChapter\(\)/)
```

- [ ] **Step 2: Run the layout test and confirm it fails**

Run: `node --test tests/band-layout.test.js`

Expected: FAIL because the home load callback, zero-speed normalization, cache, and chapter skip methods are absent.

- [ ] **Step 3: Implement zero-speed and tap-to-complete behavior**

```javascript
showDialogue(dialogue) {
  this.typingText = dialogue.text || ''
  this.showText = ''
  this.character = dialogue.character || ''
  this.canContinue = false
  this.index = 0
  if (this.settings.textSpeed === 0) return this.finishTyping()
  this.zhuzi()
}

zhuzi() {
  if (this.index >= this.typingText.length) return this.finishTyping()
  this.showText += this.typingText.charAt(this.index++)
  setTimeout(() => this.zhuzi(), this.settings.textSpeed)
}

finishTyping() { this.showText = this.typingText; this.index = this.typingText.length; this.canContinue = true }
```

In `nextDialogue`, replace the early return with `if (!this.canContinue) return this.finishTyping()`.

- [ ] **Step 4: Implement two-block cache and background-ready start**

```javascript
readChunk(chunk, callback) {
  const cached = this.chunkCache[chunk.start]
  if (cached) return callback(cached)
  file.readText({ uri: chunk.file, success: (data) => {
    const scenes = JSON.parse(data.text)
    this.chunkCache[chunk.start] = scenes
    callback(scenes)
  }, fail: () => prompt.showToast({ message: '游戏资源缺失' }) })
}
```

Call `prefetchNextChunk(sceneIndex)` after rendering. Limit `chunkCache` to the current and immediate sequential next chunk. In `index.ux`, add `@complete="onHomeBackgroundReady"` to `home-bg`, remove the `onReady` call, and call `startHomePan()` only from `onHomeBackgroundReady`.

- [ ] **Step 5: Implement safe chapter skipping**

```javascript
nextSafeChapter() {
  const chapters = this.storyIndex.chapters || []
  return chapters.find((chapter) => chapter.start > this.currentScene && this.canReachWithoutChoice(this.currentScene, chapter.start)) || null
}
```

Follow dialogue targets only in `canReachWithoutChoice`; stop at a choice or an already visited scene. `skipChapter` loads the returned start scene, otherwise shows the existing unavailable message. Include `chapter` in newly written saves but never depend on it when restoring old saves.

- [ ] **Step 6: Run Vela layout regression tests**

Run: `node --test tests/band-layout.test.js`

Expected: PASS.

### Task 5: Re-export, verify, package, and test on hardware

**Files:**
- Modify: `src/manifest.json`
- Generated: `src/common/images/*`, `src/common/story/story-index.txt`, `src/common/story/chunks/story-*.txt`

- [ ] **Step 1: Generate story, export PNG resources, dedupe backgrounds, and regenerate chunks**

Run: `npm run transform:story && npm run export:assets && npm run dedupe:assets && npm run convert:story`

Expected: Every resource is PNG; phone overlays are indexed PNG; only unreferenced duplicate backgrounds are removed.

- [ ] **Step 2: Add a resource-size assertion and run the full check**

```javascript
assert.ok(totalBytes < 16000000, `expected images below 16 MB, received ${totalBytes}`)
assert.equal(jpgFiles.length, 0)
```

Run: `npm run check`

Expected: PASS; all story, chapter, asset, and UI tests pass.

- [ ] **Step 3: Increment the package version exactly once**

Change the manifest field from its current integer to the next integer immediately before packaging.

- [ ] **Step 4: Build and inspect the RPK**

Run: `npm run build`

Expected: exit code `0`.

Run: `tar -tf dist/cn.galgaoshou.qihe.debug.0.1.0.rpk`

Expected: no `.jpg` or `.jpeg`; contains `common/story/story-index.txt`, all story chunks, and only PNG scene assets.

- [ ] **Step 5: Perform required real-device checks**

Install the new RPK on Band 10 and verify: home screen waits for its picture before panning; no grey home screen after five cold launches; text speed `0` is immediate; tapping during typing completes the text; normal scene changes and at least one chunk boundary do not visibly pause; phone text remains readable; characters and standees are 30px lower; chapter skip stops at a choice instead of crossing it.
