import { Ability } from './Ability.js';

/**
 * @module KineticAbility
 * @description Habilidad elemental de Cinética / Embestida.
 * - Débil: Embestida Rompedora omnidireccional que arrastra enemigos (descarga Pulso de Plasma con `kinetic_overdrive`).
 * - Fuerte: Taladro Supersónico que perfora defensas y aplica Rotura de Armadura (+40% daño recibido).
 * - Sinergia: Impactar a un enemigo en llamas detona un Torbellino de Brasas en carrera.
 * @author Be a Legend Team
 * @version 3.1.0
 */
export class KineticAbility extends Ability {
  constructor() {
    super('Embestida');
  }

  /**
   * Dispara un Pulso de Plasma Cinético al finalizar una embestida cuando `kinetic_overdrive` está activo.
   * @private
   */
  _spawnOverdrivePulse(player, context, damage = 22, radius = 54) {
    if (!context || !context.combatManager) return;
    const cx = player.pos.x + player.width / 2;
    const cy = player.pos.y + player.height / 2;

    if (context.vfxRenderer) {
      context.vfxRenderer.spawnImpact('plasma_pulse', cx, cy, { radius, duration: 0.34 });
    }

    context.combatManager.addAttack({
      owner: player,
      isFriendlySynergy: true,
      type: 'synergy',
      element: 'kinetic',
      damage,
      duration: 0.16,
      isSweep: true,
      originX: cx,
      originY: cy,
      knockbackForce: 34,
      applyEffect: { tag: 'armor_break', duration: 3.5 },
      secondaryEffect: { tag: 'staggered', duration: 1.1 },
      hitEntities: new Set(),
      hitbox: {
        x: cx - radius,
        y: cy - radius,
        width: radius * 2,
        height: radius * 2
      }
    });
  }

  /**
   * Ejecuta la Embestida Rompedora en la dirección de apuntado activa arrastrando enemigos.
   * @param {import('../entities/Player.js').Player} player
   * @param {Object} context
   * @returns {number} Duración de la acción en segundos
   */
  executeWeak(player, context) {
    const aim = typeof player.getAimVector === 'function'
      ? player.getAimVector()
      : {
          x: player.facing === 'right' ? 1 : player.facing === 'left' ? -1 : 0,
          y: player.facing === 'down' ? 1 : player.facing === 'up' ? -1 : 0
        };

    const skillTree = context ? context.skillTreeManager : null;
    const hasOverdrive = !!(skillTree && skillTree.hasSkill('kinetic_overdrive'));

    const dx = aim.x;
    const dy = aim.y;

    if (context && context.audioManager) {
      context.audioManager.playAbility('kinetic', false);
    }

    const dashDuration = 0.25;
    const dashSpeed = 460;
    const abilitySelf = this;
    player.startDash(dx, dy, dashSpeed, dashDuration);

    if (context && context.combatManager) {
      context.combatManager.addAttack({
        owner: player,
        type: 'weak',
        element: 'kinetic',
        damage: hasOverdrive ? 30 : 25,
        duration: dashDuration,
        isCharge: true,
        chargeDir: { x: dx, y: dy },
        knockbackMult: hasOverdrive ? 1.2 : 1.0,
        dragEnemies: true,
        applyEffect: { tag: 'armor_break', duration: 3.2 },
        hitEntities: new Set(),
        hitbox: {
          x: player.pos.x + (dx * 16) - 6,
          y: player.pos.y + (dy * 16) - 6,
          width: player.width + 12,
          height: player.height + 12
        },
        onExpire: hasOverdrive
          ? (ctx) => abilitySelf._spawnOverdrivePulse(player, ctx, 22, 54)
          : null,
        update: function(dt) {
          this.hitbox.x = player.pos.x + (dx * 16) - 6;
          this.hitbox.y = player.pos.y + (dy * 16) - 6;

          if (this.hitEntities && this.hitEntities.size > 0) {
            const dragStepX = dx * dashSpeed * dt;
            const dragStepY = dy * dashSpeed * dt;
            for (const ent of this.hitEntities) {
              // Solo arrastrar enemigos móviles; jamás desplazar rocas, pilares o props estáticos
              if (!ent || ent.isDead || typeof ent.hasTag !== 'function' || !ent.hasTag('enemy') || ent.hasTag('prop') || ent.hasTag('destructible_prop')) {
                continue;
              }
              if (context.physics && typeof context.physics.moveWithCollisions === 'function') {
                const safe = context.physics.moveWithCollisions(ent, ent.pos.x + dragStepX, ent.pos.y + dragStepY);
                ent.pos.set(safe.x, safe.y);
              } else {
                ent.pos.x += dragStepX;
                ent.pos.y += dragStepY;
              }
            }
          }
        }
      });
    }

    return dashDuration;
  }

  /**
   * Ejecuta el Taladro Supersónico Perforante.
   * @param {import('../entities/Player.js').Player} player
   * @param {Object} context
   * @returns {number} Duración de la acción en segundos
   */
  executeStrong(player, context) {
    const aim = typeof player.getAimVector === 'function'
      ? player.getAimVector()
      : {
          x: player.facing === 'right' ? 1 : player.facing === 'left' ? -1 : 0,
          y: player.facing === 'down' ? 1 : player.facing === 'up' ? -1 : 0
        };

    const skillTree = context ? context.skillTreeManager : null;
    const hasOverdrive = !!(skillTree && skillTree.hasSkill('kinetic_overdrive'));

    const dx = aim.x;
    const dy = aim.y;

    if (context && context.audioManager) {
      context.audioManager.playAbility('kinetic', true);
    }
    if (context && context.camera) {
      context.camera.shake(0.35, 0.18);
    }

    const duration = 0.34;
    const dashSpeed = 580;
    const abilitySelf = this;
    player.startDash(dx, dy, dashSpeed, duration);

    if (context && context.combatManager) {
      context.combatManager.addAttack({
        owner: player,
        type: 'strong',
        element: 'kinetic',
        damage: hasOverdrive ? 58 : 50,
        duration,
        isCharge: true,
        chargeDir: { x: dx, y: dy },
        knockbackMult: hasOverdrive ? 1.2 : 1.0,
        dragEnemies: true,
        hitEntities: new Set(),
        applyEffect: { tag: 'armor_break', duration: 5.5 },
        hitbox: {
          x: player.pos.x + (dx * 20) - 12,
          y: player.pos.y + (dy * 20) - 12,
          width: player.width + 24,
          height: player.height + 24
        },
        onExpire: hasOverdrive
          ? (ctx) => abilitySelf._spawnOverdrivePulse(player, ctx, 28, 66)
          : null,
        update: function(dt) {
          this.hitbox.x = player.pos.x + (dx * 20) - 12;
          this.hitbox.y = player.pos.y + (dy * 20) - 12;

          if (this.hitEntities && this.hitEntities.size > 0) {
            const dragStepX = dx * dashSpeed * dt;
            const dragStepY = dy * dashSpeed * dt;
            for (const ent of this.hitEntities) {
              // Solo arrastrar enemigos móviles; jamás desplazar rocas, pilares o props estáticos
              if (!ent || ent.isDead || typeof ent.hasTag !== 'function' || !ent.hasTag('enemy') || ent.hasTag('prop') || ent.hasTag('destructible_prop')) {
                continue;
              }
              if (context.physics && typeof context.physics.moveWithCollisions === 'function') {
                const safe = context.physics.moveWithCollisions(ent, ent.pos.x + dragStepX, ent.pos.y + dragStepY);
                ent.pos.set(safe.x, safe.y);
              } else {
                ent.pos.x += dragStepX;
                ent.pos.y += dragStepY;
              }
            }
          }
        }
      });
    }

    return duration;
  }
}
