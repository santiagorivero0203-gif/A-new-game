import { Ability } from './Ability.js';

/**
 * @module EarthAbility
 * @description Habilidad elemental de Plantas / Naturaleza / Tierra.
 * - Débil: Látigo de Espinas (barrido punzante en arco frontal, 22 daño, ralentiza y atrae).
 * - Fuerte: Brote de Zarzas y Prisión Selvática (AoE masivo a 360°, 42 daño, atrapa e inmoviliza por 3.5s).
 * Sinergia: Quemar a un enemigo atrapado en raíces con Fuego detona una devastadora explosión de madera.
 */
export class EarthAbility extends Ability {
  constructor() {
    super('Plantas');
  }

  /**
   * Ejecuta el Látigo de Espinas (Ataque Débil rápido).
   * @param {import('../entities/Player.js').Player} player
   * @param {Object} context
   * @returns {number} Duración de animación
   */
  executeWeak(player, context) {
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log('[EarthAbility] Ejecutando: Látigo de Espinas');
    }

    const dx = player.facing === 'right' ? 1 : player.facing === 'left' ? -1 : 0;
    const dy = player.facing === 'down' ? 1 : player.facing === 'up' ? -1 : 0;

    const reach = 32;
    const boxW = dx !== 0 ? 56 : 64;
    const boxH = dy !== 0 ? 56 : 64;

    const hitX = player.pos.x + (player.width / 2) + (dx * reach) - (boxW / 2);
    const hitY = player.pos.y + (player.height / 2) + (dy * reach) - (boxH / 2);

    if (context.combatManager) {
      context.combatManager.addAttack({
        owner: player,
        type: 'weak',
        element: 'plantas',
        damage: 22,
        duration: 0.3,
        applyEffect: { tag: 'enredado_espinas', duration: 1.8 },
        hitEntities: new Set(),
        hitbox: {
          x: hitX,
          y: hitY,
          width: boxW,
          height: boxH
        },
        // Efecto de atracción suave hacia el centro del latigazo
        update: function(dt) {
          if (this.hitEntities && this.hitEntities.size > 0) {
            for (const ent of this.hitEntities) {
              if (ent.hasTag('player')) continue;
              const toPlayerX = (player.pos.x + 16) - (ent.pos.x + 16);
              const toPlayerY = (player.pos.y + 16) - (ent.pos.y + 16);
              const dist = Math.hypot(toPlayerX, toPlayerY) || 1;
              if (dist > 28) {
                const stepX = (toPlayerX / dist) * 140 * dt;
                const stepY = (toPlayerY / dist) * 140 * dt;
                if (context.physics && typeof context.physics.moveWithCollisions === 'function') {
                  const safe = context.physics.moveWithCollisions(ent, ent.pos.x + stepX, ent.pos.y + stepY);
                  ent.pos.set(safe.x, safe.y);
                } else {
                  ent.pos.x += stepX;
                  ent.pos.y += stepY;
                }
              }
            }
          }
        }
      });
    }

    return 0.28; // 280ms
  }

  /**
   * Ejecuta el Brote de Zarzas y Prisión Selvática (Ataque Fuerte AoE).
   * @param {import('../entities/Player.js').Player} player
   * @param {Object} context
   * @returns {number} Duración de conjuro
   */
  executeStrong(player, context) {
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log('[EarthAbility] Ejecutando: Brote de Zarzas y Prisión Selvática');
    }

    const radius = 90;
    const cx = player.pos.x + player.width / 2;
    const cy = player.pos.y + player.height / 2;

    if (context.combatManager) {
      context.combatManager.addAttack({
        owner: player,
        type: 'strong',
        element: 'plantas',
        damage: 42,
        duration: 0.55,
        applyEffect: { tag: 'inmovilizado_raices', duration: 3.5 },
        hitEntities: new Set(),
        hitbox: {
          x: cx - radius,
          y: cy - radius,
          width: radius * 2,
          height: radius * 2
        }
      });
    }

    return 0.5; // 500ms de animación de conjuro
  }
}
