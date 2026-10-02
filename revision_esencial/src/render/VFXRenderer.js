/**
 * @module VFXRenderer
 * @description Sistema integral de efectos visuales (VFX) procedimentales y partículas dinámicas.
 * Renderiza animaciones fluidas y sprites procedimentales de alta fidelidad para:
 * - 🔥 Fuego: Bolas de Ceniza incandescentes con estela de chispas y Erupción Cíclica radial.
 * - ⚡ Cinético: Distorsión de viento, arcos eléctricos y cono de plasma del Taladro Humano.
 * - 🌿 Tierra: Látigo de enredaderas espinosas con hojas y Prisión del Bosque envolvente.
 * - 🛡️ Defensa: Barrera hexagonal y destello estelar dorado en Parry Perfecto.
 * - 💨 Físico: Estelas de Dash, chispas de impacto de espada y ráfagas de polvo.
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class VFXRenderer {
  constructor() {
    /** @type {Array<Object>} Partículas activas en el mundo */
    this.particles = [];

    /** @type {Array<Object>} Efectos temporales de área o impacto */
    this.effects = [];

    /** @type {number} Tiempo acumulado para animaciones sinusoidales */
    this.time = 0;
  }

  /**
   * Agrega una partícula genérica al sistema.
   * @param {Object} p - Propiedades de la partícula
   */
  addParticle(p) {
    this.particles.push({
      x: p.x,
      y: p.y,
      vx: p.vx || 0,
      vy: p.vy || 0,
      size: p.size || 3,
      maxLife: p.life || 0.4,
      life: p.life || 0.4,
      color: p.color || '#fb923c',
      decay: p.decay || 1,
      type: p.type || 'circle'
    });
  }

  /**
   * Agrega un efecto de impacto o explosión en coordenadas de mundo.
   * @param {string} type - 'fire_burst', 'parry_spark', 'earth_root', 'dash_dust'
   * @param {number} x
   * @param {number} y
   * @param {Object} [options]
   */
  spawnImpact(type, x, y, options = {}) {
    this.effects.push({
      type,
      x,
      y,
      timer: 0,
      duration: options.duration || 0.35,
      radius: options.radius || 24,
      color: options.color || '#fb923c',
      options
    });
  }

  /**
   * Actualiza la física de las partículas y el ciclo de vida de los efectos.
   * @param {number} dt - Delta time en segundos
   * @param {Array<Object>} activeAttacks - Ataques en curso de CombatManager
   */
  update(dt, activeAttacks = []) {
    this.time += dt;

    // 1. Actualizar partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt * p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // 2. Actualizar efectos especiales
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.timer += dt;
      if (fx.timer >= fx.duration) {
        this.effects.splice(i, 1);
      }
    }

    // 3. Emisión continua de partículas desde ataques activos
    if (activeAttacks) {
      for (const atk of activeAttacks) {
        if (atk.element === 'fuego' && atk.type === 'weak') {
          // Estela de brasas incandescentes tras la bola de fuego
          if (Math.random() < 0.65) {
            this.addParticle({
              x: atk.x + (Math.random() * 8 - 4),
              y: atk.y + (Math.random() * 8 - 4),
              vx: (Math.random() - 0.5) * 30,
              vy: (Math.random() - 0.5) * 30,
              size: Math.random() * 3 + 2,
              life: 0.3,
              color: Math.random() > 0.4 ? '#f97316' : '#facc15'
            });
          }
        }
      }
    }
  }

  /**
   * Dibuja todos los efectos visuales, proyectiles y partículas en el canvas del mundo.
   * Se ejecuta con la transformación de la cámara aplicada.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<Object>} activeAttacks - Ataques activos de CombatManager
   * @param {import('../entities/Player.js').Player} player - Referencia al jugador
   */
  render(ctx, activeAttacks = [], player = null) {
    ctx.save();

    // 1. Renderizar Ataques Activos (Proyectiles y AoEs)
    if (activeAttacks) {
      for (const atk of activeAttacks) {
        this._renderAttack(ctx, atk);
      }
    }

    // 2. Renderizar Escudo de Bloqueo del Jugador si está defendiendo
    if (player && player.fsmState === 'STATE_DEFEND') {
      this._renderShieldBarrier(ctx, player);
    }

    // 2.1 Renderizar Aura de Curación / Escudo de Vitalidad del Jugador
    if (player && (player.healTimer > 0 || (typeof player.hasTag === 'function' && player.hasTag('vitality_shield')))) {
      this._renderHealAura(ctx, player);
    }

    // 3. Renderizar Efectos de Impacto y Explosiones
    for (const fx of this.effects) {
      this._renderEffect(ctx, fx);
    }

    // 4. Renderizar Partículas con Blending Aditivo para máxima luminosidad
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    ctx.restore();
  }

  /**
   * Renderiza un ataque activo específico según su elemento y tipo.
   * @private
   */
  _renderAttack(ctx, atk) {
    if (atk.element === 'physical' && atk.type === 'weak') {
      this._renderSwordSweep(ctx, atk);
      return;
    }

    if (atk.element === 'fuego') {
      if (atk.type === 'weak') {
        // 🔥 Bola de Ceniza / Fuego (Proyectil Procedimental)
        const px = atk.x;
        const py = atk.y;
        const pulse = Math.sin(this.time * 20) * 2;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const grad = ctx.createRadialGradient(px, py, 2, px, py, 14 + pulse);
        grad.addColorStop(0, '#fffbeb');
        grad.addColorStop(0.3, '#f59e0b');
        grad.addColorStop(0.7, '#ea580c');
        grad.addColorStop(1, 'rgba(220, 38, 38, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, 14 + pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (atk.type === 'strong') {
        // 🔥 Erupción Cíclica (AoE Radial Explosivo)
        const hit = atk.hitbox;
        if (!hit) return;
        const cx = hit.x + hit.width / 2;
        const cy = hit.y + hit.height / 2;
        const maxR = hit.width / 2;
        const progress = 1 - Math.max(0, atk.duration / 0.5);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        ctx.strokeStyle = `rgba(249, 115, 22, ${1 - progress})`;
        ctx.lineWidth = 6 * (1 - progress);
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * progress, 0, Math.PI * 2);
        ctx.stroke();

        const flameCount = 10;
        for (let i = 0; i < flameCount; i++) {
          const angle = (i * (Math.PI * 2 / flameCount)) + (this.time * 4);
          const r = maxR * progress;
          const fx = cx + Math.cos(angle) * r;
          const fy = cy + Math.sin(angle) * r;

          ctx.fillStyle = i % 2 === 0 ? '#facc15' : '#ef4444';
          ctx.beginPath();
          ctx.arc(fx, fy, 6 * (1 - progress), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

    } else if (atk.element === 'kinetic') {
      const owner = atk.owner;
      if (!owner) return;
      const cx = owner.pos.x + owner.width / 2;
      const cy = owner.pos.y + owner.height / 2;

      if (atk.type === 'weak') {
        // ⚡ Onda Sónica Frontal de Embestida (Dash Shockwave)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;

        const dir = atk.chargeDir || { x: owner.facing === 'right' ? 1 : owner.facing === 'left' ? -1 : 0, y: owner.facing === 'down' ? 1 : owner.facing === 'up' ? -1 : 0 };
        const angle = Math.atan2(dir.y, dir.x);

        // Cono de choque frente al cuerpo del jugador
        ctx.beginPath();
        ctx.arc(cx + dir.x * 12, cy + dir.y * 12, 24, angle - Math.PI / 3, angle + Math.PI / 3);
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + dir.x * 16, cy + dir.y * 16, 18, angle - Math.PI / 4, angle + Math.PI / 4);
        ctx.stroke();
        ctx.restore();

      } else if (atk.type === 'strong') {
        // ⚡ Taladro Supersónico (Vórtice Cinético Perforante)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2.5;

        for (let i = 0; i < 4; i++) {
          const r = 18 + i * 8;
          const offset = (this.time * 30 + i * 1.8) % (Math.PI * 2);
          ctx.beginPath();
          ctx.arc(cx, cy, r, offset, offset + Math.PI);
          ctx.stroke();
        }
        ctx.restore();
      }

    } else if (atk.element === 'plantas' || atk.element === 'tierra') {
      if (atk.type === 'weak') {
        // 🌿 Látigo de Espinas (Barrido Orgánico con Zarzas)
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

        // Látigo primario
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        const midX1 = (ox + tx) / 2 + Math.sin(this.time * 28) * 12;
        const midY1 = (oy + ty) / 2 + Math.cos(this.time * 28) * 12;
        ctx.quadraticCurveTo(midX1, midY1, tx, ty);
        ctx.stroke();

        // Zarcillo secundario entrelazado
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        const midX2 = (ox + tx) / 2 - Math.sin(this.time * 28) * 8;
        const midY2 = (oy + ty) / 2 - Math.cos(this.time * 28) * 8;
        ctx.quadraticCurveTo(midX2, midY2, tx, ty);
        ctx.stroke();

        // Hojas y espinas en el extremo
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(tx, ty, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(tx - 3, ty - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (atk.type === 'strong') {
        // 🌿 Brote de Zarzas y Prisión Selvática (AoE Masivo de Raíces)
        const hit = atk.hitbox;
        if (!hit) return;
        const cx = hit.x + hit.width / 2;
        const cy = hit.y + hit.height / 2;
        const radius = hit.width / 2;
        const progress = 1 - Math.max(0, atk.duration / 0.55);

        ctx.save();
        // Anillo exterior de enredaderas
        ctx.strokeStyle = `rgba(34, 197, 94, ${1 - progress * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * (0.4 + progress * 0.6), 0, Math.PI * 2);
        ctx.stroke();

        // Brote de 6 raíces gruesas emergiendo del suelo
        const rootCount = 6;
        for (let i = 0; i < rootCount; i++) {
          const angle = (i * (Math.PI * 2 / rootCount)) + 0.2;
          const r = radius * 0.75 * Math.min(1, progress * 1.4);
          const rx = cx + Math.cos(angle) * r;
          const ry = cy + Math.sin(angle) * r;

          ctx.fillStyle = '#14532d';
          ctx.beginPath();
          ctx.arc(rx, ry, 7, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#4ade80';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(rx, ry, 9, 0, Math.PI * 2);
          ctx.stroke();

          // Espinas
          ctx.fillStyle = '#86efac';
          ctx.fillRect(rx - 2, ry - 10, 4, 4);
        }
        ctx.restore();
      }
    }
  }

  /**
   * Renderiza el escudo protector translúcido cuando el jugador bloquea.
   * @private
   */
  _renderShieldBarrier(ctx, player) {
    const cx = player.pos.x + player.width / 2;
    const cy = player.pos.y + player.height / 2;
    const isParryWindow = player.stateTimer < 0.15; // Primeros 150ms = Parry perfecto

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Desplazamiento según facing
    let sx = cx;
    let sy = cy;
    const dist = 18;
    if (player.facing === 'right') sx += dist;
    else if (player.facing === 'left') sx -= dist;
    else if (player.facing === 'down') sy += dist;
    else if (player.facing === 'up') sy -= dist;

    // Color: Dorado para parry perfecto, azul cielo para guardia estándar
    const shieldColor = isParryWindow ? '#facc15' : '#38bdf8';
    ctx.strokeStyle = shieldColor;
    ctx.lineWidth = isParryWindow ? 3 : 2;
    ctx.fillStyle = isParryWindow ? 'rgba(250, 204, 21, 0.3)' : 'rgba(56, 189, 248, 0.2)';

    // Dibujar escudo hexagonal
    ctx.beginPath();
    const sides = 6;
    const radius = isParryWindow ? 18 : 14;
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
   * Renderiza explosiones y efectos de impacto.
   * @private
   */
  _renderEffect(ctx, fx) {
    const progress = fx.timer / fx.duration;
    const alpha = 1 - progress;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (fx.type === 'parry_spark') {
      // Destello estelar de parry perfecto
      ctx.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
      ctx.lineWidth = 2.5;
      const r = fx.radius * progress;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.type === 'fire_burst') {
      ctx.fillStyle = `rgba(249, 115, 22, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius * Math.sin(progress * Math.PI), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Renderiza el arco de barrido cortante de la espada (Sweeping Edge estilo Minecraft).
   * Genera una estela en medialuna con filo luminoso y partículas de corte.
   * @private
   */
  _renderSwordSweep(ctx, atk) {
    const ox = atk.originX || (atk.hitbox.x + atk.hitbox.width / 2);
    const oy = atk.originY || (atk.hitbox.y + atk.hitbox.height / 2);
    const facing = atk.facing || 'right';
    const progress = 1 - Math.max(0, atk.duration / 0.22); // 0 a 1
    const alpha = Math.sin(progress * Math.PI); // pico en medio del golpe

    // Ángulo central según orientación
    let baseAngle = 0;
    if (facing === 'right') baseAngle = 0;
    else if (facing === 'down') baseAngle = Math.PI / 2;
    else if (facing === 'left') baseAngle = Math.PI;
    else if (facing === 'up') baseAngle = -Math.PI / 2;

    const sweepSpan = Math.PI * 0.76; // ~137 grados de abanico de barrido
    const startAngle = baseAngle - (sweepSpan / 2) + (progress * 0.2);
    const endAngle = startAngle + sweepSpan;
    const radius = 28 + (progress * 14); // Expande de 28px a 42px

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Estela exterior translúcida de corte (Viento cortante)
    ctx.strokeStyle = `rgba(224, 242, 254, ${alpha * 0.45})`;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ox, oy, radius - 2, startAngle, endAngle);
    ctx.stroke();

    // 2. Filo brillante de la hoja de acero (Plateado / Blanco puro)
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(ox, oy, radius, startAngle + (sweepSpan * 0.12), endAngle);
    ctx.stroke();

    // 3. Destello de punta de la espada al cortar
    const tipX = ox + Math.cos(endAngle) * radius;
    const tipY = oy + Math.sin(endAngle) * radius;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Renderiza el aura de curación esmeralda y el Escudo de Vitalidad del jugador.
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
      const progress = player.healTimer / 0.85; // 1 a 0
      const alpha = Math.sin(progress * Math.PI);

      // Círculo restaurativo esmeralda en el suelo
      ctx.strokeStyle = `rgba(74, 222, 128, ${alpha * 0.85})`;
      ctx.lineWidth = 3;
      ctx.fillStyle = `rgba(34, 197, 94, ${alpha * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Motes de luz sagrada ascendentes
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
      // Escudo de Vitalidad activo (Aura protectora dorada/verde)
      const pulse = Math.sin(this.time * 6) * 2;
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 20 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 24 - pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
