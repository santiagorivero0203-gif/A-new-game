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
  /** @type {Map<string, HTMLCanvasElement>} Caché Flyweight compartida de texturas procedurales */
  static _sharedCanvasCache = new Map();

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
   * Obtiene o construye una única textura Flyweight (`HTMLCanvasElement`) compartida por todas
   * las instancias repetidas del mapa (árboles, casas, arbustos y losetas base), evitando
   * serializar Data URIs o duplicar bitmaps decodificados en RAM.
   * @param {string} key - Clave del asset (`grass_tile`, `dirt_tile`, `tree_sprite`, `house_sprite`, `bush_sprite`).
   * @param {number} [tileSize=32] - Tamaño de referencia para losetas de terreno.
   * @returns {HTMLCanvasElement|null} Lienzo Flyweight único reutilizable.
   */
  static getSharedCanvas(key, tileSize = 32) {
    if (typeof document === 'undefined') return null;

    const isTile = key === 'grass_tile' || key === 'dirt_tile';
    const cacheKey = isTile ? `${key}_${tileSize}` : key;
    const cached = ProceduralAssets._sharedCanvasCache.get(cacheKey);
    if (cached) return cached;

    const defaults = ProceduralAssets.DEFAULT_SIZES[key] || { width: 32, height: 32 };
    const w = isTile ? tileSize : defaults.width;
    const h = isTile ? tileSize : defaults.height;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
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
    }

    ProceduralAssets._sharedCanvasCache.set(cacheKey, canvas);
    return canvas;
  }

  /**
   * Libera texturas procedurales cacheadas no requeridas actualmente para comprimir RAM.
   * @param {Array<string>} [keepKeys=[]]
   */
  static releaseUnused(keepKeys = []) {
    const keep = new Set(keepKeys);
    for (const [k, canvas] of ProceduralAssets._sharedCanvasCache.entries()) {
      if (!keep.has(k)) {
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
        ProceduralAssets._sharedCanvasCache.delete(k);
      }
    }
  }

  /**
   * Genera un asset gráfico en formato Data URI PNG Pixel-Art (compatibilidad heredada).
   * @param {string} key - Clave del asset.
   * @param {number} [tileSize=32] - Tamaño de referencia para losetas de terreno.
   * @returns {string} Data URL (`image/png`).
   */
  static generate(key, tileSize = 32) {
    const canvas = ProceduralAssets.getSharedCanvas(key, tileSize);
    return canvas && typeof canvas.toDataURL === 'function'
      ? canvas.toDataURL('image/png')
      : '';
  }

  /**
   * Dibuja una loseta de hierba base (32x32) concatenable en estricto Pixel-Art con coordenadas enteras.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  static _drawGrassTile(ctx, w, h) {
    // Fondo verde hierba orgánico armonizado con BIOME_PALETTES.cave_exit_intro
    ctx.fillStyle = '#52a549';
    ctx.fillRect(0, 0, w, h);

    // Manchas interiores suaves escalonadas sin marcas en los bordes
    ctx.fillStyle = '#3d8b40';
    ctx.fillRect(10, 12, 5, 2);
    ctx.fillRect(12, 14, 4, 1);
    ctx.fillStyle = '#88d459';
    ctx.fillRect(14, 7, 3, 1);

    // Dos micro-racimos de briznas suaves sin bloques oscuros
    const clusters = [[6, 10], [19, 20]];
    for (let i = 0; i < clusters.length; i++) {
      const lx = clusters[i][0];
      const ly = clusters[i][1];
      ctx.fillStyle = '#3d8b40';
      ctx.fillRect(lx, ly + 1, 4, 1);
      ctx.fillRect(lx + 1, ly + 2, 3, 1);
      ctx.fillStyle = '#88d459';
      ctx.fillRect(lx, ly, 2, 1);
      ctx.fillRect(lx + 3, ly, 2, 1);
    }
  }

  /**
   * Dibuja una loseta de sendero de tierra cálida (32x32) concatenable en Pixel-Art con coordenadas enteras.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  static _drawDirtTile(ctx, w, h) {
    ctx.fillStyle = '#b57c4e';
    ctx.fillRect(0, 0, w, h);

    // Manchas orgánicas suaves interiores sin marcas fijas en los bordes
    ctx.fillStyle = '#7e4938';
    ctx.fillRect(9, 14, 5, 2);
    ctx.fillRect(11, 16, 4, 1);
    ctx.fillRect(20, 7, 4, 2);

    ctx.fillStyle = '#d8a46f';
    ctx.fillRect(16, 12, 4, 1);
    ctx.fillRect(17, 13, 3, 1);

    // Un guijarro facetado discreto y granito
    ctx.fillStyle = '#7e4938';
    ctx.fillRect(8, 9, 3, 2);
    ctx.fillStyle = '#d8a46f';
    ctx.fillRect(8, 8, 2, 1);
    ctx.fillStyle = '#7e4938';
    ctx.fillRect(21, 23, 2, 1);
  }

  /**
   * Dibuja un árbol frondoso cel-shaded (84x98 px) inspirado en pixel-art clásico moderno:
   * copa redonda en bandas curvas de racimos de hojas, base de césped acampanada y seta roja.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  static _drawTreeSprite(ctx, w, h) {
    const cx = Math.floor(w * 0.5);
    const baseY = h - 6;

    // 0. Base de césped/musgo bajo las raíces (anillo escalonado orgánico)
    ctx.fillStyle = '#1e564f';
    ctx.fillRect(cx - 19, baseY - 3, 38, 6);
    ctx.fillRect(cx - 15, baseY - 5, 30, 8);
    ctx.fillStyle = '#3b8c32';
    ctx.fillRect(cx - 17, baseY - 3, 34, 4);
    ctx.fillRect(cx - 13, baseY - 4, 26, 5);
    ctx.fillStyle = '#74c69d';
    ctx.fillRect(cx - 16, baseY - 2, 4, 2);
    ctx.fillRect(cx + 12, baseY - 2, 4, 2);
    ctx.fillStyle = '#95d540';
    ctx.fillRect(cx - 18, baseY - 1, 2, 2);
    ctx.fillRect(cx + 15, baseY, 2, 2);

    // 1. Tronco y raíces acampanadas en pixel art puro
    ctx.fillStyle = INK;
    ctx.fillRect(cx - 10, 44, 20, baseY - 44);
    ctx.fillRect(cx - 13, baseY - 12, 26, 11);
    ctx.fillRect(cx - 16, baseY - 6, 32, 6);

    // Relleno base corteza cálida
    ctx.fillStyle = '#783c26';
    ctx.fillRect(cx - 9, 45, 18, baseY - 46);
    ctx.fillRect(cx - 12, baseY - 11, 24, 10);
    ctx.fillRect(cx - 15, baseY - 5, 30, 4);

    // Sombra bajo copa y lado derecho + surcos profundos
    ctx.fillStyle = '#4a2419';
    ctx.fillRect(cx - 9, 45, 18, 9);
    ctx.fillRect(cx + 2, 53, 7, baseY - 54);
    ctx.fillRect(cx + 5, baseY - 11, 7, 10);
    ctx.fillRect(cx + 8, baseY - 5, 7, 4);
    ctx.fillRect(cx - 4, 57, 2, baseY - 64);

    // Vetas verticales y luz izquierda
    ctx.fillStyle = '#a45a3d';
    ctx.fillRect(cx - 8, 55, 3, baseY - 63);
    ctx.fillRect(cx - 2, 59, 2, baseY - 67);
    ctx.fillRect(cx - 11, baseY - 9, 3, 6);
    ctx.fillStyle = '#c87a4e';
    ctx.fillRect(cx - 8, 56, 1, baseY - 68);
    ctx.fillRect(cx - 13, baseY - 4, 3, 2);

    // Pequeña seta roja con pintas blancas junto a la raíz derecha
    const mx = cx + 9;
    const my = baseY - 7;
    ctx.fillStyle = INK;
    ctx.fillRect(mx - 1, my, 8, 5);
    ctx.fillRect(mx + 1, my + 4, 4, 3);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(mx + 2, my + 4, 2, 2);
    ctx.fillStyle = '#e11d48';
    ctx.fillRect(mx, my + 1, 6, 3);
    ctx.fillStyle = '#fb7185';
    ctx.fillRect(mx + 1, my + 1, 3, 1);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(mx + 1, my + 2, 1, 1);
    ctx.fillRect(mx + 4, my + 1, 1, 1);

    // 2. Copa frondosa unificada con sombra profunda inferior
    ProceduralAssets._drawUnifiedFoliageCluster(
      ctx,
      [
        { cx: cx - 22, cy: 48, rx: 17, ry: 14, crease: true },
        { cx: cx + 22, cy: 48, rx: 17, ry: 14, crease: true },
        { cx: cx, cy: 50, rx: 21, ry: 13 },
        { cx: cx - 17, cy: 34, rx: 18, ry: 15 },
        { cx: cx + 17, cy: 35, rx: 17, ry: 14 },
        { cx: cx, cy: 34, rx: 22, ry: 15 },
        { cx: cx - 1, cy: 23, rx: 24, ry: 18 }
      ],
      {
        outline: INK,
        shadow: '#163829',
        mid: '#3c8d37',
        light: '#69be3b'
      }
    );

    // Bandas internas de racimos foliares dentados (hojas escalonadas sin barras planas)
    const darkLeaves = [
      [cx - 26, 46, -1], [cx - 17, 49, -1], [cx - 6, 51, 1],
      [cx + 6, 49, 1], [cx + 18, 46, 1], [cx - 11, 42, -1],
      [cx + 3, 43, 1]
    ];
    for (let i = 0; i < darkLeaves.length; i++) {
      const [lx, ly, d] = darkLeaves[i];
      ProceduralAssets._drawPixelLeaf(ctx, lx, ly, '#245c36', d);
    }

    // Hojas iluminadas en la corona superior izquierda
    const lightLeaves = [
      [cx - 17, 17, -1], [cx - 8, 12, 1], [cx + 4, 15, 1],
      [cx - 23, 29, -1], [cx - 7, 25, 1], [cx + 9, 28, 1],
      [cx - 14, 33, -1], [cx + 1, 20, 1]
    ];
    for (let i = 0; i < lightLeaves.length; i++) {
      const [lx, ly, d] = lightLeaves[i];
      ProceduralAssets._drawPixelLeaf(ctx, lx, ly, '#94db4f', d);
    }

    // Destellos puntuales verde lima claro en ápices
    ctx.fillStyle = '#b5e48c';
    ctx.fillRect(cx - 16, 17, 2, 1);
    ctx.fillRect(cx - 7, 12, 3, 1);
    ctx.fillRect(cx + 5, 15, 2, 1);
    ctx.fillRect(cx - 6, 25, 2, 1);
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
   * Pinta una pequeña hoja escalonada pixel-art para romper siluetas foliares.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {string} color
   * @param {number} [dir=1] - 1 hacia la derecha, -1 hacia la izquierda
   */
  static _drawPixelLeaf(ctx, x, y, color, dir = 1) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 3, 2);
    ctx.fillRect(x + (dir > 0 ? 2 : -1), y - 1, 2, 1);
  }

  /**
   * Dibuja un arbusto frondoso (48x44 px) con capas orgánicas de hojas en pixel-art,
   * sombra fría verde-azulada y pequeñas flores silvestres blanco-amarillas.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  static _drawBushSprite(ctx, w, h) {
    const cx = Math.floor(w * 0.5);
    const cy = Math.floor(h * 0.58);

    // 1. Hojas periféricas exteriores en sombra fría antes del cluster principal
    const outerDarkLeaves = [
      [cx - 21, cy + 1, -1], [cx - 19, cy - 8, -1], [cx - 12, cy - 16, -1],
      [cx + 15, cy - 12, 1], [cx + 19, cy - 2, 1], [cx + 17, cy + 5, 1]
    ];
    for (let i = 0; i < outerDarkLeaves.length; i++) {
      const [lx, ly, d] = outerDarkLeaves[i];
      ProceduralAssets._drawPixelLeaf(ctx, lx, ly, '#1e564f', d);
    }

    // 2. Silueta unificada de lóbulos foliares (paleta 6 tonos de Referencia 1)
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
        shadow: '#1e564f',
        mid: '#2b9348',
        light: '#55a630'
      }
    );

    // Recortar la base a línea plana de arbusto asentado en tierra
    const baseY = Math.min(h - 3, cy + 9);
    ctx.clearRect(0, baseY + 1, w, h - baseY);
    ctx.fillStyle = '#1e564f';
    ctx.fillRect(cx - 15, baseY - 2, 30, 2);
    ctx.fillStyle = INK;
    ctx.fillRect(cx - 15, baseY, 30, 1);

    // 3. Capas internas de racimos foliares luminosos (verde medio -> lima -> brote claro)
    const midLeaves = [
      [cx - 13, cy - 4, -1], [cx - 6, cy + 3, -1], [cx + 4, cy + 2, 1],
      [cx + 10, cy - 3, 1], [cx - 2, cy - 7, 1]
    ];
    for (let i = 0; i < midLeaves.length; i++) {
      const [lx, ly, d] = midLeaves[i];
      ProceduralAssets._drawPixelLeaf(ctx, lx, ly, '#55a630', d);
    }

    const brightLeaves = [
      [cx - 9, cy - 11, -1], [cx - 2, cy - 13, 1], [cx + 5, cy - 9, 1],
      [cx - 11, cy - 2, -1], [cx + 2, cy - 2, 1]
    ];
    for (let i = 0; i < brightLeaves.length; i++) {
      const [lx, ly, d] = brightLeaves[i];
      ProceduralAssets._drawPixelLeaf(ctx, lx, ly, '#95d540', d);
    }

    ctx.fillStyle = '#b5e48c';
    ctx.fillRect(cx - 4, cy - 15, 3, 1);
    ctx.fillRect(cx - 10, cy - 11, 2, 1);
    ctx.fillRect(cx + 3, cy - 10, 2, 1);

    // 4. Pequeñas flores silvestres de 4 pétalos blancos con botón amarillo (Ref 1)
    const flowers = [
      [cx - 10, cy - 8],
      [cx - 5, cy - 5],
      [cx + 7, cy + 1]
    ];
    for (let i = 0; i < flowers.length; i++) {
      const fx = flowers[i][0];
      const fy = flowers[i][1];
      ctx.fillStyle = '#1e564f';
      ctx.fillRect(fx - 1, fy + 1, 5, 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(fx, fy, 3, 1);
      ctx.fillRect(fx + 1, fy - 1, 1, 3);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(fx + 1, fy, 1, 1);
    }
  }
}
