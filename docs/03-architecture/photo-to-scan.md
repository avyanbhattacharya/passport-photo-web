---
render: true
title: Photo to Scan Architecture
description: Perspective transformation, geometric corner validation, bilinear interpolation, performance optimizations, and PDF/JPEG output behavior for Photo to Scan.
route: /docs/architecture/photo-to-scan/
index: false
section: Technical documentation
---

# Photo to Scan Architecture

## Overview

Photo to Scan is a client-side document processing tool hosted at `/photo-to-scan/`. It converts skewed camera photographs or digital images of paper documents into straightened, clean, rectangular scans entirely within the user's browser.

**Master promise:** **Your files never leave your machine.**

## Processing Pipeline

```text
Input File (JPEG, PNG, WebP)
           |
   Validation & Caps (15 MiB file size, 20 MP resolution)
           |
   Decode to HTMLImageElement & In-Memory Source Canvas
           |
   Cache Full-Resolution Source ImageData
           |
   Manual Corner Selection (4-point normalized coordinates, ARIA accessible)
           |
   Geometric Corner Validation (Convexity & Edge length check)
           |
   Homography Perspective Matrix Computation (8x8 linear solver)
           |
   Bilinear Pixel Interpolation & Inverse Mapping
           |
   Document Finishing Mode (Natural Color, Grayscale, High Contrast)
           |
   Brightness & Contrast Slider Adjustment (Debounced Render)
           |
   Result Output Canvas (Max 3000px edge cap, request-cancellation check)
           |
   Export to JPEG / A4 or Letter PDF via pdf-lib
```

## Homography Perspective Correction & Bilinear Interpolation

1. **Coordinate Systems:** Corner coordinates $P_0, P_1, P_2, P_3$ are maintained in normalized canvas space $[0.0, 1.0]$. The source pixel dimensions $(IW, IH)$ convert these to pixel coordinates $S_i = (u_i, v_i)$.
2. **Target Dimensions:** Target scan dimensions $W$ and $H$ are derived from the maximum opposite edge lengths:
   $$W = \max(\|S_1 - S_0\|, \|S_2 - S_3\|)$$
   $$H = \max(\|S_3 - S_0\|, \|S_2 - S_1\|)$$
   Output dimensions are capped so that $\max(W, H) \le 3000$ pixels to preserve browser memory and prevent canvas allocation crashes.
3. **8-Parameter Matrix Solver:** The transformation maps output destination pixels $(x, y) \in [0, W-1] \times [0, H-1]$ back to source image coordinates $(u, v)$ via homography matrix $M$:
   $$x' = \frac{M_0 x + M_1 y + M_2}{M_6 x + M_7 y + M_8}, \quad y' = \frac{M_3 x + M_4 y + M_5}{M_6 x + M_7 y + M_8}$$
   $M$ is solved using Gaussian elimination on an 8x8 system formed by corner correspondence equations.
4. **Bilinear Interpolation:** Continuous source pixel coordinates $(csx, csy)$ are sampled across 4 surrounding neighbor pixels $(x_0, y_0), (x_1, y_0), (x_0, y_1), (x_1, y_1)$ weighted by fractional distances $dx = csx - x_0$ and $dy = csy - y_0$, eliminating nearest-neighbor aliasing artifacts on high-resolution text and grid patterns.

## Geometric Corner Validation

To prevent invalid transformations, NaN/Infinity divide-by-zero errors, or degenerate output renders, corner selection quadrilaterals are validated before rendering:
- **Minimum Edge Length:** Every adjacent corner pair must have a normalized Euclidean distance of at least 0.03.
- **Strict Convexity:** The 2D cross products of adjacent edge vectors must all share the same sign and exceed a non-zero area threshold ($> 0.001$). Crossed, collinear, or inverted corner configurations are rejected with a clear user notice.

## Performance & Responsiveness Optimizations

- **ImageData Caching:** Source image pixel data (`ImageData`) is extracted once upon decode and cached in memory, eliminating redundant canvas GPU-to-CPU readbacks during interactive adjustments.
- **Render Debouncing & Superseded Request Cancellation:** Slider adjustments are debounced by 30ms. Each render task tracks an incremental `renderRequestId`. If a new user interaction occurs while a render is running or scheduled, superseded requests terminate immediately without writing stale results to the output canvas.

## Resource & Input Caps

- **File Size Cap:** Maximum 15 MiB input file size enforced before image decoding.
- **Decoded Resolution Cap:** Maximum 20 megapixels ($W \times H \le 20,000,000$) checked immediately after natural image dimensions are available.
- **Output Edge Cap:** Maximum 3000 pixels on the longest edge.
- **Memory Management:** Blob URLs and intermediate image decodes are revoked when files are replaced or processing finishes.

## Accessibility & Keyboard Controls

- **ARIA Slider Attributes:** Each corner handle element provides `role="slider"`, `aria-label`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow`, and descriptive `aria-valuetext` (e.g. `12% X, 15% Y`).
- **Keyboard Navigation:** Handles are focusable via `tabindex="0"` and respond to Arrow keys for fine adjustments (or Shift+Arrow for coarse steps).

## Output Specifications & Trust Boundaries

- **JPEG Export:** Encoded as standard image/jpeg blob at 0.92 quality.
- **PDF Export:** Single-page PDF created locally using `pdf-lib` version 1.17.1. Page dimensions fit A4 ($595.28 \times 841.89$ pt) or Letter ($612 \times 792$ pt) specifications with automatic page orientation (portrait vs landscape) to prevent clipping or aspect ratio distortion.
- **Raster Output Statement:** Exported JPEGs and PDFs are image-based raster outputs and do not contain OCR or searchable text elements.
- **Local Isolation:** Working files never touch network endpoints or proxy servers.
