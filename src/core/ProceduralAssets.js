/**
 * @module ProceduralAssets
 * @description Generador de sprites procedurales (pipeline "Nano Banana").
 * Crea texturas y sprites mediante Canvas API puro en tiempo de ejecución para usar
 * como placeholders funcionales de pixel-art sin requerir archivos PNG externos.
 * @author Be a Legend Team
 * @version 1.0.0
 */

export class ProceduralAssets {
  /**
   * Genera un asset procedural y devuelve un Data URI en base64.
   * @param {string} key Identificador del asset
   * @param {number} size Tamaño (ej. 32 o 64)
   * @returns {string} Data URI (base64 PNG)
   */
  static generate(key, size = 32) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Desactivar antialiasing para mantener estilo pixel-art
    ctx.imageSmoothingEnabled = false;

    switch (key) {
      case 'grass_tile':
        ctx.fillStyle = '#4ade80'; // Verde pasto
        ctx.fillRect(0, 0, size, size);
        // Detalles de pasto
        ctx.fillStyle = '#22c55e';
        for (let i = 0; i < 12; i++) {
          const x = Math.floor(Math.random() * size);
          const y = Math.floor(Math.random() * size);
          ctx.fillRect(x, y, 2, 4);
        }
        break;

      case 'dirt_tile':
        ctx.fillStyle = '#a16207'; // Marrón tierra
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#854d0e';
        for (let i = 0; i < 8; i++) {
          const x = Math.floor(Math.random() * size);
          const y = Math.floor(Math.random() * size);
          ctx.fillRect(x, y, 4, 2);
        }
        break;

      case 'tree_sprite':
        // Tronco
        ctx.fillStyle = '#78350f';
        ctx.fillRect(size * 0.4, size * 0.5, size * 0.2, size * 0.5);
        // Hojas (triángulo o romboide)
        ctx.fillStyle = '#166534';
        ctx.beginPath();
        ctx.moveTo(size * 0.5, 0);
        ctx.lineTo(size * 0.9, size * 0.6);
        ctx.lineTo(size * 0.1, size * 0.6);
        ctx.closePath();
        ctx.fill();
        break;

      case 'house_sprite':
        // Base
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(size * 0.1, size * 0.4, size * 0.8, size * 0.6);
        // Techo
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.moveTo(size * 0.5, 0);
        ctx.lineTo(size, size * 0.4);
        ctx.lineTo(0, size * 0.4);
        ctx.closePath();
        ctx.fill();
        // Puerta
        ctx.fillStyle = '#451a03';
        ctx.fillRect(size * 0.4, size * 0.7, size * 0.2, size * 0.3);
        break;

      case 'bush_sprite':
        ctx.fillStyle = '#15803d'; // Verde oscuro
        ctx.beginPath();
        ctx.arc(size * 0.5, size * 0.6, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Variación
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(size * 0.3, size * 0.5, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;

      default:
        // Patrón missing texture estilo Source Engine (magenta/negro)
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(0, 0, size / 2, size / 2);
        ctx.fillRect(size / 2, size / 2, size / 2, size / 2);
        ctx.fillStyle = '#000000';
        ctx.fillRect(size / 2, 0, size / 2, size / 2);
        ctx.fillRect(0, size / 2, size / 2, size / 2);
        break;
    }

    return canvas.toDataURL('image/png');
  }
}
