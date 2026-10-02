import { Entity } from './Entity.js';
import { Vector2 } from '../utils/Vector2.js';
import { FireAbility } from '../combat/FireAbility.js';
import { KineticAbility } from '../combat/KineticAbility.js';
import { EarthAbility } from '../combat/EarthAbility.js';
import { PLAYER_STATS } from '../data/PlayerStats.js';
import { KEYBINDINGS } from '../core/InputManager.js';

/**
 * @module Player
 * @description Entidad controlada por el usuario con diseño visual de héroe Action-RPG.
 * Maneja traslación combinando teclado físico y joystick virtual táctil, resolución de colisiones,
 * animación de ataque con espada y profundidad Top-Down.
 * @author Be a Legend Team
 * @version 1.3.0
 */
export class Player extends Entity {
  /**
   * @param {number} x - Posición X inicial
   * @param {number} y - Posición Y inicial
   */
  constructor(x, y) {
    super(x, y, 32, 32);
    this.color = '#4CAF50';
    this.tags.push('player');

    /** @type {number} Velocidad de movimiento en píxeles por segundo */
    this.speed = PLAYER_STATS.speed || 160;

    /** @type {Vector2} Vector de velocidad del frame actual */
    this.velocity = new Vector2(0, 0);

    /** @type {string} Dirección a la que mira el jugador ('up', 'down', 'left', 'right') */
    this.facing = 'down';

    /** @type {number} Temporizador del ataque con espada */
    this.attackTimer = 0;

    // Hitbox precisa para la base del personaje (pies)
    this.hitbox = {
      offsetX: 6,
      offsetY: 18,
      width: 20,
      height: 14
    };

    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;

    /** @type {string} Estado actual (FSM) */
    this.fsmState = 'STATE_IDLE';
    this.stateTimer = 0;

    /** @type {number} Salud del héroe */
    this.health = PLAYER_STATS.health || 3;
    this.max_health = PLAYER_STATS.max_health || 3;

    /** @type {number} Reserva de Energía Elemental milenaria (0 - 100) */
    this.energy = PLAYER_STATS.energy || 100;
    this.max_energy = PLAYER_STATS.max_energy || 100;

    /** @type {number} Postura / Equilibrio de guardia (0 - 100) */
    this.guard_meter = PLAYER_STATS.guard_meter || 100;
    this.max_guard = PLAYER_STATS.max_guard || 100;

    /** @type {number} Regeneración pasiva de energía por segundo */
    this.energy_regen_rate = PLAYER_STATS.energy_regen_rate || 4;

    /** @type {number} Temporizador de recuperación post-tajo (cooldown mínimo de espada) */
    this.swordCooldown = 0;
    /** @type {number} Tiempo mínimo de delay entre tajos de espada (160ms recovery + 200ms tajo = 360ms ciclo ágil) */
    this.SWORD_RECOVERY_TIME = 0.16;

    /** @type {number} Cooldown interno de curación del guante (2.5 segundos) */
    this.healCooldown = 0;
    this.healTimer = 0;

    /** @type {number} Cooldown anti-spam de parry para evitar reinicios infinitos */
    this.parryCooldown = 0;

    /** @type {number} Cooldown y estado de esquiva rápida (Dash) */
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.isDashing = false;
    this.dashSpeed = 0;
    this.dashDirection = new Vector2(0, 0);
    
    /** @type {Object<string, import('../combat/Ability.js').Ability>} */
    const earthAbility = new EarthAbility();
    this.abilities = {
      'Fuego': new FireAbility(),
      'Embestida': new KineticAbility(),
      'Plantas': earthAbility,
      'Raíces': earthAbility
      // El 4to elemento se desbloqueará progresivamente en el mundo
    };
    this.currentAbility = 'Fuego';
    this.sprite = null;
  }

  /**
   * Asigna la textura del sprite del jugador.
   * @param {HTMLImageElement|HTMLCanvasElement} sprite
   */
  setSprite(sprite) {
    this.sprite = sprite;
  }

  /**
   * Calcula la hitbox de barrido frontal en abanico (Sweeping Edge estilo Minecraft) según la orientación.
   * Cobertura amplia (72px de ancho lateral x 48px de profundidad) para golpear y repeler múltiples objetivos.
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  getSwordSweepHitbox() {
    const cx = this.pos.x + this.width / 2;
    const cy = this.pos.y + this.height / 2;

    switch (this.facing) {
      case 'up':
        return { x: cx - 36, y: cy - 52, width: 72, height: 48 };
      case 'down':
        return { x: cx - 36, y: cy + 4, width: 72, height: 48 };
      case 'left':
        return { x: cx - 52, y: cy - 36, width: 48, height: 72 };
      case 'right':
      default:
        return { x: cx + 4, y: cy - 36, width: 48, height: 72 };
    }
  }

  /**
   * Alias de compatibilidad para la hitbox de la espada.
   */
  getSwordHitbox() {
    return this.getSwordSweepHitbox();
  }

  equipAbility(name) {
    let targetName = name;
    if (targetName === 'Raíces' || targetName === 'Raices') targetName = 'Plantas';
    if (this.abilities[targetName]) {
      this.currentAbility = targetName;
      if (typeof window !== 'undefined' && window.DEBUG_MODE) {
        console.log(`[Player] Habilidad equipada: ${targetName}`);
      }
    }
  }

  /**
   * Inicia un dash físico con impulso direccional de alta velocidad.
   * @param {number} dx - Dirección en X (-1, 0, 1)
   * @param {number} dy - Dirección en Y (-1, 0, 1)
   * @param {number} speed - Velocidad en píxeles por segundo
   * @param {number} duration - Duración en segundos
   */
  startDash(dx, dy, speed = 420, duration = 0.25) {
    const len = Math.hypot(dx, dy) || 1;
    this.dashDirection.set(dx / len, dy / len);
    this.dashSpeed = speed;
    this.dashTimer = duration;
    this.stateTimer = duration;
    this.isDashing = true;
    this.applyEffect('iframe', duration + 0.05);
  }

  /**
   * Actualización lógica combinando teclado físico y Joystick Virtual.
   * @param {Object|number} contextOrDt - Objeto de contexto o deltaTime
   * @param {import('../core/InputManager.js').InputManager} [legacyInput]
   * @param {import('../systems/PhysicsSystem.js').PhysicsSystem} [legacyPhysics]
   */
  update(contextOrDt, legacyInput, legacyPhysics) {
    super.update(contextOrDt); // Para aplicar efectos temporales (Entity.js)
    
    const isContext = typeof contextOrDt === 'object' && contextOrDt !== null;
    const deltaTime = isContext ? contextOrDt.deltaTime : contextOrDt;
    const input = isContext ? contextOrDt.input : legacyInput;
    const physics = isContext ? contextOrDt.physics : legacyPhysics;
    const combatManager = isContext ? contextOrDt.combatManager : null;

    // 0. Aplicar habilidades del SkillTreeManager si está disponible
    const skillTree = isContext ? contextOrDt.skillTreeManager : null;
    if (skillTree) {
      this.max_health = PLAYER_STATS.max_health + (skillTree.hasSkill('max_health_up') ? 1 : 0);
      this.energy_regen_rate = PLAYER_STATS.energy_regen_rate + (skillTree.hasSkill('energy_regen') ? 2 : 0);
    }

    // Regeneración pasiva y gestión de temporizadores de utilidad
    if (this.fsmState !== 'STATE_GUARD_BREAK') {
      this.energy = Math.min(this.max_energy, this.energy + this.energy_regen_rate * deltaTime);
    }
    if (this.swordCooldown > 0) this.swordCooldown -= deltaTime;
    if (this.parryCooldown > 0) this.parryCooldown -= deltaTime;
    if (this.healCooldown > 0) this.healCooldown -= deltaTime;
    if (this.healTimer > 0) this.healTimer -= deltaTime;
    if (this.dashCooldown > 0) this.dashCooldown -= deltaTime;
    if (this.dashTimer > 0) {
      this.dashTimer -= deltaTime;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        // Restablecer el estado lógico a STATE_IDLE al finalizar el dash para liberar movimiento y ataque
        if (this.fsmState === 'STATE_DASH') {
          this.fsmState = 'STATE_IDLE';
        }
      }
    }

    // Sincronizar estado global con StateManager
    if (isContext && contextOrDt.state) {
      contextOrDt.state.set('player_energy', this.energy);
      contextOrDt.state.set('player_health', this.health);
      contextOrDt.state.set('player_max_health', this.max_health);
      contextOrDt.state.set('health_critical', this.health <= 1);
    }

    if (this.fsmState === 'STATE_GUARD_BREAK') {
      if (this.stateTimer > 0) {
        this.stateTimer -= deltaTime;
        if (this.stateTimer <= 0) {
          this.fsmState = 'STATE_IDLE';
        }
      }
    } else if (this.fsmState !== 'STATE_DEFEND') {
      if (this.stateTimer > 0) {
        this.stateTimer -= deltaTime;
        if (this.stateTimer <= 0) {
          this.fsmState = 'STATE_IDLE';
        }
      }
    }

    if (this.attackTimer > 0) {
      this.attackTimer -= deltaTime;
    }

    this.velocity.set(0, 0);

    let canMove = (this.fsmState === 'STATE_IDLE' || this.fsmState === 'STATE_MOVE') && !this.isDashing;
    let canAttack = (this.fsmState === 'STATE_IDLE' || this.fsmState === 'STATE_MOVE');
    let moveX = 0; 
    let moveY = 0;

    if (input) {
      // 1. Entradas de teclado físico usando KEYBINDINGS
      const isUp = KEYBINDINGS.UP.some(k => input.isKeyPressed(k));
      const isDown = KEYBINDINGS.DOWN.some(k => input.isKeyPressed(k));
      const isLeft = KEYBINDINGS.LEFT.some(k => input.isKeyPressed(k));
      const isRight = KEYBINDINGS.RIGHT.some(k => input.isKeyPressed(k));

      if (isUp) { moveY -= 1; this.facing = 'up'; }
      if (isDown) { moveY += 1; this.facing = 'down'; }
      if (isLeft) { moveX -= 1; this.facing = 'left'; }
      if (isRight) { moveX += 1; this.facing = 'right'; }

      // 2. Entrada de Joystick Táctil Virtual
      if (input.joystickVector && input.joystickVector.lengthSquared() > 0.02) {
        moveX += input.joystickVector.x;
        moveY += input.joystickVector.y;
        if (Math.abs(input.joystickVector.x) > Math.abs(input.joystickVector.y)) {
          this.facing = input.joystickVector.x > 0 ? 'right' : 'left';
        } else {
          this.facing = input.joystickVector.y > 0 ? 'down' : 'up';
        }
      }

      if (canMove) {
        this.velocity.x = moveX;
        this.velocity.y = moveY;
        if (moveX !== 0 || moveY !== 0) this.fsmState = 'STATE_MOVE';
        else this.fsmState = 'STATE_IDLE';
      }

      // Procesar Defensa y Postura con Límite al Spam de Parry
      if (this.fsmState !== 'STATE_GUARD_BREAK') {
        if (input.isDefendPressed) {
          if (this.fsmState !== 'STATE_DEFEND') {
            this.fsmState = 'STATE_DEFEND';
            if (this.parryCooldown <= 0) {
              this.stateTimer = 0; // Ventana de Parry perfecta abierta (0..0.15s)
              this.parryCooldown = 0.42; // Cooldown antes de poder reiniciar ventana de parry
            } else {
              this.stateTimer = 0.22; // Spam penalizado: defiende pero fuera de ventana de parry
            }
          } else {
            this.stateTimer += deltaTime;
          }
          canMove = false;
          canAttack = false;
          this.velocity.set(0, 0);
        } else if (this.fsmState === 'STATE_DEFEND') {
          this.fsmState = 'STATE_IDLE';
        }
      }

      // 3. Dash / Esquiva Rápida (Espacio / Botón Táctil) con CANCELACIÓN DE ANIMACIÓN
      // Permite abortar ataques lentos para reaccionar a embestidas del Duelista Implacable
      const canDashCancel = this.fsmState !== 'STATE_GUARD_BREAK' && !this.isDashing;
      if (input.isDashPressed && this.dashCooldown <= 0 && canDashCancel) {
        if (typeof input.consumeDash === 'function') input.consumeDash();
        const dashCost = PLAYER_STATS.dash_cost;
        if (this.energy >= dashCost) {
          this.energy -= dashCost;
          // Cooldown base 0.55s, con habilidad 'dash_cooldown' se reduce a 0.35s
          this.dashCooldown = (skillTree && skillTree.hasSkill('dash_cooldown')) ? PLAYER_STATS.dash_cooldown_upgraded : PLAYER_STATS.dash_cooldown_base;
          this.attackTimer = 0; // Abortar ataque activo inmediatamente (Animation Cancel)
          if (combatManager) {
            combatManager.cancelAttacksFrom(this); // Cancelar hitboxes activas del jugador
          }
          this.swordCooldown = PLAYER_STATS.sword_cooldown; // Reiniciar cooldown de espada tras esquiva
          this.fsmState = 'STATE_DASH';
          const dx = this.facing === 'right' ? 1 : this.facing === 'left' ? -1 : 0;
          const dy = this.facing === 'down' ? 1 : this.facing === 'up' ? -1 : 0;
          const useX = (moveX !== 0 || moveY !== 0) ? moveX : dx;
          const useY = (moveX !== 0 || moveY !== 0) ? moveY : dy;
          this.startDash(useX, useY, PLAYER_STATS.dash_speed, PLAYER_STATS.dash_duration);
        }
      }

      // 4. Curación Milenaria del Guante (Q / C / Botón Verde) — Habilidad Base
      if (input.isHealPressed && this.healCooldown <= 0 && canAttack) {
        if (typeof input.consumeHeal === 'function') input.consumeHeal();

        const healCost = PLAYER_STATS.heal_cost || 30;
        if (this.health < this.max_health) {
          if (this.energy >= healCost) {
            this.energy -= healCost;
            this.health = Math.min(this.max_health, this.health + 1);
            this.healCooldown = PLAYER_STATS.heal_cooldown || 2.5; // 2.5 segundos de cooldown
            this.healTimer = 0.85;   // Duración de animación y pulso curativo esmeralda
            if (isContext && contextOrDt.state) {
              contextOrDt.state.set('player_health', this.health);
              contextOrDt.state.set('health_critical', this.health <= 1);
            }
          }
        } else {
          // Si la salud ya está al máximo (3/3), no falla en silencio:
          // Activa un Escudo de Vitalidad con halo de protección
          const barrierCost = PLAYER_STATS.barrier_cost || 20;
          if (this.energy >= barrierCost) {
            this.energy -= barrierCost;
            this.healCooldown = 2.0;
            this.healTimer = 0.85;
            this.applyEffect('vitality_shield', 4.0);
            if (isContext && contextOrDt.state) {
              contextOrDt.state.set('active_dialogue', {
                speaker: 'GUANTELETE',
                text: '¡Salud al máximo! Escudo de Vitalidad activado.',
                timer: 2.5
              });
            }
          }
        }
      }

      // 5. Ataques y Sinergias (FSM)
      const tryTransition = (nextState) => {
        if (!canAttack) return false;
        if (!combatManager) return true;
        return combatManager.canCancel(this.fsmState, nextState);
      };

      // 5.1 Ataque de Espada Básico (Físico — Clic Izquierdo / J / Z / Botón Táctil)
      // Requiere que el ataque activo y el delay de recuperación (cooldown) hayan concluido
      if (input.isAttackPressed && this.attackTimer <= 0 && this.swordCooldown <= 0 && tryTransition('STATE_ATTACK_WEAK')) {
        if (typeof input.consumeAttack === 'function') input.consumeAttack();

        // Obtener estadísticas data-driven del arma equipada
        const equipmentManager = isContext ? contextOrDt.equipmentManager : null;
        const weapon = equipmentManager && equipmentManager.getWeapon ? equipmentManager.getWeapon() : null;
        const swordRecovery = weapon ? weapon.recoveryTime : this.SWORD_RECOVERY_TIME;
        const swordDuration = weapon ? weapon.duration : 0.22;
        const swordDamage = weapon ? weapon.damage : 16;
        const swordKnockback = weapon ? weapon.knockback : 32;
        const lungeForce = weapon ? weapon.lungeForce : 10;

        this.fsmState = 'STATE_ATTACK_WEAK';
        this.attackTimer = swordDuration;
        this.stateTimer = swordDuration;
        this.swordCooldown = swordRecovery;

        // Mecánica Push-Forward: paso frontal hacia el enemigo al atacar
        const lungeX = this.pos.x + (this.facing === 'right' ? lungeForce : this.facing === 'left' ? -lungeForce : 0);
        const lungeY = this.pos.y + (this.facing === 'down' ? lungeForce : this.facing === 'up' ? -lungeForce : 0);
        if (physics && typeof physics.moveWithCollisions === 'function') {
          const safePos = physics.moveWithCollisions(this, lungeX, lungeY);
          this.pos.set(safePos.x, safePos.y);
        } else {
          this.pos.set(lungeX, lungeY);
        }

        const cx = this.pos.x + this.width / 2;
        const cy = this.pos.y + this.height / 2;

        if (combatManager) {
          combatManager.addAttack({
            owner: this,
            type: 'weak',
            element: 'physical',
            damage: swordDamage,
            duration: swordDuration,
            hitbox: this.getSwordSweepHitbox(),
            destroyOnHit: false,
            hitEntities: new Set(),
            isSweep: true,
            facing: this.facing,
            originX: cx,
            originY: cy,
            knockbackForce: swordKnockback
          });
        }
      }

      // 5.2 Habilidad Elemental Equipada (Clic Derecho / K / X / Tap Táctil)
      if (input.isAbilityPressed && this.attackTimer <= 0 && tryTransition('STATE_ATTACK_WEAK')) {
        if (typeof input.consumeAbility === 'function') input.consumeAbility();
        const ab = this.abilities[this.currentAbility];
        const abilityCost = 15; // Coste estándar de energía elemental
        if (ab && this.energy >= abilityCost) {
          this.energy -= abilityCost;
          this.fsmState = 'STATE_ATTACK_WEAK';
          const context = isContext ? contextOrDt : {};
          const dur = ab.executeWeak(this, context);
          this.attackTimer = dur;
          this.stateTimer = dur;
        }
      }

      // 5.3 Ataque Elemental Fuerte (KeyL / Combinaciones)
      if (input.isStrongAttackPressed && tryTransition('STATE_ATTACK_STRONG')) {
        if (typeof input.consumeStrongAttack === 'function') input.consumeStrongAttack();
        if (this.fsmState !== 'STATE_ATTACK_STRONG' && this.attackTimer <= 0) {
          const ab = this.abilities[this.currentAbility];
          const strongCost = 30;
          if (ab && this.energy >= strongCost) {
            const context = isContext ? contextOrDt : {};
            const dur = ab.executeStrong(this, context);
            if (dur > 0) {
              this.energy -= strongCost;
              this.fsmState = 'STATE_ATTACK_STRONG';
              this.stateTimer = dur;
              this.attackTimer = dur;
            }
          }
        }
      }
    }

    let nextX, nextY;
    if (this.isDashing && this.dashTimer > 0) {
      // Física pura de Dash de alta velocidad sin clamping de caminar
      const dashDistX = this.dashDirection.x * this.dashSpeed * deltaTime;
      const dashDistY = this.dashDirection.y * this.dashSpeed * deltaTime;
      this.velocity.set(this.dashDirection.x * this.dashSpeed, this.dashDirection.y * this.dashSpeed);
      nextX = this.pos.x + dashDistX;
      nextY = this.pos.y + dashDistY;
    } else {
      // Movimiento normal a pie
      if (this.velocity.lengthSquared() > 1) {
        this.velocity.normalize();
      }
      this.velocity.multiplyScalar(this.speed * deltaTime);
      nextX = this.pos.x + this.velocity.x;
      nextY = this.pos.y + this.velocity.y;
    }

    // Resolver colisiones
    if (physics) {
      const finalPos = physics.moveWithCollisions(this, nextX, nextY);
      this.pos.set(finalPos.x, finalPos.y);
    } else {
      this.pos.set(nextX, nextY);
    }
  }

  /**
   * Renderizado visual estilizado del héroe y su tajo de espada.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);

    if (this.sprite) {
      ctx.drawImage(this.sprite, x, y, this.width, this.height);
      return;
    }

    // 1. Sombra suave en el suelo
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x + 16, y + 29, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Capa trasera
    ctx.fillStyle = '#1d4ed8'; // Azul
    ctx.fillRect(x + 7, y + 14, 18, 14);

    // 3. Túnica del héroe
    ctx.fillStyle = '#16a34a'; // Verde
    ctx.fillRect(x + 9, y + 14, 14, 12);

    // 4. Cinturón y Reliquia Milenaria
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + 9, y + 21, 14, 3);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(x + 14, y + 20, 4, 5);

    // 5. Cabeza / Rostro
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(x + 9, y + 6, 14, 10);

    // 6. Cabello
    ctx.fillStyle = '#b45309';
    ctx.fillRect(x + 8, y + 3, 16, 5);
    ctx.fillRect(x + 7, y + 5, 3, 7);

    // 7. Ojos pixel art según la dirección
    ctx.fillStyle = '#0f172a';
    if (this.facing === 'left') {
      ctx.fillRect(x + 10, y + 10, 2, 3);
    } else if (this.facing === 'right') {
      ctx.fillRect(x + 20, y + 10, 2, 3);
    } else {
      ctx.fillRect(x + 12, y + 10, 2, 3);
      ctx.fillRect(x + 18, y + 10, 2, 3);
    }

    // 8. El efecto visual de Tajo de Espada es renderizado por VFXRenderer (Sweeping Edge)
    // para evitar duplicación de trazos y desalineación de capas.

    // 9. Aura y destellos de Curación Milenaria del Guante
    if (this.healTimer > 0) {
      this._drawHealEffect(ctx, x, y);
    }

    // 10. Estela de velocidad si está en Dash
    if (this.isDashing) {
      this._drawDashTrail(ctx, x, y);
    }
  }

  /**
   * Renderiza el pulso curativo sacro bajo los pies del héroe.
   * @private
   */
  _drawHealEffect(ctx, px, py) {
    ctx.save();
    const cx = px + 16;
    const cy = py + 26;
    const progress = Math.max(0, this.healTimer / 0.85);
    const radius = 22 * (1 - progress * 0.4);

    // Anillo rúnico dorado/esmeralda
    ctx.strokeStyle = 'rgba(74, 222, 128, ' + (progress * 0.9) + ')';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Resplandor interior
    ctx.fillStyle = 'rgba(250, 204, 21, ' + (progress * 0.35) + ')';
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * 0.7, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Motes ascendentes de luz
    for (let i = 0; i < 4; i++) {
      const angle = (Date.now() / 200 + i * (Math.PI / 2));
      const mx = cx + Math.cos(angle) * (radius * 0.6);
      const my = cy - ((1 - progress) * 28) + Math.sin(angle) * 4;
      ctx.fillStyle = 'rgba(244, 244, 245, ' + (progress) + ')';
      ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }

    ctx.restore();
  }

  /**
   * Renderiza la estela de velocidad traslúcida (Ghost Afterimage).
   * @private
   */
  _drawDashTrail(ctx, px, py) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#38bdf8';
    // Silueta rápida detrás del jugador
    const backX = px - (this.facing === 'right' ? 8 : this.facing === 'left' ? -8 : 0);
    const backY = py - (this.facing === 'down' ? 8 : this.facing === 'up' ? -8 : 0);
    ctx.fillRect(backX + 8, backY + 12, 16, 16);
    ctx.restore();
  }

}
