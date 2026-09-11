# Phone OCR Review Design

## Goal

Provide a local browser page for manually comparing every phone overlay image with its OCR text and saving corrections used by the story build.

## Design

`tools/review-phone-ocr.js` starts a dependency-free Node HTTP server. Its page lists the 111 center-overlay phone assets, lets a reviewer filter by key or text, select an entry, compare the original PNG with a textarea, and save the current correction. The server maps image files through `assets.json` and persists text to `phone-ocr.json`.

The OCR exporter keeps manual text in `phone-ocr.json` whenever it already exists and only fills entries with fresh OCR when no manual value is present. This means `npm run refresh:story` will retain reviewed text.

## Validation

Unit tests cover the catalog mapping and preservation rule. The existing story validation confirms corrected OCR remains serializable through the conversion pipeline.
