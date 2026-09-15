/**
 * @module AnimationController
 * @description Controlador de animaciones 2D de alta fidelidad (Next-Gen 60 FPS).
 * Gestiona spritesheets de alto conteo de fotogramas, transiciones de estado sin saltos,
 * cálculo de progreso sub-frame para interpolación temporal y multiplicadores de velocidad variable.
 * @author Be a Legend Team
 * @version 1.3.0
 */
export class AnimationController {
  /**
   * @param {HTMLImageElement|HTMLCanvasElement} image - Textura del spritesheet
   * @param {Object} jsonConfig - Descriptor JSON conteniendo frames y animaciones
   */
  constructor(image, jsonConfig) {
    this.image = image;
    this.config = jsonConfig;

    /** @type {string|null} Nombre de la animación en curso */
    this.currentAnim = null;

    /** @type {number} Índice del frame actual */
    this.currentFrameIndex = 0;

    /** @type {number} Acumulador de tiempo en segundos */
    this.frameTimer = 0;

    /** @type {number} Tasa de refresco en FPS del clip (admite hasta 60 FPS) */
    this.fps = 24;

    /** @type {number} Duración en segundos de cada cuadro */
    this.frameDuration = 1 / this.fps;

    /** @type {number} Factor de progreso entre el cuadro actual y el siguiente [0..1] para interpolación */
    this.frameProgress = 0;

    /** @type {number} Multiplicador de velocidad de reproducción */
    this.speedScale = 1.0;

    /** @type {boolean} Estado de reproducción */
    this.isPlaying = false;

    /** @type {boolean} Si la animación se reproduce en bucle continuo */
    this.loop = true;

    /** @type {Function|null} Callback al completar la animación */
    this.onComplete = null;
  }

  /**
   * Inicia o cambia a una animación especificada con soporte de 60 FPS.
   * @param {string} animName - Nombre del clip
   * @param {number} [fps=24] - Velocidad deseada (ej: 12, 24, 30 o 60 FPS)
   * @param {boolean} [loop=true] - Reproducción en bucle
   */
  play(animName, fps = 24, loop = true) {
    if (this.currentAnim === animName && this.isPlaying) return;

    if (!this.config || !this.config.animations || !this.config.animations[animName]) {
      return;
    }

    this.currentAnim = animName;
    this.fps = fps;
    this.frameDuration = 1 / Math.max(1, this.fps);
    this.loop = loop;

    this.currentFrameIndex = 0;
    this.frameTimer = 0;
    this.frameProgress = 0;
    this.isPlaying = true;
  }

  /**
   * Actualiza el temporizador e interpola el progreso sub-frame para 60 FPS súper fluidos.
   * @param {number} deltaTime - Tiempo transcurrido en segundos
   */
  update(deltaTime) {
    if (!this.isPlaying || !this.currentAnim) return;

    const scaledDt = deltaTime * this.speedScale;
    this.frameTimer += scaledDt;

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
          if (this.onComplete) this.onComplete(this.currentAnim);
          break;
        }
      }
    }

    // Progreso normalizado [0..1] dentro del cuadro actual para interpolación
    this.frameProgress = Math.min(1, Math.max(0, this.frameTimer / this.frameDuration));
  }

  /**
   * Dibuja el cuadro actual con posición y escala precisas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - Coordenada X
   * @param {number} y - Coordenada Y
   * @param {number} [scale=1] - Factor de escala
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
