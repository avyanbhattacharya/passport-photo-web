# Free Passport Photo Maker - 2x2, 35x45 mm & 4x6 Print Sheet

Passport Photo Camera is a free, privacy-first browser passport photo maker for **2 × 2 inch passport photos**, **35 × 45 mm passport/visa photos**, and **4 × 6 passport photo print sheets**.

**Your working passport photo does not need to be uploaded to this project's server.** Camera capture, live framing feedback, cropping, automatic positioning, brightness and contrast adjustments, automated photo checks, blur/shadow scoring, optional white-background processing, JPEG creation, and print-sheet generation happen locally in the browser on your device.

Use it from an iPhone or desktop browser to take or upload a photo, align the face with passport-style guides, run automated checks, optionally make the background white with browser-side MediaPipe segmentation, and download a finished JPEG.

Current stable version: **1.0.0**

## Live passport photo maker

**https://avyanbhattacharya.github.io/passport-photo-web/**

The plain URL always serves the current stable build. Asset versions and the service-worker cache are managed internally so users do not need a version query parameter in the public URL.

## Features

- 📷 Live iPhone/desktop camera preview with on-screen framing feedback
- 🎯 Automatic face positioning using browser-side face landmarks
- 👤 Passport-style framing guides
- ☀️ Brightness and contrast controls
- 🧪 Image-quality score with blur/sharpness, exposure and shadow checks
- ⬜ Optional white-background replacement using MediaPipe selfie segmentation
- 🤖 Automated browser-side passport-photo checks
- 👓 Optional eyewear detection
- 🔍 Crop, zoom, and position controls
- 🖼️ 2 × 2 inch and 35 × 45 mm passport photo formats
- 🖨️ Exact 4 × 6 inch passport photo print sheet with four copies and cut guides
- 📲 PWA/app-shell caching for home-screen and offline use
- 🔒 Browser-side image processing
- 🚫 No generative AI and no face reconstruction
- 🚫 No project server-side photo upload

The project is plain HTML, CSS, and JavaScript. No application backend, database, or build system is required.

## Common uses

The app is designed for people searching for a free passport photo maker, 2x2 passport photo creator, 35x45 mm passport or visa photo tool, iPhone passport photo maker, white-background passport photo tool, or 4x6 passport photo print sheet generator.

It is a photo-preparation utility rather than an official passport-compliance service. Always verify the current rules for the specific passport, visa, identity document, country, or application process.

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

## Supported passport photo sizes

| Format | Output |
| --- | --- |
| 2 × 2 inch passport photo | 600 × 600 px |
| 35 × 45 mm passport / visa photo | 413 × 531 px |
| 4 × 6 passport photo print sheet | 1200 × 1800 px |

The print sheet uses a 300-PPI layout. Print at **actual size / 100%** without fit-to-page scaling to preserve physical dimensions.

## iPhone passport photo camera

The live camera uses `navigator.mediaDevices.getUserMedia()`. Safari permits this API on secure origins, which means the deployed page should use **HTTPS**.

GitHub Pages provides HTTPS automatically.

On first use, Safari should ask for camera permission. If permission has previously been denied, check the Safari camera permission in iPhone Settings.

## Search engine optimization

The deployed page includes a canonical URL, descriptive title and meta description, Open Graph metadata, crawl directives, `WebSite` and `SoftwareApplication` JSON-LD structured data, semantic HTML content, `robots.txt`, and an XML sitemap.

The canonical public URL is:

`https://avyanbhattacharya.github.io/passport-photo-web/`

The sitemap is:

`https://avyanbhattacharya.github.io/passport-photo-web/sitemap.xml`

For Google indexing and performance reporting, add the site to Google Search Console and submit the sitemap there.

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
