/**
 * @module CinematicDirector
 * @description Director cinemático in-engine Zero-GC encargado de modular el ritmo del juego
 * mediante cámara lenta dinámica (`engine.timeScale`), acercamiento suave (`camera.zoomBoost`),
 * viñeta atmosférica en pasillos estrechos, presentaciones de Mini-Jefes/Jefes y el remate
 * dramático estilo Super Smash Bros (`triggerSmashKO`).
 * @author Be a Legend Team
 * @version 1.0.0
 */

const ELEM_KO_COLORS = {
  fuego: { bolt: '#fb923c', flash: '#fef08a', core: '#ea580c' },
  plantas: { bolt: '#4ade80', flash: '#fef08a', core: '#16a34a' },
  raices: { bolt: '#4ade80', flash: '#fef08a', core: '#16a34a' },
  kinetic: { bolt: '#38bdf8', flash: '#ffffff', core: '#0284c7' },
  astral: { bolt: '#e879f9', flash: '#f5d0fe', core: '#9333ea' },
  eter: { bolt: '#e879f9', flash: '#f5d0fe', core: '#9333ea' }
};

export class CinematicDirector {
  constructor() {
    /** @type {boolean} Verdadero cuando el jugador atraviesa un desfiladero estrecho */
    this.narrowCorridorActive = false;
    this.corridorLabel = '';
    this._corridorVignetteAlpha = 0;

    /** Estado del KO estilo Super Smash Bros */
    this.koState = {
      active: false,
      elapsed: 0,
      duration: 1.9,
      isBoss: true,
      enemyName: '',
      angle: -0.45,
      color: '#fb923c',
      flashColor: '#fef08a',
      midX: 0,
      midY: 0,
      revealX: null,
      revealY: null
    };

    /** Cache reutilizable Zero-GC para target cinemático de cámara */
    this._camTargetCache = { x: 0, y: 0 };

    /** Estado de presentación in-engine al entrar en arena de Jefe o Mini-Jefe */
    this.introState = {
      active: false,
      elapsed: 0,
      duration: 1.25,
      enemyName: '',
      subtitle: '',
      color: '#fb923c',
      targetX: 0,
      targetY: 0
    };
  }

  /**
   * Restaura cámara, escala temporal y overlays al cambiar o reiniciar mundo.
   * @param {Object} [context=null]
   */
  reset(context = null) {
    this.koState.active = false;
    this.koState.elapsed = 0;
    this.introState.active = false;
    this.introState.elapsed = 0;
    this.narrowCorridorActive = false;
    this.corridorLabel = '';
    this._corridorVignetteAlpha = 0;

    if (context && context.engine && typeof context.engine.setTimeScale === 'function') {
      context.engine.setTimeScale(1.0);
    }
    if (context && context.camera) {
      context.camera.targetZoomBoost = 0;
      context.camera.zoomBoost = 0;
      context.camera.cinematicTarget = null;
    }
    if (context && context.player) {
      context.player.inNarrowCorridor = false;
    }
  }

  /**
   * Dispara la secuencia dramática estilo Super Smash Bros al derrotar a un Jefe o Mini-Jefe:
   * congelación breve en cámara súper lenta, destello y relámpago diagonal en el golpe final,
   * zoom sobre el impacto y paneo hacia la compuerta o portal liberado.
   * @param {Object} enemy
   * @param {Object|null} attack
   * @param {Object} context
   */
  triggerSmashKO(enemy, attack = null, context = null) {
    if (!enemy) return;
    const ex = enemy.pos.x + (enemy.width || 32) * 0.5;
    const ey = enemy.pos.y + (enemy.height || 32) * 0.5;
    const pl = context ? context.player : null;
    const px = pl ? pl.pos.x + pl.width * 0.5 : ex;
    const py = pl ? pl.pos.y + pl.height * 0.5 : ey;

    const dx = ex - px;
    const dy = ey - py;
    const angle = (attack && typeof attack.aimAngle === 'number')
      ? attack.aimAngle
      : (Math.hypot(dx, dy) > 1 ? Math.atan2(dy, dx) : -0.45);

    const pal = ELEM_KO_COLORS[enemy.elementalAffinity] || ELEM_KO_COLORS.fuego;
    const isBoss = Boolean(enemy.isBoss);

    this.introState.active = false;
    this.koState.active = true;
    this.koState.elapsed = 0;
    this.koState.duration = isBoss ? 1.95 : 1.55;
    this.koState.isBoss = isBoss;
    this.koState.enemyName = (enemy.name || 'GUARDIÁN').toUpperCase();
    this.koState.angle = angle;
    this.koState.color = pal.bolt;
    this.koState.flashColor = pal.flash;
    this.koState.midX = Math.round((px + ex * 2) / 3);
    this.koState.midY = Math.round((py + ey * 2) / 3);
    this.koState.revealX = null;
    this.koState.revealY = null;

    // Buscar si su enlace liberó una compuerta o portal cercano para enfocarla en Fase 3
    if (context && context.entityManager && (enemy.bossId || enemy.linkId)) {
      const unlockId = enemy.linkId || enemy.bossId;
      const props = context.entityManager.getByTag('prop');
      for (let i = 0; i < props.length; i++) {
        const p = props[i];
        if (p && Array.isArray(p.sealedBy) && p.sealedBy.includes(unlockId)) {
          this.koState.revealX = Math.round(p.pos.x + (p.width || 64) * 0.5);
          this.koState.revealY = Math.round(p.pos.y + (p.height || 64) * 0.5);
          break;
        }
      }
    }

    if (context && context.engine && typeof context.engine.setTimeScale === 'function') {
      context.engine.setTimeScale(0.05);
    }
    if (context && context.camera) {
      context.camera.targetZoomBoost = isBoss ? 0.28 : 0.21;
      this._camTargetCache.x = this.koState.midX;
      this._camTargetCache.y = this.koState.midY;
      context.camera.cinematicTarget = this._camTargetCache;
      context.camera.shake(isBoss ? 0.9 : 0.65, 0.38);
    }
    if (context && context.audioManager && typeof context.audioManager.playSmashKOFinish === 'function') {
      context.audioManager.playSmashKOFinish(isBoss);
    }
  }

  /**
   * Evalúa si Santi acaba de entrar al rango visual de un Jefe o Mini-Jefe aún no presentado.
   * @param {Object} player
   * @param {Array<Object>} enemies
   * @param {Object} context
   */
  checkArenaIntros(player, enemies, context) {
    if (!player || !enemies || this.koState.active || this.introState.active) return;
    if (context && context.camera && context.camera.cinematicTarget) return;

    const px = player.pos.x + player.width * 0.5;
    const py = player.pos.y + player.height * 0.5;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || e.isDead || e._introShown) continue;
      if (!e.isBoss && !e.isMiniBoss) continue;

      const ex = e.pos.x + e.width * 0.5;
      const ey = e.pos.y + e.height * 0.5;
      const dSq = (ex - px) * (ex - px) + (ey - py) * (ey - py);
      if (dSq > 205 * 205) continue;

      e._introShown = true;
      e.introRoarTimer = 1.1;
      const pal = ELEM_KO_COLORS[e.elementalAffinity] || ELEM_KO_COLORS.fuego;
      this.introState.active = true;
      this.introState.elapsed = 0;
      this.introState.duration = 1.25;
      this.introState.enemyName = (e.name || 'GUARDIÁN').toUpperCase();
      this.introState.subtitle = e.isBoss ? 'GUARDIÁN REGIONAL' : 'CAMPEÓN DEL PASO';
      this.introState.color = pal.bolt;
      this.introState.targetX = Math.round((px + ex * 2) / 3);
      this.introState.targetY = Math.round((py + ey * 2) / 3);

      if (context && context.engine && typeof context.engine.setTimeScale === 'function') {
        context.engine.setTimeScale(0.38);
      }
      if (context && context.camera) {
        context.camera.targetZoomBoost = 0.14;
        this._camTargetCache.x = this.introState.targetX;
        this._camTargetCache.y = this.introState.targetY;
        context.camera.cinematicTarget = this._camTargetCache;
      }
      if (context && context.audioManager && typeof context.audioManager.playBossIntroRoar === 'function') {
        context.audioManager.playBossIntroRoar(e.elementalAffinity);
      }
      break;
    }
  }

  /**
   * Evalúa si el jugador camina por un pasillo estrecho para ajustar cámara, ritmo y viñeta.
   * @param {Object} player
   * @param {Array<Object>|null} corridorZones
   * @param {Object} camera
   * @param {number} [rawDt=0.016]
   */
  updateCorridorZones(player, corridorZones, camera, rawDt = 0.016) {
    let inside = false;
    let label = '';
    if (player && Array.isArray(corridorZones) && corridorZones.length > 0) {
      const cx = player.pos.x + player.width * 0.5;
      const cy = player.pos.y + player.height * 0.5;
      for (let i = 0; i < corridorZones.length; i++) {
        const z = corridorZones[i];
        if (!z) continue;
        if (cx >= z.x && cx <= z.x + z.width && cy >= z.y && cy <= z.y + z.height) {
          inside = true;
          label = z.label || '';
          break;
        }
      }
    }

    this.narrowCorridorActive = inside;
    this.corridorLabel = label;
    if (player) {
      player.inNarrowCorridor = inside;
    }

    const targetVignette = inside ? 1 : 0;
    this._corridorVignetteAlpha += (targetVignette - this._corridorVignetteAlpha) * Math.min(1, rawDt * 6);

    if (!this.koState.active && !this.introState.active && camera) {
      camera.targetZoomBoost = inside ? 0.11 : 0;
    }
  }

  /**
   * Avanza el estado de las secuencias cinemáticas in-engine usando tiempo real sin escalar.
   * @param {number} rawDt
   * @param {Object} context
   */
  update(rawDt, context = null) {
    const dt = rawDt || 0.016;
    const engine = context ? context.engine : null;
    const camera = context ? context.camera : null;

    if (this.koState.active) {
      this.koState.elapsed += dt;
      const t = this.koState.elapsed;
      const dur = this.koState.duration;

      if (t < 0.30) {
        if (engine && typeof engine.setTimeScale === 'function') engine.setTimeScale(0.05);
        if (camera) camera.targetZoomBoost = this.koState.isBoss ? 0.28 : 0.20;
      } else if (t < 1.05) {
        const ramp = 0.18 + ((t - 0.30) / 0.75) * 0.82;
        if (engine && typeof engine.setTimeScale === 'function') engine.setTimeScale(ramp);
        if (camera) camera.targetZoomBoost = 0.10;
      } else if (t < dur) {
        if (engine && typeof engine.setTimeScale === 'function') engine.setTimeScale(1.0);
        if (camera) {
          camera.targetZoomBoost = 0.04;
          if (this.koState.revealX !== null && t < dur - 0.32) {
            this._camTargetCache.x = this.koState.revealX;
            this._camTargetCache.y = this.koState.revealY;
            camera.cinematicTarget = this._camTargetCache;
          } else {
            camera.cinematicTarget = null;
          }
        }
      } else {
        this.koState.active = false;
        if (engine && typeof engine.setTimeScale === 'function') engine.setTimeScale(1.0);
        if (camera) {
          camera.cinematicTarget = null;
          camera.targetZoomBoost = this.narrowCorridorActive ? 0.11 : 0;
        }
      }
      return;
    }

    if (this.introState.active) {
      this.introState.elapsed += dt;
      if (this.introState.elapsed >= this.introState.duration) {
        this.introState.active = false;
        if (engine && typeof engine.setTimeScale === 'function') engine.setTimeScale(1.0);
        if (camera) {
          camera.cinematicTarget = null;
          camera.targetZoomBoost = this.narrowCorridorActive ? 0.11 : 0;
        }
      }
    }
  }

  /**
   * Dibuja en espacio de pantalla (`#main-canvas`) los overlays del KO estilo Smash Bros,
   * bandas de presentación de Jefes y estrechamiento atmosférico de desfiladeros.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   */
  renderScreenOverlay(ctx, width, height) {
    if (!ctx || width <= 0 || height <= 0) return;

    // 1. Viñeta estrecha en desfiladeros (Zero-GC hex + globalAlpha)
    if (this._corridorVignetteAlpha > 0.02) {
      const a = 0.34 * this._corridorVignetteAlpha;
      const barW = Math.round(width * 0.09);
      ctx.save();
      ctx.fillStyle = '#090705';
      ctx.globalAlpha = a;
      ctx.fillRect(0, 0, barW, height);
      ctx.fillRect(width - barW, 0, barW, height);
      ctx.restore();
    }

    // 2. Bandas + placa de presentación de Jefe / Mini-Jefe
    if (this.introState.active) {
      const p = Math.min(1, this.introState.elapsed / this.introState.duration);
      const slide = p < 0.2 ? (p / 0.2) : p > 0.8 ? ((1 - p) / 0.2) : 1;
      const barH = Math.round(height * 0.11 * slide);
      ctx.save();
      ctx.fillStyle = '#090705';
      ctx.fillRect(0, 0, width, barH);
      ctx.fillRect(0, height - barH, width, barH);

      if (slide > 0.5) {
        ctx.fillStyle = this.introState.color;
        ctx.font = '800 9px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.introState.subtitle, width * 0.5, height - barH + 14);
        ctx.fillStyle = '#fef3c7';
        ctx.font = '900 14px Outfit, sans-serif';
        ctx.fillText(this.introState.enemyName, width * 0.5, height - barH + 29);
      }
      ctx.restore();
    }

    // 3. Remate estilo Super Smash Bros (destello + relámpago diagonal + líneas radiales + placa)
    if (this.koState.active) {
      const t = this.koState.elapsed;
      ctx.save();

      if (t < 0.34) {
        const flashP = 1 - t / 0.34;
        // Fondo negativo oscuro breve al instante del impacto (frames 0..0.14s)
        if (t < 0.14) {
          ctx.fillStyle = '#0c0806';
          ctx.globalAlpha = 0.55 * (1 - t / 0.14);
          ctx.fillRect(0, 0, width, height);
        }

        // Líneas radiales de impacto estilo anime/Smash
        const cx = width * 0.5;
        const cy = height * 0.5;
        ctx.strokeStyle = this.koState.flashColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.78 * flashP;
        for (let i = 0; i < 12; i++) {
          const ang = (Math.PI * 2 * i) / 12 + 0.15;
          const rIn = Math.min(width, height) * 0.22;
          const rOut = Math.max(width, height) * 0.65;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * rIn, cy + Math.sin(ang) * rIn);
          ctx.lineTo(cx + Math.cos(ang) * rOut, cy + Math.sin(ang) * rOut);
          ctx.stroke();
        }

        // Haz relámpago diagonal bicolor cruzando la pantalla en el ángulo del golpe
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.koState.angle);
        ctx.globalAlpha = 0.92 * flashP;
        ctx.fillStyle = this.koState.color;
        ctx.fillRect(-width, -9, width * 2, 18);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-width, -3, width * 2, 6);
        ctx.restore();
      }

      if (t < 1.15) {
        const bannerAlpha = t < 0.85 ? 1 : Math.max(0, 1 - (t - 0.85) / 0.30);
        ctx.globalAlpha = bannerAlpha;
        const bw = Math.min(270, width - 32);
        const bx = Math.round((width - bw) * 0.5);
        const by = Math.round(height * 0.16);
        ctx.fillStyle = 'rgba(18, 12, 9, 0.90)';
        ctx.fillRect(bx, by, bw, 32);
        ctx.strokeStyle = this.koState.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, 32);
        ctx.fillStyle = this.koState.flashColor;
        ctx.textAlign = 'center';
        ctx.font = '900 10px Outfit, sans-serif';
        ctx.fillText(this.koState.isBoss ? '¡SELLO QUEBRADO!' : '¡GOLPE DECISIVO!', width * 0.5, by + 13);
        ctx.fillStyle = '#fffbeb';
        ctx.font = '900 12px Outfit, sans-serif';
        ctx.fillText(this.koState.enemyName, width * 0.5, by + 26);
      }

      ctx.restore();
    }
  }
}
