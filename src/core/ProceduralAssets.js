/**
 * @module ProceduralAssets
 * @description Fábrica de texturas y estructuras ambientales estilizadas bajo estética
 * Cel-Shaded Anime / The Minish Cap / Eastward.
 *
 * Aplica **Hue Shifting** en lugar de sombras negras/grises puras:
 * - Sombras vegetales desplazadas hacia azul petróleo / verde bosque frío (`#0f3d44`).
 * - Luces solares desplazadas hacia lima dorado y crema ámbar (`#bef264`, `#fef3c7`).
 * - Madera y tejados sombreados en ciruela/índigo y realzados en ocre cálido.
 *
 * @author Be a Legend Team
 * @version 2.0.0
 */

const INK = '#050811';

export class ProceduralAssets {
  /** @type {Record<string, {width: number, height: number}>} Dimensiones base por clave */
  static DEFAULT_SIZES = {
    tree_sprite: { width: 84, height: 98 },
    house_sprite: { width: 160, height: 144 },
    bush_sprite: { width: 48, height: 44 },
    grass_tile: { width: 32, height: 32 },
    dirt_tile: { width: 32, height: 32 }
  };

  /**
   * Elimina cualquier píxel semitransparente producido por anti-aliasing convirtiendo
   * el canal alfa en binario (0 o 255) para obtener bordes Pixel-Art 100% nítidos.
   * @param {HTMLCanvasElement} canvas
   */
  static _crispenCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.getImageData !== 'function') return;
    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const data = img && img.data;
    if (!data || data.length !== w * h * 4) return;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 100) {
        data[i + 3] = 0;
      } else {
        if (a < 230 && data[i] < 55 && data[i + 1] < 55 && data[i + 2] < 70) {
          data[i] = 5;
          data[i + 1] = 8;
          data[i + 2] = 17;
        }
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /**
   * Renderiza una masa orgánica de lóbulos foliares unificados en 4 pasadas pixel-art
   * para obtener una silueta continua sin círculos negros cortando el interior del arbusto o copa.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<{cx: number, cy: number, rx: number, ry: number, crease?: boolean}>} lobes
   * @param {{outline?: string, shadow?: string, mid?: string, light?: string}} [palette]
   */
  static _drawUnifiedFoliageCluster(ctx, lobes, palette = {}) {
    const outline = palette.outline || INK;
    const shadow = palette.shadow || '#1d5c38';
    const mid = palette.mid || '#6ebd30';
    const light = palette.light || '#b6e345';

    const paintScanlineEllipse = (cx, cy, rx, ry, color) => {
      if (rx <= 0 || ry <= 0) return;
      const icx = Math.round(cx);
      const icy = Math.round(cy);
      const irx = Math.round(rx);
      const iry = Math.round(ry);
      ctx.fillStyle = color;
      for (let dy = -iry; dy <= iry; dy++) {
        const normY = dy / (iry + 0.35);
        const hw = Math.max(1, Math.round(irx * Math.sqrt(Math.max(0, 1 - normY * normY))));
        ctx.fillRect(icx - hw, icy + dy, hw * 2, 1);
      }
    };

    // Pasada 1: Contorno exterior unificado de toda la silueta (#050811)
    for (let i = 0; i < lobes.length; i++) {
      const l = lobes[i];
      paintScanlineEllipse(l.cx, l.cy, l.rx + 1, l.ry + 1, outline);
    }

    // Pasada 2: Base de sombra verde bosque profundo
    for (let i = 0; i < lobes.length; i++) {
      const l = lobes[i];
      paintScanlineEllipse(l.cx, l.cy, l.rx, l.ry, shadow);
    }

    // Pasada 3: Masa principal de tono medio deslocada arriba-izquierda
    for (let i = 0; i < lobes.length; i++) {
      const l = lobes[i];
      paintScanlineEllipse(
        l.cx - 1,
        l.cy - 1,
        Math.max(2, l.rx - 1),
        Math.max(2, l.ry - 2),
        mid
      );
    }

    // Pasada 4: Brillos cálidos verde lima en la parte superior izquierda de cada lóbulo
    for (let i = 0; i < lobes.length; i++) {
      const l = lobes[i];
      paintScanlineEllipse(
        l.cx - 1,
        l.cy - Math.max(1, Math.round(l.ry * 0.28)),
        Math.max(2, Math.round(l.rx * 0.7)),
        Math.max(2, Math.round(l.ry * 0.56)),
        light
      );
    }

    // Pasada 5: Pliegues cortos de solapamiento (arcos sutiles de 1px sin cerrar círculos)
    for (let i = 0; i < lobes.length; i++) {
      const l = lobes[i];
      if (!l.crease) continue;
      const icx = Math.round(l.cx);
      const icy = Math.round(l.cy);
      const irx = Math.round(l.rx);
      const iry = Math.round(l.ry);
      ctx.fillStyle = shadow;
      ctx.fillRect(icx - irx + 2, icy + Math.round(iry * 0.5), Math.max(3, Math.round(irx * 0.6)), 2);
      ctx.fillStyle = outline;
      ctx.fillRect(icx - irx + 2, icy + Math.round(iry * 0.65), Math.max(2, Math.round(irx * 0.4)), 1);
    }
  }

  /**
   * Dibuja un lóbulo orgánico 100% en Pixel-Art usando scanlines enteras `fillRect`
   * (contorno 1px negro `#050811`, sombra `#1d5c38`, tono medio `#6ebd30` y luz `#b6e345`).
   * @private
   */
  static _drawPixelBlob(ctx, cx, cy, rx, ry, colors = {}) {
    ProceduralAssets._drawUnifiedFoliageCluster(ctx, [{ cx, cy, rx, ry }], colors);
  }

  /**
   * Genera un asset gráfico en formato Data URI PNG Pixel-Art listo para `HTMLImageElement`.
   * @param {string} key - Clave del asset (`grass_tile`, `dirt_tile`, `tree_sprite`, `house_sprite`, `bush_sprite`).
   * @param {number} [tileSize=32] - Tamaño de referencia para losetas de terreno.
   * @returns {string} Data URL (`image/png`).
   */
  static generate(key, tileSize = 32) {
    const defaults = ProceduralAssets.DEFAULT_SIZES[key] || { width: 32, height: 32 };
    const isTile = key === 'grass_tile' || key === 'dirt_tile';
    const w = isTile ? tileSize : defaults.width;
    const h = isTile ? tileSize : defaults.height;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    switch (key) {
      case 'grass_tile':
        ProceduralAssets._drawGrassTile(ctx, w, h);
        break;
      case 'dirt_tile':
        ProceduralAssets._drawDirtTile(ctx, w, h);
        break;
      case 'tree_sprite':
        ProceduralAssets._drawTreeSprite(ctx, w, h);
        break;
      case 'house_sprite':
        ProceduralAssets._drawHouseSprite(ctx, w, h);
        break;
      case 'bush_sprite':
        ProceduralAssets._drawBushSprite(ctx, w, h);
        break;
      default:
        ctx.fillStyle = '#4da33b';
        ctx.fillRect(0, 0, w, h);
        break;
    }

    ProceduralAssets._crispenCanvas(canvas);
    return canvas.toDataURL('image/png');
  }

  /**
   * Dibuja una loseta de hierba base (32x32) en estricto Pixel-Art con coordenadas enteras.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  static _drawGrassTile(ctx, w, h) {
    // Fondo verde hierba limpio y armonizado con los arbustos pixel-art
    ctx.fillStyle = '#4da33b';
    ctx.fillRect(0, 0, w, h);

    // Parches sutiles en coordenadas enteras
    ctx.fillStyle = '#3b8c32';
    ctx.fillRect(3, 5, 8, 4);
    ctx.fillRect(19, 18, 9, 5);

    ctx.fillStyle = '#6ebd30';
    ctx.fillRect(13, 4, 7, 3);
    ctx.fillRect(5, 21, 6, 3);

    // Clústeres de briznas 1px pixel-art
    const blades = [
      [6, 9], [16, 12], [25, 7], [10, 24], [22, 27]
    ];
    for (let i = 0; i < blades.length; i++) {
      const bx = blades[i][0];
      const by = blades[i][1];
      ctx.fillStyle = '#1d5c38';
      ctx.fillRect(bx, by + 1, 3, 1);
      ctx.fillStyle = '#b6e345';
      ctx.fillRect(bx, by - 1, 1, 2);
      ctx.fillRect(bx + 2, by, 1, 1);
    }

    // Pequeñas flores silvestres de 2x2 px
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(26, 14, 2, 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(9, 15, 2, 2);
  }

  /**
   * Dibuja una loseta de sendero de tierra cálida (32x32) en Pixel-Art con coordenadas enteras.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  static _drawDirtTile(ctx, w, h) {
    ctx.fillStyle = '#b77b4b';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#8f523e';
    ctx.fillRect(4, 10, 10, 5);
    ctx.fillRect(18, 22, 9, 5);

    ctx.fillStyle = '#d99e63';
    ctx.fillRect(15, 4, 9, 4);
    ctx.fillRect(4, 22, 7, 4);

    // Guijarros pixel-art con contorno inferior oscuro
    const pebbles = [
      [8, 7, 3], [21, 14, 3], [13, 25, 3], [26, 6, 2]
    ];
    for (let i = 0; i < pebbles.length; i++) {
      const [px, py, pr] = pebbles[i];
      ctx.fillStyle = '#6c3832';
      ctx.fillRect(px, py + 1, pr, 2);
      ctx.fillStyle = '#f3d19c';
      ctx.fillRect(px, py, pr, 1);
    }
  }

  /**
   * Dibuja un árbol frondoso cel-shaded (84x98 px) con 4 bandas de Hue Shifting en copa
   * y tronco agrietado con musgo.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  static _drawTreeSprite(ctx, w, h) {
    const cx = Math.floor(w * 0.5);
    const baseY = h - 6;

    // 1. Tronco y raíces en pixel art puro (enteros sin antialiasing)
    // Contorno exterior del tronco (1px #050811) y acampanado de raíces
    ctx.fillStyle = INK;
    ctx.fillRect(cx - 10, 44, 20, baseY - 44);
    ctx.fillRect(cx - 12, baseY - 12, 24, 11);
    ctx.fillRect(cx - 14, baseY - 6, 28, 6);

    // Relleno base corteza cálida (#7c3f26)
    ctx.fillStyle = '#7c3f26';
    ctx.fillRect(cx - 9, 45, 18, baseY - 46);
    ctx.fillRect(cx - 11, baseY - 11, 22, 10);
    ctx.fillRect(cx - 13, baseY - 5, 26, 4);

    // Sombra bajo copa y lado derecho en ciruela oscuro (#4a1d30)
    ctx.fillStyle = '#4a1d30';
    ctx.fillRect(cx - 9, 45, 18, 8);
    ctx.fillRect(cx + 2, 52, 7, baseY - 53);
    ctx.fillRect(cx + 5, baseY - 11, 6, 10);
    ctx.fillRect(cx + 7, baseY - 5, 6, 4);

    // Vetas verticales y luz izquierda (#b4693e)
    ctx.fillStyle = '#b4693e';
    ctx.fillRect(cx - 7, 55, 3, baseY - 65);
    ctx.fillRect(cx - 2, 58, 2, baseY - 70);
    ctx.fillRect(cx - 10, baseY - 9, 3, 6);

    // Musgo pixelado verde en raíces
    ctx.fillStyle = '#1d5c38';
    ctx.fillRect(cx - 12, baseY - 6, 5, 3);
    ctx.fillRect(cx + 7, baseY - 5, 4, 2);
    ctx.fillStyle = '#6ebd30';
    ctx.fillRect(cx - 11, baseY - 6, 3, 1);

    // 2. Copa de árbol en silueta unificada (sin círculos negros internos)
    ProceduralAssets._drawUnifiedFoliageCluster(
      ctx,
      [
        { cx: cx - 22, cy: 48, rx: 17, ry: 14, crease: true },
        { cx: cx + 22, cy: 48, rx: 17, ry: 14, crease: true },
        { cx: cx, cy: 50, rx: 21, ry: 13 },
        { cx: cx - 17, cy: 34, rx: 18, ry: 15 },
        { cx: cx + 17, cy: 35, rx: 17, ry: 14 },
        { cx: cx - 1, cy: 23, rx: 24, ry: 18, crease: true }
      ],
      {
        outline: INK,
        shadow: '#1d5c38',
        mid: '#6ebd30',
        light: '#b6e345'
      }
    );

    // Puntos de dither / follaje brillante para textura pixel art
    ctx.fillStyle = '#b6e345';
    ctx.fillRect(cx - 16, 20, 3, 2);
    ctx.fillRect(cx - 10, 14, 4, 2);
    ctx.fillRect(cx + 4, 16, 3, 2);
    ctx.fillRect(cx - 22, 34, 3, 2);
    ctx.fillRect(cx + 10, 30, 3, 2);

    ctx.fillStyle = '#d9f99d';
    ctx.fillRect(cx - 11, 13, 2, 1);
    ctx.fillRect(cx - 17, 19, 2, 1);
    ctx.fillRect(cx + 3, 15, 2, 1);

    // Pequeñas flores/frutos luminosos de 2x2
    const blossoms = [
      [cx - 15, 26],
      [cx + 13, 33],
      [cx + 2, 19],
      [cx - 8, 42]
    ];
    for (let i = 0; i < blossoms.length; i++) {
      const bx = blossoms[i][0];
      const by = blossoms[i][1];
      ctx.fillStyle = '#1d5c38';
      ctx.fillRect(bx - 1, by, 4, 3);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(bx, by, 2, 2);
    }
  }

  /**
   * Dibuja una cabaña del Santuario estilo Eastward / Zelda (160x144 px)
   * con tejado de tejas azules-índigo, entramado de madera y farol cálido.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  static _drawHouseSprite(ctx, w, h) {
    // Sombra proyectada índigo
    ctx.fillStyle = 'rgba(20, 24, 58, 0.34)';
    ctx.fillRect(14, h - 18, w - 28, 13);

    // Chimenea trasera con reborde cálido
    ctx.fillStyle = '#475569';
    ctx.fillRect(114, 14, 18, 36);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.strokeRect(114, 14, 18, 36);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(111, 11, 24, 6);
    ctx.strokeRect(111, 11, 24, 6);

    // Zócalo de piedra
    ctx.fillStyle = '#64748b';
    ctx.fillRect(22, h - 34, w - 44, 20);
    ctx.strokeRect(22, h - 34, w - 44, 20);
    ctx.fillStyle = '#334155';
    ctx.fillRect(24, h - 22, w - 48, 6);

    // Fachada crema-marfil cálida con sombra bajo el alero
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(22, 62, w - 44, 50);
    ctx.strokeRect(22, 62, w - 44, 50);
    ctx.fillStyle = '#d6c5a9';
    ctx.fillRect(24, 63, w - 48, 12);

    // Vigas entramadas de madera con sombra ciruela
    ctx.fillStyle = '#78350f';
    ctx.fillRect(22, 62, 10, 50);
    ctx.fillRect(w - 32, 62, 10, 50);
    ctx.fillRect(74, 62, 8, 50);
    ctx.strokeRect(22, 62, 10, 50);
    ctx.strokeRect(w - 32, 62, 10, 50);

    // Tejado inclinado en tejas azul-cerúleo con iluminación y sombra índigo
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.moveTo(8, 68);
    ctx.lineTo(w * 0.5, 18);
    ctx.lineTo(w - 8, 68);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Mitad derecha sombreada índigo
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 20);
    ctx.lineTo(w - 11, 66);
    ctx.lineTo(w * 0.5, 66);
    ctx.closePath();
    ctx.fill();

    // Filas estilizadas de tejas + brillo superior
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(36, 48, 42, 4);
    ctx.fillRect(50, 34, 30, 4);
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(w * 0.5 - 3, 18, 6, 48);

    // Puerta robusta con herrajes dorados
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(42, 80, 26, 48);
    ctx.lineWidth = 2.2;
    ctx.strokeRect(42, 80, 26, 48);
    ctx.fillStyle = '#581c3a';
    ctx.fillRect(45, 84, 20, 4);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(61, 102, 3.5, 3.5);

    // Farol encendido junto a la puerta
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(72, 84, 6, 8);
    ctx.strokeRect(72, 84, 6, 8);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(73.5, 85.5, 3, 5);

    // Ventana acristalada cálida con jardineras
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(96, 78, 28, 22);
    ctx.strokeRect(96, 78, 28, 22);
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(99, 81, 10, 8);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(109, 78, 2.5, 22);
    ctx.fillRect(96, 88, 28, 2.5);
  }

  /**
   * Dibuja un arbusto frondoso (48x44 px) con frutos brillantes y sombra fría.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  static _drawBushSprite(ctx, w, h) {
    const cx = Math.floor(w * 0.5);
    const cy = Math.floor(h * 0.58);

    // Paleta verde lima vibrante con contorno exterior unificado (sin cortes internos)
    ProceduralAssets._drawUnifiedFoliageCluster(
      ctx,
      [
        { cx: cx - 10, cy: cy - 8, rx: 6, ry: 5 },
        { cx: cx + 10, cy: cy - 6, rx: 6, ry: 5 },
        { cx: cx - 1, cy: cy - 11, rx: 9, ry: 7 },
        { cx: cx - 5, cy: cy + 2, rx: 12, ry: 8 },
        { cx: cx + 11, cy: cy + 3, rx: 8, ry: 7, crease: true }
      ],
      {
        outline: INK,
        shadow: '#1d5c38',
        mid: '#6ebd30',
        light: '#b6e345'
      }
    );

    // Recortar la base a línea plana de arbusto asentado en tierra
    const baseY = Math.min(h - 3, cy + 9);
    ctx.clearRect(0, baseY + 1, w, h - baseY);
    ctx.fillStyle = '#1d5c38';
    ctx.fillRect(cx - 15, baseY - 2, 29, 2);
    ctx.fillStyle = INK;
    ctx.fillRect(cx - 15, baseY, 29, 1);

    // Dither de follaje pixel art (2x1 / 1x1) entre luz y sombra
    ctx.fillStyle = '#6ebd30';
    ctx.fillRect(cx - 11, cy + 4, 2, 1);
    ctx.fillRect(cx - 6, cy + 5, 2, 1);
    ctx.fillRect(cx + 3, cy + 4, 2, 1);
    ctx.fillStyle = '#d9f99d';
    ctx.fillRect(cx - 3, cy - 15, 3, 1);

    // Bayas rojas pixel-art con brillo de 1px
    const berries = [
      [cx - 8, cy - 2],
      [cx + 6, cy + 2],
      [cx + 1, cy - 9]
    ];
    for (let i = 0; i < berries.length; i++) {
      const bx = berries[i][0];
      const by = berries[i][1];
      ctx.fillStyle = '#1d5c38';
      ctx.fillRect(bx - 1, by, 4, 3);
      ctx.fillStyle = '#e11d48';
      ctx.fillRect(bx, by, 2, 2);
      ctx.fillStyle = '#fda4af';
      ctx.fillRect(bx, by, 1, 1);
    }
  }
}
