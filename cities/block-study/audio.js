export function makeAudio(initial) {
  let era = initial;
  let active = false;
  let generation = 0;
  let bus;
  let timer;
  const oneShots = new Set();

  function createBus() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Web Audio unavailable');
    const context = new Context();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    // Pink-ish street noise feeds separate low traffic and high curbside layers.
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const data = buffer.getChannelData(0);
    let filtered = 0;
    for (let i = 0; i < data.length; i++) {
      filtered = .74 * filtered + (Math.random() - .5) * .26;
      data[i] = filtered;
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const traffic = context.createBiquadFilter();
    traffic.type = 'lowpass';
    const roadVolume = context.createGain();
    roadVolume.gain.value = .42;
    noise.connect(traffic).connect(roadVolume).connect(master);

    const street = context.createBiquadFilter();
    street.type = 'bandpass';
    street.Q.value = .82;
    const curbVolume = context.createGain();
    curbVolume.gain.value = .24;
    noise.connect(street).connect(curbVolume).connect(master);

    const motor = context.createOscillator();
    const motorVolume = context.createGain();
    motor.type = 'triangle';
    motor.connect(motorVolume).connect(master);
    const wobble = context.createOscillator();
    const wobbleDepth = context.createGain();
    wobble.frequency.value = .61;
    wobbleDepth.gain.value = 4.4;
    wobble.connect(wobbleDepth).connect(motor.frequency);
    noise.start();
    motor.start();
    wobble.start();
    return { context, master, traffic, street, motor, motorVolume };
  }

  function clearEvents() {
    clearTimeout(timer);
    for (const tone of oneShots) {
      tone.stop();
      tone.disconnect();
    }
    oneShots.clear();
  }

  function cue() {
    if (!active) return;
    const { context, master } = bus;
    const now = context.currentTime;
    const { audio } = era;
    const tone = context.createOscillator();
    const level = context.createGain();
    tone.type = audio.electric ? 'sine' : 'triangle';
    tone.frequency.setValueAtTime(audio.horn, now);
    tone.frequency.exponentialRampToValueAtTime(audio.horn * (audio.electric ? 1.45 : .87), now + .32);
    level.gain.setValueAtTime(.0001, now);
    level.gain.exponentialRampToValueAtTime(audio.electric ? .038 : .069, now + .065);
    level.gain.exponentialRampToValueAtTime(.0001, now + .534);
    tone.connect(level).connect(master);
    oneShots.add(tone);
    tone.onended = () => { oneShots.delete(tone); tone.disconnect(); level.disconnect(); };
    tone.start(now);
    tone.stop(now + .56);
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (active) timer = setTimeout(cue, era.audio.interval * (750 + Math.random() * 300));
  }

  function setEra(next) {
    era = next;
    if (!bus) return;
    clearEvents();
    const at = bus.context.currentTime;
    bus.traffic.frequency.setTargetAtTime(era.audio.texture, at, .13);
    bus.street.frequency.setTargetAtTime(era.audio.street, at, .16);
    bus.motor.frequency.setTargetAtTime(era.audio.motor, at, .20);
    bus.motorVolume.gain.setTargetAtTime(era.audio.electric ? .016 : .036, at, .13);
    schedule();
  }

  async function start() {
    const token = ++generation;
    bus ??= createBus();
    const { context, master } = bus;
    await context.resume();
    if (generation !== token || context.state !== 'running') return false;
    active = true;
    setEra(era);
    master.gain.setTargetAtTime(.72, context.currentTime, .08);
    return true;
  }

  function stop() {
    generation++;
    active = false;
    clearEvents();
    if (bus && bus.context.state !== 'closed') {
      bus.master.gain.cancelScheduledValues(bus.context.currentTime);
      bus.master.gain.setValueAtTime(0, bus.context.currentTime);
    }
  }

  function dispose() {
    stop();
    if (!bus) return;
    const { context, master } = bus;
    bus = undefined;
    master.disconnect();
    if (context.state !== 'closed') {
      void context.close().catch((error) => {
        if (context.state !== 'closed') console.warn('City sound could not close its audio context.', error);
      });
    }
  }

  return { start, stop, setEra, dispose };
}
