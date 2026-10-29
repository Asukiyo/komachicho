// All recordings are original, generated ambience bundled with the game.
// AudioContext.resume is called directly from the sound button's user gesture.
import { assetUrl } from "@/lib/assets";
export class TownAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private loops: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  private footstep: AudioBuffer | null = null;
  private pending: Promise<void> | null = null;
  private abort = new AbortController();
  private enabled = false;
  private disposed = false;
  private nextStep = 0;

  async toggle(): Promise<boolean> {
    if (this.disposed) return false;
    this.context ??= new AudioContext();
    const context = this.context;
    await context.resume();
    this.enabled = !this.enabled;
    if (!this.master) { this.master = context.createGain(); this.master.gain.value = 0; this.master.connect(context.destination); }
    if (!this.pending) this.pending = this.load(context).catch(error => {
      this.enabled = false; this.pending = null; throw error;
    });
    await this.pending;
    return !this.disposed && this.enabled;
  }

  private async load(context: AudioContext) {
    const buffers = await Promise.all(["Day", "Night", "River", "Footstep"].map(async name => {
      const response = await fetch(assetUrl(`audio/${name}.wav`), { signal: this.abort.signal });
      if (!response.ok) throw new Error("環境音を読み込めませんでした。もう一度お試しください。");
      return context.decodeAudioData(await response.arrayBuffer());
    }));
    if (this.disposed) return;
    this.footstep = buffers[3];
    for (const buffer of buffers.slice(0, 3)) {
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer; source.loop = true; gain.gain.value = 0;
      source.connect(gain); gain.connect(this.master!); source.start(); this.loops.push({ source, gain });
    }
  }

  update(daylight: number, riverDistance: number, indoors: boolean, paused: boolean, speed: number) {
    const c = this.context; if (!c || !this.master || this.disposed) return;
    const time = c.currentTime;
    this.master.gain.setTargetAtTime(this.enabled ? (paused ? .25 : .65) : 0, time, .25);
    const inside = indoors ? .15 : 1;
    const levels = [.5 * daylight * inside, .45 * (1 - daylight) * inside, .8 * Math.max(0, 1 - riverDistance / 22) * inside];
    this.loops.forEach((loop, i) => loop.gain.gain.setTargetAtTime(levels[i], time, .7));
    if (this.enabled && !paused && speed > .2 && this.footstep && time > this.nextStep) {
      const source = c.createBufferSource(), gain = c.createGain(); source.buffer = this.footstep;
      source.playbackRate.value = indoors ? .82 : 1; gain.gain.value = indoors ? .16 : .24;
      source.connect(gain); gain.connect(this.master); source.onended = () => { source.disconnect(); gain.disconnect(); }; source.start();
      this.nextStep = time + (speed > 3.5 ? .26 : .4);
    }
  }

  dispose() {
    this.disposed = true; this.abort.abort(); this.loops.forEach(loop => { loop.source.stop(); loop.source.disconnect(); loop.gain.disconnect(); });
    if (this.context) void this.context.close();
  }
}
