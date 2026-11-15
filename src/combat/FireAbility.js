import { Ability } from './Ability.js';

/**
 * @module FireAbility
 * @description Habilidad elemental de Fuego canalizada por el Guantelete.
 * - Débil: Disparo de Ceniza Ígnea (proyectil 360°, 24 daño + Quemadura; evoluciona a 3 orbes en abanico con `ember_fan`).
 * - Fuerte: Erupción Cíclica Solar (onda expansiva 360°, 48 daño + empuje; evoluciona a Anillo de Magma con `solar_cataclysm`).
 * - Sinergias: Incinera escudos de madera permanentemente y detona raíces (`elemental_synergy` extiende quemaduras +1.5s).
 * @author Be a Legend Team
 * @version 3.1.0
 */
export class FireAbility extends Ability {
  constructor() {
    super('Fuego');
  }

  /**
   * Ejecuta Disparo de Ceniza Ígnea (o Abanico de 3 Orbes si `ember_fan` está despierto).
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
    const hasEmberFan = !!(skillTree && skillTree.hasSkill('ember_fan'));
    const hasSynergy = !!(skillTree && skillTree.hasSkill('elemental_synergy'));

    const speed = 385;
    const baseAngle = Math.atan2(aim.y, aim.x);
    const burnDuration = 3.5 + (hasSynergy ? 1.5 : 0);

    if (context && context.audioManager) {
      context.audioManager.playAbility('fuego', false);
    }

    if (context && context.combatManager) {
      const spreadAngles = hasEmberFan ? [0, -0.28, 0.28] : [0];

      for (let i = 0; i < spreadAngles.length; i++) {
        const ang = baseAngle + spreadAngles[i];
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        const isCenter = i === 0;
        const orbDamage = isCenter ? 24 : 15;
        // Offset reducido (6px) y hitbox 20x20 para impactar sin tunneling en combate cuerpo a cuerpo
        const startX = player.pos.x + player.width / 2 + dx * 6;
        const startY = player.pos.y + player.height / 2 + dy * 6;

        context.combatManager.addAttack({
          owner: player,
          type: 'weak',
          element: 'fuego',
          isProjectile: true,
          isSideOrb: !isCenter,
          damage: orbDamage,
          duration: isCenter ? 1.05 : 0.88,
          x: startX,
          y: startY,
          dx,
          dy,
          speed,
          applyEffect: { tag: 'quemadura_ignea', duration: burnDuration },
          hitbox: { x: startX - 10, y: startY - 10, width: 20, height: 20 },
          destroyOnHit: true,
          update: function(dt) {
            this.x += this.dx * this.speed * dt;
            this.y += this.dy * this.speed * dt;
            this.hitbox.x = this.x - 10;
            this.hitbox.y = this.y - 10;
          }
        });
      }
    }

    return 0.19;
  }

  /**
   * Ejecuta Erupción Cíclica Solar a 360° (y consagra un Anillo de Magma de 3s si `solar_cataclysm` está activo).
   * @param {import('../entities/Player.js').Player} player
   * @param {Object} context
   * @returns {number} Duración de conjuro en segundos
   */
  executeStrong(player, context) {
    if (context && context.audioManager) {
      context.audioManager.playAbility('fuego', true);
    }
    if (context && context.camera) {
      context.camera.shake(0.42, 0.22);
    }

    const skillTree = context ? context.skillTreeManager : null;
    const hasSynergy = !!(skillTree && skillTree.hasSkill('elemental_synergy'));
    const hasCataclysm = !!(skillTree && skillTree.hasSkill('solar_cataclysm'));

    const cx = player.pos.x + player.width / 2;
    const cy = player.pos.y + player.height / 2;
    const margin = hasCataclysm ? 64 : 50;
    const burnDuration = 4.5 + (hasSynergy ? 1.5 : 0);

    if (context && context.combatManager) {
      context.combatManager.addAttack({
        owner: player,
        type: 'strong',
        element: 'fuego',
        damage: hasCataclysm ? 58 : 48,
        duration: 0.42,
        isSweep: true,
        originX: cx,
        originY: cy,
        knockbackForce: hasCataclysm ? 46 : 40,
        applyEffect: { tag: 'quemadura_ignea', duration: burnDuration },
        secondaryEffect: hasCataclysm ? { tag: 'armor_break', duration: 3.5 } : null,
        hitEntities: new Set(),
        hitbox: {
          x: player.pos.x - margin,
          y: player.pos.y - margin,
          width: margin * 2 + player.width,
          height: margin * 2 + player.height
        }
      });

      // Evolución de Maestría: Cataclismo del Fénix (Anillo de Magma persistente durante 3.0s)
      if (hasCataclysm) {
        const magmaRadius = 74;
        context.combatManager.addAttack({
          owner: player,
          type: 'zone',
          isMagmaZone: true,
          isFriendlySynergy: true,
          element: 'fuego',
          damage: 14,
          duration: 3.0,
          maxDuration: 3.0,
          originX: cx,
          originY: cy,
          radius: magmaRadius,
          pulseTimer: 0.45,
          applyEffect: { tag: 'quemadura_ignea', duration: 2.5 },
          hitEntities: new Set(),
          hitbox: {
            x: cx - magmaRadius,
            y: cy - magmaRadius,
            width: magmaRadius * 2,
            height: magmaRadius * 2
          },
          update: function(dt) {
            this.pulseTimer -= dt;
            if (this.pulseTimer <= 0) {
              this.pulseTimer = 0.5;
              this.hitEntities.clear();
            }
          }
        });
      }
    }

    return 0.36;
  }
}
