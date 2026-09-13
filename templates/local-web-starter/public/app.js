'use strict';
const input = document.getElementById('input'), output = document.getElementById('output');
document.getElementById('clean').onclick = () => {
  if (input.value.length > 1000000) { document.getElementById('status').textContent = 'Use less than one million characters.'; return; }
  output.value = input.value.split(/\r?\n/).map(line => line.trimEnd()).join('\n').trim();
  document.getElementById('download').disabled = !output.value;
  document.getElementById('status').textContent = output.value ? 'Ready. Nothing was uploaded.' : 'Enter some text first.';
};
document.getElementById('download').onclick = () => {
  const url = URL.createObjectURL(new Blob([output.value], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'clean-text.txt'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
