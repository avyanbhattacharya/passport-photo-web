const $ = (id) => document.getElementById(id);
let selectedFile = null;
let selectedBytes = null;
let resultUrl = null;
let pdfjsPromise = null;

const fmt = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

function setProgress(percent, message) {
  $('progressBar').style.width = `${Math.max(0, Math.min(100, percent))}%`;
  $('status').textContent = message;
}

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.min.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs';
      return lib;
    });
  }
  return pdfjsPromise;
}

function resetResult() {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  $('resultPanel').classList.add('hidden');
}

async function selectFile(file) {
  if (!file) return;
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    alert('Please choose a PDF file.');
    return;
  }
  resetResult();
  selectedFile = file;
  selectedBytes = new Uint8Array(await file.arrayBuffer());
  $('fileName').textContent = file.name;
  $('fileMeta').textContent = fmt(file.size);
  $('uploadPanel').classList.add('hidden');
  $('settingsPanel').classList.remove('hidden');
  $('workArea').classList.add('hidden');
  $('compressButton').disabled = false;
  setProgress(0, 'Ready');
}

$('chooseButton').addEventListener('click', (e) => { e.stopPropagation(); $('fileInput').click(); });
$('dropZone').addEventListener('click', () => $('fileInput').click());
$('dropZone').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); } });
$('fileInput').addEventListener('change', (e) => selectFile(e.target.files[0]));
$('changeFile').addEventListener('click', () => $('fileInput').click());
['dragenter', 'dragover'].forEach((name) => $('dropZone').addEventListener(name, (e) => { e.preventDefault(); $('dropZone').classList.add('drag'); }));
['dragleave', 'drop'].forEach((name) => $('dropZone').addEventListener(name, (e) => { e.preventDefault(); $('dropZone').classList.remove('drag'); }));
$('dropZone').addEventListener('drop', (e) => selectFile(e.dataTransfer.files[0]));

$('targetEnabled').addEventListener('change', () => {
  const on = $('targetEnabled').checked;
  $('targetControls').classList.toggle('hidden', !on);
  $('targetNote').classList.toggle('hidden', !on);
});

function targetBytes() {
  if (!$('targetEnabled').checked) return null;
  const value = Number($('targetValue').value);
  if (!Number.isFinite(value) || value <= 0) return NaN;
  return Math.round(value * ($('targetUnit').value === 'mb' ? 1024 * 1024 : 1024));
}

async function bestQuality(bytes) {
  if (!window.PDFLib) throw new Error('PDF library did not load. Please check your connection and try again.');
  setProgress(12, 'Optimizing PDF structure…');
  const doc = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  setProgress(35, 'Repacking PDF objects…');
  const saved = await doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 30, updateFieldAppearances: false });
  setProgress(48, 'Comparing result…');
  return saved.length < bytes.length ? new Uint8Array(saved) : new Uint8Array(bytes);
}

function canvasToJpegBytes(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(async (blob) => {
    if (!blob) return reject(new Error('Could not encode a PDF page.'));
    resolve(new Uint8Array(await blob.arrayBuffer()));
  }, 'image/jpeg', quality));
}

async function flattenPdf(bytes, dpi, quality, progressStart = 10, progressEnd = 92) {
  if (!window.PDFLib) throw new Error('PDF library did not load. Please check your connection and try again.');
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  const source = await loadingTask.promise;
  const out = await window.PDFLib.PDFDocument.create();
  const total = source.numPages;

  for (let i = 1; i <= total; i++) {
    const page = await source.getPage(i);
    const points = page.getViewport({ scale: 1 });
    const scale = dpi / 72;
    const view = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(view.width));
    canvas.height = Math.max(1, Math.round(view.height));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: view, background: '#ffffff' }).promise;
    const jpg = await canvasToJpegBytes(canvas, quality);
    const image = await out.embedJpg(jpg);
    const newPage = out.addPage([points.width, points.height]);
    newPage.drawImage(image, { x: 0, y: 0, width: points.width, height: points.height });
    canvas.width = 1; canvas.height = 1;
    if (page.cleanup) page.cleanup();
    const p = progressStart + ((progressEnd - progressStart) * i / total);
    setProgress(p, `Compressing page ${i} of ${total}…`);
    await new Promise((r) => setTimeout(r, 0));
  }
  if (source.cleanup) source.cleanup();
  if (source.destroy) await source.destroy();
  const saved = await out.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 20 });
  return new Uint8Array(saved);
}

const targetCandidates = [
  { dpi: 200, quality: .92, label: 'very high quality' },
  { dpi: 180, quality: .88, label: 'high quality' },
  { dpi: 160, quality: .84, label: 'high quality' },
  { dpi: 145, quality: .79, label: 'balanced quality' },
  { dpi: 130, quality: .73, label: 'balanced quality' },
  { dpi: 115, quality: .66, label: 'compact' },
  { dpi: 100, quality: .58, label: 'compact' },
  { dpi: 85, quality: .48, label: 'smallest practical' }
];

async function compressToTarget(bytes, goal) {
  setProgress(4, 'Trying lossless optimization first…');
  const lossless = await bestQuality(bytes);
  if (lossless.length <= goal) return { bytes: lossless, method: 'lossless', reached: true };

  let last = lossless;
  for (let i = 0; i < targetCandidates.length; i++) {
    const c = targetCandidates[i];
    const start = 8 + i * (82 / targetCandidates.length);
    const end = 8 + (i + 1) * (82 / targetCandidates.length);
    setProgress(start, `Trying ${c.label}…`);
    const candidate = await flattenPdf(bytes, c.dpi, c.quality, start, end);
    if (candidate.length < last.length) last = candidate;
    if (candidate.length <= goal) return { bytes: candidate, method: 'rendered', reached: true };
  }
  return { bytes: last, method: last === lossless ? 'lossless' : 'rendered', reached: false };
}

function outputName(name) {
  const base = name.replace(/\.pdf$/i, '');
  return `${base}-compressed.pdf`;
}

function showResult(bytes, meta) {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  resultUrl = URL.createObjectURL(blob);
  $('downloadLink').href = resultUrl;
  $('downloadLink').download = outputName(selectedFile.name);
  $('originalSize').textContent = fmt(selectedFile.size);
  $('newSize').textContent = fmt(bytes.length);
  const diff = selectedFile.size - bytes.length;
  const pct = Math.max(0, Math.round((diff / selectedFile.size) * 100));
  $('savingText').textContent = diff > 0 ? `${pct}% smaller` : 'Already highly optimized';

  if (meta.target) {
    const targetText = fmt(meta.target);
    $('resultTitle').textContent = meta.reached ? 'Target reached' : 'Closest result created';
    $('resultNote').textContent = meta.reached
      ? `The result is within your ${targetText} target. ${meta.method === 'lossless' ? 'Selectable text and PDF structure were preserved.' : 'Stronger compression rendered pages as images to reach the target.'}`
      : `The smallest practical result was still above your ${targetText} target. We stopped before reducing quality further.`;
  } else if (meta.method === 'lossless') {
    $('resultTitle').textContent = 'Compression complete';
    $('resultNote').textContent = bytes.length < selectedFile.size ? 'Best Quality preserved the PDF content while reducing structural overhead.' : 'This PDF was already compact, so the original bytes were kept rather than making the file larger.';
  } else {
    $('resultTitle').textContent = 'Compression complete';
    $('resultNote').textContent = 'Pages were compressed as high-quality images for stronger size reduction. Text in the new PDF may no longer be selectable.';
  }
  $('resultPanel').classList.remove('hidden');
  $('resultPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('compressButton').addEventListener('click', async () => {
  if (!selectedFile || !selectedBytes) return;
  const goal = targetBytes();
  if (Number.isNaN(goal)) { alert('Enter a valid target file size.'); return; }
  const mode = document.querySelector('input[name="mode"]:checked').value;
  $('compressButton').disabled = true;
  $('workArea').classList.remove('hidden');
  resetResult();
  setProgress(2, 'Preparing PDF…');

  try {
    let result;
    let meta;
    if (goal !== null) {
      result = await compressToTarget(selectedBytes, goal);
      meta = { ...result, target: goal };
    } else if (mode === 'best') {
      const bytes = await bestQuality(selectedBytes);
      result = { bytes, method: 'lossless' };
      meta = result;
    } else {
      const preset = mode === 'balanced' ? { dpi: 160, quality: .84 } : { dpi: 105, quality: .60 };
      const bytes = await flattenPdf(selectedBytes, preset.dpi, preset.quality, 8, 92);
      result = { bytes: bytes.length < selectedBytes.length ? bytes : selectedBytes, method: bytes.length < selectedBytes.length ? 'rendered' : 'lossless' };
      meta = result;
    }
    setProgress(100, 'Done');
    showResult(result.bytes, meta);
  } catch (error) {
    console.error(error);
    setProgress(0, 'Compression failed');
    const msg = /encrypt|password/i.test(String(error?.message))
      ? 'This PDF appears to be password-protected. Please unlock it first and try again.'
      : 'Could not compress this PDF in your browser. Try another file or reload the page.';
    alert(msg);
  } finally {
    $('compressButton').disabled = false;
  }
});

$('anotherButton').addEventListener('click', () => {
  resetResult();
  selectedFile = null;
  selectedBytes = null;
  $('fileInput').value = '';
  $('settingsPanel').classList.add('hidden');
  $('uploadPanel').classList.remove('hidden');
  $('uploadPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
