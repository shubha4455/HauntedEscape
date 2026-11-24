let audioContext;
let masterGain;
let ambienceGain;
let ambientOscillators = [];
let enabled = false;
let devilProximity = 0;

function getAudioContext() {
  if (!window.AudioContext) {
    throw new Error("This browser does not support Web Audio.");
  }

  if (!audioContext) {
    audioContext = new window.AudioContext();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(audioContext.destination);
  }

  return audioContext;
}

function startAmbience(context) {
  ambienceGain = context.createGain();
  ambienceGain.gain.value = 0.06 + devilProximity * 0.12;
  ambienceGain.connect(masterGain);

  [48, 51].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    oscillator.connect(ambienceGain);
    oscillator.start();
    ambientOscillators.push(oscillator);
  });
}

function playTone(startFrequency, endFrequency, duration, type, volume, delay = 0) {
  if (!enabled || !audioContext || !masterGain) return;

  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(masterGain);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export async function startHorrorAudio() {
  const context = getAudioContext();
  await context.resume();
  enabled = true;
  masterGain.gain.setTargetAtTime(0.45, context.currentTime, 0.15);
  if (ambientOscillators.length === 0) startAmbience(context);
}

export function stopHorrorAudio() {
  if (!audioContext || !masterGain) return;

  enabled = false;
  masterGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.08);
  ambientOscillators.forEach((oscillator) => oscillator.stop(audioContext.currentTime + 0.2));
  ambientOscillators = [];
  ambienceGain = null;
}

export function setDevilProximity(level) {
  devilProximity = Math.max(0, Math.min(1, level));
  if (enabled && audioContext && ambienceGain) {
    ambienceGain.gain.setTargetAtTime(
      0.06 + devilProximity * 0.12,
      audioContext.currentTime,
      0.35
    );
  }
}

export function playHorrorSound(sound) {
  if (!enabled) return;

  if (sound === "footsteps") {
    playTone(78, 42, 0.16, "sine", 0.18);
    playTone(72, 38, 0.16, "sine", 0.18, 0.28);
  } else if (sound === "devilStep") {
    playTone(58, 34, 0.2, "sine", 0.12);
  } else if (sound === "heartbeat") {
    playTone(62, 48, 0.18, "sine", 0.18);
    playTone(55, 42, 0.22, "sine", 0.14, 0.24);
  } else if (sound === "door") {
    playTone(130, 48, 0.55, "sawtooth", 0.13);
  } else if (sound === "growl") {
    playTone(92, 34, 0.8, "sawtooth", 0.28);
    playTone(170, 52, 0.65, "triangle", 0.1);
  } else if (sound === "match") {
    playTone(520, 210, 0.24, "sawtooth", 0.08);
  } else if (sound === "hide") {
    playTone(230, 115, 0.3, "sine", 0.1);
  }
}
