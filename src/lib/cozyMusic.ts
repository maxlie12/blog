/**
 * Cozy background music for Làng Rêu and the farm, written in the browser with the Web Audio
 * API: soft electric-piano chords, a round bass, a kalimba (village) or plucked (farm) melody,
 * brushed drums, tape hiss and birdsong. No audio file is downloaded. The melody is generated a
 * section at a time from a short motif, so it repeats like a tune but changes every time round.
 *
 * No React here; `useCozyMusic.ts` wires it to a component.
 */

export type MusicTheme = "village" | "farm";
export interface MusicSettings {
  on: boolean;
  /** 0..1 */
  volume: number;
}

export const MUSIC_KEY = "cozy-music-v1";
export const MUSIC_DEFAULTS: MusicSettings = { on: true, volume: 0.6 };

export function parseMusicSettings(raw: string | null): MusicSettings {
  if (!raw) return MUSIC_DEFAULTS;
  try {
    const value = JSON.parse(raw) as Partial<MusicSettings> | null;
    return {
      on: typeof value?.on === "boolean" ? value.on : MUSIC_DEFAULTS.on,
      volume: typeof value?.volume === "number" && Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : MUSIC_DEFAULTS.volume,
    };
  } catch {
    return MUSIC_DEFAULTS;
  }
}

/* ───────────── the two tunes ───────────── */

type Chord = number[];
interface ThemeDef {
  bpm: number;
  /** How far the off-beat eighths are pushed late, as a share of an eighth. */
  swing: number;
  /** Progressions of four bars, one chord (MIDI notes, root first) per bar. */
  sections: Chord[][];
  /** Order the sections play in; the whole form loops. */
  form: number[];
  /** Melody notes (a pentatonic scale, so any choice sounds sweet over the chords). */
  scale: number[];
  lead: "kalimba" | "pluck";
  /** Sixteenth-note positions in a bar. */
  comp: number[];
  /** [position, semitones above the root]. */
  bass: [number, number][];
  kick: number[];
  snare: number[];
  hat: number[];
}

const THEMES: Record<MusicTheme, ThemeDef> = {
  // F major, slow and warm: Fmaj7 Em7 Dm9 Cmaj7 / B♭maj7 Am7 Gm7 C7sus4.
  village: {
    bpm: 68,
    swing: 0.32,
    sections: [
      [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60, 64], [48, 52, 55, 59]],
      [[46, 50, 53, 57], [45, 48, 52, 55], [43, 46, 50, 53], [48, 53, 55, 58]],
    ],
    form: [0, 0, 1, 0],
    scale: [65, 67, 69, 72, 74, 77, 79, 81],
    lead: "kalimba",
    comp: [0, 10],
    bass: [[0, 0], [10, 7]],
    kick: [0, 10],
    snare: [8],
    hat: [0, 4, 6, 12, 14],
  },
  // C major, a little brighter with a bounce: Cmaj9 Am9 Dm7 G9 / Fmaj7 G Em7 Am7.
  farm: {
    bpm: 84,
    swing: 0.36,
    sections: [
      [[48, 52, 55, 59, 62], [45, 48, 52, 55, 59], [50, 53, 57, 60], [43, 47, 50, 53, 57]],
      [[41, 45, 48, 52], [43, 47, 50, 55], [40, 43, 47, 50], [45, 48, 52, 55]],
    ],
    form: [0, 1, 0, 1],
    scale: [72, 74, 76, 79, 81, 84, 86, 88],
    lead: "pluck",
    comp: [0, 6, 10],
    bass: [[0, 0], [6, 7], [8, 0], [14, 12]],
    kick: [0, 6, 10],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
  },
};

const RHYTHMS = [[0, 6, 8, 12], [0, 4, 10], [2, 6, 8, 14], [0, 3, 6, 10], [8, 10, 12], [0, 8, 12], [4, 6, 8]];
const CONTOURS = [[1, 1, -1, 2], [-1, 2, -1, -1], [2, -1, -1, 1], [0, 1, 2, -2], [1, -2, 1, 1]];

export interface MelodyNote {
  /** Sixteenth position inside the bar. */
  step: number;
  midi: number;
  /** Length in sixteenths. */
  steps: number;
  velocity: number;
}

function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The melody for one four-bar section: a motif, its answer, the motif again, and a long last note. */
export function sectionMelody(theme: MusicTheme, chords: Chord[], seed: number): MelodyNote[][] {
  const def = THEMES[theme];
  const r = random(seed);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
  const motif = pick(RHYTHMS);
  const answer = pick(RHYTHMS);
  const contour = pick(CONTOURS);
  let index = 2 + Math.floor(r() * 3);
  return chords.map((chord, bar) => {
    const classes = new Set(chord.map((midi) => midi % 12));
    const isChordTone = (i: number) => classes.has(def.scale[i] % 12);
    const rhythm = bar === 3 ? [0, 8].slice(0, 1 + Math.floor(r() * 2)) : bar % 2 === 0 ? motif : answer;
    return rhythm.map((step, i) => {
      index = Math.min(def.scale.length - 1, Math.max(0, index + contour[(i + bar) % contour.length]));
      // Strong beats land on a note of the chord.
      if (step % 8 === 0 && !isChordTone(index)) {
        const near = [index - 1, index + 1, index - 2, index + 2].find((i2) => i2 >= 0 && i2 < def.scale.length && isChordTone(i2));
        if (near !== undefined) index = near;
      }
      const next = rhythm[i + 1] ?? 16;
      return { step, midi: def.scale[index], steps: next - step, velocity: 0.7 + r() * 0.3 };
    });
  });
}

/* ───────────── sound making ───────────── */

const mtof = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const SILENT = 0.0001;

interface Song {
  master: GainNode;
  /** Plays everything up to this context time. */
  scheduleUntil(time: number): void;
  restartAt(time: number): void;
  setCalm(calm: boolean): void;
}

function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function makeRoom(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
}

/** A plucked string (Karplus–Strong), computed once per pitch. */
function makePluck(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * 1.6);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const period = Math.max(2, Math.round(rate / mtof(midi)));
  const ring = new Float32Array(period);
  let previous = 0;
  for (let i = 0; i < period; i += 1) {
    // Softened noise burst: a warmer, nylon-like attack.
    previous = previous * 0.55 + (Math.random() * 2 - 1) * 0.45;
    ring[i] = previous;
  }
  let at = 0;
  for (let i = 0; i < length; i += 1) {
    const current = ring[at];
    const following = ring[(at + 1) % period];
    ring[at] = (current + following) * 0.4975;
    data[i] = current;
    at = (at + 1) % period;
  }
  return buffer;
}

function createSong(theme: MusicTheme, ctx: BaseAudioContext): Song {
  const def = THEMES[theme];
  const sixteenth = 60 / def.bpm / 4;
  const noise = makeNoise(ctx);
  const plucks = new Map<number, AudioBuffer>();
  if (def.lead === "pluck") for (const midi of def.scale) plucks.set(midi, makePluck(ctx, midi));

  const master = ctx.createGain();
  master.gain.value = 0;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.knee.value = 10;
  limiter.ratio.value = 4;
  limiter.attack.value = 0.005;
  limiter.release.value = 0.25;
  master.connect(limiter).connect(ctx.destination);
  // Everything goes through a gentle low-pass: the soft, slightly worn "lofi" colour.
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 5200;
  tone.Q.value = 0.3;
  tone.connect(master);
  const bus = ctx.createGain();
  bus.connect(tone);
  const room = ctx.createConvolver();
  room.buffer = makeRoom(ctx, 2.4);
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  bus.connect(wet).connect(room).connect(tone);

  // Tape hiss, very quiet.
  const hiss = ctx.createBufferSource();
  hiss.buffer = noise;
  hiss.loop = true;
  const hissBand = ctx.createBiquadFilter();
  hissBand.type = "bandpass";
  hissBand.frequency.value = 3500;
  hissBand.Q.value = 0.4;
  const hissLevel = ctx.createGain();
  hissLevel.gain.value = 0.012;
  hiss.connect(hissBand).connect(hissLevel).connect(master);
  hiss.start();

  let calm = false;
  let step = 0;
  let nextTime = 0;
  let seed = Math.floor(Math.random() * 1e9);
  let melody: MelodyNote[][] = [];
  let melodyOn = false;
  let loop = 0;

  function voice(start: number, gain: number, attack: number, decay: number, end: number, target: AudioNode): GainNode {
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(SILENT, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + attack);
    if (decay > 0) amp.gain.setTargetAtTime(gain * 0.3, start + attack, decay);
    amp.gain.setTargetAtTime(SILENT, end, 0.09);
    amp.connect(target);
    return amp;
  }

  function panned(pan: number, target: AudioNode): AudioNode {
    const node = ctx.createStereoPanner();
    node.pan.value = pan;
    node.connect(target);
    return node;
  }

  /** Electric piano: a sine with a sine frequency-modulating it, bright at the start. */
  function keys(midi: number, start: number, length: number, velocity: number) {
    const f = mtof(midi);
    const end = start + Math.max(0.25, length);
    const carrier = ctx.createOscillator();
    carrier.frequency.value = f;
    const modulator = ctx.createOscillator();
    modulator.frequency.value = f;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(f * 1.1 * velocity, start);
    depth.gain.setTargetAtTime(f * 0.12, start, 0.18);
    modulator.connect(depth).connect(carrier.frequency);
    carrier.connect(voice(start, 0.06 * velocity, 0.012, 0.45, end, bus));
    carrier.start(start);
    modulator.start(start);
    carrier.stop(end + 0.6);
    modulator.stop(end + 0.6);
  }

  function bass(midi: number, start: number, length: number, velocity: number) {
    const end = start + Math.max(0.2, length * 0.9);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = mtof(midi);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    osc.connect(filter).connect(voice(start, 0.2 * velocity, 0.015, 0.6, end, bus));
    osc.start(start);
    osc.stop(end + 0.5);
  }

  function kalimba(midi: number, start: number, velocity: number) {
    const f = mtof(midi);
    const out = panned((Math.random() - 0.5) * 0.5, bus);
    for (const [ratio, peak, decay] of [[1, 0.075, 0.5], [2, 0.012, 0.12], [5.4, 0.02, 0.02]] as const) {
      const osc = ctx.createOscillator();
      osc.frequency.value = f * ratio;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(SILENT, start);
      amp.gain.exponentialRampToValueAtTime(peak * velocity * (calm ? 0.7 : 1), start + 0.003);
      amp.gain.setTargetAtTime(SILENT, start + 0.003, decay);
      osc.connect(amp).connect(out);
      osc.start(start);
      osc.stop(start + decay * 8 + 0.1);
    }
  }

  function pluck(midi: number, start: number, velocity: number) {
    const buffer = plucks.get(midi) ?? makePluck(ctx, midi);
    plucks.set(midi, buffer);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3200;
    const amp = ctx.createGain();
    amp.gain.value = 0.16 * velocity;
    source.connect(filter).connect(amp).connect(panned((Math.random() - 0.5) * 0.5, bus));
    source.start(start);
  }

  function noiseHit(start: number, type: BiquadFilterType, frequency: number, level: number, decay: number, pan = 0) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(SILENT, start);
    amp.gain.exponentialRampToValueAtTime(level, start + 0.004);
    amp.gain.exponentialRampToValueAtTime(SILENT, start + decay);
    source.connect(filter).connect(amp).connect(pan ? panned(pan, bus) : bus);
    source.start(start, Math.random() * 1.5, decay + 0.05);
  }

  function kick(start: number) {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(110, start);
    osc.frequency.exponentialRampToValueAtTime(44, start + 0.12);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(SILENT, start);
    amp.gain.exponentialRampToValueAtTime(0.32, start + 0.004);
    amp.gain.exponentialRampToValueAtTime(SILENT, start + 0.32);
    osc.connect(amp).connect(bus);
    osc.start(start);
    osc.stop(start + 0.35);
  }

  function bird(start: number) {
    const count = 2 + Math.floor(Math.random() * 3);
    const base = 2600 + Math.random() * 1400;
    const out = panned(Math.random() * 1.4 - 0.7, bus);
    for (let i = 0; i < count; i += 1) {
      const at = start + i * (0.12 + Math.random() * 0.06);
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(base, at);
      osc.frequency.exponentialRampToValueAtTime(base * 1.45, at + 0.05);
      osc.frequency.exponentialRampToValueAtTime(base * 1.1, at + 0.1);
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(SILENT, at);
      amp.gain.exponentialRampToValueAtTime(0.018, at + 0.02);
      amp.gain.exponentialRampToValueAtTime(SILENT, at + 0.11);
      osc.connect(amp).connect(out);
      osc.start(at);
      osc.stop(at + 0.13);
    }
  }

  function crickets(start: number) {
    const out = panned(Math.random() * 1.6 - 0.8, bus);
    for (let phrase = 0; phrase < 3; phrase += 1) {
      for (let pulse = 0; pulse < 3; pulse += 1) {
        const at = start + phrase * 0.5 + pulse * 0.05;
        const osc = ctx.createOscillator();
        osc.frequency.value = 4700;
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(SILENT, at);
        amp.gain.exponentialRampToValueAtTime(0.008, at + 0.01);
        amp.gain.exponentialRampToValueAtTime(SILENT, at + 0.035);
        osc.connect(amp).connect(out);
        osc.start(at);
        osc.stop(at + 0.05);
      }
    }
  }

  function scheduleStep(s: number, time: number) {
    const bar = Math.floor(s / 16);
    const pos = s % 16;
    const loopBars = def.form.length * 4;
    const barInLoop = bar % loopBars;
    const section = Math.floor(barInLoop / 4);
    const chords = def.sections[def.form[section]];
    const chord = chords[barInLoop % 4];
    if (pos === 0 && barInLoop % 4 === 0) {
      if (barInLoop === 0 && bar > 0) loop += 1;
      melody = sectionMelody(theme, chords, seed + loop * 7919 + section * 101);
      // The first section is an intro; after that the melody rests now and then.
      melodyOn = !(loop === 0 && section === 0) && Math.random() < 0.85;
    }
    const at = time + (pos % 4 === 2 ? def.swing * sixteenth * 2 : 0);
    // Slightly late, never early: a relaxed, played-by-hand feel.
    const human = () => Math.random() * 0.012;

    const compIndex = def.comp.indexOf(pos);
    if (compIndex >= 0) {
      const length = ((def.comp[compIndex + 1] ?? 16) - pos) * sixteenth;
      chord.forEach((midi, i) => keys(midi, at + i * 0.016 + human(), length, pos === 0 ? 0.9 : 0.6));
    }
    for (const [position, interval] of def.bass) {
      if (position !== pos) continue;
      let root = chord[0] - 12;
      if (root < 33) root += 12;
      const nextBass = def.bass.find(([p]) => p > pos)?.[0] ?? 16;
      bass(root + interval, at, (nextBass - pos) * sixteenth, pos === 0 ? 1 : 0.75);
    }
    if (melodyOn) {
      for (const note of melody[barInLoop % 4]) {
        if (note.step !== pos) continue;
        if (def.lead === "kalimba") kalimba(note.midi, at + human(), note.velocity);
        else pluck(note.midi, at + human(), note.velocity * (calm ? 0.7 : 1));
      }
    }
    if (!calm && !(loop === 0 && section === 0)) {
      if (def.kick.includes(pos)) kick(at);
      if (def.snare.includes(pos)) noiseHit(at, "bandpass", 2100, 0.05, 0.2);
      if (def.hat.includes(pos)) noiseHit(at + human(), "highpass", 7000, pos % 4 === 0 ? 0.022 : 0.014, 0.05, 0.25);
    }
    // Vinyl crackle and, now and then, birds by day or crickets at night.
    if (pos % 2 === 0 && Math.random() < 0.12) noiseHit(at + Math.random() * sixteenth, "highpass", 2500, 0.03 + Math.random() * 0.03, 0.006);
    if (pos === 0 && Math.random() < (calm ? 0.5 : 0.22)) {
      const when = at + Math.random() * 16 * sixteenth;
      if (calm) crickets(when);
      else bird(when);
    }
  }

  return {
    master,
    scheduleUntil(time: number) {
      while (nextTime < time) {
        scheduleStep(step, nextTime);
        step += 1;
        nextTime += sixteenth;
      }
    },
    restartAt(time: number) {
      // After a stall (a throttled timer), carry on from now instead of rushing to catch up.
      if (nextTime < time) nextTime = time;
      seed += 1;
    },
    setCalm(value: boolean) {
      calm = value;
      tone.frequency.setTargetAtTime(value ? 2400 : 5200, ctx.currentTime, 1.5);
    },
  };
}

/** Master gain for a 0..1 volume (ears hear loudness roughly logarithmically). */
const level = (volume: number) => 1.25 * volume * volume;

export interface CozyMusic {
  /** Fades in or out. The first start must happen inside a tap or key press. */
  setPlaying(playing: boolean): void;
  setVolume(volume: number): void;
  /** Night: no drums, a darker tone, crickets instead of birds. */
  setCalm(calm: boolean): void;
  isRunning(): boolean;
  dispose(): void;
}

/** Live music on the speakers, or null when the browser has no Web Audio. */
export function createCozyMusic(theme: MusicTheme, volume: number, calm = false): CozyMusic | null {
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  let ctx: AudioContext | null = null;
  let song: Song | null = null;
  let timer = 0;
  let stopTimer = 0;
  let wanted = false;
  let disposed = false;
  let currentVolume = volume;
  let currentCalm = calm;

  function pump() {
    if (!ctx || !song || ctx.state !== "running") return;
    song.scheduleUntil(ctx.currentTime + 0.35);
  }

  function fade(target: number, seconds: number) {
    if (!ctx || !song) return;
    const gain = song.master.gain;
    gain.cancelScheduledValues(ctx.currentTime);
    gain.setValueAtTime(gain.value, ctx.currentTime);
    gain.setTargetAtTime(target, ctx.currentTime, seconds / 3);
  }

  return {
    setPlaying(playing) {
      if (disposed) return;
      wanted = playing;
      window.clearTimeout(stopTimer);
      if (!playing) {
        if (!ctx || ctx.state !== "running") return;
        fade(0, 0.6);
        stopTimer = window.setTimeout(() => {
          if (wanted || !ctx) return;
          window.clearInterval(timer);
          timer = 0;
          void ctx.suspend();
        }, 900);
        return;
      }
      if (!ctx) {
        ctx = new Context();
        song = createSong(theme, ctx);
        song.setCalm(currentCalm);
      }
      const context = ctx;
      // resume() must be called synchronously inside the gesture for iOS Safari.
      context.resume().then(() => {
        if (disposed || !wanted || !song) return;
        if (!timer) {
          song.restartAt(context.currentTime + 0.1);
          timer = window.setInterval(pump, 60);
          pump();
        }
        fade(level(currentVolume), 2.5);
      }, () => {});
    },
    setVolume(next) {
      currentVolume = next;
      if (wanted && ctx?.state === "running") fade(level(next), 0.3);
    },
    setCalm(next) {
      currentCalm = next;
      song?.setCalm(next);
    },
    isRunning: () => !!ctx && ctx.state === "running" && timer !== 0,
    dispose() {
      disposed = true;
      window.clearInterval(timer);
      window.clearTimeout(stopTimer);
      void ctx?.close().catch(() => {});
    },
  };
}

/** Renders a stretch of the music offline, for checking its level without speakers. */
export function renderCozyMusic(theme: MusicTheme, seconds: number, volume: number, calm = false): Promise<AudioBuffer> {
  const rate = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
  const song = createSong(theme, ctx);
  song.setCalm(calm);
  song.master.gain.value = level(volume);
  song.scheduleUntil(seconds);
  return ctx.startRendering();
}
