# Passport Photo Camera

A free, privacy-first passport photo maker that runs entirely in the browser.

Take a photo using your phone camera, align your face with passport-style guides, make basic non-generative adjustments, and download a **2 × 2 inch**, **35 × 45 mm**, or **4 × 6 print sheet** JPEG.

## Why this project?

Passport photo websites often require an upload before you know what happens to your image. This project takes a simpler approach:

- 📷 Live camera preview on supported mobile browsers
- 👤 Passport-style head, eye, side-of-face, and shoulder guides
- ☀️ Brightness and contrast controls
- ⬜ Conservative background whitener
- 🔍 Crop, zoom, and position controls
- 🖼️ 2 × 2 inch and 35 × 45 mm formats
- 🖨️ 4 × 6 inch print sheet with two copies
- 🔒 Browser-side image processing
- 🚫 No generative AI and no face reconstruction
- 🚫 No server-side photo upload

The project is plain HTML, CSS, and JavaScript. No build system is required.

## Live demo

After GitHub Pages is enabled, the app will be available at:

`https://abhishekb2907.github.io/passport-photo-web/`

## Privacy

Photos are processed locally using browser APIs and HTML Canvas. This project does not include an API endpoint, database, analytics SDK, or photo-upload service.

Reloading or closing the page clears the working photo.

As always, review deployed forks independently. A fork can change the code.

## Supported photo sizes

| Format | Output |
| --- | --- |
| 2 × 2 inch | 600 × 600 px |
| 35 × 45 mm | 413 × 531 px |
| 4 × 6 print | 1200 × 1800 px |

The pixel dimensions correspond to a 300-PPI print layout.

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

## Current limitations

This version uses a visual passport framing guide rather than making claims that it can certify government compliance.

Future improvements could include:

- on-device face landmark detection
- automatic head-size and eye-position measurement
- head tilt / yaw warnings
- lighting uniformity checks
- background uniformity checks
- automatic capture when positioning is good
- country/document presets
- PWA installation
- offline support after first load
- accessibility improvements

## Passport requirements

Requirements vary by country, passport office, visa type, and application process. Always check the latest instructions from the relevant government authority.

This project is a photo preparation utility, **not an official passport acceptance or compliance service**.

## Contributing

Bug reports and pull requests are welcome.

Useful contributions include mobile-browser testing, accessibility improvements, additional non-generative image checks, country-specific dimensions with authoritative sources, and better print layouts.

Please avoid features that cosmetically alter or regenerate facial identity.

## License

MIT
