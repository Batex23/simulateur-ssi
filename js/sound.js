/* Sons : signal d'évacuation (deux tons, inspiré de la NF S 32-001) et buzzer d'alarme restreinte */
(function () {
  'use strict';
  class Sound {
    constructor() { this.ctx = null; this.muted = false; this.ag = false; this.buzz = false; this.timer = null; }
    unlock() {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.timer) this.timer = setInterval(() => this.tick(), 500);
    }
    tone(freq, start, dur, vol, type = 'square') {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(vol, start + 0.005);
      g.gain.setValueAtTime(vol, start + dur - 0.01); g.gain.linearRampToValueAtTime(0, start + dur);
      o.connect(g).connect(c.destination); o.start(start); o.stop(start + dur + 0.02);
    }
    tick() {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + 0.02;
      if (this.ag) { this.tone(554, t, 0.1, 0.05); this.tone(440, t + 0.1, 0.4, 0.05); }
      else if (this.buzz) { this.tone(2400, t, 0.18, 0.02, 'sine'); }
    }
    set(ag, buzz) { this.ag = ag; this.buzz = buzz; }
    // bip de touche membrane
    click(vol = 1) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + 0.005;
      this.tone(3100, t, 0.035, 0.012 * vol, 'sine');
    }
    // bip de validation (deux tons) ou de refus (grave)
    beep(ok) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + 0.01;
      if (ok) { this.tone(1800, t, 0.07, 0.02, 'sine'); this.tone(2600, t + 0.09, 0.09, 0.02, 'sine'); }
      else this.tone(320, t, 0.22, 0.03, 'square');
    }
  }
  window.SSISound = Sound;
})();
