// Web Audio engine for MOMOBLOBS games: the original Track Momo SFX + music loops plus the
// arcade pack (per-game music, funny SFX, character voices). Master / music / SFX buses,
// music ducking under SFX (like the video mix), stereo panning + a small room reverb for a
// wide "surround" feel, seamless loop scheduling, iOS unlock, and optional spoken voice-over.

export type SfxName =
  | "pop" | "popBig" | "boing" | "hop" | "squish" | "thud" | "lift" | "whoosh" | "whooshShort" | "whooshLong"
  | "swoosh" | "slide" | "clack" | "tick" | "tock" | "drumroll" | "impact" | "tada" | "sparkle" | "confetti"
  | "sadtrombone" | "snicker" | "sting" | "gibberK" | "gibberKShort" | "gibberT" | "hmm" | "rewind"
  | "lightsOff" | "lightsOn";

/** arcade pack sound effects (file: /audio/arcade/sfx_<name>.mp3) */
export type ArcadeSfx =
  | "bubble" | "bubbles" | "splash" | "gulp" | "slap" | "ding" | "chime" | "bwomp" | "squelch" | "splat" | "wobble"
  | "honk" | "kazoo" | "slideUp" | "slideDown" | "whistle" | "scratch" | "chalk" | "bell" | "page" | "snore" | "zap"
  | "ufo" | "teleport" | "blink" | "tink" | "shutter" | "heartbeat" | "coin" | "blip" | "levelup" | "perfect" | "fail"
  | "whooshIn" | "whooshOut" | "scramble" | "poof" | "drip" | "tickHi" | "go" | "applause" | "ooh" | "aww" | "giggle"
  | "doorOpen" | "doorClose" | "register" | "plop" | "croak" | "tweet" | "sparks" | "robodance" | "cork" | "stone" | "sink" | "topple" | "nomnom"
  | "bonk" | "squeak" | "rocket" | "crunch" | "slosh" | "click" | "twinkle" | "sizzle" | "gong" | "curtain" | "creak" | "clunk" | "buzz" | "cheer"
  // racing pack (scripts/gen_racing_audio.py)
  | "race_screech" | "race_screechLong" | "race_blowoff" | "race_shift" | "race_backfire" | "race_crackle" | "race_crash"
  | "race_crunch" | "race_scrape" | "race_nitro" | "race_shockwave" | "race_beep" | "race_beepGo" | "race_go" | "race_crowd"
  | "race_airhorn" | "race_finish" | "race_checkpoint" | "race_coin" | "race_nearMiss" | "race_explosion" | "race_horn"
  | "race_land" | "race_jump" | "race_pickup" | "race_shield" | "race_magnet" | "race_lap" | "race_finalLap" | "race_win"
  | "race_lose" | "race_fire" | "race_eliminated" | "race_perfect" | "race_takedown"
  // Highway Heat pack
  | "race_siren" | "race_yelp" | "race_radio"
  // Moto Rush GP pack
  | "race_rev";

/** "a:<arcade sfx>" or "v:<character>_<mood>" (file: /audio/arcade/voice_<x>.mp3) */
export type Sound = SfxName | `a:${ArcadeSfx}` | `v:${string}`;

export type MusicName =
  | "playful" | "think" | "shuffle_easy" | "shuffle_medium" | "shuffle_hard" | "tension" | "celebrate" | "replay"
  | `a:${string}`;

export interface SfxOptions { gain?: number; pan?: number; rate?: number; delay?: number; duck?: boolean; reverb?: number }

const BASE = "/audio/";
const MUSIC_META: Record<string, { loop: number; gain?: number }> = {
  playful: { loop: 17.142857 },
  think: { loop: 18.461538 },
  shuffle_easy: { loop: 15 },
  shuffle_medium: { loop: 13.241379 },
  shuffle_hard: { loop: 11.851852 },
  tension: { loop: 10.666667 },
  celebrate: { loop: 7.741935 },
  replay: { loop: 20.869565 },
  "a:fish_calm": { loop: 20 },
  "a:fish_action": { loop: 16.99115 },
  "a:sneak_calm": { loop: 17.777778, gain: 1.35 },
  "a:sneak_action": { loop: 15.11811, gain: 1.15 },
  "a:clash_calm": { loop: 16 },
  "a:clash_action": { loop: 13.617021 },
  "a:blink_calm": { loop: 20.869565 },
  "a:blink_action": { loop: 17.777778 },
  "a:zib_calm": { loop: 18.461538 },
  "a:zib_action": { loop: 15.737705 },
  "a:bridge_calm": { loop: 17.142857 },
  "a:bridge_action": { loop: 15 },
  "a:pantry_calm": { loop: 19.2, gain: 1.3 },
  "a:pantry_action": { loop: 16.842105, gain: 1.3 },
  "a:beeps_calm": { loop: 16 },
  "a:beeps_action": { loop: 13.913043 },
  "a:cafe_calm": { loop: 20 },
  "a:cafe_action": { loop: 17.454545 },
  "a:glow_calm": { loop: 19.2 },
  "a:glow_action": { loop: 16.842105 },
  "a:shadow_calm": { loop: 20.869565, gain: 1.40 },
  "a:shadow_action": { loop: 18.285714, gain: 1.36 },
  "a:guard_calm": { loop: 16.551724, gain: 0.75 },
  "a:guard_action": { loop: 14.43609, gain: 0.75 },
  "a:quick_calm": { loop: 22.857143, gain: 1.22 },
  "a:quick_action": { loop: 20.0 },
  "a:whack_calm": { loop: 14.545455, gain: 1.50 },
  "a:whack_action": { loop: 12.715232, gain: 1.40 },
  "a:voices_calm": { loop: 18.461538, gain: 1.33 },
  "a:voices_action": { loop: 16.134454 },
  "a:heist_calm": { loop: 20.0, gain: 1.80 },
  "a:heist_action": { loop: 17.454545, gain: 1.76 },
  "a:oddblob_calm": { loop: 19.2 },
  "a:oddblob_action": { loop: 16.842105 },
  "a:parade_calm": { loop: 17.142857, gain: 1.44 },
  "a:parade_action": { loop: 15.0, gain: 1.41 },
  "a:doors_calm": { loop: 16.0, gain: 0.80 },
  "a:doors_action": { loop: 13.913043, gain: 0.75 },
  "a:balance_calm": { loop: 20.0 },
  "a:balance_action": { loop: 17.454545 },
  "a:jars_calm": { loop: 15.483871 },
  "a:jars_action": { loop: 13.521127 },
  "a:count_calm": { loop: 17.454545 },
  "a:count_action": { loop: 15.238095 },
  "a:turbo_calm": { loop: 13.714286, gain: 0.75 },
  "a:turbo_action": { loop: 11.925466, gain: 0.75 },
  "a:bake_calm": { loop: 17.142857 },
  "a:bake_action": { loop: 15.0 },
  "a:slices_calm": { loop: 17.777778 },
  "a:slices_action": { loop: 15.483871 },
  "a:ninja_calm": { loop: 20.0 },
  "a:ninja_action": { loop: 17.454545 },
  "a:ship_calm": { loop: 21.333333 },
  "a:ship_action": { loop: 18.640777 },
  "a:pipes_calm": { loop: 18.461538, gain: 1.80 },
  "a:pipes_action": { loop: 16.134454, gain: 1.30 },
  "a:firefly_calm": { loop: 26.666667, gain: 1.68 },
  "a:firefly_action": { loop: 23.414634, gain: 1.80 },
  "a:maze_calm": { loop: 15.0 },
  "a:maze_action": { loop: 13.061224 },
  // Nitro Rush racing pack (scripts/gen_racing_audio.py): loudness-matched loops, action -14 LUFS / calm -15.5 LUFS
  "a:race_menu_calm": { loop: 25.714286, gain: 1.01 },
  "a:race_menu_action": { loop: 30.47619, gain: 1.02 },
  "a:race_rock_calm": { loop: 16.0, gain: 1.02 },
  "a:race_rock_action": { loop: 25.263158, gain: 1.01 },
  "a:race_synthwave_calm": { loop: 19.2, gain: 1.00 },
  "a:race_synthwave_action": { loop: 30.0, gain: 1.01 },
  "a:race_edm_calm": { loop: 16.0, gain: 1.01 },
  "a:race_edm_action": { loop: 30.0, gain: 1.02 },
  "a:race_dnb_calm": { loop: 22.325581, gain: 1.00 },
  "a:race_dnb_action": { loop: 22.068966, gain: 1.01 },
  "a:race_trap_calm": { loop: 22.153846, gain: 1.01 },
  "a:race_trap_action": { loop: 26.482759, gain: 1.01 },
  "a:race_chiptune_calm": { loop: 16.0, gain: 1.00 },
  "a:race_chiptune_action": { loop: 24.0, gain: 1.00 },
  "a:race_funk_calm": { loop: 18.461538, gain: 1.00 },
  "a:race_funk_action": { loop: 30.967742, gain: 1.00 },
  "a:race_orchestral_calm": { loop: 21.333333, gain: 1.00 },
  "a:race_orchestral_action": { loop: 27.428571, gain: 1.00 },
  // Drift Kings pack: eurobeat (the classic drift sound) and drift phonk (cowbells + sliding 808)
  "a:race_eurobeat_calm": { loop: 14.545455, gain: 1.00 },
  "a:race_eurobeat_action": { loop: 24.615385, gain: 1.00 },
  "a:race_phonk_calm": { loop: 19.2, gain: 1.00 },
  "a:race_phonk_action": { loop: 29.090909, gain: 1.00 },
  // Highway Heat pack: 70s cop-show chase theme and big-beat breakbeat with acid bass and sirens
  "a:race_chase_calm": { loop: 17.777778, gain: 1.00 },
  "a:race_chase_action": { loop: 27.826087, gain: 1.00 },
  "a:race_bigbeat_calm": { loop: 17.777778, gain: 1.00 },
  "a:race_bigbeat_action": { loop: 28.656716, gain: 1.00 },
  // Moto Rush GP pack: racing metal and hardstyle
  "a:race_metal_calm": { loop: 16.0, gain: 1.00 },
  "a:race_metal_action": { loop: 22.857143, gain: 1.00 },
  "a:race_hardstyle_calm": { loop: 16.0, gain: 1.00 },
  "a:race_hardstyle_action": { loop: 25.6, gain: 1.00 },
  // Blob Brigade pack (scripts/gen_brigade_audio.py): marching band, toy-box polka, boss march
  "a:brigade_march_calm": { loop: 17.777778, gain: 1.00 },
  "a:brigade_march_action": { loop: 30.47619, gain: 1.00 },
  "a:brigade_polka_calm": { loop: 15.737705, gain: 1.00 },
  "a:brigade_polka_action": { loop: 25.945946, gain: 1.00 },
  "a:brigade_boss_action": { loop: 29.090909, gain: 1.00 },
  // Blob Brigade worlds 3–10: sleigh bells, toy-box chiptune, steel drums, spooky swing, jungle drums, big brass, space synth, epic castle
  "a:brigade_sleigh_calm": { loop: 17.142857, gain: 1.00 },
  "a:brigade_sleigh_action": { loop: 27.428571, gain: 1.00 },
  "a:brigade_toybox_calm": { loop: 16.0, gain: 1.00 },
  "a:brigade_toybox_action": { loop: 25.6, gain: 1.00 },
  "a:brigade_steel_calm": { loop: 19.2, gain: 1.00 },
  "a:brigade_steel_action": { loop: 32.542373, gain: 1.00 },
  "a:brigade_spooky_calm": { loop: 17.777778, gain: 1.00 },
  "a:brigade_spooky_action": { loop: 30.0, gain: 1.00 },
  "a:brigade_jungle_calm": { loop: 19.2, gain: 1.00 },
  "a:brigade_jungle_action": { loop: 32.542373, gain: 1.00 },
  "a:brigade_brass_calm": { loop: 18.461538, gain: 1.00 },
  "a:brigade_brass_action": { loop: 30.0, gain: 1.00 },
  "a:brigade_synth_calm": { loop: 18.461538, gain: 1.00 },
  "a:brigade_synth_action": { loop: 30.967742, gain: 1.00 },
  "a:brigade_epic_calm": { loop: 20.0, gain: 1.00 },
  "a:brigade_epic_action": { loop: 28.235294, gain: 1.00 },
};

const sfxFile = (k: string) => (k.startsWith("a:") ? `arcade/sfx_${k.slice(2)}.mp3` : k.startsWith("v:") ? `arcade/voice_${k.slice(2)}.mp3` : `sfx_${k}.mp3`);
const musicFile = (k: string) => (k.startsWith("a:") ? `arcade/music_${k.slice(2)}.mp3` : `music_${k}.mp3`);

export interface SayOptions { pitch?: number; rate?: number }

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private duckGain!: GainNode;
  private sfxBus!: GainNode;
  private reverbIn!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private vol = { master: 0.9, music: 0.6, sfx: 0.9, muted: false, voice: true, charVoices: true };
  private music: { name: string; gain: GainNode; next: number; sources: AudioBufferSourceNode[]; timer: number } | null = null;
  private unlockBound = false;

  /** Create the context lazily (must happen after a user gesture on iOS / Chrome). */
  ensure() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC({ latencyHint: "interactive" });
      const c = this.ctx;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      this.master = c.createGain();
      this.musicBus = c.createGain();
      this.duckGain = c.createGain();
      this.sfxBus = c.createGain();
      this.musicBus.connect(this.duckGain).connect(this.master);
      this.sfxBus.connect(this.master);
      // small stereo room: decorrelated L/R noise tails give width on headphones
      const conv = c.createConvolver();
      const len = Math.floor(c.sampleRate * 1.3);
      const ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 200 ? i / 200 : 1);
      }
      conv.buffer = ir;
      this.reverbIn = c.createGain();
      this.reverbIn.gain.value = 1;
      const wet = c.createGain(); wet.gain.value = 0.35;
      this.reverbIn.connect(conv).connect(wet).connect(this.master);
      this.master.connect(comp).connect(c.destination);
      this.applyVolumes(true);
    }
    this.bindUnlock();
    if (this.ctx.state === "suspended" && !this.pausedByGame && !document.hidden) void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private bindUnlock() {
    if (this.unlockBound || typeof window === "undefined") return;
    this.unlockBound = true;
    const unlock = () => {
      if (this.ctx && this.ctx.state !== "running" && !this.pausedByGame && !document.hidden) void this.ctx.resume().catch(() => {});
    };
    for (const ev of ["pointerdown", "touchend", "keydown"]) window.addEventListener(ev, unlock, { passive: true });
    // app/tab goes to the background → silence everything; come back → resume (unless the game is paused)
    const hide = () => {
      window.speechSynthesis?.cancel();
      if (this.ctx?.state === "running") void this.ctx.suspend().catch(() => {});
    };
    document.addEventListener("visibilitychange", () => { if (document.hidden) hide(); else unlock(); });
    window.addEventListener("pagehide", hide);
    window.addEventListener("blur", () => { if (document.hidden) hide(); });
  }

  private pausedByGame = false;
  async suspend() {
    this.pausedByGame = true;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    if (this.ctx?.state === "running") await this.ctx.suspend().catch(() => {});
  }
  async resume() { this.pausedByGame = false; if (this.ctx && this.ctx.state !== "running") await this.ctx.resume().catch(() => {}); }

  setVolumes(v: Partial<{ master: number; music: number; sfx: number; muted: boolean; voice: boolean; charVoices: boolean }>) {
    Object.assign(this.vol, v);
    this.applyVolumes();
    if ((v.muted || v.voice === false) && typeof window !== "undefined") window.speechSynthesis?.cancel();
  }

  private applyVolumes(instant = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime, tc = instant ? 0.001 : 0.06;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, now, tc);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.62, now, tc);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.9, now, tc);
  }

  private load(key: string, file: string) {
    if (this.buffers.has(key)) return Promise.resolve(this.buffers.get(key)!);
    if (this.loading.has(key)) return this.loading.get(key)!;
    const ctx = this.ensure();
    if (!ctx) return Promise.resolve(null);
    const p = fetch(BASE + file)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(file))))
      .then((ab) => ctx.decodeAudioData(ab))
      .then((b) => { this.buffers.set(key, b); return b; })
      .catch(() => null);
    this.loading.set(key, p);
    return p;
  }

  preload(sfx: Sound[], music: MusicName[] = [], onProgress?: (p: number) => void) {
    const jobs = [...sfx.map((s) => this.load("sfx:" + s, sfxFile(s))), ...music.map((m) => this.load("music:" + m, musicFile(m)))];
    let done = 0;
    return Promise.all(jobs.map((j) => j.then((r) => { done++; onProgress?.(done / jobs.length); return r; })));
  }

  play(name: Sound, o: SfxOptions = {}) {
    const ctx = this.ensure();
    if (!ctx || this.vol.muted) return;
    if (name.startsWith("v:") && !this.vol.charVoices) return;
    const buf = this.buffers.get("sfx:" + name);
    if (!buf) { void this.load("sfx:" + name, sfxFile(name)); return; }
    const when = ctx.currentTime + Math.max(0, o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate ?? 1;
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 1;
    let node: AudioNode = src.connect(g);
    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      node = node.connect(p);
    }
    node.connect(this.sfxBus);
    const send = o.reverb ?? 0.18;
    if (send > 0) {
      const sg = ctx.createGain(); sg.gain.value = send * this.vol.sfx;
      node.connect(sg).connect(this.reverbIn);
    }
    src.start(when);
    if (o.duck !== false && this.music) {
      const amt = 1 - 0.4 * Math.min(1, (o.gain ?? 1) * 1.2);
      const dg = this.duckGain.gain;
      dg.cancelScheduledValues(when);
      dg.setTargetAtTime(amt, when, 0.015);
      dg.setTargetAtTime(1, when + Math.min(0.5, buf.duration / (o.rate ?? 1)), 0.18);
    }
  }

  /** a clean musical tone (Simon pads, stepping stones): soft triangle + bell overtone */
  tone(freq: number, dur = 0.35, o: { gain?: number; pan?: number; delay?: number; wave?: OscillatorType } = {}) {
    const ctx = this.ensure();
    if (!ctx || this.vol.muted) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const g = ctx.createGain();
    const peak = (o.gain ?? 0.5) * 0.6;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(peak * 0.55, t0 + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let out: AudioNode = g;
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(p); out = p; }
    out.connect(this.sfxBus);
    const send = ctx.createGain(); send.gain.value = 0.25 * this.vol.sfx; out.connect(send).connect(this.reverbIn);
    const a = ctx.createOscillator(); a.type = o.wave ?? "triangle"; a.frequency.value = freq;
    const b = ctx.createOscillator(); b.type = "sine"; b.frequency.value = freq * 2;
    const bg = ctx.createGain(); bg.gain.value = 0.25;
    a.connect(g); b.connect(bg).connect(g);
    a.start(t0); b.start(t0); a.stop(t0 + dur + 0.05); b.stop(t0 + dur + 0.05);
    if (this.music) { const dg = this.duckGain.gain; dg.cancelScheduledValues(t0); dg.setTargetAtTime(0.55, t0, 0.02); dg.setTargetAtTime(1, t0 + dur, 0.2); }
  }

  private want: string | null = null;

  async playMusic(name: MusicName | null, fade = 0.35) {
    if (this.want === name) return;
    this.want = name;
    const ctx = this.ensure();
    if (!ctx) return;
    this.fadeOut(fade);
    if (!name) return;
    const buf = await this.load("music:" + name, musicFile(name));
    if (!buf || !this.ctx || this.want !== name) return;
    this.fadeOut(fade);
    const meta = MUSIC_META[name] ?? { loop: buf.duration - 1.5 };
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(meta.gain ?? 1, ctx.currentTime + Math.max(0.02, fade));
    gain.connect(this.musicBus);
    const loop = Math.min(meta.loop, buf.duration - 0.05);
    const state = { name, gain, next: ctx.currentTime + 0.03, sources: [] as AudioBufferSourceNode[], timer: 0 };
    const schedule = () => {
      if (!this.ctx) return;
      while (state.next < this.ctx.currentTime + 1.2) {
        const s = this.ctx.createBufferSource();
        s.buffer = buf; s.connect(gain); s.start(state.next);
        state.sources.push(s);
        s.onended = () => { state.sources = state.sources.filter((x) => x !== s); };
        state.next += loop;
      }
    };
    schedule();
    state.timer = window.setInterval(schedule, 300);
    this.music = state;
  }

  stopMusic(fade = 0.35) {
    this.want = null;
    this.fadeOut(fade);
  }

  private fadeOut(fade: number) {
    const m = this.music;
    if (!m || !this.ctx) { this.music = null; return; }
    this.music = null;
    window.clearInterval(m.timer);
    const now = this.ctx.currentTime;
    m.gain.gain.cancelScheduledValues(now);
    m.gain.gain.setValueAtTime(Math.max(0.0001, m.gain.gain.value), now);
    m.gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.02, fade));
    for (const s of m.sources) { try { s.stop(now + fade + 0.05); } catch { /* already stopped */ } }
    window.setTimeout(() => m.gain.disconnect(), (fade + 0.2) * 1000);
  }

  get musicName() { return this.want; }
  /** raw bus inputs for real-time synths (racing engines etc.); call ensure() first */
  get sfxOut(): AudioNode | null { return this.ctx ? this.sfxBus : null; }
  get reverbOut(): AudioNode | null { return this.ctx ? this.reverbIn : null; }
  get isMuted() { return this.vol.muted; }

  // ---------------------------------------------------------------- spoken voice-over (device voice)
  private voice: SpeechSynthesisVoice | null = null;
  private voiceCount = -1;
  private voicePref = "";
  private voicesBound = false;

  /** English voices, best-sounding first (natural/neural voices beat the old robotic ones) */
  voiceList(): SpeechSynthesisVoice[] {
    if (typeof window === "undefined" || !window.speechSynthesis) return [];
    const all = window.speechSynthesis.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang));
    const score = (v: SpeechSynthesisVoice) => {
      const n = v.name;
      let s = 0;
      if (/natural|neural/i.test(n)) s += 100;
      if (/online/i.test(n)) s += 40;
      if (/enhanced|premium|siri/i.test(n)) s += 60;
      if (/^Google US English$|Google UK English Female/i.test(n)) s += 55;
      if (/(Ana|Aria|Jenny|Emma|Michelle|Ava|Samantha|Allison|Susan|Karen|Moira|Tessa|Serena|Libby|Sonia|Neerja)/i.test(n)) s += 30;
      if (/Ana/i.test(n)) s += 15; // child voice — perfect for a kids game
      if (/(David|Mark|Zira|George|Hazel|Fred|Albert|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Zarvox|Trinoids|Whisper|Junior|Ralph|Bad News|Good News)/i.test(n) && !/natural|online/i.test(n)) s -= 80;
      if (/en[-_]US/i.test(v.lang)) s += 8; else if (/en[-_](GB|IN|AU)/i.test(v.lang)) s += 5;
      if (v.localService === false) s += 5;
      return s;
    };
    return all.sort((a, b) => score(b) - score(a));
  }

  /** "" = automatic best voice */
  setVoicePreference(name: string) { this.voicePref = name; this.voice = null; this.voiceCount = -1; }

  private pickVoice() {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    if (!this.voicesBound) {
      this.voicesBound = true;
      window.speechSynthesis.addEventListener?.("voiceschanged", () => { this.voice = null; this.voiceCount = -1; });
    }
    const list = this.voiceList();
    if (this.voice && list.length === this.voiceCount) return this.voice;
    this.voiceCount = list.length;
    this.voice = (this.voicePref && list.find((v) => v.name === this.voicePref)) || list[0] || null;
    return this.voice;
  }

  /** Speak a short line (announcer / character). Silently does nothing if voices are off or unsupported. */
  say(text: string, o: SayOptions = {}) {
    if (typeof window === "undefined" || !window.speechSynthesis || this.vol.muted || !this.vol.voice || this.pausedByGame) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = this.pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "en-US";
    const natural = !!v && /natural|neural|online|enhanced|premium|Google/i.test(v.name);
    // natural voices sound best near their own pitch; older voices get a small cheerful lift
    const p = o.pitch ?? 1.2;
    u.pitch = Math.max(0.5, Math.min(2, natural ? 1 + (p - 1) * 0.25 : Math.min(1.25, p)));
    u.rate = Math.max(0.6, Math.min(1.6, o.rate ?? 1.0));
    u.volume = Math.min(1, this.vol.master * this.vol.sfx * 1.1);
    synth.speak(u);
  }
}

/** One engine per page. When this module is hot-reloaded in development, the previous engine
 *  (and any music it is still looping) is shut down first so nothing keeps playing in the background. */
const G = globalThis as unknown as { __momoAudio?: { ctx?: AudioContext | null; music?: { timer?: number } | null } };
if (G.__momoAudio) {
  const old = G.__momoAudio;
  try { if (old.music?.timer) window.clearInterval(old.music.timer); } catch { /* ignore */ }
  try { void old.ctx?.close(); } catch { /* ignore */ }
}
export const audio = new AudioEngine();
if (typeof window !== "undefined") G.__momoAudio = audio as unknown as typeof G.__momoAudio;
