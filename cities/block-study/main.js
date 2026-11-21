import { eras } from './eras.js';
import { makeAudio } from './audio.js';

const year = document.querySelector('#year');
const stops = document.querySelector('#year-stops');
const view = document.querySelector('#scene');
const status = document.querySelector('#view-status');
const caption = document.querySelector('#era-name');
const veil = document.querySelector('#era-transition');
const reset = document.querySelector('#reset-view');
const street = document.querySelector('#street-view');
const sound = document.querySelector('#sound');
const soundState = document.querySelector('#sound-state');
const soundLabel = document.querySelector('#sound-label');
const audio = makeAudio(eras[0]);
const choices = [];
let scene;
let soundEnabled = false;
let pendingSound = false;
let scrubbing = false;

year.max = String(eras.length - 1);
for (const [index, era] of eras.entries()) {
  const button = document.createElement('button');
  button.type = 'button';
  button.disabled = true;
  button.textContent = era.year;
  button.addEventListener('click', () => select(index));
  choices.push(button);
  stops.append(button);
}

function select(index, apply = true) {
  const era = eras[index];
  year.value = index;
  year.setAttribute('aria-valuetext', String(era.year));
  caption.textContent = era.year + ' · ' + era.name;
  view.dataset.selectedYear = era.year;
  choices.forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
  if (apply) scene?.select(era);
}

function setSound(enabled, label = enabled ? 'on' : 'off') {
  soundEnabled = enabled;
  sound.setAttribute('aria-pressed', String(enabled));
  soundState.textContent = enabled ? '●' : '○';
  soundLabel.textContent = label;
}

function fallback() {
  scene?.dispose();
  scene = undefined;
  audio.stop();
  setSound(false);
  veil.style.opacity = 0;
  view.tabIndex = -1;
  for (const control of [year, reset, street, sound, ...choices]) control.disabled = true;
  status.hidden = false;
  status.textContent = 'The block needs WebGL 2 to render. You can try enabling hardware acceleration in your browser, or ';
  const back = document.createElement('a');
  back.href = '../../index.html';
  back.textContent = 'return to the gallery';
  status.append(back, '.');
}

year.addEventListener('pointerdown', () => { scrubbing = true; });
function finishScrub() {
  if (!scrubbing) return;
  scrubbing = false;
  select(year.valueAsNumber);
}
window.addEventListener('pointerup', finishScrub);
window.addEventListener('pointercancel', finishScrub);
year.addEventListener('change', finishScrub);
year.addEventListener('input', () => select(year.valueAsNumber, !scrubbing));
reset.addEventListener('click', () => scene?.reset());
street.addEventListener('click', () => scene?.reset(true));
sound.addEventListener('click', async () => {
  if (pendingSound) return;
  if (soundEnabled) {
    audio.stop();
    setSound(false);
    return;
  }
  pendingSound = true;
  try {
    if (await audio.start()) setSound(true);
  } catch {
    if (scene) setSound(false, 'unavailable');
  } finally {
    pendingSound = false;
  }
});

window.addEventListener('pagehide', (event) => {
  setSound(false);
  if (event.persisted) {
    audio.stop();
  } else {
    audio.dispose();
    scene?.dispose();
  }
});

select(0);
async function startScene() {
  status.hidden = false;
  try {
    const { createScene } = await import('./scene.js');
    scene = createScene({
      container: view,
      initial: eras[0],
      onSwap(era) {
        view.dataset.renderedYear = era.year;
        audio.setEra(era);
      },
      onTransition(progress) {
        veil.style.opacity = String(progress * .46);
      },
      onLost: fallback,
    });
    for (const control of [year, reset, street, sound, ...choices]) control.disabled = false;
    view.dataset.renderedYear = eras[0].year;
    status.hidden = true;
  } catch {
    fallback();
  }
}

void startScene();
