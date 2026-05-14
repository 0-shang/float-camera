/**
 * FloatCamera Settings Renderer
 * Handles the settings window UI and communicates with the main camera window
 */

const beautyPresets = {
  none:    { smooth: 0,  brightness: 0,  contrast: 0,  saturation: 0,  whiten: 0,  sharpen: 0 },
  natural: { smooth: 25, brightness: 5,  contrast: 5,  saturation: 5,  whiten: 10, sharpen: 10 },
  bright:  { smooth: 20, brightness: 15, contrast: 10, saturation: 10, whiten: 15, sharpen: 5 },
  soft:    { smooth: 40, brightness: 5,  contrast: -5, saturation: -5, whiten: 20, sharpen: 0 },
  glamour: { smooth: 50, brightness: 10, contrast: 15, saturation: 15, whiten: 25, sharpen: 20 },
};

// ============ Title bar drag ============
const titlebar = document.getElementById('settings-titlebar');
let isDragging = false, lastX, lastY;

titlebar.addEventListener('mousedown', (e) => {
  if (e.target.closest('.close-settings-btn')) return;
  isDragging = true;
  lastX = e.screenX;
  lastY = e.screenY;
  document.body.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const deltaX = e.screenX - lastX;
  const deltaY = e.screenY - lastY;
  lastX = e.screenX;
  lastY = e.screenY;
  window.settingsAPI.moveSettingsWindow(deltaX, deltaY);
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  document.body.style.cursor = '';
});

// ============ Close settings ============
document.getElementById('btn-close-settings').addEventListener('click', () => {
  window.settingsAPI.closeSettings();
});

// ============ Send setting change to main window ============
function sendChange(key, value) {
  window.settingsAPI.sendSettingsChange({ key, value });
}

// ============ Tabs ============
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ============ Shape buttons ============
document.querySelectorAll('.shape-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const shape = btn.dataset.shape;
    sendChange('shape', shape);
    window.settingsAPI.resizeWindow(shape);
  });
});

// ============ Size slider ============
const sizeSlider = document.getElementById('size-slider');
sizeSlider.addEventListener('input', () => {
  const v = parseInt(sizeSlider.value);
  document.getElementById('size-value').textContent = v + 'px';
  sendChange('size', v);
  // Calculate window dimensions based on shape
  const activeShape = document.querySelector('.shape-btn.active');
  const shape = activeShape ? activeShape.dataset.shape : 'circle';
  let w = v, h = v;
  if (shape === 'rectangle') { w = Math.round(v * 1.33); h = v; }
  window.settingsAPI.setSize(w, h);
});

// ============ Opacity slider ============
document.getElementById('opacity-slider').addEventListener('input', function() {
  document.getElementById('opacity-value').textContent = this.value + '%';
  sendChange('opacity', parseInt(this.value));
});

// ============ Border sliders ============
document.getElementById('border-slider').addEventListener('input', function() {
  document.getElementById('border-value').textContent = this.value + 'px';
  sendChange('borderWidth', parseInt(this.value));
});

document.getElementById('border-color').addEventListener('input', function() {
  sendChange('borderColor', this.value);
});

// ============ Beauty presets ============
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const p = beautyPresets[btn.dataset.preset];
    if (p) {
      Object.entries(p).forEach(([k, v]) => {
        const slider = document.getElementById(`${k}-slider`);
        const label = document.getElementById(`${k}-value`);
        if (slider) slider.value = v;
        if (label) label.textContent = v;
      });
      sendChange('beautyPreset', btn.dataset.preset);
    }
  });
});

// ============ Beauty sliders ============
['smooth', 'brightness', 'contrast', 'saturation', 'whiten', 'sharpen'].forEach(name => {
  const slider = document.getElementById(`${name}-slider`);
  if (slider) {
    slider.addEventListener('input', function() {
      document.getElementById(`${name}-value`).textContent = this.value;
      sendChange(name, parseInt(this.value));
      // Deactivate preset buttons
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    });
  }
});

// ============ Background buttons ============
document.querySelectorAll('.bg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const bgMode = btn.dataset.bg;
    sendChange('bgMode', bgMode);
    document.getElementById('bg-color-picker').classList.toggle('hidden', bgMode !== 'color-solid');
    document.getElementById('bg-blur-controls').classList.toggle('hidden', bgMode !== 'blur');
  });
});

// Background color
document.getElementById('bg-color').addEventListener('input', function() {
  sendChange('bgColor', this.value);
});

// Blur intensity
document.getElementById('blur-intensity').addEventListener('input', function() {
  document.getElementById('blur-value').textContent = this.value;
  sendChange('blurIntensity', parseInt(this.value));
});

// Edge blur
document.getElementById('edge-blur').addEventListener('input', function() {
  document.getElementById('edge-blur-value').textContent = this.value;
  sendChange('edgeBlur', parseInt(this.value));
});

// Custom background image
document.getElementById('bg-image-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    // Read as data URL and send to main window
    const reader = new FileReader();
    reader.onload = (ev) => {
      sendChange('customBgImage', ev.target.result);
      document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
    };
    reader.readAsDataURL(file);
  }
});

// ============ Camera select ============
// Populate cameras from this window as well
async function populateCameras() {
  try {
    // Request camera permission
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const sel = document.getElementById('camera-select');
    sel.innerHTML = '';
    devices.filter(d => d.kind === 'videoinput').forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `摄像头 ${i + 1}`;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error('Failed to enumerate cameras:', e);
  }
}

document.getElementById('camera-select').addEventListener('change', function() {
  if (this.value) {
    sendChange('cameraId', this.value);
  }
});

// Init camera list
populateCameras();
