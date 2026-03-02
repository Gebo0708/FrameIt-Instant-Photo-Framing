// Elements
const els = {
  templateInput: document.getElementById('templateInput'),
  photosInput: document.getElementById('photosInput'),
  processBtn: document.getElementById('processBtn'),
  clearBtn: document.getElementById('clearBtn'),
  downloadAllBtn: document.getElementById('downloadAllBtn'),
  status: document.getElementById('status'),
  previewCont: document.getElementById('preview-container'),
  resultsSection: document.getElementById('resultsSection'),
  fitMode: document.getElementById('fitMode'),
  bgFill: document.getElementById('bgFill'),
  opacity: document.getElementById('opacity'),
  opacityValue: document.getElementById('opacityValue'),
  photoPreviews: document.getElementById('photo-previews'),
  themeToggle: document.getElementById('themeToggle'),
  watchAdBtn: document.getElementById('watchAdBtn'),
  watchAdExtraBtn: document.getElementById('watchAdExtraBtn'),
  downloadModal: document.getElementById('downloadModal'),
  watchAdDownloadBtn: document.getElementById('watchAdDownloadBtn'),
  downloadWithWatermarkBtn: document.getElementById('downloadWithWatermarkBtn'),
  adModal: document.getElementById('adModal'),
  closeAdModal: document.getElementById('closeAdModal'),
};

// State
let templateImage = null;
let photoImages = [];
let processedResults = [];
let currentDownloadIndex = -1;
let pendingDownloadAll = false;
let remainingPhotosToday = 15;

// Theme
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  els.themeToggle.innerHTML = theme === 'dark'
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';
}

const saved = localStorage.getItem('theme');
if (saved) setTheme(saved);
else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');

els.themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(cur === 'light' ? 'dark' : 'light');
});

// Drag & Drop
function makeDropzone(el, input, multiple = false) {
  el.addEventListener('click', () => input.click());
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('dragover');
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    const dt = new DataTransfer();
    if (multiple) files.forEach(f => dt.items.add(f));
    else dt.items.add(files[0]);
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
}

makeDropzone(document.getElementById('templateDrop'), els.templateInput);
makeDropzone(document.getElementById('photosDrop'), els.photosInput, true);

// Image resize helper
function resizeImageIfNeeded(img, maxDim = 2048) {
  return new Promise(resolve => {
    if (img.width <= maxDim && img.height <= maxDim) return resolve(img);
    const c = document.createElement('canvas');
    const r = Math.min(maxDim / img.width, maxDim / img.height);
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const resized = new Image();
    resized.onload = () => resolve(resized);
    resized.src = c.toDataURL('image/jpeg', 0.92);
  });
}

// Template upload
els.templateInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    templateImage = new Image();
    templateImage.onload = () => checkReady();
    templateImage.onerror = () => els.status.textContent = 'Failed to load frame';
    templateImage.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// Photos upload
els.photosInput.addEventListener('change', async () => {
  photoImages = [];
  els.photoPreviews.innerHTML = '';
  const files = [...els.photosInput.files];

  for (const file of files) {
    try {
      const url = await new Promise(r => {
        const rd = new FileReader();
        rd.onload = e => r(e.target.result);
        rd.readAsDataURL(file);
      });
      let img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      img = await resizeImageIfNeeded(img);
      photoImages.push({ img, name: file.name });
      createThumb(img, file.name);
    } catch (err) {
      console.warn(err);
    }
  }
  checkReady();
});

function createThumb(photo, name) {
  const c = document.createElement('canvas');
  c.width = c.height = 140;
  const ctx = c.getContext('2d');
  const r = Math.min(140 / photo.width, 140 / photo.height);
  const w = Math.round(photo.width * r);
  const h = Math.round(photo.height * r);
  const x = Math.round((140 - w) / 2);
  const y = Math.round((140 - h) / 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,140,140);
  ctx.drawImage(photo, x, y, w, h);

  const div = document.createElement('div');
  div.className = 'preview-item';
  const p = document.createElement('p');
  p.textContent = name;
  div.appendChild(c);
  div.appendChild(p);
  els.photoPreviews.appendChild(div);
}

// Opacity live update
els.opacity.addEventListener('input', () => {
  els.opacityValue.textContent = Math.round(els.opacity.value * 100) + '%';
});

// Ready check
function checkReady() {
  const ok = !!templateImage && photoImages.length > 0;
  els.processBtn.disabled = !ok;
  els.status.textContent = ok
    ? `Ready — ${photoImages.length} photo${photoImages.length === 1 ? '' : 's'}`
    : 'Upload a frame and photos to begin';
}

// Ad logic
function hasWatchedAd() {
  return localStorage.getItem('frameltAd') === new Date().toDateString();
}

function markAdWatched() {
  localStorage.setItem('frameltAd', new Date().toDateString());
}

function showAdAndReward(onReward) {
  els.adModal.classList.remove('hidden');

  // Important: delay the ad push until modal is visible (fixes "availableWidth=0")
  setTimeout(() => {
    try {
      (adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error('AdSense push failed:', e);
    }
  }, 150);

  const timer = setTimeout(() => {
    onReward();
    els.adModal.classList.add('hidden');
    els.status.textContent = 'Thanks for watching! Reward unlocked.';
  }, 25000);

  els.closeAdModal.onclick = () => {
    clearTimeout(timer);
    onReward();
    els.adModal.classList.add('hidden');
    els.status.textContent = 'Reward unlocked — enjoy!';
  };
}

els.watchAdExtraBtn.addEventListener('click', () => {
  showAdAndReward(() => {
    remainingPhotosToday += 10;
    els.status.textContent = `+10 photos unlocked! Remaining today: ${remainingPhotosToday}`;
  });
});

els.watchAdBtn.addEventListener('click', () => {
  showAdAndReward(() => {
    markAdWatched();
    els.status.textContent = 'Watermark removed for today!';
    els.watchAdBtn.disabled = true;
  });
});

els.watchAdDownloadBtn.addEventListener('click', () => {
  showAdAndReward(() => {
    markAdWatched();
    els.downloadModal.classList.add('hidden');
    performDownload(currentDownloadIndex);
    if (pendingDownloadAll) downloadAll();
    els.status.textContent = 'Ad watched — clean downloads ready!';
  });
});

els.downloadWithWatermarkBtn.addEventListener('click', () => {
  els.downloadModal.classList.add('hidden');
  performDownload(currentDownloadIndex);
  if (pendingDownloadAll) downloadAll();
});

// Process images
els.processBtn.addEventListener('click', async () => {
  if (!templateImage || !photoImages.length) return;

  if (remainingPhotosToday < photoImages.length) {
    els.status.textContent = `Only ${remainingPhotosToday} slot${remainingPhotosToday === 1 ? '' : 's'} left today. Watch ad for +10 more.`;
    return;
  }

  els.status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
  els.processBtn.disabled = true;
  els.previewCont.innerHTML = '';
  processedResults = [];
  els.resultsSection.classList.remove('hidden');

  let watermark = null;
  if (!hasWatchedAd()) {
    try { watermark = await loadImage('logo.png'); } catch {}
  }

  for (const {img, name} of photoImages) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = templateImage.width;
    canvas.height = templateImage.height;

    const bg = els.bgFill.value;
    if (bg !== 'none') {
      if (bg === 'blur') {
        ctx.filter = 'blur(20px)';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
      } else {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    const mode = els.fitMode.value;
    const ratio = mode === 'contain'
      ? Math.min(canvas.width / img.width, canvas.height / img.height)
      : Math.max(canvas.width / img.width, canvas.height / img.height);

    const pw = Math.round(img.width * ratio);
    const ph = Math.round(img.height * ratio);
    const px = Math.round((canvas.width - pw) / 2);
    const py = Math.round((canvas.height - ph) / 2);

    ctx.drawImage(img, px, py, pw, ph);

    ctx.globalAlpha = +els.opacity.value;
    ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;

    if (watermark) {
      const size = Math.min(canvas.width, canvas.height) * 0.18;
      const aspect = watermark.width / watermark.height;
      let w = size, h = size / aspect;
      if (h > size) { h = size; w = h * aspect; }
      const x = canvas.width - w - 24;
      const y = canvas.height - h - 24;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(watermark, x, y, w, h);
      ctx.globalAlpha = 1;
    }

    addResult(canvas, name, !!watermark);
    processedResults.push({canvas, name, hasWatermark: !!watermark});
    remainingPhotosToday--;
  }

  els.status.textContent = `Done — ${processedResults.length} image${processedResults.length === 1 ? '' : 's'} ready (remaining: ${remainingPhotosToday})`;
  els.processBtn.disabled = false;
  els.downloadAllBtn.disabled = false;
});

function addResult(canvas, name, hasWatermark) {
  const div = document.createElement('div');
  div.className = 'result';

  const footer = document.createElement('div');
  footer.style.padding = '12px';
  footer.style.display = 'flex';
  footer.style.justifyContent = 'space-between';
  footer.style.alignItems = 'center';

  const span = document.createElement('span');
  span.textContent = name;

  const btn = document.createElement('button');
  btn.className = 'btn primary';
  btn.style.padding = '10px 20px';
  btn.style.fontSize = '0.95rem';
  btn.innerHTML = '<i class="fa-solid fa-download"></i> Download';
  btn.onclick = () => {
    currentDownloadIndex = processedResults.findIndex(r => r.name === name);
    pendingDownloadAll = false;
    if (hasWatermark) {
      els.downloadModal.classList.remove('hidden');
    } else {
      performDownload(currentDownloadIndex);
    }
  };

  footer.appendChild(span);
  footer.appendChild(btn);
  div.appendChild(canvas);
  div.appendChild(footer);
  els.previewCont.appendChild(div);
}

function performDownload(index) {
  if (index < 0) return;
  const {canvas, name} = processedResults[index];
  const a = document.createElement('a');
  a.download = `framed_${name.replace(/\.[^/.]+$/, '')}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

els.downloadAllBtn.addEventListener('click', () => {
  pendingDownloadAll = true;
  if (processedResults.some(r => r.hasWatermark)) {
    els.downloadModal.classList.remove('hidden');
  } else {
    downloadAll();
  }
});

function downloadAll() {
  processedResults.forEach(({canvas, name}, i) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.download = `framed_${name.replace(/\.[^/.]+$/, '')}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    }, i * 400);
  });
  pendingDownloadAll = false;
}

// Clear
els.clearBtn.addEventListener('click', () => {
  els.templateInput.value = '';
  els.photosInput.value = '';
  templateImage = null;
  photoImages = [];
  els.photoPreviews.innerHTML = '';
  els.previewCont.innerHTML = '';
  els.resultsSection.classList.add('hidden');
  processedResults = [];
  remainingPhotosToday = 15;
  checkReady();
  els.status.textContent = 'Everything cleared — ready for new photos!';
});

// Helper
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

checkReady();
