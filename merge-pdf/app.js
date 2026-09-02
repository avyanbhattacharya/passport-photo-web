(() => {
  const input = document.getElementById('pdfFiles');
  const dropzone = document.getElementById('dropzone');
  const filesCard = document.getElementById('filesCard');
  const fileList = document.getElementById('fileList');
  const summary = document.getElementById('summary');
  const addMore = document.getElementById('addMore');
  const mergeBtn = document.getElementById('mergeBtn');
  const status = document.getElementById('status');
  const errorBox = document.getElementById('error');
  const result = document.getElementById('result');
  const resultText = document.getElementById('resultText');
  const downloadBtn = document.getElementById('downloadBtn');

  let files = [];
  let downloadUrl = null;

  const formatBytes = bytes => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  async function inspectFile(file) {
    if (!window.PDFLib) throw new Error('The PDF library could not be loaded. Check your connection and try again.');
    const bytes = await file.arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: false });
    return { file, pages: doc.getPageCount() };
  }

  async function addFiles(fileListLike) {
    clearError();
    result.hidden = true;
    status.textContent = '';
    const incoming = Array.from(fileListLike).filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (!incoming.length) {
      showError('Please choose PDF files.');
      return;
    }

    try {
      status.textContent = 'Reading PDFs…';
      const inspected = [];
      for (const file of incoming) inspected.push(await inspectFile(file));
      files.push(...inspected);
      renderFiles();
      status.textContent = '';
    } catch (error) {
      status.textContent = '';
      const message = /encrypt|password/i.test(String(error?.message || error))
        ? 'Password-protected PDFs are not supported yet. Unlock the PDF first and try again.'
        : 'One of the PDFs could not be read. Please make sure it is a valid PDF.';
      showError(message);
    } finally {
      input.value = '';
    }
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    [files[index], files[target]] = [files[target], files[index]];
    renderFiles();
  }

  function remove(index) {
    files.splice(index, 1);
    renderFiles();
    result.hidden = true;
  }

  function renderFiles() {
    filesCard.hidden = files.length === 0;
    fileList.innerHTML = '';
    let totalPages = 0;
    let totalBytes = 0;

    files.forEach((entry, index) => {
      totalPages += entry.pages;
      totalBytes += entry.file.size;
      const row = document.createElement('div');
      row.className = 'file-row';
      row.dataset.fileIndex = String(index);

      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = entry.file.name;
      const meta = document.createElement('div');
      meta.className = 'file-meta';
      meta.textContent = `${entry.pages} ${entry.pages === 1 ? 'page' : 'pages'} · ${formatBytes(entry.file.size)}`;
      info.append(name, meta);

      const actions = document.createElement('div');
      actions.className = 'file-actions';
      const up = document.createElement('button');
      up.type = 'button'; up.className = 'icon-btn'; up.textContent = '↑'; up.title = `Move ${entry.file.name} up`; up.setAttribute('aria-label', `Move ${entry.file.name} up`); up.disabled = index === 0;
      up.addEventListener('click', () => move(index, -1));
      const down = document.createElement('button');
      down.type = 'button'; down.className = 'icon-btn'; down.textContent = '↓'; down.title = `Move ${entry.file.name} down`; down.setAttribute('aria-label', `Move ${entry.file.name} down`); down.disabled = index === files.length - 1;
      down.addEventListener('click', () => move(index, 1));
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'icon-btn'; del.textContent = '×'; del.title = `Remove ${entry.file.name}`; del.setAttribute('aria-label', `Remove ${entry.file.name}`);
      del.addEventListener('click', () => remove(index));
      actions.append(up, down, del);
      row.append(info, actions);
      fileList.append(row);
    });

    summary.textContent = files.length ? `${files.length} ${files.length === 1 ? 'file' : 'files'} · ${totalPages} ${totalPages === 1 ? 'page' : 'pages'} · ${formatBytes(totalBytes)}` : '';
    mergeBtn.disabled = files.length < 2;
  }

  async function mergeFiles() {
    if (files.length < 2 || !window.PDFLib) return;
    clearError();
    result.hidden = true;
    mergeBtn.disabled = true;
    addMore.disabled = true;

    try {
      const merged = await PDFLib.PDFDocument.create();
      let pageTotal = 0;
      for (let i = 0; i < files.length; i++) {
        status.textContent = `Adding ${i + 1} of ${files.length}: ${files[i].file.name}`;
        const sourceBytes = await files[i].file.arrayBuffer();
        const source = await PDFLib.PDFDocument.load(sourceBytes, { ignoreEncryption: false });
        const indices = source.getPageIndices();
        const copied = await merged.copyPages(source, indices);
        copied.forEach(page => merged.addPage(page));
        pageTotal += copied.length;
      }

      status.textContent = 'Finishing merged PDF…';
      const output = await merged.save({ useObjectStreams: true });
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      const blob = new Blob([output], { type: 'application/pdf' });
      downloadUrl = URL.createObjectURL(blob);
      downloadBtn.href = downloadUrl;
      downloadBtn.download = 'merged.pdf';
      resultText.textContent = `${files.length} PDFs combined into ${pageTotal} ${pageTotal === 1 ? 'page' : 'pages'} · ${formatBytes(blob.size)}`;
      result.hidden = false;
      status.textContent = '';
      result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      status.textContent = '';
      showError('The PDFs could not be merged. A damaged or password-protected file may be included.');
    } finally {
      addMore.disabled = false;
      mergeBtn.disabled = files.length < 2;
    }
  }

  input.addEventListener('change', event => addFiles(event.target.files));
  addMore.addEventListener('click', () => input.click());
  mergeBtn.addEventListener('click', mergeFiles);
  ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove('drag'); }));
  dropzone.addEventListener('drop', event => addFiles(event.dataTransfer.files));
})();