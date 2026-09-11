# Visual Asset Budget Implementation Plan

> **For agentic workers:** Execute this plan inline. The workspace is not a Git repository.

**Goal:** Reduce the complete Band 10 RPK toward a 10 MB limit while restoring useful color detail and preserving phone-screen text as story text.

**Architecture:** AssetRipper exports are resized and palette-compressed once during the build pipeline. A post-export optimizer canonicalizes CGs that differ only in a small face area and splits only verified same-body stage variants into one transparent body plus small face layers. OCR is also build-time only; its transcript is attached to the visual state and shown in the existing dialogue box.

**Tech Stack:** Node.js, Sharp, Tesseract.js, Vela JS Quick App, Node test runner.

## Global Constraints

- Keep the existing Asunabi/ATRI player and the 212x520 Band 10 layout.
- Emit PNG resources only; do not add runtime image processing or runtime OCR.
- CGs are only deduplicated when all detected pixel differences fit a conservative face region; the canonical CG is reused unchanged.
- Stage assets are only split where same-body verification passes; every other pose remains a complete PNG.
- Phone OCR comes from the uncompressed source crop and is stored as text, then must be manually reviewable.
- Increment `src/manifest.json` `versionCode` exactly once immediately before a successful final RPK build.

---

### Task 1: Rebalance image resolution and palette depth

**Files:**
- Modify: `tools/export-assetripper-resources.js`
- Modify: `tests/exported-resources.test.js`

- [ ] Add assertions for the 80% background, CG, and phone dimensions and their 64-color PNG settings.
- [ ] Make background output `416x312`, CG output `576x324`, and phone output `205x324`; encode those opaque images as 64-color palette PNGs.
- [ ] Retain 128-color alpha PNGs for stage and standee resources.
- [ ] Run `node --test tests/exported-resources.test.js`.

### Task 2: Generate phone OCR metadata

**Files:**
- Create: `tools/extract-phone-ocr.js`
- Modify: `tools/export-assetripper-resources.js`
- Modify: `tools/transform-story.js`
- Modify: `tools/convert-story-to-asunabi.js`
- Modify: `src/pages/detail/detail.ux`
- Modify: `tests/full-story.test.js`

- [ ] Preserve an uncompressed source crop for each center overlay only until OCR finishes.
- [ ] Run Chinese OCR in the build pipeline and write a key-to-transcript JSON file with empty-text fallback when no characters are recognized.
- [ ] Attach a `phoneText` field to a center overlay and show it as the current dialogue text while that phone image is visible.
- [ ] Test that OCR metadata propagates into converted scenes without changing normal dialogue nodes.

### Task 3: Verify and canonicalize visual variants

**Files:**
- Create: `tools/optimize-visual-variants.js`
- Modify: `package.json`
- Modify: `tests/exported-resources.test.js`

- [ ] Fingerprint CG pairs and alias only pairs whose changed-pixel bounding box lies in the upper face region and covers less than 12% of the image.
- [ ] For stage groups identified by their terminal expression suffix, compare variants and split only groups whose changes lie in the upper face region; produce a body image with that rectangle cleared and face images with the same coordinates.
- [ ] Rewrite story paths to canonical CGs and add face-layer metadata for split stage variants.
- [ ] Test a synthetic same-body group, a different-pose group, and a face-only CG pair.

### Task 4: Render split stage faces and validate package budget

**Files:**
- Modify: `src/pages/detail/detail.ux`
- Modify: `tests/band-layout.test.js`
- Modify: `tests/exported-resources.test.js`
- Modify: `src/manifest.json`

- [ ] Render an optional face layer immediately above every stage slot, sharing the same fixed dimensions and placement as its body image.
- [ ] Re-export, OCR, optimize visual variants, convert story chunks, and run `npm run check`.
- [ ] Assert all image files are PNG and the image total is below 9 MB before packaging.
- [ ] Increment `versionCode`, run `npm run build`, and inspect the RPK size and contents.
