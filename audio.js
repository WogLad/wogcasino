/**
 * Audio Engine for Interactive Casino Portal
 * Synthesizes all sound effects using the Web Audio API.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  /**
   * Safe initialization of AudioContext on user interaction
   */
  init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
    } catch (e) {
      console.warn("Web Audio API is not supported in this browser:", e);
    }
  }

  /**
   * Resumes context if suspended (browser security policy)
   */
  async resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Toggles the mute state
   * @returns {boolean} New mute state
   */
  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Helper to create a gain node with a specific volume and decay
   */
  createGainNode(startVolume, duration, decayType = 'exponential') {
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(startVolume, this.ctx.currentTime);
    if (decayType === 'exponential' && startVolume > 0) {
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    } else {
      gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    }
    return gainNode;
  }

  /**
   * Plays a sharp click sound when placing a chip or clicking button
   */
  async playChipClick() {
    await this.resume();
    if (this.muted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.createGainNode(0.15, 0.08);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.08);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  /**
   * Plays a mechanical ticking sound for the wheel rotation
   */
  async playWheelTick(volume = 0.08) {
    await this.resume();
    if (this.muted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.createGainNode(volume, 0.03);
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.03);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.03);
  }

  /**
   * Plays a warm bouncing sound for the ball rolling/clacking in pockets
   */
  async playBallBounce(volume = 0.2) {
    await this.resume();
    if (this.muted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.createGainNode(volume, 0.06);
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.06);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  /**
   * Plays a celebratory major-chord chime for a win
   */
  async playWinJingle() {
    await this.resume();
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + idx * 0.1 + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.5);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.5);
    });
  }

  /**
   * Plays a disappointing minor/slide tone for a loss
   */
  async playLoseJingle() {
    await this.resume();
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now); // A3
    osc.frequency.linearRampToValueAtTime(110, now + 0.6); // Slide down to A2

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.6);

    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  /**
   * MINES GAME SPECIFIC AUDIO SYNTHESIZERS
   */

  /**
   * Plays an ascending pentatonic chime for successive gem reveals
   * @param {number} revealedCount Current count of gems hit
   */
  async playGemReveal(revealedCount) {
    await this.resume();
    if (this.muted || !this.ctx) return;

    // Major Pentatonic Scale frequencies (starting from C4)
    const scale = [
      261.63, 293.66, 329.63, 392.00, 440.00, // Octave 4
      523.25, 587.33, 659.25, 783.99, 880.00, // Octave 5
      1046.50, 1174.66, 1318.51, 1567.98, 1760.00 // Octave 6
    ];

    const noteIdx = Math.min(revealedCount - 1, scale.length - 1);
    const freq = scale[noteIdx];

    const osc = this.ctx.createOscillator();
    const gainNode = this.createGainNode(0.18, 0.4);
    const filter = this.ctx.createBiquadFilter();

    // Warm pure bell sound: sine + highpass filter for chime clarity
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    // Add subtle frequency sweep for bell chime bounce
    osc.frequency.exponentialRampToValueAtTime(freq * 1.002, this.ctx.currentTime + 0.05);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 2.5, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  /**
   * Synthesizes a deep explosive white-noise crash for hitting a mine
   */
  async playExplosion() {
    await this.resume();
    if (this.muted || !this.ctx) return;

    const sampleRate = this.ctx.sampleRate;
    const duration = 0.9; // 0.9 seconds
    const bufferSize = sampleRate * duration;
    
    // 1. Create a white noise buffer
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2.0 - 1.0;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    // 2. Synthesize low frequency rumble for shockwave (square/sine oscillator)
    const rumbleOsc = this.ctx.createOscillator();
    rumbleOsc.type = 'triangle';
    rumbleOsc.frequency.setValueAtTime(140, this.ctx.currentTime);
    rumbleOsc.frequency.linearRampToValueAtTime(10, this.ctx.currentTime + duration);

    // 3. Set gain Nodes
    const noiseGain = this.createGainNode(0.25, duration);
    const rumbleGain = this.createGainNode(0.4, duration, 'linear');

    // 4. Low-pass filters for debris muffling
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + duration);

    const rumbleFilter = this.ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(150, this.ctx.currentTime);

    // 5. Connect and fire nodes
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    rumbleOsc.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.ctx.destination);

    noiseSource.start();
    noiseSource.stop(this.ctx.currentTime + duration);
    
    rumbleOsc.start();
    rumbleOsc.stop(this.ctx.currentTime + duration);
  }

  /**
   * Synthesizes a bright, high-frequency coin arpeggio on cashing out
   */
  async playCashOutCoin() {
    await this.resume();
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;
    // Bright metallic coin chords: B5 (987.77 Hz), E6 (1318.51 Hz), B6 (1975.53 Hz)
    const coinNotes = [987.77, 1318.51, 1975.53];

    coinNotes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Triangle wave gives a rounder metallic chime than sine
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(800, now);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + idx * 0.05 + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.25);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.25);
    });
  }

  /**
   * Synthesizes a ticking sound whose pitch increases based on a multiplier
   * Used for the Crash game rising graph
   * @param {number} multiplier Current game multiplier (e.g., 1.5, 3.0)
   */
  async playRisingTick(multiplier) {
    await this.resume();
    if (this.muted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.createGainNode(0.04, 0.05);

    // Pitch rises smoothly with multiplier
    const baseFreq = 400;
    const maxFreq = 2000;
    // Map multiplier 1.0 -> 10.0+ to frequency 400 -> 2000 roughly
    const targetFreq = Math.min(baseFreq + (multiplier - 1) * 150, maxFreq);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(targetFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(targetFreq * 0.8, this.ctx.currentTime + 0.05);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }
}

// Export a single global audio instance
window.audioEngine = new AudioEngine();
