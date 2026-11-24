/**
 * @module CelSpriteAtlas
 * @description Generador y caché de sprites horneados fuera de pantalla con estética
 * Cel-Shaded Anime / The Minish Cap / Eastward.
 *
 * Técnicas aplicadas:
 * - **Anime Inking**: Contornos limpios `#0b101d` con grosor consistente.
 * - **Hue Shifting (2-3 tonos Cel)**: Sombras desplazadas hacia índigo/púrpura frío
 *   (`#1e1b4b`, `#311042`) y luces hacia ámbar/marfil cálido (`#fef3c7`, `#fde68a`)
 *   en lugar de ensuciar colores con negro o gris puro.
 * - **Zero-Alloc en runtime**: Cada variante se hornea una única vez bajo demanda o en
 *   `prewarm()` y se almacena en `Map<string, HTMLCanvasElement>`.
 *
 * @author Be a Legend Team
 * @version 2.0.0
 */

const INK = '#0b101d';
const COOL_SHADOW_TINT = 'rgba(30, 27, 75, 0.34)';

/**
 * Paletas elementales pre-curadas con Hue Shifting por afinidad.
 * @constant {Record<string, {base: string, dark: string, mid: string, light: string, glow: string}>}
 */
const ELEMENT_PALETTES = {
  plantas: {
    base: '#22c55e',
    dark: '#164e4d',  // Desplazado hacia verde azulado frío
    mid: '#15803d',
    light: '#bef264', // Desplazado hacia lima cálido
    glow: '#86efac'
  },
  fuego: {
    base: '#f97316',
    dark: '#6b1d45',  // Desplazado hacia carmesí violeta frío
    mid: '#c2410c',
    light: '#fde047', // Desplazado hacia amarillo dorado
    glow: '#fb923c'
  },
  kinetic: {
    base: '#06b6d4',
    dark: '#1e296b',  // Desplazado hacia azul cobalto profundo
    mid: '#0e7490',
    light: '#e0f2fe', // Brillo hielo-dorado
    glow: '#67e8f9'
  },
  astral: {
    base: '#a855f7',
    dark: '#2e1065',
    mid: '#7e22ce',
    light: '#f5d0fe',
    glow: '#e879f9'
  },
  normal: {
    base: '#64748b',
    dark: '#1e1b4b',
    mid: '#334155',
    light: '#fde68a',
    glow: '#cbd5e1'
  }
};

export class CelSpriteAtlas {
  /** @type {Map<string, HTMLCanvasElement>} Caché Flyweight global con marca de uso LRU sin mutar Map en hits */
  static _cache = new Map();

  /** @type {Map<string, {status: 'loading'|'loaded'|'error', img: HTMLImageElement, listeners: Function[]}>} Caché de imágenes personalizadas */
  static _customImageCache = new Map();

  /** @type {number} Contador monotónico de uso para desalojo LRU sin delete+set en cada frame */
  static _useClock = 0;

  /** @type {number} Tope de sprites únicos en caché simultáneamente para evitar thrashing y getImageData */
  static MAX_CACHED_SPRITES = 360;

  /**
   * Obtiene un sprite horneado desde caché o ejecuta la función constructora una sola vez.
   * Marca `_lastUse` en O(1) sin reordenar el `Map` en cada draw; desaloja el más antiguo solo al llenar tope.
   * @param {string} key - Clave única de caché.
   * @param {number} width - Ancho del lienzo fuera de pantalla.
   * @param {number} height - Alto del lienzo fuera de pantalla.
   * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} drawFn - Pintor procedural.
   * @returns {HTMLCanvasElement} Lienzo horneado reutilizable.
   */
  static getOrBake(key, width, height, drawFn, skipCrispen = false) {
    const existing = CelSpriteAtlas._cache.get(key);
    if (existing) {
      existing._lastUse = ++CelSpriteAtlas._useClock;
      return existing;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      drawFn(ctx, width, height);
      if (!skipCrispen) {
        CelSpriteAtlas._crispenAndOutline(ctx, width, height);
      }
    }

    canvas._lastUse = ++CelSpriteAtlas._useClock;
    CelSpriteAtlas._cache.set(key, canvas);

    while (CelSpriteAtlas._cache.size > CelSpriteAtlas.MAX_CACHED_SPRITES) {
      let oldestKey = null;
      let oldestTick = Infinity;
      for (const [k, c] of CelSpriteAtlas._cache.entries()) {
        const t = c ? (c._lastUse || 0) : 0;
        if (t < oldestTick) {
          oldestTick = t;
          oldestKey = k;
        }
      }
      if (oldestKey === null) break;
      const oldestCanvas = CelSpriteAtlas._cache.get(oldestKey);
      if (oldestCanvas) {
        oldestCanvas.width = 0;
        oldestCanvas.height = 0;
      }
      CelSpriteAtlas._cache.delete(oldestKey);
    }
    return canvas;
  }

  /**
   * Libera todos los sprites horneados de RAM (útil al cambiar de mundo o regresar al menú).
   */
  static clear() {
    for (const canvas of CelSpriteAtlas._cache.values()) {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
    CelSpriteAtlas._cache.clear();
  }

  /**
   * Cuantiza el canal alfa para eliminar antialiasing en los sprites horneados
   * sin engrosar bordes ni encajonar siluetas completas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   */
  static _crispenAndOutline(ctx, width, height) {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData && imgData.data;
      if (!data || data.length !== width * height * 4) return;

      for (let i = 0; i < data.length; i += 4) {
        data[i + 3] = data[i + 3] >= 96 ? 255 : 0;
      }

      ctx.putImageData(imgData, 0, 0);
    } catch (_e) {
      // Entornos mock o sin soporte de lectura de píxeles
    }
  }

  /**
   * Dibuja un rectángulo pixel-art escalonado con contorno de 1px sin curvas suaves.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r
   * @param {string} fill
   * @param {string} [stroke=INK]
   * @param {number} [lineWidth=1.8]
   */
  static _inkRoundRect(ctx, x, y, w, h, r, fill, stroke = INK, lineWidth = 1.8) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    const iw = Math.max(1, Math.round(w));
    const ih = Math.max(1, Math.round(h));
    const hasStroke = Boolean(stroke && lineWidth > 0);
    const rad = Math.min(Math.round(r), Math.floor(iw * 0.5), Math.floor(ih * 0.5));

    const drawRectRows = (inset, color) => {
      ctx.fillStyle = color;
      for (let row = inset; row < ih - inset; row++) {
        let trim = 0;
        if (rad > 1) {
          const topDist = row;
          const botDist = ih - 1 - row;
          if (topDist === 0 || botDist === 0) trim = Math.min(rad - 1, 2);
          else if (rad >= 3 && (topDist === 1 || botDist === 1)) trim = 1;
        }
        const left = Math.max(trim, inset);
        const rowW = iw - left * 2;
        if (rowW > 0) {
          ctx.fillRect(ix + left, iy + row, rowW, 1);
        }
      }
    };

    if (hasStroke) {
      drawRectRows(0, stroke);
    }
    if (fill) {
      drawRectRows(hasStroke ? 1 : 0, fill);
    }
  }

  /**
   * Dibuja una elipse con relleno y contorno anime limpio.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} rx
   * @param {number} ry
   * @param {string} fill
   * @param {string} [stroke=INK]
   * @param {number} [lineWidth=1.8]
   */
  static _inkEllipse(ctx, cx, cy, rx, ry, fill, stroke = INK, lineWidth = 1.8) {
    const icx = Math.round(cx);
    const icy = Math.round(cy);
    const irx = Math.max(1, Math.round(rx));
    const iry = Math.max(1, Math.round(ry));
    const hasStroke = Boolean(stroke && lineWidth > 0);

    const fillPixelEllipse = (erx, ery, color) => {
      if (erx <= 0 || ery <= 0) return;
      ctx.fillStyle = color;
      const ry2 = ery * ery;
      for (let dy = -ery; dy <= ery; dy++) {
        const span = Math.floor(Math.sqrt(Math.max(0, 1 - (dy * dy) / ry2)) * erx + 0.25);
        if (span >= 0) {
          ctx.fillRect(icx - span, icy + dy, span * 2 + 1, 1);
        }
      }
    };

    if (hasStroke) {
      fillPixelEllipse(irx, iry, stroke);
      if (fill && irx > 1 && iry > 1) {
        fillPixelEllipse(irx - 1, iry - 1, fill);
      }
    } else if (fill) {
      fillPixelEllipse(irx, iry, fill);
    }
  }

  /**
   * Dibuja una chispa/destello pixel-art de cuatro puntas alineada a enteros.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} size
   * @param {string} [color='#fef9c3']
   */
  static _drawSparkle(ctx, cx, cy, size, color = '#fef9c3') {
    const ix = Math.round(cx);
    const iy = Math.round(cy);
    const r = Math.max(2, Math.round(size));
    ctx.fillStyle = color;
    ctx.fillRect(ix - r, iy, r * 2 + 1, 1);
    ctx.fillRect(ix, iy - r, 1, r * 2 + 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ix - 1, iy - 1, 3, 3);
  }

  // =========================================================================
  // SANTI (PROTAGONISTA) — Capa cel-shaded de 3 tonos con Hue Shifting
  // =========================================================================

  /**
   * Genera u obtiene el sprite detallado de Santi (40x44 px).
   * Incluye pantalones oliva, botas reforzadas con hebillas doradas, túnica cobalto
   * con sombras índigo y filos áureos de la Reliquia, pañuelo ondulante, funda de la
   * Espada del Alba cuando `hasSword === true` y el Guantelete Elemental con gema facetada.
   * @param {'down'|'up'|'left'|'right'} [facing='down']
   * @param {number} [stepFrame=0] - Fotograma de caminata (0..3)
   * @param {string} [gauntletGemColor='#fb923c']
   * @param {boolean} [hasSword=true] - Muestra la empuñadura/vaina en la espalda si ya recogió la espada
   * @returns {HTMLCanvasElement}
   */
  static getSantiSprite(facing = 'down', stepFrame = 0, gauntletGemColor = '#fb923c', hasSword = true) {
    const key = `santi_v4_${facing}_${stepFrame}_${gauntletGemColor}_${hasSword ? 1 : 0}`;
    return CelSpriteAtlas.getOrBake(key, 40, 44, (ctx) => {
      const cx = 20;
      const bobY = (stepFrame === 1 || stepFrame === 3) ? -1 : 0;
      const legStep = stepFrame === 1 ? -2 : stepFrame === 3 ? 2 : 0;
      const armSwing = stepFrame === 1 ? 2 : stepFrame === 3 ? -2 : 0;
      const ox = '#0b101d';
      const hairOutline = '#2a120a';
      const hairDark = '#5c2415';
      const hairBase = '#8c3b20';
      const hairLight = '#c86432';
      const hairHighlight = '#f59e0b';

      const by = bobY;

      // 0. Empuñadura trasera de la Espada del Alba cuando Santi mira al frente o de lado
      if (hasSword && facing !== 'up') {
        const hiltX = facing === 'left' ? cx + 4 : cx - 10;
        const hiltY = 10 + by;
        ctx.fillStyle = ox;
        ctx.fillRect(hiltX - 1, hiltY - 1, 6, 9);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(hiltX + 1, hiltY, 2, 2);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(hiltX, hiltY + 2, 4, 2);
        ctx.fillStyle = '#475569';
        ctx.fillRect(hiltX + 1, hiltY + 4, 2, 3);
      }

      // 1. Piernas y botas pixel-art alineadas a grilla entera
      if (facing === 'left' || facing === 'right') {
        const dir = facing === 'right' ? 1 : -1;
        const backX = cx - 3 - legStep;
        const frontX = cx - 3 + legStep;
        // Pierna trasera
        CelSpriteAtlas._inkRoundRect(ctx, backX, 29, 6, 8, 1, '#365314', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, backX + (dir > 0 ? 0 : -1), 35, 7, 5, 1, '#4a1d3a', ox, 1);
        // Pierna delantera
        CelSpriteAtlas._inkRoundRect(ctx, frontX, 29, 6, 8, 1, '#4d7c0f', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, frontX + (dir > 0 ? 0 : -1), 35, 7, 5, 1, '#78350f', ox, 1);
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(frontX + 2 + dir, 36, 2, 1);
      } else {
        const lOffY = stepFrame === 1 ? -1 : 0;
        const rOffY = stepFrame === 3 ? -1 : 0;
        // Pantalones oliva
        CelSpriteAtlas._inkRoundRect(ctx, cx - 7, 29 + lOffY, 6, 8, 1, '#4d7c0f', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 1, 29 + rOffY, 6, 8, 1, '#365314', ox, 1);
        // Botas de aventurero con brillo cálido
        CelSpriteAtlas._inkRoundRect(ctx, cx - 7, 35 + lOffY, 6, 5, 1, '#854d0e', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 1, 35 + rOffY, 6, 5, 1, '#581c3a', ox, 1);
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(cx - 5, 36 + lOffY, 2, 1);
        ctx.fillRect(cx + 3, 36 + rOffY, 2, 1);
      }

      // 2. Cola de bufanda trasera / Capa al viento
      if (facing === 'down') {
        const tailShift = stepFrame === 1 ? -1 : stepFrame === 3 ? 1 : 0;
        CelSpriteAtlas._inkRoundRect(ctx, cx - 11 + tailShift, 18 + by, 5, 10, 1, '#9f1239', ox, 1);
      }

      // 3. Torso: Chaqueta azul cobalto + camisa blanca + cinturón dorado
      const torsoW = (facing === 'left' || facing === 'right') ? 12 : 16;
      const torsoX = cx - Math.floor(torsoW * 0.5);
      CelSpriteAtlas._inkRoundRect(ctx, torsoX, 18 + by, torsoW, 13, 2, '#2563eb', ox, 1);
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(torsoX + 1, 25 + by, torsoW - 2, 4);
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(torsoX + 2, 19 + by, torsoW - 4, 2);

      if (facing === 'down') {
        // Camisa interior blanca y solapa abierta
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(cx - 2, 20 + by, 4, 7);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(cx - 2, 25 + by, 4, 2);
      } else if (facing === 'up') {
        // Mochila/pliegue de chaqueta trasero
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(cx - 5, 20 + by, 10, 8);
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(cx - 4, 21 + by, 3, 5);
        ctx.fillRect(cx + 1, 21 + by, 3, 5);

        // Vaina diagonal y empuñadura rúnica de la Espada del Alba cruzando la espalda
        if (hasSword) {
          ctx.fillStyle = ox;
          ctx.fillRect(cx - 7, 13 + by, 6, 4);
          ctx.fillRect(cx - 4, 17 + by, 10, 12);
          ctx.fillStyle = '#334155';
          for (let s = 0; s < 8; s++) {
            ctx.fillRect(cx - 5 + s, 18 + by + s, 3, 3);
          }
          ctx.fillStyle = '#facc15';
          ctx.fillRect(cx - 6, 15 + by, 5, 2);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(cx - 6, 13 + by, 2, 2);
        }
      }

      // Cinturón de cuero y hebilla dorada de la Reliquia
      ctx.fillStyle = '#581c3a';
      ctx.fillRect(torsoX + 1, 26 + by, torsoW - 2, 3);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(cx - 2, 26 + by, 4, 3);

      // Bufanda carmesí alrededor del cuello
      CelSpriteAtlas._inkRoundRect(ctx, cx - 6, 16 + by, 12, 4, 1, '#e11d48', ox, 1);
      ctx.fillStyle = '#fda4af';
      ctx.fillRect(cx - 4, 17 + by, 6, 1);

      // 4. Brazos y Guantelete Elemental con gema brillante
      if (facing === 'left' || facing === 'right') {
        const isRight = facing === 'right';
        const gx = isRight ? cx - 2 : cx - 5;
        const gy = 19 + by - Math.round(armSwing * 0.5);
        CelSpriteAtlas._inkRoundRect(ctx, gx, gy, 7, 9, 1, '#334155', ox, 1);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(gx + 1, gy + 1, 5, 2);
        ctx.fillStyle = ox;
        ctx.fillRect(gx + 2, gy + 3, 4, 4);
        ctx.fillStyle = gauntletGemColor || '#fb923c';
        ctx.fillRect(gx + 3, gy + 4, 2, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(gx + 3, gy + 4, 1, 1);
      } else if (facing === 'up') {
        // Brazos traseros equilibrados al caminar
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10, 19 + by + armSwing, 4, 8, 1, '#2563eb', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 6, 18 + by - armSwing, 5, 9, 1, '#334155', ox, 1);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(cx + 7, 19 + by - armSwing, 3, 2);
      } else {
        // Brazo izquierdo (mano libre)
        const ly = 19 + by + armSwing;
        CelSpriteAtlas._inkRoundRect(ctx, cx - 11, ly, 4, 8, 1, '#2563eb', ox, 1);
        ctx.fillStyle = '#fed7aa';
        ctx.fillRect(cx - 10, ly + 5, 2, 2);
        // Brazo derecho: Guantelete Relicario metálico con núcleo luminoso
        const gy = 18 + by - armSwing;
        CelSpriteAtlas._inkRoundRect(ctx, cx + 6, gy, 6, 10, 1, '#334155', ox, 1);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(cx + 7, gy + 1, 4, 2);
        ctx.fillStyle = ox;
        ctx.fillRect(cx + 7, gy + 4, 4, 4);
        ctx.fillStyle = gauntletGemColor || '#fb923c';
        ctx.fillRect(cx + 8, gy + 5, 2, 2);
        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(cx + 8, gy + 5, 1, 1);
      }

      // 5. Cabeza y Rostro Anime Pixel-Art
      CelSpriteAtlas._inkRoundRect(ctx, cx - 7, 6 + by, 14, 12, 3, '#fed7aa', ox, 1);
      ctx.fillStyle = '#e2a395';
      ctx.fillRect(cx - 5, 15 + by, 10, 2);

      if (facing === 'down') {
        // Ojos expresivos con iris cian y brillo especular
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(cx - 4, 12 + by, 2, 3);
        ctx.fillRect(cx + 2, 12 + by, 2, 3);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(cx - 4, 14 + by, 2, 1);
        ctx.fillRect(cx + 2, 14 + by, 2, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 4, 12 + by, 1, 1);
        ctx.fillRect(cx + 2, 12 + by, 1, 1);

        // Cabello castaño puntiagudo completo (contorno + masa + mechones + brillo)
        ctx.fillStyle = hairOutline;
        ctx.fillRect(cx - 7, 3 + by, 14, 2);
        ctx.fillRect(cx - 9, 5 + by, 18, 6);
        ctx.fillRect(cx - 9, 10 + by, 3, 4);
        ctx.fillRect(cx + 6, 10 + by, 3, 4);
        ctx.fillStyle = hairBase;
        ctx.fillRect(cx - 6, 4 + by, 12, 2);
        ctx.fillRect(cx - 8, 6 + by, 16, 4);
        ctx.fillRect(cx - 8, 10 + by, 2, 3);
        ctx.fillRect(cx + 6, 10 + by, 2, 3);
        // Sombra y mechones del flequillo
        ctx.fillStyle = hairDark;
        ctx.fillRect(cx - 5, 10 + by, 3, 2);
        ctx.fillRect(cx - 1, 9 + by, 3, 3);
        ctx.fillRect(cx + 3, 10 + by, 3, 2);
        // Brillo cálido superior
        ctx.fillStyle = hairLight;
        ctx.fillRect(cx - 5, 5 + by, 9, 2);
        ctx.fillStyle = hairHighlight;
        ctx.fillRect(cx - 3, 4 + by, 5, 1);

        // Bandana azul cobalto + broche dorado
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(cx - 7, 8 + by, 14, 2);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(cx + 3, 8 + by, 2, 2);
      } else if (facing === 'up') {
        // Parte trasera de cabello completo + cinta de bandana azul
        ctx.fillStyle = hairOutline;
        ctx.fillRect(cx - 7, 3 + by, 14, 14);
        ctx.fillRect(cx - 9, 5 + by, 18, 10);
        ctx.fillStyle = hairDark;
        ctx.fillRect(cx - 8, 6 + by, 16, 9);
        ctx.fillRect(cx - 6, 4 + by, 12, 12);
        ctx.fillStyle = hairBase;
        ctx.fillRect(cx - 6, 4 + by, 12, 7);
        ctx.fillRect(cx - 7, 6 + by, 14, 5);
        ctx.fillStyle = hairLight;
        ctx.fillRect(cx - 4, 5 + by, 8, 2);
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(cx - 7, 10 + by, 14, 2);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(cx - 1, 10 + by, 2, 2);
      } else {
        const dir = facing === 'right' ? 1 : -1;
        // Ojo lateral
        const eyeX = dir > 0 ? cx + 2 : cx - 4;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(eyeX, 12 + by, 2, 3);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(eyeX, 14 + by, 2, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(eyeX, 12 + by, 1, 1);

        // Perfil de cabello con nuca y flequillo puntiagudo
        const backOff = dir > 0 ? -9 : -7;
        ctx.fillStyle = hairOutline;
        ctx.fillRect(cx - 7, 3 + by, 14, 2);
        ctx.fillRect(cx + backOff, 5 + by, 16, 6);
        ctx.fillRect(cx + (dir > 0 ? -9 : 5), 10 + by, 4, 5);
        ctx.fillStyle = hairBase;
        ctx.fillRect(cx - 6, 4 + by, 12, 2);
        ctx.fillRect(cx + backOff + 1, 6 + by, 14, 4);
        ctx.fillRect(cx + (dir > 0 ? -8 : 5), 10 + by, 3, 4);
        // Mechón frontal
        ctx.fillStyle = hairDark;
        ctx.fillRect(cx + (dir > 0 ? 4 : -8), 9 + by, 4, 3);
        ctx.fillStyle = hairLight;
        ctx.fillRect(cx - 4, 5 + by, 8, 2);
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(cx - 7, 8 + by, 14, 2);
      }
    });
  }

  // =========================================================================
  // NPCS ALIADOS Y CIUDADANOS — Animación Multi-Frame + Oficios RPG
  // =========================================================================

  /**
   * Genera u obtiene el sprite animado de un NPC aliado o ciudadano (44x48 px).
   * Soporta roles RPG (`tarak`, `valerio`, `blacksmith`, `alchemist`, `guard`, `villager`),
   * fotogramas de acción/caminata (`0..3`), orientación y parpadeo natural.
   * @param {'tarak'|'valerio'|'blacksmith'|'alchemist'|'guard'|'villager'|string} [variant='tarak']
   * @param {number} [animFrame=0] - Frame de animación (0..3)
   * @param {'down'|'up'|'left'|'right'} [facing='down']
   * @param {string} [biome='cave_exit_intro']
   * @param {boolean} [blink=false]
   * @returns {HTMLCanvasElement}
   */
  static getNPCSprite(variant = 'tarak', animFrame = 0, facing = 'down', biome = 'cave_exit_intro', blink = false) {
    const f = ((Math.floor(animFrame) % 4) + 4) % 4;
    const effBlink = facing === 'up' ? false : Boolean(blink);
    const effBiome = (variant === 'tarak' || variant === 'valerio') ? 'shared' : (biome || 'cave_exit_intro');
    const key = `npc_v3_${variant}_${f}_${facing}_${effBiome}_${effBlink ? 1 : 0}`;
    return CelSpriteAtlas.getOrBake(key, 44, 48, (ctx) => {
      const cx = 22;
      const by = (f === 1 || f === 3) ? -1 : 0;
      const legStep = f === 1 ? -2 : f === 3 ? 2 : 0;
      const armPhase = f === 1 ? -2 : f === 2 ? 2 : f === 3 ? 1 : 0;
      const ox = INK;

      ctx.fillStyle = COOL_SHADOW_TINT;
      ctx.beginPath();
      ctx.ellipse(cx, 43, 10, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Piernas y botas articuladas (animación de marcha/balanceo)
      CelSpriteAtlas._inkRoundRect(ctx, cx - 6, 33 + Math.min(0, legStep), 5, 8, 1, '#334155', ox, 1);
      CelSpriteAtlas._inkRoundRect(ctx, cx + 1, 33 + Math.min(0, -legStep), 5, 8, 1, '#1e293b', ox, 1);
      CelSpriteAtlas._inkRoundRect(ctx, cx - 7, 38 + Math.min(0, legStep), 6, 4, 1, '#581c3a', ox, 1);
      CelSpriteAtlas._inkRoundRect(ctx, cx + 1, 38 + Math.min(0, -legStep), 6, 4, 1, '#451a03', ox, 1);

      const drawFaceEyes = (eyeY = 14 + by, irisColor = '#1e293b') => {
        const shiftX = facing === 'left' ? -2 : facing === 'right' ? 2 : 0;
        if (facing === 'up') return;
        if (effBlink) {
          ctx.fillStyle = ox;
          ctx.fillRect(cx - 4 + shiftX, eyeY + 1, 3, 1);
          ctx.fillRect(cx + 1 + shiftX, eyeY + 1, 3, 1);
          return;
        }
        ctx.fillStyle = ox;
        ctx.fillRect(cx - 4 + shiftX, eyeY, 2, 3);
        ctx.fillRect(cx + 2 + shiftX, eyeY, 2, 3);
        ctx.fillStyle = irisColor;
        ctx.fillRect(cx - 4 + shiftX, eyeY + 2, 2, 1);
        ctx.fillRect(cx + 2 + shiftX, eyeY + 2, 2, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 4 + shiftX, eyeY, 1, 1);
        ctx.fillRect(cx + 2 + shiftX, eyeY, 1, 1);
      };

      if (variant === 'blacksmith') {
        // Maestro Herrero con peto de cuero, guantes de forja y martillo animado
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10, 19 + by, 20, 16, 3, '#7c2d12', ox, 1);
        ctx.fillStyle = '#451a03';
        ctx.fillRect(cx - 8, 28 + by, 16, 6);
        // Delantal de cuero curtido + hebilla de bronce
        CelSpriteAtlas._inkRoundRect(ctx, cx - 6, 20 + by, 12, 15, 2, '#b45309', ox, 1);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(cx - 2, 22 + by, 4, 3);
        // Brazo y martillo pesado subiendo/bajando con f
        const hammerY = f === 0 ? 12 : f === 1 ? 10 : f === 2 ? 22 : 16;
        CelSpriteAtlas._inkRoundRect(ctx, cx + 8, 20 + by, 5, 9, 1, '#fed7aa', ox, 1);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(cx + 10, hammerY + by, 2, 12);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 7, hammerY - 2 + by, 8, 5, 1, '#64748b', ox, 1);
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(cx + 8, hammerY - 1 + by, 5, 2);
        // Cabeza + banda de sudor + barba espesa
        CelSpriteAtlas._inkRoundRect(ctx, cx - 7, 8 + by, 14, 12, 4, '#fdba74', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 6, 16 + by, 12, 5, 2, '#57534e', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 8, 6 + by, 16, 4, 1, '#991b1b', ox, 1);
        drawFaceEyes(13 + by, '#f59e0b');
      } else if (variant === 'alchemist') {
        // Mago/Alquimista con túnica mística, frascos brillantes y cayado con matraz
        const robeCol = biome === 'ash_caldera' ? '#7c2d12' : biome === 'astral_citadel' ? '#4338ca' : '#0f766e';
        const trimCol = biome === 'ash_caldera' ? '#fb923c' : biome === 'astral_citadel' ? '#e879f9' : '#5eead4';
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 19 + by, 18, 17, 4, robeCol, ox, 1);
        ctx.fillStyle = trimCol;
        ctx.fillRect(cx - 2, 20 + by, 4, 15);
        // Frascos luminosos en el cinturón
        CelSpriteAtlas._inkRoundRect(ctx, cx - 8, 28 + by, 4, 5, 1, '#4ade80', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 4, 28 + by, 4, 5, 1, '#a855f7', ox, 1);
        // Bastón con ampolla flotante que oscila
        const flaskOff = f === 1 ? -2 : f === 3 ? 2 : 0;
        ctx.fillStyle = '#78350f';
        ctx.fillRect(cx - 12, 12 + by, 3, 25);
        CelSpriteAtlas._inkEllipse(ctx, cx - 11, 10 + by + flaskOff, 4, 4, trimCol, ox, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 12, 9 + by + flaskOff, 2, 2);
        // Cabeza + capucha puntiaguda
        CelSpriteAtlas._inkRoundRect(ctx, cx - 7, 8 + by, 14, 11, 4, '#fed7aa', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 4 + by, 18, 6, 3, robeCol, ox, 1);
        ctx.fillStyle = trimCol;
        ctx.fillRect(cx - 6, 5 + by, 12, 2);
        drawFaceEyes(13 + by, trimCol);
      } else if (variant === 'guard') {
        // Guardia de ciudadela/aldea con yelmo, escudo lateral y alabarda
        const armorCol = biome === 'ash_caldera' ? '#44403c' : biome === 'astral_citadel' ? '#312e81' : '#475569';
        const crestCol = biome === 'ash_caldera' ? '#f97316' : biome === 'astral_citadel' ? '#facc15' : biome === 'marsh_of_spores' ? '#2dd4bf' : '#16a34a';
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 19 + by, 18, 16, 3, armorCol, ox, 1);
        ctx.fillStyle = crestCol;
        ctx.fillRect(cx - 6, 22 + by, 12, 3);
        // Escudo en brazo izquierdo + lanza en derecho
        CelSpriteAtlas._inkRoundRect(ctx, cx - 13, 20 + by + Math.round(armPhase * 0.5), 6, 12, 2, '#92400e', ox, 1);
        ctx.fillStyle = crestCol;
        ctx.fillRect(cx - 11, 24 + by + Math.round(armPhase * 0.5), 2, 4);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(cx + 10, 6 + by - Math.round(armPhase * 0.5), 2, 32);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(cx + 9, 2 + by - Math.round(armPhase * 0.5), 4, 6);
        // Yelmo con penacho
        CelSpriteAtlas._inkRoundRect(ctx, cx - 7, 7 + by, 14, 12, 3, '#64748b', ox, 1);
        ctx.fillStyle = crestCol;
        ctx.fillRect(cx - 2, 3 + by, 4, 5);
        ctx.fillStyle = '#090919';
        ctx.fillRect(cx - 5, 13 + by, 10, 3);
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(cx - 4, 14 + by, 2, 1);
        ctx.fillRect(cx + 2, 14 + by, 2, 1);
      } else if (variant === 'villager') {
        // Aldeano/habitante adaptado cromáticamente a cada bioma
        const tunic = biome === 'marsh_of_spores' ? '#0d9488' : biome === 'ash_caldera' ? '#9a3412' : biome === 'astral_citadel' ? '#4f46e5' : '#65a30d';
        const sash = biome === 'astral_citadel' ? '#fde047' : '#d97706';
        CelSpriteAtlas._inkRoundRect(ctx, cx - 8, 20 + by, 16, 15, 3, tunic, ox, 1);
        ctx.fillStyle = sash;
        ctx.fillRect(cx - 7, 27 + by, 14, 3);
        // Brazos balanceándose
        CelSpriteAtlas._inkRoundRect(ctx, cx - 11, 21 + by + armPhase, 4, 8, 1, tunic, ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 7, 21 + by - armPhase, 4, 8, 1, tunic, ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 7, 8 + by, 14, 12, 4, '#fed7aa', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 8, 5 + by, 16, 5, 2, '#78350f', ox, 1);
        drawFaceEyes(13 + by, '#1e293b');
      } else if (variant === 'tarak') {
        // Mochila de cuero con pergamino enrollado
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10.5, 18 + by, 7, 13.5, 2.5, '#7c2d12', ox, 1.75);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 11, 15.5 + by, 6.5, 3.2, 1.4, '#fef3c7', ox, 1.4);
        // Gabán verde bosque
        CelSpriteAtlas._inkRoundRect(ctx, cx - 8, 20 + by, 16, 15.5, 3.5, '#15803d', ox, 1.9);
        ctx.fillStyle = '#0f3d44';
        ctx.fillRect(cx - 6.5, 28 + by, 13, 6);
        // Bufanda dorada con ligero ondeo según frame
        CelSpriteAtlas._inkRoundRect(ctx, cx - 6.5, 18.5 + by, 13, 5.2, 2, '#f59e0b', ox, 1.6);
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(cx - 4.5 + (f === 2 ? 1 : 0), 19.4 + by, 8, 1.4);
        // Cabeza + ojos
        CelSpriteAtlas._inkRoundRect(ctx, cx - 7.5, 8 + by, 15, 12, 5, '#fed7aa', ox, 1.8);
        ctx.fillStyle = '#e2a395';
        ctx.fillRect(cx - 6, 16.8 + by, 12, 2);
        drawFaceEyes(13 + by, '#0f172a');
        // Boina de explorador + pluma oscilante
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 5 + by, 18, 5.5, 2.5, '#166534', ox, 1.8);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(cx - 6.5, 5.9 + by, 11, 1.5);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 5.5, 3.2 + by + (f === 1 ? -1 : 0), 5, 2.2, 1, '#fbbf24', ox, 1.2);
      } else {
        // Aliado de rescate / Viajero (Valerio, Lira, Borin, Aurelia)
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10, 19 + by, 20, 17, 4, '#312e81', ox, 1.9);
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(cx - 8.5, 29 + by, 17, 6);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(cx - 1.5, 20.5 + by, 3, 14);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 8, 18.5 + by, 16, 12.5, 3.2, '#e2e8f0', ox, 1.8);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(cx - 6.5, 25.5 + by, 13, 4);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 7.5, 8 + by, 15, 12, 4.8, '#fed7aa', ox, 1.8);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(cx - 5, 11.6 + by, 3.8, 1.8);
        ctx.fillRect(cx + 1.2, 11.6 + by, 3.8, 1.8);
        drawFaceEyes(13.4 + by, '#1e293b');
        CelSpriteAtlas._inkRoundRect(ctx, cx - 8.5, 4.5 + by, 17, 5.5, 2.5, '#475569', ox, 1.8);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(cx - 6.5, 5.4 + by, 12, 1.4);
        const orbFloat = f === 1 ? -1 : f === 3 ? 1 : 0;
        CelSpriteAtlas._inkRoundRect(ctx, cx + 9, 7 + by + orbFloat, 6, 7.5, 2, '#fbbf24', ox, 1.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx + 10.6, 8.6 + by + orbFloat, 2.2, 2.6);
      }
    });
  }

  // =========================================================================
  // ENEMIGOS, ARQUETIPOS REGIONALES Y MINI-JEFES — Sprites Multi-Frame
  // =========================================================================

  /**
   * Genera u obtiene el sprite detallado animado de un enemigo (44x44), mini-jefe (50x50)
   * o jefe regional (56x56). Soporta 3 fotogramas de locomoción/acción (`animFrame: 0..2`).
   * @param {string} [archetype='hound']
   * @param {string} [element='plantas']
   * @param {boolean} [isHurt=false]
   * @param {number} [animFrame=0]
   * @returns {HTMLCanvasElement}
   */
  static getEnemySprite(archetype = 'hound', element = 'plantas', isHurt = false, animFrame = 0) {
    const isBoss = typeof archetype === 'string' && archetype.startsWith('boss_');
    const isMiniBoss = typeof archetype === 'string' && archetype.startsWith('miniboss_');
    const spriteSize = isBoss ? 56 : isMiniBoss ? 50 : 44;
    const f = ((Math.floor(animFrame) % 3) + 3) % 3;
    const key = `enemy_v5_${archetype}_${element}_${isHurt ? 1 : 0}_${f}`;
    return CelSpriteAtlas.getOrBake(key, spriteSize, spriteSize, (ctx) => {
      const cx = Math.floor(spriteSize / 2);
      const ox = INK;
      const pal = ELEMENT_PALETTES[element] || ELEMENT_PALETTES.plantas;
      const fillBase = isHurt ? '#ffffff' : pal.base;
      const fillDark = isHurt ? '#fef08a' : pal.dark;
      const fillLight = isHurt ? '#ffffff' : pal.light;
      const stepL = f === 1 ? -2 : f === 2 ? 2 : 0;
      const stepR = -stepL;
      const bob = f === 1 ? -1 : f === 2 ? 1 : 0;

      if (archetype === 'hound') {
        ctx.fillStyle = ox;
        ctx.fillRect(cx - 17, 13 + bob, 5, 4);
        ctx.fillRect(cx - 15, 17 + bob, 4, 8);
        ctx.fillRect(cx - 12, 22 + bob, 4, 4);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - 16, 14 + bob, 3, 2);
        ctx.fillRect(cx - 14, 16 + bob, 2, 7);
        ctx.fillStyle = fillLight;
        ctx.fillRect(cx - 16, 14 + bob, 1, 2);

        CelSpriteAtlas._inkRoundRect(ctx, cx - 10 + stepL, 30, 5, 9, 1, fillDark, ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 5 + stepR, 30, 5, 9, 1, fillDark, ox, 1);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(cx - 9 + stepL, 37, 1, 1);
        ctx.fillRect(cx + 6 + stepR, 37, 1, 1);

        CelSpriteAtlas._inkEllipse(ctx, cx, 26 + bob, 12, 8, fillBase, ox, 1);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - 9, 29 + bob, 18, 3);
        ctx.fillStyle = fillLight;
        ctx.fillRect(cx - 7, 21 + bob, 14, 2);

        for (let i = -1; i <= 1; i++) {
          const sx = cx + i * 5;
          ctx.fillStyle = ox;
          ctx.fillRect(sx - 2, 16 + bob, 5, 4);
          ctx.fillRect(sx - 1, 14 + bob, 3, 2);
          ctx.fillStyle = fillLight;
          ctx.fillRect(sx - 1, 15 + bob, 3, 3);
        }

        ctx.fillStyle = ox;
        ctx.fillRect(cx - 11, 5 + bob, 5, 7);
        ctx.fillRect(cx + 6, 5 + bob, 5, 7);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - 10, 5 + bob, 3, 6);
        ctx.fillRect(cx + 7, 5 + bob, 3, 6);

        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 10 + bob, 18, 13, 3, fillBase, ox, 1);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - 7, 19 + bob, 14, 3);
        ctx.fillStyle = isHurt ? '#f97316' : '#fef08a';
        ctx.fillRect(cx - 6, 13 + bob, 3, 2);
        ctx.fillRect(cx + 3, 13 + bob, 3, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 4, 20 + bob, 2, 2);
        ctx.fillRect(cx + 2, 20 + bob, 2, 2);
      } else if (archetype === 'artillery') {
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 30 + Math.min(0, stepL), 6, 9, 1, fillDark, ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 3, 30 + Math.min(0, stepR), 6, 9, 1, fillDark, ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx, 27 + bob, 10, 8, fillBase, ox, 1);
        const capColor = isHurt ? '#ffffff' : (element === 'fuego' ? '#fb7185' : element === 'kinetic' ? '#6366f1' : '#9333ea');
        const capDark = isHurt ? '#fef08a' : (element === 'fuego' ? '#9f1239' : element === 'kinetic' ? '#312e81' : '#3b0764');
        CelSpriteAtlas._inkEllipse(ctx, cx, 13 + bob, 15 + (f === 1 ? 1 : 0), 9, capColor, ox, 1);
        ctx.fillStyle = capDark;
        ctx.fillRect(cx - 12, 17 + bob, 24, 3);
        ctx.fillStyle = fillLight;
        ctx.fillRect(cx - 10, 9 + bob, 4, 3);
        ctx.fillRect(cx + 5, 8 + bob, 4, 3);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(cx - 5, 23 + bob, 2, 2);
        ctx.fillRect(cx + 3, 23 + bob, 2, 2);
        CelSpriteAtlas._inkEllipse(ctx, cx, 29 + bob, 3, 3, '#0b101d', fillLight, 1);
      } else if (archetype === 'tank') {
        const steelMid = isHurt ? '#ffffff' : '#475569';
        const steelDark = isHurt ? '#fef08a' : '#1e293b';
        const steelLight = isHurt ? '#ffffff' : '#94a3b8';

        CelSpriteAtlas._inkRoundRect(ctx, cx - 10, 34 + Math.min(0, stepL), 7, 7, 1, steelDark, ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 3, 34 + Math.min(0, stepR), 7, 7, 1, steelDark, ox, 1);

        const maceOff = f === 1 ? -2 : f === 2 ? 2 : 0;
        CelSpriteAtlas._inkRoundRect(ctx, cx + 11, 20 + maceOff, 4, 14, 1, '#78350f', ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx + 14, 18 + maceOff, 5, 5, steelMid, ox, 1);

        CelSpriteAtlas._inkRoundRect(ctx, cx - 11, 16 + bob, 22, 19, 4, steelMid, ox, 1);
        ctx.fillStyle = steelDark;
        ctx.fillRect(cx - 9, 28 + bob, 18, 6);
        ctx.fillStyle = steelLight;
        ctx.fillRect(cx - 8, 18 + bob, 16, 2);
        ctx.fillStyle = isHurt ? '#ffffff' : '#eab308';
        ctx.fillRect(cx - 10, 27 + bob, 20, 2);
        CelSpriteAtlas._inkEllipse(ctx, cx + 1, 22 + bob, 3, 3, fillBase, ox, 1);

        CelSpriteAtlas._inkRoundRect(ctx, cx - 14, 15 + bob, 7, 9, 2, fillBase, ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 7, 15 + bob, 7, 9, 2, fillDark, ox, 1);

        CelSpriteAtlas._inkEllipse(ctx, cx, 10 + bob, 9, 7, steelDark, ox, 1);
        ctx.fillStyle = ox;
        ctx.fillRect(cx - 12, 5 + bob, 3, 5);
        ctx.fillRect(cx + 9, 5 + bob, 3, 5);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(cx - 11, 6 + bob, 2, 3);
        ctx.fillRect(cx + 9, 6 + bob, 2, 3);
        ctx.fillStyle = '#090919';
        ctx.fillRect(cx - 6, 10 + bob, 12, 3);
        ctx.fillStyle = isHurt ? '#f97316' : pal.glow;
        ctx.fillRect(cx - 5, 11 + bob, 3, 2);
        ctx.fillRect(cx + 2, 11 + bob, 3, 2);
      } else if (archetype === 'duelist') {
        CelSpriteAtlas._inkRoundRect(ctx, cx - 11, 17 + bob, 22, 17, 3, isHurt ? '#ffffff' : '#1e1b4b', ox, 1);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - 9, 29 + bob, 18, 4);
        ctx.fillStyle = isHurt ? '#fef08a' : '#4338ca';
        ctx.fillRect(cx - 4, 18 + bob, 8, 14);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10, 15 + bob, 20, 5, 2, fillDark, ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx, 11 + bob, 8, 7, isHurt ? '#ffffff' : '#1e1b4b', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 6, 8 + bob, 12, 10, 3, isHurt ? '#ffffff' : '#f8fafc', ox, 1);
        ctx.fillStyle = isHurt ? '#f97316' : pal.glow;
        ctx.fillRect(cx - 4, 11 + bob, 3, 2);
        ctx.fillRect(cx + 1, 11 + bob, 3, 2);
        const bladeCol = isHurt ? '#ffffff' : '#e2e8f0';
        const dOff = f === 1 ? -2 : f === 2 ? 2 : 0;
        for (let d = 0; d < 7; d++) {
          ctx.fillStyle = ox;
          ctx.fillRect(cx + 9 + d, 25 + dOff - d, 3, 3);
          ctx.fillRect(cx - 12 - d, 26 - dOff - d, 3, 3);
          ctx.fillStyle = bladeCol;
          ctx.fillRect(cx + 10 + d, 25 + dOff - d, 2, 2);
          ctx.fillRect(cx - 11 - d, 26 - dOff - d, 2, 2);
        }
      } else if (archetype === 'sentinel_ether') {
        const hover = f === 1 ? -2 : f === 2 ? 2 : 0;
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10, 12 + hover, 20, 22, 5, isHurt ? '#ffffff' : '#312e81', ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx, 10 + hover, 7, 5, isHurt ? '#ffffff' : '#4338ca', ox, 1);
        ctx.fillStyle = isHurt ? '#f97316' : '#38bdf8';
        ctx.fillRect(cx - 4, 9 + hover, 8, 3);
        CelSpriteAtlas._inkEllipse(ctx, cx, 21 + hover, 5, 5, isHurt ? '#ffffff' : '#c084fc', ox, 1);
        ctx.fillStyle = '#f5d0fe';
        ctx.fillRect(cx - 2, 19 + hover, 4, 4);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 16, 14 - hover, 5, 11, 2, fillBase, ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 11, 14 - hover, 5, 11, 2, fillBase, ox, 1);
      } else if (archetype === 'stalker_ambusher') {
        // Acechador de Ramas / Pantano agazapado con manto vegetal y zarpas dobles
        CelSpriteAtlas._inkRoundRect(ctx, cx - 11 + stepL, 30, 5, 8, 1, '#14532d', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 5 + stepR, 30, 5, 8, 1, '#14532d', ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx, 23 + bob, 12, 9, isHurt ? '#ffffff' : '#166534', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 10 + bob, 18, 12, 4, isHurt ? '#ffffff' : '#15803d', ox, 1);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(cx - 5, 14 + bob, 3, 2);
        ctx.fillRect(cx + 2, 14 + bob, 3, 2);
        ctx.fillStyle = '#bef264';
        ctx.fillRect(cx - 14, 22 + bob + stepL, 5, 3);
        ctx.fillRect(cx + 9, 22 + bob + stepR, 5, 3);
      } else if (archetype === 'spore_alchemist') {
        // Alquimista de Esporas con capucha violeta y incensario tóxico
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 18 + bob, 18, 18, 4, isHurt ? '#ffffff' : '#115e59', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 8, 7 + bob, 16, 12, 4, isHurt ? '#ffffff' : '#6b21a8', ox, 1);
        ctx.fillStyle = '#5eead4';
        ctx.fillRect(cx - 4, 13 + bob, 3, 2);
        ctx.fillRect(cx + 1, 13 + bob, 3, 2);
        CelSpriteAtlas._inkEllipse(ctx, cx + 13, 22 - bob, 5, 5, '#a855f7', ox, 1);
        ctx.fillStyle = '#5eead4';
        ctx.fillRect(cx + 12, 21 - bob, 2, 2);
      } else if (archetype === 'pyro_smith') {
        // Herrero Piroclástico con máscara de bronce y tenazas incandescentes
        CelSpriteAtlas._inkRoundRect(ctx, cx - 12, 16 + bob, 24, 21, 4, isHurt ? '#ffffff' : '#292524', ox, 1);
        ctx.fillStyle = '#b45309';
        ctx.fillRect(cx - 8, 22 + bob, 16, 12);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 8, 7 + bob, 16, 11, 3, isHurt ? '#ffffff' : '#9a3412', ox, 1);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(cx - 5, 11 + bob, 4, 2);
        ctx.fillRect(cx + 1, 11 + bob, 4, 2);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 11, 18 + stepL, 6, 14, 2, '#ea580c', ox, 1);
      } else if (archetype === 'void_blinker') {
        // Acechador del Vacío flotante con guja astral
        const hv = f === 1 ? -2 : f === 2 ? 2 : 0;
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 14 + hv, 18, 20, 4, isHurt ? '#ffffff' : '#1e1b4b', ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx, 10 + hv, 7, 6, isHurt ? '#ffffff' : '#4c1d95', ox, 1);
        ctx.fillStyle = '#e879f9';
        ctx.fillRect(cx - 4, 9 + hv, 8, 3);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(cx + 10, 12 + hv, 3, 18);
        ctx.fillRect(cx - 13, 12 - hv, 3, 18);
      } else if (archetype === 'miniboss_stag') {
        // Mini-Jefe M1: Acechador Cornamenta (50x50)
        CelSpriteAtlas._inkRoundRect(ctx, cx - 12 + stepL, 35, 7, 10, 2, '#451a03', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 5 + stepR, 35, 7, 10, 2, '#451a03', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 14, 17 + bob, 28, 21, 5, isHurt ? '#ffffff' : '#14532d', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 10 + bob, 18, 12, 4, isHurt ? '#ffffff' : '#78350f', ox, 1);
        // Gran cornamenta rúnica
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(cx - 15, 3 + bob, 5, 9);
        ctx.fillRect(cx + 10, 3 + bob, 5, 9);
        ctx.fillRect(cx - 18, 5 + bob, 4, 4);
        ctx.fillRect(cx + 14, 5 + bob, 4, 4);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(cx - 5, 14 + bob, 3, 2);
        ctx.fillRect(cx + 2, 14 + bob, 3, 2);
        CelSpriteAtlas._inkEllipse(ctx, cx, 27 + bob, 5, 5, '#fb923c', ox, 1);
      } else if (archetype === 'miniboss_weaver') {
        // Mini-Jefe M2: Tejedora Micótica (50x50)
        const legOff = f === 1 ? -2 : 2;
        ctx.fillStyle = ox;
        for (let l = -1; l <= 1; l++) {
          ctx.fillRect(cx - 20, 22 + l * 6 + legOff, 8, 3);
          ctx.fillRect(cx + 12, 22 + l * 6 - legOff, 8, 3);
        }
        CelSpriteAtlas._inkEllipse(ctx, cx, 28 + bob, 14, 11, isHurt ? '#ffffff' : '#6b21a8', ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx, 17 + bob, 11, 8, isHurt ? '#ffffff' : '#0f766e', ox, 1);
        ctx.fillStyle = '#5eead4';
        ctx.fillRect(cx - 6, 15 + bob, 4, 3);
        ctx.fillRect(cx + 2, 15 + bob, 4, 3);
        ctx.fillRect(cx - 2, 12 + bob, 4, 2);
      } else if (archetype === 'miniboss_warden') {
        // Mini-Jefe M3: Alcaide de Escoria (50x50)
        CelSpriteAtlas._inkRoundRect(ctx, cx - 13 + stepL, 35, 8, 11, 2, '#1c1917', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 5 + stepR, 35, 8, 11, 2, '#1c1917', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 15, 15 + bob, 30, 23, 5, isHurt ? '#ffffff' : '#44403c', ox, 1);
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(cx - 11, 23 + bob, 22, 3);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 7 + bob, 18, 11, 3, isHurt ? '#ffffff' : '#292524', ox, 1);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(cx - 5, 11 + bob, 4, 2);
        ctx.fillRect(cx + 1, 11 + bob, 4, 2);
      } else if (archetype === 'miniboss_reaver') {
        // Mini-Jefe M4: Segador del Vacío (50x50)
        const hv = f === 1 ? -2 : f === 2 ? 2 : 0;
        CelSpriteAtlas._inkRoundRect(ctx, cx - 14, 14 + hv, 28, 25, 5, isHurt ? '#ffffff' : '#2e1065', ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx, 10 + hv, 9, 7, isHurt ? '#ffffff' : '#0f172a', ox, 1);
        ctx.fillStyle = '#e879f9';
        ctx.fillRect(cx - 5, 9 + hv, 4, 2);
        ctx.fillRect(cx + 1, 9 + hv, 4, 2);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(cx - 18, 10 + hv, 4, 22);
        ctx.fillRect(cx + 14, 10 - hv, 4, 22);
      } else if (archetype === 'boss_bramble') {
        CelSpriteAtlas._inkRoundRect(ctx, cx - 14 + stepL, 38, 10, 13, 2, '#3f2e1d', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 4 + stepR, 38, 10, 13, 2, '#3f2e1d', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 16, 16 + bob, 32, 26, 5, isHurt ? '#ffffff' : '#14532d', ox, 1);
        ctx.fillStyle = isHurt ? '#fef08a' : '#15803d';
        ctx.fillRect(cx - 13, 18 + bob, 26, 8);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10, 8 + bob, 20, 13, 4, isHurt ? '#ffffff' : '#78350f', ox, 1);
        ctx.fillStyle = ox;
        ctx.fillRect(cx - 15, 4 + bob, 5, 8);
        ctx.fillRect(cx + 10, 4 + bob, 5, 8);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(cx - 14, 5 + bob, 3, 6);
        ctx.fillRect(cx + 11, 5 + bob, 3, 6);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(cx - 6, 13 + bob, 4, 3);
        ctx.fillRect(cx + 2, 13 + bob, 4, 3);
        CelSpriteAtlas._inkEllipse(ctx, cx, 29 + bob, 6, 6, isHurt ? '#ffffff' : '#fb923c', ox, 1);
      } else if (archetype === 'boss_spore') {
        CelSpriteAtlas._inkRoundRect(ctx, cx - 12 + stepL, 34, 9, 16, 2, '#312e81', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 3 + stepR, 34, 9, 16, 2, '#312e81', ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx, 32 + bob, 15, 11, isHurt ? '#ffffff' : '#0f766e', ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx, 16 + bob, 22 + (f === 1 ? 1 : 0), 12, isHurt ? '#ffffff' : '#7e22ce', ox, 1);
        ctx.fillStyle = '#3b0764';
        ctx.fillRect(cx - 18, 21 + bob, 36, 4);
        ctx.fillStyle = '#5eead4';
        ctx.fillRect(cx - 13, 10 + bob, 5, 4);
        ctx.fillRect(cx + 7, 11 + bob, 6, 4);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(cx - 7, 29 + bob, 4, 3);
        ctx.fillRect(cx + 3, 29 + bob, 4, 3);
      } else if (archetype === 'boss_forge') {
        CelSpriteAtlas._inkRoundRect(ctx, cx - 15 + stepL, 38, 11, 14, 2, '#1e293b', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 4 + stepR, 38, 11, 14, 2, '#1e293b', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 18, 14 + bob, 36, 28, 5, isHurt ? '#ffffff' : '#334155', ox, 1);
        ctx.fillStyle = isHurt ? '#fef08a' : '#ea580c';
        ctx.fillRect(cx - 14, 24 + bob, 28, 3);
        CelSpriteAtlas._inkEllipse(ctx, cx, 28 + bob, 6, 6, '#f97316', ox, 1);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(cx - 2, 26 + bob, 4, 4);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10, 5 + bob, 20, 12, 3, isHurt ? '#ffffff' : '#1e293b', ox, 1);
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(cx - 6, 10 + bob, 4, 3);
        ctx.fillRect(cx + 2, 10 + bob, 4, 3);
      } else if (archetype === 'boss_astral') {
        const hv = f === 1 ? -2 : f === 2 ? 1 : 0;
        CelSpriteAtlas._inkRoundRect(ctx, cx - 16, 17 + hv, 32, 32, 6, isHurt ? '#ffffff' : '#1e1b4b', ox, 1);
        ctx.fillStyle = isHurt ? '#fef08a' : '#4338ca';
        ctx.fillRect(cx - 10, 19 + hv, 20, 26);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 12, 16 + hv, 24, 18, 4, isHurt ? '#ffffff' : '#312e81', ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx, 11 + hv, 10, 7, isHurt ? '#ffffff' : '#0f172a', ox, 1);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(cx - 7, 3 + hv, 3, 5);
        ctx.fillRect(cx - 1, 1 + hv, 2, 6);
        ctx.fillRect(cx + 4, 3 + hv, 3, 5);
        ctx.fillStyle = '#e879f9';
        ctx.fillRect(cx - 6, 10 + hv, 5, 3);
        ctx.fillRect(cx + 1, 10 + hv, 5, 3);
        CelSpriteAtlas._inkEllipse(ctx, cx, 24 + hv, 5, 5, '#c084fc', ox, 1);
      } else {
        // Slime Elemental gelatinoso con compresión real por frame
        const rx = f === 1 ? 14 : f === 2 ? 11 : 13;
        const ry = f === 1 ? 9 : f === 2 ? 12 : 11;
        CelSpriteAtlas._inkEllipse(ctx, cx, 26 + (f === 1 ? 2 : 0), rx, ry, fillBase, ox, 1);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - rx + 2, 31, (rx - 2) * 2, 4);
        CelSpriteAtlas._inkEllipse(ctx, cx, 25, 4, 4, isHurt ? '#fef08a' : pal.mid, null, 0);
        ctx.fillStyle = ox;
        ctx.fillRect(cx - 6, 22 + bob, 3, 4);
        ctx.fillRect(cx + 3, 22 + bob, 3, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 5, 23 + bob, 1, 1);
        ctx.fillRect(cx + 4, 23 + bob, 1, 1);
      }
    });
  }

  // =========================================================================
  // ARQUITECTURA DE CIUDADES POR BIOMA Y FLORA ANIMADA (4 BIOMAS × 4 TIPOS)
  // =========================================================================

  /**
   * Hornea un edificio arquitectónico detallado de ciudad regional (168x152 px).
   * Soporta 4 biomas × 4 tipos (`cottage`, `forge`, `alchemist`, `civic`) con mampostería,
   * vigas, tejas/cúpulas individuales y accesorios de oficio sin tonos azules planos.
   * @param {'cave_exit_intro'|'marsh_of_spores'|'ash_caldera'|'astral_citadel'} [biome='cave_exit_intro']
   * @param {'cottage'|'forge'|'alchemist'|'civic'} [buildingType='cottage']
   * @returns {HTMLCanvasElement}
   */
  static getHouseSprite(biome = 'cave_exit_intro', buildingType = 'cottage') {
    const bKey = ELEMENT_PALETTES[biome] || (biome === 'marsh_of_spores' || biome === 'ash_caldera' || biome === 'astral_citadel' ? biome : 'cave_exit_intro');
    const normBiome = (biome === 'marsh_of_spores' || biome === 'ash_caldera' || biome === 'astral_citadel') ? biome : 'cave_exit_intro';
    const bType = (buildingType === 'forge' || buildingType === 'alchemist' || buildingType === 'civic') ? buildingType : 'cottage';
    return CelSpriteAtlas.getOrBake(`house_v4_${normBiome}_${bType}`, 168, 152, (ctx, w, h) => {
      const palettes = {
        cave_exit_intro: {
          wall: '#f5ebd1', wallShade: '#d6c5a3', plinth: '#64748b', plinthDark: '#334155',
          timber: '#78350f', roof: '#c2410c', roofDark: '#7c2d12', roofHi: '#f59e0b',
          door: '#854d0e', accent: '#16a34a', win: '#fbbf24'
        },
        marsh_of_spores: {
          wall: '#5c4738', wallShade: '#3f3028', plinth: '#2d1e18', plinthDark: '#1a110e',
          timber: '#422a22', roof: '#0f766e', roofDark: '#134e4a', roofHi: '#2dd4bf',
          door: '#5c2d3a', accent: '#a855f7', win: '#5eead4'
        },
        ash_caldera: {
          wall: '#44403c', wallShade: '#292524', plinth: '#1c1917', plinthDark: '#09090b',
          timber: '#92400e', roof: '#52525b', roofDark: '#27272a', roofHi: '#f59e0b',
          door: '#7c2d12', accent: '#fb923c', win: '#fb923c'
        },
        astral_citadel: {
          wall: '#e2e8f0', wallShade: '#94a3b8', plinth: '#312e81', plinthDark: '#1e1b4b',
          timber: '#eab308', roof: '#6d28d9', roofDark: '#3b0764', roofHi: '#e879f9',
          door: '#4338ca', accent: '#38bdf8', win: '#f5d0fe'
        }
      };
      const pal = palettes[normBiome] || palettes.cave_exit_intro;

      // Sombra basal
      ctx.fillStyle = 'rgba(11, 16, 29, 0.34)';
      ctx.fillRect(14, h - 18, w - 28, 12);

      // Chimenea o torre trasera según oficio
      if (bType === 'forge') {
        CelSpriteAtlas._inkRoundRect(ctx, 114, 8, 26, 46, 2, '#3f3f46', INK, 2);
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(120, 12, 14, 6);
      } else if (bType === 'alchemist') {
        CelSpriteAtlas._inkRoundRect(ctx, 118, 12, 20, 42, 3, pal.plinth, INK, 2);
        CelSpriteAtlas._inkEllipse(ctx, 128, 12, 11, 6, pal.accent, INK, 2);
      } else {
        CelSpriteAtlas._inkRoundRect(ctx, 116, 16, 18, 36, 2, pal.plinth, INK, 2);
      }

      // Zócalo / palafito basal
      CelSpriteAtlas._inkRoundRect(ctx, 20, h - 36, w - 40, 22, 2, pal.plinth, INK, 2);
      ctx.fillStyle = pal.plinthDark;
      ctx.fillRect(23, h - 23, w - 46, 6);
      if (normBiome === 'marsh_of_spores') {
        // Pilotes elevados de madera de pantano
        for (const px of [24, 60, 102, 134]) {
          CelSpriteAtlas._inkRoundRect(ctx, px, h - 22, 10, 16, 1, pal.timber, INK, 1);
        }
      } else {
        // Sillería trabada en zócalo
        ctx.fillStyle = pal.wallShade;
        for (let sx = 28; sx < w - 34; sx += 18) {
          ctx.fillRect(sx, h - 33, 2, 12);
        }
      }

      // Fachada principal texturizada
      CelSpriteAtlas._inkRoundRect(ctx, 22, 64, w - 44, 54, 2, pal.wall, INK, 2);
      ctx.fillStyle = pal.wallShade;
      ctx.fillRect(24, 66, w - 48, 12); // sombra bajo el alero
      for (let ty = 80; ty < 114; ty += 11) {
        ctx.fillStyle = 'rgba(11, 16, 29, 0.14)';
        ctx.fillRect(25, ty, w - 50, 1);
      }

      // Vigas entramadas verticales y refuerzos de bronce/oro
      for (const vx of [22, 72, w - 32]) {
        CelSpriteAtlas._inkRoundRect(ctx, vx, 64, 10, 54, 1, pal.timber, INK, 1);
      }

      // Tejado inclinado en capas de tejas / cúpula orgánica
      ctx.fillStyle = pal.roof;
      ctx.beginPath();
      ctx.moveTo(8, 70);
      ctx.lineTo(w * 0.5, 18);
      ctx.lineTo(w - 8, 70);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = INK;
      ctx.stroke();

      // Mitad derecha sombreada del tejado
      ctx.fillStyle = pal.roofDark;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, 20);
      ctx.lineTo(w - 11, 68);
      ctx.lineTo(w * 0.5, 68);
      ctx.closePath();
      ctx.fill();

      // Hiladas detalladas de tejas/escamas/placas
      ctx.fillStyle = pal.roofHi;
      ctx.fillRect(38, 50, 38, 4);
      ctx.fillRect(52, 36, 28, 4);
      ctx.fillRect(w * 0.5 - 3, 20, 6, 48);
      if (normBiome === 'marsh_of_spores') {
        // Motas fúngicas bioluminiscentes
        ctx.fillStyle = pal.accent;
        ctx.fillRect(46, 42, 6, 4);
        ctx.fillRect(102, 46, 6, 4);
      } else if (normBiome === 'ash_caldera') {
        // Remaches metálicos de bronce
        ctx.fillStyle = '#fbbf24';
        for (let rx = 28; rx < w - 30; rx += 14) {
          ctx.fillRect(rx, 63, 2, 2);
        }
      }

      // Puerta principal y emblema superior
      const doorW = bType === 'civic' ? 34 : 26;
      const doorX = bType === 'civic' ? Math.round(w * 0.5 - doorW * 0.5) : 40;
      CelSpriteAtlas._inkRoundRect(ctx, doorX, 82, doorW, 48, 2, pal.door, INK, 2);
      ctx.fillStyle = pal.roofHi;
      ctx.fillRect(doorX + doorW - 7, 104, 3, 3);
      if (bType === 'civic') {
        CelSpriteAtlas._inkRoundRect(ctx, Math.round(w * 0.5 - 12), 42, 24, 14, 3, pal.plinth, INK, 2);
        ctx.fillStyle = pal.roofHi;
        ctx.fillRect(Math.round(w * 0.5 - 5), 46, 10, 6);
      }

      // Ventana iluminada con marco + detalles de oficio
      CelSpriteAtlas._inkRoundRect(ctx, 98, 82, 28, 22, 2, pal.win, INK, 2);
      ctx.fillStyle = pal.timber;
      ctx.fillRect(111, 82, 3, 22);
      ctx.fillRect(98, 92, 28, 3);

      if (bType === 'forge') {
        // Yunque exterior y fragua abierta al frente derecho
        CelSpriteAtlas._inkRoundRect(ctx, 128, 114, 18, 12, 2, '#334155', INK, 1);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(102, 86, 8, 5);
      } else if (bType === 'alchemist') {
        // Soporte de letrero y frasco colgante
        ctx.fillStyle = pal.timber;
        ctx.fillRect(72, 76, 16, 3);
        CelSpriteAtlas._inkEllipse(ctx, 84, 85, 5, 5, pal.accent, INK, 1);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(83, 83, 2, 2);
      } else {
        // Musgo/jardinera cálida bajo la ventana
        CelSpriteAtlas._inkRoundRect(ctx, 96, 103, 32, 6, 1, pal.accent, INK, 1);
      }
    }, true);
  }

  /**
   * Hornea el tronco anclado a tierra de un árbol por bioma (84x98 px).
   * @param {string} [biome='cave_exit_intro']
   * @param {number} [variant=0]
   * @returns {HTMLCanvasElement}
   */
  static getTreeTrunkSprite(biome = 'cave_exit_intro', variant = 0) {
    const normBiome = (biome === 'marsh_of_spores' || biome === 'ash_caldera' || biome === 'astral_citadel') ? biome : 'cave_exit_intro';
    const v = variant & 1;
    return CelSpriteAtlas.getOrBake(`tree_trunk_v4_${normBiome}_${v}`, 84, 98, (ctx, w, h) => {
      const cx = Math.floor(w * 0.5);
      const baseY = h - 6;
      const barkDark = normBiome === 'ash_caldera' ? '#1c1917' : normBiome === 'astral_citadel' ? '#334155' : normBiome === 'marsh_of_spores' ? '#2d1e18' : '#4a2419';
      const barkMid = normBiome === 'ash_caldera' ? '#44403c' : normBiome === 'astral_citadel' ? '#64748b' : normBiome === 'marsh_of_spores' ? '#5c3a28' : '#783c26';
      const mossBase = normBiome === 'ash_caldera' ? '#9a3412' : normBiome === 'astral_citadel' ? '#4338ca' : normBiome === 'marsh_of_spores' ? '#0f766e' : '#3b8c32';

      ctx.fillStyle = mossBase;
      ctx.fillRect(cx - 17, baseY - 3, 34, 5);
      ctx.fillStyle = INK;
      ctx.fillRect(cx - 10, 48, 20, baseY - 48);
      ctx.fillRect(cx - 13, baseY - 12, 26, 11);
      ctx.fillRect(cx - 16, baseY - 6, 32, 6);

      ctx.fillStyle = barkMid;
      ctx.fillRect(cx - 9, 49, 18, baseY - 50);
      ctx.fillRect(cx - 12, baseY - 11, 24, 10);
      ctx.fillRect(cx - 15, baseY - 5, 30, 4);

      ctx.fillStyle = barkDark;
      ctx.fillRect(cx + 2, 52, 7, baseY - 53);
      ctx.fillRect(cx + 5, baseY - 11, 7, 10);
    }, true);
  }

  /**
   * Hornea la copa frondosa de un árbol por bioma para permitir balanceo independiente al tronco (84x98 px).
   * @param {string} [biome='cave_exit_intro']
   * @param {number} [variant=0]
   * @returns {HTMLCanvasElement}
   */
  static getTreeCanopySprite(biome = 'cave_exit_intro', variant = 0) {
    const normBiome = (biome === 'marsh_of_spores' || biome === 'ash_caldera' || biome === 'astral_citadel') ? biome : 'cave_exit_intro';
    const v = variant & 1;
    return CelSpriteAtlas.getOrBake(`tree_canopy_v4_${normBiome}_${v}`, 84, 98, (ctx, w) => {
      const cx = Math.floor(w * 0.5);
      let shadow = '#163829';
      let mid = '#3c8d37';
      let light = '#69be3b';
      let accent = '#b5e48c';

      if (normBiome === 'cave_exit_intro' && v === 1) {
        shadow = '#78350f'; mid = '#b45309'; light = '#f59e0b'; accent = '#fef08a';
      } else if (normBiome === 'marsh_of_spores') {
        shadow = '#134e4a'; mid = '#0d9488'; light = '#2dd4bf'; accent = v === 1 ? '#e879f9' : '#99f6e4';
      } else if (normBiome === 'ash_caldera') {
        shadow = '#450a0a'; mid = '#9a3412'; light = '#ea580c'; accent = '#fde047';
      } else if (normBiome === 'astral_citadel') {
        shadow = '#2e1065'; mid = '#6d28d9'; light = '#a855f7'; accent = '#f5d0fe';
      }

      const paintLobe = (lx, ly, rx, ry, col) => {
        ctx.fillStyle = col;
        for (let dy = -ry; dy <= ry; dy++) {
          const ny = dy / (ry + 0.35);
          const hw = Math.max(1, Math.round(rx * Math.sqrt(Math.max(0, 1 - ny * ny))));
          ctx.fillRect(cx + lx - hw, ly + dy, hw * 2, 1);
        }
      };

      const lobes = [[-21, 48, 16, 13], [21, 48, 16, 13], [0, 50, 21, 13], [-16, 34, 17, 14], [16, 35, 17, 14], [0, 23, 24, 18]];
      for (const [lx, ly, rx, ry] of lobes) paintLobe(lx, ly, rx + 1, ry + 1, INK);
      for (const [lx, ly, rx, ry] of lobes) paintLobe(lx, ly, rx, ry, shadow);
      for (const [lx, ly, rx, ry] of lobes) paintLobe(lx - 1, ly - 1, Math.max(2, rx - 1), Math.max(2, ry - 2), mid);
      for (const [lx, ly, rx, ry] of lobes) paintLobe(lx - 1, ly - 4, Math.max(2, Math.round(rx * 0.68)), Math.max(2, Math.round(ry * 0.54)), light);

      ctx.fillStyle = accent;
      ctx.fillRect(cx - 14, 17, 4, 2);
      ctx.fillRect(cx - 4, 13, 5, 2);
      ctx.fillRect(cx + 8, 22, 4, 2);
      ctx.fillRect(cx - 18, 32, 3, 2);
    }, true);
  }

  /**
   * Hornea un arbusto reactivo adaptado cromáticamente a cada bioma (48x44 px).
   * @param {string} [biome='cave_exit_intro']
   * @param {number} [variant=0]
   * @returns {HTMLCanvasElement}
   */
  static getBiomeBushSprite(biome = 'cave_exit_intro', variant = 0) {
    const normBiome = (biome === 'marsh_of_spores' || biome === 'ash_caldera' || biome === 'astral_citadel') ? biome : 'cave_exit_intro';
    return CelSpriteAtlas.getOrBake(`bush_v4_${normBiome}_${variant & 1}`, 48, 44, (ctx, w, h) => {
      const cx = Math.floor(w * 0.5);
      const cy = Math.floor(h * 0.58);
      let shadow = '#1e564f';
      let mid = '#2b9348';
      let light = '#55a630';
      let petal = '#fde047';
      if (normBiome === 'marsh_of_spores') { shadow = '#134e4a'; mid = '#0d9488'; light = '#5eead4'; petal = '#e879f9'; }
      else if (normBiome === 'ash_caldera') { shadow = '#292524'; mid = '#7c2d12'; light = '#ea580c'; petal = '#fde047'; }
      else if (normBiome === 'astral_citadel') { shadow = '#1e1b4b'; mid = '#5b21b6'; light = '#c084fc'; petal = '#38bdf8'; }

      const lobes = [[-10, cy - 8, 7, 5], [10, cy - 6, 7, 5], [0, cy - 11, 10, 7], [-5, cy + 2, 12, 8], [10, cy + 3, 8, 7]];
      const drawLobe = (ox, oy, rx, ry, col) => {
        ctx.fillStyle = col;
        for (let dy = -ry; dy <= ry; dy++) {
          const ny = dy / (ry + 0.3);
          const hw = Math.max(1, Math.round(rx * Math.sqrt(Math.max(0, 1 - ny * ny))));
          ctx.fillRect(cx + ox - hw, oy + dy, hw * 2, 1);
        }
      };
      for (const [ox, oy, rx, ry] of lobes) drawLobe(ox, oy, rx + 1, ry + 1, INK);
      for (const [ox, oy, rx, ry] of lobes) drawLobe(ox, oy, rx, ry, shadow);
      for (const [ox, oy, rx, ry] of lobes) drawLobe(ox - 1, oy - 1, Math.max(2, rx - 1), Math.max(2, ry - 2), mid);
      for (const [ox, oy, rx, ry] of lobes) drawLobe(ox - 1, oy - 3, Math.max(2, Math.round(rx * 0.65)), Math.max(2, Math.round(ry * 0.5)), light);

      ctx.fillStyle = petal;
      ctx.fillRect(cx - 10, cy - 8, 3, 3);
      ctx.fillRect(cx + 6, cy, 3, 3);
      ctx.fillRect(cx - 2, cy - 3, 2, 2);
    }, true);
  }

  // =========================================================================
  // PROPS ARQUITECTÓNICOS Y DE NARRATIVA AMBIENTAL (PIXEL-ART 16-BIT)
  // =========================================================================

  /**
   * Helper interno para trazar un contorno + relleno pixel-art por franjas horizontales `[yStart, yEnd, leftX, width]`.
   * Garantiza bordes exteriores de 1px totalmente definidos sin suavizado sub-píxel.
   * @private
   */
  static _fillRowBands(ctx, bands, fillColor, outlineColor = INK) {
    if (outlineColor) {
      ctx.fillStyle = outlineColor;
      for (let b = 0; b < bands.length; b++) {
        const [y0, y1, lx, w] = bands[b];
        for (let y = y0; y <= y1; y++) {
          ctx.fillRect(lx - 1, y - 1, w + 2, 3);
        }
      }
    }
    ctx.fillStyle = fillColor;
    for (let b = 0; b < bands.length; b++) {
      const [y0, y1, lx, w] = bands[b];
      ctx.fillRect(lx, y0, w, y1 - y0 + 1);
    }
  }

  /**
   * Dibuja una diminuta flor silvestre blanca con centro amarillo sobre piedra o musgo.
   * @private
   */
  static _drawMiniRockFlower(ctx, fx, fy) {
    ctx.fillStyle = '#1e564f';
    ctx.fillRect(fx - 1, fy + 1, 5, 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(fx, fy, 3, 1);
    ctx.fillRect(fx + 1, fy - 1, 1, 3);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(fx + 1, fy, 1, 1);
  }

  /**
   * Dibuja una pequeña seta roja con motas blancas para rocas y entornos boscosos.
   * @private
   */
  static _drawMiniRockMushroom(ctx, mx, my) {
    ctx.fillStyle = INK;
    ctx.fillRect(mx - 1, my, 7, 4);
    ctx.fillRect(mx + 1, my + 3, 3, 3);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(mx + 2, my + 4, 1, 1);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(mx, my + 1, 5, 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(mx + 1, my + 1, 1, 1);
    ctx.fillRect(mx + 3, my + 2, 1, 1);
  }

  /**
   * Boca de caverna pixel-art de 192x156 px con clave rúnica, arco en peldaños enteros,
   * facetas de piedra pizarra, musgo colgante y rocas basales.
   * @returns {HTMLCanvasElement}
   */
  static getCaveMouthSprite() {
    return CelSpriteAtlas.getOrBake('prop_cave_mouth_v4', 192, 156, (ctx, w, h) => {
      // Silueta escalonada de piedra pizarra
      const rockBands = [
        [8, 15, 62, 68],
        [16, 27, 44, 104],
        [28, 43, 28, 136],
        [44, 65, 16, 160],
        [66, h - 10, 10, 172]
      ];
      CelSpriteAtlas._fillRowBands(ctx, rockBands, '#475569', INK);

      // Cojín basal verde-azulado alrededor de la base de la cueva
      ctx.fillStyle = '#1e564f';
      ctx.fillRect(8, h - 12, 46, 5);
      ctx.fillRect(138, h - 12, 46, 5);
      ctx.fillStyle = '#3d8b40';
      ctx.fillRect(12, h - 11, 36, 3);
      ctx.fillRect(142, h - 11, 36, 3);

      // Facetas superiores iluminadas en pizarra claro y biseles
      ctx.fillStyle = '#64748b';
      ctx.fillRect(62, 10, 68, 8);
      ctx.fillRect(46, 18, 92, 10);
      ctx.fillRect(30, 28, 98, 15);
      ctx.fillRect(18, 45, 42, 30);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(64, 10, 54, 4);
      ctx.fillRect(48, 18, 60, 4);
      ctx.fillRect(31, 28, 42, 3);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(65, 10, 28, 2);
      ctx.fillRect(49, 18, 22, 2);

      // Plano de sombra lateral derecha y estrías verticales facetadas
      ctx.fillStyle = '#334155';
      ctx.fillRect(136, 34, 34, h - 46);
      ctx.fillStyle = '#283548';
      ctx.fillRect(148, 48, 24, h - 60);
      ctx.fillRect(160, 68, 18, h - 78);

      // Fisuras verticales escalonadas en los contrafuertes laterales
      ctx.fillStyle = INK;
      ctx.fillRect(38, 46, 2, 18);
      ctx.fillRect(36, 64, 2, 20);
      ctx.fillRect(146, 54, 2, 16);
      ctx.fillRect(148, 70, 2, 18);

      // Arco interior abismal escalonado pixel-art
      const abyssBands = [
        [54, 61, 76, 40],
        [62, 71, 64, 64],
        [72, 83, 56, 80],
        [84, h - 10, 52, 88]
      ];
      CelSpriteAtlas._fillRowBands(ctx, abyssBands, '#090919', INK);

      // Dintel superior de piedra labrada y clave con runa turquesa
      CelSpriteAtlas._inkRoundRect(ctx, 84, 38, 24, 18, 2, '#64748b', INK, 1);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(86, 39, 20, 3);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(94, 42, 4, 10);
      ctx.fillRect(91, 45, 10, 3);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(95, 43, 2, 4);

      // Mantos de musgo en capas sobre las repisas + diminutas flores
      CelSpriteAtlas._inkRoundRect(ctx, 24, 34, 34, 10, 2, '#1e564f', INK, 1);
      ctx.fillStyle = '#2b9348';
      ctx.fillRect(26, 35, 29, 6);
      ctx.fillStyle = '#74c69d';
      ctx.fillRect(28, 35, 19, 3);
      CelSpriteAtlas._drawMiniRockFlower(ctx, 42, 37);

      CelSpriteAtlas._inkRoundRect(ctx, 132, 40, 30, 9, 2, '#1e564f', INK, 1);
      ctx.fillStyle = '#2b9348';
      ctx.fillRect(134, 41, 25, 6);
      ctx.fillStyle = '#74c69d';
      ctx.fillRect(136, 41, 16, 3);
      CelSpriteAtlas._drawMiniRockFlower(ctx, 146, 43);

      // Rocas secundarias facetadas en la base a ambos lados del túnel
      CelSpriteAtlas._inkRoundRect(ctx, 14, h - 24, 26, 14, 2, '#475569', INK, 1);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(16, h - 23, 18, 4);
      CelSpriteAtlas._inkRoundRect(ctx, 150, h - 25, 28, 15, 2, '#334155', INK, 1);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(152, h - 24, 18, 5);
    });
  }

  /**
   * Peñasco de risco facetado estilo pixel-art (64x60 px) con musgo, rocas basales,
   * setas o cristal arcano según variante.
   * @param {boolean} [withCrystal=false]
   * @returns {HTMLCanvasElement}
   */
  static getCliffRockSprite(withCrystal = false) {
    return CelSpriteAtlas.getOrBake(`prop_cliff_rock_v4_${withCrystal ? 'crystal' : 'plain'}`, 64, 60, (ctx) => {
      // Base suave de hierba verde-azulada bajo las piedras
      ctx.fillStyle = '#1e564f';
      ctx.fillRect(6, 46, 52, 8);
      ctx.fillRect(10, 44, 44, 11);
      ctx.fillStyle = '#3d8b40';
      ctx.fillRect(9, 47, 46, 5);

      // Cuerpo principal facetado del peñasco
      const bands = [
        [13, 18, 20, 22],
        [19, 26, 13, 36],
        [27, 36, 10, 43],
        [37, 49, 8, 47]
      ];
      CelSpriteAtlas._fillRowBands(ctx, bands, '#475569', INK);

      // Cima plana iluminada y faceta izquierda clara
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(21, 14, 19, 5);
      ctx.fillRect(15, 19, 17, 6);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(22, 14, 14, 2);
      ctx.fillRect(16, 19, 10, 2);

      // Faceta media izquierda y arista vertical de corte
      ctx.fillStyle = '#64748b';
      ctx.fillRect(11, 25, 19, 18);
      ctx.fillRect(20, 20, 14, 10);

      // Faceta derecha sombreada y estrato basal
      ctx.fillStyle = '#334155';
      ctx.fillRect(34, 22, 16, 25);
      ctx.fillStyle = '#283548';
      ctx.fillRect(38, 30, 15, 18);
      ctx.fillRect(11, 44, 42, 5);

      // Grietas angulares entre planos de piedra
      ctx.fillStyle = INK;
      ctx.fillRect(31, 18, 1, 10);
      ctx.fillRect(32, 28, 1, 11);
      ctx.fillRect(30, 39, 1, 8);
      ctx.fillRect(21, 31, 1, 13);
      ctx.fillRect(22, 29, 4, 1);

      // Piedras pequeñas adosadas a la base
      CelSpriteAtlas._inkRoundRect(ctx, 6, 42, 11, 8, 2, '#475569', INK, 1);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(8, 43, 6, 2);

      CelSpriteAtlas._inkRoundRect(ctx, 43, 41, 14, 10, 2, '#475569', INK, 1);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(45, 42, 9, 3);
      ctx.fillStyle = '#283548';
      ctx.fillRect(49, 46, 6, 3);

      // Parche de musgo verde sobre el hombro superior derecho
      ctx.fillStyle = '#1e564f';
      ctx.fillRect(34, 15, 10, 6);
      ctx.fillRect(38, 21, 6, 3);
      ctx.fillStyle = '#2b9348';
      ctx.fillRect(35, 15, 8, 4);
      ctx.fillStyle = '#74c69d';
      ctx.fillRect(36, 15, 5, 2);

      // Flores silvestres discretas en la base derecha
      CelSpriteAtlas._drawMiniRockFlower(ctx, 41, 39);
      CelSpriteAtlas._drawMiniRockFlower(ctx, 46, 49);

      if (withCrystal) {
        CelSpriteAtlas._inkRoundRect(ctx, 26, 7, 10, 18, 2, '#38bdf8', INK, 1);
        CelSpriteAtlas._inkRoundRect(ctx, 34, 12, 7, 12, 2, '#0284c7', INK, 1);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(28, 9, 3, 11);
        ctx.fillRect(35, 14, 2, 6);
      } else {
        // Dos pequeñas setas rojas junto a la base izquierda (Ref 2)
        CelSpriteAtlas._drawMiniRockMushroom(ctx, 9, 46);
        CelSpriteAtlas._drawMiniRockMushroom(ctx, 18, 48);
      }
    });
  }

  /**
   * Estatua rota del Santuario en pixel-art entero cubierta de musgo bioma (64x80 px).
   * @param {string} [biome='forest']
   * @returns {HTMLCanvasElement}
   */
  static getBrokenStatueSprite(biome = 'forest') {
    return CelSpriteAtlas.getOrBake(`prop_broken_statue_v3_${biome}`, 64, 80, (ctx) => {
      const mossCol = biome === 'ash' ? '#92400e' : biome === 'marsh' ? '#0d9488' : biome === 'astral' ? '#6b21a8' : '#15803d';
      const mossLight = biome === 'ash' ? '#fb923c' : biome === 'marsh' ? '#5eead4' : biome === 'astral' ? '#e879f9' : '#84cc16';

      // Pedestal escalonado pixel-art
      CelSpriteAtlas._inkRoundRect(ctx, 10, 56, 44, 15, 2, '#475569', INK, 1);
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(12, 64, 40, 5);
      CelSpriteAtlas._inkRoundRect(ctx, 14, 48, 36, 10, 2, '#64748b', INK, 1);

      // Runa dorada en el pedestal
      ctx.fillStyle = '#eab308';
      ctx.fillRect(28, 58, 8, 2);
      ctx.fillRect(31, 55, 2, 7);

      // Torso de mármol quebrado en escalones enteros
      const torsoBands = [
        [18, 22, 23, 14],
        [23, 28, 19, 22],
        [29, 48, 18, 26]
      ];
      CelSpriteAtlas._fillRowBands(ctx, torsoBands, '#94a3b8', INK);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(20, 24, 8, 20);
      ctx.fillStyle = '#475569';
      ctx.fillRect(35, 30, 8, 18);

      // Cabeza caída junto al pedestal
      CelSpriteAtlas._inkRoundRect(ctx, 41, 61, 14, 11, 2, '#94a3b8', INK, 1);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(43, 63, 6, 4);

      // Enredadera / musgo ambiental pixel-art
      CelSpriteAtlas._inkRoundRect(ctx, 15, 44, 14, 7, 2, mossCol, INK, 1);
      CelSpriteAtlas._inkRoundRect(ctx, 34, 49, 13, 6, 2, mossCol, INK, 1);
      ctx.fillStyle = mossLight;
      ctx.fillRect(17, 45, 7, 2);
      ctx.fillRect(36, 50, 6, 2);
    });
  }

  /**
   * Espadón oxidado de un antiguo caballero clavado en piedra en grilla pixel-art nítida (48x56 px).
   * @returns {HTMLCanvasElement}
   */
  static getRustedGreatswordSprite() {
    return CelSpriteAtlas.getOrBake('prop_rusted_greatsword_v3', 48, 56, (ctx) => {
      // Túmulo de piedra rúnica escalonado + musgo
      CelSpriteAtlas._inkRoundRect(ctx, 10, 38, 28, 12, 2, '#475569', INK, 1);
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(12, 45, 24, 4);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(13, 39, 22, 2);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(12, 40, 6, 3);
      ctx.fillRect(30, 41, 6, 3);
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(13, 40, 4, 1);

      // Hoja ancha de acero clavada ligeramente inclinada en escalera pixel-art entera
      for (let i = 0; i < 24; i++) {
        const y = 39 - i;
        const dx = Math.floor(i / 6);
        const bx = 21 - dx;
        ctx.fillStyle = INK;
        ctx.fillRect(bx - 1, y, 8, 1);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(bx, y, 2, 1);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(bx + 2, y, 2, 1);
        ctx.fillStyle = '#334155';
        ctx.fillRect(bx + 4, y, 2, 1);
      }

      // Manchas de herrumbre ámbar sobre la hoja
      ctx.fillStyle = '#b45309';
      ctx.fillRect(21, 29, 3, 4);
      ctx.fillRect(19, 21, 2, 4);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(22, 30, 1, 2);

      // Guarda cruciforme inclinada 1px por peldaño sin antialiasing
      CelSpriteAtlas._inkRoundRect(ctx, 9, 14, 8, 3, 1, '#78350f', INK, 1);
      CelSpriteAtlas._inkRoundRect(ctx, 16, 13, 8, 3, 1, '#92400e', INK, 1);
      CelSpriteAtlas._inkRoundRect(ctx, 23, 12, 7, 3, 1, '#78350f', INK, 1);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(18, 13, 4, 2);

      // Empuñadura y pomo dorado ancestral
      CelSpriteAtlas._inkRoundRect(ctx, 17, 5, 5, 8, 1, '#4a1d3a', INK, 1);
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(18, 7, 3, 2);
      CelSpriteAtlas._inkEllipse(ctx, 19, 4, 3, 3, '#eab308', INK, 1);
      ctx.fillStyle = '#fef9c3';
      ctx.fillRect(18, 3, 1, 1);
    });
  }

  /**
   * Obelisco rúnico pixel-art del Santuario (56x88 px) que reacciona al Guantelete Elemental.
   * @param {boolean} [activated=false] - Si las runas brillan con energía activa.
   * @param {string} [runeColor='#38bdf8'] - Color elemental de las runas.
   * @returns {HTMLCanvasElement}
   */
  static getRunicObeliskSprite(activated = false, runeColor = '#38bdf8') {
    const key = `prop_runic_obelisk_v3_${activated ? 'on' : 'off'}_${runeColor}`;
    return CelSpriteAtlas.getOrBake(key, 56, 88, (ctx) => {
      // Base escalonada
      CelSpriteAtlas._inkRoundRect(ctx, 10, 67, 36, 13, 2, '#334155', INK, 1);
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(13, 73, 30, 5);

      // Columna de basalto afilada en peldaños enteros
      const obeliskBands = [
        [8, 13, 25, 6],
        [14, 21, 21, 14],
        [22, 35, 18, 20],
        [36, 68, 15, 26]
      ];
      CelSpriteAtlas._fillRowBands(ctx, obeliskBands, '#1e293b', INK);

      // Plano izquierdo iluminado pizarra
      ctx.fillStyle = '#475569';
      ctx.fillRect(25, 9, 3, 5);
      ctx.fillRect(21, 14, 7, 8);
      ctx.fillRect(19, 22, 9, 14);
      ctx.fillRect(16, 36, 12, 30);

      // Grabados rúnicos verticales sólidos
      ctx.fillStyle = activated ? runeColor : '#334155';
      ctx.fillRect(26, 22, 4, 12);
      ctx.fillRect(23, 27, 10, 3);
      ctx.fillRect(26, 38, 4, 10);
      ctx.fillRect(24, 52, 8, 5);
      if (activated) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(27, 23, 2, 10);
        ctx.fillRect(27, 39, 2, 8);
        CelSpriteAtlas._drawSparkle(ctx, 28, 12, 4, runeColor);
      }
    });
  }

  /**
   * Portal del Atlas / Reliquia en pixel-art entero (76x76 px) para transicionar entre los 4 Mundos.
   * @param {string} [portalColor='#38bdf8']
   * @returns {HTMLCanvasElement}
   */
  static getWorldPortalSprite(portalColor = '#38bdf8') {
    return CelSpriteAtlas.getOrBake(`prop_world_portal_v3_${portalColor}`, 76, 76, (ctx) => {
      const cx = 38;
      const cy = 40;
      CelSpriteAtlas._inkEllipse(ctx, cx, cy, 31, 22, '#1e1b4b', INK, 1);
      CelSpriteAtlas._inkEllipse(ctx, cx, cy, 24, 16, '#0f172a', portalColor, 1);
      CelSpriteAtlas._inkEllipse(ctx, cx, cy, 17, 11, portalColor, null, 0);
      CelSpriteAtlas._inkEllipse(ctx, cx, cy, 9, 6, '#e0f2fe', null, 0);

      // Pilares laterales con runas flotantes
      CelSpriteAtlas._inkRoundRect(ctx, 6, 15, 11, 28, 2, '#334155', INK, 1);
      CelSpriteAtlas._inkRoundRect(ctx, 59, 15, 11, 28, 2, '#334155', INK, 1);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(8, 17, 7, 4);
      ctx.fillRect(61, 17, 7, 4);
      ctx.fillStyle = portalColor;
      ctx.fillRect(9, 22, 4, 8);
      ctx.fillRect(63, 22, 4, 8);
      CelSpriteAtlas._drawSparkle(ctx, cx, 11, 4, '#fde68a');
    });
  }

  /**
   * Barricada mineral agrietada ('cracked_rock', 64x56 px) rompible con espada/embestida,
   * con facetado azul-pizarra, guijarros basales y grietas doradas luminosas.
   * @param {boolean} [isHit=false]
   * @returns {HTMLCanvasElement}
   */
  static getCrackedRockSprite(isHit = false) {
    const key = isHit ? 'prop_cracked_rock_hit' : 'prop_cracked_rock_v3';
    return CelSpriteAtlas.getOrBake(key, 64, 56, (sctx) => {
      if (!isHit) {
        sctx.fillStyle = '#1e564f';
        sctx.fillRect(5, 44, 54, 7);
        sctx.fillStyle = '#3d8b40';
        sctx.fillRect(8, 45, 48, 4);
      }

      const rows = [
        [24, 18, 8],
        [20, 28, 10],
        [15, 36, 13],
        [12, 42, 16],
        [10, 45, 20],
        [8, 49, 26],
        [7, 51, 36],
        [6, 52, 48]
      ];
      for (let yPos = 8; yPos <= 48; yPos++) {
        let minX = 6;
        let span = 52;
        for (let r = 0; r < rows.length; r++) {
          if (yPos <= rows[r][2]) {
            minX = rows[r][0];
            span = rows[r][1];
            break;
          }
        }
        sctx.fillStyle = INK;
        sctx.fillRect(minX - 1, yPos, span + 2, 1);
        sctx.fillStyle = isHit ? '#ffffff' : (yPos >= 43 ? '#283548' : '#475569');
        sctx.fillRect(minX, yPos, span, 1);
      }

      if (!isHit) {
        // Facetas superiores e izquierdas iluminadas
        sctx.fillStyle = '#64748b';
        sctx.fillRect(15, 11, 20, 15);
        sctx.fillRect(9, 20, 18, 18);
        sctx.fillStyle = '#94a3b8';
        sctx.fillRect(18, 11, 15, 5);
        sctx.fillRect(12, 17, 13, 5);
        sctx.fillStyle = '#cbd5e1';
        sctx.fillRect(20, 11, 10, 2);

        // Faceta derecha sombreada
        sctx.fillStyle = '#334155';
        sctx.fillRect(38, 17, 16, 25);
        sctx.fillStyle = '#283548';
        sctx.fillRect(42, 27, 13, 18);

        // Guijarros basales facetados
        CelSpriteAtlas._inkRoundRect(sctx, 5, 40, 10, 8, 2, '#475569', INK, 1);
        sctx.fillStyle = '#94a3b8';
        sctx.fillRect(7, 41, 6, 2);
        CelSpriteAtlas._inkRoundRect(sctx, 48, 41, 10, 7, 2, '#334155', INK, 1);
        sctx.fillStyle = '#64748b';
        sctx.fillRect(50, 42, 5, 2);

        // Grieta ígnea dorada escalonada con borde oscuro
        sctx.fillStyle = INK;
        sctx.fillRect(27, 12, 4, 7);
        sctx.fillRect(25, 19, 4, 8);
        sctx.fillRect(27, 26, 6, 4);
        sctx.fillRect(31, 29, 5, 7);
        sctx.fillRect(29, 36, 5, 9);
        sctx.fillRect(16, 28, 10, 4);

        sctx.fillStyle = '#facc15';
        sctx.fillRect(28, 12, 2, 7);
        sctx.fillRect(26, 19, 2, 8);
        sctx.fillRect(28, 27, 4, 2);
        sctx.fillRect(32, 29, 3, 7);
        sctx.fillRect(30, 36, 3, 9);
        sctx.fillRect(17, 29, 9, 2);

        sctx.fillStyle = '#fef08a';
        sctx.fillRect(28, 13, 1, 5);
        sctx.fillRect(32, 30, 1, 5);
      }
    });
  }

  /**
   * Zarzas espinosas quemables ('burnable_vines', 72x96 px).
   * @param {'idle'|'hit'|'burn'} [state='idle']
   * @returns {HTMLCanvasElement}
   */
  static getBurnableVinesSprite(state = 'idle') {
    return CelSpriteAtlas.getOrBake(`prop_burnable_vines_${state}_v2`, 72, 96, (sctx) => {
      const bodyColor = state === 'hit' ? '#fca5a5' : (state === 'burn' ? '#ea580c' : '#1d5c38');
      const lightColor = state === 'hit' ? '#fecaca' : (state === 'burn' ? '#fb923c' : '#6ebd30');
      const thornColor = state === 'burn' ? '#fef08a' : '#e11d48';

      for (let i = 0; i < 4; i++) {
        const cx = 36 + (i % 2 === 0 ? -2 : 2);
        const cy = 20 + i * 20;
        CelSpriteAtlas._inkEllipse(sctx, cx, cy, 26, 12, bodyColor, '#050811', 1);
        sctx.fillStyle = lightColor;
        sctx.fillRect(cx - 14, cy - 6, 22, 4);
      }

      const thorns = [
        [18, 22], [50, 28], [24, 48],
        [48, 56], [20, 74], [46, 78]
      ];
      for (let i = 0; i < thorns.length; i++) {
        const tx = thorns[i][0];
        const ty = thorns[i][1];
        sctx.fillStyle = '#050811';
        sctx.fillRect(tx - 4, ty + 1, 9, 4);
        sctx.fillRect(tx - 2, ty - 2, 5, 3);
        sctx.fillRect(tx - 1, ty - 5, 3, 3);
        sctx.fillStyle = thornColor;
        sctx.fillRect(tx - 3, ty + 2, 7, 2);
        sctx.fillRect(tx - 1, ty - 2, 3, 4);
        sctx.fillRect(tx, ty - 4, 1, 2);
      }
    });
  }

  /**
   * Losa de piedra musgosa del pedestal de la Espada del Alba (48x58 px).
   * @returns {HTMLCanvasElement}
   */
  static getStarterSwordStoneSprite() {
    return CelSpriteAtlas.getOrBake('prop_starter_sword_stone_v1', 48, 58, (sctx) => {
      CelSpriteAtlas._inkEllipse(sctx, 24, 45, 19, 9, '#475569', '#050811', 1);
      sctx.fillStyle = '#64748b';
      sctx.fillRect(10, 39, 28, 6);
      sctx.fillStyle = '#94a3b8';
      sctx.fillRect(14, 38, 20, 3);
      sctx.fillStyle = '#1d5c38';
      sctx.fillRect(7, 42, 7, 5);
      sctx.fillRect(34, 41, 7, 5);
      sctx.fillStyle = '#6ebd30';
      sctx.fillRect(9, 41, 4, 2);
      sctx.fillRect(35, 40, 4, 2);
      sctx.fillStyle = '#0f172a';
      sctx.fillRect(21, 39, 6, 4);
      sctx.fillStyle = '#38bdf8';
      sctx.fillRect(15, 43, 3, 2);
      sctx.fillRect(30, 43, 3, 2);
    });
  }

  /**
   * Hoja flotante de la Espada del Alba (48x58 px).
   * @returns {HTMLCanvasElement}
   */
  static getStarterSwordBladeSprite() {
    return CelSpriteAtlas.getOrBake('prop_starter_sword_blade_v1', 48, 58, (bctx) => {
      bctx.fillStyle = '#050811';
      bctx.fillRect(21, 5, 6, 13);
      bctx.fillStyle = '#38bdf8';
      bctx.fillRect(22, 6, 4, 3);
      bctx.fillStyle = '#1e3a8a';
      bctx.fillRect(22, 9, 4, 8);
      bctx.fillStyle = '#050811';
      bctx.fillRect(14, 15, 20, 6);
      bctx.fillStyle = '#eab308';
      bctx.fillRect(15, 16, 18, 4);
      bctx.fillStyle = '#fef08a';
      bctx.fillRect(16, 16, 16, 2);
      bctx.fillStyle = '#050811';
      bctx.fillRect(20, 21, 8, 21);
      bctx.fillStyle = '#cbd5e1';
      bctx.fillRect(21, 21, 6, 20);
      bctx.fillStyle = '#f8fafc';
      bctx.fillRect(22, 21, 2, 19);
      bctx.fillStyle = '#38bdf8';
      bctx.fillRect(24, 23, 2, 14);
    });
  }

  /**
   * Variante compuesta pre-horneada del pedestal de la Espada del Alba (`isConsumed` true/false).
   * @param {boolean} [isConsumed=false]
   * @returns {HTMLCanvasElement}
   */
  static getStarterSwordPedestalSprite(isConsumed = false) {
    return CelSpriteAtlas.getOrBake(`prop_starter_sword_full_${isConsumed ? 'empty' : 'full'}`, 48, 58, (ctx) => {
      ctx.drawImage(CelSpriteAtlas.getStarterSwordStoneSprite(), 0, 0);
      if (!isConsumed) {
        ctx.drawImage(CelSpriteAtlas.getStarterSwordBladeSprite(), 0, 0);
      }
    });
  }

  /**
   * Brasero rúnico elemental encendible con Fuego (`44x52`).
   * @param {boolean} [lit=false]
   * @returns {HTMLCanvasElement}
   */
  static getBrazierSprite(lit = false) {
    return CelSpriteAtlas.getOrBake(`prop_brazier_${lit ? 'lit' : 'off'}`, 44, 52, (ctx) => {
      CelSpriteAtlas._inkRoundRect(ctx, 10, 32, 24, 14, 3, '#475569', INK, 1);
      CelSpriteAtlas._inkRoundRect(ctx, 8, 22, 28, 12, 3, '#334155', INK, 1);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(10, 23, 24, 2);
      ctx.fillStyle = lit ? '#fb923c' : '#1e293b';
      ctx.fillRect(12, 18, 20, 6);
      if (lit) {
        ctx.fillStyle = '#f97316';
        ctx.fillRect(14, 10, 16, 10);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(18, 6, 8, 10);
      }
    });
  }

  /**
   * Tótem silvestre anclable con Raíces (`48x64`).
   * @param {boolean} [anchored=false]
   * @returns {HTMLCanvasElement}
   */
  static getRootTotemSprite(anchored = false) {
    return CelSpriteAtlas.getOrBake(`prop_root_totem_${anchored ? 'on' : 'off'}`, 48, 64, (ctx) => {
      CelSpriteAtlas._inkEllipse(ctx, 24, 52, 16, 7, '#334155', INK, 1);
      CelSpriteAtlas._inkRoundRect(ctx, 14, 14, 20, 40, 5, '#475569', INK, 1);
      ctx.fillStyle = anchored ? '#4ade80' : '#64748b';
      ctx.fillRect(21, 22, 6, 22);
      if (anchored) {
        ctx.fillStyle = '#15803d';
        ctx.fillRect(10, 44, 28, 6);
        ctx.fillStyle = '#86efac';
        ctx.fillRect(13, 45, 22, 2);
      }
    });
  }

  /**
   * Barrera de Basalto Cinético destructible solo con Embestida o Éter (`64x60`).
   * @param {boolean} [isHit=false]
   * @returns {HTMLCanvasElement}
   */
  static getKineticBarrierSprite(isHit = false) {
    return CelSpriteAtlas.getOrBake(`prop_kinetic_barrier_${isHit ? 'hit' : 'idle'}`, 64, 60, (ctx) => {
      CelSpriteAtlas._inkRoundRect(ctx, 4, 12, 56, 42, 6, isHit ? '#bae6fd' : '#1e293b', INK, 1);
      ctx.fillStyle = isHit ? '#ffffff' : '#334155';
      ctx.fillRect(8, 16, 48, 12);
      ctx.fillStyle = isHit ? '#facc15' : '#38bdf8';
      ctx.fillRect(16, 26, 32, 4);
      ctx.fillRect(28, 18, 8, 26);
    });
  }

  /**
   * Pilar de Impacto Cinético activable con Embestida (`48x68`).
   * @param {boolean} [activated=false]
   * @returns {HTMLCanvasElement}
   */
  static getKineticPillarSprite(activated = false) {
    return CelSpriteAtlas.getOrBake(`prop_kinetic_pillar_${activated ? 'on' : 'off'}`, 48, 68, (ctx) => {
      CelSpriteAtlas._inkEllipse(ctx, 24, 56, 16, 7, '#334155', INK, 1);
      CelSpriteAtlas._inkRoundRect(ctx, 13, 12, 22, 44, 4, '#475569', INK, 1);
      ctx.fillStyle = activated ? '#38bdf8' : '#0f172a';
      ctx.fillRect(17, 20, 14, 22);
      ctx.fillStyle = activated ? '#e0f2fe' : '#64748b';
      ctx.fillRect(21, 24, 6, 14);
    });
  }

  /**
   * Pilón Voltaico sincronizable con Éter Magnético (`48x76`).
   * @param {boolean} [activated=false]
   * @returns {HTMLCanvasElement}
   */
  static getEtherPylonSprite(activated = false) {
    return CelSpriteAtlas.getOrBake(`prop_ether_pylon_${activated ? 'on' : 'off'}`, 48, 76, (ctx) => {
      CelSpriteAtlas._inkEllipse(ctx, 24, 64, 16, 7, '#1e1b4b', INK, 1);
      CelSpriteAtlas._inkRoundRect(ctx, 15, 16, 18, 48, 4, '#312e81', INK, 1);
      CelSpriteAtlas._inkEllipse(ctx, 24, 12, 8, 8, activated ? '#c084fc' : '#475569', INK, 1);
      ctx.fillStyle = activated ? '#f5d0fe' : '#64748b';
      ctx.fillRect(21, 9, 6, 6);
      ctx.fillStyle = activated ? '#38bdf8' : '#1e293b';
      ctx.fillRect(21, 26, 6, 26);
    });
  }

  /**
   * Compuerta Rúnica sellada por enlaces lógicos (`72x68`).
   * @param {string} [color='#38bdf8']
   * @returns {HTMLCanvasElement}
   */
  static getRunicGateSprite(color = '#38bdf8') {
    return CelSpriteAtlas.getOrBake(`prop_runic_gate_${color}`, 72, 68, (ctx) => {
      CelSpriteAtlas._inkRoundRect(ctx, 4, 8, 14, 54, 3, '#334155', INK, 1);
      CelSpriteAtlas._inkRoundRect(ctx, 54, 8, 14, 54, 3, '#334155', INK, 1);
      CelSpriteAtlas._inkRoundRect(ctx, 16, 14, 40, 44, 4, '#1e1b4b', INK, 1);
      ctx.fillStyle = color;
      ctx.fillRect(20, 22, 32, 4);
      ctx.fillRect(20, 42, 32, 4);
      ctx.fillRect(34, 18, 4, 34);
    });
  }

  /**
   * Relicario de Arma o Escudo (`56x68`).
   * @param {boolean} [isConsumed=false]
   * @param {string} [accentColor='#facc15']
   * @returns {HTMLCanvasElement}
   */
  static getWeaponShrineSprite(isConsumed = false, accentColor = '#facc15') {
    return CelSpriteAtlas.getOrBake(`prop_weapon_shrine_${isConsumed ? 'empty' : 'full'}_${accentColor}`, 56, 68, (ctx) => {
      CelSpriteAtlas._inkRoundRect(ctx, 8, 46, 40, 14, 3, '#475569', INK, 1);
      CelSpriteAtlas._inkRoundRect(ctx, 16, 30, 24, 18, 2, '#64748b', INK, 1);
      if (!isConsumed) {
        ctx.fillStyle = INK;
        ctx.fillRect(25, 8, 6, 24);
        ctx.fillRect(20, 22, 16, 5);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(26, 9, 4, 21);
        ctx.fillStyle = accentColor;
        ctx.fillRect(21, 23, 14, 3);
      }
    });
  }

  /**
   * Respiradero ambiental (`spore_pool` | `magma_geyser` | `storm_coil`) (`56x44`).
   * @param {string} [kind='magma_geyser']
   * @param {'idle'|'telegraph'|'active'} [phase='idle']
   * @returns {HTMLCanvasElement}
   */
  static getHazardVentSprite(kind = 'magma_geyser', phase = 'idle') {
    return CelSpriteAtlas.getOrBake(`prop_hazard_${kind}_${phase}`, 56, 44, (ctx) => {
      if (kind === 'spore_pool') {
        CelSpriteAtlas._inkEllipse(ctx, 28, 22, 23, 15, '#134e4a', INK, 1);
        CelSpriteAtlas._inkEllipse(ctx, 28, 22, 16, 10, '#2dd4bf', null, 0);
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(19, 18, 4, 4);
        ctx.fillRect(33, 23, 5, 4);
      } else if (kind === 'storm_coil') {
        CelSpriteAtlas._inkEllipse(ctx, 28, 26, 20, 11, '#1e1b4b', INK, 1);
        const col = phase === 'active' ? '#f5d0fe' : (phase === 'telegraph' ? '#e879f9' : '#6366f1');
        CelSpriteAtlas._inkEllipse(ctx, 28, 20, 9, 9, col, INK, 1);
      } else {
        CelSpriteAtlas._inkEllipse(ctx, 28, 25, 22, 12, '#292524', INK, 1);
        const core = phase === 'active' ? '#fde047' : (phase === 'telegraph' ? '#fb923c' : '#9a3412');
        CelSpriteAtlas._inkEllipse(ctx, 28, 25, 13, 7, core, INK, 1);
      }
    });
  }

  /**
   * Obtiene o pre-hornea sprites Flyweight de proyectiles y conos compactos
   * para renderizado en lote (batching) sin asignaciones ni gradientes por frame.
   * @param {string} key - 'fire_orb'|'enemy_fire_orb'|'poison_orb'|'kinetic_bolt'|'reflected_gold'|'blade_wave'|'cone_patrol'|'cone_alert'
   * @returns {HTMLCanvasElement|null}
   */
  static getProjectileSprite(key) {
    if (typeof document === 'undefined') return null;
    if (key === 'blade_wave') {
      return CelSpriteAtlas.getOrBake('proj_blade_wave_v1', 48, 48, (ctx) => {
        ctx.translate(24, 24);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.78)';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-6, 0, 20, -Math.PI * 0.42, Math.PI * 0.42);
        ctx.stroke();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(-4, 0, 21, -Math.PI * 0.36, Math.PI * 0.36);
        ctx.stroke();
      }, true);
    }

    if (key === 'cone_patrol' || key === 'cone_alert') {
      const isAlert = key === 'cone_alert';
      return CelSpriteAtlas.getOrBake(`stealth_${key}_v1`, 128, 128, (ctx) => {
        const range = 112;
        const halfAng = Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(8, 64);
        ctx.arc(8, 64, range, -halfAng, halfAng);
        ctx.closePath();
        ctx.fillStyle = isAlert ? 'rgba(239, 68, 68, 0.14)' : 'rgba(250, 204, 21, 0.08)';
        ctx.strokeStyle = isAlert ? 'rgba(239, 68, 68, 0.38)' : 'rgba(250, 204, 21, 0.22)';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }, true);
    }

    const orbPalettes = {
      fire_orb: { size: 38, core: '#fffbeb', mid: '#f59e0b', edge: '#ea580c', fade: 'rgba(220, 38, 38, 0)', dot: 4.4 },
      enemy_fire_orb: { size: 28, core: '#fff7ed', mid: '#fb923c', edge: 'rgba(239, 68, 68, 0.75)', fade: 'rgba(239, 68, 68, 0)', dot: 3.5 },
      poison_orb: { size: 28, core: '#f0fdf4', mid: '#4ade80', edge: 'rgba(168, 85, 247, 0.72)', fade: 'rgba(168, 85, 247, 0)', dot: 3.5 },
      kinetic_bolt: { size: 28, core: '#ffffff', mid: '#38bdf8', edge: 'rgba(14, 165, 233, 0.72)', fade: 'rgba(14, 165, 233, 0)', dot: 3.6 },
      ether_orb: { size: 30, core: '#f5d0fe', mid: '#c084fc', edge: 'rgba(56, 189, 248, 0.76)', fade: 'rgba(56, 189, 248, 0)', dot: 3.8 },
      astral_orb: { size: 30, core: '#ffffff', mid: '#e879f9', edge: 'rgba(168, 85, 247, 0.80)', fade: 'rgba(168, 85, 247, 0)', dot: 4.0 },
      reflected_gold: { size: 32, core: '#ffffff', mid: '#facc15', edge: 'rgba(250, 204, 21, 0.75)', fade: 'rgba(250, 204, 21, 0)', dot: 5.5 }
    };
    const cfg = orbPalettes[key] || orbPalettes.fire_orb;

    return CelSpriteAtlas.getOrBake(`proj_${key}_v1`, cfg.size, cfg.size, (gctx, w) => {
      const half = w * 0.5;
      const grad = gctx.createRadialGradient(half, half, 2, half, half, half - 1);
      grad.addColorStop(0, cfg.core);
      grad.addColorStop(0.38, cfg.mid);
      grad.addColorStop(0.76, cfg.edge);
      grad.addColorStop(1, cfg.fade);
      gctx.fillStyle = grad;
      gctx.beginPath();
      gctx.arc(half, half, half - 1, 0, Math.PI * 2);
      gctx.fill();

      gctx.fillStyle = '#ffffff';
      gctx.beginPath();
      gctx.arc(half, half, cfg.dot, 0, Math.PI * 2);
      gctx.fill();
    }, true);
  }

  /**
   * Obtiene o carga asíncronamente una imagen externa o Data URL para objetos de ambiente personalizados.
   * Retorna la instancia `HTMLImageElement` inmediatamente si ya finalizó la carga, o `null` mientras carga o si falló.
   * @param {string} textureUrl - Ruta relativa/absoluta o Data URL de la textura personalizada
   * @param {Function|null} [onLoad=null] - Callback opcional invocado cuando la imagen termina de cargar
   * @returns {HTMLImageElement|null}
   */
  static getCustomTextureImage(textureUrl, onLoad = null) {
    if (!textureUrl || typeof textureUrl !== 'string' || typeof Image === 'undefined') {
      return null;
    }

    const existing = CelSpriteAtlas._customImageCache.get(textureUrl);
    if (existing) {
      if (existing.status === 'loaded') return existing.img;
      if (existing.status === 'loading' && typeof onLoad === 'function') {
        if (!existing.listeners.includes(onLoad)) {
          existing.listeners.push(onLoad);
        }
      }
      return null;
    }

    const img = new Image();
    const entry = {
      status: 'loading',
      img,
      listeners: typeof onLoad === 'function' ? [onLoad] : []
    };
    CelSpriteAtlas._customImageCache.set(textureUrl, entry);

    img.onload = () => {
      entry.status = 'loaded';
      for (let i = 0; i < entry.listeners.length; i++) {
        try {
          entry.listeners[i](img);
        } catch (_e) {
          // Ignorar errores en listeners de UI desacoplados
        }
      }
      entry.listeners.length = 0;
    };

    img.onerror = () => {
      entry.status = 'error';
      entry.listeners.length = 0;
    };

    img.src = textureUrl;
    if (img.complete && img.naturalWidth > 0) {
      entry.status = 'loaded';
      entry.listeners.length = 0;
      return img;
    }

    return null;
  }

  /**
   * Genera un sprite pedestal/prototipo pixel-art reutilizable para objetos de ambiente
   * personalizados que aún no tienen textura asignada o cuya textura está cargando.
   * @param {number} [width=64] - Ancho del lienzo en píxeles
   * @param {number} [height=64] - Alto del lienzo en píxeles
   * @param {string} [tintColor='#a855f7'] - Color guía para bordes y runa central
   * @returns {HTMLCanvasElement}
   */
  static getCustomPropPlaceholderSprite(width = 64, height = 64, tintColor = '#a855f7') {
    const w = Math.max(16, Math.min(384, Math.round(width) || 64));
    const h = Math.max(16, Math.min(384, Math.round(height) || 64));
    const color = tintColor || '#a855f7';
    return CelSpriteAtlas.getOrBake(`custom_prop_placeholder_${w}_${h}_${color}`, w, h, (ctx) => {
      // Marco exterior pixel-art con bisel superior y fondo pizarra
      CelSpriteAtlas._inkRoundRect(ctx, 2, 2, w - 4, h - 4, 4, '#1e293b', INK, 1);
      ctx.fillStyle = '#334155';
      ctx.fillRect(4, 4, Math.max(4, w - 8), Math.max(2, Math.floor((h - 8) * 0.3)));

      // Esquinas biseladas en color guía
      const corner = Math.max(3, Math.min(7, Math.floor(Math.min(w, h) * 0.14)));
      ctx.fillStyle = color;
      ctx.fillRect(3, 3, corner, 2);
      ctx.fillRect(3, 3, 2, corner);
      ctx.fillRect(w - 3 - corner, 3, corner, 2);
      ctx.fillRect(w - 5, 3, 2, corner);
      ctx.fillRect(3, h - 5, corner, 2);
      ctx.fillRect(3, h - 3 - corner, 2, corner);
      ctx.fillRect(w - 3 - corner, h - 5, corner, 2);
      ctx.fillRect(w - 5, h - 3 - corner, 2, corner);

      // Emblema rúnico central
      const cx = Math.floor(w * 0.5);
      const cy = Math.floor(h * 0.5);
      const r = Math.max(4, Math.min(14, Math.floor(Math.min(w, h) * 0.22)));
      CelSpriteAtlas._inkEllipse(ctx, cx, cy, r, r, '#0f172a', color, 1);
      CelSpriteAtlas._drawSparkle(ctx, cx, cy, Math.max(2, Math.floor(r * 0.55)), color);
    });
  }

  /**
   * Pre-hornea únicamente los 4 fotogramas base de Santi al iniciar la aventura;
   * el resto de enemigos, props y variantes se generan perezosamente bajo demanda (Flyweight LRU).
   */
  static prewarm() {
    if (typeof document === 'undefined') return;
    const dirs = ['down', 'up', 'left', 'right'];
    for (const dir of dirs) {
      CelSpriteAtlas.getSantiSprite(dir, 0, '#64748b', false);
    }
  }
}
