/**
 * FloatCamera Renderer
 * Handles camera, beautification, background replacement, and UI controls
 */

// ============ State ============
const state = {
  shape: 'circle',
  size: 200,
  opacity: 100,
  borderWidth: 3,
  borderColor: '#6c5ce7',
  flipped: true,
  // Beauty
  smooth: 0, brightness: 0, contrast: 0, saturation: 0, whiten: 0, sharpen: 0,
  // Background
  bgMode: 'none', // none | blur | color-gradient1..5 | color-solid | custom-image
  bgColor: '#2d3436',
  blurIntensity: 10,
  edgeBlur: 4,
  customBgImage: null,
  // Segmentation
  segEnabled: false,
};

const gradients = {
  'color-gradient1': ['#667eea', '#764ba2'],
  'color-gradient2': ['#f093fb', '#f5576c'],
  'color-gradient3': ['#4facfe', '#00f2fe'],
  'color-gradient4': ['#43e97b', '#38f9d7'],
  'color-gradient5': ['#fa709a', '#fee140'],
};

const beautyPresets = {
  none:    { smooth: 0,  brightness: 0,  contrast: 0,  saturation: 0,  whiten: 0,  sharpen: 0 },
  natural: { smooth: 25, brightness: 5,  contrast: 5,  saturation: 5,  whiten: 10, sharpen: 10 },
  bright:  { smooth: 20, brightness: 15, contrast: 10, saturation: 10, whiten: 15, sharpen: 5 },
  soft:    { smooth: 40, brightness: 5,  contrast: -5, saturation: -5, whiten: 20, sharpen: 0 },
  glamour: { smooth: 50, brightness: 10, contrast: 15, saturation: 15, whiten: 25, sharpen: 20 },
};

// ============ DOM Elements ============
const video = document.getElementById('video');
const outputCanvas = document.getElementById('output-canvas');
const processCanvas = document.getElementById('process-canvas');
const outCtx = outputCanvas.getContext('2d');
const procCtx = processCanvas.getContext('2d');
const container = document.getElementById('camera-container');
const loadingOverlay = document.getElementById('loading-overlay');

// ============ Camera Init ============
async function initCamera(deviceId) {
  const constraints = { video: { width: 640, height: 480 } };
  if (deviceId) constraints.video.deviceId = { exact: deviceId };
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    await video.play();
    processCanvas.width = video.videoWidth || 640;
    processCanvas.height = video.videoHeight || 480;
    outputCanvas.width = processCanvas.width;
    outputCanvas.height = processCanvas.height;
    
    // We only hide loading here if segmenter is already initialized or not needed
    if (!document.getElementById('loading-overlay').classList.contains('hidden') && segmenter) {
      hideLoading();
    }
    
    requestAnimationFrame(renderLoop);
  } catch (e) {
    console.error('Camera error:', e);
    hideLoading();
    alert('无法访问摄像头，请检查权限设置。');
  }
}

// ============ Segmentation (ML-based) ============
let segmenter = null;
let isSegmenting = false;
let cachedMask = null;

async function initSegmenter() {
  try {
    const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
    const segmenterConfig = {
      runtime: 'mediapipe',
      solutionPath: 'node_modules/@mediapipe/selfie_segmentation',
      modelType: 'general'
    };
    segmenter = await bodySegmentation.createSegmenter(model, segmenterConfig);
    console.log('Segmenter loaded successfully');
    hideLoading();
  } catch (e) {
    console.error('Segmenter init error:', e);
    hideLoading();
  }
}

function updateMask() {
  if (!segmenter || isSegmenting) return;
  isSegmenting = true;
  
  const segmentationConfig = { flipHorizontal: false }; // Always segment raw video without flip
  
  segmenter.segmentPeople(video, segmentationConfig)
    .then(segmentation => {
      if (segmentation.length > 0) {
        // Foreground = White, Background = Black
        return bodySegmentation.toBinaryMask(segmentation, {r: 255, g: 255, b: 255, a: 255}, {r: 0, g: 0, b: 0, a: 255});
      }
      return null;
    })
    .then(maskImageData => {
      if (maskImageData) {
        cachedMask = maskImageData;
      }
      isSegmenting = false;
    })
    .catch(err => {
      console.error(err);
      isSegmenting = false;
    });
}

// ============ Beauty Filters ============
function applyBeautyFilters(ctx, w, h) {
  const filters = [];
  const br = 100 + state.brightness;
  const ct = 100 + state.contrast;
  const st = 100 + state.saturation;
  if (br !== 100) filters.push(`brightness(${br}%)`);
  if (ct !== 100) filters.push(`contrast(${ct}%)`);
  if (st !== 100) filters.push(`saturate(${st}%)`);

  if (state.smooth > 0) {
    const blurPx = (state.smooth / 100) * 3;
    filters.push(`blur(${blurPx}px)`);
  }

  if (filters.length > 0) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.filter = filters.join(' ');
    tempCtx.drawImage(ctx.canvas, 0, 0);

    if (state.smooth > 0) {
      ctx.globalAlpha = 1;
      ctx.drawImage(tempCanvas, 0, 0);

      const detail = 1 - (state.smooth / 100) * 0.7;
      ctx.globalAlpha = detail;
      const origCanvas = document.createElement('canvas');
      origCanvas.width = w; origCanvas.height = h;
      const origCtx = origCanvas.getContext('2d');
      const bfilt = [];
      if (br !== 100) bfilt.push(`brightness(${br}%)`);
      if (ct !== 100) bfilt.push(`contrast(${ct}%)`);
      if (st !== 100) bfilt.push(`saturate(${st}%)`);
      origCtx.filter = bfilt.join(' ') || 'none';
      
      // Fix Ghosting: respect the flip state when blending the original frame
      origCtx.save();
      if (state.flipped) {
        origCtx.translate(w, 0);
        origCtx.scale(-1, 1);
      }
      origCtx.drawImage(video, 0, 0, w, h);
      origCtx.restore();

      ctx.drawImage(origCanvas, 0, 0);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }

  if (state.whiten > 0) {
    ctx.globalAlpha = (state.whiten / 100) * 0.15;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  if (state.sharpen > 0) {
    ctx.globalAlpha = (state.sharpen / 100) * 0.3;
    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

// ============ Background Replacement ============
function applyBackground(ctx, w, h, maskImageData) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = w;
  bgCanvas.height = h;
  const bgCtx = bgCanvas.getContext('2d');

  if (state.bgMode === 'blur') {
    bgCtx.filter = `blur(${state.blurIntensity}px)`;
    bgCtx.save();
    if (state.flipped) {
      bgCtx.translate(w, 0);
      bgCtx.scale(-1, 1);
    }
    bgCtx.drawImage(video, 0, 0, w, h);
    bgCtx.restore();
    bgCtx.filter = 'none';
  } else if (state.bgMode === 'color-solid') {
    bgCtx.fillStyle = state.bgColor;
    bgCtx.fillRect(0, 0, w, h);
  } else if (state.bgMode.startsWith('color-gradient')) {
    const colors = gradients[state.bgMode];
    if (colors) {
      const grad = bgCtx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[1]);
      bgCtx.fillStyle = grad;
      bgCtx.fillRect(0, 0, w, h);
    }
  } else if (state.bgMode === 'custom-image' && state.customBgImage) {
    const imgRatio = state.customBgImage.width / state.customBgImage.height;
    const ctxRatio = w / h;
    let drawW, drawH, drawX, drawY;
    if (imgRatio > ctxRatio) {
      drawH = h;
      drawW = h * imgRatio;
      drawX = (w - drawW) / 2;
      drawY = 0;
    } else {
      drawW = w;
      drawH = w / imgRatio;
      drawX = 0;
      drawY = (h - drawH) / 2;
    }
    bgCtx.drawImage(state.customBgImage, drawX, drawY, drawW, drawH);
  }

  const bgData = bgCtx.getImageData(0, 0, w, h);
  const bgPixels = bgData.data;

  // Render RAW mask to a temp canvas
  const rawMaskCanvas = document.createElement('canvas');
  rawMaskCanvas.width = w; rawMaskCanvas.height = h;
  rawMaskCanvas.getContext('2d').putImageData(maskImageData, 0, 0);

  // Render mask to a canvas to apply blur and FLIP for smooth edges
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w; maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext('2d');
  
  maskCtx.save();
  if (state.flipped) {
    maskCtx.translate(w, 0);
    maskCtx.scale(-1, 1);
  }
  maskCtx.drawImage(rawMaskCanvas, 0, 0, w, h);
  maskCtx.restore();
  
  if (state.edgeBlur > 0) {
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = w; blurCanvas.height = h;
    const bCtx = blurCanvas.getContext('2d');
    bCtx.filter = `blur(${state.edgeBlur}px)`;
    bCtx.drawImage(maskCanvas, 0, 0);
    maskCtx.clearRect(0, 0, w, h);
    maskCtx.drawImage(blurCanvas, 0, 0);
  }

  const smoothMaskData = maskCtx.getImageData(0, 0, w, h).data;

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = smoothMaskData[i] / 255;
    pixels[i]     = Math.round(pixels[i] * alpha + bgPixels[i] * (1 - alpha));
    pixels[i + 1] = Math.round(pixels[i + 1] * alpha + bgPixels[i + 1] * (1 - alpha));
    pixels[i + 2] = Math.round(pixels[i + 2] * alpha + bgPixels[i + 2] * (1 - alpha));
  }

  ctx.putImageData(imageData, 0, 0);
}

// ============ Render Loop ============
let frameCount = 0;

function renderLoop() {
  if (!video.videoWidth) {
    requestAnimationFrame(renderLoop);
    return;
  }

  const w = processCanvas.width;
  const h = processCanvas.height;

  procCtx.save();
  if (state.flipped) {
    procCtx.translate(w, 0);
    procCtx.scale(-1, 1);
  }
  procCtx.drawImage(video, 0, 0, w, h);
  procCtx.restore();

  applyBeautyFilters(procCtx, w, h);

  if (state.segEnabled && state.bgMode !== 'none') {
    frameCount++;
    if (frameCount % 2 === 0) {
      updateMask();
    }
    if (cachedMask) {
      applyBackground(procCtx, w, h, cachedMask);
    }
  }

  outCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  outCtx.drawImage(processCanvas, 0, 0, outputCanvas.width, outputCanvas.height);

  requestAnimationFrame(renderLoop);
}

// ============ UI Event Handlers ============

document.getElementById('btn-settings').addEventListener('click', () => {
  window.electronAPI.openSettings();
});

document.getElementById('btn-close').addEventListener('click', () => {
  window.electronAPI.closeApp();
});
document.getElementById('btn-minimize').addEventListener('click', () => {
  window.electronAPI.minimizeApp();
});

document.getElementById('btn-flip').addEventListener('click', () => {
  state.flipped = !state.flipped;
});

document.getElementById('btn-screenshot').addEventListener('click', () => {
  const flash = document.getElementById('flash-overlay');
  flash.classList.add('flash');
  setTimeout(() => flash.classList.remove('flash'), 200);

  const link = document.createElement('a');
  link.download = `floatcamera_${Date.now()}.png`;
  link.href = outputCanvas.toDataURL('image/png');
  link.click();
});

// ============ Window Dragging (IPC-based) ============
let isDragging = false, lastScreenX, lastScreenY;

container.addEventListener('mousedown', (e) => {
  if (e.target.closest('.ctrl-btn, .tool-btn')) return;
  isDragging = true;
  lastScreenX = e.screenX;
  lastScreenY = e.screenY;
  document.body.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const deltaX = e.screenX - lastScreenX;
  const deltaY = e.screenY - lastScreenY;
  lastScreenX = e.screenX;
  lastScreenY = e.screenY;
  window.electronAPI.moveWindow(deltaX, deltaY);
});

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    document.body.style.cursor = '';
  }
});

// ============ Receive settings from settings window ============
window.electronAPI.onApplySettings((data) => {
  const { key, value } = data;

  switch (key) {
    case 'shape':
      state.shape = value;
      container.className = value;
      break;
    case 'size':
      state.size = value;
      break;
    case 'opacity':
      state.opacity = value;
      container.style.opacity = value / 100;
      break;
    case 'borderWidth':
      state.borderWidth = value;
      container.style.borderWidth = value + 'px';
      break;
    case 'borderColor':
      state.borderColor = value;
      container.style.borderColor = value;
      break;
    case 'beautyPreset':
      const p = beautyPresets[value];
      if (p) {
        Object.entries(p).forEach(([k, v]) => {
          state[k] = v;
        });
      }
      break;
    case 'smooth':
    case 'brightness':
    case 'contrast':
    case 'saturation':
    case 'whiten':
    case 'sharpen':
      state[key] = value;
      break;
    case 'bgMode':
      state.bgMode = value;
      state.segEnabled = value !== 'none';
      if (state.segEnabled && !segmenter) {
        initSegmenter(); // Initialize on demand if not ready
      }
      cachedMask = null;
      break;
    case 'bgColor':
      state.bgColor = value;
      break;
    case 'blurIntensity':
      state.blurIntensity = value;
      break;
    case 'edgeBlur':
      state.edgeBlur = value;
      cachedMask = null;
      break;
    case 'customBgImage':
      const img = new Image();
      img.onload = () => {
        state.customBgImage = img;
        state.bgMode = 'custom-image';
        state.segEnabled = true;
        cachedMask = null;
        if (!segmenter) initSegmenter();
      };
      img.src = value;
      break;
    case 'cameraId':
      const tracks = video.srcObject?.getTracks();
      tracks?.forEach(t => t.stop());
      initCamera(value);
      break;
  }
});

// ============ Loading ============
function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// ============ Init ============
initCamera();
// Preload segmenter
initSegmenter();
