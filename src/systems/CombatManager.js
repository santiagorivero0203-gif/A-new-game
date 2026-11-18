/**
 * @module CombatManager
 * @description Orquestador central de combate "Push-Forward", sistema defensivo "Risk/Reward"
 * y medidor rítmico de Estilo AAA (Rangos D -> C -> B -> A -> S).
 *
 * Arquitectura v3.1:
 * - Fluidez 60/120 FPS sin tirones: HitStop reservado exclusivamente para eventos de alto impacto
 *   (Parry Perfecto, Finisher 3er golpe, Riposte Crítico, Sinergia Explosiva y Daño al jugador).
 * - Economía anti-farming: el Parry Perfecto otorga +1 Esencia como máximo 1 vez por enemigo.
 * - Integración completa con los 18 talentos del Árbol de Habilidades (`aegis_counter`, `mirror_ricochet`,
 *   `blade_tempo`, `elemental_synergy`, `thorn_leech`, `phantom_step`, `energy_regen`, etc.) y `weapons.js`.
 *
 * @author Be a Legend Team
 * @version 3.1.0
 */
export class CombatManager {
  /**
   * @param {import('./EquipmentManager.js').EquipmentManager} equipmentManager
   */
  constructor(equipmentManager = null) {
    this.equipmentManager = equipmentManager;

    /** @type {number} Momentum ofensivo acumulado (0 a 100) */
    this.momentum = 0;

    /** @type {number} Contador de golpes y parries consecutivos de la racha actual */
    this.comboCount = 0;

    /** @type {number} Tiempo restante antes de que expire la racha de combo */
    this.comboTimer = 0;

    /** @type {number} Duración máxima de la ventana de mantenimiento de combo en segundos */
    this.COMBO_DURATION = 4.2;

    /** @type {number} Puntuación de estilo rítmico (0 a 100 -> Rangos D, C, B, A, S) */
    this.styleScore = 0;

    /** @type {string} Firma de la última técnica usada para premiar variedad de arsenal */
    this.lastActionSignature = '';

    /** @type {number} Tiempo sin conectar golpes en segundos */
    this.inactivityTimer = 0;
    this.INACTIVITY_THRESHOLD = 3.0;
    this.MOMENTUM_DECAY_RATE = 22;

    /** @type {Array<Object>} Ataques, barridos y proyectiles activos en el mundo */
    this.activeAttacks = [];
    /** @type {Object|null} Sistema de proyectiles desacoplado (opcional, Zero-GC) */
    this.projectileSystem = null;

    /** @type {number} Máximo de atacantes cuerpo a cuerpo simultáneos coordinados por IA */
    this.maxMeleeTokens = 2;
    /** @type {Set<Object>} Enemigos sosteniendo actualmente un token de ataque */
    this._activeTokenHolders = new Set();

    /** @private Objeto reutilizable Zero-GC para `active_threat` en HUD */
    this._activeThreatCache = { name: '', health: 0, maxHealth: 100, hasShield: false, element: 'plantas' };
    /** @private Buffer reutilizable Zero-GC para consultas a SpatialGrid de ataques */
    this._attackQueryBuf = [];
    this._lastSyncedComboCount = -1;
    this._lastSyncedComboRank = '';
    this._lastSyncedTimerPct = -1;
    this._lastSyncedStyleScore = -1;
  }

  /**
   * Obtiene la letra del Rango de Estilo actual según `styleScore`.
   * @returns {'D'|'C'|'B'|'A'|'S'}
   */
  getStyleRank() {
    if (this.styleScore >= 85) return 'S';
    if (this.styleScore >= 65) return 'A';
    if (this.styleScore >= 40) return 'B';
    if (this.styleScore >= 20) return 'C';
    return 'D';
  }

  /**
   * Retorna el multiplicador dinámico de daño otorgado por el Rango de Estilo actual.
   * @returns {number}
   */
  getStyleDamageMultiplier() {
    const rank = this.getStyleRank();
    switch (rank) {
      case 'S': return 1.35;
      case 'A': return 1.20;
      case 'B': return 1.10;
      case 'C': return 1.05;
      default:  return 1.00;
    }
  }

  /**
   * Registra una acción ofensiva o defensiva exitosa en el medidor rítmico de combo.
   * Premia alternar entre espada, distintos elementos y parries, más bonos de `blade_tempo`.
   * @param {string} signature - Identificador de técnica
   * @param {number} basePoints - Puntos base de estilo
   * @param {Object} context
   * @param {boolean} [isPerfectTempo=false]
   */
  registerComboAction(signature, basePoints, context, isPerfectTempo = false) {
    this.comboCount += 1;
    this.comboTimer = this.COMBO_DURATION;
    this.inactivityTimer = 0;

    const isVaried = signature !== this.lastActionSignature;
    this.lastActionSignature = signature;

    const hasBladeTempo = !!(context && context.skillTreeManager && context.skillTreeManager.hasSkill('blade_tempo'));
    const tempoStyleMult = (isPerfectTempo && hasBladeTempo) ? 1.30 : 1.0;

    const gain = (isVaried ? basePoints * 1.35 : basePoints * 0.75) * tempoStyleMult;
    this.styleScore = Math.min(100, this.styleScore + gain);
    this.addMomentum(gain * 0.9);

    this._syncComboState(context);
  }

  /**
   * Reinicia la racha de combo al recibir daño directo o agotarse el tiempo.
   * @param {Object} context
   */
  resetCombo(context) {
    this.comboCount = 0;
    this.comboTimer = 0;
    this.styleScore = Math.floor(this.styleScore * 0.3);
    this.lastActionSignature = '';
    this._syncComboState(context);
  }

  /**
   * Sincroniza los indicadores de combo y estilo con StateManager para el HUD.
   * @private
   */
  _syncComboState(context) {
    if (!context || !context.state || typeof context.state.set !== 'function') return;
    const rank = this.getStyleRank();
    const timerPct = this.COMBO_DURATION > 0 ? (this.comboTimer / this.COMBO_DURATION) * 100 : 0;

    if (this._lastSyncedComboCount !== this.comboCount) {
      this._lastSyncedComboCount = this.comboCount;
      context.state.set('combo_count', this.comboCount);
    }
    if (this._lastSyncedComboRank !== rank) {
      this._lastSyncedComboRank = rank;
      context.state.set('combo_rank', rank);
    }
    if (Math.abs(timerPct - this._lastSyncedTimerPct) > 0.5 || (timerPct === 0 && this._lastSyncedTimerPct !== 0)) {
      this._lastSyncedTimerPct = timerPct;
      context.state.set('combo_timer_pct', timerPct);
    }
    if (Math.abs(this.styleScore - this._lastSyncedStyleScore) > 0.25 || (this.styleScore === 0 && this._lastSyncedStyleScore !== 0)) {
      this._lastSyncedStyleScore = this.styleScore;
      context.state.set('style_score', this.styleScore);
    }
  }

  /**
   * Remueve un ataque en O(1) mediante swap-and-pop para no desplazar memoria en cada proyectil.
   * @private
   * @param {number} index
   */
  _removeAttackAt(index) {
    const lastIdx = this.activeAttacks.length - 1;
    if (index < 0 || index > lastIdx) return;
    if (index !== lastIdx) {
      this.activeAttacks[index] = this.activeAttacks[lastIdx];
    }
    this.activeAttacks.pop();
  }

  /**
   * Ciclo principal de actualización de ataques activos, postura y decaimiento de combo.
   * @param {Object} context
   */
  update(context) {
    const dt = context.deltaTime || 0;
    const player = context.player || (context.state && typeof context.state.get === 'function' ? context.state.get('player') : null);
    // Iterar solo entidades dinámicas/props destructibles omitiendo árboles, casas y barreras
    const entities = context.entityManager
      ? (context.entityManager._dynamicEntities || context.entityManager.entities)
      : [];

    // 1. Regeneración pasiva de postura fuera de guardia
    if (player && player.fsmState !== 'STATE_DEFEND' && player.fsmState !== 'STATE_GUARD_BREAK') {
      player.guard_meter = Math.min(player.max_guard || 100, player.guard_meter + (18 * dt));
    }

    if (context.state && typeof context.state.set === 'function' && player) {
      context.state.set('player_posture', player.guard_meter);
    }

    // 1.5 Sincronizar objetivo de combate activo para la Barra Dinámica Stretch del HUD
    if (this.trackedTargetTimer > 0) {
      this.trackedTargetTimer -= dt;
      if (this.trackedTarget && this.trackedTarget.isDead && this.trackedTargetTimer > 0.65) {
        this.trackedTargetTimer = 0.65;
      }
      if (this.trackedTargetTimer <= 0 || !this.trackedTarget) {
        this.trackedTarget = null;
        if (context.state && typeof context.state.set === 'function') {
          context.state.set('active_threat', null);
        }
      } else if (context.state && typeof context.state.set === 'function') {
        const tc = this._activeThreatCache;
        tc.name = this.trackedTarget.name || 'Guardián Corrupto';
        tc.health = Math.max(0, this.trackedTarget.health || 0);
        tc.maxHealth = this.trackedTarget.max_health || 100;
        tc.hasShield = !!(this.trackedTarget.hasWoodenShield || this.trackedTarget.hasTag('wooden_shield'));
        tc.element = this.trackedTarget.elementalAffinity || 'plantas';
        context.state.set('active_threat', tc);
      }
    }

    // 2. Gestión temporal del Combo Rítmico y Momentum
    if (this.comboCount > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboTimer = 0;
        this.lastActionSignature = '';
      }
      this._syncComboState(context);
    } else if (this.styleScore > 0) {
      this.styleScore = Math.max(0, this.styleScore - 16 * dt);
      this._syncComboState(context);
    }

    this.inactivityTimer += dt;
    if (this.inactivityTimer >= this.INACTIVITY_THRESHOLD) {
      this.momentum = Math.max(0, this.momentum - (this.MOMENTUM_DECAY_RATE * dt));
    }

    // 3. Actualizar ataques activos y evaluar colisiones AABB
    for (let i = this.activeAttacks.length - 1; i >= 0; i--) {
      const attack = this.activeAttacks[i];
      attack.duration -= dt;

      if (attack.duration <= 0) {
        this._removeAttackAt(i);
        if (typeof attack.onExpire === 'function') {
          attack.onExpire(context);
        }
        continue;
      }

      // Evaluar la caja de colisión inicial en el primer frame antes de avanzar el proyectil (evita tunneling)
      if (attack.update && attack._hasCheckedFirstFrame) {
        attack.update(dt);
      }

      if (attack.hitbox && (entities || (context.entityManager && (typeof context.entityManager.queryNearby === 'function' || context.entityManager.spatialGrid)))) {
        const attHit = attack.hitbox;
        const candidates = (context.entityManager && typeof context.entityManager.queryNearby === 'function')
          ? context.entityManager.queryNearby(
              attHit.x - 16, attHit.y - 16,
              attHit.x + attHit.width + 16, attHit.y + attHit.height + 16,
              this._attackQueryBuf
            )
          : (context.entityManager && context.entityManager.spatialGrid)
            ? context.entityManager.spatialGrid.queryBounds(
                attHit.x - 16, attHit.y - 16,
                attHit.x + attHit.width + 16, attHit.y + attHit.height + 16,
                this._attackQueryBuf
              )
            : entities;
        const entLen = candidates.length;
        for (let eIdx = 0; eIdx < entLen; eIdx++) {
          const entity = candidates[eIdx];
          if (!entity || entity.isDead) continue;
          if (entity === attack.owner) continue;
          if (entity.hasTag('player') && attack.owner && attack.owner.hasTag('player')) continue;
          if (entity.hasTag('player') && attack.isFriendlySynergy) continue;
          const isDestructibleProp = entity.hasTag('destructible_prop');
          if (!entity.hasTag('npc') && !entity.hasTag('enemy') && !entity.hasTag('player') && !isDestructibleProp) continue;
          if (entity.hasTag('enemy') && attack.owner && attack.owner.hasTag('enemy')) continue;
          if (isDestructibleProp && attack.owner && attack.owner.hasTag('enemy')) continue;
          if (entity.hasTag('npc')) continue;

          const entHit = entity.getHitbox();

          if (attHit.x < entHit.x + entHit.width &&
              attHit.x + attHit.width > entHit.x &&
              attHit.y < entHit.y + entHit.height &&
              attHit.y + attHit.height > entHit.y) {

            if (isDestructibleProp) {
              if (attack.hitEntities && attack.hitEntities.has(entity)) continue;
              if (attack.hitEntities) attack.hitEntities.add(entity);
              if (typeof entity.takeEnvironmentalHit === 'function') {
                entity.takeEnvironmentalHit(attack.damage || 16, attack, context);
              }
              if (attack.destroyOnHit) {
                this._removeAttackAt(i);
                break;
              }
              continue;
            }

            this.handleHit(attack, entity, context);

            // Si el proyectil fue reflejado por Parry en este mismo frame, NO destruirlo
            if (attack.destroyOnHit && !attack._justReflected) {
              this._removeAttackAt(i);
              break;
            }
            attack._justReflected = false;
          }
        }
      }
      attack._hasCheckedFirstFrame = true;
    }
  }

  /**
   * Evalúa cobertura defensiva hemisférica de 180° respecto al origen del impacto.
   * @param {Object} entity
   * @param {number} attackX
   * @param {number} attackY
   * @returns {boolean}
   */
  _isFacingAttacker(entity, attackX, attackY) {
    const entCenterX = entity.pos.x + entity.width / 2;
    const entCenterY = entity.pos.y + entity.height / 2;
    const dx = attackX - entCenterX;
    const dy = attackY - entCenterY;

    if (entity.aimDir && (entity.aimDir.x !== 0 || entity.aimDir.y !== 0)) {
      const len = Math.hypot(dx, dy) || 1;
      const dot = (dx / len) * entity.aimDir.x + (dy / len) * entity.aimDir.y;
      return dot >= -0.15;
    }

    if (!entity.facing) return false;
    switch (entity.facing) {
      case 'up':    return dy <= 4;
      case 'down':  return dy >= -4;
      case 'left':  return dx <= 4;
      case 'right': return dx >= -4;
      default:      return false;
    }
  }

  /**
   * Aplica retroceso físico respetando sólidos del mundo mediante PhysicsSystem.
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
   * Procesa de forma simétrica el impacto de un ataque sobre cualquier entidad combatiente.
   * @param {Object} attack
   * @param {import('../entities/Entity.js').Entity} entity
   * @param {Object} context
   */
  handleHit(attack, entity, context) {
    if (attack.hitEntities && attack.hitEntities.has(entity)) return;
    if (attack.hitEntities) attack.hitEntities.add(entity);

    const skillTree = context ? context.skillTreeManager : null;
    const isPlayer = entity.hasTag('player');
    const attackCenter = {
      x: attack.hitbox.x + attack.hitbox.width / 2,
      y: attack.hitbox.y + attack.hitbox.height / 2
    };

    let sourceX, sourceY;
    if (attack.isProjectile && (attack.dx !== undefined || attack.dy !== undefined)) {
      sourceX = (entity.pos.x + entity.width / 2) - (attack.dx || 0) * 32;
      sourceY = (entity.pos.y + entity.height / 2) - (attack.dy || 0) * 32;
    } else if (attack.owner && !attack.isProjectile) {
      sourceX = attack.owner.pos.x + attack.owner.width / 2;
      sourceY = attack.owner.pos.y + attack.owner.height / 2;
    } else {
      sourceX = attackCenter.x;
      sourceY = attackCenter.y;
    }
    const physics = context ? (context.physics || null) : null;

    // =========================================================================
    // 1. IMPACTO CONTRA EL JUGADOR (Defensa, Parry Perfecto o Daño Directo)
    // =========================================================================
    if (isPlayer) {
      if (entity.fsmState === 'STATE_DEFEND') {
        const facingAttacker = this._isFacingAttacker(entity, sourceX, sourceY);

        if (facingAttacker) {
          const parryRank = skillTree ? skillTree.getSkillRank('parry_window') : 0;
          const aegisCounterRank = skillTree ? skillTree.getSkillRank('aegis_counter') : 0;
          const mirrorRank = skillTree ? skillTree.getSkillRank('mirror_ricochet') : 0;
          const hasMirrorRicochet = mirrorRank >= 1;
          const hasBastionImmortal = !!(skillTree && skillTree.hasSkill('bastion_immortal'));
          const hasParryUpgrade = parryRank >= 1;
          const parryWindow = 0.16 + parryRank * 0.04;
          const isParry = entity.stateTimer <= parryWindow;

          if (isParry) {
            // --- PARRY PERFECTO AAA ---
            if (context && context.engine) context.engine.hitStop(0.065);
            if (context && context.audioManager) context.audioManager.playParry();
            if (context && context.camera) context.camera.shake(0.36, 0.18);

            if (context && context.vfxRenderer) {
              context.vfxRenderer.spawnImpact('parry_spark', attackCenter.x, attackCenter.y, { radius: 34, duration: 0.36 });
            }
            if (context && context.uiManager && context.camera) {
              context.uiManager.spawnDamageNumber(entity.pos.x + 16, entity.pos.y - 8, '¡PARRY!', '#facc15');
            }

            // Recompensar postura, energía y estilo (`bastion_immortal` otorga inmunidad breve + postura extra)
            const postureBonus = hasBastionImmortal ? 53 : 25;
            entity.guard_meter = Math.min(entity.max_guard || 100, entity.guard_meter + postureBonus);
            const energyGain = 14 + parryRank * 5;
            entity.energy = Math.min(entity.max_energy || 100, entity.energy + energyGain);
            entity.parryCooldown = 0;
            if (hasBastionImmortal) {
              entity.applyEffect('iframe', 0.35);
            }

            // Economía anti-farming: otorgar +1 Esencia únicamente la primera vez que se desvía a cada enemigo
            if (skillTree && attack.owner && !attack.owner._parryEssenceGranted) {
              attack.owner._parryEssenceGranted = true;
              skillTree.addEssence(1);
            }

            this.registerComboAction('parry_perfect', hasParryUpgrade ? 28 : 22, context);

            // Talento `aegis_counter` (Estallido de Égida) escalado por rango
            if (aegisCounterRank >= 1) {
              const px = entity.pos.x + entity.width / 2;
              const py = entity.pos.y + entity.height / 2;
              const burstRadius = 60 + aegisCounterRank * 14;
              if (context && context.vfxRenderer) {
                context.vfxRenderer.spawnImpact('aegis_nova', px, py, { radius: burstRadius, duration: 0.38 });
              }
              this.addAttack({
                owner: entity,
                isFriendlySynergy: true,
                type: 'synergy',
                element: 'physical',
                damage: 24 + aegisCounterRank * 12,
                duration: 0.16,
                isSweep: true,
                originX: px,
                originY: py,
                knockbackForce: 38,
                applyEffect: { tag: 'armor_break', duration: 3.0 },
                hitEntities: new Set(),
                hitbox: {
                  x: px - burstRadius,
                  y: py - burstRadius,
                  width: 136,
                  height: 136
                }
              });
            }

            // Aturdir al agresor cuerpo a cuerpo
            if (attack.owner && attack.owner.hasTag('enemy') && !attack.isProjectile) {
              attack.owner.applyEffect('staggered', 3.2);
              this._applyKnockback(attack.owner, entity.pos.x + 16, entity.pos.y + 16, 28, physics);
              if (context && context.uiManager && context.camera) {
                context.uiManager.spawnDamageNumber(attack.owner.pos.x + 15, attack.owner.pos.y - 6, '¡ATURDIDO!', '#fde047');
              }
            }

            // Parry Deportivo a Proyectiles (+ división en 3 Cometas Dorados si posee `mirror_ricochet`)
            if (attack.isProjectile || attack.type === 'projectile') {
              const originalShooter = attack.owner;
              attack.owner = entity;
              attack.isReflected = true;
              attack._justReflected = true;
              if (attack.hitEntities) attack.hitEntities.clear();

              if (originalShooter && !originalShooter.isDead) {
                const tx = (originalShooter.pos.x + originalShooter.width / 2) - attackCenter.x;
                const ty = (originalShooter.pos.y + originalShooter.height / 2) - attackCenter.y;
                const dist = Math.hypot(tx, ty) || 1;
                attack.dx = tx / dist;
                attack.dy = ty / dist;
              } else if (attack.dx !== undefined && attack.dy !== undefined) {
                attack.dx = -attack.dx;
                attack.dy = -attack.dy;
              }

              const reflectedSpeed = (attack.speed || 230) * 1.85;
              const reflectedDamage = Math.round((attack.damage || 24) * 2.6);
              attack.speed = reflectedSpeed;
              attack.damage = reflectedDamage;
              attack.applyEffect = { tag: 'staggered', duration: 3.0 };
              attack.duration = 1.6;

              // Talento `mirror_ricochet`: bifurca 2 cometas laterales extra a ±18°
              if (hasMirrorRicochet) {
                const projSys = (context && context.projectileSystem) || this.projectileSystem;
                const baseAng = Math.atan2(attack.dy || 0, attack.dx || 1);
                const splitOffsets = [-0.31, 0.31];
                for (let s = 0; s < splitOffsets.length; s++) {
                  const sAng = baseAng + splitOffsets[s];
                  const sdx = Math.cos(sAng);
                  const sdy = Math.sin(sAng);
                  const sx = attackCenter.x;
                  const sy = attackCenter.y;
                  const cometDmg = Math.round(reflectedDamage * 0.72);
                  const cometSpeed = reflectedSpeed * 0.95;

                  if (projSys && typeof projSys.spawn === 'function') {
                    projSys.spawn({
                      owner: entity,
                      type: 'projectile',
                      isReflected: true,
                      isFriendly: true,
                      spriteKey: 'reflected_gold',
                      element: attack.element || 'kinetic',
                      damage: cometDmg,
                      duration: 1.35,
                      x: sx,
                      y: sy,
                      dx: sdx,
                      dy: sdy,
                      speed: cometSpeed,
                      radius: 8,
                      altitude: 'high',
                      destroyOnHit: true,
                      applyEffect: { tag: 'staggered', duration: 2.0 }
                    });
                  } else {
                    this.addAttack({
                      owner: entity,
                      type: 'projectile',
                      isProjectile: true,
                      isReflected: true,
                      element: attack.element || 'kinetic',
                      damage: cometDmg,
                      duration: 1.35,
                      x: sx,
                      y: sy,
                      dx: sdx,
                      dy: sdy,
                      speed: cometSpeed,
                      destroyOnHit: true,
                      applyEffect: { tag: 'staggered', duration: 2.0 },
                      hitEntities: new Set(),
                      hitbox: { x: sx - 8, y: sy - 8, width: 16, height: 16 },
                      update: function(dt) {
                        this.x += this.dx * this.speed * dt;
                        this.y += this.dy * this.speed * dt;
                        this.hitbox.x = this.x - 8;
                        this.hitbox.y = this.y - 8;
                      }
                    });
                  }
                }
              }
              return;
            }

            return;
          } else {
            // --- BLOQUEO ESTÁNDAR (Drenaje de Postura) ---
            let drainRate = 1.0;
            let elementalMultiplier = 1.0;
            if (this.equipmentManager) {
              const shield = this.equipmentManager.getShield();
              if (shield) {
                drainRate = shield.posture_drain_rate || 1.0;
                if (shield.elemental_weakness && attack.element === shield.elemental_weakness) {
                  elementalMultiplier = 2.5;
                }
              }
            }

            const ironRank = skillTree ? skillTree.getSkillRank('iron_posture') : 0;
            const ironMult = Math.max(0.55, 1.0 - ironRank * 0.13);
            const postureDamage = (attack.postureDamage || attack.damage || 22) * drainRate * elementalMultiplier * ironMult;
            entity.guard_meter -= postureDamage;

            const siphonRank = skillTree ? skillTree.getSkillRank('siphon_guard') : 0;
            if (siphonRank >= 1) {
              const siphonEnergy = siphonRank === 1 ? 8 : 14;
              entity.energy = Math.min(entity.max_energy || 100, entity.energy + siphonEnergy);
            }

            if (context && context.audioManager) context.audioManager.playGuardBlock();
            if (context && context.vfxRenderer) {
              context.vfxRenderer.spawnImpact('shield_clash', attackCenter.x, attackCenter.y, { radius: 20, duration: 0.22 });
            }
            this._applyKnockback(entity, sourceX, sourceY, 10, physics);

            if (entity.guard_meter <= 0) {
              entity.guard_meter = 0;
              entity.fsmState = 'STATE_GUARD_BREAK';
              entity.stateTimer = 1.8;
              if (context && context.audioManager) context.audioManager.playGuardBreak();
              if (context && context.camera) context.camera.shake(0.45, 0.22);
              if (context && context.uiManager && context.camera) {
                context.uiManager.spawnDamageNumber(entity.pos.x + 16, entity.pos.y - 8, '¡GUARDIA ROTA!', '#ef4444');
              }
              this._applyKnockback(entity, sourceX, sourceY, 20, physics);
            }
            return;
          }
        }
      }

      // --- IMPACTO NO BLOQUEADO SOBRE EL JUGADOR ---
      if (typeof entity.takeDamage === 'function') {
        entity.takeDamage(attack.damage || 1, attack, context);
      }
      return;
    }

    // =========================================================================
    // 2. MECÁNICA DE ESCUDO DE MADERA (Centinela Pavés / Tanque de Postura)
    // =========================================================================
    if (entity.hasTag('wooden_shield') || entity.hasWoodenShield) {
      if (attack.element === 'fuego') {
        if (typeof entity.burnWoodenShield === 'function') {
          entity.burnWoodenShield(context);
        } else {
          entity.hasWoodenShield = false;
          entity.tags = entity.tags.filter(t => t !== 'wooden_shield');
          entity.activeEffects.delete('wooden_shield');
        }
        if (context && context.engine) context.engine.hitStop(0.05);
        if (context && context.audioManager) context.audioManager.playExplosion();
        if (context && context.vfxRenderer) {
          context.vfxRenderer.spawnImpact('wood_explosion', entity.pos.x + 16, entity.pos.y + 16, { radius: 44, duration: 0.45 });
        }
        if (context && context.uiManager && context.camera) {
          context.uiManager.spawnDamageNumber(entity.pos.x + 16, entity.pos.y - 10, '¡ESCUDO QUEMADO!', '#fb923c');
        }
        this.triggerWoodExplosion(entity, context, attack.owner);
      } else if (attack.element === 'physical' && !attack.isFinisher && !attack.isReflected) {
        if (this._isFacingAttacker(entity, sourceX, sourceY)) {
          if (context && context.audioManager) context.audioManager.playHitImpact('shield_bounce', 'wood');
          if (context && context.vfxRenderer) {
            context.vfxRenderer.spawnImpact('shield_clash', attackCenter.x, attackCenter.y, { radius: 22, duration: 0.22 });
          }
          if (context && context.uiManager && context.camera) {
            context.uiManager.spawnDamageNumber(entity.pos.x + 16, entity.pos.y - 6, 'BLOQUEADO (USA FUEGO)', '#94a3b8');
          }
          if (attack.owner && attack.owner.hasTag('player')) {
            // Otorgar +8 energía al chocar y liberar el FSM para permitir conjuro de Fuego inmediato
            attack.owner.energy = Math.min(attack.owner.max_energy || 100, (attack.owner.energy || 0) + 8);
            attack.owner.attackTimer = 0;
            attack.owner.stateTimer = 0;
            attack.owner.swordCooldown = 0;
            attack.owner.fsmState = 'STATE_IDLE';
            this._applyKnockback(attack.owner, entity.pos.x + 16, entity.pos.y + 16, 16, physics);
            if (context && context.camera) context.camera.shake(0.18, 0.10);
          }
          return;
        }
      }
    }

    // =========================================================================
    // 3. RESOLUCIÓN OFENSIVA DEL JUGADOR Y SINERGIAS ELEMENTALES
    // =========================================================================
    const isPlayerAttack = (attack.owner && attack.owner.hasTag('player')) || attack.isFriendlySynergy;
    if (isPlayerAttack) {
      let finalDamage = attack.damage || 12;
      let hitSoundType = attack.isFinisher ? 'finisher' : 'normal';

      if (!attack.isMagmaZone) {
        const sig = attack.isReflected
          ? 'reflected_orb'
          : `${attack.element}_${attack.comboStep || attack.type}`;
        this.registerComboAction(sig, attack.isFinisher ? 14 : 9, context, !!attack.isPerfectTempo);
      }

      // Recarga activa de Energía Elemental al golpear con espada física (conectado a `weapon.energyOnHit`)
      if (attack.element === 'physical' && attack.owner && attack.owner.hasTag('player') && !attack.isFriendlySynergy) {
        const weapon = this.equipmentManager && this.equipmentManager.getWeapon ? this.equipmentManager.getWeapon() : null;
        const weaponEnergy = (weapon && typeof weapon.energyOnHit === 'number') ? weapon.energyOnHit : 6;
        const hasFlow = !!(skillTree && skillTree.hasSkill('energy_regen'));
        const tempoRank = skillTree ? skillTree.getSkillRank('blade_tempo') : 0;
        const finisherBonus = attack.isFinisher ? 5 : 0;
        const styleExtra = this.styleScore >= 65 ? 2 : 0;
        const totalEnergyGain = weaponEnergy + finisherBonus + tempoRank + (hasFlow ? 3 : 0) + styleExtra;
        attack.owner.energy = Math.min(attack.owner.max_energy, attack.owner.energy + totalEnergyGain);

        // FLUIDEZ 60/120 FPS: HitStop reservado SOLO para el 3er golpe (Finisher), jamás en golpes débiles 1 y 2
        if (context && context.engine && attack.isFinisher && !attack.isBladeWave) {
          context.engine.hitStop(0.055);
        }
      }

      // Drenaje de energía por `thorn_leech` (Espinas Sifón)
      if (attack.energyLeechedPerHit && attack.owner && attack.owner.hasTag('player')) {
        attack.owner.energy = Math.min(attack.owner.max_energy, attack.owner.energy + attack.energyLeechedPerHit);
      }

      // Reembolso energético de `phantom_step` (Asalto Fantasma) al atravesar enemigos con Dash
      if (attack.energyRefundOnFirstHit && !attack._refunded && attack.owner && attack.owner.hasTag('player')) {
        attack._refunded = true;
        attack.owner.energy = Math.min(attack.owner.max_energy, attack.owner.energy + attack.energyRefundOnFirstHit);
        if (context && context.vfxRenderer) {
          context.vfxRenderer.spawnImpact('plasma_pulse', entity.pos.x + 16, entity.pos.y + 16, { radius: 28, duration: 0.25 });
        }
      }

      // Multiplicador por Armadura Rota (+40% daño extra de toda fuente)
      if (entity.hasTag('armor_break')) {
        finalDamage *= 1.4;
      }

      // Saturación Rúnica (`arcane_overload`): +22%/+38% daño elemental con >= 75% Energía
      if (
        skillTree &&
        attack.element !== 'physical' &&
        attack.element !== 'explosion' &&
        !attack.isFriendlySynergy &&
        attack.owner &&
        attack.owner.max_energy > 0 &&
        (attack.owner.energy / attack.owner.max_energy) >= 0.75
      ) {
        const overloadRank = skillTree.getSkillRank('arcane_overload');
        if (overloadRank >= 1) {
          finalDamage *= (overloadRank === 1 ? 1.22 : 1.38);
        }
      }

      // Filo del Verdugo (`executioner_edge`): +45% daño contra enemigos bajo el 35% de vida
      if (
        skillTree &&
        skillTree.hasSkill('executioner_edge') &&
        entity.max_health > 0 &&
        entity.health > 0 &&
        (entity.health / entity.max_health) <= 0.35
      ) {
        finalDamage *= 1.45;
      }

      // Floración Primordial (`ancient_bloom`): golpes de Planta sobre 2+ enemigos restauran +18 Postura
      if (
        skillTree &&
        attack.element === 'plantas' &&
        skillTree.hasSkill('ancient_bloom') &&
        attack.owner &&
        attack.hitEntities &&
        attack.hitEntities.size === 2
      ) {
        attack.owner.guard_meter = Math.min(attack.owner.max_guard || 100, (attack.owner.guard_meter || 0) + 18);
      }

      // Multiplicador Crítico de Riposte sobre enemigos Aturdidos (x3.0 -> x3.8 R1 / x4.4 R2 con `mirror_ricochet`)
      let isCriticalRiposte = false;
      if (entity.hasTag('staggered') && !attack.isMagmaZone) {
        const mirrorRank = skillTree ? skillTree.getSkillRank('mirror_ricochet') : 0;
        const riposteMult = mirrorRank >= 2 ? 4.4 : (mirrorRank === 1 ? 3.8 : 3.0);
        finalDamage *= riposteMult;
        isCriticalRiposte = true;
        hitSoundType = 'critical';
        if (context && context.engine) context.engine.hitStop(0.065);
        if (context && context.camera) context.camera.shake(0.44, 0.20);
        entity.activeEffects.delete('staggered');

        // Represalia Sísmica (`punishing_rebound`): onda de desequilibrio tras Riposte
        const reboundRank = skillTree ? skillTree.getSkillRank('punishing_rebound') : 0;
        if (reboundRank >= 1) {
          const rx = entity.pos.x + entity.width / 2;
          const ry = entity.pos.y + entity.height / 2;
          const rPad = 76 + reboundRank * 34;
          if (context && context.vfxRenderer) {
            context.vfxRenderer.spawnImpact('aegis_nova', rx, ry, { radius: rPad, duration: 0.3 });
          }
          this.addAttack({
            owner: attack.owner,
            isFriendlySynergy: true,
            type: 'synergy',
            element: 'physical',
            damage: 16,
            duration: 0.14,
            applyEffect: { tag: 'staggered', duration: 1.4 },
            hitEntities: new Set(),
            hitbox: { x: rx - rPad, y: ry - rPad, width: rPad * 2, height: rPad * 2 }
          });
        }
      }

      // Triángulo de Efectividad Elemental (x2.0 Súper Efectivo / x0.6 Resistido)
      const atkElem = attack.element;
      const defElem = entity.elementalAffinity || (
        entity.hasTag('elem_plantas') ? 'plantas'
          : entity.hasTag('elem_fuego') ? 'fuego'
            : entity.hasTag('elem_kinetic') ? 'kinetic' : null
      );

      if (defElem && atkElem !== 'physical' && atkElem !== 'explosion') {
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
          if (!isCriticalRiposte) hitSoundType = 'super_effective';
          if (context && context.vfxRenderer && !attack.isMagmaZone) {
            context.vfxRenderer.spawnImpact('parry_spark', entity.pos.x + 16, entity.pos.y + 16, { radius: 26, duration: 0.26 });
          }
        } else if (isResisted) {
          finalDamage *= 0.6;
          if (!isCriticalRiposte) hitSoundType = 'resisted';
        }
      }

      // Feedback sonoro con capas acústicas por material del objetivo
      if (context && context.audioManager && !attack.isFriendlySynergy) {
        const material = this._resolveEntityMaterial(entity);
        context.audioManager.playHitImpact(hitSoundType, material);
      }

      if (attack.isCharge) {
        const cDir = attack.chargeDir || { x: 1, y: 0 };
        const kbMult = attack.knockbackMult || 1.0;
        this._applyKnockback(entity, entity.pos.x - (cDir.x * 20), entity.pos.y - (cDir.y * 20), 26 * kbMult, physics);
        if (context && context.camera) context.camera.shake(0.22, 0.12);
      }

      if (attack.isSweep) {
        const originX = attack.originX || sourceX;
        const originY = attack.originY || sourceY;
        const force = attack.knockbackForce || 28;
        this._applyKnockback(entity, originX, originY, force, physics);
        if (context && context.camera && !attack.isFriendlySynergy) {
          context.camera.shake(attack.isFinisher ? 0.34 : 0.14, attack.isFinisher ? 0.16 : 0.09);
        }
        if (context && context.vfxRenderer && !attack.isFriendlySynergy) {
          context.vfxRenderer.spawnImpact('slash_hit', entity.pos.x + entity.width / 2, entity.pos.y + entity.height / 2, {
            radius: attack.isFinisher ? 28 : 20,
            duration: 0.22,
            angle: attack.aimAngle || 0,
            isFinisher: !!attack.isFinisher
          });
        }
      }

      if (typeof entity.takeDamage === 'function') {
        entity.takeDamage(Math.round(finalDamage), attack, context, isCriticalRiposte);

        // Lluvia Imparable (`relentless_flurry`): derrotar con espada física reinicia Dash y recarga Energía
        if (
          entity.isDead &&
          attack.element === 'physical' &&
          !attack.isFriendlySynergy &&
          attack.owner &&
          attack.owner.hasTag('player') &&
          skillTree
        ) {
          const flurryRank = skillTree.getSkillRank('relentless_flurry');
          if (flurryRank >= 1) {
            attack.owner.dashCooldown = 0;
            const eGain = flurryRank >= 2 ? 24 : 15;
            attack.owner.energy = Math.min(attack.owner.max_energy || 100, attack.owner.energy + eGain);
          }
        }
      }

      if (entity.hasTag('enemy')) {
        this.trackedTarget = entity;
        this.trackedTargetTimer = entity.isDead ? 0.65 : 4.2;
      }
    }

    // =========================================================================
    // 4. SINERGIAS ELEMENTALES CRUZADAS (Potenciadas por `elemental_synergy`)
    // =========================================================================
    if (attack.element === 'fuego' && entity.hasTag('inmovilizado_raices')) {
      entity.activeEffects.delete('inmovilizado_raices');
      if (context && context.engine) context.engine.hitStop(0.045);
      if (context && context.audioManager) context.audioManager.playExplosion();
      if (context && context.camera) context.camera.shake(0.50, 0.24);
      if (context && context.vfxRenderer) {
        context.vfxRenderer.spawnImpact('wood_explosion', entity.pos.x + 15, entity.pos.y + 15, { radius: 58, duration: 0.45 });
      }
      if (context && context.uiManager && context.camera) {
        context.uiManager.spawnDamageNumber(entity.pos.x + 15, entity.pos.y - 14, '¡SINERGIA EXPLOSIVA!', '#fb923c');
      }
      this.triggerWoodExplosion(entity, context, attack.owner);
    }

    if (attack.element === 'kinetic' && entity.hasTag('quemadura_ignea')) {
      entity.activeEffects.delete('quemadura_ignea');
      if (context && context.engine) context.engine.hitStop(0.045);
      if (context && context.audioManager) context.audioManager.playExplosion();
      if (context && context.vfxRenderer) {
        context.vfxRenderer.spawnImpact('fire_burst', entity.pos.x + 15, entity.pos.y + 15, { radius: 48, duration: 0.38 });
      }
      if (context && context.uiManager && context.camera) {
        context.uiManager.spawnDamageNumber(entity.pos.x + 15, entity.pos.y - 14, '¡TORBELLINO ÍGNEO!', '#38bdf8');
      }
      this.triggerFirestormSynergy(entity, context, attack.owner);
    }

    if (attack.applyEffect) {
      entity.applyEffect(attack.applyEffect.tag, attack.applyEffect.duration);
    }
    if (attack.secondaryEffect) {
      entity.applyEffect(attack.secondaryEffect.tag, attack.secondaryEffect.duration);
    }
  }

  /**
   * Detona una Explosión de Madera en área (+30% daño y mayor radio con `elemental_synergy`).
   */
  triggerWoodExplosion(entity, context, owner = null) {
    const skillTree = context ? context.skillTreeManager : null;
    const synRank = skillTree ? skillTree.getSkillRank('elemental_synergy') : 0;
    const dmg = synRank >= 2 ? 88 : (synRank === 1 ? 72 : 55);
    const pad = synRank >= 2 ? 64 : (synRank === 1 ? 52 : 42);
    const targetOwner = owner || (context ? context.player : null);

    // Protocolo Supernova (`supernova_protocol`): cada detonación recarga Energía Elemental
    if (skillTree && skillTree.hasSkill('supernova_protocol') && targetOwner && targetOwner.hasTag('player')) {
      targetOwner.energy = Math.min(targetOwner.max_energy || 100, targetOwner.energy + 12);
    }

    this.addAttack({
      owner: targetOwner,
      isFriendlySynergy: true,
      type: 'synergy',
      element: 'explosion',
      damage: dmg,
      duration: 0.18,
      isSweep: true,
      originX: entity.pos.x + entity.width / 2,
      originY: entity.pos.y + entity.height / 2,
      knockbackForce: synRank >= 1 ? 48 : 42,
      hitbox: {
        x: entity.pos.x - pad,
        y: entity.pos.y - pad,
        width: pad * 2 + entity.width,
        height: pad * 2 + entity.height
      },
      hitEntities: new Set()
    });
  }

  /**
   * Detona un Torbellino de Brasas cuando Cinético colisiona con un objetivo en llamas (+30%/+55% con `elemental_synergy`).
   */
  triggerFirestormSynergy(entity, context, owner = null) {
    const skillTree = context ? context.skillTreeManager : null;
    const synRank = skillTree ? skillTree.getSkillRank('elemental_synergy') : 0;
    const dmg = synRank >= 2 ? 64 : (synRank === 1 ? 50 : 38);
    const pad = synRank >= 2 ? 56 : (synRank === 1 ? 46 : 36);
    const targetOwner = owner || (context ? context.player : null);

    if (skillTree && skillTree.hasSkill('supernova_protocol') && targetOwner && targetOwner.hasTag('player')) {
      targetOwner.energy = Math.min(targetOwner.max_energy || 100, targetOwner.energy + 12);
    }

    this.addAttack({
      owner: targetOwner,
      isFriendlySynergy: true,
      type: 'synergy',
      element: 'fuego',
      damage: dmg,
      duration: 0.18,
      isSweep: true,
      originX: entity.pos.x + entity.width / 2,
      originY: entity.pos.y + entity.height / 2,
      knockbackForce: synRank >= 1 ? 40 : 34,
      hitbox: {
        x: entity.pos.x - pad,
        y: entity.pos.y - pad,
        width: pad * 2 + entity.width,
        height: pad * 2 + entity.height
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

  /**
   * Depura holders de tokens que murieron, fueron aturdidos o salieron de fase ofensiva.
   * @private
   */
  _pruneAttackTokens() {
    for (const holder of this._activeTokenHolders) {
      const deadOrDone =
        !holder ||
        holder.isDead ||
        (typeof holder.hasTag === 'function' && holder.hasTag('staggered')) ||
        (holder.aiState !== 'TELEGRAPH' && holder.aiState !== 'ATTACK');
      if (deadOrDone) {
        this._activeTokenHolders.delete(holder);
      }
    }
  }

  /**
   * Solicita un token táctico de ataque cuerpo a cuerpo (máximo `maxMeleeTokens = 2`).
   * Evita embudos injustos donde múltiples enemigos telegrafían a la vez.
   * @param {Object} enemy - Entidad enemiga solicitante.
   * @returns {boolean} True si obtiene permiso para iniciar `TELEGRAPH`.
   */
  requestAttackToken(enemy) {
    if (!enemy || enemy.isDead) return false;
    if (this._activeTokenHolders.has(enemy)) return true;
    this._pruneAttackTokens();
    if (this._activeTokenHolders.size < this.maxMeleeTokens) {
      this._activeTokenHolders.add(enemy);
      return true;
    }
    return false;
  }

  /**
   * Libera el token de ataque de un enemigo tras completar su ataque, aturdirse o morir.
   * @param {Object} enemy
   */
  releaseAttackToken(enemy) {
    if (enemy) {
      this._activeTokenHolders.delete(enemy);
    }
  }

  /**
   * Resetea todos los tokens de ataque y ataques activos al cambiar de Mundo.
   */
  clearAllCombatState() {
    this._activeTokenHolders.clear();
    this.activeAttacks.length = 0;
  }

  /**
   * Determina la firma acústica del objetivo según su etiqueta y arquetipo para Web Audio API.
   * @private
   * @param {Object} entity
   * @returns {'wood'|'armor'|'slime'|'stone'|'flesh'}
   */
  _resolveEntityMaterial(entity) {
    if (!entity) return 'flesh';
    if (typeof entity.hasTag === 'function') {
      if (entity.hasTag('wooden_shield') || entity.hasTag('debil_fuego')) return 'wood';
      if (entity.hasTag('pared_falsa') || entity.hasTag('prop')) return 'stone';
    }
    if (entity.archetype === 'tank') return 'armor';
    if (entity.archetype === 'slime') return 'slime';
    return 'flesh';
  }

  addAttack(attackObj) {
    if (!attackObj.hitEntities) {
      attackObj.hitEntities = new Set();
    }
    this.activeAttacks.push(attackObj);
  }

  /**
   * Remueve todos los ataques cuerpo a cuerpo activos de una entidad (al usar Dash Cancel o ser aturdida).
   * Conserva proyectiles y zonas independientes ya lanzados al mundo.
   * @param {Object} owner
   */
  cancelAttacksFrom(owner) {
    this.releaseAttackToken(owner);
    for (let i = this.activeAttacks.length - 1; i >= 0; i--) {
      const atk = this.activeAttacks[i];
      if (atk.owner === owner && !atk.isProjectile && !atk.isMagmaZone) {
        this._removeAttackAt(i);
      }
    }
  }

  canCancel(currentState, nextState) {
    if (nextState === 'STATE_DASH') return true;
    if (currentState === 'STATE_GUARD_BREAK') return false;
    return true;
  }
}
