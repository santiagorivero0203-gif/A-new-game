import { Ability } from './Ability.js';

/**
 * @module KineticAbility
 * @description Habilidad elemental de Cinética / Embestida.
 * - Débil: Embestida de impacto con Dash físico de ~120px que arrastra consigo a todos los enemigos.
 * - Fuerte: Taladro Supersónico hiper-veloz que perfora defensas y rompe armaduras.
 */
export class KineticAbility extends Ability {
  constructor() {
    super('Embestida');
  }

  /**
   * Ejecuta la embestida con dash físico que arrastra a los enemigos en su camino.
   * @param {import('../entities/Player.js').Player} player
   * @param {Object} context
   * @returns {number} Duración de la acción
   */
  executeWeak(player, context) {
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log('[KineticAbility] Ejecutando: Embestida Rompedora (Dash con Arrastre)');
    }

    const dx = player.facing === 'right' ? 1 : player.facing === 'left' ? -1 : 0;
    const dy = player.facing === 'down' ? 1 : player.facing === 'up' ? -1 : 0;

    // 1. Dash Físico real con impulso y estela
    const dashDuration = 0.28;
    const dashSpeed = 440; // Recorre ~123 píxeles
    player.startDash(dx, dy, dashSpeed, dashDuration);

    // 2. Registro del ataque con arrastre en CombatManager
    if (context.combatManager) {
      context.combatManager.addAttack({
        owner: player,
        type: 'weak',
        element: 'kinetic',
        damage: 24,
        duration: dashDuration,
        isCharge: true,
        chargeDir: { x: dx, y: dy },
        dragEnemies: true,
        hitEntities: new Set(),
        hitbox: {
          x: player.pos.x + (dx * 18),
          y: player.pos.y + (dy * 18),
          width: player.width + Math.abs(dx * 16),
          height: player.height + Math.abs(dy * 16)
        },
        update: function(dt) {
          // La hitbox avanza proyectada al frente del jugador
          this.hitbox.x = player.pos.x + (dx * 18);
          this.hitbox.y = player.pos.y + (dy * 18);

          // Arrastrar a todos los enemigos impactados en la dirección del dash
          if (this.hitEntities && this.hitEntities.size > 0) {
            const dragStepX = dx * dashSpeed * dt;
            const dragStepY = dy * dashSpeed * dt;
            for (const ent of this.hitEntities) {
              if (ent.hasTag('player')) continue;
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
   * Ejecuta el Taladro Supersónico perforante.
   * @param {import('../entities/Player.js').Player} player
   * @param {Object} context
   * @returns {number} Duración de la acción
   */
  executeStrong(player, context) {
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log('[KineticAbility] Ejecutando: Taladro Supersónico Perforante');
    }

    const dx = player.facing === 'right' ? 1 : player.facing === 'left' ? -1 : 0;
    const dy = player.facing === 'down' ? 1 : player.facing === 'up' ? -1 : 0;

    // Super dash de 560 px/s por 0.36s (~200px de recorrido perforante)
    const duration = 0.36;
    const dashSpeed = 560;
    player.startDash(dx, dy, dashSpeed, duration);

    if (context.combatManager) {
      context.combatManager.addAttack({
        owner: player,
        type: 'strong',
        element: 'kinetic',
        damage: 48,
        duration: duration,
        isCharge: true,
        chargeDir: { x: dx, y: dy },
        dragEnemies: true,
        hitEntities: new Set(),
        applyEffect: { tag: 'armor_break', duration: 5.0 },
        hitbox: {
          x: player.pos.x + (dx * 24),
          y: player.pos.y + (dy * 24),
          width: player.width + 16,
          height: player.height + 16
        },
        update: function(dt) {
          this.hitbox.x = player.pos.x + (dx * 24);
          this.hitbox.y = player.pos.y + (dy * 24);

          if (this.hitEntities && this.hitEntities.size > 0) {
            const dragStepX = dx * dashSpeed * dt;
            const dragStepY = dy * dashSpeed * dt;
            for (const ent of this.hitEntities) {
              if (ent.hasTag('player')) continue;
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
