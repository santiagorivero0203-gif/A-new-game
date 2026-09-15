/**
 * @module LightManager
 * @description Sistema de iluminación dinámica 2D basado en máscara de oscuridad y blend modes.
 * Admite alternancia entre interiores oscuros (cuevas, mazmorras) y exteriores diurnos (isInterior).
 * Soporta antorchas y fuentes de luz con parpadeo orgánico (flicker suave con ondas sinusoidales compuestas),
 * atenuación radial y recorte sobre capa ambiental con `destination-out`.
 * @author Be a Legend Team
 * @version 1.2.0
 */
export class LightManager {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas dedicado a la capa de luz
   * @param {boolean} [isInterior=false] - Define si el mapa actual requiere máscara de oscuridad
   */
  constructor(canvas, isInterior = false) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    /**
     * Define si el mapa actual es un interior oscuro o un exterior a plena luz del día.
     * Si es false, desactiva por completo la capa de oscuridad y las luces dinámicas.
     * @type {boolean}
     */
    this.isInterior = isInterior;

    /** @type {string} Color y opacidad de la capa ambiental (oscuridad para interiores) */
    this.ambientLight = 'rgba(0, 0, 0, 0.85)';

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
   * Limpia todas las luces registradas (útil en cambios de nivel).
   */
  clearLights() {
    this.lights = [];
  }

  /**
   * STD-03 FIX: Actualiza el radio de las luces con interpolación suave en vez de ruido blanco errático.
   * En exteriores (isInterior = false), omite el cómputo para ahorrar CPU.
   * @param {number} deltaTime - Tiempo del frame en segundos
   */
  update(deltaTime) {
    if (!this.isInterior) return;

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
   * Renderiza la capa de iluminación.
   * Si `isInterior` es false, limpia el lienzo y no dibuja ninguna oscuridad,
   * permitiendo visualización diurna nítida y brillante.
   * @param {import('./Camera.js').Camera} camera
   */
  render(camera) {
    const { ctx, canvas } = this;

    // Limpiar fotograma anterior
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // En exteriores a plena luz del día, no se aplica máscara de penumbra
    if (!this.isInterior) {
      return;
    }

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
