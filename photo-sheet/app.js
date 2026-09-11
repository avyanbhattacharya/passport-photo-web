(() => {
  const MAX_PHOTOS = 20;
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
  const MAX_PIXELS = 50 * 1024 * 1024; // 50 Megapixels

  const input = document.getElementById('imageFiles');
  const chooseBtn = document.getElementById('chooseBtn');
  const addMore = document.getElementById('addMore');
  const editor = document.getElementById('editor');
  const list = document.getElementById('list');
  const gridSelect = document.getElementById('gridSelect');
  const pageSize = document.getElementById('pageSize');
  const orientation = document.getElementById('orientation');
  const fitMode = document.getElementById('fitMode');
  const margin = document.getElementById('margin');
  const gap = document.getElementById('gap');
  const showCaptions = document.getElementById('showCaptions');
  const photoCount = document.getElementById('photoCount');
  const previewCanvas = document.getElementById('previewCanvas');
  const makePdf = document.getElementById('makePdf');
  const status = document.getElementById('status');
  const error = document.getElementById('error');
  const result = document.getElementById('result');
  const resultText = document.getElementById('resultText');
  const download = document.getElementById('download');

  let items = [];
  let downloadUrl = null;

  const formatBytes = bytes => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  function clearError() {
    error.textContent = '';
  }

  function showError(msg) {
    error.textContent = msg;
  }

  function getPageDimensions() {
    const isA4 = pageSize.value === 'a4';
    const isLandscape = orientation.value === 'landscape';
    let w = isA4 ? 595.28 : 612;
    let h = isA4 ? 841.89 : 792;
    if (isLandscape) {
      [w, h] = [h, w];
    }
    return { width: w, height: h };
  }

  function getGridColsRows() {
    const num = parseInt(gridSelect.value, 10);
    const isLandscape = orientation.value === 'landscape';
    if (num === 1) return { cols: 1, rows: 1 };
    if (num === 2) return isLandscape ? { cols: 2, rows: 1 } : { cols: 1, rows: 2 };
    if (num === 4) return { cols: 2, rows: 2 };
    if (num === 6) return isLandscape ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
    if (num === 9) return { cols: 3, rows: 3 };
    return { cols: 2, rows: 2 };
  }

  function getCapacity() {
    const { cols, rows } = getGridColsRows();
    return cols * rows;
  }

  function capacityErrorMessage() {
    const capacity = getCapacity();
    return `This layout holds up to ${capacity} photo${capacity === 1 ? '' : 's'} on one page. Remove photos or choose a larger grid before creating the PDF.`;
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (file.size > MAX_FILE_SIZE) {
        reject(new Error(`"${file.name}" exceeds the maximum file size limit of 25 MB.`));
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth * img.naturalHeight > MAX_PIXELS) {
          URL.revokeObjectURL(url);
          reject(new Error(`"${file.name}" exceeds the 50 Megapixel resolution limit.`));
          return;
        }
        resolve({
          id: Math.random().toString(36).substring(2, 9),
          file,
          img,
          url,
          width: img.naturalWidth,
          height: img.naturalHeight,
          caption: file.name.replace(/\.[^/.]+$/, "")
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`"${file.name}" could not be decoded as an image.`));
      };
      img.src = url;
    });
  }

  async function addFiles(filesLike) {
    clearError();
    const incoming = Array.from(filesLike).filter(f => /^image\/(jpeg|png|webp)$/i.test(f.type));
    if (!incoming.length) {
      showError('Please choose JPG, PNG or WebP images.');
      return;
    }

    if (items.length + incoming.length > MAX_PHOTOS) {
      showError(`Maximum ${MAX_PHOTOS} photos allowed per sheet. You can add at most ${MAX_PHOTOS - items.length} more.`);
      return;
    }

    try {
      status.textContent = 'Reading photos…';
      const decoded = [];
      for (const file of incoming) {
        decoded.push(await readImage(file));
      }
      items.push(...decoded);
      renderUI();
      status.textContent = '';
    } catch (err) {
      status.textContent = '';
      showError(err.message || 'One of the images could not be read.');
    } finally {
      input.value = '';
    }
  }

  function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    renderUI();
  }

  function remove(index) {
    URL.revokeObjectURL(items[index].url);
    items.splice(index, 1);
    renderUI();
    result.hidden = true;
  }

  function updateCaption(index, text) {
    items[index].caption = text;
    renderPreview();
  }

  function renderList() {
    photoCount.textContent = items.length;
    list.innerHTML = '';
    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.index = index;

      const thumb = document.createElement('img');
      thumb.className = 'thumb';
      thumb.src = item.url;
      thumb.alt = item.file.name;

      const infoCol = document.createElement('div');
      infoCol.className = 'info-col';

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = item.file.name;

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${item.width}×${item.height} · ${formatBytes(item.file.size)}`;

      const capInput = document.createElement('input');
      capInput.type = 'text';
      capInput.className = 'caption-input';
      capInput.placeholder = 'Optional caption';
      capInput.value = item.caption;
      capInput.setAttribute('aria-label', `Caption for ${item.file.name}`);
      capInput.addEventListener('input', e => updateCaption(index, e.target.value));

      infoCol.append(name, meta, capInput);

      const actions = document.createElement('div');
      actions.className = 'actions';

      const upBtn = document.createElement('button');
      upBtn.className = 'icon';
      upBtn.type = 'button';
      upBtn.textContent = '↑';
      upBtn.title = 'Move up';
      upBtn.ariaLabel = `Move ${item.file.name} up`;
      upBtn.disabled = index === 0;
      upBtn.addEventListener('click', () => move(index, -1));

      const downBtn = document.createElement('button');
      downBtn.className = 'icon';
      downBtn.type = 'button';
      downBtn.textContent = '↓';
      downBtn.title = 'Move down';
      downBtn.ariaLabel = `Move ${item.file.name} down`;
      downBtn.disabled = index === items.length - 1;
      downBtn.addEventListener('click', () => move(index, 1));

      const delBtn = document.createElement('button');
      delBtn.className = 'icon';
      delBtn.type = 'button';
      delBtn.textContent = '×';
      delBtn.title = 'Remove';
      delBtn.ariaLabel = `Remove ${item.file.name}`;
      delBtn.addEventListener('click', () => remove(index));

      actions.append(upBtn, downBtn, delBtn);
      row.append(thumb, infoCol, actions);
      list.appendChild(row);
    });
  }

  function renderPreview() {
    if (!items.length) {
      const ctx = previewCanvas.getContext('2d');
      previewCanvas.width = 300;
      previewCanvas.height = 400;
      ctx.clearRect(0, 0, 300, 400);
      return;
    }

    const pageDim = getPageDimensions();
    const scaleFactor = 0.8; // preview scale for crisp rendering
    const canvasWidth = pageDim.width * scaleFactor;
    const canvasHeight = pageDim.height * scaleFactor;

    previewCanvas.width = canvasWidth;
    previewCanvas.height = canvasHeight;

    const ctx = previewCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const marginPt = parseFloat(margin.value) * scaleFactor;
    const gapPt = parseFloat(gap.value) * scaleFactor;
    const captionsOn = showCaptions.checked;

    const { cols, rows } = getGridColsRows();
    const capacity = cols * rows;

    const availW = canvasWidth - 2 * marginPt - (cols - 1) * gapPt;
    const availH = canvasHeight - 2 * marginPt - (rows - 1) * gapPt;

    const cellW = availW / cols;
    const cellH = availH / rows;

    const captionHeight = captionsOn ? Math.min(18 * scaleFactor, cellH * 0.2) : 0;
    const photoBoxH = cellH - captionHeight;

    for (let i = 0; i < Math.min(items.length, capacity); i++) {
      const colIndex = i % cols;
      const rowIndex = Math.floor(i / cols);

      const cellX = marginPt + colIndex * (cellW + gapPt);
      const cellY = marginPt + rowIndex * (cellH + gapPt);

      // Draw cell outline in light grey
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, cellY, cellW, cellH);

      const item = items[i];
      const imgRatio = item.width / item.height;
      const boxRatio = cellW / photoBoxH;

      let drawX, drawY, drawW, drawH;

      if (fitMode.value === 'crop') {
        // Crop / Fill cell photo area while centering
        let sx = 0, sy = 0, sw = item.width, sh = item.height;
        if (imgRatio > boxRatio) {
          sw = item.height * boxRatio;
          sx = (item.width - sw) / 2;
        } else {
          sh = item.width / boxRatio;
          sy = (item.height - sh) / 2;
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(cellX, cellY, cellW, photoBoxH);
        ctx.clip();
        ctx.drawImage(item.img, sx, sy, sw, sh, cellX, cellY, cellW, photoBoxH);
        ctx.restore();
      } else {
        // Fit / Contain photo in photo area preserving aspect ratio
        if (imgRatio > boxRatio) {
          drawW = cellW;
          drawH = cellW / imgRatio;
        } else {
          drawH = photoBoxH;
          drawW = photoBoxH * imgRatio;
        }
        drawX = cellX + (cellW - drawW) / 2;
        drawY = cellY + (photoBoxH - drawH) / 2;

        ctx.drawImage(item.img, drawX, drawY, drawW, drawH);
      }

      if (captionsOn) {
        const textY = cellY + photoBoxH + captionHeight / 2;
        ctx.fillStyle = '#202124';
        ctx.font = `${Math.max(9, Math.floor(10 * scaleFactor))}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = item.caption || item.file.name;

        // Truncate text if needed
        let truncText = text;
        while (truncText.length > 0 && ctx.measureText(truncText + '…').width > cellW - 4) {
          truncText = truncText.slice(0, -1);
        }
        ctx.fillText(truncText !== text ? truncText + '…' : text, cellX + cellW / 2, textY);
      }
    }
  }

  function renderUI() {
    editor.hidden = items.length === 0;
    const hasTooManyPhotos = items.length > getCapacity();
    makePdf.disabled = items.length === 0 || hasTooManyPhotos;
    if (hasTooManyPhotos) {
      showError(capacityErrorMessage());
    } else if (error.textContent.startsWith('This layout holds up to ')) {
      clearError();
    }
    renderList();
    renderPreview();
  }

  function imageToJpegBytes(item, isCrop, boxW, boxH) {
    const canvas = document.createElement('canvas');
    if (isCrop) {
      canvas.width = Math.round(boxW * 2); // 2x density for print resolution
      canvas.height = Math.round(boxH * 2);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const imgRatio = item.width / item.height;
      const boxRatio = boxW / boxH;
      let sx = 0, sy = 0, sw = item.width, sh = item.height;
      if (imgRatio > boxRatio) {
        sw = item.height * boxRatio;
        sx = (item.width - sw) / 2;
      } else {
        sh = item.width / boxRatio;
        sy = (item.height - sh) / 2;
      }
      ctx.drawImage(item.img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    } else {
      canvas.width = item.width;
      canvas.height = item.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(item.img, 0, 0);
    }
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    return Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
  }

  async function createPdf() {
    if (!items.length) return;
    if (items.length > getCapacity()) {
      showError(capacityErrorMessage());
      makePdf.disabled = true;
      return;
    }
    if (!window.PDFLib) {
      showError('The PDF library could not be loaded. Check your connection and try again.');
      return;
    }

    clearError();
    makePdf.disabled = true;
    addMore.disabled = true;
    result.hidden = true;

    try {
      status.textContent = 'Generating Photo Sheet PDF…';
      const pdf = await PDFLib.PDFDocument.create();
      const pageDim = getPageDimensions();
      const page = pdf.addPage([pageDim.width, pageDim.height]);

      const marginPt = parseFloat(margin.value);
      const gapPt = parseFloat(gap.value);
      const captionsOn = showCaptions.checked;

      const { cols, rows } = getGridColsRows();
      const capacity = cols * rows;
      const totalPhotos = items.length;

      const availW = pageDim.width - 2 * marginPt - (cols - 1) * gapPt;
      const availH = pageDim.height - 2 * marginPt - (rows - 1) * gapPt;

      const cellW = availW / cols;
      const cellH = availH / rows;

      const captionHeight = captionsOn ? Math.min(18, cellH * 0.2) : 0;
      const photoBoxH = cellH - captionHeight;

      const isCropMode = fitMode.value === 'crop';
      const standardFont = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);

      for (let i = 0; i < totalPhotos; i++) {
        status.textContent = `Adding photo ${i + 1} of ${totalPhotos}…`;
        const item = items[i];

        const jpgBytes = imageToJpegBytes(item, isCropMode, cellW, photoBoxH);
        const jpg = await pdf.embedJpg(jpgBytes);

        const colIndex = i % cols;
        const rowIndex = Math.floor(i / cols);

        const cellX = marginPt + colIndex * (cellW + gapPt);
        // Note: PDF coordinate system origin (0,0) is bottom-left
        const cellY = pageDim.height - marginPt - (rowIndex + 1) * cellH + gapPt * 0; // standard cell top-left down

        const photoY = cellY + captionHeight;

        let drawX, drawY, drawW, drawH;

        if (isCropMode) {
          drawX = cellX;
          drawY = photoY;
          drawW = cellW;
          drawH = photoBoxH;
        } else {
          const imgRatio = item.width / item.height;
          const boxRatio = cellW / photoBoxH;

          if (imgRatio > boxRatio) {
            drawW = cellW;
            drawH = cellW / imgRatio;
          } else {
            drawH = photoBoxH;
            drawW = photoBoxH * imgRatio;
          }
          drawX = cellX + (cellW - drawW) / 2;
          drawY = photoY + (photoBoxH - drawH) / 2;
        }

        page.drawImage(jpg, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH
        });

        if (captionsOn) {
          const text = item.caption || item.file.name;
          const fontSize = Math.min(10, Math.max(7, captionHeight * 0.6));
          let truncText = text;
          while (truncText.length > 0 && standardFont.widthOfTextAtSize(truncText + '…', fontSize) > cellW - 4) {
            truncText = truncText.slice(0, -1);
          }
          const finalText = truncText !== text ? truncText + '…' : text;
          const textWidth = standardFont.widthOfTextAtSize(finalText, fontSize);
          const textX = cellX + (cellW - textWidth) / 2;
          const textY = cellY + (captionHeight - fontSize) / 2 + 2;

          page.drawText(finalText, {
            x: textX,
            y: textY,
            size: fontSize,
            font: standardFont,
            color: PDFLib.rgb(0.12, 0.13, 0.14)
          });
        }
      }

      status.textContent = 'Finishing PDF…';
      const bytes = await pdf.save({ useObjectStreams: true });

      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      downloadUrl = URL.createObjectURL(blob);
      download.href = downloadUrl;
      download.download = 'photo-sheet.pdf';

      resultText.textContent = `1 page · ${totalPhotos} ${totalPhotos === 1 ? 'photo' : 'photos'} · ${formatBytes(blob.size)}`;
      result.hidden = false;
      status.textContent = '';
    } catch (e) {
      status.textContent = '';
      showError('The PDF could not be created. Try smaller photos or fewer files.');
    } finally {
      makePdf.disabled = items.length === 0 || items.length > getCapacity();
      addMore.disabled = false;
    }
  }

  // Event Listeners
  chooseBtn.addEventListener('click', () => input.click());
  addMore.addEventListener('click', () => input.click());
  input.addEventListener('change', e => addFiles(e.target.files));
  makePdf.addEventListener('click', createPdf);

  [gridSelect, pageSize, orientation, fitMode, margin, gap, showCaptions].forEach(ctrl => {
    ctrl.addEventListener('change', renderUI);
  });
})();
