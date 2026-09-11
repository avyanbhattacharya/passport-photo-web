# Make a Photo Sheet

## Purpose and V1 scope

Privately arrange multiple JPEG, PNG, or WebP photos onto a single printable US Letter or A4 sheet for easy home printing. Users can customize grid layouts (1, 2, 4, 6, or 9 photos per page), select page size and orientation (Portrait/Landscape), adjust margins and gaps, toggle short captions, and choose between aspect-preserving fit vs. crop-to-fill framing. Output is exported as a single-page print-ready PDF generated locally in the browser.

## Trust boundary and local guarantees

All image processing and PDF creation occur entirely client-side using browser canvas and `pdf-lib`. Images are never uploaded to any remote server or routed through proxies.

Input boundaries and safety caps:
- Bounded photo count: maximum 20 photos per sheet.
- Per-file size cap: 25 MB per image.
- Decoded pixel cap: 50 Megapixels per image to prevent memory exhaustion.
- Object URLs are revoked when images are removed or replaced.

## Fit vs. Crop framing

- **Fit (preserve aspect ratio):** The image is scaled to fit within the designated grid cell photo box without clipping or distortion, leaving uniform background spacing where aspect ratios differ.
- **Crop (fill cell):** The image is center-cropped to fill the exact rectangular grid cell area, eliminating empty margins within the cell while preserving visual scale.

## Print scaling instructions

To ensure exact physical output dimensions when printing the downloaded PDF sheet:
- Always select **Actual Size** or **100% scale** in your PDF reader or browser print dialog.
- Do not use "Fit to Printable Area" or "Shrink to Fit", as browsers and printers may alter margins.
