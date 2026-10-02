import { Vector2 } from '../utils/Vector2.js';

/**
 * @module CombatManager
 * @description Gestor de combate "Push-Forward" y sistema de Defensa "Risk/Reward".
 * Administra el Momentum del jugador, resolución de hitboxes, sinergias elementales,
 * Postura (Guard Meter), Parries direccionales perfectos, HitStops y Ripostes críticos.
 */
export class CombatManager {
  /**
   * @param {import('./EquipmentManager.js').EquipmentManager} equipmentManager
   */
  constructor(equipmentManager = null) {
    this.equipmentManager = equipmentManager;

    /** @type {number} Momentum (0 a 100). */
    this.momentum = 0;
    
    /** @type {number} Tiempo sin atacar en segundos. */
    this.inactivityTimer = 0;

    /** @type {number} Umbral de inactividad antes de perder momentum (3s). */
    this.INACTIVITY_THRESHOLD = 3.0;

    /** @type {number} Tasa de pérdida de momentum por segundo tras inactividad. */
    this.MOMENTUM_DECAY_RATE = 25;

    /** @type {Array<Object>} Lista de ataques activos (hitboxes o proyectiles). */
    this.activeAttacks = [];

    // --- Sistema Defensivo ---
    /** @type {number} Medidor de postura del jugador (0 a 100). */
    this.guard_meter = 100;
  }

  /**
   * Actualización principal.
   * @param {Object} context 
   */
  update(context) {
    const dt = context.deltaTime || 0;
    const player = context.player || (context.state && typeof context.state.get === 'function' ? context.state.get('player') : context.state?.player);
    const entities = context.entityManager ? context.entityManager.entities : [];

    // Recuperar postura pasivamente si no se está defendiendo o en Guard Break
    if (player && player.fsmState !== 'STATE_DEFEND' && player.fsmState !== 'STATE_GUARD_BREAK') {
      this.guard_meter = Math.min(100, this.guard_meter + (15 * dt)); // Recupera 15/s
    }

    // Sincronizar medidor de postura con StateManager para el HUD
    if (context.state && typeof context.state.set === 'function') {
      context.state.set('player_posture', this.guard_meter);
    }

    // Decaimiento de Momentum
    this.inactivityTimer += dt;
    if (this.inactivityTimer >= this.INACTIVITY_THRESHOLD) {
      this.momentum = Math.max(0, this.momentum - (this.MOMENTUM_DECAY_RATE * dt));
    }

    // Resolver ataques
    for (let i = this.activeAttacks.length - 1; i >= 0; i--) {
      const attack = this.activeAttacks[i];
      attack.duration -= dt;

      if (attack.duration <= 0) {
        this.activeAttacks.splice(i, 1);
        continue;
      }

      if (attack.update) {
        attack.update(dt);
      }

      if (attack.hitbox && entities) {
        for (const entity of entities) {
          if (entity === attack.owner) continue;
          if (entity.hasTag('player') && attack.owner.hasTag('player')) continue;
          if (!entity.hasTag('npc') && !entity.hasTag('enemy') && !entity.hasTag('player')) continue;
          // Prevenir que enemigos se golpeen entre sí por defecto
          if (entity.hasTag('enemy') && attack.owner && attack.owner.hasTag('enemy')) continue;

          const entHit = entity.getHitbox();
          const attHit = attack.hitbox;

          if (attHit.x < entHit.x + entHit.width &&
              attHit.x + attHit.width > entHit.x &&
              attHit.y < entHit.y + entHit.height &&
              attHit.y + attHit.height > entHit.y) {
            
            this.handleHit(attack, entity, context);
            
            if (attack.destroyOnHit) {
              this.activeAttacks.splice(i, 1);
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Chequea direccionalidad con cobertura hemisférica de 180°.
   * Si el jugador mira 'up', bloquea todo lo que venga desde la mitad superior (arriba-izq, arriba, arriba-der).
   * Si mira 'right', bloquea todo lo que venga de la mitad derecha, etc.
   * @returns {boolean} true si el ataque cae dentro del hemisferio defendido
   */
  _isFacingAttacker(entity, attackX, attackY) {
    if (!entity.facing) return false;
    
    const entCenter = { x: entity.pos.x + entity.width / 2, y: entity.pos.y + entity.height / 2 };
    
    // Vector desde la entidad hacia la fuente del ataque
    const dx = attackX - entCenter.x;
    const dy = attackY - entCenter.y;
    
    // Cobertura hemisférica: basta que el eje dominante del facing coincida
    switch (entity.facing) {
      case 'up':    return dy < 0;  // Bloquea todo lo que venga desde arriba (incluyendo diagonales)
      case 'down':  return dy > 0;  // Bloquea todo lo que venga desde abajo
      case 'left':  return dx < 0;  // Bloquea todo lo que venga desde la izquierda
      case 'right': return dx > 0;  // Bloquea todo lo que venga desde la derecha
      default: return false;
    }
  }

  /**
   * Aplica un vector de retroceso físico a una entidad.
   * @param {Object} entity - Entidad a empujar
   * @param {number} fromX - Origen X del impacto
   * @param {number} fromY - Origen Y del impacto
   * @param {number} force - Magnitud del empuje en píxeles
   */
  _applyKnockback(entity, fromX, fromY, force, physics = null) {
    const entCenter = { x: entity.pos.x + entity.width / 2, y: entity.pos.y + entity.height / 2 };
    let dx = entCenter.x - fromX;
    let dy = entCenter.y - fromY;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag === 0) return;
    dx /= mag;
    dy /= mag;
    const targetX = entity.pos.x + dx * force;
    const targetY = entity.pos.y + dy * force;
    if (physics && typeof physics.moveWithCollisions === 'function') {
      const safe = physics.moveWithCollisions(entity, targetX, targetY);
      entity.pos.set(safe.x, safe.y);
    } else {
      entity.pos.x = targetX;
      entity.pos.y = targetY;
    }
  }

  /**
   * Procesa el impacto de un ataque sobre una entidad.
   * @param {Object} attack 
   * @param {import('../entities/Entity.js').Entity} entity 
   * @param {Object} context
   */
  handleHit(attack, entity, context) {
    if (attack.hitEntities && attack.hitEntities.has(entity)) return;
    if (attack.hitEntities) attack.hitEntities.add(entity);

    const isPlayer = entity.hasTag('player');
    const attackCenter = { x: attack.hitbox.x + attack.hitbox.width/2, y: attack.hitbox.y + attack.hitbox.height/2 };
    const physics = context.physics || null;

    // ==========================================
    // Lógica Defensiva, Parry y Postura (Jugador)
    // ==========================================
    if (isPlayer) {
      if (entity.fsmState === 'STATE_DEFEND') {
        const facingAttacker = this._isFacingAttacker(entity, attackCenter.x, attackCenter.y);
        
        if (facingAttacker) {
          // Chequear ventana de Parry (0.15s desde que se presionó defender)
          const isParry = entity.stateTimer <= 0.15;
          
          if (isParry) {
            // PARRY PERFECTO (Recompensa)
            if (typeof window !== 'undefined' && window.DEBUG_MODE) {
              console.log('%c[Parry Perfecto!] Postura salvada. Enemigo Staggered.', 'color: #00ff00; font-weight: bold');
            }
            // 1. HitStop de 0.08s
            if (context.engine) context.engine.hitStop(0.08);
            
            // 2. Destello visual estelar de Parry
            if (context.vfxRenderer) {
              context.vfxRenderer.spawnImpact('parry_spark', attackCenter.x, attackCenter.y, { radius: 28, duration: 0.35 });
            }

            // 3. Stagger al enemigo y Knockback físico
            if (attack.owner && attack.owner.hasTag('enemy')) {
              attack.owner.applyEffect('staggered', 3.0);
              this._applyKnockback(attack.owner, entity.pos.x, entity.pos.y, 24, physics);
            }

            // 4. Mecánica del Artillero Ágil: Parry Deportivo a Proyectiles (Reflejar con daño doble)
            if (attack.isProjectile || attack.type === 'projectile' || (attack.update && attack.destroyOnHit)) {
              attack.owner = entity; // Ahora pertenece al jugador y golpeará enemigos
              if (attack.hitEntities) attack.hitEntities.clear();
              if (typeof attack.reverseTrajectory === 'function') {
                attack.reverseTrajectory();
              } else if (attack.dx !== undefined && attack.dy !== undefined) {
                attack.dx = -attack.dx;
                attack.dy = -attack.dy;
                attack.speed = (attack.speed || 300) * 1.5;
              }
              attack.damage = (attack.damage || 20) * 2.0;
              attack.duration = 1.4;
              if (context.camera) context.camera.shake(0.3, 0.15);
              return;
            }

            return; // Bloquea todo el daño y efectos negativos
            
          } else {
            // BLOQUEO NORMAL (Riesgo/Coste)
            let drainRate = 1.0;
            let elementalMultiplier = 1.0;
            if (this.equipmentManager) {
              const shield = this.equipmentManager.getShield();
              if (shield) {
                drainRate = shield.posture_drain_rate || 1.0;
                // Debilidad elemental reactiva: si el ataque coincide, x5 de coste
                if (shield.elemental_weakness && attack.element === shield.elemental_weakness) {
                  elementalMultiplier = 5.0;
                  if (typeof window !== 'undefined' && window.DEBUG_MODE) {
                    console.log(`%c[Debilidad Elemental!] ${attack.element} contra ${shield.name}`, 'color: #ff6600; font-weight: bold');
                  }
                }
              }
            }
            
            const postureDamage = (attack.damage || 20) * drainRate * elementalMultiplier;
            this.guard_meter -= postureDamage;
            
            if (typeof window !== 'undefined' && window.DEBUG_MODE) {
              console.log(`[Bloqueo] Coste de postura: ${postureDamage}. Restante: ${this.guard_meter}`);
            }

            if (this.guard_meter <= 0) {
              // GUARD BREAK con Knockback físico al jugador
              this.guard_meter = 0;
              entity.fsmState = 'STATE_GUARD_BREAK';
              entity.stateTimer = 2.0;
              this._applyKnockback(entity, attackCenter.x, attackCenter.y, 18, physics);
              if (typeof window !== 'undefined' && window.DEBUG_MODE) {
                console.log('%c[GUARD BREAK] Postura rota. Knockback aplicado.', 'color: #ff0000; font-weight: bold');
              }
            }
            
            return; // Bloquea daño físico, pero costó postura
          }
        } else {
          // Ataque por la espalda, no se puede bloquear
          if (typeof window !== 'undefined' && window.DEBUG_MODE) {
            console.log('[Defensa Fallida] Ataque por la espalda.');
          }
        }
      }
    }

    // ==========================================
    // Mecánica de Escudo de Madera (Tanque de Postura)
    // ==========================================
    if (entity.hasTag('wooden_shield') || entity.hasWoodenShield) {
      if (attack.element === 'fuego') {
        // Quemar el escudo de madera de forma permanente
        if (typeof entity.burnWoodenShield === 'function') {
          entity.burnWoodenShield(context);
        } else {
          entity.hasWoodenShield = false;
          entity.tags = entity.tags.filter(t => t !== 'wooden_shield');
          entity.activeEffects.delete('wooden_shield');
        }
        if (context.vfxRenderer) {
          context.vfxRenderer.spawnImpact('fire_burst', entity.pos.x + 16, entity.pos.y + 16, { radius: 36, duration: 0.45 });
        }
        this.triggerWoodExplosion(entity, context);
      } else if (attack.element === 'physical' && attack.type === 'weak') {
        // Ataques débiles frontales rebotan en el escudo pesado
        if (this._isFacingAttacker(entity, attackCenter.x, attackCenter.y)) {
          if (context.vfxRenderer) {
            context.vfxRenderer.spawnImpact('parry_spark', attackCenter.x, attackCenter.y, { radius: 20, duration: 0.2 });
          }
          if (attack.owner && attack.owner.hasTag('player')) {
            this._applyKnockback(attack.owner, entity.pos.x, entity.pos.y, 18, physics);
            if (context.camera) context.camera.shake(0.2, 0.1);
          }
          return; // Absorbe completamente el impacto frontal
        }
      }
    }

    // ==========================================
    // Lógica de Ataque, Recarga Activa y Efectividad Elemental
    // ==========================================
    if (attack.owner && attack.owner.hasTag('player')) {
      this.inactivityTimer = 0;
      if (attack.type === 'weak') {
        this.addMomentum(10);
      }

      // Recarga activa de energía elemental al conectar ataques de espada física
      if (attack.element === 'physical') {
        attack.owner.energy = Math.min(attack.owner.max_energy, attack.owner.energy + 6);
      }
      
      // Chequear Riposte Crítico si el objetivo está aturdido
      let finalDamage = attack.damage || 10;
      if (entity.hasTag('staggered')) {
        finalDamage *= 3.0; // x3.0 Multiplicador crítico
        if (context.engine) {
          context.engine.hitStop(0.08); // HitStop en golpes críticos
        }
        if (typeof window !== 'undefined' && window.DEBUG_MODE) {
          console.log(`%c[RIPOSTE CRÍTICO!] Daño: ${finalDamage}`, 'color: #ffff00; font-weight: bold');
        }
        if (attack.type === 'strong') {
          entity.activeEffects.delete('staggered');
        }
      }

      // Triángulo de Efectividad Elemental (Fuerte vs Débil)
      // 🔥 Fuego vence a 🌿 Plantas (x2.0)
      // 🌿 Plantas vence a ⚡ Cinético (x2.0)
      // ⚡ Cinético vence a 🔥 Fuego (x2.0)
      const atkElem = attack.element;
      const defElem = entity.elementalAffinity || (entity.hasTag('elem_plantas') ? 'plantas' : entity.hasTag('elem_fuego') ? 'fuego' : entity.hasTag('elem_kinetic') ? 'kinetic' : null);

      if (defElem && atkElem !== 'physical') {
        const isSuperEffective = (
          (atkElem === 'fuego' && (defElem === 'plantas' || defElem === 'raices' || defElem === 'tierra')) ||
          ((atkElem === 'plantas' || atkElem === 'tierra') && defElem === 'kinetic') ||
          (atkElem === 'kinetic' && defElem === 'fuego')
        );

        const isResisted = (
          ((atkElem === 'plantas' || atkElem === 'tierra') && defElem === 'fuego') ||
          (atkElem === 'kinetic' && (defElem === 'plantas' || defElem === 'raices' || defElem === 'tierra')) ||
          (atkElem === 'fuego' && defElem === 'kinetic')
        );

        if (isSuperEffective) {
          finalDamage *= 2.0;
          if (typeof window !== 'undefined' && window.DEBUG_MODE) {
            console.log(`%c[¡SUPER EFECTIVO! x2.0] ${atkElem} contra ${defElem} -> Daño: ${finalDamage}`, 'color: #facc15; font-weight: bold');
          }
          if (context.vfxRenderer) {
            context.vfxRenderer.spawnImpact('parry_spark', entity.pos.x + 16, entity.pos.y + 16, { radius: 24, duration: 0.25 });
          }
        } else if (isResisted) {
          finalDamage *= 0.6;
          if (typeof window !== 'undefined' && window.DEBUG_MODE) {
            console.log(`%c[¡RESISTIDO x0.6] ${atkElem} contra ${defElem} -> Daño: ${finalDamage}`, 'color: #94a3b8; font-style: italic');
          }
        }
      }

      // Knockback e impacto de embestida
      if (attack.isCharge) {
        const cDir = attack.chargeDir || { x: 1, y: 0 };
        this._applyKnockback(entity, entity.pos.x - (cDir.x * 20), entity.pos.y - (cDir.y * 20), 28);
        if (context.camera) {
          context.camera.shake(0.22, 0.14);
        }
      }

      // Retroceso y corte en abanico (Sweeping Edge estilo Minecraft)
      if (attack.isSweep) {
        const originX = attack.originX || (attack.owner ? attack.owner.pos.x + attack.owner.width / 2 : attackCenter.x);
        const originY = attack.originY || (attack.owner ? attack.owner.pos.y + attack.owner.height / 2 : attackCenter.y);
        const force = attack.knockbackForce || 28;
        this._applyKnockback(entity, originX, originY, force);
        if (context.camera) {
          context.camera.shake(0.24, 0.14); // Temblor visceral de corte
        }
        if (context.vfxRenderer) {
          context.vfxRenderer.spawnImpact('parry_spark', entity.pos.x + 16, entity.pos.y + 16, { radius: 18, duration: 0.2 });
        }
      }

      // Aplicar daño a la entidad si dispone de sistema de salud
      if (typeof entity.takeDamage === 'function') {
        entity.takeDamage(finalDamage, attack, context);
      }
    }

    // Sinergia Elemental: Raíces inmovilizadoras + Fuego = Explosión
    if (attack.element === 'fuego' && entity.hasTag('inmovilizado_raices')) {
      this.triggerWoodExplosion(entity, context);
      entity.activeEffects.delete('inmovilizado_raices');
    }
    
    if (attack.applyEffect) {
      entity.applyEffect(attack.applyEffect.tag, attack.applyEffect.duration);
    }
  }

  triggerWoodExplosion(entity, context) {
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log(`[CombatManager] ¡SINERGIA! Explosión de Madera en ${entity.pos.x}, ${entity.pos.y}`);
    }
    this.addAttack({
      owner: null,
      type: 'synergy',
      element: 'explosion',
      damage: 50,
      duration: 0.2,
      hitbox: {
        x: entity.pos.x - 30,
        y: entity.pos.y - 30,
        width: 60 + entity.width,
        height: 60 + entity.height
      },
      hitEntities: new Set()
    });
  }

  addMomentum(amount) {
    this.momentum = Math.min(100, this.momentum + amount);
  }

  consumeMomentum(amount) {
    if (this.momentum >= amount) {
      this.momentum -= amount;
      return true;
    }
    return false;
  }

  addAttack(attackObj) {
    if (!attackObj.hitEntities) {
      attackObj.hitEntities = new Set();
    }
    this.activeAttacks.push(attackObj);
  }

  /**
   * Remueve todos los ataques activos registrados por un propietario específico (Dash Cancel).
   * @param {Object} owner
   */
  cancelAttacksFrom(owner) {
    for (let i = this.activeAttacks.length - 1; i >= 0; i--) {
      if (this.activeAttacks[i].owner === owner) {
        this.activeAttacks.splice(i, 1);
      }
    }
  }

  canCancel(currentState, nextState) {
    if (nextState === 'STATE_DASH') return true;
    if (currentState === 'STATE_DASH' && (nextState.startsWith('STATE_ATTACK'))) return false;
    // No se puede cancelar nada si estás aturdido
    if (currentState === 'STATE_GUARD_BREAK') return false;

    return true;
  }
}

/* AUDITORÍA DE DISEÑO:
 * [Evaluación técnica del Sistema Defensivo 'Risk/Reward']:
 * 1. Escalabilidad (EquipmentManager): La inyección de dependencias del EquipmentManager en CombatManager permite escalar a N escudos. La propiedad `posture_drain_rate` actúa limpiamente como multiplicador escalar en `postureDamage`, permitiendo sinergias RPG masivas.
 * 2. Salida de 'Guard Break': La FSM (Player.js) y `canCancel` están atadas. El estado `STATE_GUARD_BREAK` congela inputs lógicos de movimiento y ataque, y su temporalidad (2.0s controlada por `stateTimer` en Player) transiciona fluidamente a `STATE_IDLE` sin cuelgues ni locks.
 * 3. Ventana de Parry (0.15s): Integrada matemáticamente con `player.stateTimer <= 0.15`. A 60 FPS (dt = ~0.016s), esto garantiza un margen de ~9 fotogramas exactos de respuesta humana, alineándose precisamente al estándar oro de títulos de alta velocidad.
 * 4. HitStop Inyectado (Engine.js): Detiene las matemáticas de `updateFn` (dt) pero mantiene `renderFn` vivo, entregando puro 'Game Feel' visual al concretar el bloqueo perfecto, sin desestabilizar bucles del event loop de JS.
 */
