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
};

let templateImage = null;
let photoImages = [];
let processedResults = [];
let currentDownloadIndex = -1;
let pendingDownloadAll = false;
let remainingPhotosToday = 5;

// Theme
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  els.themeToggle.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
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

// Template upload
els.templateInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    templateImage = new Image();
    templateImage.onload = () => checkReady();
    templateImage.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// Photos + thumbs
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
      const img = await new Promise((r, j) => {
        const i = new Image();
        i.onload = () => r(i);
        i.onerror = j;
        i.src = url;
      });
      photoImages.push({img, name: file.name});
      createThumb(img, file.name);
    } catch (err) {}
  }
  checkReady();
});

function createThumb(photo, name) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  c.width = c.height = 140;
  const r = Math.min(140 / photo.width, 140 / photo.height);
  const w = photo.width * r;
  const h = photo.height * r;
  const x = (140 - w) / 2;
  const y = (140 - h) / 2;
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

// Ad watch (removes watermark for the day)
function hasWatchedAd() {
  return localStorage.getItem('frameItAd') === new Date().toDateString();
}

function setWatchedAd() {
  localStorage.setItem('frameItAd', new Date().toDateString());
}

// Process
els.processBtn.addEventListener('click', async () => {
  if (!templateImage || !photoImages.length) return;

  if (remainingPhotosToday < photoImages.length) {
    els.status.textContent = `You have ${remainingPhotosToday} slot${remainingPhotosToday === 1 ? '' : 's'} left today. Watch ad for +5 more photos.`;
    return;
  }

  els.status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
  els.processBtn.disabled = true;
  els.previewCont.innerHTML = '';
  processedResults = [];
  els.resultsSection.classList.remove('hidden');

  let watermarkImg = null;
  if (!hasWatchedAd()) {
    try {
      watermarkImg = await loadImage('logo.png');
    } catch (err) {
      console.warn("Failed to load logo.png as watermark:", err);
    }
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
    let ratio = mode === 'contain'
      ? Math.min(canvas.width / img.width, canvas.height / img.height)
      : Math.max(canvas.width / img.width, canvas.height / img.height);

    const pw = img.width * ratio;
    const ph = img.height * ratio;
    const px = (canvas.width - pw) / 2;
    const py = (canvas.height - ph) / 2;
    ctx.drawImage(img, px, py, pw, ph);

    ctx.globalAlpha = +els.opacity.value;
    ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;

    if (watermarkImg) {
      const maxWmSize = Math.min(canvas.width, canvas.height) * 0.25;
      const aspect = watermarkImg.width / watermarkImg.height;
      let wmWidth = maxWmSize;
      let wmHeight = wmWidth / aspect;
      if (wmHeight > maxWmSize) {
        wmHeight = maxWmSize;
        wmWidth = wmHeight * aspect;
      }

      const wmX = canvas.width - wmWidth - 30;
      const wmY = canvas.height - wmHeight - 30;

      ctx.globalAlpha = 0.6;
      ctx.drawImage(watermarkImg, wmX, wmY, wmWidth, wmHeight);
      ctx.globalAlpha = 1;
    }

    addResult(canvas, name);
    processedResults.push({canvas, name, hasWatermark: !!watermarkImg});

    remainingPhotosToday--;
  }

  els.status.textContent = `Done — ${processedResults.length} image${processedResults.length === 1 ? '' : 's'} ready (remaining today: ${remainingPhotosToday})`;
  els.processBtn.disabled = false;
  els.downloadAllBtn.disabled = false;
});

function addResult(canvas, name, hasWatermark) {
  const div = document.createElement('div');
  div.className = 'result';

  const footer = document.createElement('div');
  footer.className = 'result-footer';

  const span = document.createElement('span');
  span.textContent = name;

  const btn = document.createElement('button');
  btn.className = 'btn primary small';
  btn.innerHTML = '<i class="fa-solid fa-download"></i> Download';
  btn.onclick = () => {
    currentDownloadIndex = processedResults.findIndex(r => r.name === name);
    pendingDownloadAll = false;
    if (hasWatermark) {
      showDownloadModal();
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

// Modal handling
function showDownloadModal() {
  els.downloadModal.classList.remove('hidden');
}

function hideDownloadModal() {
  els.downloadModal.classList.add('hidden');
}

els.watchAdDownloadBtn.addEventListener('click', () => {
  setWatchedAd();
  els.status.textContent = 'Ad watched! Watermark removed for today.';
  hideDownloadModal();
  performDownload(currentDownloadIndex);
  if (pendingDownloadAll) {
    downloadAllClean();
  }
});

els.downloadWithWatermarkBtn.addEventListener('click', () => {
  hideDownloadModal();
  performDownload(currentDownloadIndex);
  if (pendingDownloadAll) {
    downloadAllWithWatermark();
  }
});

function performDownload(index) {
  if (index < 0) return;
  const {canvas, name} = processedResults[index];
  const a = document.createElement('a');
  a.download = `framed_${name.replace(/\.[^/.]+$/, '')}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

// Download All
els.downloadAllBtn.addEventListener('click', () => {
  pendingDownloadAll = true;
  if (processedResults.some(r => r.hasWatermark)) {
    showDownloadModal();
  } else {
    downloadAllClean();
  }
});

function downloadAllClean() {
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

function downloadAllWithWatermark() {
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
  remainingPhotosToday = 5;
  checkReady();
  els.status.textContent = 'Everything cleared — ready for new photos!';
});

// Watch Ad for watermark removal
els.watchAdBtn.addEventListener('click', () => {
  setWatchedAd();
  els.status.textContent = 'Ad watched! Watermark removed for today.';
  els.watchAdBtn.disabled = true;
});

// Watch Ad for +5 more photos (unlimited)
els.watchAdExtraBtn.addEventListener('click', () => {
  remainingPhotosToday += 5;
  els.status.textContent = `Ad watched! +5 more photos unlocked (remaining today: ${remainingPhotosToday}).`;
});

// Helper: load image
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}