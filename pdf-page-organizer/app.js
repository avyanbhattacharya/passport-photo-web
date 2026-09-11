const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_PAGE_COUNT = 500;

const $ = (id) => document.getElementById(id);

let currentFile = null;
let sourceBytes = null;
let pdfLibDoc = null;
let pages = [];
let nextId = 1;
let exportUrl = null;
const thumbCache = new Map();

function showError(msg) {
  const errEl = $('error');
  errEl.textContent = msg;
  errEl.hidden = !msg;
}

function clearError() {
  showError('');
}

function setStatus(msg) {
  $('status').textContent = msg;
}

function revokeExportUrl() {
  if (exportUrl) {
    URL.revokeObjectURL(exportUrl);
    exportUrl = null;
  }
}

async function renderThumbnailCanvas(srcIndex) {
  if (thumbCache.has(srcIndex)) return thumbCache.get(srcIndex);

  // Page content stays local. Without an additional renderer, use a numbered
  // placeholder rather than loading a second PDF runtime or worker.
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f1f3f4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#dadce0';
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  ctx.fillStyle = '#5f6368';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Page ' + (srcIndex + 1), canvas.width / 2, canvas.height / 2);
  thumbCache.set(srcIndex, canvas);
  return canvas;
}

async function loadFile(file) {
  if (!file) return;
  clearError();
  $('resultCard').hidden = true;

  if (file.size > MAX_FILE_SIZE) {
    showError('File size exceeds the limit of 100 MB. Please select a smaller PDF file.');
    return;
  }

  if (!window.PDFLib) {
    showError('The PDF processing library could not be loaded. Please check your connection.');
    return;
  }

  setStatus('Reading PDF document…');

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: false });
    const totalPages = doc.getPageCount();

    if (totalPages > MAX_PAGE_COUNT) {
      setStatus('');
      showError(`Document page count (${totalPages}) exceeds the supported limit of ${MAX_PAGE_COUNT} pages.`);
      return;
    }

    // Reset cache and state for new document
    thumbCache.clear();
    revokeExportUrl();
    currentFile = file;
    sourceBytes = bytes;
    pdfLibDoc = doc;
    pages = [];

    for (let i = 0; i < totalPages; i++) {
      const origRot = doc.getPage(i).getRotation().angle || 0;
      pages.push({
        id: 'p_' + (nextId++),
        srcIndex: i,
        originalRotation: origRot,
        userRotation: 0,
        selected: false
      });
    }

    $('uploadCard').hidden = true;
    $('editorCard').hidden = false;
    setStatus(`Loaded ${file.name} (${totalPages} page${totalPages === 1 ? '' : 's'}).`);
    renderWorkspace();
  } catch (err) {
    console.error('PDF Load Error:', err);
    setStatus('');
    const errMsg = String(err?.message || err);
    if (/encrypt|password/i.test(errMsg)) {
      showError('Password-protected or encrypted PDFs are not supported. Please unlock the PDF before importing.');
    } else {
      showError('Could not open this PDF file. It may be corrupted or in an unsupported format.');
    }
  } finally {
    $('pdfFile').value = '';
  }
}

function renderWorkspace() {
  const pagesEl = $('pages');
  pagesEl.innerHTML = '';

  const total = pages.length;
  const selectedCount = pages.filter((p) => p.selected).length;

  $('summary').textContent = `${total} page${total === 1 ? '' : 's'}${selectedCount > 0 ? ` · ${selectedCount} selected` : ''}`;

  $('rotateLeftSelected').disabled = selectedCount === 0;
  $('rotateRightSelected').disabled = selectedCount === 0;
  $('duplicateSelected').disabled = selectedCount === 0;
  $('deleteSelected').disabled = selectedCount === 0;

  $('exportBtn').disabled = total === 0;

  if (total === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'error';
    emptyMsg.style.gridColumn = '1 / -1';
    emptyMsg.textContent = 'All pages have been deleted. Add pages or import another PDF before exporting.';
    pagesEl.appendChild(emptyMsg);
    return;
  }

  pages.forEach((pageObj, index) => {
    const card = document.createElement('article');
    card.className = `page-card${pageObj.selected ? ' selected' : ''}`;
    card.dataset.id = pageObj.id;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', `Page ${index + 1} of ${total}`);

    // Header
    const header = document.createElement('div');
    header.className = 'page-header';

    const selectLabel = document.createElement('label');
    selectLabel.className = 'page-select-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = pageObj.selected;
    checkbox.setAttribute('aria-label', `Select Page ${index + 1}`);
    checkbox.addEventListener('change', (e) => {
      pageObj.selected = e.target.checked;
      renderWorkspace();
      const cardEl = document.querySelector(`.page-card[data-id="${pageObj.id}"]`);
      if (cardEl) {
        const cb = cardEl.querySelector('input[type="checkbox"]');
        if (cb) cb.focus();
      }
    });

    const pageNumText = document.createElement('span');
    pageNumText.textContent = `Page ${index + 1}`;

    selectLabel.append(checkbox, pageNumText);
    header.appendChild(selectLabel);

    const netRotation = (pageObj.userRotation + 360) % 360;
    if (netRotation !== 0) {
      const badge = document.createElement('span');
      badge.className = 'rotation-badge';
      badge.textContent = `${netRotation}°`;
      header.appendChild(badge);
    }

    // Thumbnail
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'thumb-wrap';

    renderThumbnailCanvas(pageObj.srcIndex).then((canvas) => {
      if (canvas && thumbWrap.isConnected) {
        const clonedCanvas = document.createElement('canvas');
        clonedCanvas.width = canvas.width;
        clonedCanvas.height = canvas.height;
        const ctx = clonedCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0);

        if (pageObj.userRotation !== 0) {
          clonedCanvas.style.transform = `rotate(${pageObj.userRotation}deg)`;
        }
        thumbWrap.innerHTML = '';
        thumbWrap.appendChild(clonedCanvas);
      }
    });

    // Actions
    const actions = document.createElement('div');
    actions.className = 'page-actions';

    const moveLeftBtn = document.createElement('button');
    moveLeftBtn.className = 'icon-btn';
    moveLeftBtn.type = 'button';
    moveLeftBtn.textContent = '←';
    moveLeftBtn.title = 'Move page left';
    moveLeftBtn.setAttribute('aria-label', `Move Page ${index + 1} left`);
    moveLeftBtn.disabled = index === 0;
    moveLeftBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      movePage(index, -1);
    });

    const moveRightBtn = document.createElement('button');
    moveRightBtn.className = 'icon-btn';
    moveRightBtn.type = 'button';
    moveRightBtn.textContent = '→';
    moveRightBtn.title = 'Move page right';
    moveRightBtn.setAttribute('aria-label', `Move Page ${index + 1} right`);
    moveRightBtn.disabled = index === total - 1;
    moveRightBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      movePage(index, 1);
    });

    const rotLeftBtn = document.createElement('button');
    rotLeftBtn.className = 'icon-btn';
    rotLeftBtn.type = 'button';
    rotLeftBtn.textContent = '⟲';
    rotLeftBtn.title = 'Rotate 90° counter-clockwise';
    rotLeftBtn.setAttribute('aria-label', `Rotate Page ${index + 1} left 90 degrees`);
    rotLeftBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      rotatePage(index, -90);
    });

    const rotRightBtn = document.createElement('button');
    rotRightBtn.className = 'icon-btn';
    rotRightBtn.type = 'button';
    rotRightBtn.textContent = '↻';
    rotRightBtn.title = 'Rotate 90° clockwise';
    rotRightBtn.setAttribute('aria-label', `Rotate Page ${index + 1} right 90 degrees`);
    rotRightBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      rotatePage(index, 90);
    });

    const dupBtn = document.createElement('button');
    dupBtn.className = 'icon-btn';
    dupBtn.type = 'button';
    dupBtn.textContent = '📋';
    dupBtn.title = 'Duplicate page';
    dupBtn.setAttribute('aria-label', `Duplicate Page ${index + 1}`);
    dupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      duplicatePage(index);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn danger';
    delBtn.type = 'button';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Delete page';
    delBtn.setAttribute('aria-label', `Delete Page ${index + 1}`);
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePage(index);
    });

    actions.append(moveLeftBtn, moveRightBtn, rotLeftBtn, rotRightBtn, dupBtn, delBtn);

    // Keydown handlers on page card for keyboard accessibility
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deletePage(index);
        return;
      }
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' && e.altKey && index > 0) {
        e.preventDefault();
        movePage(index, -1);
      } else if (e.key === 'ArrowRight' && e.altKey && index < total - 1) {
        e.preventDefault();
        movePage(index, 1);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        pageObj.selected = !pageObj.selected;
        renderWorkspace();
        const cardEl = document.querySelector(`.page-card[data-id="${pageObj.id}"]`);
        if (cardEl) cardEl.focus();
      }
    });

    card.append(header, thumbWrap, actions);
    pagesEl.appendChild(card);
  });
}

function movePage(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= pages.length) return;
  const temp = pages[index];
  pages[index] = pages[target];
  pages[target] = temp;
  renderWorkspace();
  setStatus(`Moved page ${index + 1} to position ${target + 1}.`);

  const card = document.querySelector(`.page-card[data-id="${temp.id}"]`);
  if (card) card.focus();
}

function rotatePage(index, deg) {
  if (index < 0 || index >= pages.length) return;
  pages[index].userRotation = (pages[index].userRotation + deg + 360) % 360;
  renderWorkspace();
  setStatus(`Rotated page ${index + 1} to ${pages[index].userRotation}°.`);
}

function rotateSelected(deg) {
  let count = 0;
  pages.forEach((p) => {
    if (p.selected) {
      p.userRotation = (p.userRotation + deg + 360) % 360;
      count++;
    }
  });
  if (count > 0) {
    renderWorkspace();
    setStatus(`Rotated ${count} selected page${count === 1 ? '' : 's'}.`);
  }
}

function duplicatePage(index) {
  if (index < 0 || index >= pages.length) return;
  const src = pages[index];
  const clone = {
    id: 'p_' + (nextId++),
    srcIndex: src.srcIndex,
    originalRotation: src.originalRotation,
    userRotation: src.userRotation,
    selected: false
  };
  pages.splice(index + 1, 0, clone);
  renderWorkspace();
  setStatus(`Duplicated page ${index + 1}. Total pages: ${pages.length}.`);
}

function duplicateSelected() {
  const newPages = [];
  let count = 0;
  pages.forEach((p) => {
    newPages.push(p);
    if (p.selected) {
      newPages.push({
        id: 'p_' + (nextId++),
        srcIndex: p.srcIndex,
        originalRotation: p.originalRotation,
        userRotation: p.userRotation,
        selected: false
      });
      count++;
    }
  });
  if (count > 0) {
    pages = newPages;
    renderWorkspace();
    setStatus(`Duplicated ${count} selected page${count === 1 ? '' : 's'}. Total pages: ${pages.length}.`);
  }
}

function deletePage(index) {
  if (index < 0 || index >= pages.length) return;
  pages.splice(index, 1);
  renderWorkspace();
  setStatus(`Deleted page ${index + 1}. ${pages.length} page${pages.length === 1 ? '' : 's'} remaining.`);
}

function deleteSelected() {
  const initialCount = pages.length;
  pages = pages.filter((p) => !p.selected);
  const deletedCount = initialCount - pages.length;
  if (deletedCount > 0) {
    renderWorkspace();
    setStatus(`Deleted ${deletedCount} selected page${deletedCount === 1 ? '' : 's'}. ${pages.length} page${pages.length === 1 ? '' : 's'} remaining.`);
  }
}

async function exportPdf() {
  if (pages.length === 0 || !pdfLibDoc) return;
  clearError();
  $('exportBtn').disabled = true;
  setStatus('Exporting new PDF…');

  try {
    const outDoc = await PDFLib.PDFDocument.create();

    for (const pageObj of pages) {
      const [copiedPage] = await outDoc.copyPages(pdfLibDoc, [pageObj.srcIndex]);
      const totalRotation = (pageObj.originalRotation + pageObj.userRotation + 360) % 360;
      copiedPage.setRotation(PDFLib.degrees(totalRotation));
      outDoc.addPage(copiedPage);
    }

    const exportedBytes = await outDoc.save({ useObjectStreams: true });
    revokeExportUrl();

    const blob = new Blob([exportedBytes], { type: 'application/pdf' });
    exportUrl = URL.createObjectURL(blob);

    const downloadBtn = $('downloadBtn');
    downloadBtn.href = exportUrl;
    const baseName = currentFile ? currentFile.name.replace(/\.pdf$/i, '') : 'document';
    downloadBtn.download = `${baseName}-organized.pdf`;

    $('resultText').textContent = `New PDF contains ${pages.length} page${pages.length === 1 ? '' : 's'} with specified order and rotations. Original file remains untouched.`;
    $('resultCard').hidden = false;
    setStatus('PDF export ready.');
    $('resultCard').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Export error:', err);
    setStatus('');
    showError('Could not export the PDF. Please try again.');
  } finally {
    $('exportBtn').disabled = pages.length === 0;
  }
}

// Event Listeners
$('pdfFile').addEventListener('change', (e) => {
  if (e.target.files?.[0]) loadFile(e.target.files[0]);
});

$('replacePdfBtn').addEventListener('click', () => {
  $('pdfFile').click();
});

const dropzone = $('dropzone');
['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.add('drag');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
  });
});

dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer?.files?.[0]) {
    loadFile(e.dataTransfer.files[0]);
  }
});

$('selectAllBtn').addEventListener('click', () => {
  pages.forEach((p) => { p.selected = true; });
  renderWorkspace();
});

$('clearSelectionBtn').addEventListener('click', () => {
  pages.forEach((p) => { p.selected = false; });
  renderWorkspace();
});

$('rotateLeftSelected').addEventListener('click', () => rotateSelected(-90));
$('rotateRightSelected').addEventListener('click', () => rotateSelected(90));
$('duplicateSelected').addEventListener('click', duplicateSelected);
$('deleteSelected').addEventListener('click', deleteSelected);

$('exportBtn').addEventListener('click', exportPdf);
