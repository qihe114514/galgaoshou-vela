# PNG Compression Research

## Scope

This note covers PNG-only assets for the Band 10 Vela build. The device has
already failed to render JPEG reliably, so alternative output formats are out
of scope.

## Current Baseline

`tools/export-assetripper-resources.js` already uses Sharp/libvips with zlib
level 9 and palette output for backgrounds, CGs, stages, and standees. The
main size issue is the `centerOverlay` (phone) export path: it writes a
`256x405` lossless RGBA PNG.

Measured from the current `src/common/images` directory:

| Asset form | Count | Total | Mean |
| --- | ---: | ---: | ---: |
| `256x405` RGBA phone overlays | 111 | 13.35 MiB | 126,103 B |
| `720x405` palette CGs | 110 | 3.85 MiB | 36,727 B |
| `212x520` palette character images | 177 | 2.10 MiB | 12,447 B |
| `520x390` palette backgrounds | 78 | 1.94 MiB | 26,027 B |

Three representative phone files were re-encoded in memory with the existing
Sharp dependency, so no production files were changed. With
`palette: true, colours: 256, quality: 95, effort: 10, compressionLevel: 9,
adaptiveFiltering: true, dither: 0`, the files fell from 124-144 KiB to
25-28 KiB (19-20% of the original). This is the primary safe size win; it
preserves PNG and is consistent with the palette PNGs already rendered on the
device.

## Tool Findings

### Sharp / libvips: first choice

Sharp documents palette PNG output, quality-based palette selection, colour
limits, effort, zlib compression level, and adaptive filtering. It is already
bundled in this repository, requires no external executable, and can retain
alpha in indexed PNGs.

Source: [Sharp PNG output API](https://sharp.pixelplumbing.com/api-output/#png).

Recommended use:

- Phone overlays: indexed PNG, `colours: 256`, `quality: 95`, `effort: 10`,
  `dither: 0`, `adaptiveFiltering: true`. Verify small UI text on hardware.
- Backgrounds and CGs: keep indexed output, add `effort: 10` and
  `adaptiveFiltering: true`; trial lower colour/quality limits per category
  only when visual snapshots are approved.
- Characters and standees: keep alpha and palette output; do not crop more
  aggressively solely for compression until composition is checked.

### pngquant: useful optional lossy encoder

pngquant performs lossy conversion to an 8-bit palette PNG while supporting
alpha. Its official documentation exposes perceptual quality bounds and a
speed/quality trade-off. It can outperform a generic palette conversion on
photographic CG/background art, but it introduces an external build tool and
needs device visual regression, especially around transparent character edges
and text.

Sources: [pngquant documentation](https://pngquant.org/),
[pngquant source and CLI](https://github.com/kornelski/pngquant).

Recommended trial, not the default implementation:

- Test backgrounds and CGs with `--quality=75-90 --speed 1 --strip`.
- Test phone images only with a conservative quality floor (for example
  `--quality=90-100`) and compare rendered text at Band 10 scale.
- For transparent stages/standees, preserve the current Sharp result unless a
  visual diff and real-device check show acceptable edges.

### OxiPNG: lossless post-pass

OxiPNG is a multi-threaded lossless PNG/APNG optimiser. It can reduce PNG
metadata and select different filters/Deflate settings without altering the
rendered pixels. It is appropriate after palette quantisation, but its gain
will be incremental because this exporter already uses zlib level 9. Avoid its
`--alpha` option for character art unless transparent-pixel RGB changes have
been explicitly checked.

Sources: [OxiPNG source and CLI](https://github.com/oxipng/oxipng),
[OxiPNG API documentation](https://docs.rs/oxipng/latest/oxipng/).

Recommended optional post-pass: `oxipng -o 4 --strip safe <file>`. Add it only
when the build environment supplies a pinned binary; all output must still be
validated by decoding PNGs and inspected on the physical Band 10.

### Zopfli: not a pipeline default

Zopfli provides a very slow Deflate/zlib encoder. It can only make a lossless,
usually marginal improvement to the PNG data stream; it does not reduce pixel
dimensions, palette size, or alpha complexity. OxiPNG notes that its Zopfli
mode is not guaranteed to beat normal optimisation. Use it only to benchmark a
small set of largest remaining files, never over every asset on routine builds.

Sources: [Google Zopfli](https://github.com/google/zopfli),
[OxiPNG options](https://github.com/oxipng/oxipng#usage).

## Recommended Safe Pipeline

1. Keep PNG as the only runtime image format.
2. Change phone `centerOverlay` export to high-quality indexed PNG using Sharp.
   This targets the current 13.35 MiB dominant category without adding a new
   toolchain dependency.
3. Enable Sharp `effort: 10` and `adaptiveFiltering: true` on existing palette
   categories, then compare output byte counts and visual snapshots.
4. Optionally run pinned OxiPNG as a post-pass in release builds; accept an
   output only when it decodes and is no larger than the pre-pass input.
5. Benchmark pngquant only for large background/CG assets and adopt it only if
   it wins materially over Sharp without visual regressions.

For any lossy setting, use both automated checks (PNG decodes, expected alpha,
maximum dimensions) and a physical Band 10 visual check. File size alone is
not an acceptance criterion for images containing dialogue text.
