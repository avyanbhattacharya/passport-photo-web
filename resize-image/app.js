const $ = id => document.getElementById(id);

let source = null;
let file = null;
let sourceUrl = null;
let resultUrl = null;
let originalRatio = 1;
let crop = { x: 0, y: 0, w: 1, h: 1 };
let drag = null;
let imageZoom = 1;
let pinch = null;
const pointers = new Map();

const imageFile = $('imageFile');
const chooseImageBtn = $('chooseImageBtn');
const editor = $('editor');
const preview = $('preview');
const width = $('width');
const height = $('height');
const format = $('format');
const targetSize = $('targetSize');
const targetUnit = $('targetUnit');
const error = $('error');
const result = $('result');
const cropStage = $('cropStage');
const cropOverlay = $('cropOverlay');
const cropPanel = $('cropPanel');
const cropInfo = $('cropInfo');
const outputSummary = $('outputSummary');
const previewTitle = $('previewTitle');
const previewSubtitle = $('previewSubtitle');
const previewHelpText = $('previewHelpText');
const resetCropBtn = $('resetCrop');
const cropAdjustments = $('cropAdjustments');
const imageZoomRange = $('imageZoomRange');
const imageZoomValue = $('imageZoomValue');
const imageZoomIn = $('imageZoomIn');
const imageZoomOut = $('imageZoomOut');

// Crop size is determined only by the requested aspect ratio / dimensions.
// Remove the old manual crop-size controls and resize handles if older HTML is cached.
$('cropSizeControls')?.remove();
cropOverlay?.querySelectorAll('.handle').forEach(handle => handle.remove());
if (imageZoomRange) {
  imageZoomRange.min = '50';
  imageZoomRange.max = '300';
  imageZoomRange.step = '5';
}

function bytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

function showError(message) {
  error.textContent = message;
  error.hidden = false;
}

function clearError() {
  error.hidden = true;
  error.textContent = '';
}

function selectedFit() {
  return document.querySelector('input[name="fit"]:checked').value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function outRatio() {
  const w = Number(width.value);
  const h = Number(height.value);
  return w > 0 && h > 0 ? w / h : originalRatio;
}

function drawPreviewBase() {
  if (!source) return;
  const max = 700;
  const scale = Math.min(1, max / source.naturalWidth, max / source.naturalHeight);
  preview.width = Math.max(1, Math.round(source.naturalWidth * scale));
  preview.height = Math.max(1, Math.round(source.naturalHeight * scale));
  preview.getContext('2d').drawImage(source, 0, 0, preview.width, preview.height);
  requestAnimationFrame(updateOverlay);
}

function computeCrop() {
  if (!source) return;
  const ratio = outRatio();
  const sw = source.naturalWidth;
  const sh = source.naturalHeight;
  if (sw / sh > ratio) {
    const h = sh;
    const w = h * ratio;
    crop = { x: (sw - w) / 2, y: 0, w, h };
  } else {
    const w = sw;
    const h = w / ratio;
    crop = { x: 0, y: (sh - h) / 2, w, h };
  }
}

function applyImageZoom(value) {
  if (!source || selectedFit() !== 'crop') return;
  const percent = clamp(Number(value) || 100, 50, 300);
  imageZoom = percent / 100;
  imageZoomRange.value = String(percent);
  imageZoomValue.textContent = `${percent}%`;
  updateOverlay();
}

function resetCrop() {
  if (!source) return;
  computeCrop();
  imageZoom = 1;
  imageZoomRange.value = '100';
  imageZoomValue.textContent = '100%';
  updateOverlay();
}

function zoomViewRect() {
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  const w = crop.w / imageZoom;
  const h = crop.h / imageZoom;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function updateOverlay() {
  if (!source) return;
  const cropMode = selectedFit() === 'crop';
  cropOverlay.hidden = !cropMode;
  resetCropBtn.hidden = !cropMode;
  cropAdjustments.hidden = !cropMode;

  if (cropMode) {
    const sx = preview.clientWidth / source.naturalWidth;
    const sy = preview.clientHeight / source.naturalHeight;
    const cx = (crop.x + crop.w / 2) * sx;
    const cy = (crop.y + crop.h / 2) * sy;
    cropOverlay.style.left = `${crop.x * sx}px`;
    cropOverlay.style.top = `${crop.y * sy}px`;
    cropOverlay.style.width = `${crop.w * sx}px`;
    cropOverlay.style.height = `${crop.h * sy}px`;
    cropOverlay.style.setProperty('--crop-third', `${crop.w * sx / 3}px`);
    preview.style.transformOrigin = `${cx}px ${cy}px`;
    preview.style.transform = `scale(${imageZoom})`;
    const view = zoomViewRect();
    cropInfo.textContent = `View ${Math.round(view.w)} × ${Math.round(view.h)} px · image ${Math.round(imageZoom * 100)}%`;
    previewTitle.textContent = 'Crop area';
    previewSubtitle.textContent = 'The frame is fixed by your requested aspect ratio. Drag it to choose the area, then zoom the image in or out.';
    previewHelpText.textContent = '💡 Drag the crop frame to position it. Pinch with two fingers to zoom the image in or out.';
  } else {
    preview.style.transform = 'none';
    cropInfo.textContent = `Full image ${source.naturalWidth} × ${source.naturalHeight} px`;
    previewTitle.textContent = 'Image preview';
    previewSubtitle.textContent = 'The entire image will be kept inside the requested dimensions.';
    previewHelpText.textContent = '💡 Empty space may be added if the requested aspect ratio is different.';
  }
  updateSummary();
}

function updateSummary() {
  const w = Math.round(Number(width.value) || 0);
  const h = Math.round(Number(height.value) || 0);
  const ext = format.value === 'image/jpeg' ? 'JPG' : format.value === 'image/webp' ? 'WebP' : 'PNG';
  const target = targetSize.value ? `${targetSize.value} ${Number(targetUnit.value) === 1024 ? 'KB' : 'MB'}` : 'no size limit';
  outputSummary.innerHTML = w && h ? `Final image: <strong>${w} × ${h} px</strong> · ${ext} · ${target}` : '';
}

function setRatio(ratioName) {
  document.querySelectorAll('.preset').forEach(button => button.classList.toggle('active', button.dataset.ratio === ratioName));
  if (ratioName !== 'custom') {
    const ratio = ratioName === 'original' ? originalRatio : Number(ratioName);
    if (width.value) height.value = Math.max(1, Math.round(Number(width.value) / ratio));
  }
  resetCrop();
  updateSummary();
}

document.querySelectorAll('.preset').forEach(button => button.addEventListener('click', event => {
  event.preventDefault();
  setRatio(button.dataset.ratio);
}));

width.addEventListener('input', () => {
  const active = document.querySelector('.preset.active');
  if (active && active.dataset.ratio !== 'custom') {
    const ratio = active.dataset.ratio === 'original' ? originalRatio : Number(active.dataset.ratio);
    height.value = Math.max(1, Math.round(Number(width.value) / ratio));
  }
  resetCrop();
  updateSummary();
});

height.addEventListener('input', () => {
  document.querySelectorAll('.preset').forEach(button => button.classList.toggle('active', button.dataset.ratio === 'custom'));
  resetCrop();
  updateSummary();
});

[format, targetSize, targetUnit].forEach(element => element.addEventListener('input', updateSummary));

document.querySelectorAll('input[name="fit"]').forEach(radio => radio.addEventListener('change', () => {
  drawPreviewBase();
  if (selectedFit() === 'crop') resetCrop();
  else updateOverlay();
  updateSummary();
}));

resetCropBtn.addEventListener('click', resetCrop);
imageZoomRange.addEventListener('input', () => applyImageZoom(imageZoomRange.value));
imageZoomIn.addEventListener('click', () => applyImageZoom(Number(imageZoomRange.value) + 10));
imageZoomOut.addEventListener('click', () => applyImageZoom(Number(imageZoomRange.value) - 10));

if (chooseImageBtn) chooseImageBtn.addEventListener('click', () => {
  imageFile.value = '';
  imageFile.click();
});

function pointerToImage(event) {
  const rect = cropStage.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * source.naturalWidth / preview.clientWidth,
    y: (event.clientY - rect.top) * source.naturalHeight / preview.clientHeight
  };
}

function startDrag(event) {
  if (!source || selectedFit() !== 'crop' || pinch) return;
  event.preventDefault();
  drag = { start: pointerToImage(event), orig: { ...crop } };
  cropOverlay.setPointerCapture?.(event.pointerId);
}

cropOverlay.addEventListener('pointerdown', startDrag);
cropOverlay.addEventListener('pointermove', event => {
  if (!drag || !source || pinch) return;
  event.preventDefault();
  const point = pointerToImage(event);
  const dx = point.x - drag.start.x;
  const dy = point.y - drag.start.y;
  crop.x = clamp(drag.orig.x + dx, 0, source.naturalWidth - drag.orig.w);
  crop.y = clamp(drag.orig.y + dy, 0, source.naturalHeight - drag.orig.h);
  crop.w = drag.orig.w;
  crop.h = drag.orig.h;
  updateOverlay();
});

function endDrag(event) {
  if (!drag) return;
  drag = null;
  try { cropOverlay.releasePointerCapture?.(event.pointerId); } catch {}
}

cropOverlay.addEventListener('pointerup', endDrag);
cropOverlay.addEventListener('pointercancel', endDrag);

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

cropStage.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch' || selectedFit() !== 'crop') return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    drag = null;
    const points = [...pointers.values()];
    pinch = { distance: distance(points[0], points[1]), zoom: imageZoom };
    try { cropStage.setPointerCapture(event.pointerId); } catch {}
  }
});

cropStage.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch && pointers.size >= 2) {
    event.preventDefault();
    const points = [...pointers.values()].slice(0, 2);
    const currentDistance = distance(points[0], points[1]);
    if (pinch.distance > 0) applyImageZoom(pinch.zoom * (currentDistance / pinch.distance) * 100);
  }
});

function finishPointer(event) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinch = null;
}

cropStage.addEventListener('pointerup', finishPointer);
cropStage.addEventListener('pointercancel', finishPointer);
window.addEventListener('resize', updateOverlay);

function renderCropOutput(context, outW, outH) {
  const view = zoomViewRect();
  const sx1 = Math.max(0, view.x);
  const sy1 = Math.max(0, view.y);
  const sx2 = Math.min(source.naturalWidth, view.x + view.w);
  const sy2 = Math.min(source.naturalHeight, view.y + view.h);
  if (sx2 <= sx1 || sy2 <= sy1) return;

  const sourceW = sx2 - sx1;
  const sourceH = sy2 - sy1;
  const dx = (sx1 - view.x) / view.w * outW;
  const dy = (sy1 - view.y) / view.h * outH;
  const dw = sourceW / view.w * outW;
  const dh = sourceH / view.h * outH;
  context.drawImage(source, sx1, sy1, sourceW, sourceH, dx, dy, dw, dh);
}

function renderOutput(canvas, w, h) {
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, w, h);
  if (selectedFit() === 'crop') {
    renderCropOutput(context, w, h);
  } else {
    const scale = Math.min(w / source.naturalWidth, h / source.naturalHeight);
    const dw = source.naturalWidth * scale;
    const dh = source.naturalHeight * scale;
    context.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('This browser could not create the requested image.')), type, quality));
}

async function encode(canvas, type, target) {
  if (type === 'image/png') {
    const blob = await canvasBlob(canvas, type);
    return { blob, quality: null, reached: !target || blob.size <= target };
  }
  if (!target) {
    const blob = await canvasBlob(canvas, type, .92);
    return { blob, quality: .92, reached: true };
  }
  let lo = .05;
  let hi = .98;
  let best = null;
  for (let i = 0; i < 10; i++) {
    const quality = (lo + hi) / 2;
    const blob = await canvasBlob(canvas, type, quality);
    if (blob.size <= target) {
      best = { blob, quality };
      lo = quality;
    } else {
      hi = quality;
    }
  }
  if (best) return { ...best, reached: true };
  const blob = await canvasBlob(canvas, type, .05);
  return { blob, quality: .05, reached: blob.size <= target };
}

imageFile.addEventListener('change', () => {
  clearError();
  file = imageFile.files[0];
  if (!file) return;
  const looksLikeImage = (file.type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '');
  if (!looksLikeImage) {
    showError('Please choose an image file.');
    return;
  }
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);
  source = new Image();
  source.onload = () => {
    originalRatio = source.naturalWidth / source.naturalHeight;
    width.value = source.naturalWidth;
    height.value = source.naturalHeight;
    $('originalInfo').textContent = `Original: ${source.naturalWidth} × ${source.naturalHeight} px · ${bytes(file.size)}`;
    editor.hidden = false;
    result.hidden = true;
    cropPanel.hidden = false;
    setRatio('original');
    drawPreviewBase();
    resetCrop();
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  source.onerror = () => showError('This image format could not be opened by your browser. Try JPG, PNG or WebP.');
  source.src = sourceUrl;
});

$('processBtn').addEventListener('click', async () => {
  clearError();
  result.hidden = true;
  const w = Math.round(Number(width.value));
  const h = Math.round(Number(height.value));
  if (!source || !w || !h || w < 1 || h < 1 || w > 12000 || h > 12000) {
    showError('Enter valid dimensions between 1 and 12,000 pixels.');
    return;
  }
  const target = targetSize.value ? Number(targetSize.value) * Number(targetUnit.value) : null;
  if (targetSize.value && (!target || target <= 0)) {
    showError('Enter a valid maximum file size.');
    return;
  }

  const button = $('processBtn');
  button.disabled = true;
  button.textContent = 'Processing…';
  try {
    const canvas = document.createElement('canvas');
    renderOutput(canvas, w, h);
    const encoded = await encode(canvas, format.value, target);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(encoded.blob);
    const ext = format.value === 'image/jpeg' ? 'jpg' : format.value === 'image/webp' ? 'webp' : 'png';
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    $('downloadBtn').href = resultUrl;
    $('downloadBtn').download = `${base}-${w}x${h}.${ext}`;
    const checks = [`✓ ${w} × ${h} px`, `✓ ${ext.toUpperCase()}`];
    if (target) checks.push(encoded.reached ? `✓ Under ${bytes(target)}` : `⚠ Target ${bytes(target)} not reached`);
    $('checks').innerHTML = checks.map(text => `<span class="check">${text}</span>`).join('');
    let meta = `Original ${bytes(file.size)} → Output ${bytes(encoded.blob.size)}`;
    if (selectedFit() === 'crop') {
      const view = zoomViewRect();
      meta += ` · View ${Math.round(view.w)} × ${Math.round(view.h)} px · Image zoom ${imageZoomRange.value}%`;
    } else {
      meta += ' · Entire image contained';
    }
    if (encoded.quality !== null) meta += ` · Quality ${Math.round(encoded.quality * 100)}%`;
    if (format.value === 'image/png' && target && encoded.blob.size > target) meta += ' · PNG is lossless, so quality cannot be lowered to force a smaller file.';
    $('resultMeta').textContent = meta;
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    showError(err.message || 'Could not process this image.');
  } finally {
    button.disabled = false;
    button.textContent = 'Resize & Compress Image';
  }
});