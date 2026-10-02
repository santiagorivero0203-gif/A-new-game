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
   * Dimensiones canónicas de entidades en píxeles.
   */
  static DEFAULT_SIZES = {
    tree_sprite: { width: 84, height: 98 },
    house_sprite: { width: 140, height: 120 },
    bush_sprite: { width: 48, height: 44 },
    grass_tile: { width: 32, height: 32 },
    dirt_tile: { width: 32, height: 32 }
  };

  /**
   * Genera un asset procedural y devuelve un Data URI en base64.
   * @param {string} key Identificador del asset
   * @param {number} [customWidth] Ancho opcional
   * @param {number} [customHeight] Alto opcional
   * @returns {string} Data URI (base64 PNG)
   */
  static generate(key, customWidth = null, customHeight = null) {
    const defaults = ProceduralAssets.DEFAULT_SIZES[key] || { width: 32, height: 32 };
    const w = (customWidth && customHeight) ? customWidth : defaults.width;
    const h = (customWidth && customHeight) ? customHeight : defaults.height;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    switch (key) {
      case 'grass_tile':
        // Pasto esmeralda uniforme 32x32 estilo Minish Cap
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(10, 12, 3, 5);
        ctx.fillRect(22, 20, 4, 4);
        ctx.fillStyle = '#86efac';
        ctx.fillRect(10, 11, 2, 2);
        break;

      case 'dirt_tile':
        // Tierra cálida beige suave 32x32
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(8, 14, 10, 6);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(12, 16, 4, 3);
        break;

      case 'tree_sprite': {
        // Árbol frondoso 84x98 con capas de follaje y tronco detallado
        // 1. Sombra suave en la base
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(42, 90, 26, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Tronco de madera
        ctx.fillStyle = '#92400e';
        ctx.fillRect(34, 68, 16, 24);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(34, 68, 4, 24);

        // 3. Copa de hojas en racimos estilizados
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(42, 42, 36, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(40, 38, 32, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(36, 32, 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#86efac';
        ctx.beginPath();
        ctx.arc(32, 26, 10, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'house_sprite': {
        // Cabaña 140x120: base de piedra, paredes de estuco, tejado a dos aguas y chimenea
        // Sombra
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(10, 110, 120, 8);

        // Chimenea
        ctx.fillStyle = '#64748b';
        ctx.fillRect(100, 10, 16, 30);
        ctx.fillStyle = '#475569';
        ctx.fillRect(98, 8, 20, 6);

        // Muros
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(20, 50, 100, 65);

        // Base de piedra
        ctx.fillStyle = '#78716c';
        ctx.fillRect(18, 105, 104, 12);

        // Tejado
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(70, 15);
        ctx.lineTo(130, 55);
        ctx.lineTo(10, 55);
        ctx.closePath();
        ctx.fill();

        // Puerta de madera
        ctx.fillStyle = '#78350f';
        ctx.fillRect(58, 75, 24, 38);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(74, 94, 3, 3); // Manija

        // Ventana con luz cálida
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(28, 68, 20, 20);
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2;
        ctx.strokeRect(28, 68, 20, 20);
        ctx.beginPath();
        ctx.moveTo(38, 68);
        ctx.lineTo(38, 88);
        ctx.moveTo(28, 78);
        ctx.lineTo(48, 78);
        ctx.stroke();
        break;
      }

      case 'bush_sprite': {
        // Arbusto reactivo 48x44 con hojas y flores silvestres
        // Sombra
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.ellipse(24, 40, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Follaje base
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(24, 24, 16, 0, Math.PI * 2);
        ctx.arc(14, 28, 12, 0, Math.PI * 2);
        ctx.arc(34, 28, 12, 0, Math.PI * 2);
        ctx.fill();

        // Capa media
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(23, 21, 13, 0, Math.PI * 2);
        ctx.arc(15, 25, 9, 0, Math.PI * 2);
        ctx.arc(32, 25, 9, 0, Math.PI * 2);
        ctx.fill();

        // Puntos de luz
        ctx.fillStyle = '#86efac';
        ctx.beginPath();
        ctx.arc(21, 16, 5, 0, Math.PI * 2);
        ctx.arc(29, 18, 4, 0, Math.PI * 2);
        ctx.fill();

        // Flores de colores
        ctx.fillStyle = '#fde047';
        ctx.fillRect(16, 20, 3, 3);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(30, 22, 3, 3);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(23, 30, 3, 3);
        break;
      }

      default:
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(0, 0, w / 2, h / 2);
        ctx.fillRect(w / 2, h / 2, w / 2, h / 2);
        ctx.fillStyle = '#000000';
        ctx.fillRect(w / 2, 0, w / 2, h / 2);
        ctx.fillRect(0, h / 2, w / 2, h / 2);
        break;
    }

    return canvas.toDataURL('image/png');
  }
}
