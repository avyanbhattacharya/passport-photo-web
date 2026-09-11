(() => {
  const PRIVACY_TAGLINE = 'Your files never leave your machine.';
  const MAX_BATCH_SIZE = 30;
  const MAX_CONCURRENCY = 2;

  const dropZone = document.getElementById('dropZone');
  const chooseBtn = document.getElementById('chooseBtn');
  const imageFiles = document.getElementById('imageFiles');
  const globalError = document.getElementById('globalError');
  const editor = document.getElementById('editor');
  const formatEl = document.getElementById('format');
  const qualityEl = document.getElementById('quality');
  const qualityValueEl = document.getElementById('qualityValue');
  const maxDimensionEl = document.getElementById('maxDimension');
  const batchSummary = document.getElementById('batchSummary');
  const convertBatchBtn = document.getElementById('convertBatchBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const clearBtn = document.getElementById('clearBtn');
  const batchStatus = document.getElementById('batchStatus');
  const itemsList = document.getElementById('itemsList');

  let items = [];
  let isProcessing = false;
  let isCancelled = false;
  let activeConcurrency = 0;
  let maxObservedConcurrency = 0;

  // Instrumentation for Playwright tests
  window.__batchConverterState = {
    get items() { return items; },
    get isProcessing() { return isProcessing; },
    get activeConcurrency() { return activeConcurrency; },
    get maxObservedConcurrency() { return maxObservedConcurrency; },
    resetMetrics() { maxObservedConcurrency = 0; }
  };

  const fmtBytes = b => {
    if (typeof b !== 'number' || isNaN(b)) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };

  function setGlobalError(msg) {
    if (msg) {
      globalError.textContent = msg;
      globalError.hidden = false;
    } else {
      globalError.textContent = '';
      globalError.hidden = true;
    }
  }

  function updateQualityState() {
    const isPng = formatEl.value === 'image/png';
    qualityEl.disabled = isPng;
    qualityValueEl.textContent = isPng ? 'N/A (Lossless PNG)' : `${qualityEl.value}%`;
  }

  function isSupportedFile(file) {
    if (!file) return false;
    const name = file.name || '';
    const type = file.type || '';
    return /\.(jpe?g|png|webp|heic|heif)$/i.test(name) || /^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(type);
  }

  function isHeicFile(file) {
    const name = file.name || '';
    const type = file.type || '';
    return /\.(heic|heif)$/i.test(name) || /image\/(heic|heif)/i.test(type);
  }

  function revokeItemUrls(item) {
    if (item.outputUrl) {
      URL.revokeObjectURL(item.outputUrl);
      item.outputUrl = null;
    }
  }

  function clearAllItems() {
    items.forEach(revokeItemUrls);
    items = [];
    isProcessing = false;
    isCancelled = false;
    activeConcurrency = 0;
    maxObservedConcurrency = 0;
    setGlobalError('');
    batchStatus.textContent = '';
    render();
  }

  function removeItem(id) {
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      revokeItemUrls(items[idx]);
      items.splice(idx, 1);
      render();
    }
  }

  function retryItem(id) {
    const item = items.find(i => i.id === id);
    if (item) {
      revokeItemUrls(item);
      item.status = 'queued';
      item.error = null;
      render();
      if (!isProcessing) {
        processBatch();
      }
    }
  }

  function render() {
    editor.hidden = items.length === 0;
    if (items.length === 0) return;

    const queuedCount = items.filter(i => i.status === 'queued').length;
    const convertingCount = items.filter(i => i.status === 'converting').length;
    const convertedCount = items.filter(i => i.status === 'converted').length;
    const failedCount = items.filter(i => i.status === 'failed').length;
    const skippedCount = items.filter(i => i.status === 'skipped').length;

    batchSummary.textContent = `${items.length} file${items.length === 1 ? '' : 's'} (${convertedCount} converted, ${failedCount} failed, ${queuedCount} queued)`;

    convertBatchBtn.disabled = isProcessing || queuedCount === 0;
    cancelBtn.hidden = !isProcessing;
    clearBtn.disabled = isProcessing;

    itemsList.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = `item-row ${item.status}`;
      row.dataset.itemId = item.id;

      const info = document.createElement('div');
      info.className = 'item-info';

      const name = document.createElement('div');
      name.className = 'item-name';
      name.textContent = item.file.name;

      const meta = document.createElement('div');
      meta.className = 'item-meta';

      let metaText = `Input: ${fmtBytes(item.file.size)}`;
      if (item.originalWidth && item.originalHeight) {
        metaText += ` (${item.originalWidth} × ${item.originalHeight} px)`;
      }

      if (item.status === 'converted' && item.outputSize) {
        metaText += ` → Output: ${fmtBytes(item.outputSize)} (${item.outputWidth} × ${item.outputHeight} px)`;
      } else if (item.status === 'failed' && item.error) {
        metaText += ` · Error: ${item.error}`;
      }

      meta.textContent = metaText;

      const statusBadge = document.createElement('span');
      statusBadge.className = `item-status status-${item.status}`;
      statusBadge.textContent = item.status.charAt(0).toUpperCase() + item.status.slice(1);

      info.append(name, meta, statusBadge);

      const actions = document.createElement('div');
      actions.className = 'item-actions';

      if (item.status === 'converted' && item.outputUrl) {
        const dlBtn = document.createElement('a');
        dlBtn.className = 'button primary';
        dlBtn.href = item.outputUrl;
        const ext = getOutputExtension(formatEl.value);
        const base = item.file.name.replace(/\.[^.]+$/, '');
        dlBtn.download = `${base}-converted.${ext}`;
        dlBtn.textContent = 'Download';
        actions.append(dlBtn);
      }

      if ((item.status === 'failed' || item.status === 'skipped') && !isProcessing) {
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'button secondary';
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', () => retryItem(item.id));
        actions.append(retryBtn);
      }

      if (!isProcessing) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'button secondary';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => removeItem(item.id));
        actions.append(removeBtn);
      }

      row.append(info, actions);
      itemsList.append(row);
    });

  }

  function addFiles(incoming) {
    setGlobalError('');
    const files = Array.from(incoming);
    if (!files.length) return;

    if (items.length + files.length > MAX_BATCH_SIZE) {
      setGlobalError(`You can convert up to ${MAX_BATCH_SIZE} files in a single batch.`);
      return;
    }

    const validFiles = files.filter(isSupportedFile);
    if (validFiles.length < files.length && validFiles.length === 0) {
      setGlobalError('Please select supported image files (JPEG, PNG, WebP, HEIC).');
      return;
    }

    validFiles.forEach(file => {
      items.push({
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: 'queued',
        error: null,
        originalWidth: 0,
        originalHeight: 0,
        outputBlob: null,
        outputUrl: null,
        outputWidth: 0,
        outputHeight: 0,
        outputSize: 0
      });
    });

    imageFiles.value = '';
    render();
  }

  async function decodeImageToCanvas(item) {
    let sourceBlob = item.file;
    if (isHeicFile(item.file)) {
      if (typeof window.heic2any !== 'function') {
        throw new Error('HEIC decoder library could not be loaded.');
      }
      let converted = await window.heic2any({ blob: item.file, toType: 'image/png' });
      if (Array.isArray(converted)) converted = converted[0];
      sourceBlob = converted;
    }

    const url = URL.createObjectURL(sourceBlob);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Corrupt or unsupported image file.'));
        img.src = url;
      });

      item.originalWidth = img.naturalWidth;
      item.originalHeight = img.naturalHeight;

      let targetW = img.naturalWidth;
      let targetH = img.naturalHeight;

      const maxDimVal = Number(maxDimensionEl.value);
      if (maxDimVal && maxDimVal >= 100 && maxDimVal <= 12000) {
        const largest = Math.max(targetW, targetH);
        if (largest > maxDimVal) {
          const scale = maxDimVal / largest;
          targetW = Math.max(1, Math.round(targetW * scale));
          targetH = Math.max(1, Math.round(targetH * scale));
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const targetFormat = formatEl.value;
      const quality = Number(qualityEl.value) / 100;

      const outputBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas export failed.'));
        }, targetFormat, quality);
      });

      item.outputBlob = outputBlob;
      item.outputWidth = targetW;
      item.outputHeight = targetH;
      item.outputSize = outputBlob.size;
      item.outputUrl = URL.createObjectURL(outputBlob);
      item.status = 'converted';
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function processItem(item) {
    if (isCancelled) {
      item.status = 'skipped';
      return;
    }

    item.status = 'converting';
    render();

    activeConcurrency++;
    if (activeConcurrency > maxObservedConcurrency) {
      maxObservedConcurrency = activeConcurrency;
    }

    try {
      await decodeImageToCanvas(item);
    } catch (err) {
      item.status = 'failed';
      item.error = err.message || 'Conversion failed.';
    } finally {
      activeConcurrency--;
      render();
    }
  }

  async function processBatch() {
    if (isProcessing) return;
    isProcessing = true;
    isCancelled = false;
    setGlobalError('');
    batchStatus.textContent = 'Processing batch…';
    render();

    while (!isCancelled) {
      const queuedItems = items.filter(i => i.status === 'queued');
      if (queuedItems.length === 0 && activeConcurrency === 0) break;

      while (activeConcurrency < MAX_CONCURRENCY && queuedItems.length > 0 && !isCancelled) {
        const nextItem = queuedItems.shift();
        processItem(nextItem);
      }

      await new Promise(r => setTimeout(r, 50));
    }

    if (isCancelled) {
      items.forEach(i => {
        if (i.status === 'queued') i.status = 'skipped';
      });
      batchStatus.textContent = 'Batch processing cancelled.';
    } else {
      batchStatus.textContent = 'Batch processing finished.';
    }

    isProcessing = false;
    render();
  }


  // Event Listeners
  chooseBtn.addEventListener('click', () => imageFiles.click());
  imageFiles.addEventListener('change', e => addFiles(e.target.files));

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  });

  formatEl.addEventListener('change', updateQualityState);
  qualityEl.addEventListener('input', () => {
    qualityValueEl.textContent = `${qualityEl.value}%`;
  });

  convertBatchBtn.addEventListener('click', processBatch);
  cancelBtn.addEventListener('click', () => {
    isCancelled = true;
    batchStatus.textContent = 'Cancelling…';
  });
  clearBtn.addEventListener('click', clearAllItems);

  updateQualityState();
})();
