# 小米手环 9 适配实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 galgaoshou 的固定布局和运行时资源从 `212x520` 适配为小米手环 9 的 `192x490`，并让系统启动器使用完整降采样的 `128x128` 图标。

**Architecture:** 保留现有 Vela 页面、故事数据和路由结构，只替换屏幕基线相关的固定尺寸、资源导出画布与测试断言。首页背景和启动器图标继续由 `tools/optimize-home.js` 生成，剧情图片继续由 `tools/export-assetripper-resources.js` 生成，避免引入运行时缩放层。

**Tech Stack:** Vela UX/CSS、Node.js、Sharp、Node test runner、AIoT Toolkit。

## Global Constraints

- 目标屏幕为 `192x490`，manifest `designWidth` 为 `192`。
- 启动器图标整体降采样为 `128x128`，不裁剪，原始 `tools/data/icon.png` 不改。
- 运行时图片保持 PNG；保留现有调色板压缩策略。
- 不改变故事 JSON、路由、交互文案或已有用户改动。
- 打包 APK 时 versionCode 每次递增；本次未执行打包，不修改 versionCode。

### Task 1: Update layout and resource contract tests

**Files:**
- Modify: `tests/band-layout.test.js`
- Modify: `tests/navigation-pages.test.js`
- Modify: `tests/exported-resources.test.js`
- Modify: `tests/manifest-features.test.js`

**Interfaces:** Tests assert the new `192x490` viewport, `designWidth: 192`, 192-wide page resources, and the manifest reference `/common/icon-128.png`; they remain the executable contract for later tasks.

- [ ] Replace viewport assertions from `212x520` to `192x490` and update only dimensions whose CSS contract changes.
- [ ] Change exported stage/standee assertions to the new 192x490 output sizes and update the home image assertions.
- [ ] Add an assertion that the manifest icon path is `/common/icon-128.png` and that the icon metadata is `128x128` with alpha.
- [ ] Run `npm test -- --test-name-pattern='band|navigation|exported|manifest'` and confirm the tests fail against the old implementation.

### Task 2: Update manifest, home generation, and icon output

**Files:**
- Modify: `src/manifest.json`
- Modify: `tools/optimize-home.js`
- Create: `src/common/icon-128.png`
- Test: `tests/exported-resources.test.js`

**Interfaces:** `tools/optimize-home.js` continues to produce `home.png` and `logo.png`, and additionally writes `icon-128.png`; the manifest consumes that path.

- [ ] Set `config.designWidth` to `192` and `icon` to `/common/icon-128.png`.
- [ ] Change the home export resize target to `192x490`.
- [ ] Generate `icon-128.png` with Sharp `resize(128, 128, { fit: 'fill' })` from `tools/data/icon.png`; do not crop or modify the source asset.
- [ ] Run `node tools/optimize-home.js` and verify the generated metadata before moving on.

### Task 3: Update story resource export dimensions

**Files:**
- Modify: `tools/export-assetripper-resources.js`
- Modify: `tests/exported-resources.test.js`
- Modify: `src/pages/detail/detail.ux`

**Interfaces:** `target(kind)` and the export compositor continue to return Sharp-compatible dimensions; detail page image layers consume the resulting 192x490-compatible assets.

- [ ] Change standee canvas output from `212x520` to `192x490`.
- [ ] Change overlay and stage output dimensions to the scaled 192x490 equivalents used by the compositor; keep background and CG source dimensions unchanged unless their target is explicitly viewport-sized.
- [ ] Update detail page background viewport, CG scroll, character layers, dialogue panel, choice list, menu, and end-page geometry to fit within `192x490` without overflow.
- [ ] Keep existing motion token behavior and interaction handlers unchanged.
- [ ] Run the focused resource and layout tests; they should pass after regenerated assets are present.

### Task 4: Update the remaining page layouts

**Files:**
- Modify: `src/pages/index/index.ux`
- Modify: `src/pages/settings/settings.ux`
- Modify: `src/pages/saves/saves.ux`
- Modify: `src/pages/about/about.ux`
- Modify: `tests/band-layout.test.js`
- Modify: `tests/navigation-pages.test.js`

**Interfaces:** All page roots use the same `192x490` design coordinate system and retain their existing router callbacks and page-motion classes.

- [ ] Change each root page and full-screen scrim to `192x490`.
- [ ] Recalculate fixed horizontal widths, centered margins, vertical offsets, and animation translation distances so controls stay inside the 192-wide screen and the bottom edge ends at 490.
- [ ] Preserve existing text sizes unless a control would overflow; only reduce a size when the new width makes the current text or button impossible to render.
- [ ] Run the page layout and navigation tests.

### Task 5: Regenerate and validate all assets

**Files:**
- Modify: `src/common/home.png`
- Modify: `src/common/logo.png`
- Modify: `src/common/images/*.png`
- Modify: `src/common/icon-128.png`

**Interfaces:** Generated assets must match the dimensions asserted by `tests/exported-resources.test.js` and remain referenced by the existing story files.

- [ ] Run `npm run optimize:home` to regenerate the home assets and icon.
- [ ] Run the existing story export/optimization pipeline needed to regenerate stage and standee assets for the changed compositor dimensions.
- [ ] Verify every generated PNG decodes, has the expected dimensions, and no JPEG files are introduced.
- [ ] Check that total image bytes remain under the current test threshold.

### Task 6: Full verification

**Files:** None beyond the changes above.

- [ ] Run `npm run validate:story`.
- [ ] Run `npm test`.
- [ ] Inspect `git diff --stat` and `git status --short`; confirm unrelated pre-existing changes remain untouched.
- [ ] Report any inability to run AIoT release tooling separately; do not claim an APK build unless it was actually executed.
