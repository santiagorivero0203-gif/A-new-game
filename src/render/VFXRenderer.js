/**
 * @module VFXRenderer
 * @description Sistema integral de efectos visuales (VFX) procedimentales AAA y partículas dinámicas (v3.1).
 * Optimizado para 60/120 FPS estables con cero micro-tirones:
 * - Object Pooling Zero-GC (`_particlePool` y `_effectPool`) + remoción `O(1)` swap-and-pop (cero `Array.splice`).
 * - Sprite de proyectil ígneo pre-horneado en `<canvas>` offscreen (`_getFireballSprite`) para evitar
 *   `createRadialGradient` en cada fotograma.
 * - Soporte visual completo para las 18 habilidades del Árbol (`isWhirlwind`, `isMagmaZone`,
 *   `isPhantomStep`, `aegis_nova`, `plasma_pulse` y ventana dinámica de `parry_window`).
 * @author Be a Legend Team
 * @version 3.1.0
 */
export class VFXRenderer {
  constructor() {
    /** @type {Array<Object>} Partículas luminosas activas en el mundo */
    this.particles = [];

    /** @private Pool reutilizable de objetos partícula (evita presión en el Garbage Collector) */
    this._particlePool = [];

    /** @type {Array<Object>} Efectos de impacto, cortes cruzados y ondas expansivas */
    this.effects = [];

    /** @private Pool reutilizable de efectos de impacto */
    this._effectPool = [];

    /** @private Textura pre-horneada de Bola de Fuego (38x38) */
    this._fireballCanvas = null;

    /** @type {Array<Object>} Orbes elementales animados durante la secuencia de salida de la cueva */
    this.introOrbs = [];

    /** @type {number} Reloj interno acumulado para oscilaciones */
    this.time = 0;
  }

  /**
   * Actualiza la lista de orbes elementales visibles durante la secuencia inicial in-engine.
   * @param {Array<Object>} orbs
   */
  setIntroOrbs(orbs) {
    this.introOrbs = Array.isArray(orbs) ? orbs : [];
  }

  /**
   * Obtiene o pre-hornea una única vez la textura luminosa de Bola de Fuego en memoria.
   * Elimina llamadas repetidas a `ctx.createRadialGradient` durante ráfagas de `ember_fan`.
   * @private
   * @returns {HTMLCanvasElement|null}
   */
  _getFireballSprite() {
    if (this._fireballCanvas) return this._fireballCanvas;
    if (typeof document === 'undefined') return null;

    const size = 38;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const gctx = c.getContext('2d');
    if (!gctx) return null;

    const half = size / 2;
    const grad = gctx.createRadialGradient(half, half, 2, half, half, half - 1);
    grad.addColorStop(0, '#fffbeb');
    grad.addColorStop(0.35, '#f59e0b');
    grad.addColorStop(0.75, '#ea580c');
    grad.addColorStop(1, 'rgba(220, 38, 38, 0)');

    gctx.fillStyle = grad;
    gctx.beginPath();
    gctx.arc(half, half, half - 1, 0, Math.PI * 2);
    gctx.fill();

    gctx.fillStyle = '#ffffff';
    gctx.beginPath();
    gctx.arc(half, half, 4.4, 0, Math.PI * 2);
    gctx.fill();

    this._fireballCanvas = c;
    return c;
  }

  /**
   * Agrega una partícula dinámica reciclando instancias del pool Zero-GC.
   * @param {Object} p
   */
  addParticle(p) {
    if (this.particles.length >= 48) return; // Límite estricto Pixel-Art para 60/120 FPS constantes
    const inst = this._particlePool.length > 0 ? this._particlePool.pop() : {};
    inst.x = p.x;
    inst.y = p.y;
    inst.vx = p.vx || 0;
    inst.vy = p.vy || 0;
    inst.size = p.size || 3;
    inst.maxLife = p.life || 0.4;
    inst.life = inst.maxLife;
    inst.color = p.color || '#fb923c';
    inst.decay = p.decay || 1;
    inst.type = p.type || 'circle';
    this.particles.push(inst);
  }

  /**
   * Instancia un efecto de impacto localizado y emite chispas secundarias según su tipo.
   * @param {string} type - 'slash_hit'|'parry_spark'|'aegis_nova'|'plasma_pulse'|'fire_burst'|'wood_explosion'|'shield_clash'|'earth_root'|'dash_dust'
   * @param {number} x
   * @param {number} y
   * @param {Object} [options]
   */
  spawnImpact(type, x, y, options = {}) {
    const fx = this._effectPool.length > 0 ? this._effectPool.pop() : {};
    fx.type = type;
    fx.x = x;
    fx.y = y;
    fx.timer = 0;
    fx.duration = options.duration || 0.30;
    fx.radius = options.radius || 24;
    fx.color = options.color || '#fb923c';
    fx.angle = options.angle ?? (Math.random() * Math.PI);
    fx.isFinisher = !!options.isFinisher;
    this.effects.push(fx);

    // Emitir micro-ráfaga de partículas coherente con el impacto
    if (type === 'slash_hit') {
      const count = options.isFinisher ? 10 : 5;
      const baseAng = options.angle || 0;
      for (let i = 0; i < count; i++) {
        const spread = baseAng + (Math.random() - 0.5) * 1.4;
        const spd = 70 + Math.random() * 110;
        this.addParticle({
          x,
          y,
          vx: Math.cos(spread) * spd,
          vy: Math.sin(spread) * spd,
          size: options.isFinisher ? 3.5 : 2.5,
          life: 0.24,
          color: options.isFinisher ? '#fde047' : '#e0f2fe'
        });
      }
    } else if (type === 'parry_spark') {
      for (let i = 0; i < 12; i++) {
        const ang = (Math.PI * 2 * i) / 12;
        const spd = 85 + Math.random() * 75;
        this.addParticle({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 3.2,
          life: 0.32,
          color: i % 2 === 0 ? '#fde047' : '#ffffff'
        });
      }
    } else if (type === 'wood_explosion') {
      for (let i = 0; i < 16; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 130;
        this.addParticle({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 4,
          life: 0.42,
          color: i % 3 === 0 ? '#4ade80' : (i % 2 === 0 ? '#fb923c' : '#fde047')
        });
      }
    } else if (type === 'dash_dust') {
      for (let i = 0; i < 5; i++) {
        this.addParticle({
          x: x + (Math.random() * 10 - 5),
          y: y + (Math.random() * 6 - 3),
          vx: (Math.random() - 0.5) * 45,
          vy: -10 - Math.random() * 25,
          size: 3,
          life: 0.25,
          color: '#cbd5e1'
        });
      }
    } else if (type === 'aegis_nova') {
      for (let i = 0; i < 14; i++) {
        const ang = (Math.PI * 2 * i) / 14;
        const spd = 95 + Math.random() * 65;
        this.addParticle({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 3.6,
          life: 0.36,
          color: i % 2 === 0 ? '#facc15' : '#38bdf8'
        });
      }
    } else if (type === 'plasma_pulse') {
      for (let i = 0; i < 10; i++) {
        const ang = (Math.PI * 2 * i) / 10;
        const spd = 80 + Math.random() * 60;
        this.addParticle({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 3.2,
          life: 0.28,
          color: i % 2 === 0 ? '#38bdf8' : '#e0f2fe'
        });
      }
    } else if (type === 'ether_arc' || type === 'ether_burst') {
      const count = type === 'ether_burst' ? 14 : 8;
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count;
        const spd = (type === 'ether_burst' ? 90 : 60) + Math.random() * 55;
        this.addParticle({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 3.2,
          life: 0.30,
          color: i % 2 === 0 ? '#c084fc' : '#38bdf8'
        });
      }
    } else if (type === 'core_awakening') {
      for (let i = 0; i < 18; i++) {
        const ang = (Math.PI * 2 * i) / 18;
        const spd = 45 + Math.random() * 85;
        this.addParticle({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 26,
          size: 3.5,
          life: 0.55,
          color: i % 2 === 0 ? (options.color || '#fb923c') : '#fef08a'
        });
      }
    }
  }

  /**
   * Dispara la animación luminosa de ritual al despertar un Núcleo Elemental.
   * @param {number} x
   * @param {number} y
   * @param {string} [color='#fb923c']
   */
  spawnCoreAwakening(x, y, color = '#fb923c') {
    this.spawnImpact('core_awakening', x, y, { radius: 84, duration: 1.05, color });
  }

  /**
   * Emite un haz cometa visual entre un interruptor resuelto y la compuerta/portal que desbloquea.
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @param {string} [color='#38bdf8']
   */
  spawnLogicBeam(x1, y1, x2, y2, color = '#38bdf8') {
    const fx = this._effectPool.length > 0 ? this._effectPool.pop() : {};
    fx.type = 'logic_beam';
    fx.x = x1;
    fx.y = y1;
    fx.targetX = x2;
    fx.targetY = y2;
    fx.timer = 0;
    fx.duration = 0.65;
    fx.radius = 12;
    fx.color = color;
    fx.angle = 0;
    fx.isFinisher = false;
    this.effects.push(fx);
  }

  /**
   * Actualiza partículas, efectos de impacto y estelas continuas de proyectiles en O(1) swap-and-pop.
   * @param {number} dt
   * @param {Array<Object>} activeAttacks
   */
  update(dt, activeAttacks = []) {
    this.time += dt;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt * p.decay;
      if (p.life <= 0) {
        this._particlePool.push(p);
        const lastIdx = this.particles.length - 1;
        if (i !== lastIdx) {
          this.particles[i] = this.particles[lastIdx];
        }
        this.particles.pop();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.timer += dt;
      if (fx.timer >= fx.duration) {
        this._effectPool.push(fx);
        const lastIdx = this.effects.length - 1;
        if (i !== lastIdx) {
          this.effects[i] = this.effects[lastIdx];
        }
        this.effects.pop();
      }
    }

    if (activeAttacks) {
      for (let i = 0; i < activeAttacks.length; i++) {
        const atk = activeAttacks[i];
        if (atk.isReflected && atk.x !== undefined) {
          this.addParticle({
            x: atk.x + (Math.random() * 6 - 3),
            y: atk.y + (Math.random() * 6 - 3),
            vx: (Math.random() - 0.5) * 25,
            vy: (Math.random() - 0.5) * 25,
            size: 3.5,
            life: 0.25,
            color: '#fde047'
          });
        } else if (atk.isBladeWave && atk.x !== undefined && Math.random() < 0.65) {
          this.addParticle({
            x: atk.x + (Math.random() * 12 - 6),
            y: atk.y + (Math.random() * 12 - 6),
            vx: 0,
            vy: 0,
            size: 2.8,
            life: 0.20,
            color: '#38bdf8'
          });
        } else if (atk.isMagmaZone && Math.random() < 0.35) {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() * (atk.radius || 70);
          this.addParticle({
            x: (atk.originX || 0) + Math.cos(ang) * dist,
            y: (atk.originY || 0) + Math.sin(ang) * dist,
            vx: (Math.random() - 0.5) * 14,
            vy: -18 - Math.random() * 22,
            size: 3,
            life: 0.32,
            color: Math.random() > 0.45 ? '#fb923c' : '#fde047'
          });
        } else if (atk.isSingularityZone && Math.random() < 0.4) {
          const ang = Math.random() * Math.PI * 2;
          const dist = (atk.radius || 96) * 0.85;
          this.addParticle({
            x: (atk.originX || 0) + Math.cos(ang) * dist,
            y: (atk.originY || 0) + Math.sin(ang) * dist,
            vx: -Math.cos(ang) * 95,
            vy: -Math.sin(ang) * 95,
            size: 3,
            life: 0.35,
            color: Math.random() > 0.45 ? '#c084fc' : '#38bdf8'
          });
        } else if (atk.isPhantomStep && atk.owner && Math.random() < 0.65) {
          this.addParticle({
            x: atk.owner.pos.x + 16 + (Math.random() * 14 - 7),
            y: atk.owner.pos.y + 16 + (Math.random() * 14 - 7),
            vx: (Math.random() - 0.5) * 35,
            vy: (Math.random() - 0.5) * 35,
            size: 2.8,
            life: 0.22,
            color: '#38bdf8'
          });
        } else if (atk.element === 'fuego' && atk.type === 'weak' && atk.x !== undefined) {
          if (Math.random() < 0.55) {
            this.addParticle({
              x: atk.x + (Math.random() * 8 - 4),
              y: atk.y + (Math.random() * 8 - 4),
              vx: (Math.random() - 0.5) * 30,
              vy: (Math.random() - 0.5) * 30,
              size: Math.random() * 2.8 + 1.8,
              life: 0.24,
              color: Math.random() > 0.4 ? '#f97316' : '#facc15'
            });
          }
        }
      }
    }

    if (this.introOrbs && this.introOrbs.length > 0) {
      for (let i = 0; i < this.introOrbs.length; i++) {
        const orb = this.introOrbs[i];
        if (!orb || Math.random() >= 0.72) continue;
        this.addParticle({
          x: orb.x + (Math.random() * 6 - 3),
          y: orb.y + (Math.random() * 6 - 3),
          vx: (Math.random() - 0.5) * 18,
          vy: (Math.random() - 0.5) * 18,
          size: 3,
          life: 0.28,
          color: orb.color || '#fb923c'
        });
      }
    }
  }

  /**
   * Renderiza todos los ataques activos, escudos, auras y partículas en coordenadas de mundo.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<Object>} activeAttacks
   * @param {import('../entities/Player.js').Player} player
   */
  render(ctx, activeAttacks = [], player = null) {
    ctx.save();

    if (activeAttacks) {
      for (const atk of activeAttacks) {
        this._renderAttack(ctx, atk);
      }
    }

    if (player && player.fsmState === 'STATE_DEFEND') {
      this._renderShieldBarrier(ctx, player);
    }

    if (player && (player.healTimer > 0 || (typeof player.hasTag === 'function' && player.hasTag('vitality_shield')))) {
      this._renderHealAura(ctx, player);
    }

    for (const fx of this.effects) {
      this._renderEffect(ctx, fx);
    }

    if (this.introOrbs && this.introOrbs.length > 0) {
      this._renderIntroOrbs(ctx);
    }

    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const sz = Math.max(1, Math.round(p.size * alpha));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
    }
    ctx.globalAlpha = 1.0;

    ctx.restore();
  }

  /**
   * Renderiza los 4 Orbes Elementales de la secuencia inicial con núcleo blanco, halo pixel-art y estela.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   */
  _renderIntroOrbs(ctx) {
    ctx.save();
    for (let i = 0; i < this.introOrbs.length; i++) {
      const orb = this.introOrbs[i];
      if (!orb) continue;
      const ox = Math.round(orb.x);
      const oy = Math.round(orb.y);
      const r = Math.max(4, Math.round(orb.radius || 7));
      const color = orb.color || '#fb923c';

      if (Array.isArray(orb.trail)) {
        for (let t = 0; t < orb.trail.length; t++) {
          const pt = orb.trail[t];
          const ratio = (t + 1) / (orb.trail.length + 1);
          const sz = Math.max(2, Math.round(r * ratio));
          ctx.globalAlpha = ratio * 0.55;
          ctx.fillStyle = color;
          ctx.fillRect(Math.round(pt.x - sz * 0.5), Math.round(pt.y - sz * 0.5), sz, sz);
        }
      }

      // Halo exterior pixelado
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = color;
      ctx.fillRect(ox - r, oy - r + 1, r * 2, (r - 1) * 2);
      ctx.fillRect(ox - r + 1, oy - r, (r - 1) * 2, r * 2);

      // Núcleo saturado y centro blanco luminoso
      ctx.globalAlpha = 0.95;
      const inner = Math.max(2, Math.round(r * 0.65));
      ctx.fillStyle = color;
      ctx.fillRect(ox - inner, oy - inner, inner * 2, inner * 2);
      ctx.fillStyle = '#ffffff';
      const core = Math.max(2, Math.round(r * 0.35));
      ctx.fillRect(ox - Math.floor(core * 0.5), oy - Math.floor(core * 0.5), core, core);
    }
    ctx.restore();
  }

  /**
   * Emite partículas ambientales Zero-GC dentro del viewport de cámara según el clima del Bioma.
   * Reutiliza un descriptor en caché y el Pool interno `_particlePool` sin alocar basura en memoria.
   * @param {number} dt - Delta time en segundos.
   * @param {import('./Camera.js').Camera|null} camera - Cámara activa para acotar la región visible.
   * @param {'pollen'|'spores'|'embers'|'stardust'|string} [weatherKey='pollen'] - Tipo de clima ambiental.
   */
  updateBiomeWeather(dt, camera, weatherKey = 'pollen') {
    if (!camera || typeof camera.getVisibleWorldBounds !== 'function') return;
    if (this.particles.length > 16) return;

    this._weatherAcc = (this._weatherAcc || 0) + dt;
    const spawnInterval = 0.28;
    if (this._weatherAcc < spawnInterval) return;
    this._weatherAcc -= spawnInterval;

    if (!this._weatherScratch) {
      this._weatherScratch = { x: 0, y: 0, vx: 0, vy: 0, color: '#fef08a', size: 2.5, life: 2.2 };
    }

    const b = camera.getVisibleWorldBounds(48);
    const spanW = Math.max(64, b.maxX - b.minX);
    const spanH = Math.max(64, b.maxY - b.minY);
    const p = this._weatherScratch;

    p.x = b.minX + Math.random() * spanW;
    p.y = b.minY + Math.random() * spanH;

    if (weatherKey === 'spores') {
      p.vx = (Math.random() - 0.5) * 14;
      p.vy = -8 - Math.random() * 14;
      p.color = Math.random() > 0.45 ? '#5eead4' : '#c084fc';
      p.size = 2.6 + Math.random() * 1.4;
      p.life = 2.4;
    } else if (weatherKey === 'embers' || weatherKey === 'ash') {
      p.vx = (Math.random() - 0.35) * 24;
      p.vy = -26 - Math.random() * 28;
      p.color = Math.random() > 0.35 ? '#fb923c' : '#fde047';
      p.size = 2.2 + Math.random() * 1.6;
      p.life = 1.6;
    } else if (weatherKey === 'stardust' || weatherKey === 'astral') {
      p.vx = (Math.random() - 0.5) * 10;
      p.vy = (Math.random() - 0.5) * 10;
      const r = Math.random();
      p.color = r > 0.66 ? '#38bdf8' : (r > 0.33 ? '#e879f9' : '#fef9c3');
      p.size = 2.4 + Math.random() * 1.3;
      p.life = 2.1;
    } else {
      // 'pollen' (Claro de las Reliquias)
      p.vx = 9 + Math.random() * 12;
      p.vy = 5 + Math.random() * 9;
      p.color = Math.random() > 0.35 ? '#fef08a' : '#bef264';
      p.size = 2.1 + Math.random() * 1.1;
      p.life = 2.6;
    }

    this.addParticle(p);
  }

  /**
   * Despacha el renderizado específico según la naturaleza del ataque o proyectil.
   * @private
   */
  _renderAttack(ctx, atk) {
    // 1. Onda de Filo Sagrado (3er golpe potenciado)
    if (atk.isBladeWave) {
      this._renderBladeWave(ctx, atk);
      return;
    }

    // 2. Proyectil Enemigo o Cometa Reflejado por Parry Deportivo
    if (atk.type === 'projectile' || atk.isReflected) {
      this._renderOrbProjectile(ctx, atk);
      return;
    }

    // 3. Tajos del Combo Rítmico de Espada, Torbellino 360° y Dash-Strike (excluye novas radiales de sinergia)
    if (atk.element === 'physical' && atk.isSweep && !atk.isFriendlySynergy) {
      this._renderSwordSweep(ctx, atk);
      return;
    }

    // 4. Habilidades Elementales del Jugador
    if (atk.element === 'fuego') {
      if (atk.isMagmaZone) {
        const cx = atk.originX ?? (atk.hitbox.x + atk.hitbox.width / 2);
        const cy = atk.originY ?? (atk.hitbox.y + atk.hitbox.height / 2);
        const r = atk.radius || 72;
        const lifeRatio = Math.min(1, atk.duration / 0.5);
        const pulse = Math.sin(this.time * 10) * 3;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(234, 88, 12, ${0.18 * lifeRatio})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r + pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(251, 146, 60, ${0.72 * lifeRatio})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(253, 224, 71, ${0.52 * lifeRatio})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.66 - pulse * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (atk.type === 'weak' && atk.x !== undefined) {
        const px = atk.x;
        const py = atk.y;
        const scale = atk.isSideOrb ? 0.84 : 1.0;
        const r = (16 + Math.sin(this.time * 22) * 1.8) * scale;
        const fbSprite = this._getFireballSprite();

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (fbSprite) {
          ctx.drawImage(fbSprite, px - r, py - r, r * 2, r * 2);
        } else {
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(px, py, r * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (atk.type === 'strong') {
        const hit = atk.hitbox;
        if (!hit) return;
        const cx = hit.x + hit.width / 2;
        const cy = hit.y + hit.height / 2;
        const maxR = hit.width / 2;
        const progress = 1 - Math.max(0, atk.duration / 0.42);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(249, 115, 22, ${1 - progress})`;
        ctx.lineWidth = 7 * (1 - progress);
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * progress, 0, Math.PI * 2);
        ctx.stroke();

        const flameCount = 12;
        for (let i = 0; i < flameCount; i++) {
          const angle = (i * (Math.PI * 2 / flameCount)) + (this.time * 5);
          const r = maxR * progress;
          const fx = cx + Math.cos(angle) * r;
          const fy = cy + Math.sin(angle) * r;
          ctx.fillStyle = i % 2 === 0 ? '#facc15' : '#ef4444';
          ctx.beginPath();
          ctx.arc(fx, fy, 6.5 * (1 - progress), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    } else if (atk.element === 'kinetic') {
      const owner = atk.owner;
      if (!owner) return;
      const cx = owner.pos.x + owner.width / 2;
      const cy = owner.pos.y + owner.height / 2;

      if (atk.isPhantomStep) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(cx, cy, 20 + Math.sin(this.time * 36) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (atk.type === 'weak') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3.2;

        const dir = atk.chargeDir || { x: 1, y: 0 };
        const angle = Math.atan2(dir.y, dir.x);

        ctx.beginPath();
        ctx.arc(cx + dir.x * 12, cy + dir.y * 12, 24, angle - Math.PI / 3, angle + Math.PI / 3);
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(cx + dir.x * 16, cy + dir.y * 16, 18, angle - Math.PI / 4, angle + Math.PI / 4);
        ctx.stroke();
        ctx.restore();
      } else if (atk.type === 'strong') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.8;

        for (let i = 0; i < 4; i++) {
          const r = 16 + i * 7;
          const offset = (this.time * 32 + i * 1.8) % (Math.PI * 2);
          ctx.beginPath();
          ctx.arc(cx, cy, r, offset, offset + Math.PI * 1.1);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (atk.element === 'plantas' || atk.element === 'tierra') {
      if (atk.type === 'weak') {
        const hit = atk.hitbox;
        const owner = atk.owner;
        if (!hit || !owner) return;

        const ox = owner.pos.x + owner.width / 2;
        const oy = owner.pos.y + owner.height / 2;
        const tx = hit.x + hit.width / 2;
        const ty = hit.y + hit.height / 2;

        ctx.save();
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(ox, oy);
        const midX1 = (ox + tx) / 2 + Math.sin(this.time * 30) * 12;
        const midY1 = (oy + ty) / 2 + Math.cos(this.time * 30) * 12;
        ctx.quadraticCurveTo(midX1, midY1, tx, ty);
        ctx.stroke();

        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        const midX2 = (ox + tx) / 2 - Math.sin(this.time * 30) * 8;
        const midY2 = (oy + ty) / 2 - Math.cos(this.time * 30) * 8;
        ctx.quadraticCurveTo(midX2, midY2, tx, ty);
        ctx.stroke();

        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(tx, ty, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (atk.type === 'strong') {
        const hit = atk.hitbox;
        if (!hit) return;
        const cx = hit.x + hit.width / 2;
        const cy = hit.y + hit.height / 2;
        const radius = hit.width / 2;
        const progress = 1 - Math.max(0, atk.duration / 0.50);

        ctx.save();
        ctx.strokeStyle = `rgba(34, 197, 94, ${1 - progress * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * (0.4 + progress * 0.6), 0, Math.PI * 2);
        ctx.stroke();

        const rootCount = 8;
        for (let i = 0; i < rootCount; i++) {
          const angle = (i * (Math.PI * 2 / rootCount)) + 0.2;
          const r = radius * 0.78 * Math.min(1, progress * 1.4);
          const rx = cx + Math.cos(angle) * r;
          const ry = cy + Math.sin(angle) * r;

          ctx.fillStyle = '#14532d';
          ctx.beginPath();
          ctx.arc(rx, ry, 6.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#4ade80';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(rx, ry, 8.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (atk.element === 'eter') {
      if (atk.isPolarityPulse) {
        const ox = atk.originX || (atk.hitbox ? atk.hitbox.x + atk.hitbox.width / 2 : 0);
        const oy = atk.originY || (atk.hitbox ? atk.hitbox.y + atk.hitbox.height / 2 : 0);
        const progress = 1 - Math.max(0, atk.duration / (atk.maxDuration || 0.22));
        const alpha = 1 - progress;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(192, 132, 252, ${alpha})`;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(ox, oy, 18 + progress * 24, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.9})`;
        ctx.lineWidth = 2;
        for (let b = 0; b < 4; b++) {
          const ang = (atk.aimAngle || 0) + (b - 1.5) * 0.45;
          const rEnd = 22 + progress * 22;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + Math.cos(ang + 0.15) * (rEnd * 0.5), oy + Math.sin(ang + 0.15) * (rEnd * 0.5));
          ctx.lineTo(ox + Math.cos(ang) * rEnd, oy + Math.sin(ang) * rEnd);
          ctx.stroke();
        }
        ctx.restore();
      } else if (atk.isSingularityZone) {
        const cx = atk.originX ?? (atk.hitbox.x + atk.hitbox.width / 2);
        const cy = atk.originY ?? (atk.hitbox.y + atk.hitbox.height / 2);
        const r = atk.radius || 96;
        const lifeRatio = Math.min(1, atk.duration / 0.45);
        const spin = this.time * 6;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(168, 85, 247, ${0.16 * lifeRatio})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(192, 132, 252, ${0.8 * lifeRatio})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.85, spin, spin + Math.PI * 1.45);
        ctx.stroke();

        ctx.strokeStyle = `rgba(56, 189, 248, ${0.75 * lifeRatio})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.52, -spin * 1.4, -spin * 1.4 + Math.PI * 1.4);
        ctx.stroke();

        ctx.fillStyle = '#f5d0fe';
        ctx.beginPath();
        ctx.arc(cx, cy, 6 + Math.sin(this.time * 14) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /**
   * Renderiza los orbes proyectil del Artillero Ágil y su versión dorada al ser devueltos con Parry.
   * @private
   */
  _renderOrbProjectile(ctx, atk) {
    const px = atk.x ?? (atk.hitbox.x + atk.hitbox.width / 2);
    const py = atk.y ?? (atk.hitbox.y + atk.hitbox.height / 2);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (atk.isReflected) {
      // Cometa Dorado Supersónico devuelto por el jugador
      ctx.fillStyle = 'rgba(250, 204, 21, 0.55)';
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Orbe hostil claramente legible para facilitar el timing de Parry
      const isFire = atk.element === 'fuego';
      const outer = isFire ? 'rgba(239, 68, 68, 0.55)' : 'rgba(168, 85, 247, 0.55)';
      const ring = isFire ? '#fb923c' : '#4ade80';

      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(px, py, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = ring;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(px, py, 7.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Renderiza la Onda de Filo Sagrado disparada en el 3er golpe del combo.
   * @private
   */
  _renderBladeWave(ctx, atk) {
    const px = atk.x;
    const py = atk.y;
    const ang = atk.aimAngle || 0;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(px, py);
    ctx.rotate(ang);

    // Medialuna exterior dorada/celeste
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
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

    ctx.restore();
  }

  /**
   * Renderiza el barrido coreografiado de la espada según el paso del combo (1, 2, 3 o Dash-Strike).
   * @private
   */
  _renderSwordSweep(ctx, atk) {
    const owner = atk.owner;
    const ox = owner ? (owner.pos.x + owner.width / 2) : (atk.originX || (atk.hitbox.x + atk.hitbox.width / 2));
    const oy = owner ? (owner.pos.y + owner.height / 2) : (atk.originY || (atk.hitbox.y + atk.hitbox.height / 2));

    let baseAngle = atk.aimAngle;
    if (baseAngle === undefined) {
      const f = atk.facing || 'right';
      baseAngle = f === 'right' ? 0 : f === 'down' ? Math.PI / 2 : f === 'left' ? Math.PI : -Math.PI / 2;
    }

    const maxDur = atk.maxDuration || (atk.isFinisher ? 0.23 : 0.165);
    const progress = 1 - Math.max(0, Math.min(1, atk.duration / maxDur));
    const alpha = Math.sin(progress * Math.PI);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Variante Especial: DASH-STRIKE (Estocada Supersónica Perforante)
    if (atk.isDashStrike) {
      ctx.translate(ox, oy);
      ctx.rotate(baseAngle);

      const reach = 18 + progress * 32;
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.85})`;
      ctx.lineWidth = 9 * (1 - progress * 0.4);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(reach, 0);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(reach + 8, 0);
      ctx.stroke();

      // Anillo de compresión sónica
      ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(16, 0, 5, 14 * (0.6 + progress * 0.5), 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
      return;
    }

    // Variante Maestría: `whirlwind_finisher` (Tajo Astral 360° completo)
    if (atk.isWhirlwind) {
      const spin = baseAngle + progress * Math.PI * 2.1;
      const rOuter = 44 + progress * 24;
      const rInner = 30 + progress * 16;

      ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.72})`;
      ctx.lineWidth = 14 * (1 - progress * 0.25);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ox, oy, rOuter, spin, spin + Math.PI * 1.82);
      ctx.stroke();

      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.78})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(ox, oy, rInner, -spin, -spin + Math.PI * 1.65);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.arc(ox, oy, rOuter + 1, spin, spin + Math.PI * 1.82);
      ctx.stroke();

      ctx.restore();
      return;
    }

    // Combo 1 (Horario), Combo 2 (Antihorario Celeste), Combo 3 Finisher (Gran Medialuna Áurea 225°)
    const isFinisher = !!atk.isFinisher;
    const step = atk.comboStep || 1;
    const dir = atk.swingDir || 1;

    const sweepSpan = isFinisher ? Math.PI * 1.28 : (step === 2 ? Math.PI * 0.88 : Math.PI * 0.80);
    const halfSpan = sweepSpan / 2;
    const radius = (isFinisher ? 34 : 27) + progress * (isFinisher ? 18 : 13);

    const headProgress = Math.min(1, progress * 1.35);
    const tailProgress = Math.max(0, (progress - 0.25) * 1.1);

    let startAngle, endAngle;
    if (dir >= 0) {
      startAngle = baseAngle - halfSpan + tailProgress * sweepSpan * 0.45;
      endAngle = baseAngle - halfSpan + headProgress * sweepSpan;
    } else {
      endAngle = baseAngle + halfSpan - tailProgress * sweepSpan * 0.45;
      startAngle = baseAngle + halfSpan - headProgress * sweepSpan;
    }

    // 1. Estela exterior coloreada según golpe del combo
    const outerColor = isFinisher
      ? `rgba(250, 204, 21, ${alpha * 0.65})`
      : step === 2
        ? `rgba(56, 189, 248, ${alpha * 0.58})`
        : `rgba(224, 242, 254, ${alpha * 0.50})`;

    ctx.strokeStyle = outerColor;
    ctx.lineWidth = isFinisher ? 14 : 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ox, oy, radius - 2, startAngle, endAngle);
    ctx.stroke();

    // 2. Filo incandescente de acero puro
    ctx.strokeStyle = atk.isPerfectTempo || isFinisher
      ? `rgba(254, 249, 195, ${alpha})`
      : `rgba(255, 255, 255, ${alpha * 0.96})`;
    ctx.lineWidth = isFinisher ? 4.5 : 3.5;
    ctx.beginPath();
    ctx.arc(ox, oy, radius + 1, startAngle, endAngle);
    ctx.stroke();

    // 3. Destello estelar en la punta activa de la hoja
    const activeTipAngle = dir >= 0 ? endAngle : startAngle;
    const tipX = ox + Math.cos(activeTipAngle) * (radius + 1);
    const tipY = oy + Math.sin(activeTipAngle) * (radius + 1);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(tipX, tipY, isFinisher ? 5.5 : 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Renderiza la barrera hexagonal orientándola suavemente hacia `player.aimDir`.
   * @private
   */
  _renderShieldBarrier(ctx, player) {
    const cx = player.pos.x + player.width / 2;
    const cy = player.pos.y + player.height / 2;
    const isParryWindow = player.stateTimer <= (player.parryWindowDuration || 0.16);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const dist = 18;
    const ax = (player.aimDir && (player.aimDir.x !== 0 || player.aimDir.y !== 0))
      ? player.aimDir.x
      : (player.facing === 'right' ? 1 : player.facing === 'left' ? -1 : 0);
    const ay = (player.aimDir && (player.aimDir.x !== 0 || player.aimDir.y !== 0))
      ? player.aimDir.y
      : (player.facing === 'down' ? 1 : player.facing === 'up' ? -1 : 0);

    const sx = cx + ax * dist;
    const sy = cy + ay * dist;

    const shieldColor = isParryWindow ? '#facc15' : '#38bdf8';
    ctx.strokeStyle = shieldColor;
    ctx.lineWidth = isParryWindow ? 3 : 2;
    ctx.fillStyle = isParryWindow ? 'rgba(250, 204, 21, 0.32)' : 'rgba(56, 189, 248, 0.20)';

    ctx.beginPath();
    const sides = 6;
    const radius = isParryWindow ? 17 : 13.5;
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI / sides) - Math.PI / 6;
      const x = sx + radius * Math.cos(angle);
      const y = sy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Renderiza destellos de impacto, cortes cruzados y ondas expansivas.
   * @private
   */
  _renderEffect(ctx, fx) {
    const progress = fx.timer / fx.duration;
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (fx.type === 'slash_hit') {
      // Hit-Spark diagonal estilo Hades / Anime
      ctx.translate(fx.x, fx.y);
      ctx.rotate(fx.angle);
      const len = fx.radius * (0.6 + progress * 0.8);
      ctx.strokeStyle = fx.isFinisher ? `rgba(253, 224, 71, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = (fx.isFinisher ? 4 : 2.8) * alpha;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(len, 0);
      ctx.moveTo(0, -len * 0.45);
      ctx.lineTo(0, len * 0.45);
      ctx.stroke();
    } else if (fx.type === 'parry_spark') {
      ctx.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
      ctx.lineWidth = 3 * alpha;
      const r = fx.radius * (0.25 + progress * 0.85);
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Estrella central de 4 puntas
      const sLen = fx.radius * 0.8 * alpha;
      ctx.beginPath();
      ctx.moveTo(fx.x - sLen, fx.y);
      ctx.lineTo(fx.x + sLen, fx.y);
      ctx.moveTo(fx.x, fx.y - sLen);
      ctx.lineTo(fx.x, fx.y + sLen);
      ctx.stroke();
    } else if (fx.type === 'wood_explosion') {
      ctx.strokeStyle = `rgba(251, 146, 60, ${alpha})`;
      ctx.lineWidth = 5 * alpha;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius * progress, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(74, 222, 128, ${alpha * 0.45})`;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius * Math.sin(progress * Math.PI) * 0.75, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx.type === 'shield_clash') {
      ctx.strokeStyle = `rgba(147, 197, 253, ${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius * progress, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.type === 'earth_root') {
      ctx.strokeStyle = `rgba(74, 222, 128, ${alpha * 0.8})`;
      ctx.lineWidth = 3 * alpha;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius * progress, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.type === 'fire_burst') {
      ctx.fillStyle = `rgba(249, 115, 22, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius * Math.sin(progress * Math.PI), 0, Math.PI * 2);
      ctx.fill();
    } else if (fx.type === 'aegis_nova') {
      const r = fx.radius * (0.28 + progress * 0.78);
      ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.92})`;
      ctx.lineWidth = 5 * alpha;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.75})`;
      ctx.lineWidth = 2.5 * alpha;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.type === 'plasma_pulse') {
      const r = fx.radius * (0.25 + progress * 0.80);
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.95})`;
      ctx.lineWidth = 4.2 * alpha;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(186, 230, 253, ${alpha * 0.28})`;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r * 0.65, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx.type === 'ether_arc' || fx.type === 'ether_burst') {
      const r = fx.radius * (0.3 + progress * 0.78);
      ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.95})`;
      ctx.lineWidth = (fx.type === 'ether_burst' ? 4.5 : 2.8) * alpha;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.8})`;
      ctx.lineWidth = 2 * alpha;
      ctx.beginPath();
      ctx.moveTo(fx.x - r * 0.7, fx.y);
      ctx.lineTo(fx.x, fx.y - r * 0.35);
      ctx.lineTo(fx.x + r * 0.7, fx.y);
      ctx.stroke();
    } else if (fx.type === 'core_awakening') {
      const col = fx.color || '#fb923c';
      const r = fx.radius * (0.2 + progress * 0.85);
      ctx.globalAlpha = alpha * 0.75;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(fx.x - 14 * alpha), Math.round(fx.y - 160), Math.round(28 * alpha), 170);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3.5 * alpha;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.2 * alpha;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.type === 'logic_beam') {
      const bx = fx.x + ((fx.targetX ?? fx.x) - fx.x) * progress;
      const by = fx.y + ((fx.targetY ?? fx.y) - fx.y) * progress;
      ctx.strokeStyle = fx.color || '#38bdf8';
      ctx.globalAlpha = Math.sin(progress * Math.PI);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Renderiza el aura de curación esmeralda y el Escudo de Vitalidad activo.
   * @private
   */
  _renderHealAura(ctx, player) {
    const cx = player.pos.x + player.width / 2;
    const cy = player.pos.y + player.height / 2;
    const isHealing = player.healTimer > 0;
    const hasShield = typeof player.hasTag === 'function' && player.hasTag('vitality_shield');

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (isHealing) {
      const progress = player.healTimer / 0.85;
      const alpha = Math.sin(progress * Math.PI);

      ctx.strokeStyle = `rgba(74, 222, 128, ${alpha * 0.85})`;
      ctx.lineWidth = 3;
      ctx.fillStyle = `rgba(34, 197, 94, ${alpha * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const moteCount = 5;
      for (let i = 0; i < moteCount; i++) {
        const ang = (i * (Math.PI * 2 / moteCount)) + (this.time * 6);
        const r = 14 + Math.sin(this.time * 8 + i) * 4;
        const mx = cx + Math.cos(ang) * r;
        const my = (cy + 8) - ((1 - progress) * 28) + Math.sin(ang) * 4;

        ctx.fillStyle = i % 2 === 0 ? '#4ade80' : '#facc15';
        ctx.beginPath();
        ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (hasShield) {
      const pulse = Math.sin(this.time * 6) * 2;
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.72)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 20 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 24 - pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
