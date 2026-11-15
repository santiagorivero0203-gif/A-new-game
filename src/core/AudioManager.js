/**
 * @module AudioManager
 * @description Motor de audio procedural 100% Web Audio API sin dependencias de archivos `.mp3`/`.wav`.
 *
 * Cadena de mezcla maestra:
 * `Oscillators / Noise -> SFX Gain -> Master Gain -> Biquad Low-Pass Filter -> DynamicsCompressor -> Destination`
 *
 * Características acústicas:
 * - Aleatorización orgánica de tono (`±7%`) y volumen (`±10%`) en golpes repetitivos.
 * - Síntesis multicapa por material en `playHitImpact(type, material)` (`armor`, `wood`, `slime`, `stone`, `flesh`).
 * - Filtro de Paso Bajo maestro (`380 Hz` bajo estado crítico / postura rota; `20000 Hz` normal).
 * - Resonancia rúnica para obeliscos y portales + cama sonora ambiental continua por Bioma.
 *
 * @author Be a Legend Team
 * @version 2.0.0
 */

export class AudioManager {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;

    /** @type {GainNode|null} */
    this.masterGain = null;

    /** @type {BiquadFilterNode|null} Filtro de paso bajo para tensión en salud crítica */
    this.lowPassFilter = null;

    /** @type {DynamicsCompressorNode|null} Compresor para mezcla limpia estilo AAA */
    this.compressor = null;

    /** @type {AudioBuffer|null} Buffer pregenerado de ruido blanco */
    this.noiseBuffer = null;

    /** @type {number} Volumen general [0.0 .. 1.0] */
    this.volume = 0.55;

    /** @type {boolean} Estado de silencio */
    this.muted = false;

    this._storageKey = 'be_a_legend_audio_muted';
    this._isCriticalAudio = false;
    this._currentBiome = 'cave_exit_intro';

    /** @type {Array<AudioNode>} Nodos activos de la cama ambiental procedural */
    this._ambienceNodes = [];
    /** @type {GainNode|null} */
    this._ambienceGain = null;

    this._loadPreferences();
    this._bindUnlockEvents();
  }

  /**
   * Carga las preferencias de audio guardadas en `localStorage`.
   * @private
   */
  _loadPreferences() {
    try {
      const saved = localStorage.getItem(this._storageKey);
      if (saved === 'true') {
        this.muted = true;
      }
    } catch (_) {
      // Sin acceso a storage en modo estricto
    }
  }

  /**
   * Desbloquea el `AudioContext` al detectar la primera interacción del usuario.
   * @private
   */
  _bindUnlockEvents() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      if (!this.ctx) {
        this.init();
      } else if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.ctx && this._currentBiome && !this._ambienceGain) {
        this.setBiomeAmbience(this._currentBiome);
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  /**
   * Inicializa el grafo maestro `masterGain -> lowPassFilter -> compressor -> destination`.
   */
  init() {
    if (this.ctx || typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

    this.lowPassFilter = this.ctx.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.setValueAtTime(this._isCriticalAudio ? 380 : 20000, this.ctx.currentTime);
    this.lowPassFilter.Q.setValueAtTime(0.75, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);

    this.masterGain.connect(this.lowPassFilter);
    this.lowPassFilter.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    // Pre-hornear 1 segundo de ruido blanco para percusión/viento/chispas
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    if (this._currentBiome) {
      this.setBiomeAmbience(this._currentBiome);
    }
  }

  /**
   * Alterna silencio global persistiendo preferencia en `localStorage`.
   * @returns {boolean} Nuevo estado de `muted`.
   */
  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
    try {
      localStorage.setItem(this._storageKey, String(this.muted));
    } catch (_) {}
    return this.muted;
  }

  /**
   * Activa o desactiva el filtro de paso bajo en 380 Hz (efecto aturdido/crítico
   * al llegar a 1 corazón o sufrir Guardia Rota) mediante rampa exponencial suave.
   * @param {boolean} isCritical
   */
  setCriticalAudioState(isCritical) {
    const next = Boolean(isCritical);
    if (this._isCriticalAudio === next) return;
    this._isCriticalAudio = next;

    if (!this.ctx || !this.lowPassFilter) return;
    try {
      const now = this.ctx.currentTime;
      const targetFreq = next ? 380 : 20000;
      const currentVal = Math.max(120, this.lowPassFilter.frequency.value);
      this.lowPassFilter.frequency.cancelScheduledValues(now);
      this.lowPassFilter.frequency.setValueAtTime(currentVal, now);
      this.lowPassFilter.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.18);
    } catch (_) {}
  }

  /** @private */
  _canPlay() {
    if (this.muted) return false;
    if (!this.ctx) this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx.state === 'running';
  }

  /**
   * Aplica variación orgánica de tono (`±7%`) para evitar fatiga auditiva robótica.
   * @private
   * @param {number} freq
   * @returns {number}
   */
  _randPitch(freq) {
    return freq * (0.93 + Math.random() * 0.14);
  }

  /**
   * Aplica variación orgánica de ganancia (`±10%`).
   * @private
   * @param {number} gain
   * @returns {number}
   */
  _randGain(gain) {
    return gain * (0.9 + Math.random() * 0.2);
  }

  /**
   * Dispara una ráfaga de ruido filtrado.
   * @private
   */
  _playNoiseBurst({ duration = 0.12, filterType = 'bandpass', freqStart = 1200, freqEnd = 400, q = 1.5, gain = 0.25, delay = 0 }) {
    if (!this._canPlay() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + delay;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.setValueAtTime(q, now);
    filter.frequency.setValueAtTime(Math.max(40, freqStart), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(gain, now + Math.min(0.015, duration * 0.2));
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    src.start(now);
    src.stop(now + duration + 0.02);
  }

  /**
   * Dispara una envolvente tonal con oscilador Web Audio.
   * @private
   */
  _playTone({ type = 'triangle', freqStart = 440, freqEnd = 220, duration = 0.12, gain = 0.2, delay = 0 }) {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime + delay;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(25, freqStart), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, freqEnd), now + duration);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(gain, now + Math.min(0.012, duration * 0.2));
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // =========================================================================
  // EFECTOS DE SONIDO DE COMBATE Y EXPLORACIÓN (HUMANIZADOS)
  // =========================================================================

  /**
   * Barrido de espada con micro-aleatorización (`±7%` tono, `±10%` ganancia).
   * @param {number} [comboStep=1]
   * @param {boolean} [isDashStrike=false]
   * @param {boolean} [isPerfectTempo=false]
   */
  playSwordSwing(comboStep = 1, isDashStrike = false, isPerfectTempo = false) {
    if (!this._canPlay()) return;
    const baseAir = comboStep === 3 ? 2100 : comboStep === 2 ? 1750 : 1500;
    const airFreq = this._randPitch(isDashStrike ? 2600 : baseAir);
    const sweepEnd = this._randPitch(comboStep === 3 ? 260 : 380);

    this._playNoiseBurst({
      duration: comboStep === 3 ? 0.17 : 0.11,
      filterType: 'bandpass',
      freqStart: airFreq,
      freqEnd: sweepEnd,
      q: 1.8,
      gain: this._randGain(comboStep === 3 ? 0.28 : 0.19)
    });

    const bladeFreq = this._randPitch(comboStep === 3 ? 420 : comboStep === 2 ? 540 : 490);
    this._playTone({
      type: 'triangle',
      freqStart: bladeFreq,
      freqEnd: bladeFreq * 0.42,
      duration: comboStep === 3 ? 0.14 : 0.09,
      gain: this._randGain(0.14)
    });

    if (isPerfectTempo) {
      this._playTone({
        type: 'sine',
        freqStart: this._randPitch(920),
        freqEnd: 1380,
        duration: 0.08,
        gain: 0.10,
        delay: 0.015
      });
    }
  }

  /**
   * Impacto de golpe multicapa: mantiene el transiente grave base compartido y añade una
   * capa acústica específica según el material del objetivo (`armor`, `wood`, `slime`, `stone`, `flesh`).
   * @param {'normal'|'finisher'|'critical'|'super_effective'|'resisted'|'shield_bounce'} [type='normal']
   * @param {'flesh'|'armor'|'wood'|'slime'|'stone'} [material='flesh']
   */
  playHitImpact(type = 'normal', material = 'flesh') {
    if (!this._canPlay()) return;

    // 1. Transiente base compartido (onda triangular grave aleatorizada)
    const isHeavy = type === 'finisher' || type === 'critical' || type === 'super_effective';
    const baseFreq = isHeavy ? 185 : 145;
    this._playTone({
      type: 'triangle',
      freqStart: this._randPitch(baseFreq),
      freqEnd: 46,
      duration: isHeavy ? 0.16 : 0.11,
      gain: this._randGain(isHeavy ? 0.30 : 0.22)
    });

    // 2. Capa adicional por tipo de impacto táctico
    if (type === 'critical' || type === 'super_effective') {
      this._playTone({
        type: 'sine',
        freqStart: this._randPitch(880),
        freqEnd: 1320,
        duration: 0.16,
        gain: this._randGain(0.16),
        delay: 0.01
      });
    } else if (type === 'resisted') {
      this._playTone({
        type: 'triangle',
        freqStart: 220,
        freqEnd: 95,
        duration: 0.10,
        gain: 0.12
      });
    }

    // 3. Capa acústica específica según el material golpeado
    if (material === 'armor') {
      // Resonancia metálica brillante de coraza (Tank)
      this._playTone({
        type: 'sine',
        freqStart: this._randPitch(1320),
        freqEnd: 960,
        duration: 0.16,
        gain: this._randGain(0.14)
      });
      this._playTone({
        type: 'triangle',
        freqStart: this._randPitch(2240),
        freqEnd: 1850,
        duration: 0.09,
        gain: 0.07
      });
    } else if (material === 'wood') {
      // Golpe seco y hueco de madera (`wooden_shield` / arbustos)
      this._playNoiseBurst({
        duration: 0.08,
        filterType: 'bandpass',
        freqStart: this._randPitch(520),
        freqEnd: 220,
        q: 3.4,
        gain: this._randGain(0.22)
      });
      this._playTone({
        type: 'triangle',
        freqStart: this._randPitch(390),
        freqEnd: 175,
        duration: 0.07,
        gain: 0.14
      });
    } else if (material === 'slime') {
      // Barrido resonante viscoso y húmedo (`slime`)
      this._playTone({
        type: 'sine',
        freqStart: this._randPitch(270),
        freqEnd: 640,
        duration: 0.09,
        gain: this._randGain(0.16)
      });
      this._playTone({
        type: 'sawtooth',
        freqStart: 560,
        freqEnd: 185,
        duration: 0.11,
        gain: 0.07,
        delay: 0.03
      });
    } else if (material === 'stone') {
      // Crujido mineral seco (roca / prop)
      this._playNoiseBurst({
        duration: 0.11,
        filterType: 'lowpass',
        freqStart: 950,
        freqEnd: 240,
        q: 2.0,
        gain: this._randGain(0.20)
      });
    } else {
      // 'flesh' por defecto: chasquido limpio
      this._playNoiseBurst({
        duration: 0.07,
        filterType: 'bandpass',
        freqStart: this._randPitch(1450),
        freqEnd: 520,
        q: 1.4,
        gain: this._randGain(0.15)
      });
    }
  }

  /** Campana armónica metálica de Parry Perfecto */
  playParry() {
    if (!this._canPlay()) return;
    this._playTone({ type: 'sine', freqStart: 1480, freqEnd: 1520, duration: 0.28, gain: 0.24 });
    this._playTone({ type: 'triangle', freqStart: 2220, freqEnd: 2180, duration: 0.22, gain: 0.14, delay: 0.01 });
    this._playNoiseBurst({ duration: 0.10, filterType: 'highpass', freqStart: 3200, freqEnd: 1200, q: 1.2, gain: 0.20 });
  }

  /** Bloqueo sólido de escudo humanizado */
  playGuardBlock() {
    if (!this._canPlay()) return;
    this._playTone({ type: 'triangle', freqStart: this._randPitch(260), freqEnd: 95, duration: 0.11, gain: this._randGain(0.22) });
    this._playNoiseBurst({ duration: 0.09, filterType: 'bandpass', freqStart: this._randPitch(900), freqEnd: 260, q: 2.2, gain: 0.18 });
  }

  /** Ruptura dramática de postura */
  playGuardBreak() {
    if (!this._canPlay()) return;
    this._playTone({ type: 'sawtooth', freqStart: 190, freqEnd: 52, duration: 0.34, gain: 0.26 });
    this._playNoiseBurst({ duration: 0.26, filterType: 'lowpass', freqStart: 1800, freqEnd: 180, q: 1.8, gain: 0.30 });
  }

  /** Desplazamiento veloz de Dash */
  playDash() {
    if (!this._canPlay()) return;
    this._playNoiseBurst({
      duration: 0.13,
      filterType: 'bandpass',
      freqStart: this._randPitch(750),
      freqEnd: 2400,
      q: 1.4,
      gain: this._randGain(0.16)
    });
    this._playTone({ type: 'sine', freqStart: this._randPitch(210), freqEnd: 460, duration: 0.10, gain: 0.10 });
  }

  /** Canalización mágica por elemento */
  playAbility(element, isStrong = false) {
    if (!this._canPlay()) return;
    const elem = String(element || '').toLowerCase();
    if (elem === 'fuego') {
      this._playNoiseBurst({ duration: isStrong ? 0.26 : 0.14, filterType: 'bandpass', freqStart: 850, freqEnd: 240, q: 1.3, gain: isStrong ? 0.26 : 0.18 });
      this._playTone({ type: 'sawtooth', freqStart: isStrong ? 310 : 420, freqEnd: 130, duration: 0.18, gain: 0.14 });
    } else if (elem === 'plantas' || elem === 'tierra') {
      this._playTone({ type: 'triangle', freqStart: 320, freqEnd: 580, duration: isStrong ? 0.24 : 0.14, gain: 0.18 });
      this._playNoiseBurst({ duration: 0.14, filterType: 'bandpass', freqStart: 1400, freqEnd: 650, q: 2.0, gain: 0.14 });
    } else {
      // Kinetic / Embestida
      this._playTone({ type: 'sine', freqStart: 640, freqEnd: 1380, duration: isStrong ? 0.22 : 0.13, gain: 0.17 });
      this._playNoiseBurst({ duration: 0.11, filterType: 'highpass', freqStart: 2200, freqEnd: 900, q: 1.6, gain: 0.15 });
    }
  }

  /** Explosión de sinergia o barril */
  playExplosion() {
    if (!this._canPlay()) return;
    this._playTone({ type: 'sawtooth', freqStart: 145, freqEnd: 38, duration: 0.36, gain: 0.28 });
    this._playNoiseBurst({ duration: 0.32, filterType: 'lowpass', freqStart: 1600, freqEnd: 140, q: 1.0, gain: 0.32 });
  }

  /** Alerta visual-auditiva breve cuando un enemigo telegrafía ataque */
  playTelegraph() {
    if (!this._canPlay()) return;
    this._playTone({ type: 'sine', freqStart: this._randPitch(540), freqEnd: 880, duration: 0.09, gain: 0.09 });
  }

  /** Impacto al recibir daño el héroe */
  playPlayerHurt() {
    if (!this._canPlay()) return;
    this._playTone({ type: 'sawtooth', freqStart: 220, freqEnd: 78, duration: 0.22, gain: 0.26 });
    this._playNoiseBurst({ duration: 0.16, filterType: 'lowpass', freqStart: 1200, freqEnd: 240, q: 1.4, gain: 0.22 });
  }

  /** Pulso armónico curativo */
  playHeal() {
    if (!this._canPlay()) return;
    this._playTone({ type: 'sine', freqStart: 523.25, freqEnd: 659.25, duration: 0.18, gain: 0.14 });
    this._playTone({ type: 'sine', freqStart: 783.99, freqEnd: 1046.5, duration: 0.24, gain: 0.12, delay: 0.07 });
  }

  /** Acorde cristalino místico al activar obeliscos rúnicos, reliquias o portales entre mundos */
  playRunicResonance() {
    if (!this._canPlay()) return;
    this._playTone({ type: 'sine', freqStart: 587.33, freqEnd: 590, duration: 0.42, gain: 0.12, delay: 0 });
    this._playTone({ type: 'sine', freqStart: 739.99, freqEnd: 744, duration: 0.46, gain: 0.10, delay: 0.06 });
    this._playTone({ type: 'triangle', freqStart: 880.0, freqEnd: 1174.66, duration: 0.52, gain: 0.09, delay: 0.12 });
  }

  // =========================================================================
  // AMBIENTACIÓN SONORA PROCEDURAL CONTINUA POR BIOMA
  // =========================================================================

  /**
   * Detiene limpiamente la cama ambiental actual antes de cambiar de Bioma.
   */
  stopBiomeAmbience() {
    for (let i = 0; i < this._ambienceNodes.length; i++) {
      const node = this._ambienceNodes[i];
      try {
        if (typeof node.stop === 'function') node.stop();
        if (typeof node.disconnect === 'function') node.disconnect();
      } catch (_) {}
    }
    this._ambienceNodes.length = 0;
    if (this._ambienceGain) {
      try {
        this._ambienceGain.disconnect();
      } catch (_) {}
      this._ambienceGain = null;
    }
  }

  /**
   * Activa una atmósfera ambiental sutil sintetizada en tiempo real acorde al Bioma actual.
   * @param {string} biomeKey - `'cave_exit_intro'|'marsh_of_spores'|'ash_caldera'|'astral_citadel'`
   */
  setBiomeAmbience(biomeKey = 'cave_exit_intro') {
    this._currentBiome = biomeKey || 'cave_exit_intro';
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;

    this.stopBiomeAmbience();

    try {
      const now = this.ctx.currentTime;
      const bedGain = this.ctx.createGain();
      bedGain.gain.setValueAtTime(0.0001, now);
      bedGain.gain.linearRampToValueAtTime(0.022, now + 1.1);
      bedGain.connect(this.masterGain);
      this._ambienceGain = bedGain;

      // Oscilador armónico muy sutil + LFO lento de respiración
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const droneFilter = this.ctx.createBiquadFilter();

      droneFilter.type = 'lowpass';
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.16, now);

      if (this._currentBiome === 'marsh_of_spores') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(98.0, now); // G2 brumoso
        droneFilter.frequency.setValueAtTime(320, now);
        lfoGain.gain.setValueAtTime(80, now);
      } else if (this._currentBiome === 'ash_caldera') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(73.42, now); // D2 volcánico
        droneFilter.frequency.setValueAtTime(210, now);
        lfoGain.gain.setValueAtTime(55, now);
      } else if (this._currentBiome === 'astral_citadel') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(164.81, now); // E3 astral
        droneFilter.frequency.setValueAtTime(580, now);
        lfoGain.gain.setValueAtTime(140, now);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110.0, now); // A2 valle sereno
        droneFilter.frequency.setValueAtTime(280, now);
        lfoGain.gain.setValueAtTime(70, now);
      }

      lfo.connect(lfoGain);
      lfoGain.connect(droneFilter.frequency);
      osc.connect(droneFilter);
      droneFilter.connect(bedGain);

      // Capa de viento/vapor filtrado suave desde el noiseBuffer
      if (this.noiseBuffer) {
        const wind = this.ctx.createBufferSource();
        wind.buffer = this.noiseBuffer;
        wind.loop = true;
        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = this._currentBiome === 'ash_caldera' ? 'lowpass' : 'bandpass';
        windFilter.frequency.setValueAtTime(
          this._currentBiome === 'ash_caldera' ? 190 : (this._currentBiome === 'astral_citadel' ? 760 : 420),
          now
        );
        windFilter.Q.setValueAtTime(1.1, now);
        const windGain = this.ctx.createGain();
        windGain.gain.setValueAtTime(0.32, now);
        wind.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(bedGain);
        wind.start(now);
        this._ambienceNodes.push(wind, windFilter, windGain);
      }

      osc.start(now);
      lfo.start(now);
      this._ambienceNodes.push(osc, lfo, lfoGain, droneFilter);
    } catch (_) {}
  }
}
