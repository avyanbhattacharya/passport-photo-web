(() => {
  const input = document.getElementById('imageFiles');
  const chooseBtn = document.getElementById('chooseBtn');
  const addMore = document.getElementById('addMore');
  const editor = document.getElementById('editor');
  const list = document.getElementById('list');
  const makePdf = document.getElementById('makePdf');
  const pageSize = document.getElementById('pageSize');
  const margin = document.getElementById('margin');
  const status = document.getElementById('status');
  const error = document.getElementById('error');
  const result = document.getElementById('result');
  const resultText = document.getElementById('resultText');
  const download = document.getElementById('download');

  let items = [];
  let downloadUrl = null;

  const formatBytes = bytes => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  function clearError() { error.textContent = ''; }
  function showError(message) { error.textContent = message; }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ file, img, url, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  async function addFiles(filesLike) {
    clearError();
    const incoming = Array.from(filesLike).filter(f => /^image\/(jpeg|png|webp)$/i.test(f.type));
    if (!incoming.length) { showError('Please choose JPG, PNG or WebP images.'); return; }
    try {
      status.textContent = 'Reading images…';
      const decoded = [];
      for (const file of incoming) decoded.push(await readImage(file));
      items.push(...decoded);
      render();
      status.textContent = '';
    } catch {
      status.textContent = '';
      showError('One of the images could not be read.');
    } finally {
      input.value = '';
    }
  }

  function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    render();
  }

  function remove(index) {
    URL.revokeObjectURL(items[index].url);
    items.splice(index, 1);
    render();
    result.hidden = true;
  }

  function render() {
    editor.hidden = items.length === 0;
    list.innerHTML = '';
    items.forEach((item, index) => {
      const row = document.createElement('div'); row.className = 'row'; row.dataset.index = index;
      const thumb = document.createElement('img'); thumb.className = 'thumb'; thumb.src = item.url; thumb.alt = '';
      const info = document.createElement('div');
      const name = document.createElement('div'); name.className = 'name'; name.textContent = item.file.name;
      const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${item.width}×${item.height} · ${formatBytes(item.file.size)}`;
      info.append(name, meta);
      const actions = document.createElement('div'); actions.className = 'actions';
      [['↑', -1, 'Move up'], ['↓', 1, 'Move down']].forEach(([label, dir, title]) => {
        const b = document.createElement('button'); b.className = 'icon'; b.type = 'button'; b.textContent = label; b.title = title; b.disabled = dir < 0 ? index === 0 : index === items.length - 1; b.addEventListener('click', () => move(index, dir)); actions.appendChild(b);
      });
      const del = document.createElement('button'); del.className = 'icon'; del.type = 'button'; del.textContent = '×'; del.title = 'Remove'; del.addEventListener('click', () => remove(index)); actions.appendChild(del);
      row.append(thumb, info, actions); list.appendChild(row);
    });
  }

  function imageToJpegBytes(item) {
    const canvas = document.createElement('canvas');
    canvas.width = item.width; canvas.height = item.height;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(item.img, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    return Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
  }

  async function createPdf() {
    if (!items.length) return;
    if (!window.PDFLib) { showError('The PDF library could not be loaded. Check your connection and try again.'); return; }
    clearError(); makePdf.disabled = true; addMore.disabled = true; result.hidden = true;
    try {
      const pdf = await PDFLib.PDFDocument.create();
      const normalMargin = Number(margin.value);
      for (let i = 0; i < items.length; i++) {
        status.textContent = `Adding image ${i + 1} of ${items.length}…`;
        const item = items[i];
        const jpg = await pdf.embedJpg(imageToJpegBytes(item));
        let size;
        if (pageSize.value === 'a4') size = [595.28, 841.89];
        else if (pageSize.value === 'letter') size = [612, 792];
        else size = [Math.max(72, item.width), Math.max(72, item.height)];
        if (item.width > item.height && pageSize.value !== 'image') size = [size[1], size[0]];
        const page = pdf.addPage(size);
        const m = Math.min(normalMargin, size[0] / 4, size[1] / 4);
        const scale = Math.min((size[0] - 2 * m) / jpg.width, (size[1] - 2 * m) / jpg.height);
        const w = jpg.width * scale, h = jpg.height * scale;
        page.drawImage(jpg, { x: (size[0] - w) / 2, y: (size[1] - h) / 2, width: w, height: h });
      }
      status.textContent = 'Finishing PDF…';
      const bytes = await pdf.save({ useObjectStreams: true });
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      downloadUrl = URL.createObjectURL(blob); download.href = downloadUrl; download.download = 'images.pdf';
      resultText.textContent = `${items.length} ${items.length === 1 ? 'image' : 'images'} · ${formatBytes(blob.size)}`;
      result.hidden = false; status.textContent = '';
    } catch (e) {
      status.textContent = ''; showError('The PDF could not be created. Try smaller images or fewer files.');
    } finally { makePdf.disabled = false; addMore.disabled = false; }
  }

  chooseBtn.addEventListener('click', () => input.click());
  addMore.addEventListener('click', () => input.click());
  input.addEventListener('change', e => addFiles(e.target.files));
  makePdf.addEventListener('click', createPdf);
})();