# Passport Photo Camera

A free, privacy-first passport photo maker that runs in your browser.

**Your passport photo does not need to be uploaded to this project's server.** Camera capture, live framing feedback, cropping, automatic positioning, brightness and contrast adjustments, automated photo checks, blur/shadow scoring, optional background processing, JPEG creation, and print-sheet generation happen locally in the browser on your device.

Take a photo using your phone camera, align your face with passport-style guides, make basic non-generative adjustments, optionally replace the background with local portrait segmentation, and download a **2 × 2 inch**, **35 × 45 mm**, or **4 × 6 print sheet** JPEG.

Current stable version: **1.0.0**

## Features

- 📷 Live camera preview with on-screen framing feedback
- 🎯 Automatic face positioning using browser-side face landmarks
- 👤 Passport-style framing guides
- ☀️ Brightness and contrast controls
- 🧪 Image-quality score with blur/sharpness, exposure and shadow checks
- ⬜ Optional white-background replacement using MediaPipe selfie segmentation
- 🤖 Automated browser-side passport-photo checks
- 👓 Optional eyewear detection
- 🔍 Crop, zoom, and position controls
- 🖼️ 2 × 2 inch and 35 × 45 mm formats
- 🖨️ Exact 4 × 6 inch print sheet with four copies and cut guides
- 📲 PWA/app-shell caching for home-screen and offline use
- 🔒 Browser-side image processing
- 🚫 No generative AI and no face reconstruction
- 🚫 No project server-side photo upload

The project is plain HTML, CSS, and JavaScript. No application backend, database, or build system is required.

## Live demo

`https://avyanbhattacharya.github.io/passport-photo-web/`

The plain URL always serves the current stable build. Asset versions and the service-worker cache are managed internally so users do not need a version query parameter in the public URL.

## Privacy architecture

The browser is the application runtime. The working image remains in browser memory while the app performs its photo operations.

The following operations are performed client-side:

- camera capture and existing-photo selection
- live face/framing feedback
- automatic face positioning
- cropping, zooming and positioning
- brightness and contrast adjustments
- face-landmark and passport-photo checks
- blur/sharpness scoring
- exposure scoring
- face-shadow / lighting-balance scoring
- optional eyewear detection
- optional portrait segmentation/background replacement
- output resizing
- JPEG generation
- exact-size 4 × 6 print-sheet composition

This project does not include a photo-upload API, application database, analytics SDK, or server-side image-processing service.

Some optional machine-learning features require model files and JavaScript/WebAssembly dependencies to be downloaded from third-party hosting. The models then process the working photo locally in the browser. The project itself does not send the working passport photo to its own server for processing.

Reloading or closing the page clears the working photo. As always, review deployed forks independently because a fork can change the code.

## Offline / PWA support

The project includes a web app manifest and service worker. After the site has loaded, the core application shell can be cached for offline use and can be added to a phone home screen.

On iPhone, open the site in Safari and use **Share → Add to Home Screen**.

Navigation is network-first so deployed updates are picked up when online, with the cached page available as an offline fallback. Optional machine-learning features may still require their external model files to have been downloaded previously.

## Background removal

The optional **Make background white** feature uses MediaPipe Tasks Vision and the lightweight selfie-segmentation model.

The model runs in the browser and produces a person/background confidence mask. The app composites the existing foreground pixels over a white background. It does not regenerate or reconstruct the face.

The implementation supports browser runtimes that expose either a foreground-only confidence mask or separate background/person masks. This compatibility path was added for iPhone Safari.

The first use requires downloading the segmentation model, so it can take longer than subsequent uses. Always inspect hair, ears, shoulders, and clothing edges before using the result. Passport and visa authorities may have rules restricting digital background replacement or other photo retouching.

## Supported photo sizes

| Format | Output |
| --- | --- |
| 2 × 2 inch | 600 × 600 px |
| 35 × 45 mm | 413 × 531 px |
| 4 × 6 print | 1200 × 1800 px |

The print sheet uses a 300-PPI layout. Print at **actual size / 100%** without fit-to-page scaling to preserve physical dimensions.

## iPhone camera access

The live camera uses `navigator.mediaDevices.getUserMedia()`. Safari permits this API on secure origins, which means the deployed page should use **HTTPS**.

GitHub Pages provides HTTPS automatically.

On first use, Safari should ask for camera permission. If permission has previously been denied, check the Safari camera permission in iPhone Settings.

## Run locally

Because browsers restrict camera access from `file://` pages, use a local web server rather than double-clicking `index.html`.

For example, with Python:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Desktop browsers generally treat localhost as a secure development context. For testing from an iPhone, deploy to an HTTPS host such as GitHub Pages.

## Deploy with GitHub Pages

1. Create a public GitHub repository named `passport-photo-web`.
2. Upload or push these files to the `main` branch.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Choose `main` and `/ (root)`.
6. Save.

GitHub will publish the site over HTTPS.

## Versioning

Stable releases use semantic versions such as `1.0.0`. The current version is also recorded in the repository's `VERSION` file and release history is summarized in `CHANGELOG.md`.

The public GitHub Pages URL intentionally has no version suffix. Internal asset query strings and service-worker cache names are versioned to prevent stale browser/PWA files after upgrades.

## Passport requirements

Requirements vary by country, passport office, visa type, and application process. Always check the latest instructions from the relevant government authority.

This project is a photo preparation utility, **not an official passport acceptance or compliance service**.

## Contributing

Bug reports and pull requests are welcome.

Useful contributions include mobile-browser testing, accessibility improvements, additional non-generative image checks, country-specific dimensions with authoritative sources, and better print layouts.

Please avoid features that cosmetically alter or regenerate facial identity.

## License

MIT
