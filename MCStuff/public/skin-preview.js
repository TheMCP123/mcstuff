import { iconMarkup } from './icons.js';

let library;
function loadLibrary() {
  if (window.skinview3d?.SkinViewer) return Promise.resolve(window.skinview3d);
  if (library) return library;
  library = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/skinview3d/skinview3d.bundle.js';
    script.onload = () => window.skinview3d?.SkinViewer ? resolve(window.skinview3d) : reject(new Error('Preview unavailable'));
    script.onerror = () => { script.remove(); reject(new Error('Preview unavailable')); };
    document.head.append(script);
  }).catch(error => { library = null; throw error; });
  return library;
}

export function createSkinPreview(data) {
  const element = document.createElement('div');
  element.className = 'skin-preview';
  element.innerHTML = `<div class="skin-preview-stage"><canvas tabindex="0" role="img" hidden></canvas><img class="skin-flat-fallback" hidden><p class="preview-status" role="status">Loading 3D preview…</p></div><div class="skin-preview-controls"><button type="button" disabled>Front</button><button type="button" disabled>Back</button><button type="button" class="preview-reset" disabled>${iconMarkup('reset')}<span>Reset view</span></button></div><p class="field-help preview-hint">Drag to rotate · Scroll to zoom</p><details class="skin-texture-details"><summary>Skin texture</summary><img></details>`;
  const stage = element.querySelector('.skin-preview-stage');
  const canvas = stage.querySelector('canvas');
  const fallback = stage.querySelector('img');
  const status = stage.querySelector('.preview-status');
  const controls = element.querySelector('.skin-preview-controls');
  const buttons = [...controls.querySelectorAll('button')];
  const texture = element.querySelector('.skin-texture-details img');
  canvas.setAttribute('aria-label', `3D skin preview for ${data.name}. Drag or use left and right arrows to rotate.`);
  fallback.alt = `${data.name} skin texture`;
  texture.alt = `${data.name} original skin texture`;
  texture.src = data.skin.url;
  let viewer;
  let disposed = false;
  let resize;
  const visibility = () => { if (viewer) viewer.renderPaused = document.hidden; };

  function face(angle) {
    if (!viewer) return;
    viewer.resetCameraPose();
    viewer.playerObject.rotation.y = angle;
    viewer.controls.update();
  }
  buttons[0].addEventListener('click', () => face(0));
  buttons[1].addEventListener('click', () => face(Math.PI));
  buttons[2].addEventListener('click', () => face(.35));
  canvas.addEventListener('keydown', event => {
    if (!viewer) return;
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      viewer.playerObject.rotation.y += event.key === 'ArrowLeft' ? -.2 : .2;
    }
    if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault();
      viewer.zoom = Math.max(.5, Math.min(1.4, viewer.zoom + (event.key === '-' ? -.1 : .1)));
    }
  });

  void loadLibrary().then(async api => {
    if (disposed) return;
    viewer = new api.SkinViewer({ canvas, width: Math.max(160, stage.clientWidth), height: 360, renderPaused: true, enableControls: true });
    viewer.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    viewer.globalLight.intensity = 3;
    viewer.cameraLight.intensity = 0;
    await viewer.loadSkin(data.skin.url, { model: data.skin.model === 'Slim' ? 'slim' : 'default' });
    if (disposed) return;
    canvas.hidden = false;
    status.hidden = true;
    buttons.forEach(button => { button.disabled = false; });
    face(.35);
    viewer.renderPaused = document.hidden;
    resize = new ResizeObserver(() => { if (viewer && !disposed) viewer.width = Math.max(160, stage.clientWidth); });
    resize.observe(stage);
    document.addEventListener('visibilitychange', visibility);
  }).catch(() => {
    if (disposed) return;
    viewer?.dispose();
    viewer = null;
    canvas.hidden = true;
    fallback.src = data.skin.url;
    fallback.hidden = false;
    status.textContent = '3D preview unavailable. Showing the original texture.';
    controls.hidden = true;
    element.querySelector('.preview-hint').hidden = true;
  });

  return { element, dispose() { disposed = true; resize?.disconnect(); document.removeEventListener('visibilitychange', visibility); viewer?.dispose(); viewer = null; } };
}
