/**
 * @module AnimationController
 * @description Controlador de animaciones 2D basado en spritesheets y mapas JSON (formato estándar Aseprite / TexturePacker).
 * Gestiona transiciones de estado de animación, tasas de refresco independientes por clip (FPS variable),
 * bucles y renderizado pixel-perfect a 60 FPS estables.
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class AnimationController {
  /**
   * @param {HTMLImageElement} image - Textura del spritesheet cargada mediante ResourceManager
   * @param {Object} jsonConfig - Descriptor JSON conteniendo frames y clips de animación
   * @example
   * {
   *   frames: { "hero_idle_0": { frame: { x: 0, y: 0, w: 32, h: 32 } } },
   *   animations: { "idle": ["hero_idle_0"] }
   * }
   */
  constructor(image, jsonConfig) {
    this.image = image;
    this.config = jsonConfig;

    /** @type {string|null} Nombre de la animación en curso */
    this.currentAnim = null;

    /** @type {number} Índice del frame dentro de la secuencia actual */
    this.currentFrameIndex = 0;

    /** @type {number} Acumulador de tiempo para cambio de frame */
    this.frameTimer = 0;

    /** @type {number} Fotogramas por segundo del clip */
    this.fps = 12;

    /** @type {number} Duración en segundos de cada cuadro */
    this.frameDuration = 1 / this.fps;

    /** @type {boolean} Estado de reproducción */
    this.isPlaying = false;

    /** @type {boolean} Si la animación debe repetirse en bucle */
    this.loop = true;
  }

  /**
   * Inicia la reproducción de una animación especificada en el archivo JSON.
   * Si la animación ya está en curso, no se interrumpe.
   * @param {string} animName - Clave del clip en el JSON
   * @param {number} [fps=12] - Velocidad de reproducción deseada
   * @param {boolean} [loop=true] - Si se reinicia al finalizar
   */
  play(animName, fps = 12, loop = true) {
    if (this.currentAnim === animName && this.isPlaying) return;

    if (!this.config || !this.config.animations || !this.config.animations[animName]) {
      console.warn(`[AnimationController] Animación no encontrada: "${animName}"`);
      return;
    }

    this.currentAnim = animName;
    this.fps = fps;
    this.frameDuration = 1 / Math.max(1, this.fps);
    this.loop = loop;

    this.currentFrameIndex = 0;
    this.frameTimer = 0;
    this.isPlaying = true;
  }

  /**
   * Pausa la animación actual.
   */
  pause() {
    this.isPlaying = false;
  }

  /**
   * Reanuda la animación pausada.
   */
  resume() {
    if (this.currentAnim) {
      this.isPlaying = true;
    }
  }

  /**
   * Avanza el temporizador de la animación y cambia de fotograma según deltaTime.
   * @param {number} deltaTime - Tiempo del fotograma en segundos
   */
  update(deltaTime) {
    if (!this.isPlaying || !this.currentAnim) return;

    this.frameTimer += deltaTime;

    while (this.frameTimer >= this.frameDuration) {
      this.frameTimer -= this.frameDuration;
      this.currentFrameIndex++;

      const animFrames = this.config.animations[this.currentAnim];

      if (this.currentFrameIndex >= animFrames.length) {
        if (this.loop) {
          this.currentFrameIndex = 0;
        } else {
          this.currentFrameIndex = animFrames.length - 1;
          this.isPlaying = false;
          break;
        }
      }
    }
  }

  /**
   * Dibuja el cuadro actual en el contexto 2D.
   * @param {CanvasRenderingContext2D} ctx - Contexto 2D del canvas
   * @param {number} x - Posición X en el lienzo
   * @param {number} y - Posición Y en el lienzo
   * @param {number} [scale=1] - Factor de escala de dibujo
   */
  draw(ctx, x, y, scale = 1) {
    if (!this.currentAnim || !this.image) return;

    const animFrames = this.config.animations[this.currentAnim];
    const frameKey = animFrames[this.currentFrameIndex];
    const frameData = this.config.frames[frameKey].frame;

    ctx.drawImage(
      this.image,
      frameData.x, frameData.y, frameData.w, frameData.h,
      Math.floor(x), Math.floor(y),
      Math.floor(frameData.w * scale),
      Math.floor(frameData.h * scale)
    );
  }
}
