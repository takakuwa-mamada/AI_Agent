
let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentGain: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let rafId: number | null = null;

export async function resumeAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
}

export function stopPlayback() {
  try { currentSource?.stop(); } catch {}
  try { currentSource?.disconnect(); } catch {}
  try { currentGain?.disconnect(); } catch {}
  try { analyser?.disconnect(); } catch {}
  currentSource = null;
  currentGain = null;
  analyser = null;
  if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
}

export async function playVoiceVox(
  text: string,
  speaker: number,
  mouthLevelCallback?: (level01: number) => void,
) {
  await resumeAudio();
  stopPlayback();

  const res = await fetch('/api/voicevox/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speaker }),
  });
  if (!res.ok) {
    let msg = '';
    try { msg = await res.text(); } catch {}
    throw new Error(`VOICEVOX TTS failed: ${res.status} ${msg}`);
  }
  const arr = await res.arrayBuffer();
  const buf = await audioCtx!.decodeAudioData(arr.slice(0));
  const src = audioCtx!.createBufferSource();
  const gain = audioCtx!.createGain();
  const an = audioCtx!.createAnalyser();
  an.fftSize = 1024;

  src.buffer = buf;
  src.connect(gain);
  gain.connect(an);
  an.connect(audioCtx!.destination);

  currentSource = src;
  currentGain = gain;
  analyser = an;

  const data = new Uint8Array(analyser.frequencyBinCount);
  const loop = () => {
    if (!analyser) return;
    analyser.getByteTimeDomainData(data);
    const mean = data.reduce((s, v) => s + Math.pow((v - 128) / 128, 2), 0) / data.length;
    const rms = Math.sqrt(mean);
    if (mouthLevelCallback) mouthLevelCallback(Math.min(1, Math.max(0, rms * 3)));
    rafId = requestAnimationFrame(loop);
  };
  loop();

  await new Promise<void>((resolve, reject) => {
    src.onended = () => resolve();
    try { src.start(0); } catch (e) { reject(e); }
  });

  stopPlayback();
}
