const $ = id => document.getElementById(id);
const video = $('video');
const overlay = $('overlay');
const preview = $('preview');
const guide = $('previewGuide');

let stream = null;
let source = null;

const settings = {
  brightness: 0,
  contrast: 0,
  whiten: 0,
  zoom: 100,
  x: 0,
  y: 0
};

function overlayGuide(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * devicePixelRatio;

  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 3 * devicePixelRatio;

  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.setLineDash([10 * devicePixelRatio, 8 * devicePixelRatio]);
  ctx.beginPath();
  ctx.ellipse(w * .5, h * .38, w * .25, h * .27, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.strokeStyle = '#4da3ff';
  ctx.beginPath();
  ctx.moveTo(w * .22, h * .37);
  ctx.lineTo(w * .78, h * .37);
  ctx.stroke();

  ctx.strokeStyle = '#ffd84d';
  ctx.beginPath();
  ctx.moveTo(w * .22, h * .31);
  ctx.lineTo(w * .22, h * .48);
  ctx.moveTo(w * .78, h * .31);
  ctx.lineTo(w * .78, h * .48);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.beginPath();
  ctx.moveTo(w * .18, h * .76);
  ctx.quadraticCurveTo(w * .5, h * .61, w * .82, h * .76);
  ctx.stroke();
}

function resizeOverlay() {
  overlayGuide(overlay);
}

addEventListener('resize', resizeOverlay);

$('startCamera').onclick = async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Error('Live camera requires an HTTPS page and a supported browser.');
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1920 },
        height: { ideal: 2560 }
      },
      audio: false
    });

    video.srcObject = stream;
    $('cameraMessage').classList.add('hidden');
    $('capture').disabled = false;
    $('cameraError').classList.add('hidden');
    setTimeout(resizeOverlay, 200);
  } catch (e) {
    $('cameraError').textContent = e.message || 'Unable to start camera.';
    $('cameraError').classList.remove('hidden');
  }
};

$('capture').onclick = () => {
  if (!video.videoWidth) return;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);

  source = new Image();
  source.onload = showEditor;
  source.src = canvas.toDataURL('image/jpeg', .96);
};

$('fileInput').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  source = new Image();
  source.onload = () => {
    URL.revokeObjectURL(url);
    showEditor();
  };
  source.src = url;
};

function showEditor() {
  $('editorCard').classList.remove('hidden');
  $('downloadCard').classList.remove('hidden');
  render();
  $('editorCard').scrollIntoView({ behavior: 'smooth' });
}

function dims() {
  return $('format').value === '2x2' ? [600, 600] : [413, 531];
}

function applyPixelAdjustments(ctx, w, h) {
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;

  const brightnessOffset = settings.brightness * 2.55;
  const contrastAmount = settings.contrast * 2.2;
  const contrastFactor = (259 * (contrastAmount + 255)) / (255 * (259 - contrastAmount));

  const whitenStrength = settings.whiten / 40 * .75;
  const whitenThreshold = 225 - settings.whiten * .55;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (settings.brightness !== 0) {
      r += brightnessOffset;
      g += brightnessOffset;
      b += brightnessOffset;
    }

    if (settings.contrast !== 0) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    if (settings.whiten > 0) {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const looksNeutralAndLight = r > whitenThreshold && g > whitenThreshold && b > whitenThreshold && max - min < 25;

      if (looksNeutralAndLight) {
        r += (255 - r) * whitenStrength;
        g += (255 - g) * whitenStrength;
        b += (255 - b) * whitenStrength;
      }
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  ctx.putImageData(image, 0, 0);
}

function render() {
  if (!source) return;

  const [w, h] = dims();
  preview.width = w;
  preview.height = h;
  guide.width = w;
  guide.height = h;

  const ctx = preview.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, w, h);

  const base = Math.max(w / source.width, h / source.height) * (settings.zoom / 100);
  const dw = source.width * base;
  const dh = source.height * base;
  const dx = (w - dw) / 2 + (settings.x / 100) * w * .25;
  const dy = (h - dh) / 2 + (settings.y / 100) * h * .25;

  ctx.drawImage(source, dx, dy, dw, dh);
  applyPixelAdjustments(ctx, w, h);
  drawPreviewGuide();
}

function drawPreviewGuide() {
  const ctx = guide.getContext('2d');
  const w = guide.width;
  const h = guide.height;

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,110,255,.75)';
  ctx.lineWidth = Math.max(2, w / 250);
  ctx.setLineDash([w / 50, w / 70]);
  ctx.beginPath();
  ctx.ellipse(w * .5, h * .39, w * .25, h * .29, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(w * .2, h * .38);
  ctx.lineTo(w * .8, h * .38);
  ctx.stroke();
}

[
  ['brightness', 'brightness'],
  ['contrast', 'contrast'],
  ['whiten', 'whiten'],
  ['zoom', 'zoom'],
  ['xpos', 'x'],
  ['ypos', 'y']
].forEach(([id, key]) => {
  $(id).addEventListener('input', e => {
    settings[key] = Number(e.target.value);
    const output = $(id + 'Value');
    if (output) output.value = id === 'zoom' ? e.target.value + '%' : e.target.value;
    render();
  });
});

$('format').onchange = render;

$('reset').onclick = () => {
  Object.assign(settings, { brightness: 0, contrast: 0, whiten: 0, zoom: 100, x: 0, y: 0 });

  [['brightness', 0], ['contrast', 0], ['whiten', 0], ['zoom', 100], ['xpos', 0], ['ypos', 0]]
    .forEach(([id, value]) => $(id).value = value);

  $('brightnessValue').value = 0;
  $('contrastValue').value = 0;
  $('whitenValue').value = 0;
  $('zoomValue').value = '100%';
  render();
};

function save(canvas, name) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/jpeg', .95);
  a.download = name;
  a.click();
}

$('downloadSingle').onclick = () => {
  save(preview, $('format').value === '2x2' ? 'passport-photo-2x2.jpg' : 'passport-photo-35x45mm.jpg');
};

$('downloadSheet').onclick = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1800;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let pw, ph;
  if ($('format').value === '2x2') {
    pw = 600;
    ph = 600;
  } else {
    pw = 413;
    ph = 531;
  }

  const gap = 40;
  const total = pw * 2 + gap;
  const start = (1200 - total) / 2;
  const y = (1800 - ph) / 2;

  ctx.drawImage(preview, start, y, pw, ph);
  ctx.drawImage(preview, start + pw + gap, y, pw, ph);
  save(canvas, 'passport-photo-4x6-sheet.jpg');
};

resizeOverlay();
