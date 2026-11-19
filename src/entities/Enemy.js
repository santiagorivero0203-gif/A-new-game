import { Entity } from './Entity.js';
import { Vector2 } from '../utils/Vector2.js';
import { CelSpriteAtlas } from '../render/CelSpriteAtlas.js';

/**
 * Configuraciones data-driven de los arquetipos enemigos del Lore de 'Be a Legend'.
 */
export const ENEMY_ARCHETYPES = {
  hound: {
    maxHealth: 75,
    speed: 112,
    aggroRange: 136,
    attackRange: 88,
    telegraphTime: 0.40,
    attackDuration: 0.24,
    cooldownTime: 1.35,
    lungeSpeed: 305,
    postureDamage: 24,
    essenceReward: 2
  },
  artillery: {
    maxHealth: 70,
    speed: 86,
    aggroRange: 164,
    preferredMinDist: 88,
    attackRange: 168,
    telegraphTime: 0.48,
    attackDuration: 0.18,
    cooldownTime: 1.85,
    projectileSpeed: 225,
    postureDamage: 22,
    essenceReward: 3
  },
  tank: {
    maxHealth: 135,
    speed: 62,
    aggroRange: 128,
    attackRange: 52,
    telegraphTime: 0.56,
    attackDuration: 0.26,
    cooldownTime: 1.75,
    lungeSpeed: 190,
    postureDamage: 48,
    hasWoodenShield: true,
    essenceReward: 4
  },
  duelist: {
    maxHealth: 110,
    speed: 104,
    aggroRange: 148,
    attackRange: 112,
    telegraphTime: 0.42,
    attackDuration: 0.22,
    cooldownTime: 1.45,
    lungeSpeed: 365,
    postureDamage: 32,
    essenceReward: 5
  },
  slime: {
    maxHealth: 80,
    speed: 82,
    aggroRange: 120,
    attackRange: 76,
    telegraphTime: 0.45,
    attackDuration: 0.24,
    cooldownTime: 1.60,
    lungeSpeed: 250,
    postureDamage: 20,
    essenceReward: 2
  },
  sentinel_ether: {
    maxHealth: 115,
    speed: 92,
    aggroRange: 170,
    preferredMinDist: 96,
    attackRange: 185,
    telegraphTime: 0.46,
    attackDuration: 0.20,
    cooldownTime: 1.70,
    projectileSpeed: 245,
    projectileAltitude: 'high',
    postureDamage: 26,
    essenceReward: 6
  },
  boss_bramble: {
    maxHealth: 340,
    speed: 78,
    aggroRange: 210,
    attackRange: 76,
    telegraphTime: 0.54,
    attackDuration: 0.28,
    cooldownTime: 1.45,
    lungeSpeed: 245,
    postureDamage: 42,
    hasWoodenShield: true,
    isBoss: true,
    essenceReward: 25
  },
  boss_spore: {
    maxHealth: 380,
    speed: 84,
    aggroRange: 225,
    preferredMinDist: 92,
    attackRange: 205,
    telegraphTime: 0.50,
    attackDuration: 0.24,
    cooldownTime: 1.55,
    projectileSpeed: 235,
    projectileAltitude: 'high',
    postureDamage: 34,
    isBoss: true,
    essenceReward: 32
  },
  boss_forge: {
    maxHealth: 440,
    speed: 74,
    aggroRange: 215,
    attackRange: 80,
    telegraphTime: 0.58,
    attackDuration: 0.30,
    cooldownTime: 1.50,
    lungeSpeed: 265,
    postureDamage: 50,
    hasMetalArmor: true,
    isBoss: true,
    essenceReward: 40
  },
  boss_astral: {
    maxHealth: 520,
    speed: 108,
    aggroRange: 230,
    attackRange: 160,
    telegraphTime: 0.44,
    attackDuration: 0.24,
    cooldownTime: 1.30,
    lungeSpeed: 350,
    projectileSpeed: 255,
    projectileAltitude: 'high',
    postureDamage: 40,
    isBoss: true,
    essenceReward: 55
  }
};

/**
 * @module Enemy
 * @description Sistema modular y escalable de IA Enemiga para 'Be a Legend'.
 * Soporta los 4 arquetipos tácticos de las facciones del Lore:
 * - `hound` (Sabueso de Zarzas): Flanqueo veloz y embestida en salto.
 * - `artillery` (Esporífero Artillero): Posicionamiento a distancia (Kiting) y proyectiles deflectables con Parry.
 * - `tank` (Centinela Pavés): Escudo de roble frontal (destructible permanentemente con Fuego) y golpe sísmico.
 * - `duelist` (Duelista Implacable): Esgrima orbital, amagues y estocadas relámpago para duelos de Parry/Dash-Cancel.
 * Incluye telegrafía visual/sonora AAA, estados alterados, Squash & Stretch y recompensas de Esencia Ancestral.
 * @author Be a Legend Team
 * @version 3.0.0
 */
export class Enemy extends Entity {
  /**
   * @param {number} x - Posición X inicial
   * @param {number} y - Posición Y inicial
   * @param {string} [elementalAffinity='plantas'] - 'plantas' | 'fuego' | 'kinetic'
   * @param {string} [name='Enemigo Corrompido'] - Nombre descriptivo
   * @param {string} [archetype='hound'] - 'hound' | 'artillery' | 'tank' | 'duelist' | 'slime'
   */
  constructor(x, y, elementalAffinity = 'plantas', name = 'Slime Elemental', archetype = null) {
    // Inferir arquetipo automáticamente si no se especificó en niveles heredados
    if (!archetype) {
      if (elementalAffinity === 'kinetic') archetype = 'duelist';
      else if (elementalAffinity === 'fuego') archetype = 'artillery';
      else if (elementalAffinity === 'astral' || elementalAffinity === 'eter') archetype = 'sentinel_ether';
      else archetype = 'hound';
    }
    const resolvedArchetype = ENEMY_ARCHETYPES[archetype] ? archetype : 'slime';
    const cfg = ENEMY_ARCHETYPES[resolvedArchetype];
    const size = cfg.isBoss ? 44 : 32;

    super(x, y, size, size);
    this.elementalAffinity = elementalAffinity;
    this.name = name;
    this.archetype = resolvedArchetype;
    this.config = cfg;
    this.isBoss = Boolean(cfg.isBoss);
    this.phase = 1;
    this.bossId = null;
    this.linkId = null;
    this.worldSeal = false;
    this.rewardWeapon = null;
    this.rewardShield = null;
    this.canSplit = false;
    this._bossVolleyToggle = 0;

    this.tags.push('enemy');
    this.tags.push('solid');
    this.tags.push(`elem_${elementalAffinity}`);
    if (this.isBoss) {
      this.tags.push('boss');
    }

    /** @type {boolean} Escudo pesado de roble (destructible permanentemente con Fuego) */
    this.hasWoodenShield = !!this.config.hasWoodenShield;
    this._initialWoodenShield = this.hasWoodenShield;
    if (this.hasWoodenShield) {
      this.tags.push('wooden_shield');
    }

    /** @type {boolean} Coraza volcánica pesada (quebrable con Cinética o Éter) */
    this.hasMetalArmor = !!this.config.hasMetalArmor;
    this._initialMetalArmor = this.hasMetalArmor;
    if (this.hasMetalArmor) {
      this.tags.push('metal_armor');
    }

    this.health = this.config.maxHealth;
    this.max_health = this.config.maxHealth;

    // --- Máquina de Estados de IA (FSM) ---
    /** @type {'IDLE'|'PATROL'|'CHASE'|'TELEGRAPH'|'ATTACK'|'COOLDOWN'} */
    this.aiState = 'IDLE';
    this.aiTimer = 0.5 + Math.random() * 0.8;
    this.facing = 'down';
    this.aimDir = new Vector2(0, 1);
    this.attackVector = new Vector2(0, 1);
    this.strafeSign = Math.random() > 0.5 ? 1 : -1;
    this.patrolTarget = new Vector2(x, y);

    // --- Temporizadores de Estado, Quemadura, Espinas, Éter y Reaparición ---
    this.hurtTimer = 0;
    this.burnTickTimer = 0;
    this.thornTickTimer = 0;
    this.etherTickTimer = 0;
    this._hasGrantedKillEssence = false;
    this._parryEssenceGranted = false;
    this.initialX = x;
    this.initialY = y;
    this.respawnTimer = 0;
    this.isDead = false;

    // --- Escáner de Sigilo Opcional (archivado e inactivo salvo que StealthSystem esté habilitado) ---
    this.stealthVisionRange = this.config.stealthVisionRange || 112;
    this.stealthHalfAngle = this.config.stealthHalfAngle || (Math.PI / 6);
    this._stealthScanTimer = Math.random() * 0.12;
    this.isAlerted = false;
    /** @type {number} Sospecha acumulada (0-100) reciclable por StealthSystem */
    this.suspicion = 0;
    this.loseAggroTimer = 0;
    /** @type {number} Distancia cuadrada al jugador cacheadas del frame actual para evitar recalcular en main/HUD */
    this._lastPlayerDistSq = Infinity;

    // --- Animación Procedural Viva y Reloj de Escáner ---
    this.animClock = 0;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.scaleX = 1.0;
    this.scaleY = 1.0;

    // Hitbox precisa en la base para colisiones y Y-Sorting
    this.hitbox = this.isBoss
      ? { offsetX: 8, offsetY: 20, width: 28, height: 22 }
      : { offsetX: 5, offsetY: 14, width: 22, height: 16 };
    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;
  }

  /**
   * Equipa la Coraza Volcánica reemplazando opcionalmente el escudo de roble heredado del arquetipo.
   * @param {boolean} [replaceWoodenShield=true]
   */
  equipMetalArmor(replaceWoodenShield = true) {
    this.hasMetalArmor = true;
    this._initialMetalArmor = true;
    if (!this.tags.includes('metal_armor')) {
      this.tags.push('metal_armor');
    }
    if (replaceWoodenShield) {
      this.hasWoodenShield = false;
      this._initialWoodenShield = false;
      if (this.tags.includes('wooden_shield')) {
        this.tags = this.tags.filter((t) => t !== 'wooden_shield');
      }
    }
  }

  /**
   * Quebra de forma permanente la Coraza Volcánica del enemigo al recibir Cinética o Éter.
   * @param {Object} context
   */
  shatterMetalArmor(context) {
    this.hasMetalArmor = false;
    this.tags = this.tags.filter((t) => t !== 'metal_armor');
    this.activeEffects.delete('metal_armor');
    this.applyEffect('armor_break', 4.5);
    this.applyEffect('staggered', 2.0);
    this.scaleX = 0.78;
    this.scaleY = 1.24;
  }

  /**
   * Aplica un escalado moderado de World-State Tiering según hitos del Brazalete.
   * @param {number} [mult=1.0]
   */
  applyTierScaling(mult = 1.0) {
    const m = Math.max(1.0, Math.min(1.4, Number(mult) || 1.0));
    if (m <= 1.01) return;
    const prevMax = this.max_health || this.config.maxHealth;
    const nextMax = Math.round(prevMax * m);
    this.max_health = nextMax;
    this.health = Math.min(nextMax, Math.round(this.health * m));
  }

  /**
   * Incinera y destruye de forma permanente el escudo de roble del Centinela Pavés.
   * @param {Object} context
   */
  burnWoodenShield(context) {
    this.hasWoodenShield = false;
    this.tags = this.tags.filter(t => t !== 'wooden_shield');
    this.activeEffects.delete('wooden_shield');
    this.applyEffect('staggered', 2.4);
    this.scaleX = 0.78;
    this.scaleY = 1.24;
  }

  /**
   * Recibe daño, aplica deformación elástica, textos flotantes y otorga Esencia Ancestral al morir.
   * @param {number} amount
   * @param {Object} attack
   * @param {Object} context
   * @param {boolean} [isCritical=false]
   */
  takeDamage(amount, attack, context, isCritical = false) {
    if (this.isDead) return;

    this.health = Math.max(0, this.health - amount);
    this.hurtTimer = 0.20;
    this.scaleX = 1.28;
    this.scaleY = 0.76;

    // Interrumpir telegrafía si recibe un golpe crítico, Finisher o súper efectivo
    const atkElem = attack ? attack.element : 'physical';
    const defElem = this.elementalAffinity;
    const isSuper = (
      (atkElem === 'fuego' && (defElem === 'plantas' || defElem === 'raices' || defElem === 'tierra')) ||
      ((atkElem === 'plantas' || atkElem === 'tierra') && defElem === 'kinetic') ||
      (atkElem === 'kinetic' && defElem === 'fuego') ||
      (atkElem === 'eter' && (defElem === 'astral' || (defElem === 'kinetic' && this.hasMetalArmor)))
    );
    const isResist = (
      ((atkElem === 'plantas' || atkElem === 'tierra') && defElem === 'fuego') ||
      (atkElem === 'kinetic' && (defElem === 'plantas' || defElem === 'raices' || defElem === 'tierra')) ||
      (atkElem === 'fuego' && defElem === 'kinetic')
    );

    const isCriticalOrStealth = Boolean(isCritical || (attack && attack.isStealthStrike));

    if (isCriticalOrStealth || isSuper || (attack && attack.isFinisher)) {
      if (this.aiState === 'TELEGRAPH') {
        this.aiState = 'COOLDOWN';
        this.aiTimer = 0.75;
      }
    }

    let color = '#f8fafc';
    let label = String(Math.round(amount));
    if (isCriticalOrStealth) {
      color = '#fde047';
      label = `¡${Math.round(amount)}!`;
    } else if (isSuper) {
      color = '#fb923c';
      label = `${Math.round(amount)} ✦`;
    } else if (isResist) {
      color = '#94a3b8';
    } else if (attack && attack.isFinisher) {
      color = '#38bdf8';
    }

    if (context && context.uiManager && context.camera) {
      context.uiManager.spawnDamageNumber(this.pos.x + this.width / 2, this.pos.y - 2, label, color);
    }

    // Transición a Fase II para Guardianes Regionales al llegar al 50% de vida
    if (this.isBoss && this.phase === 1 && this.health > 0 && this.health <= this.max_health * 0.5) {
      this.phase = 2;
      this.config = {
        ...this.config,
        cooldownTime: Math.max(0.75, (this.config.cooldownTime || 1.4) * 0.78)
      };
      const bcx = this.pos.x + this.width * 0.5;
      const bcy = this.pos.y + this.height * 0.5;
      if (context && context.engine) context.engine.hitStop(0.06);
      if (context && context.camera) context.camera.shake(0.6, 0.35);
      if (context && context.audioManager) context.audioManager.playExplosion();
      if (context && context.vfxRenderer) {
        const fxType = (this.elementalAffinity === 'astral' || this.elementalAffinity === 'eter')
          ? 'ether_burst'
          : this.elementalAffinity === 'fuego' ? 'fire_burst' : 'wood_explosion';
        context.vfxRenderer.spawnImpact(fxType, bcx, bcy, { radius: 64, duration: 0.45 });
      }
      if (context && context.state) {
        context.state.set('active_dialogue', {
          speaker: (this.name || 'GUARDIÁN').toUpperCase(),
          text: '¡FASE II! ¡La corrupción de la Reliquia desata su verdadera furia!',
          timer: 3.4
        });
      }
    }

    // Muerte, explosión de partículas, recompensa de Esencia Ancestral y programación de Respawn
    if (this.health <= 0) {
      this._handleDefeat(context);
    } else if (this.aiState === 'IDLE' || this.aiState === 'PATROL') {
      // Cualquier impacto recibido fuera del cono de visión despierta de inmediato al enemigo
      this.aiState = 'CHASE';
      this.isAlerted = true;
      this.loseAggroTimer = 4.0;
      const attacker = (context && context.player) || (attack && attack.owner);
      if (attacker && attacker.pos) {
        const ax = (attacker.pos.x + (attacker.width || 32) * 0.5) - (this.pos.x + this.width * 0.5);
        const ay = (attacker.pos.y + (attacker.height || 32) * 0.5) - (this.pos.y + this.height * 0.5);
        this._faceVector(ax, ay, 1.0);
      } else if (attack && typeof attack.originX === 'number' && typeof attack.originY === 'number') {
        const ax = attack.originX - (this.pos.x + this.width * 0.5);
        const ay = attack.originY - (this.pos.y + this.height * 0.5);
        this._faceVector(ax, ay, 1.0);
      }
    }
  }

  /**
   * Gestiona la derrota del enemigo, liberando Esencia Ancestral y limpiando ataques activos.
   * @private
   */
  _handleDefeat(context) {
    this.isDead = true;
    this.respawnTimer = (this.noRespawn || this.hasTag('no_respawn')) ? 999999 : 14.0;
    this.tags = this.tags.filter(t => t !== 'solid');
    if (context && context.entityManager) {
      context.entityManager._solidsCache = null;
      if (context.entityManager.solidGrid) {
        context.entityManager.solidGrid.remove(this);
      }
    }
    if (context && context.combatManager) {
      context.combatManager.cancelAttacksFrom(this);
    }

    const cx = this.pos.x + this.width / 2;
    const cy = this.pos.y + this.height / 2;

    if (context && context.vfxRenderer) {
      context.vfxRenderer.spawnImpact('fire_burst', cx, cy, { radius: 34, duration: 0.42 });
      for (let i = 0; i < 10; i++) {
        const ang = (Math.PI * 2 * i) / 10;
        context.vfxRenderer.addParticle({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * (60 + Math.random() * 50),
          vy: Math.sin(ang) * (60 + Math.random() * 50),
          size: 3.5,
          life: 0.45,
          color: '#facc15'
        });
      }
    }

    const baseReward = this.config.essenceReward || 2;
    const reward = this._hasGrantedKillEssence ? 1 : baseReward;
    this._hasGrantedKillEssence = true;
    if (context && context.skillTreeManager) {
      context.skillTreeManager.addEssence(reward);
    }
    if (context && context.uiManager && context.camera) {
      context.uiManager.spawnDamageNumber(cx, this.pos.y - 12, `+${reward} ✦`, '#facc15');
    }

    // Estallido final de Slime mutagénico (si posee canSplit)
    if (this.canSplit && context) {
      if (context.vfxRenderer) {
        context.vfxRenderer.spawnImpact('earth_root', cx, cy, { radius: 46, duration: 0.4 });
      }
      const pl = context.player;
      if (pl && !pl.isDead && !pl.hasTag('iframe')) {
        const px = pl.pos.x + pl.width * 0.5;
        const py = pl.pos.y + pl.height * 0.5;
        if ((px - cx) * (px - cx) + (py - cy) * (py - cy) <= 30 * 30 && typeof pl.takeDamage === 'function') {
          pl.takeDamage(1, { heartDamage: 1, hitbox: { x: cx - 16, y: cy - 16, width: 32, height: 32 } }, context);
        }
      }
    }

    // Desbloqueo de equipo otorgado por enemigos únicos / guardianes
    if (context && context.equipmentManager) {
      if (this.rewardWeapon) context.equipmentManager.unlockWeapon(this.rewardWeapon);
      if (this.rewardShield) context.equipmentManager.unlockShield(this.rewardShield);
    }

    // Enlace lógico al morir (desbloquea compuertas o portales sellados)
    if ((this.bossId || this.linkId) && context && context.progressionManager) {
      const worldId = context.state ? context.state.get('current_world') : null;
      if (worldId) {
        context.progressionManager.registerLinkEvent(worldId, this.linkId || this.bossId, context, { x: cx, y: cy });
      }
    }

    // Conquista de Sello Regional (desbloquea el siguiente mundo)
    if (this.worldSeal && context && context.progressionManager) {
      const worldId = context.state ? context.state.get('current_world') : null;
      if (worldId) {
        const newlyCompleted = context.progressionManager.completeWorld(worldId, context.state);
        if (newlyCompleted && context.state) {
          context.state.set('horde_victory_announcement', {
            title: 'SELLO REGIONAL LIBERADO',
            rewardText: `${this.name} derrotado • El portal al siguiente mundo resplandece.`
          });
        }
      }
    }
  }

  /**
   * Orienta al enemigo hacia un vector direccional.
   * @private
   */
  _faceVector(dx, dy, maxTurnLerp = 1.0) {
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    this.aimDir.x += (nx - this.aimDir.x) * maxTurnLerp;
    this.aimDir.y += (ny - this.aimDir.y) * maxTurnLerp;
    const aLen = Math.hypot(this.aimDir.x, this.aimDir.y) || 1;
    this.aimDir.x /= aLen;
    this.aimDir.y /= aLen;

    if (Math.abs(this.aimDir.x) >= Math.abs(this.aimDir.y)) {
      this.facing = this.aimDir.x >= 0 ? 'right' : 'left';
    } else {
      this.facing = this.aimDir.y >= 0 ? 'down' : 'up';
    }
  }

  /**
   * Desplaza al enemigo de forma segura usando PhysicsSystem.
   * @private
   */
  _moveSafe(vx, vy, dt, physics) {
    const slowMult = (this.hasTag('enredado_espinas') ? 0.52 : 1.0) * (this.hasTag('sobrecarga_eter') ? 0.68 : 1.0);
    const targetX = this.pos.x + vx * slowMult * dt;
    const targetY = this.pos.y + vy * slowMult * dt;
    if (physics && typeof physics.moveWithCollisions === 'function') {
      const safe = physics.moveWithCollisions(this, targetX, targetY);
      this.pos.set(safe.x, safe.y);
    } else {
      this.pos.set(targetX, targetY);
    }
  }

  /**
   * Ejecuta la acción ofensiva correspondiente al arquetipo tras finalizar la telegrafía.
   * @private
   */
  _launchArchetypeAttack(context) {
    const combat = context.combatManager;
    const projSys = context.projectileSystem;
    if (!combat && !projSys) return;

    const cx = this.pos.x + this.width / 2;
    const cy = this.pos.y + this.height / 2;
    const dx = this.attackVector.x;
    const dy = this.attackVector.y;

    this.scaleX = 1.26;
    this.scaleY = 0.78;

    if (this.archetype === 'artillery' || this.archetype === 'sentinel_ether' || this.archetype === 'boss_spore') {
      const pSpeed = this.config.projectileSpeed || 225;
      const projElem = this.archetype === 'sentinel_ether' ? 'eter' : this.elementalAffinity;
      const spriteKey = this.archetype === 'sentinel_ether' ? 'ether_orb' : undefined;
      const spawnBossOrb = (angOffset, speedMult = 1.0) => {
        const baseAng = Math.atan2(dy, dx) + angOffset;
        const odx = Math.cos(baseAng);
        const ody = Math.sin(baseAng);
        const sx = cx + odx * 16;
        const sy = cy + ody * 16;
        if (projSys && typeof projSys.spawn === 'function') {
          projSys.spawn({
            owner: this,
            type: 'projectile',
            element: projElem,
            spriteKey,
            isFriendly: false,
            reflectable: true,
            damage: 22,
            postureDamage: this.config.postureDamage,
            duration: 2.3,
            x: sx,
            y: sy,
            dx: odx,
            dy: ody,
            speed: pSpeed * speedMult,
            radius: 8,
            altitude: this.config.projectileAltitude || 'high',
            destroyOnHit: true
          });
        } else if (combat) {
          combat.addAttack({
            owner: this,
            type: 'projectile',
            isProjectile: true,
            element: projElem,
            damage: 22,
            postureDamage: this.config.postureDamage,
            duration: 2.3,
            x: sx,
            y: sy,
            dx: odx,
            dy: ody,
            speed: pSpeed * speedMult,
            destroyOnHit: true,
            hitbox: { x: sx - 8, y: sy - 8, width: 16, height: 16 },
            update: function (dt) {
              this.x += this.dx * this.speed * dt;
              this.y += this.dy * this.speed * dt;
              this.hitbox.x = this.x - 8;
              this.hitbox.y = this.y - 8;
            }
          });
        }
      };

      if (this.archetype === 'boss_spore') {
        spawnBossOrb(-0.32, 1.0);
        spawnBossOrb(0, 1.05);
        spawnBossOrb(0.32, 1.0);
        if (this.phase >= 2) {
          this._bossVolleyToggle = (this._bossVolleyToggle + 1) % 2;
          if (this._bossVolleyToggle === 0) {
            for (let k = 0; k < 6; k++) {
              spawnBossOrb((k * Math.PI * 2) / 6, 0.85);
            }
          }
        }
      } else {
        spawnBossOrb(0, 1.0);
      }
      return;
    }

    if (this.archetype === 'boss_astral') {
      this._bossVolleyToggle = (this._bossVolleyToggle + 1) % 2;
      if (this._bossVolleyToggle === 0 && (projSys || combat)) {
        const pSpeed = this.config.projectileSpeed || 255;
        const baseAng = Math.atan2(dy, dx);
        const offsets = this.phase >= 2 ? [-0.42, -0.14, 0.14, 0.42] : [-0.26, 0, 0.26];
        for (let i = 0; i < offsets.length; i++) {
          const ang = baseAng + offsets[i];
          const odx = Math.cos(ang);
          const ody = Math.sin(ang);
          const sx = cx + odx * 16;
          const sy = cy + ody * 16;
          if (projSys && typeof projSys.spawn === 'function') {
            projSys.spawn({
              owner: this,
              type: 'projectile',
              element: 'eter',
              spriteKey: 'astral_orb',
              isFriendly: false,
              reflectable: true,
              damage: 24,
              postureDamage: this.config.postureDamage,
              duration: 2.2,
              x: sx,
              y: sy,
              dx: odx,
              dy: ody,
              speed: pSpeed,
              radius: 9,
              altitude: 'high',
              destroyOnHit: true
            });
          }
        }
        return;
      }
    }

    if (!combat) return;

    // Ataque cuerpo a cuerpo en embestida (Hound, Tank, Duelist, Slime y Guardianes Melee)
    const dur = this.config.attackDuration || 0.24;
    const boxSize = this.archetype === 'boss_forge' ? 48
      : this.archetype === 'boss_bramble' ? 44
        : this.archetype === 'tank' ? 42 : 30;
    const reach = (this.archetype === 'duelist' || this.archetype === 'boss_astral') ? 26 : 18;
    const self = this;

    combat.addAttack({
      owner: this,
      type: (this.archetype === 'tank' || this.archetype === 'boss_bramble' || this.archetype === 'boss_forge') ? 'strong' : 'weak',
      element: this.elementalAffinity,
      damage: this.isBoss ? 26 : 24,
      postureDamage: this.config.postureDamage || 24,
      duration: dur,
      destroyOnHit: false,
      hitEntities: new Set(),
      hitbox: {
        x: cx + dx * reach - boxSize / 2,
        y: cy + dy * reach - boxSize / 2,
        width: boxSize,
        height: boxSize
      },
      update: function() {
        const curX = self.pos.x + self.width / 2;
        const curY = self.pos.y + self.height / 2;
        this.hitbox.x = curX + dx * reach - boxSize / 2;
        this.hitbox.y = curY + dy * reach - boxSize / 2;
      }
    });

    // Ataques especiales de Fase II para Guardianes Cuerpo a Cuerpo
    if (this.archetype === 'boss_bramble' && this.phase >= 2 && projSys && typeof projSys.spawn === 'function') {
      const baseAng = Math.atan2(dy, dx);
      const offsets = [-0.28, 0, 0.28];
      for (let i = 0; i < offsets.length; i++) {
        const ang = baseAng + offsets[i];
        projSys.spawn({
          owner: this,
          type: 'projectile',
          element: 'plantas',
          spriteKey: 'poison_orb',
          isFriendly: false,
          reflectable: true,
          damage: 20,
          postureDamage: 24,
          duration: 1.9,
          x: cx + Math.cos(ang) * 18,
          y: cy + Math.sin(ang) * 18,
          dx: Math.cos(ang),
          dy: Math.sin(ang),
          speed: 215,
          radius: 8,
          altitude: 'high',
          destroyOnHit: true
        });
      }
    } else if (this.archetype === 'boss_forge' && this.phase >= 2) {
      const magmaR = 62;
      combat.addAttack({
        owner: this,
        type: 'zone',
        isMagmaZone: true,
        element: 'fuego',
        damage: 1,
        heartDamage: 1,
        postureDamage: 28,
        duration: 1.8,
        maxDuration: 1.8,
        originX: cx,
        originY: cy,
        radius: magmaR,
        hitEntities: new Set(),
        hitbox: { x: cx - magmaR, y: cy - magmaR, width: magmaR * 2, height: magmaR * 2 }
      });
    }
  }

  /**
   * Evalúa la detección del jugador de forma ultra ligera (O(1)).
   * Cuando `stealthSystem` está desactivado (comportamiento estándar), usa aggro directo por radio
   * sin lanzar rayos ni evaluar conos de visión cada fotograma.
   * Si `stealthSystem.enabled === true`, delega al módulo compacto de detección y sigilo.
   * @param {Object} player
   * @param {number} distSq - Distancia al cuadrado entre enemigo y jugador
   * @param {number} toPlayerX
   * @param {number} toPlayerY
   * @param {Object} physics
   * @param {import('../systems/StealthSystem.js').StealthSystem|null} [stealthSystem=null]
   * @param {number} [dt=0.016]
   * @returns {boolean}
   */
  checkPlayerDetection(player, distSq, toPlayerX, toPlayerY, physics, stealthSystem = null, dt = 0.016) {
    if (!player || player.health <= 0 || player.isDead) return false;

    if (stealthSystem && stealthSystem.enabled) {
      return stealthSystem.checkEnemyDetection(this, player, distSq, toPlayerX, toPlayerY, physics, dt);
    }

    const aggroRange = (this.config && this.config.aggroRange) ? this.config.aggroRange : 136;
    const effectiveRange = this.hasTag('wave_enemy') ? Math.max(aggroRange * 1.45, 215) : aggroRange;
    return distSq <= effectiveRange * effectiveRange;
  }

  /**
   * Captura un registro compacto del estado persistente de este enemigo al descargar su chunk.
   * @param {number} [clockSec=0]
   * @returns {Object}
   */
  serializeChunkState(clockSec = 0) {
    return {
      isDead: Boolean(this.isDead),
      health: this.health,
      hasWoodenShield: Boolean(this.hasWoodenShield),
      hasMetalArmor: Boolean(this.hasMetalArmor),
      phase: this.phase || 1,
      grantedKillEssence: Boolean(this._hasGrantedKillEssence),
      parryEssenceGranted: Boolean(this._parryEssenceGranted),
      respawnRemaining: this.isDead ? Math.max(0, this.respawnTimer || 0) : 0,
      unloadedAtSec: clockSec,
      x: this.isDead ? this.initialX : Math.round(this.pos.x),
      y: this.isDead ? this.initialY : Math.round(this.pos.y)
    };
  }

  /**
   * Restaura el estado recordado del enemigo al recargar su chunk, descontando tiempo transcurrido.
   * @param {Object} state
   * @param {number} [clockSec=0]
   */
  restoreChunkState(state, clockSec = 0) {
    if (!state) return;
    this._hasGrantedKillEssence = Boolean(state.grantedKillEssence);
    this._parryEssenceGranted = Boolean(state.parryEssenceGranted);

    if (typeof state.hasWoodenShield === 'boolean' && state.hasWoodenShield !== this.hasWoodenShield) {
      this.hasWoodenShield = state.hasWoodenShield;
      if (!this.hasWoodenShield) {
        this.tags = this.tags.filter((t) => t !== 'wooden_shield');
      }
    }

    if (typeof state.hasMetalArmor === 'boolean' && state.hasMetalArmor !== this.hasMetalArmor) {
      this.hasMetalArmor = state.hasMetalArmor;
      if (!this.hasMetalArmor) {
        this.tags = this.tags.filter((t) => t !== 'metal_armor');
      }
    }

    if (typeof state.phase === 'number' && state.phase >= 2) {
      this.phase = state.phase;
    }

    if (state.isDead) {
      if (this.noRespawn || this.hasTag('no_respawn')) {
        this.isDead = true;
        this.health = 0;
        this.respawnTimer = 999999;
        this.tags = this.tags.filter((t) => t !== 'solid');
        return;
      }

      const elapsed = Math.max(0, clockSec - (state.unloadedAtSec || 0));
      const remaining = (state.respawnRemaining || 0) - elapsed;
      if (remaining > 0) {
        this.isDead = true;
        this.health = 0;
        this.respawnTimer = remaining;
        this.tags = this.tags.filter((t) => t !== 'solid');
      } else {
        this.isDead = false;
        this.health = this.max_health;
        this.respawnTimer = 0;
        this.pos.set(this.initialX, this.initialY);
      }
      return;
    }

    if (typeof state.health === 'number') {
      this.health = Math.max(1, Math.min(this.max_health, state.health));
    }
    if (typeof state.x === 'number' && typeof state.y === 'number') {
      this.pos.set(state.x, state.y);
    }
  }

  /**
   * Ciclo principal de actualización de IA, físicas y estados alterados.
   * @param {Object} context
   */
  update(context) {
    super.update(context);
    const dt = context.deltaTime || 0.016;
    const physics = context.physics || null;
    const player = context.player || null;

    // Relajar Squash & Stretch hacia (1, 1)
    const relax = Math.min(1, dt * 12);
    this.scaleX += (1.0 - this.scaleX) * relax;
    this.scaleY += (1.0 - this.scaleY) * relax;

    if (this.hurtTimer > 0) this.hurtTimer -= dt;

    // 1. Gestión de Muerte y Reaparición limpia
    if (this.isDead) {
      this._lastPlayerDistSq = Infinity;
      this.suspicion = 0;
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.isDead = false;
        this.health = this.max_health;
        this.aiState = 'IDLE';
        this.aiTimer = 0.8;
        this.pos.set(this.initialX, this.initialY);
        if (!this.tags.includes('solid')) this.tags.push('solid');
        if (this._initialWoodenShield) {
          this.hasWoodenShield = true;
          if (!this.tags.includes('wooden_shield')) this.tags.push('wooden_shield');
        }
        if (this._initialMetalArmor) {
          this.hasMetalArmor = true;
          if (!this.tags.includes('metal_armor')) this.tags.push('metal_armor');
        }
        if (context.entityManager) context.entityManager._solidsCache = null;
        if (context.vfxRenderer) {
          context.vfxRenderer.spawnImpact('parry_spark', this.pos.x + 16, this.pos.y + 16, { radius: 24, duration: 0.35 });
        }
      }
      return;
    }

    this.animClock = (this.animClock || 0) + dt;
    this.bobPhase += dt * 4.2;

    // 2. Daño periódico por Quemadura Ígnea y Espinas Sifón (DoT)
    if (this.hasTag('quemadura_ignea')) {
      this.burnTickTimer += dt;
      if (this.burnTickTimer >= 0.85) {
        this.burnTickTimer = 0;
        this.takeDamage(6, { element: 'fuego' }, context, false);
        if (this.isDead) return;
      }
    } else {
      this.burnTickTimer = 0;
    }

    if (this.hasTag('sangrado_espinas')) {
      this.thornTickTimer += dt;
      if (this.thornTickTimer >= 0.75) {
        this.thornTickTimer = 0;
        this.takeDamage(5, { element: 'plantas' }, context, false);
        if (this.isDead) return;
      }
    } else {
      this.thornTickTimer = 0;
    }

    if (this.hasTag('sobrecarga_eter')) {
      this.etherTickTimer += dt;
      if (this.etherTickTimer >= 0.90) {
        this.etherTickTimer = 0;
        this.takeDamage(5, { element: 'eter' }, context, false);
        if (this.isDead) return;
      }
    } else {
      this.etherTickTimer = 0;
    }

    // 3. Parálisis si está Aturdido (Staggered por Parry) o atrapado en Prisión Selvática
    const isStaggered = this.hasTag('staggered');
    const isRooted = this.hasTag('inmovilizado_raices');
    if (isStaggered) {
      if (this.aiState === 'TELEGRAPH' || this.aiState === 'ATTACK') {
        if (context.combatManager) context.combatManager.cancelAttacksFrom(this);
        this.aiState = 'COOLDOWN';
        this.aiTimer = 0.5;
      }
      return;
    }

    if (isRooted) {
      // Inmovilizado en su sitio (aunque el Artillero aún puede orientarse lentamente)
      if (this.aiState === 'ATTACK' && this.archetype !== 'artillery') {
        if (context.combatManager) context.combatManager.cancelAttacksFrom(this);
        this.aiState = 'COOLDOWN';
        this.aiTimer = 0.6;
      }
      return;
    }

    if (!player) return;

    const stealthSystem = context.stealthSystem || null;
    const myX = this.pos.x + this.width * 0.5;
    const myY = this.pos.y + this.height * 0.5;
    const plX = player.pos.x + player.width * 0.5;
    const plY = player.pos.y + player.height * 0.5;
    const toPlayerX = plX - myX;
    const toPlayerY = plY - myY;
    const distSq = toPlayerX * toPlayerX + toPlayerY * toPlayerY;
    this._lastPlayerDistSq = distSq;

    // Ahorro de CPU: enemigos lejanos en reposo/patrulla (> 340 px) no procesan IA fuera de escena
    if (distSq > 115600 && (this.aiState === 'IDLE' || this.aiState === 'PATROL') && !this.hasTag('wave_enemy')) {
      return;
    }

    const distToPlayer = Math.sqrt(distSq);
    const homeDx = myX - this.initialX;
    const homeDy = myY - this.initialY;
    const distFromHomeSq = homeDx * homeDx + homeDy * homeDy;

    // 4. Máquina de Estados Táctica por Arquetipo
    switch (this.aiState) {
      case 'IDLE': {
        this.aiTimer -= dt;
        if (this.checkPlayerDetection(player, distSq, toPlayerX, toPlayerY, physics, stealthSystem, dt)) {
          this.aiState = 'CHASE';
          this.loseAggroTimer = 2.0;
          if (!this.isAlerted) {
            this.isAlerted = true;
            if (context.uiManager && context.camera) {
              context.uiManager.spawnDamageNumber(this.pos.x + 16, this.pos.y - 12, '¡!', '#facc15');
            }
          }
          break;
        }
        if (this.aiTimer <= 0) {
          const ang = Math.random() * Math.PI * 2;
          const r = 24 + Math.random() * 36;
          this.patrolTarget.set(this.initialX + Math.cos(ang) * r, this.initialY + Math.sin(ang) * r);
          this.aiState = 'PATROL';
          this.aiTimer = 1.4 + Math.random();
        }
        break;
      }

      case 'PATROL': {
        if (this.checkPlayerDetection(player, distSq, toPlayerX, toPlayerY, physics, stealthSystem, dt)) {
          this.aiState = 'CHASE';
          this.loseAggroTimer = 2.0;
          if (!this.isAlerted) {
            this.isAlerted = true;
            if (context.uiManager && context.camera) {
              context.uiManager.spawnDamageNumber(this.pos.x + 16, this.pos.y - 12, '¡!', '#facc15');
            }
          }
          break;
        }
        this.aiTimer -= dt;
        const dx = this.patrolTarget.x - this.pos.x;
        const dy = this.patrolTarget.y - this.pos.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < 64 || this.aiTimer <= 0) {
          this.aiState = 'IDLE';
          this.aiTimer = 1.0 + Math.random() * 1.2;
        } else {
          const d = Math.sqrt(dSq);
          this._faceVector(dx, dy, 0.25);
          this._moveSafe((dx / d) * this.config.speed * 0.45, (dy / d) * this.config.speed * 0.45, dt, physics);
        }
        break;
      }

      case 'CHASE': {
        const stealthActive = Boolean(stealthSystem && stealthSystem.enabled);
        // Pérdida de agresividad si el sigilo está activo y se oculta o si se aleja demasiado
        if ((stealthActive && player.isStealthHidden) || (!this.hasTag('wave_enemy') && distToPlayer > this.config.aggroRange * 1.4)) {
          this.loseAggroTimer -= dt;
          if (this.loseAggroTimer <= 0) {
            this.aiState = 'PATROL';
            this.isAlerted = false;
            this.patrolTarget.set(this.initialX, this.initialY);
            this.aiTimer = 2.0;
            break;
          }
        } else {
          this.loseAggroTimer = 2.0;
        }

        // Correa territorial (Leash) para no perseguir infinitamente fuera de su zona (> 200 px)
        if (!this.hasTag('wave_enemy') && distToPlayer > this.config.aggroRange * 1.25 && distFromHomeSq > 40000) {
          this.patrolTarget.set(this.initialX, this.initialY);
          this.aiState = 'PATROL';
          this.isAlerted = false;
          this.aiTimer = 2.5;
          break;
        }

        const nx = toPlayerX / (distToPlayer || 1);
        const ny = toPlayerY / (distToPlayer || 1);

        // El Tanque gira un poco más lento para premiar flanqueos con Dash
        const turnRate = this.archetype === 'tank' ? Math.min(1, dt * 4.2) : Math.min(1, dt * 10);
        this._faceVector(nx, ny, turnRate);

        // Fuerza de Separación Zero-GC: cubeta directa en escenas ligeras o SpatialGrid O(1) en hordas
        let sepX = 0;
        let sepY = 0;
        const myCx = this.pos.x + this.width * 0.5;
        const myCy = this.pos.y + this.height * 0.5;
        let nearbyEnts = null;
        if (context && context.entityManager) {
          if (typeof context.entityManager.queryNearby === 'function' && context.entityManager.entities.length >= 48) {
            if (!Enemy._sepQueryBuf) Enemy._sepQueryBuf = [];
            nearbyEnts = context.entityManager.queryNearby(
              myCx - 48, myCy - 48, myCx + 48, myCy + 48, Enemy._sepQueryBuf
            );
          } else {
            nearbyEnts = context.entityManager.getByTag('enemy');
          }
        } else if (context) {
          nearbyEnts = context.entities;
        }
        if (nearbyEnts) {
          for (let i = 0; i < nearbyEnts.length; i++) {
            const other = nearbyEnts[i];
            if (!other || other === this || other.isDead) continue;
            if (!other.hasTag('enemy')) continue;
            const dx = myCx - (other.pos.x + other.width * 0.5);
            const dy = myCy - (other.pos.y + other.height * 0.5);
            const dSq = dx * dx + dy * dy;
            if (dSq > 0.01 && dSq < 2304) { // Radio < 48px
              const d = Math.sqrt(dSq);
              const strength = (48 - d) / 48;
              sepX += (dx / d) * strength;
              sepY += (dy / d) * strength;
            }
          }
        }
        const sepWeight = (this.config.speed || 90) * 0.85;
        const repulseX = sepX * sepWeight;
        const repulseY = sepY * sepWeight;

        if (this.archetype === 'artillery' || this.archetype === 'sentinel_ether' || this.archetype === 'boss_spore') {
          // Kiting: se aleja si te pegas demasiado, se acerca si estás lejos, dispara en banda óptima
          if (distToPlayer < this.config.preferredMinDist) {
            this._moveSafe(-nx * this.config.speed + repulseX, -ny * this.config.speed + repulseY, dt, physics);
          } else if (distToPlayer > this.config.attackRange * 0.88) {
            this._moveSafe(nx * this.config.speed + repulseX, ny * this.config.speed + repulseY, dt, physics);
          } else {
            // Orbitar levemente antes de disparar
            this._moveSafe(-ny * this.strafeSign * this.config.speed * 0.5 + repulseX, nx * this.strafeSign * this.config.speed * 0.5 + repulseY, dt, physics);
          }

          this.aiTimer -= dt;
          if (distToPlayer <= this.config.attackRange && this.aiTimer <= 0) {
            this._enterTelegraph(nx, ny, context);
          }
        } else if (this.archetype === 'duelist' || this.archetype === 'boss_astral') {
          // Esgrima orbital elegante antes de estocar
          const perpX = -ny * this.strafeSign;
          const perpY = nx * this.strafeSign;
          const approachFactor = distToPlayer > 95 ? 0.75 : (distToPlayer < 65 ? -0.35 : 0.15);
          const vx = (nx * approachFactor + perpX * 0.75) * this.config.speed + repulseX;
          const vy = (ny * approachFactor + perpY * 0.75) * this.config.speed + repulseY;
          this._moveSafe(vx, vy, dt, physics);

          this.aiTimer -= dt;
          if (distToPlayer <= this.config.attackRange && this.aiTimer <= 0) {
            this.strafeSign *= -1;
            this._enterTelegraph(nx, ny, context);
          }
        } else if (this.archetype === 'hound') {
          if (this.aiTimer > 0) {
            // En espera de token de ataque: amague orbital alrededor de Santi
            this.aiTimer -= dt;
            this._moveSafe(
              -ny * this.strafeSign * this.config.speed * 0.78 + repulseX,
              nx * this.strafeSign * this.config.speed * 0.78 + repulseY,
              dt,
              physics
            );
          } else {
            // Sabueso: aproximación diagonal veloz de flanqueo
            const flankX = nx * 0.85 + (-ny * this.strafeSign) * 0.42;
            const flankY = ny * 0.85 + (nx * this.strafeSign) * 0.42;
            this._moveSafe(flankX * this.config.speed + repulseX, flankY * this.config.speed + repulseY, dt, physics);

            if (distToPlayer <= this.config.attackRange) {
              this._enterTelegraph(nx, ny, context);
            }
          }
        } else {
          if (this.aiTimer > 0) {
            // Tanque / Slime en espera de token: rodea manteniendo presión frontal
            this.aiTimer -= dt;
            this._moveSafe(
              -ny * this.strafeSign * this.config.speed * 0.6 + repulseX,
              nx * this.strafeSign * this.config.speed * 0.6 + repulseY,
              dt,
              physics
            );
          } else {
            // Tank / Slime: avance frontal implacable con separación en abanico
            this._moveSafe(nx * this.config.speed + repulseX, ny * this.config.speed + repulseY, dt, physics);
            if (distToPlayer <= this.config.attackRange) {
              this._enterTelegraph(nx, ny, context);
            }
          }
        }
        break;
      }

      case 'TELEGRAPH': {
        // Comprimir postura mostrando intención clara al jugador
        this.scaleX = 1.18;
        this.scaleY = 0.82;

        // Seguimiento ligero en la primera mitad de la telegrafía, luego bloquea ángulo para esquiva justa
        if (this.aiTimer > this.config.telegraphTime * 0.45) {
          const nx = toPlayerX / (distToPlayer || 1);
          const ny = toPlayerY / (distToPlayer || 1);
          this.attackVector.set(nx, ny);
          this._faceVector(nx, ny, 0.35);
        }

        this.aiTimer -= dt;
        if (this.aiTimer <= 0) {
          this.aiState = 'ATTACK';
          this.aiTimer = this.config.attackDuration;
          this._launchArchetypeAttack(context);
        }
        break;
      }

      case 'ATTACK': {
        this.aiTimer -= dt;
        if (this.archetype !== 'artillery' && this.archetype !== 'sentinel_ether' && this.archetype !== 'boss_spore' && this.config.lungeSpeed) {
          this._moveSafe(
            this.attackVector.x * this.config.lungeSpeed,
            this.attackVector.y * this.config.lungeSpeed,
            dt,
            physics
          );
        }
        if (this.aiTimer <= 0) {
          if (context && context.combatManager && typeof context.combatManager.releaseAttackToken === 'function') {
            context.combatManager.releaseAttackToken(this);
          }
          this.aiState = 'COOLDOWN';
          this.aiTimer = this.config.cooldownTime * (0.85 + Math.random() * 0.3);
        }
        break;
      }

      case 'COOLDOWN': {
        this.aiTimer -= dt;
        if (distToPlayer > 0) {
          const nx = toPlayerX / distToPlayer;
          const ny = toPlayerY / distToPlayer;
          const turnRate = this.archetype === 'tank' ? Math.min(1, dt * 3.0) : Math.min(1, dt * 6.0);
          this._faceVector(nx, ny, turnRate);

          // Duelista y Artillero mantienen distancia táctica durante recuperación
          if ((this.archetype === 'duelist' || this.archetype === 'artillery') && distToPlayer < 85) {
            this._moveSafe(-nx * this.config.speed * 0.55, -ny * this.config.speed * 0.55, dt, physics);
          }
        }
        if (this.aiTimer <= 0) {
          this.aiState = 'CHASE';
          this.aiTimer = 0.25;
        }
        break;
      }
    }
  }

  /**
   * Inicia la fase de Telegrafía AAA con señal sonora y visual de ataque inminente.
   * @private
   */
  _enterTelegraph(nx, ny, context) {
    // Coordinación táctica de tokens cuerpo a cuerpo (máximo 2 atacantes simultáneos para Parry justo)
    if (
      this.archetype !== 'artillery' &&
      this.archetype !== 'sentinel_ether' &&
      this.archetype !== 'boss_spore' &&
      context &&
      context.combatManager &&
      typeof context.combatManager.requestAttackToken === 'function'
    ) {
      if (!context.combatManager.requestAttackToken(this)) {
        // Sin token libre: esperar brevemente en órbita sin apilar telegrafías
        this.strafeSign *= -1;
        this.aiTimer = 0.30;
        return;
      }
    }

    this.aiState = 'TELEGRAPH';
    this.aiTimer = this.config.telegraphTime;
    this.attackVector.set(nx, ny);
    if (context && context.audioManager) {
      context.audioManager.playTelegraph();
    }
  }

  /**
   * Asigna textura opcional de sprite externo.
   * @param {HTMLImageElement|HTMLCanvasElement} sprite
   */
  setSprite(sprite) {
    this.sprite = sprite;
  }

  /**
   * Renderiza el cono de visión compacto únicamente cuando StealthSystem está activado.
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../systems/StealthSystem.js').StealthSystem|null} [stealthSystem=null]
   * @param {((key: string) => HTMLCanvasElement|null)|null} [getConeSpriteFn=null]
   */
  drawVisionCone(ctx, stealthSystem = null, getConeSpriteFn = null) {
    if (!stealthSystem || !stealthSystem.enabled) return;
    stealthSystem.drawCompactVisionCone(ctx, this, getConeSpriteFn);
  }

  /**
   * Renderizado estilizado 32-bit diferenciado por Arquetipo + Telegrafía + Estados Alterados.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (this.isDead) return;

    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    const cx = x + Math.round(this.width * 0.5);
    const cy = y + Math.round(this.height * 0.5);

    // 0. Línea / Anillo de Telegrafía Táctica antes de atacar (los conos de visión se dibujan en la capa de suelo)
    if (this.aiState === 'TELEGRAPH') {
      const progress = 1 - Math.max(0, this.aiTimer / this.config.telegraphTime);
      ctx.save();
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 + progress * 0.55})`;
      ctx.lineWidth = 2;
      if (this.archetype !== 'artillery' && this.archetype !== 'sentinel_ether' && this.archetype !== 'boss_spore') {
        const reach = (this.archetype === 'duelist' || this.archetype === 'boss_astral') ? 76 : (this.archetype === 'hound' ? 68 : 48);
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, y + this.height - 8);
        ctx.lineTo(Math.round(cx + this.attackVector.x * reach), Math.round((y + this.height - 8) + this.attackVector.y * reach));
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.round(18 * (1 - progress * 0.4)), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.sprite) {
      ctx.drawImage(this.sprite, x, y, this.width, this.height);
      return;
    }

    // Aura dorada/carmesí de Fase II para Guardianes Regionales
    if (this.isBoss && this.phase >= 2) {
      const auraPulse = 0.25 + Math.sin((this.animClock || 0) * 8) * 0.12;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = this.elementalAffinity === 'astral' ? '#e879f9' : '#fb923c';
      ctx.globalAlpha = auraPulse;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 1. Sombra pixel-art escalonada en el suelo (sin borrosidad ni duplicación desde Renderer)
    ctx.fillStyle = 'rgba(11, 16, 29, 0.30)';
    if (this.isBoss) {
      ctx.fillRect(cx - 16, y + this.height - 6, 32, 5);
      ctx.fillRect(cx - 19, y + this.height - 4, 38, 2);
    } else {
      ctx.fillRect(cx - 10, y + 27, 20, 4);
      ctx.fillRect(cx - 12, y + 28, 24, 2);
    }

    const bob = (this.aiState === 'CHASE' || this.aiState === 'PATROL')
      ? Math.round(Math.sin(this.bobPhase * 2) * 1.5)
      : Math.round(Math.sin(this.bobPhase) * 1);

    ctx.save();
    ctx.translate(0, bob);

    // 2. Sprite 2D Cel-Shaded horneado con borde de tinta por Arquetipo
    const atlasArchetype = this.archetype;
    const celSprite = CelSpriteAtlas.getEnemySprite(atlasArchetype, this.elementalAffinity, this.hurtTimer > 0);
    if (celSprite) {
      if (this.isBoss) {
        ctx.drawImage(celSprite, x - 6, y - 10);
      } else if (atlasArchetype === 'hound' && this.aimDir.x < -0.15) {
        ctx.save();
        ctx.translate(cx, y + 14);
        ctx.scale(-1, 1);
        ctx.drawImage(celSprite, -22, -22);
        ctx.restore();
      } else {
        ctx.drawImage(celSprite, x - 6, y - 8);
      }
    }

    // Accesorios tácticos dinámicos orientados hacia `aimDir`
    if ((this.archetype === 'tank' || this.archetype === 'boss_bramble') && this.hasWoodenShield) {
      // Gran Pavés de Roble Frontal (destructible con Fuego)
      const sx = Math.round(cx + this.aimDir.x * (this.isBoss ? 14 : 11) - 10);
      const sy = Math.round(cy + this.aimDir.y * (this.isBoss ? 10 : 8) - 7);
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#0b101d';
      ctx.lineWidth = 2;
      ctx.fillRect(sx, sy, 20, 17);
      ctx.strokeRect(sx, sy, 20, 17);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(sx + 2, sy + 2, 16, 4);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(sx + 8, sy + 7, 4, 4);
    } else if (this.hasMetalArmor) {
      // Placa de Coraza Volcánica (quebrable con Cinética o Éter)
      const ax = Math.round(cx + this.aimDir.x * 11 - 9);
      const ay = Math.round(cy + this.aimDir.y * 8 - 7);
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#0b101d';
      ctx.lineWidth = 2;
      ctx.fillRect(ax, ay, 18, 14);
      ctx.strokeRect(ax, ay, 18, 14);
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(ax + 3, ay + 5, 12, 3);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(ax + 2, ay + 2, 14, 2);
    } else if (this.archetype === 'duelist' || this.archetype === 'boss_astral') {
      // Estoque cel-shaded apuntando hacia el jugador
      const bladeReach = this.isBoss ? 29 : 23;
      ctx.strokeStyle = '#0b101d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx + this.aimDir.x * 6, cy + this.aimDir.y * 6);
      ctx.lineTo(cx + this.aimDir.x * bladeReach, cy + this.aimDir.y * bladeReach);
      ctx.stroke();

      ctx.strokeStyle = this.aiState === 'TELEGRAPH' ? '#fde047' : (this.isBoss ? '#e879f9' : '#f8fafc');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + this.aimDir.x * 6, cy + this.aimDir.y * 6);
      ctx.lineTo(cx + this.aimDir.x * bladeReach, cy + this.aimDir.y * bladeReach);
      ctx.stroke();
    }

    ctx.restore();

    // 3. Señal de Exclamación Roja/Dorada durante Telegrafía (Lectura de Parry Perfecto)
    if (this.aiState === 'TELEGRAPH') {
      ctx.save();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(cx - 2, y - 14, 4, 7);
      ctx.fillRect(cx - 2, y - 5, 4, 3);
      ctx.restore();
    }

    // 4. Efectos Visuales de Estados Alterados
    // 4.1 Prisión Selvática (Raíces)
    if (this.hasTag('inmovilizado_raices')) {
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 27);
      ctx.lineTo(x + 10, y + 11);
      ctx.lineTo(x + 16, y + 27);
      ctx.lineTo(x + 22, y + 12);
      ctx.lineTo(x + 28, y + 27);
      ctx.stroke();
    }

    // 4.2 Quemadura Ígnea (píxeles deterministas usando animClock)
    if (this.hasTag('quemadura_ignea')) {
      const fPulse = Math.round(Math.sin((this.animClock || 0) * 12.5) * 2);
      ctx.fillStyle = 'rgba(249, 115, 22, 0.85)';
      ctx.fillRect(x + 8, y + 10 + fPulse, 4, 5);
      ctx.fillRect(x + 20, y + 12 - fPulse, 4, 4);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(x + 9, y + 11 + fPulse, 2, 2);
      ctx.fillRect(x + 21, y + 13 - fPulse, 2, 2);
    }

    // 4.3 Armadura Rota (Cinético)
    if (this.hasTag('armor_break')) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 6, y + 8, this.width - 12, this.height - 14);
    }

    // 4.35 Sobrecarga de Éter Magnético (chispas violeta/cian deterministas)
    if (this.hasTag('sobrecarga_eter')) {
      const ep = Math.round(Math.cos((this.animClock || 0) * 16) * 2);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 4, cy + ep);
      ctx.lineTo(cx, cy - 6 - ep);
      ctx.lineTo(x + this.width - 4, cy + ep);
      ctx.stroke();
    }

    // 4.4 Estrellas Doradas de Stagger (Ventana abierta para Riposte Crítico x3.0)
    if (this.hasTag('staggered')) {
      const t = (this.animClock || 0) * 6.25;
      for (let i = 0; i < 3; i++) {
        const ang = t + (i * Math.PI * 2 / 3);
        const sx = Math.round(cx + Math.cos(ang) * 12);
        const sy = Math.round(y - 2 + Math.sin(ang) * 4);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
      }
    }

    // 5. Barra de Salud Táctica Superior (alineada a píxel entero)
    const barW = this.isBoss ? 40 : 28;
    const barH = this.isBoss ? 5 : 4;
    const barX = Math.round(cx - barW / 2);
    const barY = y - 6;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    const healthPct = Math.max(0, this.health / this.max_health);
    ctx.fillStyle = this.hasTag('staggered') ? '#fde047' : (healthPct > 0.4 ? (this.isBoss ? '#f97316' : '#22c55e') : '#ef4444');
    ctx.fillRect(barX, barY, Math.round(barW * healthPct), barH);
  }
}
