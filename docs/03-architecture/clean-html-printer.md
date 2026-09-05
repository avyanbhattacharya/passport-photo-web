# Clean HTML Printer

## Purpose and V1 scope

Open a local HTML file or paste HTML, select and remove elements or their enclosing sections, remove all embedded images, undo/redo, reset, and print through the browser. Deletion removes DOM nodes: it is not a visual mask. The clean reading layout discards imported CSS, fixed heights, positioning and floats so content reflows. Original styling is deliberately not preserved. Browser print preview, not an estimated in-app page count, is the pagination authority.

## Trust boundary

Imported HTML is untrusted. Parse into an inert template, then reconstruct allowlisted semantic elements in fresh nodes. Do not attach imported nodes. Do not copy arbitrary attributes, styles, IDs, names, event handlers, URLs or custom elements. Links become text. Scripts, forms, nested documents, SVG, MathML, media and embedded objects are dropped. Only inline base64 PNG/JPEG/GIF/WebP images survive. Remote images and saved-page companion resources are not fetched.

The output lives in an iframe sandboxed with `allow-same-origin allow-scripts allow-modals`. Same-origin permits the parent editor to operate on the reconstructed DOM; scripts permission is required by WebKit for parent-installed event callbacks; modals permit user-requested printing. This combination is NOT a script-isolation boundary: reconstruction is mandatory. A document CSP blocks all resources except data images and application-owned inline CSS, including imported inline scripts, script resources, forms and base URLs. Neither sandbox nor CSP substitutes for sanitization. Never load arbitrary URLs or raw imported HTML into this frame. No user HTML is injected into the host application DOM. No persistence, analytics, upload or external dependency is used by this tool.

## State, limits and printing

Input is capped at 2 MiB, 15,000 traversed nodes and depth 100; parsing remains on the main thread, so exceptionally pathological input can still pause briefly. There are at most 20 sanitized history snapshots, plus the original for reset. New edits discard redo history. Failed imports preserve the existing document. A generation token avoids an earlier asynchronous file read replacing a later import.

Selection and keyboard focus attributes are editor-only and stripped from snapshots. Print CSS hides outlines and selection background; the print action clears selection and prints only the iframe. Paper size, orientation, margins and font size use fixed select options. Browser print settings may override CSS; users should check print preview and disable browser headers/footers as desired. Empty documents are rejected at import and cannot be printed after deleting all content.

## Verification

`tests/clean-html-printer.spec.js` covers section deletion and measured reflow, undo/redo/reset, keyboard selection, image removal, malicious markup/no remote requests, file validation, tables, empty output, print settings and viewport overflow. It runs in Chromium, desktop WebKit and mobile WebKit. Print invocation is stubbed in automated tests; the native dialog and physical printing require manual acceptance on supported devices.
