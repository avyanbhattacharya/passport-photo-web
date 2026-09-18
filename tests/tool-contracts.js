const toolContracts = [
  { id: 'home', route: '/', heading: /Useful file tools/i, risk: 'standard', deepSpec: 'homepage.spec.js', visual: true },
  { id: 'clean-html-printer', route: '/clean-html-printer/', heading: /Clean HTML Printer/i, risk: 'native-output', deepSpec: 'clean-html-printer.spec.js', visual: true, manualCheck: 'Open and close the browser print preview once.' },
  { id: 'passport-photo', route: '/passport-photo/', heading: /Passport Photo/i, risk: 'device-input', deepSpec: 'passport-photo.spec.js', visual: true, manualCheck: 'Choose one real image with the target device file picker and confirm the downloaded sheet.' },
  { id: 'japa-touchless', route: '/japa-counter/', heading: /Japa Counter/i, risk: 'standard', deepSpec: 'japa-touchless.spec.js', visual: true },
  { id: 'japa-tap', route: '/japa-counter/tap.html', heading: /Japa Counter/i, risk: 'standard', deepSpec: 'japa-tap.spec.js', visual: true },
  { id: 'compress-pdf', route: '/compress-pdf/', heading: /Compress PDF/i, risk: 'standard', deepSpec: 'compress-pdf.spec.js', visual: true },
  { id: 'merge-pdf', route: '/merge-pdf/', heading: /Merge PDF/i, risk: 'standard', deepSpec: 'merge-pdf.spec.js', visual: true },
  { id: 'resize-image', route: '/resize-image/', heading: /Resize & Compress Image/i, risk: 'standard', deepSpec: 'resize-image.spec.js', visual: true },
  { id: 'clean-pdf-printer', route: '/clean-pdf-printer/', heading: /Clean PDF Printer/i, risk: 'native-output', deepSpec: 'clean-pdf-printer.spec.js', visual: true, manualCheck: 'Open and close the browser print preview once.' },
  { id: 'document-flattener', route: '/document-flattener/', heading: /Document Flattener/i, risk: 'standard', deepSpec: 'document-flattener.spec.js', visual: true },
  { id: 'photo-to-scan', route: '/photo-to-scan/', heading: /Photo to Scan/i, risk: 'device-input', deepSpec: 'photo-to-scan.spec.js', visual: true, manualCheck: 'Choose one real photo on the target device and inspect its export.' },
  { id: 'image-to-pdf', route: '/image-to-pdf/', heading: /Image to PDF/i, risk: 'standard', deepSpec: 'image-to-pdf.spec.js', visual: true },
  { id: 'split-pdf', route: '/split-pdf/', heading: /Split PDF/i, risk: 'standard', deepSpec: 'split-pdf.spec.js', visual: true },
  { id: 'heic-to-jpg', route: '/heic-to-jpg/', heading: /HEIC to JPG/i, risk: 'standard', deepSpec: 'heic-to-jpg.spec.js', visual: true },
  { id: 'remove-photo-metadata', route: '/remove-photo-metadata/', heading: /Remove Photo Metadata/i, risk: 'standard', deepSpec: 'remove-photo-metadata.spec.js', visual: true },
  { id: 'qr-code-maker', route: '/qr-code-maker/', heading: /QR Code Maker/i, risk: 'standard', deepSpec: 'qr-code-maker.spec.js', visual: true },
  { id: 'sheetlocal', route: '/sheetlocal/', heading: /SheetLocal/i, risk: 'new-tool', deepSpec: 'sheetlocal.spec.js', visual: true, manualCheck: 'Choose a non-sensitive CSV and download one report on a desktop or mobile browser.' },
  { id: 'about', route: '/about/', heading: /Useful tools without surrendering your files/i, risk: 'standard', visual: true },
  { id: 'principles', route: '/principles/', heading: /Principles that keep the promise honest/i, risk: 'standard', visual: true }
];

const risks = {
  standard: { label: 'risk:standard', manual: false, summary: 'Automated evidence is normally sufficient.' },
  visual: { label: 'risk:visual', manual: false, summary: 'Review an intentional visual baseline change; no device exercise is implied.' },
  'new-tool': { label: 'risk:new-tool', manual: true, summary: 'One short first-release check of the new user workflow is required.' },
  'device-input': { label: 'risk:device-input', manual: true, summary: 'Check the real device file picker or permission path once per release batch.' },
  'native-output': { label: 'risk:native-output', manual: true, summary: 'Check the real browser print/output dialog once per release batch.' }
};

module.exports = { toolContracts, risks };
