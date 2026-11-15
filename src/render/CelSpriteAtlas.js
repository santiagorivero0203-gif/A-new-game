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
   * Dibuja una chispa/destello de cuatro puntas estilo anime cel-shaded.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} size
   * @param {string} color
   */
  static _drawSparkle(ctx, cx, cy, size, color = '#fef9c3') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size * 0.28, cy - size * 0.28);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx + size * 0.28, cy + size * 0.28);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size * 0.28, cy + size * 0.28);
    ctx.lineTo(cx - size, cy);
    ctx.lineTo(cx - size * 0.28, cy - size * 0.28);
    ctx.closePath();
    ctx.fill();
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
  // PROPS ARQUITECTÓNICOS Y DE NARRATIVA AMBIENTAL
  // =========================================================================

  /**
   * Boca de caverna cel-shaded de 192x156 px con clave rúnica y sombra índigo.
   * @returns {HTMLCanvasElement}
   */
  static getCaveMouthSprite() {
    return CelSpriteAtlas.getOrBake('prop_cave_mouth_v2', 192, 156, (ctx, w, h) => {
      // Base de piedra y escombros en tonos pizarra-índigo
      ctx.fillStyle = '#2d3748';
      ctx.beginPath();
      ctx.moveTo(8, h - 8);
      ctx.lineTo(14, 58);
      ctx.lineTo(44, 18);
      ctx.lineTo(98, 6);
      ctx.lineTo(150, 20);
      ctx.lineTo(178, 56);
      ctx.lineTo(w - 8, h - 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Banda superior cálida iluminada por el sol
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(24, 56);
      ctx.lineTo(48, 22);
      ctx.lineTo(98, 11);
      ctx.lineTo(146, 24);
      ctx.lineTo(132, 44);
      ctx.lineTo(54, 46);
      ctx.closePath();
      ctx.fill();

      // Sombra lateral índigo profunda
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(136, 46);
      ctx.lineTo(174, 58);
      ctx.lineTo(w - 12, h - 10);
      ctx.lineTo(140, h - 10);
      ctx.closePath();
      ctx.fill();

      // Arco interior abismal (púrpura-negro índigo)
      ctx.fillStyle = '#090919';
      ctx.beginPath();
      ctx.moveTo(52, h - 10);
      ctx.lineTo(52, 84);
      ctx.quadraticCurveTo(96, 36, 140, 84);
      ctx.lineTo(140, h - 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Clave del arco con runa turquesa tenue
      CelSpriteAtlas._inkRoundRect(ctx, 84, 38, 24, 18, 3, '#475569', INK, 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(94, 42, 4, 10);
      ctx.fillRect(91, 45, 10, 3);

      // Musgo cel-shaded con transición de color cálida
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.ellipse(42, 40, 22, 9, -0.25, 0, Math.PI * 2);
      ctx.ellipse(144, 46, 20, 8, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(28, 34, 18, 4);
      ctx.fillRect(132, 41, 15, 3.5);
    });
  }

  /**
   * Roca de acantilado angular cel-shaded (64x60 px), opcionalmente con cristales arcanos.
   * @param {boolean} [withCrystal=false]
   * @returns {HTMLCanvasElement}
   */
  static getCliffRockSprite(withCrystal = false) {
    return CelSpriteAtlas.getOrBake(`prop_cliff_rock_v2_${withCrystal ? 'crystal' : 'plain'}`, 64, 60, (ctx) => {
      ctx.fillStyle = COOL_SHADOW_TINT;
      ctx.beginPath();
      ctx.ellipse(32, 53, 25, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(8, 49);
      ctx.lineTo(12, 23);
      ctx.lineTo(29, 12);
      ctx.lineTo(48, 17);
      ctx.lineTo(57, 45);
      ctx.lineTo(40, 52);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Plano iluminado superior y sombra índigo
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(14, 24);
      ctx.lineTo(29, 14);
      ctx.lineTo(46, 19);
      ctx.lineTo(31, 29);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(31, 29);
      ctx.lineTo(54, 43);
      ctx.lineTo(40, 50);
      ctx.lineTo(12, 47);
      ctx.closePath();
      ctx.fill();

      if (withCrystal) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(27, 25);
        ctx.lineTo(32, 5);
        ctx.lineTo(40, 17);
        ctx.lineTo(36, 28);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.9;
        ctx.stroke();
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(31, 10, 3, 12);
      }
    });
  }

  /**
   * Estatua rota del Santuario cubierta de musgo e incrustaciones doradas (64x80 px).
   * Prop de narrativa ambiental: muestra la caída de los antiguos guardianes.
   * @param {string} [biome='forest']
   * @returns {HTMLCanvasElement}
   */
  static getBrokenStatueSprite(biome = 'forest') {
    return CelSpriteAtlas.getOrBake(`prop_broken_statue_${biome}`, 64, 80, (ctx) => {
      const mossCol = biome === 'ash' ? '#78350f' : biome === 'marsh' ? '#0d9488' : '#15803d';
      const mossLight = biome === 'ash' ? '#fb923c' : biome === 'marsh' ? '#5eead4' : '#84cc16';

      // Sombra proyectada
      ctx.fillStyle = COOL_SHADOW_TINT;
      ctx.beginPath();
      ctx.ellipse(32, 72, 23, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pedestal escalonado
      CelSpriteAtlas._inkRoundRect(ctx, 10, 56, 44, 15, 3, '#475569', INK, 2.2);
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(12, 64, 40, 5);
      CelSpriteAtlas._inkRoundRect(ctx, 14, 48, 36, 10, 2.5, '#64748b', INK, 2);

      // Runa dorada en el pedestal
      ctx.fillStyle = '#eab308';
      ctx.fillRect(28, 57.5, 8, 2.2);
      ctx.fillRect(31, 55, 2, 7);

      // Torso de mármol quebrado diagonalmente
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(19, 49);
      ctx.lineTo(17, 25);
      ctx.lineTo(29, 17);
      ctx.lineTo(44, 29);
      ctx.lineTo(45, 49);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Sombra lateral fría del torso + brillo marfil
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(20, 26, 7, 19);
      ctx.fillStyle = '#334155';
      ctx.fillRect(35, 30, 8, 17);

      // Cabeza caída junto al pedestal
      CelSpriteAtlas._inkRoundRect(ctx, 41, 61, 14, 11, 4, '#94a3b8', INK, 1.8);

      // Enredadera / musgo ambiental
      ctx.fillStyle = mossCol;
      ctx.beginPath();
      ctx.ellipse(22, 47, 7.5, 4, 0.2, 0, Math.PI * 2);
      ctx.ellipse(40, 52, 6.5, 3.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mossLight;
      ctx.fillRect(19, 44.5, 5, 2);
    });
  }

  /**
   * Espadón oxidado de un antiguo caballero clavado en piedra en grilla pixel-art nítida (48x56 px).
   * Elimina rotaciones fraccionarias para conservar bordes de 1px totalmente definidos.
   * @returns {HTMLCanvasElement}
   */
  static getRustedGreatswordSprite() {
    return CelSpriteAtlas.getOrBake('prop_rusted_greatsword_v2', 48, 56, (ctx) => {
      // Sombra elíptica fría bajo el túmulo
      CelSpriteAtlas._inkEllipse(ctx, 24, 49, 15, 4, COOL_SHADOW_TINT, null, 0);

      // Túmulo de piedra rúnica escalonado + musgo
      CelSpriteAtlas._inkRoundRect(ctx, 10, 38, 28, 12, 3, '#475569', INK, 1);
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
   * Obelisco rúnico del Santuario (56x88 px) que reacciona al Guantelete Elemental.
   * @param {boolean} [activated=false] - Si las runas brillan con energía activa.
   * @param {string} [runeColor='#38bdf8'] - Color elemental de las runas.
   * @returns {HTMLCanvasElement}
   */
  static getRunicObeliskSprite(activated = false, runeColor = '#38bdf8') {
    const key = `prop_runic_obelisk_${activated ? 'on' : 'off'}_${runeColor}`;
    return CelSpriteAtlas.getOrBake(key, 56, 88, (ctx) => {
      ctx.fillStyle = COOL_SHADOW_TINT;
      ctx.beginPath();
      ctx.ellipse(28, 81, 18, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Base escalonada
      CelSpriteAtlas._inkRoundRect(ctx, 10, 67, 36, 13, 3, '#334155', INK, 2.1);
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(13, 73, 30, 5);

      // Columna de basalto afilada
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(15, 68);
      ctx.lineTo(19, 18);
      ctx.lineTo(28, 7);
      ctx.lineTo(37, 18);
      ctx.lineTo(41, 68);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Plano izquierdo iluminado cálido/azulado
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(16.5, 66);
      ctx.lineTo(20, 19);
      ctx.lineTo(28, 9);
      ctx.lineTo(28, 66);
      ctx.closePath();
      ctx.fill();

      // Grabados rúnicos verticales
      const glowAlpha = activated ? 1 : 0.35;
      ctx.save();
      ctx.globalAlpha = glowAlpha;
      ctx.fillStyle = runeColor;
      ctx.fillRect(26, 22, 4, 12);
      ctx.fillRect(23, 27, 10, 3);
      ctx.fillRect(26, 38, 4, 10);
      ctx.fillRect(24, 52, 8, 5);
      if (activated) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(27, 23, 2, 10);
        ctx.fillRect(27, 39, 2, 8);
        CelSpriteAtlas._drawSparkle(ctx, 28, 12, 6, runeColor);
      }
      ctx.restore();
    });
  }

  /**
   * Portal del Atlas / Reliquia (76x76 px) para transicionar entre los 4 Mundos.
   * @param {string} [portalColor='#38bdf8']
   * @returns {HTMLCanvasElement}
   */
  static getWorldPortalSprite(portalColor = '#38bdf8') {
    return CelSpriteAtlas.getOrBake(`prop_world_portal_${portalColor}`, 76, 76, (ctx) => {
      const cx = 38;
      const cy = 40;
      // Aro rúnico grabado en el suelo
      CelSpriteAtlas._inkEllipse(ctx, cx, cy, 31, 22, '#1e1b4b', INK, 2.4);
      CelSpriteAtlas._inkEllipse(ctx, cx, cy, 24, 16, '#0f172a', portalColor, 2.2);

      // Espiral cel-shaded interior
      ctx.fillStyle = portalColor;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 18, 11.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 9.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pilares laterales con runas flotantes
      CelSpriteAtlas._inkRoundRect(ctx, 6, 15, 11, 28, 3, '#334155', INK, 2);
      CelSpriteAtlas._inkRoundRect(ctx, 59, 15, 11, 28, 3, '#334155', INK, 2);
      ctx.fillStyle = portalColor;
      ctx.fillRect(9.5, 22, 4, 8);
      ctx.fillRect(62.5, 22, 4, 8);
      CelSpriteAtlas._drawSparkle(ctx, cx, 11, 5.5, '#fde68a');
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
    const elements = ['plantas', 'fuego', 'kinetic'];
    for (const arch of archetypes) {
      for (const elem of elements) {
        CelSpriteAtlas.getEnemySprite(arch, elem, false);
        CelSpriteAtlas.getEnemySprite(arch, elem, true);
      }
    }

    CelSpriteAtlas.getCaveMouthSprite();
    CelSpriteAtlas.getCliffRockSprite(false);
    CelSpriteAtlas.getCliffRockSprite(true);
    CelSpriteAtlas.getBrokenStatueSprite('forest');
    CelSpriteAtlas.getRustedGreatswordSprite();
    CelSpriteAtlas.getRunicObeliskSprite(false, '#38bdf8');
    CelSpriteAtlas.getRunicObeliskSprite(true, '#38bdf8');
    CelSpriteAtlas.getWorldPortalSprite('#38bdf8');
  }
}
