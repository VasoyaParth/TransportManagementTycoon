// Sound engine — looping background music + quick UI/event SFX.
// Uses react-native-sound (Android res/raw assets). All calls are safe no-ops
// if audio fails to load, and honour the player's sound setting.
import Sound from 'react-native-sound';

Sound.setCategory('Playback', false);

let enabled = true;
let musicOn = true;
let musicVolume = 0.4; // master music volume (0-1), tunable in Settings
let sfxVolume = 1; // master SFX multiplier (0-1) applied on top of each play() call's own volume
const sfx = {};
let bgm = null;
let loaded = false;

const SFX_FILES = {
  click: 'click',
  tap: 'tap',
  success: 'success',
  coin: 'coin',
  error: 'error',
  start: 'start',
  day: 'day',
};

export function initSound() {
  if (loaded) return;
  loaded = true;
  try {
    Object.entries(SFX_FILES).forEach(([key, file]) => {
      const s = new Sound(file, Sound.MAIN_BUNDLE, e => { if (e) sfx[key] = null; });
      sfx[key] = s;
    });
    bgm = new Sound('bgm', Sound.MAIN_BUNDLE, e => {
      if (e) { bgm = null; return; }
      bgm.setNumberOfLoops(-1);
      bgm.setVolume(musicVolume);
      if (enabled && musicOn) bgm.play();
    });
  } catch (e) {
    // audio unavailable — game stays fully playable
  }
}

export function play(name, volume = 0.9) {
  if (!enabled) return;
  const s = sfx[name];
  if (!s) return;
  try {
    s.stop(() => { s.setVolume(volume * sfxVolume); s.play(); });
  } catch (e) {}
}

export function setSoundEnabled(on) {
  enabled = on;
  try {
    if (!on) { if (bgm) bgm.pause(); }
    else if (musicOn && bgm) bgm.play();
  } catch (e) {}
}

export function setMusicEnabled(on) {
  musicOn = on;
  try {
    if (bgm) { if (on && enabled) bgm.play(); else bgm.pause(); }
  } catch (e) {}
}

// Independent volume sliders (0-1) for background music and one-shot SFX.
export function setMusicVolume(v) {
  musicVolume = Math.max(0, Math.min(1, v));
  try { if (bgm) bgm.setVolume(musicVolume); } catch (e) {}
}

export function setSfxVolume(v) {
  sfxVolume = Math.max(0, Math.min(1, v));
}

export function releaseSound() {
  try {
    Object.values(sfx).forEach(s => s && s.release());
    if (bgm) bgm.release();
  } catch (e) {}
  loaded = false;
}
