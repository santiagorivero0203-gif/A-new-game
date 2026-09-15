export class AnimationController {
  /**
   * @param {HTMLImageElement} image - Spritesheet de la entidad
   * @param {Object} jsonConfig - JSON con la definición de los cuadros (TexturePacker/Aseprite style)
   */
  constructor(image, jsonConfig) {
    this.image = image;
    this.config = jsonConfig; // Expected { frames: { "idle_0": {frame: {x,y,w,h}}, ... }, animations: { "idle": ["idle_0", "idle_1"], ... } }
    
    this.currentAnim = null;
    this.currentFrameIndex = 0;
    this.frameTimer = 0;
    this.fps = 12; // Frames per second de la animación por defecto
    this.frameDuration = 1 / this.fps; // Segundos por cuadro
    
    this.isPlaying = false;
    this.loop = true;
  }

  play(animName, fps = 12, loop = true) {
    if (this.currentAnim === animName) return; // Ya se está reproduciendo
    
    if (!this.config.animations[animName]) {
      console.warn(`Animación no encontrada: ${animName}`);
      return;
    }

    this.currentAnim = animName;
    this.fps = fps;
    this.frameDuration = 1 / this.fps;
    this.loop = loop;
    
    this.currentFrameIndex = 0;
    this.frameTimer = 0;
    this.isPlaying = true;
  }

  update(deltaTime) {
    if (!this.isPlaying || !this.currentAnim) return;

    this.frameTimer += deltaTime;

    if (this.frameTimer >= this.frameDuration) {
      this.frameTimer -= this.frameDuration;
      this.currentFrameIndex++;

      const animFrames = this.config.animations[this.currentAnim];
      
      if (this.currentFrameIndex >= animFrames.length) {
        if (this.loop) {
          this.currentFrameIndex = 0;
        } else {
          this.currentFrameIndex = animFrames.length - 1;
          this.isPlaying = false;
        }
      }
    }
  }

  draw(ctx, x, y, scale = 1) {
    if (!this.currentAnim) return;

    const animFrames = this.config.animations[this.currentAnim];
    const frameKey = animFrames[this.currentFrameIndex];
    const frameData = this.config.frames[frameKey].frame;

    ctx.drawImage(
      this.image,
      frameData.x, frameData.y, frameData.w, frameData.h,
      x, y, frameData.w * scale, frameData.h * scale
    );
  }
}
