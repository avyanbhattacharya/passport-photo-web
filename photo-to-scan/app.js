(() => {
  const MAX_INPUT_BYTES = 15 * 1024 * 1024; // 15 MiB
  const MAX_DECODED_PIXELS = 20 * 1000 * 1000; // 20 MP
  const MAX_OUTPUT_EDGE = 3000; // max 3000px longest edge

  const $ = id => document.getElementById(id);
  const sourceCanvas = $('sourceCanvas');
  const resultCanvas = $('resultCanvas');
  const sourceBox = $('sourceBox');
  const fileInput = $('fileInput');
  const chooseImageBtn = $('chooseImageBtn');
  const resetBtn = $('resetBtn');
  const exportJpgBtn = $('exportJpgBtn');
  const exportPdfBtn = $('exportPdfBtn');
  const pdfPageSizeSelect = $('pdfPageSize');
  const brightnessInput = $('brightness');
  const contrastInput = $('contrast');
  const brightnessVal = $('brightnessVal');
  const contrastVal = $('contrastVal');
  const uploadError = $('uploadError');
  const editorError = $('editorError');
  const statusEl = $('status');
  const editorCard = $('editor');

  const cornerEls = Array.from(document.querySelectorAll('.corner'));

  let activeImg = null;
  let fullCanvas = document.createElement('canvas');
  let cachedSourceImageData = null; // Performance caching for full-resolution ImageData
  let pts = []; // Normalized corner coordinates [[x0,y0], [x1,y1], [x2,y2], [x3,y3]]
  let activeMode = 'original';
  let dragIndex = -1;
  let renderRequestId = 0;
  let currentObjectUrl = null;
  let renderDebounceTimer = null;
  window.__photoToScanDebug = { sourceImageDataReads: 0, scheduled: 0, completed: 0, superseded: 0 };

  chooseImageBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (file) handleFile(file);
  });

  function clearErrors() {
    uploadError.textContent = '';
    editorError.textContent = '';
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function decodeImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ img, url });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('decode_error'));
      };
      img.src = url;
    });
  }

  async function handleFile(file) {
    clearErrors();
    if (!file) return;

    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      uploadError.textContent = 'Unsupported file format. Please select a JPEG, PNG or WebP image.';
      return;
    }

    if (file.size > MAX_INPUT_BYTES) {
      uploadError.textContent = `File is too large (${formatBytes(file.size)}). Maximum input file size is 15 MiB.`;
      return;
    }

    statusEl.textContent = 'Loading and decoding image…';

    try {
      const { img, url } = await decodeImage(file);
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      if (!width || !height) {
        URL.revokeObjectURL(url);
        throw new Error('invalid_dimensions');
      }

      const megapixels = (width * height) / 1000000;
      if (width * height > MAX_DECODED_PIXELS) {
        URL.revokeObjectURL(url);
        uploadError.textContent = `Image resolution (${megapixels.toFixed(1)} MP) exceeds the 20 megapixel limit.`;
        statusEl.textContent = '';
        return;
      }

      // Successful decode - revoke old URL if present
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = url;
      activeImg = img;

      fullCanvas.width = width;
      fullCanvas.height = height;
      const fctx = fullCanvas.getContext('2d');
      fctx.drawImage(img, 0, 0, width, height);

      // Cache the source ImageData once on import
      cachedSourceImageData = fctx.getImageData(0, 0, width, height);
      window.__photoToScanDebug.sourceImageDataReads++;

      // Fit preview source canvas into display space
      const maxAvailableWidth = Math.max(260, Math.min(720, document.documentElement.clientWidth - 32));
      const scale = Math.min(1, maxAvailableWidth / width);
      sourceCanvas.width = Math.round(width * scale);
      sourceCanvas.height = Math.round(height * scale);
      const sctx = sourceCanvas.getContext('2d');
      sctx.drawImage(img, 0, 0, sourceCanvas.width, sourceCanvas.height);

      resetPointsAndFilters();
      editorCard.hidden = false;
      uploadError.textContent = '';
      statusEl.textContent = `Loaded ${file.name || 'image'} (${width} × ${height} px)`;

      requestAnimationFrame(() => {
        updateHandles();
        scheduleRender();
      });
    } catch (err) {
      console.error(err);
      uploadError.textContent = 'Failed to decode image. Please select a valid JPEG, PNG or WebP image.';
      statusEl.textContent = '';
    }
  }

  function resetPointsAndFilters() {
    const margin = 0.08;
    // Top-left, top-right, bottom-right, bottom-left
    pts = [
      [margin, margin],
      [1 - margin, margin],
      [1 - margin, 1 - margin],
      [margin, 1 - margin]
    ];
    activeMode = 'original';
    brightnessInput.value = '0';
    contrastInput.value = '0';
    brightnessVal.textContent = '0';
    contrastVal.textContent = '0';
    document.querySelectorAll('.mode').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === 'original');
    });
  }

  function updateHandles() {
    if (!sourceCanvas.width) return;
    const canvasRect = sourceCanvas.getBoundingClientRect();
    const boxRect = sourceBox.getBoundingClientRect();
    const w = canvasRect.width;
    const h = canvasRect.height;
    const offsetX = canvasRect.left - boxRect.left;
    const offsetY = canvasRect.top - boxRect.top;

    cornerEls.forEach((el, i) => {
      const px = pts[i][0];
      const py = pts[i][1];
      el.style.left = `${offsetX + px * w}px`;
      el.style.top = `${offsetY + py * h}px`;

      // Update ARIA slider values for accessibility (CLT-PTS-005)
      const pctX = Math.round(px * 100);
      const pctY = Math.round(py * 100);
      el.setAttribute('aria-valuenow', pctX);
      el.setAttribute('aria-valuetext', `${pctX}% X, ${pctY}% Y`);
    });
  }

  // Corner Geometry Validation
  function crossProduct2D(o, a, b) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  }

  function distance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  function validateQuad(p) {
    // p is array of 4 normalized 2D points [[x0,y0], [x1,y1], [x2,y2], [x3,y3]]
    // 1. Check minimum edge lengths (at least 0.03 normalized distance)
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      if (distance(p[i], p[next]) < 0.03) {
        return { valid: false, reason: 'Corners are too close to each other.' };
      }
    }

    // 2. Check strict convexity / non-self-intersecting (all cross products must have same non-zero sign)
    const cp0 = crossProduct2D(p[0], p[1], p[2]);
    const cp1 = crossProduct2D(p[1], p[2], p[3]);
    const cp2 = crossProduct2D(p[2], p[3], p[0]);
    const cp3 = crossProduct2D(p[3], p[0], p[1]);

    const minAreaThreshold = 0.001; // Minimum area fraction
    const cpArray = [cp0, cp1, cp2, cp3];

    const allPositive = cpArray.every(cp => cp > minAreaThreshold);
    const allNegative = cpArray.every(cp => cp < -minAreaThreshold);

    if (!allPositive && !allNegative) {
      return { valid: false, reason: 'Degenerate, crossed, or collinear corners selected.' };
    }

    return { valid: true };
  }

  // Gaussian elimination homography solver
  function solve8x8(A, b) {
    for (let i = 0; i < 8; i++) {
      let pivot = i;
      for (let j = i + 1; j < 8; j++) {
        if (Math.abs(A[j][i]) > Math.abs(A[pivot][i])) pivot = j;
      }
      [A[i], A[pivot]] = [A[pivot], A[i]];
      [b[i], b[pivot]] = [b[pivot], b[i]];

      const d = A[i][i];
      if (Math.abs(d) < 1e-11) return null; // Singular matrix

      for (let k = i; k < 8; k++) A[i][k] /= d;
      b[i] /= d;

      for (let j = 0; j < 8; j++) {
        if (j !== i) {
          const factor = A[j][i];
          for (let k = i; k < 8; k++) A[j][k] -= factor * A[i][k];
          b[j] -= factor * b[i];
        }
      }
    }
    return b;
  }

  function computeHomography(dst, src) {
    // Maps dst coordinates (x, y) to src coordinates (u, v)
    const A = [];
    const b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = dst[i];
      const [u, v] = src[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
      b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
      b.push(v);
    }
    const h = solve8x8(A, b);
    if (!h) return null;
    return [...h, 1];
  }

  function scheduleRender(debounceMs = 0) {
    const requestId = ++renderRequestId;
    window.__photoToScanDebug.scheduled++;
    if (renderDebounceTimer) clearTimeout(renderDebounceTimer);

    if (debounceMs > 0) {
      renderDebounceTimer = setTimeout(() => {
        requestAnimationFrame(() => renderResult(requestId));
      }, debounceMs);
    } else {
      requestAnimationFrame(() => renderResult(requestId));
    }
  }

  function renderResult(requestId) {
    // CLT-PTS-004: Ensure superseded render requests do not proceed or overwrite canvas
    if (requestId !== renderRequestId || !activeImg || !cachedSourceImageData) { window.__photoToScanDebug.superseded++; return; }

    editorError.textContent = '';
    const quadCheck = validateQuad(pts);

    if (!quadCheck.valid) {
      editorError.textContent = quadCheck.reason;
      exportJpgBtn.disabled = true;
      exportPdfBtn.disabled = true;
      resultCanvas.width = 1;
      resultCanvas.height = 1;
      const ctx = resultCanvas.getContext('2d');
      ctx.clearRect(0, 0, 1, 1);
      return;
    }

    exportJpgBtn.disabled = false;
    exportPdfBtn.disabled = false;

    const iw = fullCanvas.width;
    const ih = fullCanvas.height;
    const srcPts = pts.map(([x, y]) => [x * iw, y * ih]);

    // Destination dimensions calculated from edge distances
    const topW = distance(srcPts[0], srcPts[1]);
    const botW = distance(srcPts[3], srcPts[2]);
    const leftH = distance(srcPts[0], srcPts[3]);
    const rightH = distance(srcPts[1], srcPts[2]);

    const targetW = Math.max(1, Math.round(Math.max(topW, botW)));
    const targetH = Math.max(1, Math.round(Math.max(leftH, rightH)));

    // Cap output maximum dimension to MAX_OUTPUT_EDGE (3000px)
    const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(targetW, targetH));
    const W = Math.max(1, Math.round(targetW * scale));
    const H = Math.max(1, Math.round(targetH * scale));

    resultCanvas.width = W;
    resultCanvas.height = H;

    const dstPts = [[0, 0], [W - 1, 0], [W - 1, H - 1], [0, H - 1]];
    const M = computeHomography(dstPts, srcPts);

    if (!M) {
      editorError.textContent = 'Perspective transformation matrix is singular. Please adjust corners.';
      exportJpgBtn.disabled = true;
      exportPdfBtn.disabled = true;
      return;
    }

    const sData = cachedSourceImageData.data;
    const outputData = new ImageData(W, H);
    const oData = outputData.data;

    const brightness = parseInt(brightnessInput.value, 10) || 0;
    const contrast = parseInt(contrastInput.value, 10) || 0;

    // Contrast factor formula
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const bOffset = brightness * 2.55;

    // CLT-PTS-001: Bilinear Interpolation for smooth resampling
    for (let y = 0; y < H; y++) {
      if (requestId !== renderRequestId) { window.__photoToScanDebug.superseded++; return; } // Superseded check during loop
      for (let x = 0; x < W; x++) {
        const denom = M[6] * x + M[7] * y + M[8];
        if (Math.abs(denom) < 1e-12) continue;

        const sx = (M[0] * x + M[1] * y + M[2]) / denom;
        const sy = (M[3] * x + M[4] * y + M[5]) / denom;

        // Clamped continuous floating point coordinates
        const csx = Math.max(0, Math.min(iw - 1, sx));
        const csy = Math.max(0, Math.min(ih - 1, sy));

        const x0 = Math.floor(csx);
        const y0 = Math.floor(csy);
        const x1 = Math.min(iw - 1, x0 + 1);
        const y1 = Math.min(ih - 1, y0 + 1);

        const dx = csx - x0;
        const dy = csy - y0;

        const w00 = (1 - dx) * (1 - dy);
        const w10 = dx * (1 - dy);
        const w01 = (1 - dx) * dy;
        const w11 = dx * dy;

        const idx00 = (y0 * iw + x0) * 4;
        const idx10 = (y0 * iw + x1) * 4;
        const idx01 = (y1 * iw + x0) * 4;
        const idx11 = (y1 * iw + x1) * 4;

        let r = w00 * sData[idx00] + w10 * sData[idx10] + w01 * sData[idx01] + w11 * sData[idx11];
        let g = w00 * sData[idx00 + 1] + w10 * sData[idx10 + 1] + w01 * sData[idx01 + 1] + w11 * sData[idx11 + 1];
        let b = w00 * sData[idx00 + 2] + w10 * sData[idx10 + 2] + w01 * sData[idx01 + 2] + w11 * sData[idx11 + 2];

        // Apply document mode
        if (activeMode === 'grayscale') {
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          r = g = b = lum;
        } else if (activeMode === 'high-contrast') {
          let lum = 0.299 * r + 0.587 * g + 0.114 * b;
          // Soft threshold S-curve / high-contrast filter
          lum = lum > 170 ? 255 : lum < 85 ? 0 : ((lum - 85) / 85) * 255;
          r = g = b = lum;
        }

        // Apply Brightness & Contrast adjustments
        if (brightness !== 0) {
          r += bOffset;
          g += bOffset;
          b += bOffset;
        }
        if (contrast !== 0) {
          r = contrastFactor * (r - 128) + 128;
          g = contrastFactor * (g - 128) + 128;
          b = contrastFactor * (b - 128) + 128;
        }

        const oi = (y * W + x) * 4;
        oData[oi] = Math.max(0, Math.min(255, Math.round(r)));
        oData[oi + 1] = Math.max(0, Math.min(255, Math.round(g)));
        oData[oi + 2] = Math.max(0, Math.min(255, Math.round(b)));
        oData[oi + 3] = 255;
      }
    }

    if (requestId === renderRequestId) {
      resultCanvas.getContext('2d').putImageData(outputData, 0, 0);
      statusEl.textContent = `Output scan size: ${W} × ${H} px`;
      window.__photoToScanDebug.completed++;
    }
  }

  // Pointer & Drag Interaction
  cornerEls.forEach(el => {
    const idx = parseInt(el.dataset.i, 10);

    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      dragIndex = idx;
      el.classList.add('active');
      el.focus();
      try { if (el.setPointerCapture) el.setPointerCapture(e.pointerId); } catch {}
    });

    el.addEventListener('pointermove', e => {
      if (dragIndex !== idx) return;
      e.preventDefault();
      const canvasRect = sourceCanvas.getBoundingClientRect();
      if (!canvasRect.width || !canvasRect.height) return;

      const normX = Math.max(0, Math.min(1, (e.clientX - canvasRect.left) / canvasRect.width));
      const normY = Math.max(0, Math.min(1, (e.clientY - canvasRect.top) / canvasRect.height));

      pts[dragIndex] = [normX, normY];
      updateHandles();
      scheduleRender();
    });

    const endDrag = e => {
      if (dragIndex === idx) {
        dragIndex = -1;
        el.classList.remove('active');
        updateHandles();
        scheduleRender();
      }
    };

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    // Keyboard accessibility
    el.addEventListener('keydown', e => {
      const step = e.shiftKey ? 0.02 : 0.005;
      let handled = false;
      const [curX, curY] = pts[idx];
      let newX = curX;
      let newY = curY;

      switch (e.key) {
        case 'ArrowLeft':
          newX = Math.max(0, curX - step);
          handled = true;
          break;
        case 'ArrowRight':
          newX = Math.min(1, curX + step);
          handled = true;
          break;
        case 'ArrowUp':
          newY = Math.max(0, curY - step);
          handled = true;
          break;
        case 'ArrowDown':
          newY = Math.min(1, curY + step);
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
        pts[idx] = [newX, newY];
        updateHandles();
        scheduleRender();
      }
    });
  });

  window.addEventListener('resize', () => {
    if (activeImg) {
      const width = activeImg.naturalWidth || activeImg.width;
      const height = activeImg.naturalHeight || activeImg.height;
      const maxAvailableWidth = Math.max(260, Math.min(720, document.documentElement.clientWidth - 32));
      const scale = Math.min(1, maxAvailableWidth / width);
      sourceCanvas.width = Math.round(width * scale);
      sourceCanvas.height = Math.round(height * scale);
      sourceCanvas.getContext('2d').drawImage(activeImg, 0, 0, sourceCanvas.width, sourceCanvas.height);
      requestAnimationFrame(updateHandles);
    }
  });

  // Controls & Listeners
  document.querySelectorAll('.mode').forEach(btn => {
    btn.addEventListener('click', () => {
      activeMode = btn.dataset.mode;
      document.querySelectorAll('.mode').forEach(b => b.classList.toggle('active', b === btn));
      scheduleRender();
    });
  });

  // Debounced adjustments for sliders to remain responsive
  brightnessInput.addEventListener('input', () => {
    brightnessVal.textContent = brightnessInput.value;
    scheduleRender(30);
  });

  contrastInput.addEventListener('input', () => {
    contrastVal.textContent = contrastInput.value;
    scheduleRender(30);
  });

  resetBtn.addEventListener('click', () => {
    resetPointsAndFilters();
    updateHandles();
    scheduleRender();
  });

  // Export handlers
  exportJpgBtn.addEventListener('click', () => {
    if (!resultCanvas.width || resultCanvas.width <= 1) return;
    resultCanvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scanned-document.jpg';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/jpeg', 0.92);
  });

  exportPdfBtn.addEventListener('click', async () => {
    if (!resultCanvas.width || resultCanvas.width <= 1) return;
    if (!window.PDFLib) {
      editorError.textContent = 'PDF library could not be loaded. Please check your connection.';
      return;
    }

    try {
      statusEl.textContent = 'Generating PDF…';
      const blob = await new Promise(res => resultCanvas.toBlob(res, 'image/jpeg', 0.92));
      const jpgArrayBuffer = await blob.arrayBuffer();

      const doc = await PDFLib.PDFDocument.create();
      const embeddedJpg = await doc.embedJpg(jpgArrayBuffer);

      let pageSizePoints = pdfPageSizeSelect.value === 'letter' ? [612, 792] : [595.28, 841.89];

      // Auto-orient PDF page if scan is landscape
      if (embeddedJpg.width > embeddedJpg.height) {
        pageSizePoints = [pageSizePoints[1], pageSizePoints[0]];
      }

      const [pageW, pageH] = pageSizePoints;
      const page = doc.addPage(pageSizePoints);

      const margin = 20;
      const fitScale = Math.min((pageW - 2 * margin) / embeddedJpg.width, (pageH - 2 * margin) / embeddedJpg.height);
      const drawW = embeddedJpg.width * fitScale;
      const drawH = embeddedJpg.height * fitScale;

      page.drawImage(embeddedJpg, {
        x: (pageW - drawW) / 2,
        y: (pageH - drawH) / 2,
        width: drawW,
        height: drawH
      });

      const pdfBytes = await doc.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = 'scanned-document.pdf';
      a.click();

      setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
      statusEl.textContent = `PDF exported (${formatBytes(pdfBlob.size)})`;
    } catch (e) {
      console.error(e);
      editorError.textContent = 'Failed to generate PDF output.';
      statusEl.textContent = '';
    }
  });
})();
