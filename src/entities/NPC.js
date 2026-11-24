import { Entity } from './Entity.js';
import { CelSpriteAtlas } from '../render/CelSpriteAtlas.js';

/**
 * @module NPC
 * @description Entidad no jugable 2D Cel-Shaded animada con soporte de oficios RPG
 * (`blacksmith` Herrero, `alchemist` Mago de Pociones, `guard` Patrulla, `villager` Aldeano,
 * `sage` Sabio y `rescue` Rescate con Karma Invisible), rutinas ciudadanas reactivas al peligro
 * y animación multi-frame con parpadeo y accesorios vivos.
 * @author Be a Legend Team
 * @version 3.0.0
 */
export class NPC extends Entity {
  /**
   * @param {number} x - Posición X inicial
   * @param {number} y - Posición Y inicial
   * @param {string|Object} [configOrName='Sabio Tarak'] - Nombre o diccionario de configuración
   * @param {'tarak'|'valerio'|'blacksmith'|'alchemist'|'guard'|'villager'} [variant='tarak']
   */
  constructor(x, y, configOrName = 'Sabio Tarak', variant = 'tarak') {
    super(x, y, 32, 32);
    this.color = '#6366f1';
    this.tags.push('npc');
    this.tags.push('solid');
    this.interacted = false;

    if (typeof configOrName === 'object' && configOrName !== null) {
      this.role = configOrName.role || (configOrName.rescueTag ? 'rescue' : 'sage');
      this.biome = configOrName.biome || configOrName.worldId || 'cave_exit_intro';
      const defaultVar = this.role === 'blacksmith' ? 'blacksmith'
        : this.role === 'alchemist' ? 'alchemist'
          : this.role === 'guard' ? 'guard'
            : this.role === 'villager' ? 'villager'
              : (configOrName.variant || 'tarak');
      this.variant = configOrName.variant || defaultVar;
      this.name = configOrName.name || (this.variant === 'valerio' ? 'Valerio el Viajero' : 'Sabio Tarak');
      this.rescueTag = configOrName.rescueTag || null;
      this.worldId = configOrName.worldId || null;
      this.karmaEventId = configOrName.karmaEventId || (this.rescueTag ? 'valerio_m1' : null);
      this.rewardWeapon = configOrName.rewardWeapon || null;
      this.rewardShield = configOrName.rewardShield !== undefined
        ? configOrName.rewardShield
        : (this.rescueTag === 'ambush_valerio' ? 'iron_pavise' : null);
      this.rewardEssence = Number(configOrName.rewardEssence) || 12;
      this.dialogues = configOrName.dialogues || null;
      this.patrolPoints = Array.isArray(configOrName.patrolPoints) ? configOrName.patrolPoints : null;
      this.wanderRadius = Number(configOrName.wanderRadius) || (this.role === 'villager' ? 46 : this.role === 'guard' ? 76 : 0);
      this.shopTitle = configOrName.shopTitle || null;
      this.shopSubtitle = configOrName.shopSubtitle || null;
    } else {
      this.name = configOrName || 'Sabio Tarak';
      this.variant = variant || (String(this.name).toLowerCase().includes('valerio') ? 'valerio' : 'tarak');
      this.role = this.variant === 'valerio' ? 'rescue'
        : (this.variant === 'blacksmith' || this.variant === 'alchemist' || this.variant === 'guard' || this.variant === 'villager')
          ? this.variant : 'sage';
      this.biome = 'cave_exit_intro';
      this.rescueTag = this.variant === 'valerio' ? 'ambush_valerio' : null;
      this.worldId = null;
      this.karmaEventId = this.rescueTag ? 'valerio_m1' : null;
      this.rewardWeapon = null;
      this.rewardShield = this.rescueTag === 'ambush_valerio' ? 'iron_pavise' : null;
      this.rewardEssence = 12;
      this.dialogues = null;
      this.patrolPoints = null;
      this.wanderRadius = (this.role === 'villager' ? 46 : this.role === 'guard' ? 76 : 0);
      this.shopTitle = null;
      this.shopSubtitle = null;
    }

    this.initialX = x;
    this.initialY = y;
    this.playerNearby = false;
    this.isUnderThreat = false;
    this.isSpooked = false;
    this.hadAmbushers = false;
    this.rescueCompleted = false;
    this._defeatedAnyAmbusher = false;
    this.animClock = Math.random() * Math.PI * 2;
    this.facing = 'down';
    this.animFrame = 0;
    this._blinkTimer = 2.0 + Math.random() * 2.5;
    this.isBlinking = false;
    this._wanderTimer = 1.0 + Math.random() * 1.5;
    this._patrolIdx = 0;
    this._moveTarget = { x: 0, y: 0 };
    this._hasMoveTarget = false;
    this.isMoving = false;
    this._lastSparkFrame = -1;
    this._lastBadgeLabel = '';
    this._lastBadgeWidth = 52;

    // Hitbox precisa en la base de los pies (Y-Sorting perfecto con Santi)
    this.hitbox = {
      offsetX: 6,
      offsetY: 18,
      width: 20,
      height: 14
    };
    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;
  }

  /**
   * Serializa el estado narrativo/karma del NPC al descargar su chunk.
   * @returns {Object}
   */
  serializeChunkState() {
    return {
      interacted: Boolean(this.interacted),
      hadAmbushers: Boolean(this.hadAmbushers),
      defeatedAnyAmbusher: Boolean(this._defeatedAnyAmbusher),
      rescueCompleted: Boolean(this.rescueCompleted)
    };
  }

  /**
   * Restaura el estado recordado del NPC al volver a entrar en su chunk.
   * @param {Object} state
   */
  restoreChunkState(state) {
    if (!state) return;
    this.interacted = Boolean(state.interacted);
    this.hadAmbushers = Boolean(state.hadAmbushers);
    this._defeatedAnyAmbusher = Boolean(state.defeatedAnyAmbusher);
    this.rescueCompleted = Boolean(state.rescueCompleted);
    if (this.rescueCompleted) {
      this.isUnderThreat = false;
    }
  }

  /**
   * Actualización lógica contextual: cercanía de Santi, IA ciudadana viva (patrulla de guardias,
   * paseo de aldeanos, trabajo animado de herreros/alquimistas, reacción al peligro) y rescates.
   * @param {Object|number} contextOrDt
   */
  update(contextOrDt) {
    const isCtx = typeof contextOrDt === 'object' && contextOrDt !== null;
    const dt = isCtx ? (contextOrDt.deltaTime || 0.016) : (contextOrDt || 0.016);
    this.animClock += dt * 3.0;

    // Parpadeo natural orgánico
    this._blinkTimer -= dt;
    if (this.isBlinking) {
      if (this._blinkTimer <= 0) {
        this.isBlinking = false;
        this._blinkTimer = 2.6 + Math.random() * 2.2;
      }
    } else if (this._blinkTimer <= 0) {
      this.isBlinking = true;
      this._blinkTimer = 0.14;
    }

    if (!isCtx) return;

    const player = contextOrDt.player;
    const cx = this.pos.x + this.width / 2;
    const cy = this.pos.y + this.height / 2;
    if (player) {
      const px = player.pos.x + player.width / 2;
      const py = player.pos.y + player.height / 2;
      const dxp = px - cx;
      const dyp = py - cy;
      const distSq = dxp * dxp + dyp * dyp;
      this.playerNearby = distSq <= 68 * 68;
      if (this.playerNearby) {
        this.facing = Math.abs(dxp) > Math.abs(dyp)
          ? (dxp >= 0 ? 'right' : 'left')
          : (dyp >= 0 ? 'down' : 'up');
      }
    } else {
      this.playerNearby = false;
    }

    // Percepción ciudadana ante amenazas cercanas
    this.isSpooked = false;
    if ((this.role === 'villager' || this.role === 'guard') && contextOrDt.entityManager) {
      const enemies = contextOrDt.entityManager.getByTag('enemy');
      let nearestEnemy = null;
      let minESq = 128 * 128;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e || e.isDead || e.health <= 0) continue;
        const edx = (e.pos.x + e.width * 0.5) - cx;
        const edy = (e.pos.y + e.height * 0.5) - cy;
        const eSq = edx * edx + edy * edy;
        if (eSq < minESq) {
          minESq = eSq;
          nearestEnemy = e;
        }
      }
      if (nearestEnemy) {
        this.isSpooked = true;
        if (!this.playerNearby) {
          const edx = (nearestEnemy.pos.x + nearestEnemy.width * 0.5) - cx;
          const edy = (nearestEnemy.pos.y + nearestEnemy.height * 0.5) - cy;
          this.facing = Math.abs(edx) > Math.abs(edy)
            ? (edx >= 0 ? 'right' : 'left')
            : (edy >= 0 ? 'down' : 'up');
        }
      }
    }

    // Rutina viva de patrulla/paseo (Guardias & Aldeanos) evitando siempre agua/muros via PhysicsSystem
    this.isMoving = false;
    if (
      (this.role === 'guard' || this.role === 'villager') &&
      !this.playerNearby &&
      !this.isUnderThreat &&
      (this.patrolPoints || this.wanderRadius > 0)
    ) {
      this._updateCitizenMovement(dt, contextOrDt.physics || null);
    }

    // Ciclos de fotogramas de trabajo o caminata + micro-partículas de herrería / alquimia
    if (this.role === 'blacksmith' || this.role === 'alchemist') {
      const craftFrame = Math.floor(this.animClock * 0.68) % 4;
      this.animFrame = craftFrame;
      if (craftFrame !== this._lastSparkFrame) {
        this._lastSparkFrame = craftFrame;
        if (contextOrDt.vfxRenderer && player) {
          const pDistSq = (player.pos.x - this.pos.x) ** 2 + (player.pos.y - this.pos.y) ** 2;
          if (pDistSq < 320 * 320) {
            if (this.role === 'blacksmith' && craftFrame === 2) {
              for (let s = 0; s < 3; s++) {
                contextOrDt.vfxRenderer.addParticle({
                  x: this.pos.x + 28,
                  y: this.pos.y + 18,
                  vx: (Math.random() - 0.3) * 42,
                  vy: -(18 + Math.random() * 28),
                  size: 2.2,
                  life: 0.34,
                  color: s === 0 ? '#fde047' : '#fb923c'
                });
              }
            } else if (this.role === 'alchemist' && (craftFrame === 1 || craftFrame === 3)) {
              contextOrDt.vfxRenderer.addParticle({
                x: this.pos.x - 10 + (Math.random() - 0.5) * 6,
                y: this.pos.y + 15,
                vx: (Math.random() - 0.5) * 14,
                vy: -(16 + Math.random() * 18),
                size: 2.4,
                life: 0.52,
                color: this.biome === 'astral_citadel' ? '#e879f9' : '#5eead4'
              });
            }
          }
        }
      }
    } else if (this.isMoving) {
      this.animFrame = Math.floor(this.animClock * 2.2) % 4;
    } else {
      this.animFrame = (Math.floor(this.animClock * 0.5) % 2) === 0 ? 0 : 2;
    }

    // Evaluar emboscada activa sobre NPCs de rescate iterando solo la cubeta de enemigos
    if (this.rescueTag && contextOrDt.entityManager && !this.rescueCompleted) {
      const enemies = contextOrDt.entityManager.getByTag('enemy');
      let aliveCount = 0;
      let defeatedCount = 0;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e || !e.hasTag(this.rescueTag)) continue;
        if (!e.isDead && e.health > 0) {
          aliveCount++;
        } else if (e.isDead && !e._despawnedForHorde) {
          defeatedCount++;
        }
      }
      if (aliveCount > 0) {
        this.hadAmbushers = true;
      } else if (defeatedCount > 0 || (contextOrDt.chunkManager && contextOrDt.chunkManager.hasRememberedDefeatWithTag(this.rescueTag))) {
        this._defeatedAnyAmbusher = true;
      }
      this.isUnderThreat = aliveCount > 0;

      // Solo premiar el rescate moral si Santi realmente derrotó a los emboscadores (no si se limpiaron por Horda)
      if (this.hadAmbushers && aliveCount === 0 && (defeatedCount > 0 || this._defeatedAnyAmbusher)) {
        this._completeInvisibleKarmaRescue(contextOrDt.state, contextOrDt);
      }
    }
  }

  /**
   * Desplaza suavemente a guardias y aldeanos entre puntos de patrulla o radio seguro.
   * @private
   */
  _updateCitizenMovement(dt, physics) {
    if (!this._hasMoveTarget) {
      this._wanderTimer -= dt;
      if (this._wanderTimer <= 0) {
        if (this.patrolPoints && this.patrolPoints.length >= 2) {
          this._patrolIdx = (this._patrolIdx + 1) % this.patrolPoints.length;
          const pt = this.patrolPoints[this._patrolIdx];
          this._moveTarget.x = pt.x;
          this._moveTarget.y = pt.y;
          this._hasMoveTarget = true;
        } else {
          const ang = Math.random() * Math.PI * 2;
          const dist = 16 + Math.random() * Math.max(12, this.wanderRadius - 16);
          this._moveTarget.x = Math.round(this.initialX + Math.cos(ang) * dist);
          this._moveTarget.y = Math.round(this.initialY + Math.sin(ang) * dist);
          this._hasMoveTarget = true;
        }
      }
      return;
    }

    const dx = this._moveTarget.x - this.pos.x;
    const dy = this._moveTarget.y - this.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      this._hasMoveTarget = false;
      this._wanderTimer = this.role === 'guard' ? 1.4 : 2.1 + Math.random() * 1.4;
      return;
    }

    this.isMoving = true;
    const spd = this.role === 'guard' ? 32 : 24;
    const vx = (dx / dist) * spd * dt;
    const vy = (dy / dist) * spd * dt;
    this.facing = Math.abs(dx) >= Math.abs(dy)
      ? (dx >= 0 ? 'right' : 'left')
      : (dy >= 0 ? 'down' : 'up');

    const prevX = this.pos.x;
    const prevY = this.pos.y;
    if (physics && typeof physics.moveWithCollisions === 'function') {
      const safe = physics.moveWithCollisions(this, prevX + vx, prevY + vy);
      this.pos.set(safe.x, safe.y);
      if (Math.hypot(safe.x - prevX, safe.y - prevY) < 0.08) {
        this._hasMoveTarget = false;
        this._wanderTimer = 1.6;
      }
    } else {
      this.pos.set(prevX + vx, prevY + vy);
    }
  }

  /**
   * Registra de forma diegética e invisible el rescate moral de Valerio:
   * incrementa internamente `karma_level` (sin mostrar jamás "+1 Karma" en la UI) y entrega
   * una recompensa narrativa calibrada de gratitud.
   * @private
   */
  _completeInvisibleKarmaRescue(stateManager, context = null) {
    if (this.rescueCompleted) return;
    this.rescueCompleted = true;
    this.isUnderThreat = false;

    const rescueEssence = this.rewardEssence || 12;
    if (context && context.progressionManager && this.karmaEventId) {
      context.progressionManager.recordKarmaEvent(this.karmaEventId, 1, stateManager);
    } else if (stateManager) {
      const curKarma = stateManager.get('karma_level') || 0;
      stateManager.set('karma_level', curKarma + 1);
    }

    let rewardLabel = '';
    const player = (context && context.player) || (stateManager && stateManager.get ? stateManager.get('player') : null);
    let playedZeldaFanfare = false;
    if (context && context.equipmentManager) {
      if (this.rewardWeapon && context.equipmentManager.unlockWeapon(this.rewardWeapon)) {
        context.equipmentManager.equipWeapon(this.rewardWeapon);
        const wp = context.equipmentManager.getWeapon();
        const enchantColor = wp?.enchantmentColor || '#4ade80';
        if (player) {
          player.activeSwordTint = enchantColor;
          if (typeof player.triggerItemGetAnimation === 'function') {
            player.triggerItemGetAnimation({
              kind: 'enchantment',
              title: `¡${(wp?.name || 'ENCANTAMIENTO DEL ALBA').toUpperCase()}!`,
              color: enchantColor
            });
          }
        }
        if (context.audioManager && typeof context.audioManager.playZeldaItemFanfare === 'function') {
          context.audioManager.playZeldaItemFanfare('enchantment');
          playedZeldaFanfare = true;
        }
        rewardLabel = ` e imbuye tu Espada del Alba en el Arsenal [I]`;
      }
      if (this.rewardShield && context.equipmentManager.unlockShield(this.rewardShield)) {
        context.equipmentManager.equipShield(this.rewardShield);
        const sh = context.equipmentManager.getShield();
        if (player && typeof player.triggerItemGetAnimation === 'function' && !this.rewardWeapon) {
          player.triggerItemGetAnimation({
            kind: 'shield',
            title: `¡${(sh?.name || 'NUEVA ÉGIDA').toUpperCase()}!`,
            color: '#38bdf8'
          });
        }
        if (!playedZeldaFanfare && context.audioManager && typeof context.audioManager.playZeldaItemFanfare === 'function') {
          context.audioManager.playZeldaItemFanfare('shield');
          playedZeldaFanfare = true;
        }
        rewardLabel = rewardLabel ? `${rewardLabel} y nueva égida` : ` y equipa tu nueva égida en el Arsenal [I]`;
      }
    }

    if (stateManager) {
      if (this.karmaEventId === 'valerio_m1') {
        stateManager.set('valerio_rescued', true);
      }
      const customText = this.dialogues && this.dialogues.rescueComplete;
      stateManager.set('active_dialogue', {
        speaker: this.name.toUpperCase(),
        text: customText || `¡Gracias por acudir en mi auxilio! Toma estos cristales (+${rescueEssence} Esencia)${rewardLabel}.`,
        timer: 4.6
      });
    }

    if (context && context.skillTreeManager) {
      context.skillTreeManager.addEssence(rescueEssence);
    }
    if (context && context.audioManager && !playedZeldaFanfare) {
      context.audioManager.playHeal();
    }
  }

  /**
   * Asigna textura externa opcional.
   * @param {HTMLImageElement|HTMLCanvasElement} sprite
   */
  setSprite(sprite) {
    this.sprite = sprite;
  }

  /**
   * Renderizado 2D Cel-Shaded de alta limpieza con borde de tinta e insignia contextual.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);

    if (this.sprite) {
      ctx.drawImage(this.sprite, x, y, this.width, this.height);
      return;
    }

    // 1. Sombra pixel-art escalonada en el suelo (sin borrosidad ni duplicación desde Renderer)
    ctx.fillStyle = 'rgba(11, 16, 29, 0.30)';
    ctx.fillRect(x + 6, y + 28, 20, 4);
    ctx.fillRect(x + 4, y + 29, 24, 2);

    // Yunque / Caldero del taller junto al artesano
    if (this.role === 'blacksmith') {
      ctx.fillStyle = '#0b101d';
      ctx.fillRect(x + 25, y + 21, 12, 9);
      ctx.fillStyle = '#475569';
      ctx.fillRect(x + 26, y + 22, 10, 4);
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 28, y + 26, 6, 3);
      if (this.animFrame === 2) {
        ctx.fillStyle = '#fde047';
        ctx.fillRect(x + 29, y + 19, 3, 2);
      }
    } else if (this.role === 'alchemist') {
      ctx.fillStyle = '#0b101d';
      ctx.fillRect(x - 14, y + 20, 12, 10);
      ctx.fillStyle = '#334155';
      ctx.fillRect(x - 13, y + 22, 10, 7);
      ctx.fillStyle = this.biome === 'astral_citadel' ? '#e879f9' : '#2dd4bf';
      ctx.fillRect(x - 11, y + 20, 6, 3);
    }

    // Ligero temblor si está acorralado por enemigos o asustado en ciudad
    const panicOffsetX = (this.isUnderThreat || (this.isSpooked && this.role === 'villager'))
      ? Math.round(Math.sin(this.animClock * 6) * 1.2)
      : 0;
    const bobY = this.isMoving ? 0 : Math.round(Math.sin(this.animClock * 0.8) * 1);

    // 2. Sprite 2D Cel-Shaded multi-frame con orientación, bioma y parpadeo
    const npcSpr = CelSpriteAtlas.getNPCSprite(this.variant, this.animFrame, this.facing, this.biome, this.isBlinking);
    if (npcSpr) {
      ctx.drawImage(npcSpr, Math.round(x - 6 + panicOffsetX), y - 14 + bobY);
    }

    // 3. Insignia flotante contextual por rol u oficio
    if (this.isUnderThreat) {
      this._drawBadge(ctx, x + 16, y - 14, '¡AUXILIO!', '#ef4444', '#fef2f2');
    } else if (this.isSpooked && !this.playerNearby) {
      this._drawBadge(ctx, x + 16, y - 14, this.role === 'guard' ? '¡EN GUARDIA!' : '¡CUIDADO!', '#f97316', '#fff7ed');
    } else if (this.playerNearby) {
      const isTouch = typeof document !== 'undefined' && document.body.classList.contains('touch-controls-active');
      const verb = this.role === 'blacksmith' ? 'FORJAR' : this.role === 'alchemist' ? 'POCIONES' : 'HABLAR';
      const accent = this.role === 'blacksmith' ? '#fb923c' : this.role === 'alchemist' ? '#5eead4' : '#facc15';
      this._drawBadge(ctx, x + 16, y - 14, isTouch ? `USAR · ${verb}` : `[E] ${verb}`, accent, '#fef9c3');
    }
  }

  /** @private */
  _drawBadge(ctx, cx, topY, label, borderColor, textColor) {
    ctx.save();
    ctx.font = '800 9px Outfit, sans-serif';
    if (this._lastBadgeLabel !== label) {
      this._lastBadgeLabel = label;
      this._lastBadgeWidth = Math.max(52, ctx.measureText(label).width + 14);
    }
    const w = this._lastBadgeWidth;
    const bx = Math.round(cx - w / 2);
    const by = Math.round(topY - 14 + Math.sin(this.animClock * 1.8) * 2);

    ctx.fillStyle = 'rgba(11, 16, 29, 0.92)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, 16, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, by + 8.5);
    ctx.restore();
  }

  /**
   * Ejecuta diálogo contextual adaptándose al estado del nivel y al Karma Invisible acumulado.
   * @param {import('../core/StateManager.js').StateManager} stateManager
   * @param {Object} [context=null]
   * @returns {string}
   */
  interact(stateManager, context = null) {
    this.interacted = true;
    const karma = stateManager ? (stateManager.get('karma_level') || 0) : 0;

    if (this.rescueTag && this.isUnderThreat) {
      return (this.dialogues && this.dialogues.underThreat)
        || '¡Cuidado con el Esporífero! ¡Usa Guardia [Shift] justo al recibir su espora para devolvérsela!';
    }

    if (this.rescueTag && !this.rescueCompleted) {
      this._completeInvisibleKarmaRescue(stateManager, context);
    }

    // Talleres de Herrero y Mago de Pociones: abren la interfaz de oficio cuando hay contexto UI
    if ((this.role === 'blacksmith' || this.role === 'alchemist') && !this.isUnderThreat) {
      if (context && typeof context.openArtisanShop === 'function') {
        context.openArtisanShop(this);
        return '';
      }
      return (this.dialogues && this.dialogues.greeting)
        || (this.role === 'blacksmith'
          ? '¡Acerquémonos al yunque! Con Esencia Ancestral templaré tu filo y tu postura.'
          : 'Bienvenido a mi botica arcana: destilo elixires permanentes y pociones de furia.');
    }

    // Reacción de celebración si el Guardián Regional de este mundo ya cayó
    const worldCompleted = Boolean(
      this.worldId &&
      context &&
      context.progressionManager &&
      context.progressionManager.completedWorlds &&
      context.progressionManager.completedWorlds.has(this.worldId)
    );
    if (worldCompleted && this.dialogues && this.dialogues.liberated) {
      return this.dialogues.liberated;
    }

    // Diálogos declarativos definidos en el JSON del nivel con respuesta orgánica al Karma
    if (this.dialogues) {
      if (karma < 0 && this.dialogues.lowKarma) {
        return this.dialogues.lowKarma;
      }
      if (karma >= 2 && this.dialogues.highKarma) {
        return this.dialogues.highKarma;
      }
      if (Array.isArray(this.dialogues)) {
        this._tipIndex = ((this._tipIndex ?? -1) + 1) % this.dialogues.length;
        return this.dialogues[this._tipIndex];
      }
      if (Array.isArray(this.dialogues.lines) && this.dialogues.lines.length > 0) {
        this._tipIndex = ((this._tipIndex ?? -1) + 1) % this.dialogues.lines.length;
        return this.dialogues.lines[this._tipIndex];
      }
      if (typeof this.dialogues.default === 'string') {
        return this.dialogues.default;
      }
    }

    // Caso A: Valerio el Viajero Herbolario (Encuentro del Sendero Norte)
    if (this.variant === 'valerio') {
      const vLines = [
        'Gracias a ti sigo con vida, portador del Guantelete. Sabio Tarak te aguarda al sur, frente a su cabaña.',
        'Consejo de viajero: si abres el Santuario [U] y entras en ARSENAL, podrás equipar armas y escudos distintos.'
      ];
      this._tipIndex = ((this._tipIndex ?? -1) + 1) % vLines.length;
      return vLines[this._tipIndex];
    }

    // Caso B: Sabio Guardián Tarak (Reacciona orgánicamente al Karma Invisible)
    const rescuedValerio = stateManager ? !!stateManager.get('valerio_rescued') : false;

    if (karma < 0) {
      return 'Percibo agitación en la Reliquia, Santi... Que el poder ancestral proteja a los débiles, no los consuma.';
    }

    const teachings = [];
    if (rescuedValerio) {
      teachings.push('Valerio me habló de tu valentía en el paso norte. La Reliquia resuena con más nobleza en tus manos.');
    }
    teachings.push(
      'Bienvenido al Claro del Santuario, Santi. Toca el Monolito de Resonancia [E] para descansar y mejorar talentos.',
      'El Centinela Pavés porta un escudo de roble macizo: incinéralo con Fuego [Clic Der / K] para quebrar su defensa para siempre.',
      'Cuando estés listo para poner a prueba tus reflejos, activa la Estela de Desafío al este o desafía al Guardián de la región.'
    );

    this._tipIndex = ((this._tipIndex ?? -1) + 1) % teachings.length;
    return teachings[this._tipIndex];
  }
}
