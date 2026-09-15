/**
 * @module LightManager
 * @description Sistema de iluminación dinámica 2D basado en máscara de oscuridad y blend modes.
 * Soporta antorchas y fuentes de luz con parpadeo orgánico (flicker suave con ondas sinusoidales compuestas),
 * atenuación radial y recorte sobre capa ambiental con `destination-out`.
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class LightManager {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas dedicado a la capa de luz
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    /** @type {string} Color y opacidad de la capa ambiental (oscuridad) */
    this.ambientLight = 'rgba(0, 0, 0, 0.82)';

    /** @type {Array<Object>} Fuentes de luz activas */
    this.lights = [];
  }

  /**
   * Registra una nueva fuente de luz.
   * @param {Object} light
   * @param {number} light.x - Coordenada X mundial
   * @param {number} light.y - Coordenada Y mundial
   * @param {number} light.radius - Radio de iluminación en píxeles
   * @param {number} [light.intensity=0.8] - Intensidad (0 a 1)
   * @param {boolean} [light.flicker=false] - Si debe emular parpadeo de fuego
   */
  addLight(light) {
    light.currentRadius = light.radius;
    light.targetRadius = light.radius;
    light._flickerPhase = Math.random() * Math.PI * 2;
    this.lights.push(light);
  }

  /**
   * Elimina una fuente de luz existente.
   * @param {Object} light
   */
  removeLight(light) {
    const index = this.lights.indexOf(light);
    if (index > -1) {
      this.lights.splice(index, 1);
    }
  }

  /**
   * STD-03 FIX: Actualiza el radio de las luces con interpolación suave en vez de ruido blanco errático.
   * Emula el comportamiento oscilante y vivo de una llama usando armónicos sinusoidales.
   * @param {number} deltaTime - Tiempo del frame en segundos
   */
  update(deltaTime) {
    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];

      if (light.flicker) {
        if (light._flickerPhase === undefined) {
          light._flickerPhase = Math.random() * 10;
        }

        // Avanzar fase del parpadeo
        light._flickerPhase += deltaTime * 7;

        // Combinación armónica de ondas para generar fluctuación orgánica
        const harmonic = Math.sin(light._flickerPhase) * 0.6 +
                         Math.sin(light._flickerPhase * 2.3) * 0.3 +
                         Math.sin(light._flickerPhase * 4.7) * 0.1;

        const maxOffset = light.radius * 0.08; // Variación máxima del 8%
        const targetRadius = light.radius + harmonic * maxOffset;

        // Interpolación suave (lerp) hacia el radio objetivo
        const lerpFactor = Math.min(1, deltaTime * 12);
        light.currentRadius = (light.currentRadius || light.radius) + (targetRadius - (light.currentRadius || light.radius)) * lerpFactor;
      } else {
        light.currentRadius = light.radius;
      }
    }
  }

  /**
   * Renderiza la capa de oscuridad y proyecta los conos de luz con recorte de transparencia.
   * @param {import('./Camera.js').Camera} camera
   */
  render(camera) {
    const { ctx, canvas } = this;

    // Limpiar frame previo
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Dibujar capa de penumbra global
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.ambientLight;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Aplicar transformación de la cámara
    camera.applyTransform(ctx);

    // 3. Recortar la oscuridad en la posición de cada luz
    ctx.globalCompositeOperation = 'destination-out';

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      const radius = light.currentRadius || light.radius;

      const gradient = ctx.createRadialGradient(
        light.x, light.y, 0,
        light.x, light.y, radius
      );

      // Centro iluminado al máximo (elimina la oscuridad)
      gradient.addColorStop(0, `rgba(255, 255, 255, ${light.intensity || 0.85})`);
      // Borde exterior con degradado suave
      gradient.addColorStop(0.7, `rgba(255, 255, 255, ${(light.intensity || 0.85) * 0.4})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(light.x, light.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Restaurar composite y matriz de la cámara
    ctx.globalCompositeOperation = 'source-over';
    camera.restoreTransform(ctx);
  }
}
