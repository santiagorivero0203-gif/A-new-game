import { Ability } from './Ability.js';

/**
 * @module EtherAbility
 * @description Cuarto poder elemental de la Reliquia: Éter Magnético (Polaridad Voltaica).
 * - Débil (*Pulso de Polaridad*): Invierte proyectiles hostiles cercanos, emite un pulso
 *   frontal que aplica `sobrecarga_eter`, dispara un orbe voltaico rápido y encadena arcos
 *   eléctricos sobre objetivos ya sobrecargados.
 * - Fuerte (*Singularidad Magnética*): Invoca un nodo gravitacional que atrae enemigos al
 *   centro, aplica `sobrecarga_eter` + `armor_break` en pulsos y colapsa aturdiendo en área.
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class EtherAbility extends Ability {
  constructor() {
    super('Éter');
    /** @private Buffer reutilizable Zero-GC para consultas espaciales en Singularidad */
    this._queryBuf = [];
  }

  /**
   * Ejecuta Pulso de Polaridad (refleja proyectiles hostiles cercanos + pulso frontal + orbe voltaico).
   * @param {import('../entities/Player.js').Player} player
   * @param {Object} context
   * @returns {number} Duración de animación en segundos
   */
  executeWeak(player, context) {
    const aim = typeof player.getAimVector === 'function'
      ? player.getAimVector()
      : {
          x: player.facing === 'right' ? 1 : player.facing === 'left' ? -1 : 0,
          y: player.facing === 'down' ? 1 : player.facing === 'up' ? -1 : 0
        };

    const dx = aim.x;
    const dy = aim.y;
    const pcx = player.pos.x + player.width * 0.5;
    const pcy = player.pos.y + player.height * 0.5;
    const pulseCx = pcx + dx * 30;
    const pulseCy = pcy + dy * 30;

    if (context && context.audioManager) {
      context.audioManager.playAbility('eter', false);
    }

    // 1. Inversión magnética de proyectiles hostiles dentro de radio 84 px
    const reflectRadiusSq = 84 * 84;
    let reflectedAny = false;

    const projSys = context ? context.projectileSystem : null;
    if (projSys && Array.isArray(projSys.active)) {
      for (let i = 0; i < projSys.active.length; i++) {
        const slot = projSys.active[i];
        if (!slot || slot.isFriendly || slot.isReflected) continue;
        const distSq = (slot.x - pulseCx) * (slot.x - pulseCx) + (slot.y - pulseCy) * (slot.y - pulseCy);
        if (distSq <= reflectRadiusSq) {
          const origShooter = slot.owner;
          slot.owner = player;
          slot.isFriendly = true;
          slot.isReflected = true;
          slot.spriteKey = 'reflected_gold';
          slot._recentHits.length = 0;
          if (origShooter && !origShooter.isDead && origShooter.pos) {
            const tx = (origShooter.pos.x + (origShooter.width || 32) * 0.5) - slot.x;
            const ty = (origShooter.pos.y + (origShooter.height || 32) * 0.5) - slot.y;
            const len = Math.hypot(tx, ty) || 1;
            slot.dx = tx / len;
            slot.dy = ty / len;
          } else {
            slot.dx = -slot.dx;
            slot.dy = -slot.dy;
          }
          slot.speed = (slot.speed || 220) * 1.65;
          slot.damage = Math.round((slot.damage || 20) * 2.0);
          slot.duration = 1.5;
          slot.applyEffect = { tag: 'sobrecarga_eter', duration: 3.5 };
          reflectedAny = true;
          if (context.vfxRenderer) {
            context.vfxRenderer.spawnImpact('parry_spark', slot.x, slot.y, { radius: 22, duration: 0.24 });
          }
        }
      }
    }

    const combat = context ? context.combatManager : null;
    if (combat && Array.isArray(combat.activeAttacks)) {
      for (let i = 0; i < combat.activeAttacks.length; i++) {
        const atk = combat.activeAttacks[i];
        if (!atk || !atk.isProjectile || atk.owner === player || atk.isReflected) continue;
        const ax = atk.x ?? (atk.hitbox ? atk.hitbox.x + atk.hitbox.width * 0.5 : 0);
        const ay = atk.y ?? (atk.hitbox ? atk.hitbox.y + atk.hitbox.height * 0.5 : 0);
        const distSq = (ax - pulseCx) * (ax - pulseCx) + (ay - pulseCy) * (ay - pulseCy);
        if (distSq <= reflectRadiusSq) {
          atk.owner = player;
          atk.isReflected = true;
          if (atk.hitEntities) atk.hitEntities.clear();
          atk.dx = -(atk.dx || 0);
          atk.dy = -(atk.dy || 0);
          atk.speed = (atk.speed || 220) * 1.65;
          atk.damage = Math.round((atk.damage || 20) * 2.0);
          atk.duration = 1.5;
          reflectedAny = true;
        }
      }
    }

    if (reflectedAny && context && context.audioManager) {
      context.audioManager.playParry();
    }

    // 2. Pulso frontal de Polaridad (`sobrecarga_eter`)
    if (combat) {
      const pulseSize = 76;
      combat.addAttack({
        owner: player,
        type: 'weak',
        element: 'eter',
        isPolarityPulse: true,
        damage: 24,
        duration: 0.22,
        maxDuration: 0.22,
        originX: pulseCx,
        originY: pulseCy,
        aimDir: { x: dx, y: dy },
        aimAngle: Math.atan2(dy, dx),
        applyEffect: { tag: 'sobrecarga_eter', duration: 4.0 },
        hitEntities: new Set(),
        hitbox: {
          x: pulseCx - pulseSize * 0.5,
          y: pulseCy - pulseSize * 0.5,
          width: pulseSize,
          height: pulseSize
        }
      });

      // Encadenar arco eléctrico secundario hacia enemigos cercanos si ya existe un objetivo sobrecargado
      if (context.entityManager) {
        const enemies = context.entityManager.getByTag('enemy');
        let hasOverchargedNearby = false;
        let chainCount = 0;
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          if (!e || e.isDead || !e.hasTag('sobrecarga_eter')) continue;
          const ecx = e.pos.x + e.width * 0.5;
          const ecy = e.pos.y + e.height * 0.5;
          if ((ecx - pulseCx) * (ecx - pulseCx) + (ecy - pulseCy) * (ecy - pulseCy) <= 96 * 96) {
            hasOverchargedNearby = true;
            break;
          }
        }
        if (hasOverchargedNearby) {
          for (let i = 0; i < enemies.length && chainCount < 2; i++) {
            const e = enemies[i];
            if (!e || e.isDead) continue;
            const ecx = e.pos.x + e.width * 0.5;
            const ecy = e.pos.y + e.height * 0.5;
            if ((ecx - pulseCx) * (ecx - pulseCx) + (ecy - pulseCy) * (ecy - pulseCy) <= 110 * 110) {
              chainCount++;
              if (context.vfxRenderer) {
                context.vfxRenderer.spawnImpact('ether_arc', ecx, ecy, { radius: 28, duration: 0.26 });
              }
              combat.addAttack({
                owner: player,
                isFriendlySynergy: true,
                type: 'synergy',
                element: 'eter',
                damage: 14,
                duration: 0.12,
                hitEntities: new Set(),
                hitbox: { x: ecx - 16, y: ecy - 16, width: 32, height: 32 }
              });
            }
          }
        }
      }
    }

    // 3. Orbe voltaico de largo alcance
    const startX = pcx + dx * 8;
    const startY = pcy + dy * 8;
    if (projSys && typeof projSys.spawn === 'function') {
      projSys.spawn({
        owner: player,
        type: 'weak',
        element: 'eter',
        spriteKey: 'ether_orb',
        isFriendly: true,
        damage: 20,
        duration: 0.95,
        x: startX,
        y: startY,
        dx,
        dy,
        speed: 410,
        radius: 10,
        altitude: 'high',
        destroyOnHit: true,
        applyEffect: { tag: 'sobrecarga_eter', duration: 4.0 }
      });
    } else if (combat) {
      combat.addAttack({
        owner: player,
        type: 'weak',
        element: 'eter',
        isProjectile: true,
        damage: 20,
        duration: 0.95,
        x: startX,
        y: startY,
        dx,
        dy,
        speed: 410,
        destroyOnHit: true,
        applyEffect: { tag: 'sobrecarga_eter', duration: 4.0 },
        hitEntities: new Set(),
        hitbox: { x: startX - 10, y: startY - 10, width: 20, height: 20 },
        update: function (dt) {
          this.x += this.dx * this.speed * dt;
          this.y += this.dy * this.speed * dt;
          this.hitbox.x = this.x - 10;
          this.hitbox.y = this.y - 10;
        }
      });
    }

    return 0.20;
  }

  /**
   * Ejecuta Singularidad Magnética: nodo gravitacional de 2.3s que agrupa enemigos,
   * aplica `sobrecarga_eter` y `armor_break`, y detona un colapso aturdidor al expirar.
   * @param {import('../entities/Player.js').Player} player
   * @param {Object} context
   * @returns {number} Duración de conjuro en segundos
   */
  executeStrong(player, context) {
    const aim = typeof player.getAimVector === 'function'
      ? player.getAimVector()
      : {
          x: player.facing === 'right' ? 1 : player.facing === 'left' ? -1 : 0,
          y: player.facing === 'down' ? 1 : player.facing === 'up' ? -1 : 0
        };

    if (context && context.audioManager) {
      context.audioManager.playAbility('eter', true);
    }
    if (context && context.camera) {
      context.camera.shake(0.38, 0.22);
    }

    const originX = player.pos.x + player.width * 0.5 + aim.x * 52;
    const originY = player.pos.y + player.height * 0.5 + aim.y * 52;
    const radius = 96;
    const pullRadiusSq = 132 * 132;
    const queryBuf = this._queryBuf;

    if (context && context.combatManager) {
      context.combatManager.addAttack({
        owner: player,
        type: 'zone',
        element: 'eter',
        isSingularityZone: true,
        damage: 14,
        duration: 2.3,
        maxDuration: 2.3,
        originX,
        originY,
        radius,
        pulseTimer: 0.50,
        applyEffect: { tag: 'sobrecarga_eter', duration: 4.0 },
        secondaryEffect: { tag: 'armor_break', duration: 2.5 },
        hitEntities: new Set(),
        hitbox: {
          x: originX - radius,
          y: originY - radius,
          width: radius * 2,
          height: radius * 2
        },
        update: function (dt) {
          this.pulseTimer -= dt;
          if (this.pulseTimer <= 0) {
            this.pulseTimer = 0.52;
            this.hitEntities.clear();
          }

          const em = context && context.entityManager;
          if (!em) return;
          const candidates = typeof em.queryNearby === 'function'
            ? em.queryNearby(originX - 136, originY - 136, originX + 136, originY + 136, queryBuf)
            : em.getByTag('enemy');

          for (let i = 0; i < candidates.length; i++) {
            const ent = candidates[i];
            if (!ent || ent.isDead || typeof ent.hasTag !== 'function' || !ent.hasTag('enemy')) continue;
            const ex = ent.pos.x + ent.width * 0.5;
            const ey = ent.pos.y + ent.height * 0.5;
            const dx = originX - ex;
            const dy = originY - ey;
            const distSq = dx * dx + dy * dy;
            if (distSq > 256 && distSq <= pullRadiusSq) {
              const dist = Math.sqrt(distSq);
              const pullSpeed = ent.isBoss ? 48 : 135;
              const stepX = (dx / dist) * pullSpeed * dt;
              const stepY = (dy / dist) * pullSpeed * dt;
              if (context.physics && typeof context.physics.moveWithCollisions === 'function') {
                const safe = context.physics.moveWithCollisions(ent, ent.pos.x + stepX, ent.pos.y + stepY);
                ent.pos.set(safe.x, safe.y);
              } else {
                ent.pos.x += stepX;
                ent.pos.y += stepY;
              }
            }
          }
        },
        onExpire: function (ctx) {
          if (!ctx || !ctx.combatManager) return;
          if (ctx.vfxRenderer) {
            ctx.vfxRenderer.spawnImpact('ether_burst', originX, originY, { radius: 88, duration: 0.42 });
          }
          if (ctx.audioManager) {
            ctx.audioManager.playExplosion();
          }
          if (ctx.camera) {
            ctx.camera.shake(0.32, 0.16);
          }
          ctx.combatManager.addAttack({
            owner: player,
            isFriendlySynergy: true,
            type: 'synergy',
            element: 'eter',
            damage: 38,
            duration: 0.18,
            isSweep: true,
            originX,
            originY,
            knockbackForce: 28,
            applyEffect: { tag: 'staggered', duration: 1.3 },
            hitEntities: new Set(),
            hitbox: {
              x: originX - 88,
              y: originY - 88,
              width: 176,
              height: 176
            }
          });
        }
      });
    }

    return 0.34;
  }
}

