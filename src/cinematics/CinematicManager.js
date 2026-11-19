/**
 * @module CinematicManager
 * @description Administrador autónomo del sistema de cinemáticas narrativas para 'Be a Legend'.
 * Opera en el DOM Overlay con imágenes en alta resolución 16:9, efectos de cámara guiados por datos,
 * transiciones de pantalla, y diálogos secuenciales con efecto máquina de escribir.
 * Configuración 100% JSON (Data-Driven) compatible con futuros creadores de niveles.
 * @author Be a Legend Team
 * @version 2.0.0
 */

/**
 * Secuencia narrativa del Prólogo guiada por JSON (Data-Driven)
 */
export const PROLOGUE_CUTSCENE = {
  id: 'prologue_intro',
  slides: [
    {
      imagen_bg: '/assets/cinematics/Escena 1.jpg',
      movimiento_camara: 'SlowZoomIn',
      transicion_entrada: 'FadeIn',
      dialogos: [
        { speaker: 'SANTI', text: '¿Qué fue ese ruido? Viene de esa cueva...' }
      ]
    },
    {
      imagen_bg: '/assets/cinematics/Escena 2.jpg',
      movimiento_camara: 'PanRight',
      transicion_entrada: 'Cut',
      dialogos: [
        { speaker: 'SANTI', text: '¡Cuidado atrás!' }
      ]
    },
    {
      imagen_bg: '/assets/cinematics/escena 3.jpg',
      movimiento_camara: 'Shake',
      transicion_entrada: 'Cut',
      dialogos: [
        { speaker: 'KRAGOT', text: 'Insecto entrometido... ¡Desaparece!' }
      ]
    },
    {
      imagen_bg: '/assets/cinematics/Escena 4.jpg',
      movimiento_camara: 'SlowZoomOut',
      transicion_entrada: 'FlashBlanco',
      dialogos: [
        { speaker: 'TARAK', text: '¡Ggghhh...!' }
      ]
    },
    {
      imagen_bg: '/assets/cinematics/escena 5.jpg',
      movimiento_camara: 'PanUp',
      transicion_entrada: 'Cut',
      dialogos: [
        { speaker: 'KRAGOT', text: 'Tu luz se apagó, Tarak. El mundo es mío.' }
      ]
    },
    {
      imagen_bg: '/assets/cinematics/escena 6.jpg',
      movimiento_camara: 'Static',
      transicion_entrada: 'FadeIn',
      dialogos: [
        { speaker: 'TARAK', text: 'Me salvaste... Tienes buenos reflejos, chico...' },
        { speaker: 'SANTI', text: '¡No hable, señor! ¡Tengo que buscar a un médico!' },
        { speaker: 'TARAK', text: 'Escúchame... El contenedor sigue intacto. Toma mi reliquia. Encuentra los poderes... Sé nuestra luz...' }
      ]
    },
    {
      imagen_bg: '/assets/cinematics/eacena 7.jpg',
      movimiento_camara: 'SlowTiltUp',
      transicion_entrada: 'Crossfade',
      dialogos: [
        { speaker: 'DESTINO', text: 'Con la reliquia sagrada palpitando en tus manos y el mundo al borde del abismo, tu viaje comienza en los confines de El Bosque. Es hora de forjar tu leyenda.' }
      ]
    }
  ]
};

export class CinematicManager {
  /**
   * @param {import('../core/StateManager.js').StateManager} stateManager
   */
  constructor(stateManager) {
    this.stateManager = stateManager;

    // Elementos del DOM Overlay
    this.overlay = document.getElementById('cinematic-overlay');
    this.imageLayer = document.getElementById('cinematic-image');
    this.imageEl = document.getElementById('cinematic-img-el');
    this.transitionLayer = document.getElementById('cinematic-transition-layer');
    this.captionBox = document.getElementById('cinematic-caption-box');
    this.speakerEl = document.getElementById('cinematic-speaker');
    this.textEl = document.getElementById('cinematic-text');
    this.progressPipsEl = document.getElementById('cinematic-progress-pips');
    this.btnSkip = document.getElementById('btn-skip-cinematic');

    this.currentSequence = null;
    this.currentSlideIndex = 0;
    this.currentDialogueIndex = 0;

    this.isPlaying = false;
    this.onCompleteCallback = null;
    this.isTyping = false;
    this._transitionPending = false;
    this._endTimeoutId = null;
    this._slideRequestToken = 0;
    /** @type {Function|null} Callback opcional para despertar el bucle de Engine al interactuar */
    this.onWake = null;

    /** @type {Map<string, HTMLImageElement>} Caché acotada (solo diapositiva actual + siguiente) */
    this.imageCache = new Map();

    // Typewriter basado en deltaTime (sincronizado con el Game Loop)
    /** @type {string} Texto objetivo completo de la máquina de escribir */
    this._twTargetText = '';
    /** @type {number} Índice del carácter actual siendo revelado */
    this._twCharIndex = 0;
    /** @type {number} Acumulador de tiempo para controlar la velocidad de revelado */
    this._twAccumulator = 0;
    /** @type {number} Segundos entre cada carácter (30ms = 0.030s) */
    this.TYPEWRITER_SPEED = 0.030;

    this._bindEvents();
  }

  /**
   * Pre-carga de forma progresiva una escena puntual o las primeras escenas del prólogo
   * para evitar decodificar decenas de megabytes simultáneos durante el arranque.
   * @param {Object} sequence - Secuencia narrativa guiada por datos
   * @param {number} [maxSlides=2] - Cantidad inicial de diapositivas a decodificar en arranque
   * @returns {Promise<void>}
   */
  async preloadSequence(sequence, maxSlides = 2) {
    if (!sequence || !sequence.slides) return;
    const count = Math.min(sequence.slides.length, maxSlides);
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(this._preloadSlideUrl(sequence.slides[i]?.imagen_bg));
    }
    await Promise.all(tasks);
  }

  /**
   * Normaliza una ruta de imagen cinemática codificando espacios de forma segura (`encodeURI`).
   * @private
   * @param {string} url
   * @returns {string}
   */
  _safeUrl(url) {
    if (!url) return '';
    try {
      return encodeURI(decodeURI(url));
    } catch {
      return encodeURI(url);
    }
  }

  /**
   * Pre-carga una única imagen cinemática sin bloquear el hilo principal.
   * @private
   */
  _preloadSlideUrl(url) {
    return new Promise((resolve) => {
      const safe = this._safeUrl(url);
      if (!safe) return resolve(null);
      if (this.imageCache.has(safe)) return resolve(this.imageCache.get(safe));

      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.imageCache.set(safe, img);
        if (typeof img.decode === 'function') {
          img.decode().catch(() => {}).finally(() => resolve(img));
        } else {
          resolve(img);
        }
      };
      img.onerror = () => {
        console.warn(`[CinematicManager] No se pudo pre-cargar: ${safe}`);
        resolve(null);
      };
      img.src = safe;
    });
  }

  /**
   * Libera las imágenes de alta resolución del prólogo de memoria gráfica tras iniciar gameplay.
   */
  releaseCache() {
    this.imageCache.clear();
    if (this.imageLayer) {
      this.imageLayer.style.backgroundImage = 'none';
    }
    if (this.imageEl) {
      this.imageEl.removeAttribute('src');
    }
  }

  _bindEvents() {
    const handleSkip = (e) => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      this.skip();
    };

    if (this.btnSkip) {
      this.btnSkip.addEventListener('click', handleSkip);
      this.btnSkip.addEventListener('touchend', handleSkip, { passive: false });
    }

    const handleAdvance = (e) => {
      if (!this.isPlaying) return;
      if (e.target.closest('#btn-skip-cinematic')) return;
      this.advance();
    };

    if (this.overlay) {
      this.overlay.addEventListener('click', handleAdvance);
      this.overlay.addEventListener('touchend', (e) => {
        if (!this.isPlaying) return;
        if (e.target.closest('#btn-skip-cinematic')) return;
        if (e.cancelable) e.preventDefault();
        this.advance();
      }, { passive: false });
    }

    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.advance();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        this.skip();
      }
    });
  }

  play(sequence, onComplete = null) {
    if (!sequence || !sequence.slides || sequence.slides.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    this.currentSequence = sequence;
    this.currentSlideIndex = 0;
    this.currentDialogueIndex = 0;
    this.isPlaying = true;
    this.onCompleteCallback = onComplete;

    if (this.stateManager) {
      this.stateManager.set('game_state', 'STATE_CINEMATIC');
    }

    if (this.overlay) {
      this.overlay.classList.remove('hidden');
    }

    // Inicializar capa de transición limpia sin forzar bloqueo negro permanente
    if (this.transitionLayer) {
      this.transitionLayer.style.transition = 'opacity 0.4s ease';
      this.transitionLayer.className = 'cinematic-transition-layer transition-clear';
    }

    // Construir diamantes indicadores de progreso de escena
    if (this.progressPipsEl) {
      this.progressPipsEl.innerHTML = sequence.slides
        .map((_, idx) => `<span class="cinematic-pip${idx === 0 ? ' active' : ''}" data-slide-pip="${idx}"></span>`)
        .join('');
    }

    if (typeof this.onWake === 'function') this.onWake();
    this._renderSlide(this.currentSlideIndex);
  }

  /**
   * Sincroniza los indicadores rúnicos de escena activa.
   * @private
   */
  _syncProgressPips(activeIndex) {
    if (!this.progressPipsEl) return;
    const pips = this.progressPipsEl.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('active', i === activeIndex);
      pips[i].classList.toggle('passed', i < activeIndex);
    }
  }

  _renderSlide(index) {
    const slide = this.currentSequence.slides[index];
    if (!slide) return;

    this.currentDialogueIndex = 0;
    this._syncProgressPips(index);

    // Mantener en RAM únicamente la escena actual y la inmediatamente siguiente
    const nextSlide = this.currentSequence?.slides?.[index + 1];
    const keepUrlA = this._safeUrl(slide.imagen_bg || '');
    const keepUrlB = this._safeUrl(nextSlide?.imagen_bg || '');
    for (const cachedUrl of this.imageCache.keys()) {
      if (cachedUrl !== keepUrlA && cachedUrl !== keepUrlB) {
        this.imageCache.delete(cachedUrl);
      }
    }

    // --- Manejo seguro de carga, decodificación y animación de cámara ---
    const reqToken = ++this._slideRequestToken;
    const applyLoadedVisual = () => {
      if (!this.isPlaying || reqToken !== this._slideRequestToken || !this.imageLayer) return;
      if (this.imageEl) {
        this.imageEl.src = keepUrlA;
        this.imageEl.classList.remove('is-loading');
      } else {
        this.imageLayer.style.backgroundImage = `url("${keepUrlA}")`;
      }
      this.imageLayer.className = 'cinematic-image-layer';
      void this.imageLayer.offsetWidth;
      const camClass = this._getCameraClass(slide.movimiento_camara);
      if (camClass) this.imageLayer.classList.add(camClass);
    };

    if (this.imageCache.has(keepUrlA)) {
      applyLoadedVisual();
    } else {
      if (this.imageEl) {
        this.imageEl.classList.add('is-loading');
      }
      this._preloadSlideUrl(slide.imagen_bg).then(() => {
        applyLoadedVisual();
      });
    }

    // Pre-cargar bajo demanda únicamente la siguiente escena mientras el usuario lee
    if (nextSlide?.imagen_bg) {
      this._preloadSlideUrl(nextSlide.imagen_bg);
    }

    // --- Manejo de la Transición de Entrada ---
    this._applyTransition(slide.transicion_entrada);

    // --- Renderizar primer diálogo ---
    this._renderDialogue();
  }

  _applyTransition(type) {
    if (!this.transitionLayer) return;
    
    // Primero determinamos el estado inicial de la capa de transición según el tipo
    switch(type) {
      case 'FadeIn':
        this.transitionLayer.className = 'cinematic-transition-layer transition-fade-black';
        break;
      case 'FlashBlanco':
        this.transitionLayer.className = 'cinematic-transition-layer transition-flash-white';
        break;
      case 'Crossfade':
        this.transitionLayer.className = 'cinematic-transition-layer transition-crossfade';
        break;
      case 'Cut':
      default:
        this.transitionLayer.className = 'cinematic-transition-layer transition-clear';
        break;
    }
    
    // Forzar reflow para aplicar CSS
    void this.transitionLayer.offsetWidth;
    
    // Luego aclaramos la capa de transición para mostrar la imagen (a menos que sea Cut)
    if (type !== 'Cut') {
      this.transitionLayer.className = 'cinematic-transition-layer transition-clear';
    }
  }

  _getCameraClass(camType) {
    switch (camType) {
      case 'SlowZoomIn': return 'camera-slow-zoom-in';
      case 'SlowZoomOut': return 'camera-slow-zoom-out';
      case 'PanRight': return 'camera-pan-right';
      case 'PanUp': return 'camera-pan-up';
      case 'SlowTiltUp': return 'camera-slow-tilt-up';
      case 'Shake': return 'camera-shake';
      case 'Static': return 'camera-static';
      default: return 'camera-static';
    }
  }

  _renderDialogue() {
    const slide = this.currentSequence.slides[this.currentSlideIndex];
    if (!slide || !slide.dialogos || !slide.dialogos[this.currentDialogueIndex]) {
      if (this.speakerEl) this.speakerEl.textContent = '';
      if (this.textEl) this.textEl.textContent = '';
      return;
    }

    const dialogueData = slide.dialogos[this.currentDialogueIndex];
    const speakerName = dialogueData.speaker || 'CRÓNICA';

    if (this.speakerEl) {
      this.speakerEl.textContent = speakerName;
    }
    if (this.captionBox) {
      this.captionBox.dataset.speaker = speakerName.toLowerCase();
    }

    if (this.textEl) {
      this._typewriterEffect(dialogueData.text);
    }
  }

  _typewriterEffect(text) {
    this.textEl.textContent = '';
    this.isTyping = true;
    this._twTargetText = text;
    this._twCharIndex = 0;
    this._twAccumulator = 0;
  }

  /**
   * Procesa la interacción del usuario:
   * 1. Si está tipeando, muestra todo de golpe.
   * 2. Si hay más diálogos en el slide, avanza al siguiente diálogo.
   * 3. Si no hay más diálogos, avanza al siguiente slide.
   */
  advance() {
    if (!this.isPlaying || !this.currentSequence) return;
    if (typeof this.onWake === 'function') this.onWake();

    const slide = this.currentSequence.slides[this.currentSlideIndex];
    if (!slide) return;

    // 1. Si está tipeando, saltar al final del texto actual
    if (this.isTyping) {
      this.textEl.textContent = this._twTargetText;
      this.isTyping = false;
      return;
    }

    // 2. Si hay más diálogos en la misma escena
    if (slide.dialogos && this.currentDialogueIndex < slide.dialogos.length - 1) {
      this.currentDialogueIndex++;
      this._renderDialogue();
      return;
    }

    // 3. Si no hay más diálogos, avanzar a la siguiente escena
    this.currentSlideIndex++;
    if (this.currentSlideIndex < this.currentSequence.slides.length) {
      this._renderSlide(this.currentSlideIndex);
    } else {
      this._triggerEndSequence();
    }
  }

  skip() {
    if (!this.isPlaying) return;
    if (typeof this.onWake === 'function') this.onWake();
    // Salto inmediato sin pantalla negra residual de 3 segundos
    this.end();
  }

  _triggerEndSequence() {
    if (this._transitionPending) return;
    this._transitionPending = true;
    // Fade a Negro rápido y cinematográfico (450ms) al culminar
    if (this.transitionLayer) {
      this.transitionLayer.style.transition = 'opacity 0.45s ease';
      this.transitionLayer.className = 'cinematic-transition-layer transition-fade-black';
    }

    this._endTimeoutId = setTimeout(() => {
      this._endTimeoutId = null;
      this._transitionPending = false;
      this.end();
    }, 450);
  }

  end() {
    if (this._endTimeoutId !== null) {
      clearTimeout(this._endTimeoutId);
      this._endTimeoutId = null;
    }
    this._slideRequestToken++;
    this.isPlaying = false;
    this.isTyping = false;
    this._transitionPending = false;
    this.currentSequence = null;

    if (this.overlay) {
      this.overlay.classList.add('hidden');
    }

    if (this.imageLayer) {
      this.imageLayer.className = 'cinematic-image-layer';
    }
    
    if (this.transitionLayer) {
      this.transitionLayer.className = 'cinematic-transition-layer';
      this.transitionLayer.style.transition = 'opacity 2s ease'; // restore
    }

    if (this.onCompleteCallback) {
      const cb = this.onCompleteCallback;
      this.onCompleteCallback = null;
      cb();
    }
  }

  update(deltaTime) {
    if (!this.isPlaying) return;

    // Procesar máquina de escribir atada al deltaTime del motor
    if (this.isTyping && this.textEl) {
      this._twAccumulator += deltaTime;
      while (this._twAccumulator >= this.TYPEWRITER_SPEED && this._twCharIndex < this._twTargetText.length) {
        this.textEl.textContent += this._twTargetText.charAt(this._twCharIndex);
        this._twCharIndex++;
        this._twAccumulator -= this.TYPEWRITER_SPEED;
      }
      if (this._twCharIndex >= this._twTargetText.length) {
        this.isTyping = false;
      }
    }
  }
}
