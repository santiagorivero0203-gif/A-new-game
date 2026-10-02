import { Ability } from './Ability.js';

/**
 * @module FireAbility
 * @description Habilidad elemental de Fuego.
 * - Débil: Disparo de Ceniza Ígnea (proyectil rápido de 320 px/s, 22 daño).
 * - Fuerte: Erupción Cíclica (onda expansiva de llamas a 360°, 46 daño).
 */
export class FireAbility extends Ability {
  constructor() {
    super('Fuego');
  }

  executeWeak(player, context) {
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log('[FireAbility] Ejecutando: Bola de Ceniza');
    }

    const speed = 340;
    const dx = player.facing === 'right' ? 1 : player.facing === 'left' ? -1 : 0;
    const dy = player.facing === 'down' ? 1 : player.facing === 'up' ? -1 : 0;

    if (context.combatManager) {
      context.combatManager.addAttack({
        owner: player,
        type: 'weak',
        element: 'fuego',
        damage: 22,
        duration: 1.0,
        x: player.pos.x + player.width / 2,
        y: player.pos.y + player.height / 2,
        hitbox: { x: 0, y: 0, width: 14, height: 14 },
        destroyOnHit: true,
        update: function(dt) {
          this.x += dx * speed * dt;
          this.y += dy * speed * dt;
          this.hitbox.x = this.x - 7;
          this.hitbox.y = this.y - 7;
        }
      });
    }

    return 0.28;
  }

  executeStrong(player, context) {
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log('[FireAbility] Ejecutando: Erupción Cíclica');
    }

    if (context.combatManager) {
      context.combatManager.addAttack({
        owner: player,
        type: 'strong',
        element: 'fuego',
        damage: 46,
        duration: 0.5,
        hitEntities: new Set(),
        hitbox: {
          x: player.pos.x - 45,
          y: player.pos.y - 45,
          width: 90 + player.width,
          height: 90 + player.height
        }
      });
    }

    return 0.5;
  }
}
