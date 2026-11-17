import { Entity } from './Entity.js';
import { Vector2 } from '../utils/Vector2.js';
import { FireAbility } from '../combat/FireAbility.js';
import { KineticAbility } from '../combat/KineticAbility.js';
import { EarthAbility } from '../combat/EarthAbility.js';
import { PLAYER_STATS } from '../data/PlayerStats.js';
import { KEYBINDINGS } from '../core/InputManager.js';
import { CelSpriteAtlas } from '../render/CelSpriteAtlas.js';

/**
 * @module Player
 * @description Entidad principal controlada por el jugador con arquitectura de combate AAA (v3.1):
 * - Cadena rítmica de Espada de 3 golpes (Corte Diestro -> Revés Cruzado -> Tajo Sacro Circular / Torbellino 360°) + Ondas de Filo.
 * - Ventana de "Tempo Perfecto" y cola de pre-entrada (Input Queueing) para cero comandos perdidos.
 * - Dash-Strike (Estocada Relámpago + Pulso de Plasma), Asalto Fantasma y Spell-Weaving.
 * - Integración 100% coherente con los 18 talentos de `SkillTreeManager` y estadísticas de `weapons.js`.
 * - Pool de estelas fantasma libre de asignaciones GC (`_ghostPool` + swap-and-pop).
 * @author Be a Legend Team
 * @version 3.1.0
 */
export class Player extends Entity {
  /**
   * @param {number} x - Posición X inicial
   * @param {number} y - Posición Y inicial
   */
  constructor(x, y) {
    super(x, y, 32, 32);
    this.spawnX = x;
    this.spawnY = y;
    this.color = '#4CAF50';
    this.tags.push('player');

    /** @type {number} Velocidad base de desplazamiento en píxeles por segundo */
    this.speed = PLAYER_STATS.speed || 190;

    /** @type {Vector2} Vector de velocidad del fotograma actual */
    this.velocity = new Vector2(0, 0);

    /** @type {'up'|'down'|'left'|'right'} Orientación cardinal dominante */
    this.facing = 'down';

    /** @type {number} Ángulo preciso de apuntado en radianes (360°) */
    this.aimAngle = Math.PI / 2;

    /** @type {Vector2} Vector unitario de apuntado para tajos, proyectiles y embestidas */
    this.aimDir = new Vector2(0, 1);

    // Hitbox precisa en la base de los pies para Y-Sorting y deslizamiento suave
    this.hitbox = {
      offsetX: 6,
      offsetY: 18,
      width: 20,
      height: 14
    };
    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;

    /** @type {string} Estado actual de la Máquina de Estados Finita (FSM) */
    this.fsmState = 'STATE_IDLE';
    this.stateTimer = 0;

    // --- Atributos Vitales y Recursos ---
    this.health = PLAYER_STATS.health || 3;
    this.max_health = PLAYER_STATS.max_health || 3;
    this.energy = PLAYER_STATS.energy || 100;
    this.max_energy = PLAYER_STATS.max_energy || 100;
    this.guard_meter = PLAYER_STATS.guard_meter || 100;
    this.max_guard = PLAYER_STATS.max_guard || 100;
    this.energy_regen_rate = PLAYER_STATS.energy_regen_rate || 6;

    // --- Sistema de Resistencia (Stamina) y Sprint ---
    this.stamina = 100;
    this.max_stamina = 100;
    this.isSprinting = false;
    this.staminaExhausted = false;

    // --- Sistema de Sigilo (Prone / Grama Alta estilo The Last of Us 2) ---
    this.isProne = false;
    this.inTallGrass = false;
    this.isStealthHidden = false;

    // --- Sistema de Combo Rítmico AAA y Pre-Buffer ---
    /** @type {number} Temporizador activo del swing actual */
    this.attackTimer = 0;
    /** @type {number} Paso actual en la cadena de 3 golpes (0 = listo para golpe 1, 1 = golpe 2, 2 = finisher 3) */
    this.comboStep = 0;
    /** @type {number} Tiempo restante para continuar la cadena antes de reiniciar al golpe 1 */
    this.comboWindowTimer = 0;
    /** @type {number} Cooldown breve tras completar el 3er golpe (Finisher) */
    this.swordCooldown = 0;
    this.SWORD_RECOVERY_TIME = 0.08;
    /** @type {string|null} Acción pre-encolada en los últimos milisegundos de una animación ('attack'|'ability'|'strong') */
    this.queuedAction = null;

    // --- Temporizadores de Utilidad, Defensa y Daño ---
    this.healCooldown = 0;
    this.healTimer = 0;
    this.parryCooldown = 0;
    this.parryWindowDuration = PLAYER_STATS.parry_window_base || 0.16;
    this.hurtTimer = 0;

    // --- Física de Esquiva (Dash) y Pool Zero-GC de Estelas Fantasma ---
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.isDashing = false;
    this.dashSpeed = 0;
    this.dashDirection = new Vector2(0, 0);
    /** @type {Array<{x: number, y: number, alpha: number, color: string}>} Estelas activas en coordenadas de mundo */
    this.dashGhosts = [];
    /** @private Pool reutilizable de estelas para evitar presión sobre el Garbage Collector */
    this._ghostPool = [];
    this._ghostSpawnAccum = 0;

    // --- Animación Procedural (Squash & Stretch + Bobbing + Reloj determinista) ---
    this.walkCycle = 0;
    this.animClock = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;

    // --- Arsenal Elemental del Guantelete y Progresión Diegética ---
    const kineticAbility = new KineticAbility();
    const earthAbility = new EarthAbility();
    this.abilities = {
      'Fuego': new FireAbility(),
      'Embestida': kineticAbility,
      'Kinetic': kineticAbility,
      'Plantas': earthAbility,
      'Raíces': earthAbility
    };
    /** @type {Set<string>} Elementos despertados actualmente en el Guantelete */
    this.unlockedElements = new Set(['Fuego', 'Embestida', 'Plantas']);
    this.currentAbility = 'Fuego';
    /** @type {boolean} Indica si el héroe ya recogió la Espada del Alba frente a la cueva */
    this.hasSword = true;
    this._dormantHintCooldown = 0;
    this.sprite = null;
  }

  /**
   * Configura el Guantelete en estado latente inicial (Cero Disonancia Ludonarrativa al salir de la cueva).
   * El jugador inicia sin espada ni poderes elementales hasta empuñar la Espada del Alba frente a la cueva.
   */
  configureDormantStart() {
    this.unlockedElements.clear();
    this.hasSword = false;
  }

  /**
   * Desbloquea y equipa la Espada del Alba al recogerla en el umbral de la cueva.
   */
  unlockSword() {
    this.hasSword = true;
  }

  /**
   * Normaliza alias de nombres elementales hacia las claves canónicas del Guantelete.
   * Garantiza compatibilidad entre `'Kinetic'`/`'Embestida'` y `'Raíces'`/`'Plantas'`.
   * @private
   * @param {string} name
   * @returns {string}
   */
  _normalizeElementName(name) {
    if (!name) return '';
    const key = String(name).trim().toLowerCase();
    if (key === 'kinetic' || key === 'cinetico' || key === 'cinético' || key === 'embestida') {
      return 'Embestida';
    }
    if (key === 'raíces' || key === 'raices' || key === 'tierra' || key === 'earth' || key === 'plantas') {
      return 'Plantas';
    }
    if (key === 'fire' || key === 'fuego') {
      return 'Fuego';
    }
    return name;
  }

  /**
   * Despierta un conducto elemental específico en el Guantelete.
   * @param {string} name
   */
  unlockElement(name) {
    const targetName = this._normalizeElementName(name);
    if (this.abilities[targetName]) {
      this.unlockedElements.add(targetName);
      this.currentAbility = targetName;
    }
  }

  /**
   * Despierta los 3 conductos elementales primordiales (Altar del Santuario / Modo Horda).
   */
  unlockAllElements() {
    this.unlockedElements.add('Fuego');
    this.unlockedElements.add('Embestida');
    this.unlockedElements.add('Plantas');
  }

  /**
   * Consulta si un elemento ya ha sido despertado en el Guantelete.
   * @param {string} name
   * @returns {boolean}
   */
  hasElement(name) {
    const targetName = this._normalizeElementName(name);
    return this.unlockedElements.has(targetName);
  }

  /**
   * Asigna una textura externa opcional para el jugador.
   * @param {HTMLImageElement|HTMLCanvasElement} sprite
   */
  setSprite(sprite) {
    this.sprite = sprite;
  }

  /**
   * Retorna el vector unitario de apuntado actual del héroe.
   * @returns {{x: number, y: number, angle: number}}
   */
  getAimVector() {
    return {
      x: this.aimDir.x,
      y: this.aimDir.y,
      angle: this.aimAngle
    };
  }

  /**
   * Sincroniza la orientación cardinal (`facing`) a partir de un vector direccional.
   * @private
   * @param {number} dx
   * @param {number} dy
   */
  _syncFacingFromVector(dx, dy) {
    if (dx === 0 && dy === 0) return;
    const len = Math.hypot(dx, dy) || 1;
    this.aimDir.set(dx / len, dy / len);
    this.aimAngle = Math.atan2(this.aimDir.y, this.aimDir.x);

    if (Math.abs(dx) >= Math.abs(dy)) {
      this.facing = dx >= 0 ? 'right' : 'left';
    } else {
      this.facing = dy >= 0 ? 'down' : 'up';
    }
  }

  /**
   * Calcula el vector de apuntado óptimo y orientación cardinal:
   * Garantiza que TODOS los ataques salgan fielmente hacia la dirección de movimiento activa
   * (WASD, Flechas o Joystick Táctil en 8 direcciones / 360°) o hacia la orientación cardinal
   * actual (`this.facing`) cuando el héroe está quieto, evitando que el cursor del ratón bloquee
   * los ataques hacia la derecha.
   * @private
   * @param {import('../core/InputManager.js').InputManager} input
   * @param {import('../render/Camera.js').Camera} camera
   * @param {number} moveX
   * @param {number} moveY
   */
  _updateSmartAim(input, camera, moveX, moveY) {
    // 1. Si hay entrada direccional activa en este fotograma (WASD / Flechas / Joystick), usarla siempre
    if (moveX !== 0 || moveY !== 0) {
      this._syncFacingFromVector(moveX, moveY);
      return;
    }

    // 2. Si el joystick virtual tiene inclinación activa, orientar según el joystick
    if (input && input.joystickVector && input.joystickVector.lengthSquared() > 0.02) {
      this._syncFacingFromVector(input.joystickVector.x, input.joystickVector.y);
      return;
    }

    // 3. Si está quieto, respetar estrictamente la orientación actual del héroe (up, down, left, right)
    const fx = this.facing === 'right' ? 1 : this.facing === 'left' ? -1 : 0;
    const fy = this.facing === 'down' ? 1 : this.facing === 'up' ? -1 : 0;
    if (fx !== 0 || fy !== 0) {
      // Si aimDir ya coincide con el cuadrante de facing (ej. diagonal reciente), conservarlo; si no, alinear a facing
      const dot = this.aimDir.x * fx + this.aimDir.y * fy;
      if (dot < 0.5) {
        this._syncFacingFromVector(fx, fy);
      } else {
        this.aimAngle = Math.atan2(this.aimDir.y, this.aimDir.x);
      }
    }
  }

  /**
   * Calcula la caja de colisión del barrido de espada proyectada dinámicamente en `aimDir`.
   * @param {number} [reachScale=1.0] - Multiplicador de alcance (mayor en Finisher y Dash-Strike)
   * @param {number} [sizeScale=1.0] - Multiplicador de amplitud del área de corte
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  getSwordSweepHitbox(reachScale = 1.0, sizeScale = 1.0) {
    const cx = this.pos.x + this.width / 2;
    const cy = this.pos.y + this.height / 2;
    const reach = 26 * reachScale;
    const boxW = Math.round(64 * sizeScale);
    const boxH = Math.round(64 * sizeScale);

    const centerX = cx + this.aimDir.x * reach;
    const centerY = cy + this.aimDir.y * reach;

    return {
      x: centerX - boxW / 2,
      y: centerY - boxH / 2,
      width: boxW,
      height: boxH
    };
  }

  /**
   * Alias de compatibilidad para consultas de hitbox de espada.
   */
  getSwordHitbox() {
    return this.getSwordSweepHitbox();
  }

  /**
   * Equipa una habilidad elemental en el Guantelete si su engarce ya fue despertado.
   * @param {string} name
   * @returns {boolean} true si se equipó con éxito
   */
  equipAbility(name) {
    const targetName = this._normalizeElementName(name);
    if (!this.hasElement(targetName)) {
      return false;
    }
    if (this.abilities[targetName]) {
      this.currentAbility = targetName;
      return true;
    }
    return false;
  }

  /**
   * Inicia un impulso direccional de alta velocidad con fotogramas de invulnerabilidad (Iframes).
   * @param {number} dx
   * @param {number} dy
   * @param {number} [speed=420]
   * @param {number} [duration=0.22]
   */
  startDash(dx, dy, speed = 420, duration = 0.22) {
    const len = Math.hypot(dx, dy) || 1;
    this.dashDirection.set(dx / len, dy / len);
    this._syncFacingFromVector(this.dashDirection.x, this.dashDirection.y);
    this.dashSpeed = speed;
    this.dashTimer = duration;
    this.stateTimer = duration;
    this.isDashing = true;
    this.scaleX = 1.24;
    this.scaleY = 0.80;
    this.applyEffect('iframe', duration + 0.06);
  }

  /**
   * Procesa el impacto de un ataque hostil sobre el héroe cuando no fue bloqueado ni desviado.
   * Gestiona Iframes, Escudo de Vitalidad, pérdida de corazones, retroceso físico y Renacimiento.
   * @param {number} amount - Daño entrante
   * @param {Object} attack - Datos del ataque enemigo
   * @param {Object} context - Contexto global del motor
   */
  takeDamage(amount, attack, context = {}) {
    if (this.hasTag('iframe')) return;

    // 1. Verificar Escudo de Vitalidad / Halo de la Égida Eterna (absorbe 1 golpe completo sin perder vida)
    if (this.hasTag('vitality_shield')) {
      this.activeEffects.delete('vitality_shield');
      this.applyEffect('iframe', 0.55);
      this._haloCooldown = 18.0;
      if (context.skillTreeManager && context.skillTreeManager.hasSkill('relic_aegis_halo')) {
        this.energy = Math.min(this.max_energy, this.energy + 20);
      }
      if (context.audioManager) context.audioManager.playHeal();
      if (context.vfxRenderer) {
        context.vfxRenderer.spawnImpact('parry_spark', this.pos.x + 16, this.pos.y + 16, { radius: 34, duration: 0.35 });
      }
      if (context.uiManager && context.camera) {
        context.uiManager.spawnDamageNumber(this.pos.x + 16, this.pos.y - 4, '¡ESCUDO!', '#4ade80');
      }
      if (context.camera) context.camera.shake(0.25, 0.14);
      return;
    }

    // 2. Aplicar daño real (1 corazón por golpe estándar para legibilidad táctica limpia)
    const heartLoss = (attack && attack.heartDamage) ? attack.heartDamage : 1;
    this.health = Math.max(0, this.health - heartLoss);
    this.hurtTimer = 0.32;
    this.scaleX = 0.78;
    this.scaleY = 1.25;
    this.applyEffect('iframe', 1.05);

    // Interrumpir swing actual conservando magias/pesados encolados para respuesta inmediata al daño
    this.comboStep = 0;
    this.comboWindowTimer = 0;
    this.fsmState = 'STATE_IDLE';
    this.attackTimer = 0;
    this.stateTimer = 0;
    if (this.queuedAction === 'attack') {
      this.queuedAction = null;
    }
    if (context.combatManager) {
      context.combatManager.resetCombo(context);
    }

    // Feedback audiovisual y físico AAA
    if (context.audioManager) context.audioManager.playPlayerHurt();
    if (context.engine) context.engine.hitStop(0.075);
    if (context.camera) context.camera.shake(0.55, 0.26);
    if (context.vfxRenderer) {
      context.vfxRenderer.spawnImpact('fire_burst', this.pos.x + 16, this.pos.y + 16, { radius: 26, duration: 0.28, color: '#ef4444' });
    }
    if (context.uiManager && context.camera) {
      context.uiManager.spawnDamageNumber(this.pos.x + 16, this.pos.y - 4, `-${heartLoss} ♥`, '#ef4444');
    }

    // Knockback lejos de la fuente del golpe
    if (attack && attack.hitbox && context.combatManager) {
      const ax = attack.hitbox.x + attack.hitbox.width / 2;
      const ay = attack.hitbox.y + attack.hitbox.height / 2;
      context.combatManager._applyKnockback(this, ax, ay, 24, context.physics || null);
    }

    // 3. Protocolo de Voluntad Inquebrantable (`undying_resolve`) o Renacimiento de la Reliquia
    if (this.health <= 0) {
      const hasUndying = !!(context.skillTreeManager && context.skillTreeManager.hasSkill('undying_resolve'));
      if (hasUndying && (this._undyingCooldown || 0) <= 0 && this.energy >= 15) {
        this.energy -= 15;
        this.health = 1;
        this._undyingCooldown = 45.0;
        this.applyEffect('iframe', 1.45);
        if (context.camera) context.camera.shake(0.45, 0.25);
        if (context.vfxRenderer) {
          context.vfxRenderer.spawnImpact('aegis_nova', this.pos.x + 16, this.pos.y + 16, { radius: 74, duration: 0.35 });
        }
        if (context.uiManager && context.camera) {
          context.uiManager.spawnDamageNumber(this.pos.x + 16, this.pos.y - 12, '¡VOLUNTAD INQUEBRANTABLE!', '#fde047');
        }
      } else {
        this._triggerRelicRebirth(context);
      }
    }

    if (context.state) {
      context.state.set('player_health', this.health);
      context.state.set('health_critical', this.health <= 1);
    }
  }

  /**
   * Cuando la salud llega a 0, el Guantelete libera una onda lumínica de emergencia
   * y restaura al héroe sin bloquear la sesión de juego. Si posee `max_health_up`,
   * detona in-situ una Supernova de Renacimiento que daña y aturde a toda la horda.
   * @private
   */
  _triggerRelicRebirth(context) {
    const hasSupernova = !!(context && context.skillTreeManager && context.skillTreeManager.hasSkill('max_health_up'));

    this.health = this.max_health;
    this.energy = this.max_energy;
    this.guard_meter = this.max_guard;
    this.fsmState = 'STATE_IDLE';
    this.isDashing = false;
    this.healTimer = 1.0;
    this.applyEffect('iframe', 2.2);
    this.applyEffect('vitality_shield', 3.5);

    if (!hasSupernova) {
      // Reposicionar suavemente en el último punto sagrado armonizado
      this.pos.set(this.spawnX, this.spawnY);
    }

    const cx = this.pos.x + 16;
    const cy = this.pos.y + 16;

    if (hasSupernova && context && context.combatManager) {
      if (context.vfxRenderer) {
        context.vfxRenderer.spawnImpact('aegis_nova', cx, cy, { radius: 92, duration: 0.52 });
      }
      context.combatManager.addAttack({
        owner: this,
        isFriendlySynergy: true,
        type: 'synergy',
        element: 'physical',
        damage: 60,
        duration: 0.22,
        isSweep: true,
        originX: cx,
        originY: cy,
        knockbackForce: 52,
        applyEffect: { tag: 'staggered', duration: 3.0 },
        hitEntities: new Set(),
        hitbox: {
          x: cx - 90,
          y: cy - 90,
          width: 180,
          height: 180
        }
      });
    }

    if (context.audioManager) context.audioManager.playExplosion();
    if (context.camera) context.camera.shake(0.7, 0.35);
    if (context.vfxRenderer) {
      context.vfxRenderer.spawnImpact('parry_spark', cx, cy, { radius: 64, duration: 0.55 });
    }
    if (context.state) {
      context.state.set('active_dialogue', {
        speaker: 'ECO DE TARAK',
        text: hasSupernova
          ? '¡Supernova de Renacimiento! El Corazón de Cristal ha fulminado y aturdido a la horda.'
          : '¡No caigas aún, Santi! La Reliquia ha restaurado tu luz vital en el Claro Sagrado.',
        timer: 4.0
      });
    }
  }

  /**
   * Ejecuta el ataque de espada rítmico correspondiente (Paso 1, Paso 2, Finisher 3 o Dash-Strike).
   * Conecta `weapons.js` (`recoveryTime`, `damage`, `knockback`, `lungeForce`) y todos los talentos
   * de esgrima y agilidad (`blade_tempo`, `combo_mastery`, `whirlwind_finisher`, `dash_cooldown`, `kinetic_overdrive`).
   * @private
   */
  _executeSwordCombo(context, input, physics, combatManager, equipmentManager, skillTree) {
    const weapon = equipmentManager && equipmentManager.getWeapon ? equipmentManager.getWeapon() : null;
    const baseDamage = weapon ? weapon.damage : 16;
    const baseKnockback = weapon ? weapon.knockback : 32;
    const baseLunge = weapon ? weapon.lungeForce : 11;
    const weaponRecovery = weapon && typeof weapon.recoveryTime === 'number' ? weapon.recoveryTime : 0.16;

    const tempoRank = skillTree ? skillTree.getSkillRank('blade_tempo') : 0;
    const masteryRank = skillTree ? skillTree.getSkillRank('combo_mastery') : 0;
    const whirlwindRank = skillTree ? skillTree.getSkillRank('whirlwind_finisher') : 0;
    const dashRank = skillTree ? skillTree.getSkillRank('dash_cooldown') : 0;
    const overdriveRank = skillTree ? skillTree.getSkillRank('kinetic_overdrive') : 0;
    const crimsonRank = skillTree ? skillTree.getSkillRank('crimson_momentum') : 0;
    const hasAscension = !!(skillTree && skillTree.hasSkill('blade_ascension'));

    const hasBladeTempo = tempoRank >= 1;
    const hasComboMastery = masteryRank >= 1;
    const hasWhirlwind = whirlwindRank >= 1;
    const hasDashUpgrade = dashRank >= 1;
    const hasKineticOverdrive = overdriveRank >= 1;

    // Multiplicador de daño según Rango de Estilo actual + `crimson_momentum`
    let styleBonus = combatManager ? combatManager.getStyleDamageMultiplier() : 1.0;
    if (crimsonRank >= 1 && combatManager && combatManager.styleScore >= 65) {
      styleBonus += crimsonRank === 1 ? 0.18 : 0.30;
    }

    // Caso Especial AAA: DASH-STRIKE (Estocada Relámpago si atacas durante el Dash)
    if (this.isDashing && this.dashTimer > 0.02) {
      this.isDashing = false;
      this.dashTimer = 0;

      const dashUpgradeMult = 1.0 + dashRank * 0.10;
      const strikeDamage = Math.round(baseDamage * 1.40 * dashUpgradeMult * styleBonus);
      const duration = 0.18;

      this.fsmState = 'STATE_ATTACK_WEAK';
      this.attackTimer = duration;
      this.stateTimer = duration;
      this.swordCooldown = 0.04;
      this.comboStep = 1; // Encadena directo al Golpe 2 tras el Dash-Strike
      this.comboWindowTimer = 0.72;
      this.scaleX = 1.28;
      this.scaleY = 0.78;

      // Impulso perforante hacia adelante
      const lungeDist = 22 * (1 + tempoRank * 0.1);
      const targetX = this.pos.x + this.aimDir.x * lungeDist;
      const targetY = this.pos.y + this.aimDir.y * lungeDist;
      if (physics && typeof physics.moveWithCollisions === 'function') {
        const safe = physics.moveWithCollisions(this, targetX, targetY);
        this.pos.set(safe.x, safe.y);
      } else {
        this.pos.set(targetX, targetY);
      }

      if (context.audioManager) context.audioManager.playSwordSwing(2, true, true);

      if (combatManager) {
        const self = this;
        const cxDash = this.pos.x + this.width / 2;
        const cyDash = this.pos.y + this.height / 2;

        combatManager.addAttack({
          owner: this,
          type: 'weak',
          element: 'physical',
          damage: strikeDamage,
          duration,
          maxDuration: duration,
          hitbox: this.getSwordSweepHitbox(1.35, 1.05),
          destroyOnHit: false,
          hitEntities: new Set(),
          isSweep: true,
          isDashStrike: true,
          comboStep: 2,
          swingDir: 1,
          facing: this.facing,
          aimAngle: this.aimAngle,
          aimDir: { x: this.aimDir.x, y: this.aimDir.y },
          originX: cxDash,
          originY: cyDash,
          knockbackForce: baseKnockback * (1.2 + overdriveRank * 0.12),
          update: function () {
            this.facing = self.facing;
            this.aimAngle = self.aimAngle;
            this.aimDir.x = self.aimDir.x;
            this.aimDir.y = self.aimDir.y;
            this.originX = self.pos.x + self.width / 2;
            this.originY = self.pos.y + self.height / 2;
            this.hitbox = self.getSwordSweepHitbox(1.35, 1.05);
          }
        });

        // Talento `kinetic_overdrive`: descarga un Pulso de Plasma AoE al ejecutar Dash-Strike (escalado por rango)
        if (hasKineticOverdrive) {
          const pulseX = cxDash + this.aimDir.x * 20;
          const pulseY = cyDash + this.aimDir.y * 20;
          if (context.vfxRenderer) {
            context.vfxRenderer.spawnImpact('plasma_pulse', pulseX, pulseY, { radius: 48 + overdriveRank * 6, duration: 0.30 });
          }
          combatManager.addAttack({
            owner: this,
            isFriendlySynergy: true,
            type: 'synergy',
            element: 'kinetic',
            damage: 16 + overdriveRank * 7,
            duration: 0.16,
            isSweep: true,
            originX: pulseX,
            originY: pulseY,
            knockbackForce: baseKnockback * 1.2,
            applyEffect: { tag: 'armor_break', duration: 3.0 },
            secondaryEffect: { tag: 'staggered', duration: 1.0 },
            hitEntities: new Set(),
            hitbox: {
              x: pulseX - 52,
              y: pulseY - 52,
              width: 104,
              height: 104
            }
          });
        }
      }
      return;
    }

    // Determinar si estamos dentro de la ventana de combo y si acertamos el "Tempo Perfecto"
    if (this.comboWindowTimer <= 0) {
      this.comboStep = 0;
    }
    const isPerfectTempo = this.comboStep > 0 && this.comboWindowTimer >= 0.36;
    const currentStep = this.comboStep + 1; // 1, 2 o 3
    const isFinisher = currentStep === 3;

    // Configuración rítmica por golpe + mejoras multi-rango de `blade_tempo`, `combo_mastery` y `whirlwind_finisher`
    const stepDuration = isFinisher ? 0.23 : 0.165;
    const tempoBonus = 1.12 + tempoRank * 0.08;
    const masteryDamageBoost = currentStep >= 2 ? (1 + masteryRank * 0.12) : 1.0;
    const damageMult = (isFinisher ? 1.65 : currentStep === 2 ? 1.20 : 1.0) * masteryDamageBoost * (isPerfectTempo ? tempoBonus : 1.0) * styleBonus;
    const lungeMult = 1.0 + tempoRank * 0.1;
    const lungeDist = (isFinisher ? baseLunge * 1.65 : (currentStep === 2 ? baseLunge * 1.18 : baseLunge)) * lungeMult;
    const whirlwindKbMult = (isFinisher && hasWhirlwind) ? (1.12 + whirlwindRank * 0.08) : 1.0;
    const knockback = (isFinisher ? baseKnockback * 1.55 : baseKnockback) * whirlwindKbMult;
    const swingDir = currentStep === 2 ? -1 : 1; // Alterna Derecha->Izquierda y luego Izquierda->Derecha

    this.fsmState = isFinisher ? 'STATE_ATTACK_STRONG' : 'STATE_ATTACK_WEAK';
    this.attackTimer = stepDuration;
    this.stateTimer = stepDuration;

    if (isFinisher) {
      this.comboStep = 0;
      this.comboWindowTimer = 0;
      const baseFinisherRecovery = weaponRecovery + 0.04;
      this.swordCooldown = baseFinisherRecovery * Math.max(0.65, 1.0 - masteryRank * 0.09);
      this.scaleX = 1.26;
      this.scaleY = 0.82;
    } else {
      this.comboStep = currentStep;
      this.comboWindowTimer = stepDuration + 0.65;
      this.swordCooldown = 0.02;
      this.scaleX = currentStep === 2 ? 0.88 : 1.16;
      this.scaleY = currentStep === 2 ? 1.14 : 0.88;
    }

    // Push-Forward Combat: micro-avance en la dirección exacta del tajo
    const lungeX = this.pos.x + this.aimDir.x * lungeDist;
    const lungeY = this.pos.y + this.aimDir.y * lungeDist;
    if (physics && typeof physics.moveWithCollisions === 'function') {
      const safePos = physics.moveWithCollisions(this, lungeX, lungeY);
      this.pos.set(safePos.x, safePos.y);
    } else {
      this.pos.set(lungeX, lungeY);
    }

    if (context.audioManager) {
      context.audioManager.playSwordSwing(currentStep, false, isPerfectTempo);
    }

    const cx = this.pos.x + this.width / 2;
    const cy = this.pos.y + this.height / 2;

    if (combatManager) {
      const self = this;
      const isWhirlwind = isFinisher && hasWhirlwind;
      const isStealthStrike = !!this.isStealthHidden;
      const stealthMult = isStealthStrike ? 3.0 : 1.0;
      const reachScale = isFinisher ? 1.22 : (isStealthStrike ? 1.15 : 1.0);
      const sizeScale = isFinisher ? 1.32 : 1.05;
      const whirlwindRadius = 77; // 154x154 px de barrido 360° (+20% alcance circular)

      if (isStealthStrike) {
        this.isProne = false;
        this.isStealthHidden = false;
        if (context && context.state) {
          context.state.set('player_is_prone', false);
          context.state.set('player_is_stealth', false);
          context.state.set('player_stealth_hidden', false);
        }
      }

      const initialHitbox = isWhirlwind
        ? { x: cx - whirlwindRadius, y: cy - whirlwindRadius, width: whirlwindRadius * 2, height: whirlwindRadius * 2 }
        : this.getSwordSweepHitbox(reachScale, sizeScale);

      combatManager.addAttack({
        owner: this,
        type: isFinisher ? 'strong' : 'weak',
        element: 'physical',
        damage: Math.round(baseDamage * damageMult * stealthMult),
        duration: stepDuration,
        maxDuration: stepDuration,
        hitbox: initialHitbox,
        destroyOnHit: false,
        hitEntities: new Set(),
        isSweep: true,
        isFinisher,
        isWhirlwind,
        isStealthStrike,
        isPerfectTempo,
        comboStep: currentStep,
        swingDir,
        facing: this.facing,
        aimAngle: this.aimAngle,
        aimDir: { x: this.aimDir.x, y: this.aimDir.y },
        originX: cx,
        originY: cy,
        knockbackForce: knockback,
        update: function () {
          this.facing = self.facing;
          this.aimAngle = self.aimAngle;
          this.aimDir.x = self.aimDir.x;
          this.aimDir.y = self.aimDir.y;
          this.originX = self.pos.x + self.width / 2;
          this.originY = self.pos.y + self.height / 2;
          if (this.isWhirlwind) {
            this.hitbox.x = this.originX - whirlwindRadius;
            this.hitbox.y = this.originY - whirlwindRadius;
            this.hitbox.width = whirlwindRadius * 2;
            this.hitbox.height = whirlwindRadius * 2;
          } else {
            this.hitbox = self.getSwordSweepHitbox(reachScale, sizeScale);
          }
        }
      });

      // Ondas de Filo Sagrado en el 3er golpe si posee `combo_mastery`, `whirlwind_finisher`, `blade_ascension` o Rango B+ (>= 40)
      const canFireBladeWave = isFinisher && (
        hasComboMastery ||
        hasWhirlwind ||
        hasAscension ||
        combatManager.styleScore >= 40
      );

      if (canFireBladeWave) {
        const waveSpeed = 430;
        const angleOffsets = (hasWhirlwind || whirlwindRank >= 2)
          ? (hasAscension ? [-0.42, -0.2, 0, 0.2, 0.42] : [-0.34, 0, 0.34])
          : (hasAscension ? [-0.22, 0, 0.22] : [0]);
        const waveBaseDamage = Math.round(baseDamage * 1.15 * styleBonus);

        for (let w = 0; w < angleOffsets.length; w++) {
          const wAng = this.aimAngle + angleOffsets[w];
          const wdx = Math.cos(wAng);
          const wdy = Math.sin(wAng);
          const startX = cx + wdx * 18;
          const startY = cy + wdy * 18;
          const wDamage = w === 1 || angleOffsets.length === 1
            ? waveBaseDamage
            : Math.round(waveBaseDamage * 0.78);

          combatManager.addAttack({
            owner: this,
            type: 'weak',
            element: 'physical',
            isBladeWave: true,
            isProjectile: true,
            damage: wDamage,
            duration: 0.45,
            x: startX,
            y: startY,
            dx: wdx,
            dy: wdy,
            aimAngle: wAng,
            speed: waveSpeed,
            hitEntities: new Set(),
            destroyOnHit: false,
            hitbox: { x: startX - 16, y: startY - 16, width: 32, height: 32 },
            update: function (dt) {
              this.x += this.dx * this.speed * dt;
              this.y += this.dy * this.speed * dt;
              this.hitbox.x = this.x - 16;
              this.hitbox.y = this.y - 16;
            }
          });
        }
      }
    }
  }

  /**
   * Ciclo principal de actualización lógica del héroe.
   * @param {Object|number} contextOrDt
   * @param {import('../core/InputManager.js').InputManager} [legacyInput]
   * @param {import('../systems/PhysicsSystem.js').PhysicsSystem} [legacyPhysics]
   */
  update(contextOrDt, legacyInput, legacyPhysics) {
    super.update(contextOrDt);

    const isContext = typeof contextOrDt === 'object' && contextOrDt !== null;
    const context = isContext ? contextOrDt : {};
    const deltaTime = isContext ? contextOrDt.deltaTime : contextOrDt;
    const input = isContext ? contextOrDt.input : legacyInput;
    const physics = isContext ? contextOrDt.physics : legacyPhysics;
    const combatManager = isContext ? contextOrDt.combatManager : null;
    const camera = isContext ? contextOrDt.camera : null;
    const equipmentManager = isContext ? contextOrDt.equipmentManager : null;
    const skillTree = isContext ? contextOrDt.skillTreeManager : null;

    // 0. Aplicar bonificaciones pasivas multi-rango del Árbol de Habilidades
    if (skillTree) {
      this.max_health = PLAYER_STATS.max_health + skillTree.getSkillRank('max_health_up');
      this.max_energy = (PLAYER_STATS.max_energy || 100) + (skillTree.hasSkill('omega_catalyst') ? 35 : 0);
      this.energy_regen_rate = PLAYER_STATS.energy_regen_rate + skillTree.getSkillRank('energy_regen') * 2.4;
      this.parryWindowDuration = 0.16 + skillTree.getSkillRank('parry_window') * 0.04;

      if (this._undyingCooldown > 0) this._undyingCooldown = Math.max(0, this._undyingCooldown - deltaTime);
      if (this._omegaSwapCd > 0) this._omegaSwapCd = Math.max(0, this._omegaSwapCd - deltaTime);

      // Catalizador Omega: al alternar afinidad elemental otorga +10 Energía inmediata
      if (this._lastAbility && this._lastAbility !== this.currentAbility && skillTree.hasSkill('omega_catalyst') && (this._omegaSwapCd || 0) <= 0) {
        this.energy = Math.min(this.max_energy, this.energy + 10);
        this._omegaSwapCd = 2.0;
      }
      this._lastAbility = this.currentAbility;

      // Halo de la Égida Eterna: escudo automático periódico cada 18s
      if (skillTree.hasSkill('relic_aegis_halo')) {
        if (this._haloCooldown > 0) {
          this._haloCooldown = Math.max(0, this._haloCooldown - deltaTime);
        } else if (!this.hasTag('vitality_shield')) {
          this.applyEffect('vitality_shield', 9999);
          this._haloCooldown = 18.0;
        }
      }

      // Temple de Acero: regeneración pasiva acelerada de postura cuando no bloquea
      const ironRank = skillTree.getSkillRank('iron_posture');
      if (ironRank > 0 && this.fsmState !== 'STATE_DEFEND' && this.fsmState !== 'STATE_GUARD_BREAK') {
        this.guard_meter = Math.min(this.max_guard, this.guard_meter + ironRank * 3.0 * deltaTime);
      }

      // Recuperación Ágil: acorta la duración del aturdimiento por Guardia Rota
      const swiftRank = skillTree.getSkillRank('swift_recovery');
      if (swiftRank > 0 && this.fsmState === 'STATE_GUARD_BREAK' && this.stateTimer > 0) {
        this.stateTimer -= deltaTime * (swiftRank * 0.22);
      }
    }

    // Relajar Squash & Stretch elásticamente hacia (1, 1) y avanzar reloj determinista de render
    this.animClock += deltaTime;
    const relax = Math.min(1, deltaTime * 14);
    this.scaleX += (1.0 - this.scaleX) * relax;
    this.scaleY += (1.0 - this.scaleY) * relax;

    // Actualizar estelas fantasma en coordenadas del mundo (O(1) swap-and-pop + pool Zero-GC)
    for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
      const ghost = this.dashGhosts[i];
      ghost.alpha -= deltaTime * 2.8;
      if (ghost.alpha <= 0) {
        this._ghostPool.push(ghost);
        const lastIdx = this.dashGhosts.length - 1;
        if (i !== lastIdx) {
          this.dashGhosts[i] = this.dashGhosts[lastIdx];
        }
        this.dashGhosts.pop();
      }
    }

    // Regeneración pasiva de energía y decremento de temporizadores
    if (this.fsmState !== 'STATE_GUARD_BREAK') {
      this.energy = Math.min(this.max_energy, this.energy + this.energy_regen_rate * deltaTime);
    }
    if (this.swordCooldown > 0) this.swordCooldown -= deltaTime;
    if (this.parryCooldown > 0) this.parryCooldown -= deltaTime;
    if (this.healCooldown > 0) this.healCooldown -= deltaTime;
    if (this.healTimer > 0) this.healTimer -= deltaTime;
    if (this.hurtTimer > 0) this.hurtTimer -= deltaTime;
    if (this.dashCooldown > 0) this.dashCooldown -= deltaTime;
    if (this._dormantHintCooldown > 0) this._dormantHintCooldown -= deltaTime;
    if (this.comboWindowTimer > 0) {
      this.comboWindowTimer -= deltaTime;
      if (this.comboWindowTimer <= 0) {
        this.comboStep = 0;
      }
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= deltaTime;
      this._ghostSpawnAccum += deltaTime;
      if (this._ghostSpawnAccum >= 0.035) {
        this._ghostSpawnAccum = 0;
        const pColor = this.currentAbility === 'Fuego' ? '#fb923c' : this.currentAbility === 'Embestida' ? '#38bdf8' : '#4ade80';
        const ghost = this._ghostPool.length > 0 ? this._ghostPool.pop() : { x: 0, y: 0, alpha: 0, color: '' };
        ghost.x = this.pos.x;
        ghost.y = this.pos.y;
        ghost.alpha = 0.52;
        ghost.color = pColor;
        this.dashGhosts.push(ghost);
      }
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        if (this.fsmState === 'STATE_DASH') {
          this.fsmState = 'STATE_IDLE';
        }
      }
    }

    if (this.fsmState === 'STATE_GUARD_BREAK') {
      if (this.stateTimer > 0) {
        this.stateTimer -= deltaTime;
        if (this.stateTimer <= 0) {
          this.fsmState = 'STATE_IDLE';
          this.guard_meter = this.max_guard * 0.5;
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

    // Sincronizar con StateManager para el HUD
    if (isContext && contextOrDt.state) {
      contextOrDt.state.set('player_energy', this.energy);
      contextOrDt.state.set('player_health', this.health);
      contextOrDt.state.set('player_max_health', this.max_health);
      contextOrDt.state.set('player_defending', this.fsmState === 'STATE_DEFEND');
      contextOrDt.state.set('health_critical', this.health <= 1);
    }

    this.velocity.set(0, 0);

    let canMove = (this.fsmState === 'STATE_IDLE' || this.fsmState === 'STATE_MOVE') && !this.isDashing;
    let canAttack = (this.fsmState === 'STATE_IDLE' || this.fsmState === 'STATE_MOVE');
    // Permitir Spell-Weaving desde cualquier fotograma de swing débil o fuerte hacia poderes elementales
    const canSpellWeave = (this.fsmState === 'STATE_ATTACK_WEAK' || this.fsmState === 'STATE_ATTACK_STRONG');

    let moveX = 0;
    let moveY = 0;

    if (input) {
      // 1. Vector de Movimiento (Teclado Zero-Closures + Joystick Táctil)
      const isUp = typeof input.isActionPressed === 'function' ? input.isActionPressed('UP') : KEYBINDINGS.UP.some(k => input.isKeyPressed(k));
      const isDown = typeof input.isActionPressed === 'function' ? input.isActionPressed('DOWN') : KEYBINDINGS.DOWN.some(k => input.isKeyPressed(k));
      const isLeft = typeof input.isActionPressed === 'function' ? input.isActionPressed('LEFT') : KEYBINDINGS.LEFT.some(k => input.isKeyPressed(k));
      const isRight = typeof input.isActionPressed === 'function' ? input.isActionPressed('RIGHT') : KEYBINDINGS.RIGHT.some(k => input.isKeyPressed(k));

      if (isUp) moveY -= 1;
      if (isDown) moveY += 1;
      if (isLeft) moveX -= 1;
      if (isRight) moveX += 1;

      if (input.joystickVector && input.joystickVector.lengthSquared() > 0.02) {
        moveX += input.joystickVector.x;
        moveY += input.joystickVector.y;
      }

      // Actualizar siempre la orientación si el jugador presiona una dirección (incluso durante combos de ataque)
      if ((moveX !== 0 || moveY !== 0) && !this.isDashing) {
        this._syncFacingFromVector(moveX, moveY);
      }

      // 1.5 Sigilo activable solo cuando StealthSystem esté habilitado + Sprint con Resistencia
      const stealthAllowed = Boolean(context && context.stealthSystem && context.stealthSystem.enabled);
      if (!stealthAllowed) {
        this.isProne = false;
        this.isStealthHidden = false;
        if (input.isStealthPressed && typeof input.consumeStealth === 'function') {
          input.consumeStealth();
        }
      } else if (input.isStealthPressed) {
        this.isProne = !this.isProne;
        this.isStealthHidden = Boolean(this.inTallGrass && this.isProne);
        if (typeof input.consumeStealth === 'function') input.consumeStealth();
      }

      const wantsSprint = (input.isSprintPressed || input.isKeyPressed('KeyF') || input.isKeyPressed('KeyV')) && !this.isProne;
      const isMoving = (moveX !== 0 || moveY !== 0);

      if (wantsSprint && isMoving && !this.staminaExhausted && this.stamina > 0) {
        this.isSprinting = true;
        this.stamina = Math.max(0, this.stamina - 24 * deltaTime);
        if (this.stamina <= 0) {
          this.staminaExhausted = true;
          this.isSprinting = false;
        }
      } else {
        this.isSprinting = false;
        const staminaRank = skillTree ? skillTree.getSkillRank('stamina_mastery') : 0;
        this.max_stamina = 100 + staminaRank * 25;
        const regenRate = 28 * (1 + staminaRank * 0.20);
        this.stamina = Math.min(this.max_stamina, this.stamina + regenRate * deltaTime);
        if (this.stamina >= 20) {
          this.staminaExhausted = false;
        }
      }

      if (canMove) {
        this.velocity.x = moveX;
        this.velocity.y = moveY;
        if (moveX !== 0 || moveY !== 0) {
          this.fsmState = 'STATE_MOVE';
          this.walkCycle += deltaTime * 12;
        } else {
          this.fsmState = 'STATE_IDLE';
        }
      } else if ((this.fsmState === 'STATE_ATTACK_WEAK' || this.fsmState === 'STATE_ATTACK_STRONG') && !this.isDashing) {
        // Permitir micro-desplazamiento táctico (35%) al girar golpeando en cualquier dirección
        this.velocity.x = moveX * 0.35;
        this.velocity.y = moveY * 0.35;
      }

      // 2. Guardia y Parry Instantáneo (Permite cancelar recuperación de ataques para reaccionar al milisegundo)
      if (this.fsmState !== 'STATE_GUARD_BREAK') {
        if (input.isDefendPressed && !this.isDashing) {
          if (this.fsmState !== 'STATE_DEFEND') {
            // Cancelar cola de ataque si el jugador levanta el escudo de emergencia
            this.attackTimer = 0;
            this.queuedAction = null;
            this._updateSmartAim(input, camera, moveX, moveY);

            this.fsmState = 'STATE_DEFEND';
            if (this.parryCooldown <= 0) {
              this.stateTimer = 0; // Ventana limpia de Parry Perfecto
              this.parryCooldown = 0.36;
            } else {
              this.stateTimer = 0.30; // Bloqueo estándar anti-spam
            }
          } else {
            this.stateTimer += deltaTime;
            if (moveX !== 0 || moveY !== 0) {
              this._syncFacingFromVector(moveX, moveY);
            }
          }
          canMove = false;
          canAttack = false;
          const guardStrideRank = skillTree ? skillTree.getSkillRank('guardian_stride') : 0;
          if (guardStrideRank > 0 && (moveX !== 0 || moveY !== 0)) {
            const strideFactor = Math.min(0.65, guardStrideRank * 0.18);
            this.velocity.set(moveX * strideFactor, moveY * strideFactor);
          } else {
            this.velocity.set(0, 0);
          }
        } else if (this.fsmState === 'STATE_DEFEND') {
          this.fsmState = 'STATE_IDLE';
        }
      }

      // 3. Dash con Invulnerabilidad y Cancelación Instantánea de Animación
      const canDashCancel = this.fsmState !== 'STATE_GUARD_BREAK' && !this.isDashing;
      if (input.isDashPressed && this.dashCooldown <= 0 && canDashCancel) {
        if (typeof input.consumeDash === 'function') input.consumeDash();
        const dashCost = PLAYER_STATS.dash_cost;
        if (this.energy >= dashCost) {
          this.energy -= dashCost;
          const dashRank = skillTree ? skillTree.getSkillRank('dash_cooldown') : 0;
          this.dashCooldown = Math.max(
            0.22,
            (PLAYER_STATS.dash_cooldown_base || 0.6) * (1 - dashRank * 0.14)
          );

          this.attackTimer = 0;
          this.queuedAction = null;
          if (combatManager) {
            combatManager.cancelAttacksFrom(this);
          }
          this.swordCooldown = 0; // Liberar espada al instante para permitir Dash-Strike en el frame siguiente
          this.fsmState = 'STATE_DASH';

          const dx = this.facing === 'right' ? 1 : this.facing === 'left' ? -1 : 0;
          const dy = this.facing === 'down' ? 1 : this.facing === 'up' ? -1 : 0;
          const useX = (moveX !== 0 || moveY !== 0) ? moveX : dx;
          const useY = (moveX !== 0 || moveY !== 0) ? moveY : dy;

          if (context.audioManager) context.audioManager.playDash();
          if (context.vfxRenderer) {
            context.vfxRenderer.spawnImpact('dash_dust', this.pos.x + 16, this.pos.y + 26, { radius: 18, duration: 0.22 });
          }
          this.startDash(useX, useY, PLAYER_STATS.dash_speed, PLAYER_STATS.dash_duration);

          // Talento `phantom_step` (Asalto Fantasma): electrocuta enemigos atravesados escalado por rango
          const phantomRank = skillTree ? skillTree.getSkillRank('phantom_step') : 0;
          if (phantomRank >= 1 && combatManager) {
            const self = this;
            combatManager.addAttack({
              owner: this,
              type: 'weak',
              element: 'kinetic',
              isPhantomStep: true,
              damage: 14 + phantomRank * 8,
              duration: PLAYER_STATS.dash_duration,
              energyRefundOnFirstHit: 8 + phantomRank * 5,
              applyEffect: { tag: 'armor_break', duration: 3.0 },
              destroyOnHit: false,
              hitEntities: new Set(),
              hitbox: {
                x: this.pos.x - 6,
                y: this.pos.y - 6,
                width: 44,
                height: 44
              },
              update: function () {
                this.hitbox.x = self.pos.x - 6;
                this.hitbox.y = self.pos.y - 6;
              }
            });
          }

          // Talento `tempest_clone` (Estela Tempestuosa): deja un eco cinético que detona tras 0.26s
          if (skillTree && skillTree.hasSkill('tempest_clone') && combatManager) {
            const decoyX = this.pos.x + this.width * 0.5;
            const decoyY = this.pos.y + this.height * 0.5;
            combatManager.addAttack({
              owner: this,
              isFriendlySynergy: true,
              type: 'synergy',
              element: 'kinetic',
              damage: 32,
              duration: 0.44,
              _delayTimer: 0.26,
              _detonated: false,
              isSweep: true,
              originX: decoyX,
              originY: decoyY,
              knockbackForce: 34,
              applyEffect: { tag: 'armor_break', duration: 2.8 },
              hitEntities: new Set(),
              hitbox: null,
              _activeBox: { x: decoyX - 58, y: decoyY - 58, width: 116, height: 116 },
              update: function (dt) {
                if (!this._detonated) {
                  this._delayTimer -= dt;
                  if (this._delayTimer <= 0) {
                    this._detonated = true;
                    this.hitbox = this._activeBox;
                    if (context.vfxRenderer) {
                      context.vfxRenderer.spawnImpact('plasma_pulse', decoyX, decoyY, { radius: 58, duration: 0.34 });
                    }
                    if (context.audioManager) {
                      context.audioManager.playExplosion();
                    }
                  }
                }
              }
            });
          }
        }
      }

      // 4. Curación Milenaria / Escudo de Vitalidad (con mejora multi-rango `vital_surge`)
      if (input.isHealPressed && this.healCooldown <= 0 && canAttack) {
        if (typeof input.consumeHeal === 'function') input.consumeHeal();

        const vitalRank = skillTree ? skillTree.getSkillRank('vital_surge') : 0;
        const hasVitalSurge = vitalRank >= 1;
        const healCost = Math.max(12, (PLAYER_STATS.heal_cost || 30) - vitalRank * 4);
        if (this.health < this.max_health) {
          if (this.energy >= healCost) {
            this.energy -= healCost;
            this.health = Math.min(this.max_health, this.health + 1);
            if (hasVitalSurge) {
              this.guard_meter = Math.min(this.max_guard, this.guard_meter + vitalRank * 25);
            }
            this.healCooldown = PLAYER_STATS.heal_cooldown || 1.5;
            this.healTimer = 0.85;
            if (context.audioManager) context.audioManager.playHeal();
            if (isContext && contextOrDt.state) {
              contextOrDt.state.set('player_health', this.health);
              contextOrDt.state.set('health_critical', this.health <= 1);
            }
          }
        } else {
          const barrierCost = PLAYER_STATS.barrier_cost || 20;
          if (this.energy >= barrierCost && !this.hasTag('vitality_shield')) {
            this.energy -= barrierCost;
            this.healCooldown = 1.8;
            this.healTimer = 0.85;
            this.applyEffect('vitality_shield', 5.0);
            if (hasVitalSurge) {
              this.applyEffect('iframe', 0.6);
            }
            if (context.audioManager) context.audioManager.playHeal();
            if (isContext && contextOrDt.state) {
              contextOrDt.state.set('active_dialogue', {
                speaker: 'GUANTELETE',
                text: '¡Salud completa! Escudo de Vitalidad activado (absorbe el próximo golpe).',
                timer: 2.6
              });
            }
          }
        }
      }

      // 5. Cola de Pre-Entrada (Input Queueing AAA): prioriza habilidades elementales ante ataques físicos
      if ((this.attackTimer > 0 && this.attackTimer <= 0.24) || this.isDashing) {
        if (input.isStrongAttackPressed) {
          if (typeof input.consumeStrongAttack === 'function') input.consumeStrongAttack();
          this.queuedAction = 'strong';
        } else if (input.isAbilityPressed) {
          if (typeof input.consumeAbility === 'function') input.consumeAbility();
          this.queuedAction = 'ability';
        } else if (input.isAttackPressed && !this.queuedAction) {
          if (typeof input.consumeAttack === 'function') input.consumeAttack();
          this.queuedAction = 'attack';
        }
      }

      // 6. Resolución de Ataques Físicos, Dash-Strike y Habilidades Elementales
      const wantAttack = input.isAttackPressed || (this.attackTimer <= 0 && !this.isDashing && this.queuedAction === 'attack');
      const wantAbility = input.isAbilityPressed || ((this.attackTimer <= 0 || canSpellWeave) && !this.isDashing && this.queuedAction === 'ability');
      const wantStrong = input.isStrongAttackPressed || ((this.attackTimer <= 0 || canSpellWeave) && !this.isDashing && this.queuedAction === 'strong');

      // 6.1 Combo Rítmico de Espada o recogida contextual de Espada del Alba si aún no se empuña
      if (wantAttack && !wantAbility && !wantStrong && ((this.swordCooldown <= 0 && this.attackTimer <= 0 && canAttack) || this.isDashing)) {
        if (typeof input.consumeAttack === 'function') input.consumeAttack();
        if (this.queuedAction === 'attack') this.queuedAction = null;

        if (!this.hasSword) {
          const entitiesList = context.entityManager
            ? (typeof context.entityManager.getByTag === 'function'
              ? context.entityManager.getByTag('interactable')
              : context.entityManager.entities)
            : null;
          let nearbySwordProp = null;
          if (Array.isArray(entitiesList)) {
            const pcx = this.pos.x + this.width * 0.5;
            const pcy = this.pos.y + this.height * 0.5;
            for (let i = 0; i < entitiesList.length; i++) {
              const prop = entitiesList[i];
              if (!prop || prop.propType !== 'starter_sword' || prop.isConsumed) continue;
              const sx = prop.pos.x + prop.width * 0.5;
              const sy = prop.pos.y + prop.height * 0.5;
              if ((sx - pcx) * (sx - pcx) + (sy - pcy) * (sy - pcy) <= 76 * 76) {
                nearbySwordProp = prop;
                break;
              }
            }
          }

          if (nearbySwordProp && typeof nearbySwordProp.interact === 'function') {
            const msg = nearbySwordProp.interact(context.state, context);
            if (msg && context.state) {
              context.state.set('active_dialogue', {
                speaker: 'ESPADA DEL ALBA',
                text: msg,
                timer: 4.2
              });
            }
          } else if (this._dormantHintCooldown <= 0) {
            this._dormantHintCooldown = 2.0;
            if (context.audioManager) context.audioManager.playHitImpact('resisted');
            if (context.state) {
              context.state.set('active_dialogue', {
                speaker: 'SANTI',
                text: '¡Aún no empuño mi espada! Toma la Espada del Alba clavada frente a la salida de la cueva [E].',
                timer: 3.0
              });
            }
          }
        } else {
          this._updateSmartAim(input, camera, moveX, moveY);
          this._executeSwordCombo(context, input, physics, combatManager, equipmentManager, skillTree);
        }
      }
      // 6.2 Habilidad Elemental Débil (con Spell-Weaving desde espada y verificación de engarce despierto)
      else if (wantAbility && (canAttack || canSpellWeave) && !this.isDashing && this.fsmState !== 'STATE_DEFEND') {
        if (!this.hasElement(this.currentAbility)) {
          if (typeof input.consumeAbility === 'function') input.consumeAbility();
          if (this.queuedAction === 'ability') this.queuedAction = null;
          if (this._dormantHintCooldown <= 0) {
            this._dormantHintCooldown = 2.6;
            if (context.audioManager) context.audioManager.playHitImpact('resisted');
            if (isContext && contextOrDt.state) {
              contextOrDt.state.set('active_dialogue', {
                speaker: 'GUANTELETE',
                text: 'Los engarces elementales aún duermen... Busca el brillo del Núcleo de Brasa al sur de la ribera.',
                timer: 3.0
              });
            }
          }
        } else {
          const ab = this.abilities[this.currentAbility];
          const effRank = skillTree ? skillTree.getSkillRank('relic_efficiency') : 0;
          const effMult = 1 - effRank * 0.09;
          const abilityCost = Math.max(9, Math.round(15 * effMult));
          if (ab && this.energy >= abilityCost) {
            if (typeof input.consumeAbility === 'function') input.consumeAbility();
            if (this.queuedAction === 'ability') this.queuedAction = null;
            this.energy -= abilityCost;
            this._updateSmartAim(input, camera, moveX, moveY);
            this.fsmState = 'STATE_ATTACK_WEAK';
            const dur = ab.executeWeak(this, context);
            this.attackTimer = dur;
            this.stateTimer = dur;
            this.scaleX = 1.15;
            this.scaleY = 0.88;
          } else if (ab && this._dormantHintCooldown <= 0) {
            if (typeof input.consumeAbility === 'function') input.consumeAbility();
            if (this.queuedAction === 'ability') this.queuedAction = null;
            this._dormantHintCooldown = 1.2;
            if (context.audioManager) context.audioManager.playHitImpact('resisted');
          }
        }
      }
      // 6.3 Habilidad Elemental Fuerte (con Spell-Weaving desde espada y verificación de engarce despierto)
      else if (wantStrong && (canAttack || canSpellWeave) && !this.isDashing && this.fsmState !== 'STATE_DEFEND' && this.fsmState !== 'STATE_ATTACK_STRONG') {
        if (!this.hasElement(this.currentAbility)) {
          if (typeof input.consumeStrongAttack === 'function') input.consumeStrongAttack();
          if (this.queuedAction === 'strong') this.queuedAction = null;
          if (this._dormantHintCooldown <= 0) {
            this._dormantHintCooldown = 2.6;
            if (context.audioManager) context.audioManager.playHitImpact('resisted');
            if (isContext && contextOrDt.state) {
              contextOrDt.state.set('active_dialogue', {
                speaker: 'GUANTELETE',
                text: 'Reclama primero el Núcleo Elemental en el pedestal para canalizar descargas pesadas.',
                timer: 3.0
              });
            }
          }
        } else {
          const ab = this.abilities[this.currentAbility];
          const effRank = skillTree ? skillTree.getSkillRank('relic_efficiency') : 0;
          const regenRank = skillTree ? skillTree.getSkillRank('energy_regen') : 0;
          const effMult = Math.max(0.7, 1 - effRank * 0.09);
          const strongCost = Math.max(16, Math.round((30 - regenRank * 2) * effMult));
          if (ab && this.energy >= strongCost) {
            this._updateSmartAim(input, camera, moveX, moveY);
            const dur = ab.executeStrong(this, context);
            if (dur > 0) {
              if (typeof input.consumeStrongAttack === 'function') input.consumeStrongAttack();
              if (this.queuedAction === 'strong') this.queuedAction = null;
              this.energy -= strongCost;
              this.fsmState = 'STATE_ATTACK_STRONG';
              this.stateTimer = dur;
              this.attackTimer = dur;
              this.scaleX = 1.24;
              this.scaleY = 0.80;
            }
          } else if (ab && this._dormantHintCooldown <= 0) {
            if (typeof input.consumeStrongAttack === 'function') input.consumeStrongAttack();
            if (this.queuedAction === 'strong') this.queuedAction = null;
            this._dormantHintCooldown = 1.2;
            if (context.audioManager) context.audioManager.playHitImpact('resisted');
          }
        }
      }
    }

    // 7. Integración Cinemática de Desplazamiento y Colisiones AABB
    let nextX, nextY;
    if (this.isDashing && this.dashTimer > 0) {
      const dashDistX = this.dashDirection.x * this.dashSpeed * deltaTime;
      const dashDistY = this.dashDirection.y * this.dashSpeed * deltaTime;
      this.velocity.set(this.dashDirection.x * this.dashSpeed, this.dashDirection.y * this.dashSpeed);
      nextX = this.pos.x + dashDistX;
      nextY = this.pos.y + dashDistY;
    } else {
      if (this.velocity.lengthSquared() > 1) {
        this.velocity.normalize();
      }
      // Ajuste dinámico de velocidad: Estilo S/A (+8%), Sprint (+62%) y Sigilo/Prone (-48%)
      let speedMult = (combatManager && combatManager.styleScore >= 65) ? 1.08 : 1.0;
      if (this.isSprinting) speedMult *= 1.62;
      else if (this.isProne) speedMult *= 0.52;
      this.velocity.multiplyScalar(this.speed * speedMult * deltaTime);
      nextX = this.pos.x + this.velocity.x;
      nextY = this.pos.y + this.velocity.y;
    }

    if (context && context.state) {
      const st = context.state;
      if (this._lastSyncStamina !== this.stamina) {
        this._lastSyncStamina = this.stamina;
        st.set('player_stamina', this.stamina);
      }
      if (this._lastSyncMaxStamina !== this.max_stamina) {
        this._lastSyncMaxStamina = this.max_stamina;
        st.set('player_max_stamina', this.max_stamina);
      }
      if (this._lastSyncSprint !== this.isSprinting) {
        this._lastSyncSprint = this.isSprinting;
        st.set('player_is_sprinting', this.isSprinting);
      }
    }

    if (physics) {
      const finalPos = physics.moveWithCollisions(this, nextX, nextY);
      this.pos.set(finalPos.x, finalPos.y);
    } else {
      this.pos.set(nextX, nextY);
    }
  }

  /**
   * Renderizado estilizado del héroe con Squash & Stretch, Estelas Fantasma,
   * Guantelete Elemental brillante e indicadores de estado tácticos.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    // 0. Renderizar estelas fantasma en coordenadas del mundo (Dash Afterimages en un único save/restore)
    if (this.dashGhosts.length > 0) {
      ctx.save();
      for (let i = 0; i < this.dashGhosts.length; i++) {
        const g = this.dashGhosts[i];
        ctx.globalAlpha = Math.max(0, g.alpha * 0.65);
        ctx.fillStyle = g.color;
        ctx.fillRect(Math.round(g.x + 8), Math.round(g.y + 8), 16, 20);
      }
      ctx.restore();
    }

    // Parpadeo sutil determinista durante fotogramas de invulnerabilidad post-daño (sin performance.now())
    if (this.hasTag('iframe') && !this.isDashing && Math.floor(this.animClock * 15) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      this._drawCharacterBody(ctx);
      ctx.restore();
      return;
    }

    this._drawCharacterBody(ctx);
  }

  /**
   * Dibuja el cuerpo 2D Pixel-Art de Santi con sombra propia nítida, postura agachada entera
   * (`isProne` sin escalado fraccionario borroso), color dinámico del Guantelete y espada.
   * @private
   */
  _drawCharacterBody(ctx) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);

    if (this.sprite) {
      ctx.drawImage(this.sprite, x, y, this.width, this.height);
      return;
    }

    // 1. Sombra pixel-art propia bajo los pies de Santi
    ctx.fillStyle = this.isStealthHidden ? 'rgba(20, 83, 45, 0.35)' : 'rgba(11, 16, 29, 0.32)';
    ctx.fillRect(x + 8, y + 28, 16, 3);
    ctx.fillRect(x + 10, y + 27, 12, 5);

    const isMoving = this.fsmState === 'STATE_MOVE';
    const bobY = isMoving ? Math.round(Math.abs(Math.sin(this.walkCycle)) * -2) : 0;
    const proneYOffset = this.isProne ? 4 : 0;
    const stepPhase = Math.floor(this.walkCycle * 1.35) & 3;
    const stepFrame = isMoving ? (stepPhase === 0 ? 1 : stepPhase === 2 ? 3 : 0) : 0;

    // Pivote pixel-art entero para bob vertical y postura de sigilo (cero escalado fraccionario)
    ctx.save();
    ctx.translate(0, bobY + proneYOffset);

    if (this.isProne) {
      ctx.globalAlpha = this.isStealthHidden ? 0.68 : 0.90;
    }

    // Determinar color de gema del Guantelete (apagado en pizarra si aún está latente)
    let relicColor = '#64748b';
    if (this.unlockedElements.size > 0) {
      relicColor = this.currentAbility === 'Fuego'
        ? '#fb923c'
        : this.currentAbility === 'Embestida'
          ? '#38bdf8'
          : '#4ade80';
    }

    // 2. Dibujar Sprite 2D Pixel-Art horneado de Santi (40x44 centrado sobre 32x32)
    const santiSprite = CelSpriteAtlas.getSantiSprite(this.facing, stepFrame, relicColor, this.hasSword);
    if (santiSprite) {
      ctx.drawImage(santiSprite, x - 4, y - 9);
    }

    // Destello cel-shaded blanco-carmesí pixel-art si acaba de recibir daño
    if (this.hurtTimer > 0) {
      ctx.fillStyle = 'rgba(254, 202, 202, 0.45)';
      ctx.fillRect(x + 4, y, 24, 28);
    }

    // 3. Hoja de Espada Rúnica direccional activa durante el swing físico en `aimAngle`
    if (this.hasSword && this.attackTimer > 0 && (this.fsmState === 'STATE_ATTACK_WEAK' || this.fsmState === 'STATE_ATTACK_STRONG')) {
      ctx.save();
      ctx.translate(x + 16, y + 18);
      ctx.rotate(this.aimAngle);
      ctx.fillStyle = '#0b101d';
      ctx.fillRect(7, -3, 20, 6);
      ctx.fillStyle = this.fsmState === 'STATE_ATTACK_STRONG' ? '#fef08a' : '#e2e8f0';
      ctx.fillRect(8, -2, 17, 4);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(5, -5, 3, 10);
      ctx.restore();
    }

    // 4. Destello de "Tempo Perfecto" cuando está abierta la ventana rítmica de combo
    if (this.attackTimer <= 0 && this.comboStep > 0 && this.comboWindowTimer >= 0.36) {
      const wristX = this.facing === 'left' ? x + 4 : x + 24;
      ctx.fillStyle = '#0b101d';
      ctx.fillRect(wristX - 1, y + 15, 6, 6);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(wristX, y + 16, 4, 4);
    }

    ctx.restore();

    // 5. Indicador discreto de postura agachada/sigilo nítido sobre los píxeles
    if (this.isProne) {
      ctx.fillStyle = this.isStealthHidden ? '#4ade80' : '#94a3b8';
      ctx.fillRect(x + 10, y + 32, 12, 2);
    }

    // 6. Indicador de Estrellas de Aturdimiento determinista si sufrió Guard Break
    if (this.fsmState === 'STATE_GUARD_BREAK') {
      const t = this.animClock * 5.5;
      for (let i = 0; i < 3; i++) {
        const ang = t + (i * Math.PI * 2 / 3);
        const sx = Math.round(x + 16 + Math.cos(ang) * 11);
        const sy = Math.round(y - 3 + Math.sin(ang) * 4);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
      }
    }
  }
}
