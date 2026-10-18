/**
 * Web Audio synthesis for the city.
 *
 * No audio files: traffic rumble is filtered noise, the era bed is a small
 * oscillator pad plus a hum, and every era change fires a short synthesized
 * stinger. The AudioContext is created on the first user gesture so browser
 * autoplay policies are respected; `dispose()` stops every source and closes it.
 */
import type { EraDefinition } from './eras';

export interface AudioSnapshot {
  /** True once a gesture created the AudioContext. */
  unlocked: boolean;
  /** True when the master gain is muted. */
  muted: boolean;
  /** `suspended`, `running`, `closed` — or `uninitialized` before a gesture. */
  state: AudioContextState | 'uninitialized';
  /** Number of era-switch stingers triggered. */
  stingers: number;
  era: number;
}

interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

export class CityAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private hum: OscillatorNode | null = null;
  private padOscillators: OscillatorNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private muted = false;
  private unlocked = false;
  private stingers = 0;
  private era: EraDefinition;
  private disposed = false;

  constructor(era: EraDefinition) {
    this.era = era;
  }

  /** Create/resume the AudioContext. Must be called from a user gesture. */
  unlock(): void {
    if (this.disposed) return;
    if (!this.context) {
      const Constructor =
        window.AudioContext ?? (window as unknown as WebkitWindow).webkitAudioContext;
      if (!Constructor) return;
      try {
        this.context = new Constructor();
      } catch {
        return;
      }
      this.build(this.context);
    }
    if (this.context.state === 'suspended') {
      void this.context.resume().catch(() => undefined);
    }
    this.unlocked = true;
    this.applyGain(0.6);
  }

  /** Build the persistent ambient graph. */
  private build(context: AudioContext): void {
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : 0;
    master.connect(context.destination);
    this.master = master;

    const bed = context.createGain();
    bed.gain.value = 0.5;
    bed.connect(master);

    // Traffic: looping noise through a resonant low-pass.
    const length = Math.floor(context.sampleRate * 2);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      // Brown-ish noise reads more like distant traffic than white noise.
      previous = (previous + 0.02 * white) / 1.02;
      data[i] = previous * 3.4;
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.era.audio.rumble;
    filter.Q.value = 0.7;
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0.5;
    noise.connect(filter).connect(noiseGain).connect(bed);
    noise.start();
    this.sources.push(noise);
    this.noiseFilter = filter;

    // LFO so the traffic swells and fades.
    const lfo = context.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.18;
    lfo.connect(lfoGain).connect(noiseGain.gain);
    lfo.start();
    this.sources.push(lfo);

    // Low city hum.
    const hum = context.createOscillator();
    hum.type = 'triangle';
    hum.frequency.value = this.era.audio.hum;
    const humGain = context.createGain();
    humGain.gain.value = 0.035;
    hum.connect(humGain).connect(bed);
    hum.start();
    this.sources.push(hum);
    this.hum = hum;

    // Era pad: three detuned sines with a slow tremolo.
    this.era.audio.pad.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 1 ? 6 : index === 2 ? -7 : 0;
      const gain = context.createGain();
      gain.gain.value = 0.022 / (index + 1);
      oscillator.connect(gain).connect(bed);
      oscillator.start();
      this.sources.push(oscillator);
      this.padOscillators.push(oscillator);
    });

    // Crowd murmur: a second, quieter noise band.
    const crowd = context.createBufferSource();
    crowd.buffer = buffer;
    crowd.loop = true;
    const crowdFilter = context.createBiquadFilter();
    crowdFilter.type = 'bandpass';
    crowdFilter.frequency.value = 900;
    crowdFilter.Q.value = 0.6;
    const crowdGain = context.createGain();
    crowdGain.gain.value = this.era.audio.crowd;
    crowd.connect(crowdFilter).connect(crowdGain).connect(bed);
    crowd.start();
    this.sources.push(crowd);
    if (this.context) {
      this.crowdGain = crowdGain;
    }
    this.crowdFilter = crowdFilter;
  }

  private crowdGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private stingerGain: GainNode | null = null;

  private applyGain(ramp = 0.12): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const target = this.muted ? 0 : 0.55;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(target, now, Math.max(0.02, ramp));
  }

  /** Toggle mute. Works before unlock: the state is applied when audio starts. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.context && this.master) {
      this.applyGain();
    }
  }

  /** Fire an era-switch stinger and morph the ambient bed to the new era. */
  setEra(era: EraDefinition): void {
    this.era = era;
    this.stingers += 1;
    if (this.context && this.master && !this.muted && !this.disposed) {
      this.playStinger(this.context, this.master, era);
    }
    this.morph(era);
  }

  private morph(era: EraDefinition): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const glide = (param: AudioParam | undefined, value: number) => {
      if (!param) return;
      param.cancelScheduledValues(now);
      param.setTargetAtTime(value, now, 0.4);
    };
    glide(this.noiseFilter?.frequency, era.audio.rumble);
    glide(this.hum?.frequency, era.audio.hum);
    glide(this.crowdGain?.gain, era.audio.crowd);
    glide(this.crowdFilter?.frequency, era.year >= 1985 ? 1300 : 800);
    this.padOscillators.forEach((oscillator, index) => {
      glide(oscillator.frequency, era.audio.pad[index] ?? era.audio.pad[0]);
    });
  }

  private playStinger(context: AudioContext, master: GainNode, era: EraDefinition): void {
    const now = context.currentTime;
    const bus = context.createGain();
    bus.gain.value = 0;
    bus.connect(master);
    this.stingerGain = bus;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.35);
    filter.Q.value = 1.2;
    filter.connect(bus);

    const chord = era.audio.pad.map((frequency) => frequency * 4);
    chord.slice(0, 3).forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency * 0.5, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency, now + 0.28);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.16 / (index + 1), now + 0.045);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
      oscillator.connect(gain).connect(filter);
      oscillator.start(now);
      oscillator.stop(now + 1.2);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });

    // A short noise "sweep" gives the stinger an airy whoosh.
    const length = Math.floor(context.sampleRate * 0.7);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const fade = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * fade * fade * 0.4;
    }
    const sweep = context.createBufferSource();
    sweep.buffer = buffer;
    const sweepFilter = context.createBiquadFilter();
    sweepFilter.type = 'highpass';
    sweepFilter.frequency.setValueAtTime(300, now);
    sweepFilter.frequency.exponentialRampToValueAtTime(4200, now + 0.5);
    const sweepGain = context.createGain();
    sweepGain.gain.value = 0.22;
    sweep.connect(sweepFilter).connect(sweepGain).connect(bus);
    sweep.start(now);
    sweep.onended = () => {
      sweep.disconnect();
      sweepFilter.disconnect();
      sweepGain.disconnect();
      filter.disconnect();
    };

    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + 0.04);
    bus.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
    window.setTimeout(() => {
      bus.disconnect();
    }, 1400);
  }

  snapshot(): AudioSnapshot {
    return {
      unlocked: this.unlocked,
      muted: this.muted,
      state: this.context ? this.context.state : 'uninitialized',
      stingers: this.stingers,
      era: this.era.year,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped — safe to ignore.
      }
      try {
        source.disconnect();
      } catch {
        // Already disconnected.
      }
    }
    this.sources = [];
    this.padOscillators = [];
    this.stingerGain?.disconnect();
    this.stingerGain = null;
    if (this.context) {
      const context = this.context;
      this.context = null;
      if (context.state !== 'closed') {
        void context.close().catch(() => undefined);
      }
    }
    this.master = null;
    this.noiseFilter = null;
    this.hum = null;
    this.crowdGain = null;
    this.crowdFilter = null;
  }
}
