import { Ability } from './Ability.js';

/**
 * @module EarthAbility
 * @description Habilidad elemental de Plantas / Naturaleza / Tierra.
 * - Débil: Látigo de Espinas (barrido con tracción magnética; drena energía y sangra con `thorn_leech`
 *   e inmoviliza brevemente con `bramble_snare`).
 * - Fuerte: Prisión Selvática (AoE 360° que inmoviliza; otorga Escudo de Vitalidad y +40 Égida con `verdant_sanctuary`).
 * - Sinergia: Impactar con Fuego a un objetivo enraizado detona Explosión de Madera.
 * @author Be a Legend Team
 * @version 3.1.0
 */
export class EarthAbility extends Ability {
  constructor() {
    super('Plantas');
  }

  /**
   * Ejecuta el Látigo de Espinas con tracción magnética hacia el rango de la espada.
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

    const skillTree = context ? context.skillTreeManager : null;
    const hasThornLeech = !!(skillTree && skillTree.hasSkill('thorn_leech'));
    const hasBrambleSnare = !!(skillTree && skillTree.hasSkill('bramble_snare'));

    const dx = aim.x;
    const dy = aim.y;

    if (context && context.audioManager) {
      context.audioManager.playAbility('plantas', false);
    }

    const reach = hasThornLeech ? 46 : 38;
    const boxW = hasThornLeech ? 74 : 62;
    const boxH = hasThornLeech ? 74 : 62;
    const pullSpeed = hasBrambleSnare ? 245 : 185;

    const hitX = player.pos.x + (player.width / 2) + (dx * reach) - (boxW / 2);
    const hitY = player.pos.y + (player.height / 2) + (dy * reach) - (boxH / 2);

    if (context && context.combatManager) {
      context.combatManager.addAttack({
        owner: player,
        type: 'weak',
        element: 'plantas',
        damage: hasThornLeech ? 28 : 23,
        duration: 0.26,
        aimDir: { x: dx, y: dy },
        energyLeechedPerHit: hasThornLeech ? 6 : 0,
        applyEffect: hasBrambleSnare
          ? { tag: 'inmovilizado_raices', duration: 1.6 }
          : { tag: 'enredado_espinas', duration: 2.4 },
        secondaryEffect: hasThornLeech
          ? { tag: 'sangrado_espinas', duration: 3.0 }
          : null,
        hitEntities: new Set(),
        hitbox: {
          x: hitX,
          y: hitY,
          width: boxW,
          height: boxH
        },
        update: function(dt) {
          if (this.hitEntities && this.hitEntities.size > 0) {
            for (const ent of this.hitEntities) {
              if (ent.hasTag('player') || ent.isDead) continue;
              const toPlayerX = (player.pos.x + 16) - (ent.pos.x + ent.width / 2);
              const toPlayerY = (player.pos.y + 16) - (ent.pos.y + ent.height / 2);
              const dist = Math.hypot(toPlayerX, toPlayerY) || 1;
              if (dist > 30) {
                const stepX = (toPlayerX / dist) * pullSpeed * dt;
                const stepY = (toPlayerY / dist) * pullSpeed * dt;
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

    return 0.21;
  }

  /**
   * Ejecuta Prisión Selvática (y activa Bosque Guardián sobre Santi si `verdant_sanctuary` está desbloqueado).
   * @param {import('../entities/Player.js').Player} player
   * @param {Object} context
   * @returns {number} Duración de conjuro en segundos
   */
  executeStrong(player, context) {
    if (context && context.audioManager) {
      context.audioManager.playAbility('plantas', true);
    }
    if (context && context.camera) {
      context.camera.shake(0.36, 0.20);
    }

    const skillTree = context ? context.skillTreeManager : null;
    const hasSynergy = !!(skillTree && skillTree.hasSkill('elemental_synergy'));
    const hasVerdant = !!(skillTree && skillTree.hasSkill('verdant_sanctuary'));

    const radius = hasVerdant ? 104 : 92;
    const rootDuration = 3.8 + (hasSynergy ? 1.5 : 0);
    const cx = player.pos.x + player.width / 2;
    const cy = player.pos.y + player.height / 2;

    // Evolución Bosque Guardián: corteza protectora sobre Santi + restauración de Égida
    if (hasVerdant) {
      player.applyEffect('vitality_shield', 5.0);
      player.guard_meter = Math.min(player.max_guard || 100, player.guard_meter + 40);
      player.healTimer = Math.max(player.healTimer, 0.65);
    }

    if (context && context.combatManager) {
      context.combatManager.addAttack({
        owner: player,
        type: 'strong',
        element: 'plantas',
        damage: hasVerdant ? 55 : 44,
        duration: 0.50,
        applyEffect: { tag: 'inmovilizado_raices', duration: rootDuration },
        secondaryEffect: hasVerdant ? { tag: 'sangrado_espinas', duration: 3.5 } : null,
        hitEntities: new Set(),
        hitbox: {
          x: cx - radius,
          y: cy - radius,
          width: radius * 2,
          height: radius * 2
        }
      });
    }

    if (context && context.vfxRenderer) {
      context.vfxRenderer.spawnImpact('earth_root', cx, cy, { radius: radius - 6, duration: 0.45 });
    }

    return 0.36;
  }
}
