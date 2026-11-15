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
    aggroRange: 220,
    attackRange: 105,
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
    aggroRange: 265,
    preferredMinDist: 110,
    attackRange: 250,
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
    aggroRange: 210,
    attackRange: 56,
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
    aggroRange: 240,
    attackRange: 128,
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
    aggroRange: 195,
    attackRange: 85,
    telegraphTime: 0.45,
    attackDuration: 0.24,
    cooldownTime: 1.60,
    lungeSpeed: 250,
    postureDamage: 20,
    essenceReward: 2
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
    super(x, y, 32, 32);
    this.elementalAffinity = elementalAffinity;
    this.name = name;

    // Inferir arquetipo automáticamente si no se especificó en niveles heredados
    if (!archetype) {
      if (elementalAffinity === 'kinetic') archetype = 'duelist';
      else if (elementalAffinity === 'fuego') archetype = 'artillery';
      else archetype = 'hound';
    }
    this.archetype = ENEMY_ARCHETYPES[archetype] ? archetype : 'slime';
    this.config = ENEMY_ARCHETYPES[this.archetype];

    this.tags.push('enemy');
    this.tags.push('solid');
    this.tags.push(`elem_${elementalAffinity}`);

    /** @type {boolean} Escudo pesado de roble (exclusivo del Centinela Pavés hasta ser quemado) */
    this.hasWoodenShield = !!this.config.hasWoodenShield;
    this._initialWoodenShield = this.hasWoodenShield;
    if (this.hasWoodenShield) {
      this.tags.push('wooden_shield');
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

    // --- Temporizadores de Estado, Quemadura, Espinas y Reaparición ---
    this.hurtTimer = 0;
    this.burnTickTimer = 0;
    this.thornTickTimer = 0;
    this._hasGrantedKillEssence = false;
    this._parryEssenceGranted = false;
    this.initialX = x;
    this.initialY = y;
    this.respawnTimer = 0;
    this.isDead = false;

    // --- Sistema de Cono de Visión y Escáner (extraído de The-last-endo) ---
    this.visionRange = this.config.visionRange || Math.max(190, (this.config.aggroRange || 170) * 1.15);
    this.visionAngle = this.config.visionAngle || (Math.PI / 4); // 45° semi-ángulo (cono 90° FOV)
    this.scannerSweep = 0;
    this.isAlerted = false;
    this.loseAggroTimer = 0;

    // --- Animación Procedural Viva y Reloj de Escáner ---
    this.animClock = 0;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.scaleX = 1.0;
    this.scaleY = 1.0;

    // Hitbox precisa en la base para colisiones y Y-Sorting
    this.hitbox = {
      offsetX: 5,
      offsetY: 14,
      width: 22,
      height: 16
    };
    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;
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
      (atkElem === 'kinetic' && defElem === 'fuego')
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
    const slowMult = this.hasTag('enredado_espinas') ? 0.52 : 1.0;
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
    if (!combat) return;

    const cx = this.pos.x + this.width / 2;
    const cy = this.pos.y + this.height / 2;
    const dx = this.attackVector.x;
    const dy = this.attackVector.y;

    this.scaleX = 1.26;
    this.scaleY = 0.78;

    if (this.archetype === 'artillery') {
      // Disparar proyectil deflectable con Parry Deportivo
      const pSpeed = this.config.projectileSpeed || 225;
      const startX = cx + dx * 14;
      const startY = cy + dy * 14;

      combat.addAttack({
        owner: this,
        type: 'projectile',
        isProjectile: true,
        element: this.elementalAffinity,
        damage: 22,
        postureDamage: this.config.postureDamage,
        duration: 2.2,
        x: startX,
        y: startY,
        dx,
        dy,
        speed: pSpeed,
        destroyOnHit: true,
        hitbox: { x: startX - 8, y: startY - 8, width: 16, height: 16 },
        update: function(dt) {
          this.x += this.dx * this.speed * dt;
          this.y += this.dy * this.speed * dt;
          this.hitbox.x = this.x - 8;
          this.hitbox.y = this.y - 8;
        }
      });
      return;
    }

    // Ataque cuerpo a cuerpo en embestida (Hound, Tank, Duelist, Slime)
    const dur = this.config.attackDuration || 0.24;
    const boxSize = this.archetype === 'tank' ? 42 : 30;
    const reach = this.archetype === 'duelist' ? 24 : 16;
    const self = this;

    combat.addAttack({
      owner: this,
      type: this.archetype === 'tank' ? 'strong' : 'weak',
      element: this.elementalAffinity,
      damage: 24,
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
  }

  /**
   * Evalúa la detección del jugador mediante Cono de Visión, Escáner, Línea de Visión y Sigilo.
   * Considera contacto físico, ruido de sprint, caminata erguida, ocultamiento en hierba alta y FOV 90°.
   * @param {Object} player
   * @param {number} distToPlayer
   * @param {number} toPlayerX
   * @param {number} toPlayerY
   * @param {Object} physics
   * @returns {boolean}
   */
  checkPlayerDetection(player, distToPlayer, toPlayerX, toPlayerY, physics) {
    if (!player || player.health <= 0 || player.isDead) return false;

    // 1. Proximidad física inmediata (<= 24 px) siempre alerta al enemigo por contacto
    if (distToPlayer <= 24) return true;

    // 2. Sigilo en Grama Alta: cuerpo a tierra oculta al héroe del cono óptico y percepción periférica
    if (player.isStealthHidden) {
      return false;
    }

    // 3. Línea de Visión (muros, casas, pilares y acantilados bloquean detección)
    const myCx = this.pos.x + this.width * 0.5;
    const myCy = this.pos.y + this.height * 0.5;
    const plCx = player.pos.x + (player.width || 32) * 0.5;
    const plCy = player.pos.y + (player.height || 32) * 0.5;
    const hasLOS = !physics || typeof physics.hasLineOfSight !== 'function'
      || physics.hasLineOfSight(myCx, myCy, plCx, plCy);
    if (!hasLOS) {
      return false;
    }

    // 4. Enemigos de horda activa detectan en 360° dentro de rango extendido de arena
    const aggroRange = (this.config && this.config.aggroRange) ? this.config.aggroRange : 170;
    if (this.hasTag('wave_enemy') && distToPlayer <= aggroRange * 1.5) {
      return true;
    }

    // 5. Ruido de pasos al correr/esprintar con [F]/[V]
    if (player.isSprinting && distToPlayer <= Math.min(aggroRange * 1.15, 130)) {
      return true;
    }

    // 6. Percepción cercana de pasos si el jugador camina erguido (!isProne)
    if (!player.isProne && distToPlayer <= 76) {
      return true;
    }

    // 7. Cono de Visión Óptica Direccional con Escáner (cuerpo a tierra reduce silueta al 72%)
    const baseVisionRange = this.visionRange || 200;
    const effectiveRange = player.isProne ? baseVisionRange * 0.72 : baseVisionRange;
    if (distToPlayer > effectiveRange) return false;

    const baseAngle = Math.atan2(this.aimDir.y, this.aimDir.x);
    const scanClock = this.animClock || 0;
    const sweep = (this.aiState === 'PATROL' || this.aiState === 'IDLE')
      ? Math.sin(scanClock * 2.4) * 0.32
      : 0;
    const scannerAngle = baseAngle + sweep;

    const angleToPlayer = Math.atan2(toPlayerY, toPlayerX);
    let diff = angleToPlayer - scannerAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const halfAngle = this.visionAngle || (Math.PI / 4);
    if (Math.abs(diff) <= halfAngle) {
      return true;
    }

    return false;
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

    const myX = this.pos.x + this.width / 2;
    const myY = this.pos.y + this.height / 2;
    const plX = player.pos.x + player.width / 2;
    const plY = player.pos.y + player.height / 2;
    const toPlayerX = plX - myX;
    const toPlayerY = plY - myY;
    const distToPlayer = Math.hypot(toPlayerX, toPlayerY);
    const distFromHome = Math.hypot(myX - this.initialX, myY - this.initialY);

    // 4. Máquina de Estados Táctica por Arquetipo
    switch (this.aiState) {
      case 'IDLE': {
        this.aiTimer -= dt;
        if (this.checkPlayerDetection(player, distToPlayer, toPlayerX, toPlayerY, physics)) {
          this.aiState = 'CHASE';
          this.loseAggroTimer = 3.5;
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
        if (this.checkPlayerDetection(player, distToPlayer, toPlayerX, toPlayerY, physics)) {
          this.aiState = 'CHASE';
          this.loseAggroTimer = 3.5;
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
        const d = Math.hypot(dx, dy);
        if (d < 8 || this.aiTimer <= 0) {
          this.aiState = 'IDLE';
          this.aiTimer = 1.0 + Math.random() * 1.2;
        } else {
          this._faceVector(dx, dy, 0.25);
          this._moveSafe((dx / d) * this.config.speed * 0.45, (dy / d) * this.config.speed * 0.45, dt, physics);
        }
        break;
      }

      case 'CHASE': {
        // Pérdida de agresividad si el jugador se esconde en sigilo o se aleja demasiado
        if (player.isStealthHidden || distToPlayer > this.config.aggroRange * 1.55) {
          this.loseAggroTimer -= dt;
          if (this.loseAggroTimer <= 0) {
            this.aiState = 'PATROL';
            this.isAlerted = false;
            this.patrolTarget.set(this.initialX, this.initialY);
            this.aiTimer = 2.0;
            break;
          }
        } else {
          this.loseAggroTimer = 3.5;
        }

        // Correa territorial (Leash) para no perseguir infinitamente fuera de su zona
        if (distToPlayer > this.config.aggroRange * 1.45 && distFromHome > 260) {
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

        // Fuerza de Separación Zero-GC respecto a otros enemigos cercanos para formar abanico táctico
        let sepX = 0;
        let sepY = 0;
        const allEnts = context && (context.entities || (context.entityManager && context.entityManager.getByTag('enemy')));
        if (allEnts) {
          const myCx = this.pos.x + this.width * 0.5;
          const myCy = this.pos.y + this.height * 0.5;
          for (let i = 0; i < allEnts.length; i++) {
            const other = allEnts[i];
            if (!other || other === this || other.isDead) continue;
            if (!other.tags || !other.hasTag('enemy')) continue;
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

        if (this.archetype === 'artillery') {
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
        } else if (this.archetype === 'duelist') {
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
        if (this.archetype !== 'artillery' && this.config.lungeSpeed) {
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
   * Renderiza el Cono de Visión y Escáner en el suelo con pulso dinámico (estilo The-last-endo).
   * @param {CanvasRenderingContext2D} ctx
   */
  drawVisionCone(ctx) {
    if (this.isDead || this.health <= 0) return;
    if (this.aiState !== 'IDLE' && this.aiState !== 'PATROL' && this.aiState !== 'CHASE') return;

    const cx = Math.round(this.pos.x + this.width / 2);
    const cy = Math.round(this.pos.y + this.height / 2);
    const baseAngle = Math.atan2(this.aimDir.y, this.aimDir.x);
    const scanClock = this.animClock || 0;
    const sweep = (this.aiState === 'PATROL' || this.aiState === 'IDLE')
      ? Math.sin(scanClock * 2.4) * 0.32
      : 0;
    const angle = baseAngle + sweep;
    const halfAngle = this.visionAngle || (Math.PI / 4);
    const range = this.aiState === 'CHASE' ? Math.min(220, this.visionRange * 1.1) : this.visionRange;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, range, angle - halfAngle, angle + halfAngle);
    ctx.closePath();

    if (this.aiState === 'CHASE') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.32)';
    } else {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.06)';
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.18)';
    }
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Línea de escaneo móvil
    const scanDist = ((scanClock * 130) % range);
    ctx.beginPath();
    ctx.arc(cx, cy, scanDist, angle - halfAngle, angle + halfAngle);
    ctx.strokeStyle = this.aiState === 'CHASE' ? 'rgba(248, 113, 113, 0.28)' : 'rgba(253, 224, 71, 0.22)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Renderizado estilizado 32-bit diferenciado por Arquetipo + Telegrafía + Estados Alterados.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (this.isDead) return;

    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    const cx = x + 16;
    const cy = y + 16;

    // 0. Línea / Anillo de Telegrafía Táctica antes de atacar (los conos de visión se dibujan en la capa de suelo)
    if (this.aiState === 'TELEGRAPH') {
      const progress = 1 - Math.max(0, this.aiTimer / this.config.telegraphTime);
      ctx.save();
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 + progress * 0.55})`;
      ctx.lineWidth = 2;
      if (this.archetype !== 'artillery') {
        const reach = this.archetype === 'duelist' ? 76 : (this.archetype === 'hound' ? 68 : 42);
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, y + 24);
        ctx.lineTo(Math.round(cx + this.attackVector.x * reach), Math.round((y + 24) + this.attackVector.y * reach));
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.round(16 * (1 - progress * 0.4)), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.sprite) {
      ctx.drawImage(this.sprite, x, y, this.width, this.height);
      return;
    }

    // 1. Sombra pixel-art escalonada en el suelo (sin borrosidad ni duplicación desde Renderer)
    ctx.fillStyle = 'rgba(11, 16, 29, 0.30)';
    ctx.fillRect(cx - 10, y + 27, 20, 4);
    ctx.fillRect(cx - 12, y + 28, 24, 2);

    const bob = (this.aiState === 'CHASE' || this.aiState === 'PATROL')
      ? Math.round(Math.sin(this.bobPhase * 2) * 1.5)
      : Math.round(Math.sin(this.bobPhase) * 1);

    ctx.save();
    ctx.translate(0, bob);

    // 2. Sprite 2D Cel-Shaded horneado con borde de tinta por Arquetipo
    const atlasArchetype = this.archetype;
    const celSprite = CelSpriteAtlas.getEnemySprite(atlasArchetype, this.elementalAffinity, this.hurtTimer > 0);
    if (celSprite) {
      // Voltear horizontalmente si es un Sabueso mirando a la izquierda para dar dinamismo
      if (atlasArchetype === 'hound' && this.aimDir.x < -0.15) {
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
    if (this.archetype === 'tank' && this.hasWoodenShield) {
      // Gran Pavés de Roble Frontal (destructible con Fuego)
      const sx = Math.round(cx + this.aimDir.x * 11 - 10);
      const sy = Math.round(cy + this.aimDir.y * 8 - 7);
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#0b101d';
      ctx.lineWidth = 2;
      ctx.fillRect(sx, sy, 20, 17);
      ctx.strokeRect(sx, sy, 20, 17);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(sx + 2, sy + 2, 16, 4);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(sx + 8, sy + 7, 4, 4);
    } else if (this.archetype === 'duelist') {
      // Estoque cel-shaded apuntando hacia el jugador
      ctx.strokeStyle = '#0b101d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx + this.aimDir.x * 6, cy + this.aimDir.y * 6);
      ctx.lineTo(cx + this.aimDir.x * 23, cy + this.aimDir.y * 23);
      ctx.stroke();

      ctx.strokeStyle = this.aiState === 'TELEGRAPH' ? '#fde047' : '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + this.aimDir.x * 6, cy + this.aimDir.y * 6);
      ctx.lineTo(cx + this.aimDir.x * 23, cy + this.aimDir.y * 23);
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
      ctx.strokeRect(x + 6, y + 8, 20, 18);
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
    const barW = 28;
    const barH = 4;
    const barX = Math.round(cx - barW / 2);
    const barY = y - 6;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    const healthPct = Math.max(0, this.health / this.max_health);
    ctx.fillStyle = this.hasTag('staggered') ? '#fde047' : (healthPct > 0.4 ? '#22c55e' : '#ef4444');
    ctx.fillRect(barX, barY, Math.round(barW * healthPct), barH);
  }
}
