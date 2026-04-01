const { ipcRenderer } = require('electron');

const sel   = document.getElementById('sel');
const label = document.getElementById('size-label');
let startX = 0, startY = 0, drawing = false;

document.addEventListener('mousedown', e => {
  startX  = e.clientX;
  startY  = e.clientY;
  drawing = true;
  sel.style.cssText   = `display:block; left:${startX}px; top:${startY}px; width:0; height:0`;
  label.style.display = 'block';
});

document.addEventListener('mousemove', e => {
  if (!drawing) return;
  const x = Math.min(startX, e.clientX);
  const y = Math.min(startY, e.clientY);
  const w = Math.abs(e.clientX - startX);
  const h = Math.abs(e.clientY - startY);
  sel.style.left   = x + 'px';
  sel.style.top    = y + 'px';
  sel.style.width  = w + 'px';
  sel.style.height = h + 'px';
  label.style.left = (x + w + 6) + 'px';
  label.style.top  = (y + h + 6) + 'px';
  label.textContent = `${Math.round(w)} × ${Math.round(h)}`;
});

document.addEventListener('mouseup', e => {
  if (!drawing) return;
  drawing = false;
  const x = Math.min(startX, e.clientX);
  const y = Math.min(startY, e.clientY);
  const w = Math.abs(e.clientX - startX);
  const h = Math.abs(e.clientY - startY);
  if (w > 20 && h > 10) {
    ipcRenderer.send('region-selected', {
      x: Math.round(x), y: Math.round(y),
      width: Math.round(w), height: Math.round(h)
    });
  } else {
    ipcRenderer.send('region-cancelled');
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') ipcRenderer.send('region-cancelled');
});
