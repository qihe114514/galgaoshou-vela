# Phone OCR Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every phone-overlay OCR result inspectable and editable from a local browser page.

**Architecture:** A Node HTTP server derives the review catalog from the generated asset manifest, serves the matching exported PNG files, and exposes JSON read/save endpoints backed by `phone-ocr.json`. The resource exporter merges pre-existing reviewed values over new OCR output.

**Tech Stack:** Node.js standard library, existing generated JSON, Node test runner.

## Global Constraints

- Add no runtime dependency.
- Retain the existing `phone-ocr.json` format: `{ "手机N_M": "text" }`.
- Do not modify APK version metadata because no APK is packaged.

---

### Task 1: Review server and catalog

**Files:**
- Create: `tools/review-phone-ocr.js`
- Test: `tests/review-phone-ocr.test.js`

**Interfaces:**
- Produces: `createCatalog(assets, ocr)` and `createServer(options)`.
- Consumes: generated asset entries with `key`, `kind`, and `output` fields.

- [ ] Write a test that passes phone and non-phone assets to `createCatalog` and expects only ordered phone entries with their current OCR text and PNG name.
- [ ] Implement the catalog helper, static HTML page, `GET /api/entries`, `GET /images/<file>`, and `PUT /api/entries/<key>` endpoints.
- [ ] Run `node --test tests/review-phone-ocr.test.js` and expect all review-server tests to pass.

### Task 2: Preserve corrections during resource export

**Files:**
- Modify: `tools/export-assetripper-resources.js`
- Modify: `tests/exported-resources.test.js`

**Interfaces:**
- Produces: `mergePhoneOcr(generated, reviewed)` returning generated OCR with non-empty reviewed values overriding matching keys.

- [ ] Write unit tests for new OCR, a matching reviewed correction, and an empty reviewed value.
- [ ] Read an existing `phone-ocr.json` before export and merge it when writing OCR results.
- [ ] Run `node --test tests/exported-resources.test.js` and expect all export-resource tests to pass.

### Task 3: Expose and validate the workflow

**Files:**
- Modify: `package.json`
- Test: `tests/review-phone-ocr.test.js`

**Interfaces:**
- Produces: `npm run review:phone-ocr`.

- [ ] Add the package script pointing to the review server.
- [ ] Test an in-process HTTP save request and confirm a temporary OCR file contains the edited text.
- [ ] Run `npm run check` and expect the full story validation and test suite to pass.
