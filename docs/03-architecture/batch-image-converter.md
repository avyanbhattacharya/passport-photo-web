# Batch Image Converter

## Purpose and Scope

Batch Image Converter allows users to select up to 30 JPEG, PNG, WebP, or HEIC/HEIF images, configure output format (JPG, PNG, WebP), set output compression quality, specify maximum pixel dimensions (preserving aspect ratio), and convert them locally in their browser.

Converted images can be downloaded individually or packaged together in a ZIP file (`converted-images.zip`).

## Local File Safety & Privacy Boundary

All processing occurs completely client-side in the user's browser.
- Image decoding, canvas scaling, and format encoding use browser APIs (`HTMLCanvasElement`, `Image`, `createObjectURL`) and lightweight client-side libraries (`heic2any` for HEIC decoding and `JSZip` for archive packaging).
- Working images are never uploaded to any server or routed through a proxy.
- Temporary Object URLs created for item previews or downloads are explicitly revoked when items are removed, cleared, replaced, or re-converted.

## Concurrency & Resource Bounds

- **Batch Limit:** Batches are capped at 30 images to keep memory consumption bounded.
- **Bounded Concurrency:** Concurrent image conversion is limited to a maximum pool of 2 workers (`MAX_CONCURRENCY = 2`) to avoid blocking the main UI thread and prevent memory spikes.
- **Max Dimension Cap:** Output max dimensions are bounded between 100px and 12,000px, scaling down larger images while preserving aspect ratio and avoiding excessive canvas memory allocation.
- **Failure Isolation:** If a single file is corrupt or fails conversion, its status is marked as `failed` with an explanatory error. Valid items in the batch continue processing uninterrupted, and failed items can be individually retried or removed.
- **Cancellation & Replacement:** Users can cancel an in-progress batch operation at any time. Queued items are safely skipped, converted items remain accessible, and object URLs are revoked upon clear or replacement.

## Verification

`tests/batch-image-converter.spec.js` covers:
- Multi-format conversion (JPG, PNG, WebP, HEIC).
- Output assertions (format, max dimension, preserved aspect ratio, quality).
- Per-item error isolation and retry/removal.
- Bounded concurrency verification via instrumentation hooks.
- ZIP archive creation and individual file downloads.
- Mobile layout responsiveness (no horizontal overflow).
- Privacy verification (no external network uploads during processing).
