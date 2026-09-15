/**
 * @module CinematicManager
 * @description Administrador autónomo del sistema de cinemáticas narrativas para 'Be a Legend'.
 * Opera en el DOM Overlay con imágenes en alta resolución 16:9, efectos de cámara Ken Burns
 * (zoom in/out y paneo dinámico), diálogos inmersivos y control por teclado, ratón o toque táctil.
 * Cumple estrictamente con las reglas de 'Show, Don't Tell' y Cero Placeholder Slop.
 * @author Be a Legend Team
 * @version 1.0.0
 */

/**
 * Secuencia narrativa del Prólogo: "El Legado de la Reliquia"
 */
export const PROLOGUE_CUTSCENE = {
  id: 'prologue_intro',
  slides: [
    {
      image: '/assets/cinematics/intro_1_battle.svg',
      zoomEffect: 'zoom-in',
      speaker: 'CRÓNICAS DE ARCADIA',
      dialogue: 'Durante eones, el Reino de Arcadia resistió bajo la custodia del Héroe Milenario. Pero en la hora más oscura, el Soberano de las Sombras quebró el equilibrio primordial...',
      duration: 8.0
    },
    {
      image: '/assets/cinematics/intro_2_relic.svg',
      zoomEffect: 'zoom-out',
      speaker: 'HÉROE MILENARIO',
      dialogue: '"El fuego en mí se extingue, joven guardián... Toma la Reliquia Milenaria. Absorbe la fuerza de los 4 grandes templos... y sé la leyenda que este reino necesita."',
      duration: 9.0
    },
    {
      image: '/assets/cinematics/intro_3_horizon.svg',
      zoomEffect: 'zoom-in',
      speaker: 'DESTINO',
      dialogue: 'Con la reliquia sagrada palpitando en tus manos y el mundo al borde del abismo, tu viaje comienza en los confines de El Bosque. Es hora de forjar tu leyenda.',
      duration: 8.5
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
    this.speakerEl = document.getElementById('cinematic-speaker');
    this.textEl = document.getElementById('cinematic-text');
    this.btnSkip = document.getElementById('btn-skip-cinematic');
    this.promptEl = document.getElementById('cinematic-prompt');

    /** @type {Object|null} Secuencia activa */
    this.currentSequence = null;

    /** @type {number} Índice de la diapositiva actual */
    this.currentSlideIndex = 0;

    /** @type {number} Tiempo transcurrido en la diapositiva actual */
    this.slideTimer = 0;

    /** @type {boolean} Si la cinemática está actualmente activa */
    this.isPlaying = false;

    /** @type {Function|null} Callback al finalizar o saltar */
    this.onCompleteCallback = null;

    this._bindEvents();
  }

  /**
   * Registra los eventos de interacción del usuario (Teclado, ratón, toque).
   * @private
   */
  _bindEvents() {
    // Botón de salto
    if (this.btnSkip) {
      this.btnSkip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.skip();
      });
    }

    // Clic o toque en el overlay para avanzar
    if (this.overlay) {
      this.overlay.addEventListener('click', (e) => {
        if (!this.isPlaying) return;
        // Evitar que el clic en el botón de skip dispare el avance de diapositiva
        if (e.target.closest('#btn-skip-cinematic')) return;
        this.nextSlide();
      });
    }

    // Teclas de interacción: Espacio / Enter para avanzar, Escape para saltar
    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.nextSlide();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        this.skip();
      }
    });
  }

  /**
   * Inicia la reproducción de una secuencia cinemática.
   * @param {Object} sequence - Objeto con lista de diapositivas
   * @param {Function} [onComplete] - Callback invocado al terminar o saltar
   */
  play(sequence, onComplete = null) {
    if (!sequence || !sequence.slides || sequence.slides.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    this.currentSequence = sequence;
    this.currentSlideIndex = 0;
    this.slideTimer = 0;
    this.isPlaying = true;
    this.onCompleteCallback = onComplete;

    if (this.stateManager) {
      this.stateManager.set('game_state', 'STATE_CINEMATIC');
    }

    if (this.overlay) {
      this.overlay.classList.remove('hidden');
    }

    this._renderSlide(this.currentSlideIndex);
  }

  /**
   * Carga y proyecta la diapositiva en pantalla aplicando efectos Ken Burns.
   * @private
   * @param {number} index
   */
  _renderSlide(index) {
    const slide = this.currentSequence.slides[index];
    if (!slide) return;

    this.slideTimer = 0;

    // 1. Asignar imagen y reiniciar clases de animación Ken Burns
    if (this.imageLayer) {
      this.imageLayer.style.backgroundImage = `url('${slide.image}')`;
      this.imageLayer.classList.remove('ken-burns-zoom-in', 'ken-burns-zoom-out', 'ken-burns-pan-left');

      // Forzar reflujo de animación
      void this.imageLayer.offsetWidth;

      const effectClass = slide.zoomEffect === 'zoom-out' ? 'ken-burns-zoom-out' : 'ken-burns-zoom-in';
      this.imageLayer.classList.add(effectClass);
    }

    // 2. Asignar interlocutor
    if (this.speakerEl) {
      this.speakerEl.textContent = slide.speaker || 'LORE';
    }

    // 3. Asignar diálogo con animación suave de texto
    if (this.textEl) {
      this.textEl.style.opacity = '0';
      this.textEl.textContent = slide.dialogue || '';
      requestAnimationFrame(() => {
        if (this.textEl) {
          this.textEl.style.transition = 'opacity 0.4s ease';
          this.textEl.style.opacity = '1';
        }
      });
    }
  }

  /**
   * Avanza a la siguiente diapositiva o finaliza la cinemática.
   */
  nextSlide() {
    if (!this.isPlaying || !this.currentSequence) return;

    this.currentSlideIndex++;

    if (this.currentSlideIndex < this.currentSequence.slides.length) {
      this._renderSlide(this.currentSlideIndex);
    } else {
      this.end();
    }
  }

  /**
   * Salta la cinemática de inmediato.
   */
  skip() {
    if (!this.isPlaying) return;
    this.end();
  }

  /**
   * Concluye la secuencia cinemática y restaura el estado de juego.
   */
  end() {
    this.isPlaying = false;
    this.currentSequence = null;

    if (this.overlay) {
      this.overlay.classList.add('hidden');
    }

    if (this.imageLayer) {
      this.imageLayer.classList.remove('ken-burns-zoom-in', 'ken-burns-zoom-out', 'ken-burns-pan-left');
    }

    if (this.onCompleteCallback) {
      const cb = this.onCompleteCallback;
      this.onCompleteCallback = null;
      cb();
    }
  }

  /**
   * Actualización por frame para auto-avance opcional si se excede la duración.
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!this.isPlaying || !this.currentSequence) return;

    const currentSlide = this.currentSequence.slides[this.currentSlideIndex];
    if (!currentSlide) return;

    this.slideTimer += deltaTime;

    // Auto-avance suave si se agota la duración
    if (currentSlide.duration && this.slideTimer >= currentSlide.duration) {
      this.nextSlide();
    }
  }
}
