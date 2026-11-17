import { Entity } from './Entity.js';
import { CelSpriteAtlas } from '../render/CelSpriteAtlas.js';

/**
 * @module NPC
 * @description Entidad no jugable 2D Cel-Shaded con soporte de variantes narrativas ('tarak' y 'valerio'),
 * indicadores contextuales limpios y Arquitectura de Karma Invisible (las decisiones morales orgánicas,
 * como rescatar a un viajero acorralado, alteran el mundo y los diálogos sin barras artificiales).
 * @author Be a Legend Team
 * @version 2.0.0
 */
export class NPC extends Entity {
  /**
   * @param {number} x - Posición X inicial
   * @param {number} y - Posición Y inicial
   * @param {string|Object} [configOrName='Sabio Tarak'] - Nombre o diccionario de configuración
   * @param {'tarak'|'valerio'} [variant='tarak'] - Variante visual y narrativa
   */
  constructor(x, y, configOrName = 'Sabio Tarak', variant = 'tarak') {
    super(x, y, 32, 32);
    this.color = '#6366f1';
    this.tags.push('npc');
    this.tags.push('solid');
    this.interacted = false;

    if (typeof configOrName === 'object' && configOrName !== null) {
      this.name = configOrName.name || (configOrName.variant === 'valerio' ? 'Valerio el Viajero' : 'Sabio Tarak');
      this.variant = configOrName.variant || 'tarak';
      this.rescueTag = configOrName.rescueTag || null;
    } else {
      this.name = configOrName || 'Sabio Tarak';
      this.variant = variant || (String(this.name).toLowerCase().includes('valerio') ? 'valerio' : 'tarak');
      this.rescueTag = this.variant === 'valerio' ? 'ambush_valerio' : null;
    }

    this.playerNearby = false;
    this.isUnderThreat = false;
    this.hadAmbushers = false;
    this.rescueCompleted = false;
    this._defeatedAnyAmbusher = false;
    this.animClock = Math.random() * Math.PI * 2;

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
   * Actualización lógica contextual: evalúa cercanía de Santi y estado del evento moral de rescate.
   * @param {Object|number} contextOrDt
   */
  update(contextOrDt) {
    const isCtx = typeof contextOrDt === 'object' && contextOrDt !== null;
    const dt = isCtx ? (contextOrDt.deltaTime || 0.016) : (contextOrDt || 0.016);
    this.animClock += dt * 3.0;

    if (!isCtx) return;

    const player = contextOrDt.player;
    if (player) {
      const px = player.pos.x + player.width / 2;
      const py = player.pos.y + player.height / 2;
      const cx = this.pos.x + this.width / 2;
      const cy = this.pos.y + this.height / 2;
      const distSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      this.playerNearby = distSq <= 68 * 68;
    } else {
      this.playerNearby = false;
    }

    // Evaluar emboscada activa sobre Valerio iterando solo la cubeta de enemigos (cero árboles/props)
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
   * Registra de forma diegética e invisible el rescate moral de Valerio:
   * incrementa internamente `karma_level` (sin mostrar jamás "+1 Karma" en la UI) y entrega
   * una recompensa narrativa calibrada de gratitud.
   * @private
   */
  _completeInvisibleKarmaRescue(stateManager, context = null) {
    if (this.rescueCompleted) return;
    this.rescueCompleted = true;
    this.isUnderThreat = false;

    const rescueEssence = 6;
    if (stateManager) {
      const curKarma = stateManager.get('karma_level') || 0;
      stateManager.set('karma_level', curKarma + 1);
      stateManager.set('valerio_rescued', true);
      stateManager.set('active_dialogue', {
        speaker: this.name.toUpperCase(),
        text: `¡Me salvaste de esas bestias! Toma estos cristales (+${rescueEssence} Esencia) y revisa mi Broquel Templado en el Arsenal.`,
        timer: 4.5
      });
    }

    if (context && context.skillTreeManager) {
      context.skillTreeManager.addEssence(rescueEssence);
    }
    if (context && context.audioManager) {
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

    // Ligero temblor si está acorralado por enemigos
    const panicOffsetX = this.isUnderThreat ? Math.round(Math.sin(this.animClock * 6) * 1.2) : 0;
    const bobY = Math.round(Math.sin(this.animClock * 0.8) * 1);

    // 2. Sprite 2D Cel-Shaded horneado ('tarak' o 'valerio')
    const npcSpr = CelSpriteAtlas.getNPCSprite(this.variant);
    if (npcSpr) {
      ctx.drawImage(npcSpr, Math.round(x - 4 + panicOffsetX), y - 9 + bobY);
    }

    // 3. Insignia flotante contextual: alerta si está en peligro o '[E] HABLAR' / 'USAR · HABLAR' en móvil
    if (this.isUnderThreat) {
      this._drawBadge(ctx, x + 16, y - 12, '¡AUXILIO!', '#ef4444', '#fef2f2');
    } else if (this.playerNearby) {
      const isTouch = typeof document !== 'undefined' && document.body.classList.contains('touch-controls-active');
      this._drawBadge(ctx, x + 16, y - 12, isTouch ? 'USAR · HABLAR' : '[E] HABLAR', '#facc15', '#fef08a');
    }
  }

  /** @private */
  _drawBadge(ctx, cx, topY, label, borderColor, textColor) {
    ctx.save();
    ctx.font = '800 9px Outfit, sans-serif';
    const w = Math.max(52, ctx.measureText(label).width + 14);
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

    // Caso A: Valerio el Viajero Herbolario (Encuentro del Sendero Norte - Fase 'Ten')
    if (this.variant === 'valerio') {
      if (this.isUnderThreat) {
        return '¡Cuidado con el Esporífero! ¡Usa Guardia [Shift] justo al recibir su espora para devolvérsela!';
      }
      if (!this.rescueCompleted) {
        this._completeInvisibleKarmaRescue(stateManager, context);
      }
      const vLines = [
        'Gracias a ti sigo con vida, portador del Guantelete. Sabio Tarak te aguarda al sur, frente a su cabaña.',
        'Consejo de viajero: si abres el Santuario [U] y entras en ARSENAL, podrás equipar armas y escudos distintos.'
      ];
      this._tipIndex = ((this._tipIndex ?? -1) + 1) % vLines.length;
      return vLines[this._tipIndex];
    }

    // Caso B: Sabio Guardián Tarak en el Claro del Santuario (Reacciona orgánicamente al Karma Invisible)
    const karma = stateManager ? (stateManager.get('karma_level') || 0) : 0;
    const rescuedValerio = stateManager ? !!stateManager.get('valerio_rescued') : false;

    if (karma < 0) {
      return 'Percibo agitación en la Reliquia, Santi... Que el poder ancestral proteja a los débiles, no los consuma.';
    }

    const teachings = [];
    if (rescuedValerio) {
      teachings.push('Valerio me habló de tu valentía en el paso norte. La Reliquia resuena con más nobleza en tus manos.');
    }
    teachings.push(
      'Bienvenido al Claro del Santuario, Santi. Toca el Monolito de Resonancia [E] para despertar todos tus elementos y mejorar talentos.',
      'El Centinela Pavés porta un escudo de roble macizo: incinéralo con Fuego [Clic Der / K] para quebrar su defensa para siempre.',
      'Cuando estés listo para poner a prueba todas tus mecánicas, activa la Estela de Desafío al este para invocar las 5 Oleadas.'
    );

    this._tipIndex = ((this._tipIndex ?? -1) + 1) % teachings.length;
    return teachings[this._tipIndex];
  }
}
