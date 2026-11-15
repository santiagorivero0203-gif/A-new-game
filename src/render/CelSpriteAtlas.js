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
  /** @type {Map<string, HTMLCanvasElement>} Caché global de sprites horneados */
  static _cache = new Map();

  /**
   * Obtiene un sprite horneado desde caché o ejecuta la función constructora una sola vez.
   * @param {string} key - Clave única de caché.
   * @param {number} width - Ancho del lienzo fuera de pantalla.
   * @param {number} height - Alto del lienzo fuera de pantalla.
   * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} drawFn - Pintor procedural.
   * @returns {HTMLCanvasElement} Lienzo horneado reutilizable.
   */
  static getOrBake(key, width, height, drawFn) {
    if (CelSpriteAtlas._cache.has(key)) {
      return CelSpriteAtlas._cache.get(key);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawFn(ctx, width, height);
    CelSpriteAtlas._crispenAndOutline(ctx, width, height);
    CelSpriteAtlas._cache.set(key, canvas);
    return canvas;
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
  // NPCS ALIADOS (Tarak & Valerio) — Hue-Shifted Cel Shading
  // =========================================================================

  /**
   * Genera u obtiene el sprite detallado de un NPC aliado (40x44 px).
   * @param {'tarak'|'valerio'|string} [variant='tarak']
   * @returns {HTMLCanvasElement}
   */
  static getNPCSprite(variant = 'tarak') {
    const key = `npc_v2_${variant}`;
    return CelSpriteAtlas.getOrBake(key, 40, 44, (ctx) => {
      const cx = 20;
      ctx.fillStyle = COOL_SHADOW_TINT;
      ctx.beginPath();
      ctx.ellipse(cx, 39.5, 9.2, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      if (variant === 'tarak') {
        // Mochila de cuero con pergamino enrollado
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10.5, 17, 7, 13.5, 2.5, '#7c2d12', INK, 1.75);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 11, 14.5, 6.5, 3.2, 1.4, '#fef3c7', INK, 1.4); // Pergamino
        // Gabán verde bosque con sombra verde-azulada
        CelSpriteAtlas._inkRoundRect(ctx, cx - 8, 19, 16, 15.5, 3.5, '#15803d', INK, 1.9);
        ctx.fillStyle = '#0f3d44';
        ctx.fillRect(cx - 6.5, 27, 13, 6);
        // Bufanda dorada con pliegue ámbar
        CelSpriteAtlas._inkRoundRect(ctx, cx - 6.5, 17.5, 13, 5.2, 2, '#f59e0b', INK, 1.6);
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(cx - 4.5, 18.4, 8, 1.4);
        // Cabeza
        CelSpriteAtlas._inkRoundRect(ctx, cx - 7.5, 7, 15, 12, 5, '#fed7aa', INK, 1.8);
        ctx.fillStyle = '#e2a395';
        ctx.fillRect(cx - 6, 15.8, 12, 2);
        // Ojos
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(cx - 4, 12, 2, 3);
        ctx.fillRect(cx + 2, 12, 2, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 3.8, 12.2, 1, 1);
        ctx.fillRect(cx + 2.2, 12.2, 1, 1);
        // Boina de explorador + pluma
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 4, 18, 5.5, 2.5, '#166534', INK, 1.8);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(cx - 6.5, 4.9, 11, 1.5);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 5.5, 2.2, 5, 2.2, 1, '#fbbf24', INK, 1.2);
      } else {
        // Sabio / Herrero Valerio
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10, 18, 20, 17.5, 4, '#312e81', INK, 1.9);
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(cx - 8.5, 28, 17, 6);
        // Peto rúnico dorado
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(cx - 1.5, 19.5, 3, 14);
        // Barba plateada con sombra azul pizarra
        CelSpriteAtlas._inkRoundRect(ctx, cx - 8, 17.5, 16, 12.5, 3.2, '#e2e8f0', INK, 1.8);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(cx - 6.5, 24.5, 13, 4);
        // Cabeza
        CelSpriteAtlas._inkRoundRect(ctx, cx - 7.5, 7, 15, 12, 4.8, '#fed7aa', INK, 1.8);
        // Cejas sabias + ojos brillantes
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(cx - 5, 10.6, 3.8, 1.8);
        ctx.fillRect(cx + 1.2, 10.6, 3.8, 1.8);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cx - 3.8, 12.4, 2, 2.5);
        ctx.fillRect(cx + 1.8, 12.4, 2, 2.5);
        // Sombrero/Yelmo rúnico del santuario
        CelSpriteAtlas._inkRoundRect(ctx, cx - 8.5, 3.5, 17, 5.5, 2.5, '#475569', INK, 1.8);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(cx - 6.5, 4.4, 12, 1.4);
        // Cristal arcano flotante en el hombro derecho
        CelSpriteAtlas._inkRoundRect(ctx, cx + 9, 6, 6, 7.5, 2, '#38bdf8', INK, 1.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx + 10.6, 7.6, 2.2, 2.6);
      }
    });
  }

  // =========================================================================
  // ENEMIGOS (5 ARQUETIPOS ÚNICOS + ELEMENTOS + HIT FLASH)
  // =========================================================================

  /**
   * Genera u obtiene el sprite detallado de un enemigo en pixel-art entero de 16-bits (44x44 px).
   * Soporta los 5 arquetipos oficiales: `hound`, `artillery`, `tank`, `duelist` y `slime`.
   * @param {'hound'|'artillery'|'tank'|'duelist'|'slime'|string} [archetype='hound']
   * @param {'plantas'|'fuego'|'kinetic'|'astral'|'normal'|string} [element='plantas']
   * @param {boolean} [isHurt=false] - Variante blanca cel-shaded de destello de impacto.
   * @returns {HTMLCanvasElement}
   */
  static getEnemySprite(archetype = 'hound', element = 'plantas', isHurt = false) {
    const key = `enemy_v4_${archetype}_${element}_${isHurt ? 1 : 0}`;
    return CelSpriteAtlas.getOrBake(key, 44, 44, (ctx) => {
      const cx = 22;
      const ox = INK;
      const pal = ELEMENT_PALETTES[element] || ELEMENT_PALETTES.plantas;
      const fillBase = isHurt ? '#ffffff' : pal.base;
      const fillDark = isHurt ? '#fef08a' : pal.dark;
      const fillLight = isHurt ? '#ffffff' : pal.light;

      if (archetype === 'hound') {
        // Sabueso depredador lupino en grilla pixel-art nítida
        // Cola arqueada trasera
        ctx.fillStyle = ox;
        ctx.fillRect(cx - 17, 13, 5, 4);
        ctx.fillRect(cx - 15, 17, 4, 8);
        ctx.fillRect(cx - 12, 22, 4, 4);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - 16, 14, 3, 2);
        ctx.fillRect(cx - 14, 16, 2, 7);
        ctx.fillStyle = fillLight;
        ctx.fillRect(cx - 16, 14, 1, 2);

        // Patas musculosas con garras afiladas
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10, 30, 5, 9, 1, fillDark, ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 5, 30, 5, 9, 1, fillDark, ox, 1);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(cx - 9, 37, 1, 1);
        ctx.fillRect(cx - 7, 37, 1, 1);
        ctx.fillRect(cx + 6, 37, 1, 1);
        ctx.fillRect(cx + 8, 37, 1, 1);

        // Torso lupino compacto con pecho iluminado y vientre frío
        CelSpriteAtlas._inkEllipse(ctx, cx, 26, 12, 8, fillBase, ox, 1);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - 9, 29, 18, 3);
        ctx.fillStyle = fillLight;
        ctx.fillRect(cx - 7, 21, 14, 2);

        // Púas dorsales elementales escalonadas
        for (let i = -1; i <= 1; i++) {
          const sx = cx + i * 5;
          ctx.fillStyle = ox;
          ctx.fillRect(sx - 2, 16, 5, 4);
          ctx.fillRect(sx - 1, 14, 3, 2);
          ctx.fillStyle = fillLight;
          ctx.fillRect(sx - 1, 15, 3, 3);
        }

        // Orejas triangulares puntiagudas
        ctx.fillStyle = ox;
        ctx.fillRect(cx - 11, 5, 5, 7);
        ctx.fillRect(cx + 6, 5, 5, 7);
        ctx.fillRect(cx - 10, 3, 3, 2);
        ctx.fillRect(cx + 7, 3, 3, 2);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - 10, 5, 3, 6);
        ctx.fillRect(cx + 7, 5, 3, 6);
        ctx.fillStyle = fillBase;
        ctx.fillRect(cx - 9, 6, 1, 4);
        ctx.fillRect(cx + 8, 6, 1, 4);

        // Cabeza lupina angular + hocico + colmillos
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 10, 18, 13, 3, fillBase, ox, 1);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - 7, 19, 14, 3);
        ctx.fillStyle = ox;
        ctx.fillRect(cx - 2, 16, 4, 2);
        ctx.fillStyle = isHurt ? '#f97316' : '#fef08a';
        ctx.fillRect(cx - 6, 13, 3, 2);
        ctx.fillRect(cx + 3, 13, 3, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 4, 20, 2, 2);
        ctx.fillRect(cx + 2, 20, 2, 2);
      } else if (archetype === 'artillery') {
        // Esporífero Artillero con sombrero fúngico bioluminiscente
        CelSpriteAtlas._inkRoundRect(ctx, cx - 9, 30, 6, 9, 1, fillDark, ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 3, 30, 6, 9, 1, fillDark, ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx, 27, 10, 8, fillBase, ox, 1);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - 7, 30, 14, 3);

        // Sombrero ancho con láminas inferiores oscuras y cúpula brillante
        const capColor = isHurt ? '#ffffff' : (element === 'fuego' ? '#fb7185' : element === 'kinetic' ? '#6366f1' : '#9333ea');
        const capDark = isHurt ? '#fef08a' : (element === 'fuego' ? '#9f1239' : element === 'kinetic' ? '#312e81' : '#3b0764');
        CelSpriteAtlas._inkEllipse(ctx, cx, 13, 15, 9, capColor, ox, 1);
        ctx.fillStyle = capDark;
        ctx.fillRect(cx - 12, 17, 24, 3);
        ctx.fillStyle = fillLight;
        ctx.fillRect(cx - 10, 9, 4, 3);
        ctx.fillRect(cx + 5, 8, 4, 3);
        ctx.fillRect(cx - 2, 6, 4, 2);

        // Ojos y boca mortero
        ctx.fillStyle = ox;
        ctx.fillRect(cx - 6, 23, 3, 2);
        ctx.fillRect(cx + 3, 23, 3, 2);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(cx - 5, 23, 1, 1);
        ctx.fillRect(cx + 4, 23, 1, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx, 29, 3, 3, '#0b101d', fillLight, 1);
      } else if (archetype === 'tank') {
        // Centinela Pavés Blindado estilo 16-bit (yelmo curvo con cuernos, maza derecha y escudo pavés heráldico)
        const steelMid = isHurt ? '#ffffff' : '#475569';
        const steelDark = isHurt ? '#fef08a' : '#1e293b';
        const steelLight = isHurt ? '#ffffff' : '#94a3b8';

        // Grebas y botas pesadas remachadas
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10, 34, 7, 7, 1, steelDark, ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 3, 34, 7, 7, 1, steelDark, ox, 1);
        ctx.fillStyle = steelLight;
        ctx.fillRect(cx - 9, 35, 5, 1);
        ctx.fillRect(cx + 4, 35, 5, 1);

        // Maza de armas en el flanco derecho
        CelSpriteAtlas._inkRoundRect(ctx, cx + 11, 20, 4, 14, 1, '#78350f', ox, 1);
        CelSpriteAtlas._inkEllipse(ctx, cx + 14, 18, 5, 5, steelMid, ox, 1);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(cx + 13, 12, 2, 2);
        ctx.fillRect(cx + 18, 17, 2, 2);
        ctx.fillStyle = fillLight;
        ctx.fillRect(cx + 13, 17, 2, 2);

        // Coraza pectoral metálica esculpida + hombreras
        CelSpriteAtlas._inkRoundRect(ctx, cx - 11, 16, 22, 19, 4, steelMid, ox, 1);
        ctx.fillStyle = steelDark;
        ctx.fillRect(cx - 9, 28, 18, 6);
        ctx.fillStyle = steelLight;
        ctx.fillRect(cx - 8, 18, 16, 2);
        // Cinturón de placas doradas
        ctx.fillStyle = isHurt ? '#ffffff' : '#eab308';
        ctx.fillRect(cx - 10, 27, 20, 2);
        // Núcleo pectoral rúnico
        CelSpriteAtlas._inkEllipse(ctx, cx + 1, 22, 3, 3, fillBase, ox, 1);
        ctx.fillStyle = fillLight;
        ctx.fillRect(cx, 21, 2, 2);

        // Hombreras escalonadas
        CelSpriteAtlas._inkRoundRect(ctx, cx - 14, 15, 7, 9, 2, fillBase, ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx + 7, 15, 7, 9, 2, fillDark, ox, 1);
        ctx.fillStyle = fillLight;
        ctx.fillRect(cx - 12, 16, 4, 2);

        // Yelmo curvo de caballero con crestas y cuernos curvados
        CelSpriteAtlas._inkEllipse(ctx, cx, 10, 9, 7, steelDark, ox, 1);
        ctx.fillStyle = steelLight;
        ctx.fillRect(cx - 5, 5, 10, 2);
        // Cresta central elemental
        ctx.fillStyle = ox;
        ctx.fillRect(cx - 2, 2, 4, 5);
        ctx.fillStyle = fillBase;
        ctx.fillRect(cx - 1, 3, 2, 3);
        // Cuernos curvados a ambos lados
        ctx.fillStyle = ox;
        ctx.fillRect(cx - 12, 5, 3, 5);
        ctx.fillRect(cx + 9, 5, 3, 5);
        ctx.fillRect(cx - 11, 3, 2, 2);
        ctx.fillRect(cx + 9, 3, 2, 2);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(cx - 11, 6, 2, 3);
        ctx.fillRect(cx + 9, 6, 2, 3);
        // Visera oscura en T con dos ojos brillantes
        ctx.fillStyle = '#090919';
        ctx.fillRect(cx - 6, 10, 12, 3);
        ctx.fillRect(cx - 1, 12, 2, 4);
        ctx.fillStyle = isHurt ? '#f97316' : pal.glow;
        ctx.fillRect(cx - 5, 11, 3, 2);
        ctx.fillRect(cx + 2, 11, 3, 2);

        // Escudo pavés blasonado curvado en flanco izquierdo (roble + marco metálico + emblema)
        const shieldWood = isHurt ? '#ffffff' : '#78350f';
        const shieldRim = isHurt ? '#fef08a' : '#cbd5e1';
        CelSpriteAtlas._inkRoundRect(ctx, cx - 19, 18, 12, 18, 3, shieldRim, ox, 1);
        ctx.fillStyle = shieldWood;
        ctx.fillRect(cx - 17, 20, 8, 14);
        ctx.fillStyle = isHurt ? '#fef08a' : '#451a03';
        ctx.fillRect(cx - 17, 29, 8, 5);
        // Emblema cruciforme dorado/elemental en el centro del escudo
        ctx.fillStyle = fillBase;
        ctx.fillRect(cx - 14, 22, 2, 9);
        ctx.fillRect(cx - 16, 25, 6, 2);
        ctx.fillStyle = fillLight;
        ctx.fillRect(cx - 14, 25, 2, 2);
      } else if (archetype === 'duelist') {
        // Acechador Duelista encapuchado con máscara ósea y dagas curvas pixel-art
        // Capa ondeante escalonada
        CelSpriteAtlas._inkRoundRect(ctx, cx - 11, 17, 22, 17, 3, isHurt ? '#ffffff' : '#1e1b4b', ox, 1);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - 9, 29, 18, 4);
        ctx.fillStyle = isHurt ? '#fef08a' : '#4338ca';
        ctx.fillRect(cx - 4, 18, 8, 14);
        // Bufanda y hombreras oscuras
        CelSpriteAtlas._inkRoundRect(ctx, cx - 10, 15, 20, 5, 2, fillDark, ox, 1);

        // Capucha en punta + máscara ósea sombreada
        CelSpriteAtlas._inkEllipse(ctx, cx, 11, 8, 7, isHurt ? '#ffffff' : '#1e1b4b', ox, 1);
        CelSpriteAtlas._inkRoundRect(ctx, cx - 6, 8, 12, 10, 3, isHurt ? '#ffffff' : '#f8fafc', ox, 1);
        ctx.fillStyle = isHurt ? '#fef08a' : '#94a3b8';
        ctx.fillRect(cx - 4, 15, 8, 2);
        ctx.fillStyle = isHurt ? '#f97316' : pal.glow;
        ctx.fillRect(cx - 4, 11, 3, 2);
        ctx.fillRect(cx + 1, 11, 3, 2);

        // Hojas duales pixel-art afiladas en diagonal
        const bladeCol = isHurt ? '#ffffff' : '#e2e8f0';
        for (let d = 0; d < 7; d++) {
          ctx.fillStyle = ox;
          ctx.fillRect(cx + 9 + d, 25 - d, 3, 3);
          ctx.fillRect(cx - 12 - d, 26 - d, 3, 3);
          ctx.fillStyle = bladeCol;
          ctx.fillRect(cx + 10 + d, 25 - d, 2, 2);
          ctx.fillRect(cx - 11 - d, 26 - d, 2, 2);
        }
      } else {
        // Slime Elemental gelatinoso con base plana y núcleo rúnico
        CelSpriteAtlas._inkEllipse(ctx, cx, 26, 13, 11, fillBase, ox, 1);
        ctx.fillStyle = fillDark;
        ctx.fillRect(cx - 11, 31, 22, 4);
        CelSpriteAtlas._inkEllipse(ctx, cx, 25, 4, 4, isHurt ? '#fef08a' : pal.mid, null, 0);
        // Ojos viscosos + brillo de cúpula
        ctx.fillStyle = ox;
        ctx.fillRect(cx - 6, 22, 3, 4);
        ctx.fillRect(cx + 3, 22, 3, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 5, 23, 1, 1);
        ctx.fillRect(cx + 4, 23, 1, 1);
        ctx.fillStyle = fillLight;
        ctx.fillRect(cx - 8, 17, 5, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 7, 17, 2, 2);
      }
    });
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
   * Boca de caverna pixel-art de 192x156 px con clave rúnica, arco en peldaños enteros y musgo.
   * @returns {HTMLCanvasElement}
   */
  static getCaveMouthSprite() {
    return CelSpriteAtlas.getOrBake('prop_cave_mouth_v3', 192, 156, (ctx, w, h) => {
      // Silueta escalonada de piedra basáltica (sin diagonales borrosas)
      const rockBands = [
        [8, 15, 62, 68],
        [16, 27, 44, 104],
        [28, 43, 28, 136],
        [44, 65, 16, 160],
        [66, h - 10, 10, 172]
      ];
      CelSpriteAtlas._fillRowBands(ctx, rockBands, '#334155', INK);

      // Plano superior iluminado cálido
      ctx.fillStyle = '#64748b';
      ctx.fillRect(62, 10, 68, 8);
      ctx.fillRect(46, 18, 92, 10);
      ctx.fillRect(30, 28, 98, 14);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(64, 10, 54, 4);
      ctx.fillRect(48, 18, 60, 4);

      // Sombra índigo lateral derecha
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(142, 46, 28, h - 56);
      ctx.fillRect(156, 68, 22, h - 78);

      // Arco interior abismal escalonado pixel-art
      const abyssBands = [
        [54, 61, 76, 40],
        [62, 71, 64, 64],
        [72, 83, 56, 80],
        [84, h - 10, 52, 88]
      ];
      CelSpriteAtlas._fillRowBands(ctx, abyssBands, '#090919', INK);

      // Dintel superior de piedra labrada y clave con runa turquesa
      CelSpriteAtlas._inkRoundRect(ctx, 84, 38, 24, 18, 2, '#475569', INK, 1);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(94, 42, 4, 10);
      ctx.fillRect(91, 45, 10, 3);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(95, 43, 2, 4);

      // Parches de musgo verde pixel-art sobre las esquinas del dintel
      CelSpriteAtlas._inkRoundRect(ctx, 24, 34, 32, 10, 2, '#15803d', INK, 1);
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(28, 36, 20, 3);
      CelSpriteAtlas._inkRoundRect(ctx, 132, 40, 28, 9, 2, '#15803d', INK, 1);
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(136, 42, 16, 3);

      // Escombros basales pixelados a ambos lados del túnel
      CelSpriteAtlas._inkRoundRect(ctx, 16, h - 22, 24, 12, 2, '#475569', INK, 1);
      CelSpriteAtlas._inkRoundRect(ctx, 152, h - 24, 26, 14, 2, '#334155', INK, 1);
    });
  }

  /**
   * Roca de acantilado en bloques pixel-art enteros (64x60 px), con cristal arcano opcional.
   * @param {boolean} [withCrystal=false]
   * @returns {HTMLCanvasElement}
   */
  static getCliffRockSprite(withCrystal = false) {
    return CelSpriteAtlas.getOrBake(`prop_cliff_rock_v3_${withCrystal ? 'crystal' : 'plain'}`, 64, 60, (ctx) => {
      const bands = [
        [14, 19, 22, 20],
        [20, 27, 14, 36],
        [28, 37, 10, 44],
        [38, 51, 8, 48]
      ];
      CelSpriteAtlas._fillRowBands(ctx, bands, '#334155', INK);

      // Plano de luz pizarra superior e izquierda
      ctx.fillStyle = '#64748b';
      ctx.fillRect(22, 15, 18, 5);
      ctx.fillRect(14, 20, 26, 8);
      ctx.fillRect(10, 28, 22, 12);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(22, 15, 14, 2);
      ctx.fillRect(15, 20, 14, 3);

      // Plano de sombra índigo derecha e inferior
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(36, 26, 18, 22);
      ctx.fillRect(12, 46, 42, 5);

      if (withCrystal) {
        CelSpriteAtlas._inkRoundRect(ctx, 27, 8, 10, 18, 2, '#38bdf8', INK, 1);
        CelSpriteAtlas._inkRoundRect(ctx, 35, 13, 7, 12, 2, '#0284c7', INK, 1);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(29, 10, 3, 11);
        ctx.fillRect(36, 15, 2, 6);
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
   * Barricada mineral agrietada ('cracked_rock', 64x56 px) rompible con espada/embestida.
   * @param {boolean} [isHit=false]
   * @returns {HTMLCanvasElement}
   */
  static getCrackedRockSprite(isHit = false) {
    const key = isHit ? 'prop_cracked_rock_hit' : 'prop_cracked_rock_v2';
    return CelSpriteAtlas.getOrBake(key, 64, 56, (sctx) => {
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
        sctx.fillStyle = isHit ? '#ffffff' : (yPos >= 44 ? '#334155' : '#64748b');
        sctx.fillRect(minX, yPos, span, 1);
      }
      if (!isHit) {
        sctx.fillStyle = '#94a3b8';
        sctx.fillRect(14, 14, 18, 6);
        sctx.fillRect(10, 20, 12, 8);
        sctx.fillStyle = '#475569';
        sctx.fillRect(42, 18, 12, 24);
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
   * Pre-hornea en caché todas las variantes críticas de Santi, NPCs, los 5 arquetipos
   * de enemigos y props durante la pantalla de carga para evitar micro-tirones al jugar.
   */
  static prewarm() {
    if (typeof document === 'undefined') return;
    const dirs = ['down', 'up', 'left', 'right'];
    const gemColors = ['#64748b', '#fb923c', '#22c55e', '#38bdf8'];
    for (const dir of dirs) {
      for (let step = 0; step < 4; step++) {
        for (const col of gemColors) {
          CelSpriteAtlas.getSantiSprite(dir, step, col, false);
          CelSpriteAtlas.getSantiSprite(dir, step, col, true);
        }
      }
    }
    CelSpriteAtlas.getNPCSprite('tarak');
    CelSpriteAtlas.getNPCSprite('valerio');

    const archetypes = ['hound', 'artillery', 'tank', 'duelist', 'slime'];
    const elements = ['plantas', 'fuego', 'kinetic', 'astral'];
    for (const arch of archetypes) {
      for (const elem of elements) {
        CelSpriteAtlas.getEnemySprite(arch, elem, false);
        CelSpriteAtlas.getEnemySprite(arch, elem, true);
      }
    }

    CelSpriteAtlas.getCaveMouthSprite();
    CelSpriteAtlas.getCliffRockSprite(false);
    CelSpriteAtlas.getCliffRockSprite(true);
    CelSpriteAtlas.getRustedGreatswordSprite();

    const biomes = ['forest', 'marsh', 'ash', 'astral'];
    for (const biome of biomes) {
      CelSpriteAtlas.getBrokenStatueSprite(biome);
    }

    const worldColors = ['#38bdf8', '#fb923c', '#22c55e', '#c084fc'];
    for (const wc of worldColors) {
      CelSpriteAtlas.getRunicObeliskSprite(false, wc);
      CelSpriteAtlas.getRunicObeliskSprite(true, wc);
      CelSpriteAtlas.getWorldPortalSprite(wc);
    }

    CelSpriteAtlas.getCrackedRockSprite(false);
    CelSpriteAtlas.getCrackedRockSprite(true);
    CelSpriteAtlas.getBurnableVinesSprite('idle');
    CelSpriteAtlas.getBurnableVinesSprite('hit');
    CelSpriteAtlas.getBurnableVinesSprite('burn');
    CelSpriteAtlas.getStarterSwordPedestalSprite(false);
    CelSpriteAtlas.getStarterSwordPedestalSprite(true);
  }
}
