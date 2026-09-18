'use strict';

const MAX_BYTES = 5 * 1024 * 1024;
const SAMPLE_CSV = `Date,Category,Merchant,Amount
2026-07-03,Food,Market,18.50
2026-07-08,Travel,Metro,20.00
2026-07-12,Food,Cafe,16.50
2026-08-02,Food,Market,25.00
2026-08-12,Home,Hardware,42.00
2026-08-12,Home,Hardware,42.00
2026-08-18,Food,Market,31.00
2026-08-20,Travel,Metro,20.00
2026-08-23,Food,Cafe,
2026-08-29,Food,Market,250.00`;

const ui = {
  input: document.querySelector('#csvFile'),
  importPanel: document.querySelector('#importPanel'),
  dataPanel: document.querySelector('#dataPanel'),
  sample: document.querySelector('#sampleButton'),
  replace: document.querySelector('#replaceButton'),
  status: document.querySelector('#importStatus'),
  datasetName: document.querySelector('#datasetName'),
  profile: document.querySelector('#profileCards'),
  previewHead: document.querySelector('#previewHead'),
  previewBody: document.querySelector('#previewBody'),
  previewCount: document.querySelector('#previewCount'),
  askForm: document.querySelector('#askForm'),
  question: document.querySelector('#questionInput'),
  questionHelp: document.querySelector('#questionHelp'),
  resultsTitle: document.querySelector('#results-title'),
  resultBody: document.querySelector('#resultBody'),
  download: document.querySelector('#downloadReport'),
  analysisButtons: [...document.querySelectorAll('[data-analysis]')]
};

let dataset = null;
let latestReport = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);
}

function cleanHeader(value, index) {
  const header = String(value || '').trim().replace(/^\uFEFF/, '');
  return header || `Column ${index + 1}`;
}

function uniqueHeaders(headers) {
  const used = new Map();
  return headers.map((header, index) => {
    const base = cleanHeader(header, index);
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base} ${count}`;
  });
}

function createParserWorker() {
  const workerSource = `self.onmessage=event=>{const{text,delimiter}=event.data;const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const char=text[i],next=text[i+1];if(char==='"'){if(quoted&&next==='"'){cell+='"';i++;}else quoted=!quoted;}else if(char===delimiter&&!quoted){row.push(cell);cell='';}else if((char==='\\n'||char==='\\r')&&!quoted){if(char==='\\r'&&next==='\\n')i++;row.push(cell);if(row.some(value=>value.trim()!==''))rows.push(row);row=[];cell='';}else cell+=char;}row.push(cell);if(row.some(value=>value.trim()!==''))rows.push(row);self.postMessage({rows});};`;
  return new Worker(URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' })));
}

function parseCsv(text, delimiter) {
  return new Promise((resolve, reject) => {
    const worker = createParserWorker();
    const finish = () => { worker.terminate(); };
    worker.onmessage = event => { finish(); resolve(event.data.rows); };
    worker.onerror = error => { finish(); reject(error); };
    worker.postMessage({ text, delimiter });
  });
}

function detectDelimiter(text, name = '') {
  if (/\.tsv$/i.test(name)) return '\t';
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  return firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ',';
}

function parseNumber(value) {
  const normalized = String(value ?? '').trim().replace(/[$,£€\s]/g, '').replace(/^\((.+)\)$/, '-$1');
  if (!normalized || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseDate(value) {
  const text = String(value ?? '').trim();
  if (!text || !/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(text)) return null;
  const date = new Date(`${text.replace(/\//g, '-')}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function columnType(values) {
  const nonblank = values.filter(value => String(value ?? '').trim() !== '');
  if (!nonblank.length) return 'empty';
  const numeric = nonblank.filter(value => parseNumber(value) !== null).length;
  const dates = nonblank.filter(value => parseDate(value) !== null).length;
  if (numeric / nonblank.length >= .9) return 'number';
  if (dates / nonblank.length >= .9) return 'date';
  return 'text';
}

function analyzeRows(rawRows, name) {
  if (rawRows.length < 2) throw new Error('This file needs a header row and at least one data row.');
  const headers = uniqueHeaders(rawRows[0]);
  if (headers.length > 40) throw new Error('This file has more than 40 columns. Please use a smaller export.');
  const rows = rawRows.slice(1, 50001).map(values => Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? '').trim()])));
  if (!rows.length) throw new Error('This file has no data rows.');
  const columns = headers.map(header => {
    const values = rows.map(row => row[header]);
    return { name: header, type: columnType(values), blankCount: values.filter(value => !value).length, uniqueCount: new Set(values.filter(Boolean)).size };
  });
  return { name, headers, rows, columns, truncated: rawRows.length - 1 > rows.length };
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function moneyOrNumber(value, column) {
  const currencyLike = /amount|cost|price|spend|revenue|total|balance|sales|income|expense/i.test(column || '');
  if (currencyLike) return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
  return formatNumber(value);
}

function findColumn(type, preferred = []) {
  if (!dataset) return null;
  return dataset.columns.find(column => column.type === type && preferred.some(word => column.name.toLowerCase().includes(word)))
    || dataset.columns.find(column => column.type === type)
    || null;
}

function renderProfile() {
  const blanks = dataset.columns.reduce((total, column) => total + column.blankCount, 0);
  const cards = [
    [formatNumber(dataset.rows.length), 'rows'],
    [formatNumber(dataset.headers.length), 'columns'],
    [formatNumber(blanks), 'blank cells'],
    [dataset.truncated ? '50,000+' : 'ready', dataset.truncated ? 'first 50,000 rows loaded' : 'local analysis ready']
  ];
  ui.profile.innerHTML = cards.map(([value, label]) => `<div class="sheetlocal-profile-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('');
}

function renderPreview() {
  ui.previewHead.innerHTML = `<tr>${dataset.headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr>`;
  ui.previewBody.innerHTML = dataset.rows.slice(0, 12).map(row => `<tr>${dataset.headers.map(header => `<td title="${escapeHtml(row[header])}">${escapeHtml(row[header])}</td>`).join('')}</tr>`).join('');
  ui.previewCount.textContent = `Showing 12 of ${formatNumber(dataset.rows.length)} rows`;
}

function evidence(entries) {
  return `<div class="sheetlocal-evidence">${entries.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>`;
}

function table(headers, rows) {
  return `<div class="sheetlocal-table-wrap"><table class="sheetlocal-result-table"><thead><tr>${headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function overview() {
  const types = dataset.columns.reduce((summary, column) => { summary[column.type] = (summary[column.type] || 0) + 1; return summary; }, {});
  const blanks = dataset.columns.reduce((total, column) => total + column.blankCount, 0);
  return {
    title: 'Spreadsheet overview',
    summary: `This file has ${formatNumber(dataset.rows.length)} rows and ${dataset.headers.length} columns. ${blanks ? `${formatNumber(blanks)} cells are blank.` : 'No blank cells were found.'}`,
    evidence: [['Rows', formatNumber(dataset.rows.length)], ['Columns', formatNumber(dataset.headers.length)], ['Number columns', formatNumber(types.number || 0)], ['Date columns', formatNumber(types.date || 0)]],
    details: table(['Column', 'Detected type', 'Blank cells', 'Unique values'], dataset.columns.map(column => [column.name, column.type, formatNumber(column.blankCount), formatNumber(column.uniqueCount)]))
  };
}

function topCategories() {
  const category = findColumn('text', ['category', 'type', 'group', 'merchant', 'vendor']);
  const amount = findColumn('number', ['amount', 'cost', 'price', 'spend', 'revenue', 'total', 'sales', 'income', 'expense']);
  if (!category || !amount) return unavailable('Top categories needs one text/category column and one numeric amount column.');
  const grouped = new Map();
  for (const row of dataset.rows) {
    const label = row[category.name]; const value = parseNumber(row[amount.name]);
    if (!label || value === null) continue;
    grouped.set(label, (grouped.get(label) || 0) + value);
  }
  const values = [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!values.length) return unavailable('No usable category and amount pairs were found.');
  return { title: 'Top categories', summary: `${values[0][0]} is the largest category at ${moneyOrNumber(values[0][1], amount.name)}.`, evidence: [['Grouped by', category.name], ['Measured by', amount.name], ['Rows included', formatNumber(dataset.rows.filter(row => row[category.name] && parseNumber(row[amount.name]) !== null).length)]], details: table([category.name, `Total ${amount.name}`], values.map(([label, value]) => [label, moneyOrNumber(value, amount.name)])) };
}

function comparePeriods() {
  const date = findColumn('date', ['date', 'month', 'period']);
  const amount = findColumn('number', ['amount', 'cost', 'price', 'spend', 'revenue', 'total', 'sales', 'income', 'expense']);
  if (!date || !amount) return unavailable('Compare periods needs a YYYY-MM-DD date column and a numeric amount column.');
  const totals = new Map();
  for (const row of dataset.rows) {
    const parsedDate = parseDate(row[date.name]); const value = parseNumber(row[amount.name]);
    if (!parsedDate || value === null) continue;
    const period = parsedDate.toISOString().slice(0, 7);
    totals.set(period, (totals.get(period) || 0) + value);
  }
  const values = [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (values.length < 2) return unavailable('At least two periods with dates and amounts are needed for a comparison.');
  const [previousPeriod, previousValue] = values[values.length - 2];
  const [latestPeriod, latestValue] = values[values.length - 1];
  const difference = latestValue - previousValue;
  const percent = previousValue === 0 ? null : (difference / Math.abs(previousValue)) * 100;
  return { title: 'Compare periods', summary: `${latestPeriod} is ${difference >= 0 ? 'higher' : 'lower'} than ${previousPeriod} by ${moneyOrNumber(Math.abs(difference), amount.name)}${percent === null ? '' : ` (${formatNumber(Math.abs(percent))}%)`}.`, evidence: [['Date column', date.name], ['Measured by', amount.name], ['Latest period', latestPeriod]], details: table(['Period', `Total ${amount.name}`], values.map(([period, value]) => [period, moneyOrNumber(value, amount.name)])) };
}

function duplicateRows() {
  const seen = new Map();
  for (const row of dataset.rows) {
    const key = dataset.headers.map(header => row[header]).join('\u001f');
    const entry = seen.get(key) || { row, count: 0 };
    entry.count += 1; seen.set(key, entry);
  }
  const duplicates = [...seen.values()].filter(entry => entry.count > 1).sort((a, b) => b.count - a.count);
  const duplicateCount = duplicates.reduce((total, entry) => total + entry.count - 1, 0);
  return { title: 'Duplicate rows', summary: duplicateCount ? `Found ${formatNumber(duplicateCount)} repeated row${duplicateCount === 1 ? '' : 's'} across ${duplicates.length} matching groups.` : 'No exact duplicate rows were found.', evidence: [['Matching rule', 'Every column matches'], ['Duplicate groups', formatNumber(duplicates.length)], ['Repeated rows', formatNumber(duplicateCount)]], details: duplicates.length ? table(['Repeats', ...dataset.headers.slice(0, 4)], duplicates.slice(0, 8).map(entry => [entry.count, ...dataset.headers.slice(0, 4).map(header => entry.row[header])])) : '' };
}

function unusualValues() {
  const amount = findColumn('number', ['amount', 'cost', 'price', 'spend', 'revenue', 'total', 'sales', 'income', 'expense']);
  if (!amount) return unavailable('Unusual values needs a numeric column.');
  const values = dataset.rows.map((row, index) => ({ row, index, value: parseNumber(row[amount.name]) })).filter(item => item.value !== null).sort((a, b) => a.value - b.value);
  if (values.length < 4) return unavailable('At least four numeric values are needed to find unusual values.');
  const quantile = fraction => values[Math.floor((values.length - 1) * fraction)].value;
  const q1 = quantile(.25), q3 = quantile(.75), iqr = q3 - q1, high = q3 + (iqr * 1.5), low = q1 - (iqr * 1.5);
  const outliers = values.filter(item => item.value > high || item.value < low).sort((a, b) => b.value - a.value);
  return { title: 'Unusual values', summary: outliers.length ? `Found ${outliers.length} value${outliers.length === 1 ? '' : 's'} outside the typical range of ${moneyOrNumber(low, amount.name)} to ${moneyOrNumber(high, amount.name)}.` : 'No values fall outside the typical range using the IQR method.', evidence: [['Column checked', amount.name], ['Typical range', `${moneyOrNumber(low, amount.name)} – ${moneyOrNumber(high, amount.name)}`], ['Method', 'IQR × 1.5']], details: outliers.length ? table(['Row', amount.name, ...dataset.headers.filter(header => header !== amount.name).slice(0, 2)], outliers.slice(0, 10).map(item => [item.index + 2, moneyOrNumber(item.value, amount.name), ...dataset.headers.filter(header => header !== amount.name).slice(0, 2).map(header => item.row[header])])) : '' };
}

function missingData() {
  const values = dataset.columns.filter(column => column.blankCount).sort((a, b) => b.blankCount - a.blankCount);
  const total = values.reduce((sum, column) => sum + column.blankCount, 0);
  return { title: 'Missing data', summary: total ? `Found ${formatNumber(total)} blank cells in ${values.length} column${values.length === 1 ? '' : 's'}.` : 'No blank cells were found.', evidence: [['Blank cells', formatNumber(total)], ['Columns affected', formatNumber(values.length)], ['Rows checked', formatNumber(dataset.rows.length)]], details: values.length ? table(['Column', 'Blank cells', 'Share of rows'], values.map(column => [column.name, formatNumber(column.blankCount), `${formatNumber((column.blankCount / dataset.rows.length) * 100)}%`])) : '' };
}

function unavailable(message) { return { title: 'More information needed', summary: message, evidence: [['Available columns', dataset.headers.join(', ')]], details: '' }; }

function interpretQuestion(question) {
  const value = question.trim().toLowerCase();
  if (!value) return null;
  if (/duplicate|repeat/.test(value)) return 'duplicates';
  if (/missing|blank|empty/.test(value)) return 'missing';
  if (/unusual|outlier|anomal/.test(value)) return 'outliers';
  if (/compare|change|trend|month|period/.test(value)) return 'trend';
  if (/top|biggest|largest|categor/.test(value)) return 'top';
  if (/overview|summary|what.*inside|columns|rows/.test(value)) return 'overview';
  return null;
}

function runAnalysis(name) {
  if (!dataset) return;
  const analyses = { overview, top: topCategories, trend: comparePeriods, duplicates: duplicateRows, outliers: unusualValues, missing: missingData };
  const report = analyses[name]();
  latestReport = report;
  ui.resultsTitle.textContent = report.title;
  ui.resultBody.innerHTML = `<div class="sheetlocal-answer"><p>${escapeHtml(report.summary)}</p>${evidence(report.evidence)}${report.details || ''}</div>`;
  ui.download.hidden = false;
  ui.analysisButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.analysis === name)));
  ui.questionHelp.textContent = 'The result above is calculated locally. The evidence cards show the columns and rule used.';
}

async function loadText(text, name) {
  ui.status.textContent = 'Reading locally…';
  ui.input.value = '';
  try {
    const rows = await parseCsv(text, detectDelimiter(text, name));
    dataset = analyzeRows(rows, name);
    ui.datasetName.textContent = name;
    ui.importPanel.hidden = true;
    ui.dataPanel.hidden = false;
    ui.status.textContent = '';
    renderProfile(); renderPreview(); runAnalysis('overview');
  } catch (error) {
    ui.status.textContent = error.message || 'This file could not be read.';
  }
}

ui.input.addEventListener('change', async () => {
  const [file] = ui.input.files;
  if (!file) return;
  if (file.size > MAX_BYTES) { ui.status.textContent = 'Please choose a CSV smaller than 5 MB.'; ui.input.value = ''; return; }
  await loadText(await file.text(), file.name);
});
ui.sample.addEventListener('click', () => loadText(SAMPLE_CSV, 'Sample budget.csv'));
ui.replace.addEventListener('click', () => { dataset = null; latestReport = null; ui.dataPanel.hidden = true; ui.importPanel.hidden = false; ui.input.click(); });
ui.analysisButtons.forEach(button => button.addEventListener('click', () => runAnalysis(button.dataset.analysis)));
ui.askForm.addEventListener('submit', event => {
  event.preventDefault();
  const analysis = interpretQuestion(ui.question.value);
  if (!analysis) { ui.questionHelp.textContent = 'Try “top categories,” “compare periods,” “find duplicates,” “unusual values,” or “missing data.”'; return; }
  runAnalysis(analysis);
});
ui.download.addEventListener('click', () => {
  if (!latestReport || !dataset) return;
  const text = `${latestReport.title}\n\n${latestReport.summary}\n\n${latestReport.evidence.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nGenerated locally by SheetLocal. The original file was not changed.`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a'); link.href = url; link.download = 'sheetlocal-report.txt'; link.click(); URL.revokeObjectURL(url);
});
