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
    this.transitionLayer = document.getElementById('cinematic-transition-layer');
    this.speakerEl = document.getElementById('cinematic-speaker');
    this.textEl = document.getElementById('cinematic-text');
    this.btnSkip = document.getElementById('btn-skip-cinematic');
    
    this.currentSequence = null;
    this.currentSlideIndex = 0;
    this.currentDialogueIndex = 0;
    
    this.isPlaying = false;
    this.onCompleteCallback = null;
    this.isTyping = false;

    /** @type {Map<string, HTMLImageElement>} Caché de imágenes decodificadas */
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
   * Pre-carga de forma asíncrona todas las imágenes de una secuencia cinemática.
   * Evita pausas, tartamudeos o pantallas negras prolongadas durante la reproducción.
   * @param {Object} sequence - Secuencia narrativa guiada por datos
   * @returns {Promise<void>}
   */
  async preloadSequence(sequence) {
    if (!sequence || !sequence.slides) return;
    const loadPromises = sequence.slides.map((slide) => {
      return new Promise((resolve) => {
        if (!slide.imagen_bg) return resolve();
        if (this.imageCache.has(slide.imagen_bg)) return resolve();

        const img = new Image();
        img.src = slide.imagen_bg;
        img.onload = () => {
          this.imageCache.set(slide.imagen_bg, img);
          if ('decode' in img) {
            img.decode().then(resolve).catch(resolve);
          } else {
            resolve();
          }
        };
        img.onerror = () => {
          console.warn(`[CinematicManager] No se pudo pre-cargar: ${slide.imagen_bg}`);
          resolve();
        };
      });
    });

    await Promise.all(loadPromises);
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log(`[CinematicManager] Pre-cargadas ${this.imageCache.size} escenas cinemáticas.`);
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

    this._renderSlide(this.currentSlideIndex);
  }

  _renderSlide(index) {
    const slide = this.currentSequence.slides[index];
    if (!slide) return;

    this.currentDialogueIndex = 0;

    // --- Manejo de la Cámara y Background ---
    if (this.imageLayer) {
      this.imageLayer.style.backgroundImage = `url('${slide.imagen_bg}')`;
      this.imageLayer.className = 'cinematic-image-layer'; // reset classes
      
      void this.imageLayer.offsetWidth; // force reflow

      const camClass = this._getCameraClass(slide.movimiento_camara);
      if (camClass) this.imageLayer.classList.add(camClass);
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
    
    if (this.speakerEl) {
      this.speakerEl.textContent = dialogueData.speaker || 'LORE';
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
    // Salto inmediato sin pantalla negra residual de 3 segundos
    this.end();
  }

  _triggerEndSequence() {
    // Fade a Negro rápido y cinematográfico (450ms) al culminar
    if (this.transitionLayer) {
      this.transitionLayer.style.transition = 'opacity 0.45s ease';
      this.transitionLayer.className = 'cinematic-transition-layer transition-fade-black';
    }
    
    setTimeout(() => {
      this.end();
    }, 450);
  }

  end() {
    this.isPlaying = false;
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
