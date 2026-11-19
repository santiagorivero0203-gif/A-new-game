import { Entity } from './Entity.js';
import { CelSpriteAtlas } from '../render/CelSpriteAtlas.js';
import { formatControlPrompts } from '../utils/textFormatter.js';

/**
 * @module InteractableProp
 * @description Entidad arquitectónica e interactiva Data-Driven para el diseño de niveles
 * sistémicos (Kishōtenketsu, Espacio Compartido y Puertas Elementales).
 *
 * Soporta los siguientes tipos declarativos desde JSON:
 * - 'cave_mouth'       : Arco monumental de salida de la cueva con cristales violetas.
 * - 'cliff_rock'       : Peñasco sólido de cañón para esculpir rutas y miradores.
 * - 'crystal_rock'     : Peñasco con drusa de cristales luminosos de cueva.
 * - 'cracked_rock'     : Barricada mineral agrietada ('pared_falsa') rompible a espadazos o cinética.
 * - 'relic_pedestal'   : Pedestal ancestral que despierta el Núcleo Elemental en el Guantelete.
 * - 'burnable_vines'   : Zarzas espinosas gigantes ('debil_fuego') que bloquean el puente hasta quemarlas.
 * - 'sanctuary_altar'  : Monolito de Resonancia Sagrada (cura, armoniza elementos y abre Habilidades).
 * - 'horde_totem'      : Estela de Desafío Táctico para invocar las oleadas de prueba a voluntad.
 *
 * @author Be a Legend Team
 * @version 1.0.0
 */

const INK = '#0b101d';

export class InteractableProp extends Entity {
  /**
   * @param {Object} config
   * @param {string} config.propType - Tipo de prop interactivo o estructural
   * @param {number} config.x - Coordenada X en el mundo
   * @param {number} config.y - Coordenada Y en el mundo
   * @param {string} [config.id] - Identificador único para eventos del nivel
   * @param {string} [config.label] - Etiqueta descriptiva opcional
   * @param {string} [config.grantsElement] - Elemento que despierta ('Fuego', 'All', etc.)
   */
  constructor(config) {
    const normalizedType = InteractableProp._normalizePropType(config.propType);
    const dims = InteractableProp._getDimensions(normalizedType, config);
    super(config.x, config.y, dims.w, dims.h);

    this.propId = config.id || `${normalizedType}_${Math.round(config.x)}_${Math.round(config.y)}`;
    this.propType = normalizedType;
    this.label = config.label || '';
    this.grantsElement = config.grantsElement || 'Fuego';

    // Metadatos narrativos, enlaces lógicos, peligros ambientales y portales entre mundos
    this.biomeTint = config.biomeTint || 'forest';
    this.loreTitle = config.loreTitle || '';
    this.loreText = config.loreText || '';
    this.runeColor = config.runeColor || '#38bdf8';
    this.portalColor = config.portalColor || '#38bdf8';
    this.targetWorld = config.targetWorld || '';
    this.targetSpawnId = config.targetSpawnId || null;
    this.worldLabel = config.worldLabel || 'Atlas de Mundos';
    this.essenceReward = Number(config.essenceReward || 0);
    this.sealedBy = Array.isArray(config.sealedBy) ? [...config.sealedBy] : [];
    this.sealedHint = config.sealedHint || '';
    this.grantsWeapon = config.grantsWeapon || null;
    this.grantsShield = config.grantsShield || null;
    this.hazardKind = config.hazardKind || 'magma_geyser';
    this.cycleTime = Math.max(1.5, Number(config.cycleTime) || 3.8);
    this.activeTime = Math.max(0.3, Number(config.activeTime) || 0.75);
    this.hazardRadius = Math.max(20, Number(config.hazardRadius) || 44);
    this.lightColor = config.lightColor || null;
    this._hazardTimer = Number(config.phaseOffset) || 0;
    this._hazardPhase = 'idle';
    this._hazardHitThisCycle = false;
    this._addedLight = false;
    this._isPortalSealed = this.sealedBy.length > 0;

    // Metadatos para objetos de ambiente personalizados (Forja de Zonas)
    this.customKey = config.customKey || 'objeto_personalizado';
    this.devDescription = config.devDescription || '';
    this.textureUrl = config.textureUrl || '';
    this.isSolidProp = config.isSolid !== false;
    this.isInteractableProp = config.isInteractable !== false;
    this.tintColor = config.tintColor || '#a855f7';

    this.tags.push('prop');
    this.isConsumed = false;
    this.isActivated = false;
    this.isBurning = false;
    this.burnProgress = 0;
    this.flashTimer = 0;
    this.animClock = Math.random() * Math.PI * 2;
    this.playerNearby = false;

    this._configureCollisionAndTags();
  }

  /**
   * Serializa de forma compacta el estado persistente del prop al descargar su chunk
   * (zarzas quemadas, roca destruida, espada recogida, obelisco activado).
   * @returns {Object}
   */
  serializeChunkState() {
    return {
      isConsumed: Boolean(this.isConsumed),
      isActivated: Boolean(this.isActivated),
      isDead: Boolean(this.isDead),
      health: this.health,
      isBurning: Boolean(this.isBurning),
      burnProgress: this.burnProgress
    };
  }

  /**
   * Restaura el estado recordado del prop al recargar su chunk.
   * @param {Object} state
   */
  restoreChunkState(state) {
    if (!state) return;
    this.isConsumed = Boolean(state.isConsumed);
    this.isActivated = Boolean(state.isActivated);
    this.isDead = Boolean(state.isDead);
    this.isBurning = Boolean(state.isBurning);
    this.burnProgress = state.burnProgress || 0;
    if (typeof state.health === 'number') {
      this.health = state.health;
    }

    // Si el obstáculo ya fue destruido/consumido, garantizar que no vuelva a bloquear paso ni interacciones
    if (this.isConsumed || this.isDead) {
      if (
        this.propType === 'cracked_rock' ||
        this.propType === 'burnable_vines' ||
        this.propType === 'kinetic_barrier' ||
        this.propType === 'runic_gate'
      ) {
        this.isDead = true;
        this.active = false;
        this.tags = this.tags.filter((t) => t !== 'solid' && t !== 'destructible_prop' && t !== 'interactable');
      } else if (
        this.propType === 'starter_sword' ||
        this.propType === 'relic_pedestal' ||
        this.propType === 'broken_statue' ||
        this.propType === 'rusted_greatsword' ||
        this.propType === 'weapon_shrine'
      ) {
        this.tags = this.tags.filter((t) => t !== 'interactable');
      }
    }
  }

  /**
   * Normaliza alias históricos de `propType` usados en archivos JSON de niveles.
   * @private
   * @param {string} propType
   * @returns {string}
   */
  static _normalizePropType(propType) {
    if (propType === 'thorn_gate') return 'burnable_vines';
    if (propType === 'elemental_Switch_fire' || propType === 'elemental_switch_fire') {
      return 'runic_obelisk';
    }
    return propType;
  }

  /**
   * Retorna dimensiones canónicas por tipo de prop (o dimensiones explícitas para `custom_env_prop`).
   * @private
   * @param {string} propType
   * @param {Object|null} [config=null]
   * @returns {{ w: number, h: number }}
   */
  static _getDimensions(propType, config = null) {
    const normalizedType = InteractableProp._normalizePropType(propType);
    switch (normalizedType) {
      case 'cave_mouth': return { w: 192, h: 156 };
      case 'starter_sword': return { w: 48, h: 58 };
      case 'cliff_rock':
      case 'crystal_rock': return { w: 64, h: 60 };
      case 'cracked_rock': return { w: 64, h: 56 };
      case 'burnable_vines': return { w: 72, h: 96 };
      case 'relic_pedestal': return { w: 56, h: 68 };
      case 'sanctuary_altar': return { w: 76, h: 102 };
      case 'horde_totem': return { w: 56, h: 78 };
      case 'broken_statue': return { w: 64, h: 80 };
      case 'rusted_greatsword': return { w: 48, h: 56 };
      case 'runic_obelisk': return { w: 56, h: 88 };
      case 'world_portal': return { w: 76, h: 76 };
      case 'elemental_brazier': return { w: 44, h: 52 };
      case 'root_totem': return { w: 48, h: 64 };
      case 'kinetic_barrier': return { w: 64, h: 60 };
      case 'kinetic_pillar': return { w: 48, h: 68 };
      case 'ether_pylon': return { w: 48, h: 76 };
      case 'runic_gate': return { w: 72, h: 68 };
      case 'weapon_shrine': return { w: 56, h: 68 };
      case 'hazard_vent': return { w: 56, h: 44 };
      case 'custom_env_prop':
        return {
          w: Math.max(16, Math.min(384, Number(config?.width) || 64)),
          h: Math.max(16, Math.min(384, Number(config?.height) || 64))
        };
      default: return { w: 48, h: 48 };
    }
  }

  /**
   * Configura hitboxes precisas en la base para Y-Sorting perfecto y etiquetas de combate/interacción.
   * @private
   */
  _configureCollisionAndTags() {
    switch (this.propType) {
      case 'cave_mouth':
        // El arco central queda libre para caminar saliendo de la cueva; colisiona en la roca superior
        this.tags.push('solid');
        this.hitbox = { offsetX: 16, offsetY: 22, width: 160, height: 62 };
        break;

      case 'starter_sword':
        this.tags.push('interactable');
        this.hitbox = { offsetX: 10, offsetY: 34, width: 28, height: 18 };
        break;

      case 'cliff_rock':
      case 'crystal_rock':
        this.tags.push('solid');
        this.hitbox = { offsetX: 8, offsetY: 22, width: 48, height: 30 };
        break;

      case 'cracked_rock':
        this.tags.push('solid');
        this.tags.push('destructible_prop');
        this.tags.push('pared_falsa');
        this.health = 32;
        this.max_health = 32;
        this.hitbox = { offsetX: 6, offsetY: 16, width: 52, height: 34 };
        break;

      case 'burnable_vines':
        this.tags.push('solid');
        this.tags.push('destructible_prop');
        this.tags.push('debil_fuego');
        this.health = 25;
        this.max_health = 25;
        this.hitbox = { offsetX: 8, offsetY: 10, width: 56, height: 78 };
        break;

      case 'relic_pedestal':
        this.tags.push('solid');
        this.tags.push('interactable');
        this.hitbox = { offsetX: 10, offsetY: 38, width: 36, height: 24 };
        break;

      case 'sanctuary_altar':
        this.tags.push('solid');
        this.tags.push('interactable');
        this.hitbox = { offsetX: 12, offsetY: 62, width: 52, height: 32 };
        break;

      case 'horde_totem':
        this.tags.push('solid');
        this.tags.push('interactable');
        this.hitbox = { offsetX: 10, offsetY: 46, width: 36, height: 24 };
        break;

      case 'broken_statue':
        this.tags.push('solid');
        this.tags.push('interactable');
        this.tags.push('lore_prop');
        this.hitbox = { offsetX: 12, offsetY: 50, width: 40, height: 24 };
        break;

      case 'rusted_greatsword':
        this.tags.push('solid');
        this.tags.push('interactable');
        this.tags.push('lore_prop');
        this.hitbox = { offsetX: 10, offsetY: 34, width: 28, height: 16 };
        break;

      case 'runic_obelisk':
        this.tags.push('solid');
        this.tags.push('interactable');
        this.tags.push('runic_resonator');
        this.hitbox = { offsetX: 12, offsetY: 60, width: 32, height: 22 };
        break;

      case 'world_portal':
        this.tags.push('interactable');
        this.tags.push('world_portal');
        this.hitbox = { offsetX: 18, offsetY: 28, width: 40, height: 26 };
        break;

      case 'elemental_brazier':
        this.tags.push('solid');
        this.tags.push('destructible_prop');
        this.hitbox = { offsetX: 8, offsetY: 22, width: 28, height: 24 };
        break;

      case 'root_totem':
        this.tags.push('solid');
        this.tags.push('destructible_prop');
        this.tags.push('interactable');
        this.hitbox = { offsetX: 10, offsetY: 36, width: 28, height: 22 };
        break;

      case 'kinetic_barrier':
        this.tags.push('solid');
        this.tags.push('destructible_prop');
        this.tags.push('pared_falsa');
        this.health = 40;
        this.max_health = 40;
        this.hitbox = { offsetX: 4, offsetY: 8, width: 56, height: 50 };
        break;

      case 'kinetic_pillar':
        this.tags.push('solid');
        this.tags.push('destructible_prop');
        this.tags.push('interactable');
        this.hitbox = { offsetX: 10, offsetY: 38, width: 28, height: 24 };
        break;

      case 'ether_pylon':
        this.tags.push('solid');
        this.tags.push('destructible_prop');
        this.tags.push('interactable');
        this.hitbox = { offsetX: 10, offsetY: 46, width: 28, height: 24 };
        break;

      case 'runic_gate':
        this.tags.push('solid');
        this.tags.push('destructible_prop');
        this.tags.push('interactable');
        this.hitbox = { offsetX: 6, offsetY: 10, width: 60, height: 54 };
        break;

      case 'weapon_shrine':
        this.tags.push('solid');
        this.tags.push('interactable');
        this.hitbox = { offsetX: 10, offsetY: 38, width: 36, height: 24 };
        break;

      case 'hazard_vent':
        this.tags.push('hazard_vent');
        this.hitbox = { offsetX: 8, offsetY: 12, width: 40, height: 26 };
        break;

      case 'custom_env_prop':
        if (this.isSolidProp) this.tags.push('solid');
        if (this.isInteractableProp) {
          this.tags.push('interactable');
          this.tags.push('custom_env_prop');
        }
        this.hitbox = {
          offsetX: Math.round(this.width * 0.12),
          offsetY: Math.round(this.height * 0.55),
          width: Math.max(12, Math.round(this.width * 0.76)),
          height: Math.max(10, Math.round(this.height * 0.38))
        };
        break;
    }

    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;
  }

  /**
   * Actualización por fotograma: evalúa proximidad del jugador para mostrar prompt contextual
   * y procesa animaciones de incineración en puertas vegetales.
   * @param {Object} context
   */
  update(context) {
    if (this.isDead) return;
    const dt = (context && context.deltaTime) ? context.deltaTime : 0.016;
    this.animClock += dt * 3.2;

    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
    }

    // Sincronizar compuertas o portales sellados con ProgressionManager
    if (this.sealedBy.length > 0 && context && context.progressionManager) {
      const worldId = context.state ? context.state.get('current_world') : null;
      if (worldId) {
        const unlocked = context.progressionManager.areRequirementsMet(worldId, this.sealedBy);
        if (this.propType === 'runic_gate' && unlocked) {
          this.onSealBroken(context);
          return;
        }
        if (this.propType === 'world_portal') {
          this._isPortalSealed = !unlocked;
          if (unlocked) this.isActivated = true;
        }
      }
    }

    // Respiraderos ambientales peligrosos (Esporas, Géiser de Magma, Bobina de Tormenta)
    if (this.propType === 'hazard_vent') {
      const player = context && context.player;
      const cx = this.pos.x + this.width * 0.5;
      const cy = this.pos.y + this.height * 0.5;
      if (this.hazardKind === 'spore_pool') {
        if (player && !player.isDead && !player.isDashing && !player.lowProfile) {
          const px = player.pos.x + player.width * 0.5;
          const py = player.pos.y + player.height * 0.5;
          if ((px - cx) * (px - cx) + (py - cy) * (py - cy) <= this.hazardRadius * this.hazardRadius) {
            player.applyEffect('enredado_espinas', 0.45);
            player.stamina = Math.max(0, (player.stamina || 0) - 14 * dt);
            if (context.vfxRenderer && Math.random() < 0.22) {
              context.vfxRenderer.addParticle({
                x: px, y: py + 6, vx: (Math.random() - 0.5) * 16, vy: -18, color: '#2dd4bf', size: 3, life: 0.35
              });
            }
          }
        }
      } else {
        this._hazardTimer = (this._hazardTimer + dt) % this.cycleTime;
        const activeStart = Math.max(0.5, this.cycleTime - this.activeTime);
        const telegraphStart = Math.max(0, activeStart - 0.95);
        const prevPhase = this._hazardPhase;
        if (this._hazardTimer >= activeStart) {
          this._hazardPhase = 'active';
          if (prevPhase !== 'active') {
            this._hazardHitThisCycle = false;
            if (context && context.audioManager && typeof context.audioManager.playHazardErupt === 'function') {
              context.audioManager.playHazardErupt(this.hazardKind);
            }
            if (context && context.vfxRenderer) {
              context.vfxRenderer.spawnImpact(
                this.hazardKind === 'storm_coil' ? 'ether_arc' : 'fire_burst',
                cx,
                cy,
                { radius: this.hazardRadius, duration: 0.42 }
              );
            }
          }
          if (!this._hazardHitThisCycle && player && !player.isDead && !player.hasTag('iframe') && !player.isDashing) {
            const canLowEvade = this.hazardKind === 'storm_coil' && player.lowProfile;
            if (!canLowEvade) {
              const px = player.pos.x + player.width * 0.5;
              const py = player.pos.y + player.height * 0.5;
              if ((px - cx) * (px - cx) + (py - cy) * (py - cy) <= this.hazardRadius * this.hazardRadius) {
                this._hazardHitThisCycle = true;
                if (typeof player.takeDamage === 'function') {
                  player.takeDamage(1, { heartDamage: 1, hitbox: { x: cx - 16, y: cy - 16, width: 32, height: 32 } }, context);
                }
              }
            }
          }
        } else if (this._hazardTimer >= telegraphStart) {
          this._hazardPhase = 'telegraph';
        } else {
          this._hazardPhase = 'idle';
          this._hazardHitThisCycle = false;
        }
      }
      return;
    }

    // Proceso de combustión cuando las Zarzas Gigantes reciben Fuego
    if (this.isBurning) {
      this.burnProgress += dt * 1.35;
      if (context && context.vfxRenderer && Math.random() < 0.45) {
        context.vfxRenderer.addParticle({
          x: this.pos.x + 12 + Math.random() * (this.width - 24),
          y: this.pos.y + 16 + Math.random() * (this.height - 28),
          vx: (Math.random() - 0.5) * 28,
          vy: -35 - Math.random() * 35,
          color: Math.random() > 0.4 ? '#fb923c' : '#fef08a',
          size: 4.5,
          life: 0.42
        });
      }
      if (this.burnProgress >= 1.0) {
        this._destroyObstacle(context, '¡Zarzas incineradas! El puente hacia el Claro del Santuario está libre.', 0);
      }
      return;
    }

    // Detectar cercanía del jugador para mostrar indicador contextual [E]
    const player = context && context.player;
    if (player && this.hasTag('interactable')) {
      const px = player.pos.x + player.width / 2;
      const py = player.pos.y + player.height / 2;
      const cx = this.pos.x + this.width / 2;
      const cy = this.pos.y + this.height / 2;
      const distSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      this.playerNearby = distSq <= 68 * 68;

      // Resonancia reactiva automática de obeliscos rúnicos al acercarse con el Guantelete
      if (this.propType === 'runic_obelisk') {
        const resonateNearby = distSq <= 104 * 104;
        if (resonateNearby && !this.isActivated) {
          this.isActivated = true;
          if (context.audioManager && typeof context.audioManager.playRunicResonance === 'function') {
            context.audioManager.playRunicResonance();
          }
          if (context.vfxRenderer) {
            for (let i = 0; i < 8; i++) {
              const ang = (i / 8) * Math.PI * 2;
              context.vfxRenderer.addParticle({
                x: cx,
                y: cy - 10,
                vx: Math.cos(ang) * 44,
                vy: Math.sin(ang) * 32 - 20,
                color: this.runeColor,
                size: 3.5,
                life: 0.55
              });
            }
          }
        }
      }

      // Auto-despertar opcional si el jugador toca directamente la Espada del Alba o el Núcleo de Fuego
      if (this.propType === 'starter_sword' && !this.isConsumed && distSq <= 34 * 34) {
        const msg = this.interact(context.state, context);
        if (msg && context.state) {
          context.state.set('active_dialogue', {
            speaker: 'ESPADA DEL ALBA',
            text: msg,
            timer: 4.4
          });
        }
      }
      if (this.propType === 'relic_pedestal' && !this.isConsumed && distSq <= 38 * 38) {
        this.interact(context.state, context);
      }
    } else {
      this.playerNearby = false;
    }
  }

  /**
   * Gestiona impactos de armas o magias del jugador sobre obstáculos ambientales.
   * @param {number} amount
   * @param {Object} attack
   * @param {Object} context
   */
  takeEnvironmentalHit(amount, attack, context) {
    if (this.isDead || this.isBurning) return;

    const attackElem = (attack && attack.element) ? attack.element : 'physical';

    // Caso 1: Zarzas Gigantes ('debil_fuego') — exigen usar el Núcleo de Fuego recién adquirido
    if (this.propType === 'burnable_vines') {
      if (attackElem === 'fuego') {
        this.isBurning = true;
        this.flashTimer = 0.25;
        if (context && context.audioManager) context.audioManager.playAbility('fuego', false);
        if (context && context.camera) context.camera.shake(0.35, 0.2);
      } else {
        this.flashTimer = 0.14;
        if (context && context.audioManager) context.audioManager.playHitImpact('shield_bounce');
        if (context && context.state) {
          const hasFire = (context.state.get('gauntlet_tier') || 0) >= 1;
          context.state.set('active_dialogue', {
            speaker: 'SANTI',
            text: hasFire
              ? '¡El acero rebota en estas espinas! Debo quemarlas con Fuego [Clic Der / K].'
              : 'Espinas demasiado gruesas para mi espada... Hay un brillo cálido al sur de esta ribera.',
            timer: 3.4
          });
        }
      }
      return;
    }

    // Caso 2: Barricada Mineral Agrietada ('pared_falsa') — cede ante combo de espada o impacto cinético
    if (this.propType === 'cracked_rock') {
      const bonusMult = (attack && attack.damageType === 'armor_break') ? 3.0 : 1.0;
      this.health -= amount * bonusMult;
      this.flashTimer = 0.14;
      if (context && context.audioManager) context.audioManager.playHitImpact('normal');
      if (context && context.vfxRenderer) {
        context.vfxRenderer.spawnImpact('dash_dust', this.pos.x + this.width / 2, this.pos.y + this.height / 2, {
          radius: 22,
          duration: 0.25
        });
      }
      if (this.health <= 0) {
        this._destroyObstacle(context, null, 0);
        if (context && context.state && (context.state.get('intro_stage') || 0) < 2) {
          context.state.set('intro_stage', 1);
          context.state.set('level_objective', 'Sigue el rastro ígneo hacia la ribera sur y reclama el Núcleo de Brasa');
        }
      }
      return;
    }

    const cx = this.pos.x + this.width * 0.5;
    const cy = this.pos.y + this.height * 0.5;
    const worldId = context && context.state ? context.state.get('current_world') : null;

    // Caso 3: Brasero Elemental (`elemental_brazier`) — requiere Fuego
    if (this.propType === 'elemental_brazier') {
      if (attackElem === 'fuego') {
        if (!this.isActivated) {
          this.isActivated = true;
          this.flashTimer = 0.2;
          if (context && context.audioManager) context.audioManager.playAbility('fuego', false);
          if (context && context.vfxRenderer) {
            context.vfxRenderer.spawnImpact('fire_burst', cx, cy, { radius: 34, duration: 0.35 });
          }
          if (context && context.lightManager && !this._addedLight) {
            this._addedLight = true;
            context.lightManager.addLight({ x: cx, y: cy, radius: 170, color: this.lightColor || '#fb923c', intensity: 0.8, flickerSpeed: 2.6 });
          }
          if (context && context.progressionManager && worldId) {
            context.progressionManager.registerLinkEvent(worldId, this.propId, context, { x: cx, y: cy });
          }
        }
      } else {
        this.flashTimer = 0.14;
        if (context && context.audioManager) context.audioManager.playHitImpact('shield_bounce');
        if (context && context.state) {
          context.state.set('active_dialogue', {
            speaker: 'SANTI',
            text: 'Brasero apagado: debo encenderlo con Fuego [Clic Der / K].',
            timer: 2.8
          });
        }
      }
      return;
    }

    // Caso 4: Tótem Silvestre (`root_totem`) — responde a Raíces / Plantas
    if (this.propType === 'root_totem') {
      if (attackElem === 'plantas' || attackElem === 'tierra' || attackElem === 'raices') {
        if (!this.isActivated) {
          this.isActivated = true;
          this.flashTimer = 0.2;
          if (context && context.audioManager) context.audioManager.playAbility('plantas', false);
          if (context && context.vfxRenderer) {
            context.vfxRenderer.spawnImpact('earth_root', cx, cy, { radius: 38, duration: 0.4 });
          }
          if (context && context.skillTreeManager) context.skillTreeManager.addEssence(4);
          if (context && context.progressionManager && worldId) {
            context.progressionManager.registerLinkEvent(worldId, this.propId, context, { x: cx, y: cy });
          }
        }
      } else {
        this.flashTimer = 0.14;
        if (context && context.audioManager) context.audioManager.playHitImpact('shield_bounce');
        if (context && context.state) {
          context.state.set('active_dialogue', {
            speaker: 'SANTI',
            text: 'Las runas piden fuerza silvestre: usa Raíces para anclar este tótem.',
            timer: 2.8
          });
        }
      }
      return;
    }

    // Caso 5: Barrera de Basalto Cinético (`kinetic_barrier`) — cede ante Cinética o Éter
    if (this.propType === 'kinetic_barrier') {
      if (attackElem === 'kinetic' || attackElem === 'eter' || (attack && attack.damageType === 'armor_break')) {
        this.health -= Math.max(amount * 2.5, 40);
        this.flashTimer = 0.16;
        if (this.health <= 0) {
          this._destroyObstacle(context, '¡Muralla de basalto demolida con impacto cinético!', 4);
        }
      } else {
        this.flashTimer = 0.14;
        if (context && context.audioManager) context.audioManager.playHitImpact('resisted', 'stone');
        if (context && context.state) {
          context.state.set('active_dialogue', {
            speaker: 'SANTI',
            text: 'Basalto demasiado denso para mi espada... Necesita Embestida Cinética o Éter.',
            timer: 3.0
          });
        }
      }
      return;
    }

    // Caso 6: Pilar Cinético (`kinetic_pillar`) — responde a Embestida / Cinética
    if (this.propType === 'kinetic_pillar') {
      if (attackElem === 'kinetic') {
        if (!this.isActivated) {
          this.isActivated = true;
          this.flashTimer = 0.2;
          if (context && context.audioManager) context.audioManager.playAbility('kinetic', false);
          if (context && context.vfxRenderer) {
            context.vfxRenderer.spawnImpact('plasma_pulse', cx, cy, { radius: 40, duration: 0.36 });
          }
          if (context && context.progressionManager && worldId) {
            context.progressionManager.registerLinkEvent(worldId, this.propId, context, { x: cx, y: cy });
          }
        }
      } else {
        this.flashTimer = 0.14;
        if (context && context.audioManager) context.audioManager.playHitImpact('shield_bounce');
        if (context && context.state) {
          context.state.set('active_dialogue', {
            speaker: 'SANTI',
            text: 'El mecanismo requiere un golpe de Embestida Cinética para activarse.',
            timer: 2.8
          });
        }
      }
      return;
    }

    // Caso 7: Pilón Voltaico (`ether_pylon`) — responde a Éter Magnético
    if (this.propType === 'ether_pylon') {
      if (attackElem === 'eter' || attackElem === 'astral') {
        if (!this.isActivated) {
          this.isActivated = true;
          this.flashTimer = 0.2;
          if (context && context.audioManager) context.audioManager.playAbility('eter', false);
          if (context && context.vfxRenderer) {
            context.vfxRenderer.spawnImpact('ether_arc', cx, cy, { radius: 42, duration: 0.36 });
          }
          if (context && context.lightManager && !this._addedLight) {
            this._addedLight = true;
            context.lightManager.addLight({ x: cx, y: cy, radius: 185, color: '#c084fc', intensity: 0.85, flickerSpeed: 2.1 });
          }
          if (context && context.progressionManager && worldId) {
            context.progressionManager.registerLinkEvent(worldId, this.propId, context, { x: cx, y: cy });
          }
        }
      } else {
        this.flashTimer = 0.14;
        if (context && context.audioManager) context.audioManager.playHitImpact('shield_bounce');
        if (context && context.state) {
          context.state.set('active_dialogue', {
            speaker: 'SANTI',
            text: 'Este pilón astral solo responde a pulsos de Éter Magnético.',
            timer: 2.8
          });
        }
      }
      return;
    }

    // Caso 8: Compuerta Rúnica (`runic_gate`)
    if (this.propType === 'runic_gate') {
      this.flashTimer = 0.14;
      if (context && context.audioManager) context.audioManager.playHitImpact('shield_bounce');
      if (context && context.state) {
        context.state.set('active_dialogue', {
          speaker: 'SELLO RÚNICO',
          text: this.sealedHint || 'Esta compuerta rúnica está sellada por mecanismos de la zona.',
          timer: 3.2
        });
      }
    }
  }

  /**
   * Ejecuta la apertura de compuerta o liberación visual de portal cuando se cumplen sus `sealedBy`.
   * @param {Object} context
   */
  onSealBroken(context) {
    if (this.propType === 'runic_gate' && !this.isDead) {
      this._destroyObstacle(
        context,
        this.label ? `¡${this.label} desbloqueada!` : '¡El sello de la compuerta rúnica se ha quebrado!',
        0
      );
      return;
    }
    if (this.propType === 'world_portal') {
      this._isPortalSealed = false;
      if (!this.isActivated) {
        this.isActivated = true;
        if (context && context.vfxRenderer) {
          context.vfxRenderer.spawnImpact('parry_spark', this.pos.x + this.width * 0.5, this.pos.y + this.height * 0.5, {
            radius: 48,
            duration: 0.48
          });
        }
        if (context && context.state) {
          context.state.set('active_dialogue', {
            speaker: 'RELIQUIA',
            text: `¡Los sellos hacia ${this.worldLabel} resuenan abiertos!`,
            timer: 3.5
          });
        }
      }
    }
  }

  /**
   * Destruye el obstáculo liberando su paso físico y otorgando Esencia solo si se indica explícitamente.
   * @private
   */
  _destroyObstacle(context, message = null, essenceReward = 0) {
    this.isDead = true;
    this.isConsumed = true;
    this.tags = this.tags.filter(t => t !== 'solid' && t !== 'destructible_prop' && t !== 'interactable');

    if (context) {
      if (context.audioManager) context.audioManager.playExplosion();
      if (context.camera) context.camera.shake(0.42, 0.22);
      if (context.vfxRenderer) {
        context.vfxRenderer.spawnImpact('wood_explosion', this.pos.x + this.width / 2, this.pos.y + this.height / 2, {
          radius: 44,
          duration: 0.4
        });
      }
      if (context.skillTreeManager && essenceReward > 0) {
        context.skillTreeManager.addEssence(essenceReward);
      } else if (context.state && essenceReward > 0) {
        const cur = context.state.get('player_essence') ?? 0;
        context.state.set('player_essence', cur + essenceReward);
      }
      if (context.state) {
        if (this.propType === 'burnable_vines') {
          context.state.set('bridge_vines_burned', true);
          if ((context.state.get('intro_stage') || 0) < 3) {
            context.state.set('intro_stage', 3);
            context.state.set('level_objective', 'Cruza el puente hacia el Claro del Santuario (o auxilia el sendero norte)');
          }
        }
        if (message) {
          context.state.set('active_dialogue', {
            speaker: 'RELIQUIA',
            text: message,
            timer: 3.5
          });
        }
      }
      if (context.entityManager) {
        context.entityManager.removeEntity(this);
      }
    }
  }

  /**
   * Ejecuta la interacción contextual cuando el jugador pulsa [E] o activa el prop.
   * @param {import('../core/StateManager.js').StateManager} stateManager
   * @param {Object} [context=null]
   * @returns {string|null}
   */
  interact(stateManager, context = null) {
    const player = stateManager ? stateManager.get('player') : null;

    if (this.propType === 'starter_sword') {
      if (this.isConsumed) {
        return null;
      }
      this.isConsumed = true;
      if (player && typeof player.unlockSword === 'function') {
        player.unlockSword();
      }
      const isMobile = context?.inputManager?.shouldShowTouchControls || (typeof document !== 'undefined' && document.body.classList.contains('touch-controls-active'));
      if (stateManager) {
        stateManager.set('has_sword', true);
        if ((stateManager.get('intro_stage') || 0) < 1) {
          stateManager.set('intro_stage', 1);
        }
        stateManager.set(
          'level_objective',
          formatControlPrompts('Rompe la roca agrietada [Clic Izq / J] y sigue el rastro ígneo hacia el Núcleo de Fuego', isMobile)
        );
      }
      if (context && context.audioManager) {
        if (typeof context.audioManager.playParry === 'function') context.audioManager.playParry();
        if (typeof context.audioManager.playHeal === 'function') context.audioManager.playHeal();
      }
      if (context && context.vfxRenderer) {
        context.vfxRenderer.spawnImpact('parry_spark', this.pos.x + this.width / 2, this.pos.y + 24, {
          radius: 36,
          duration: 0.42
        });
      }
      if (context && context.camera) {
        context.camera.shake(0.26, 0.15);
      }
      return formatControlPrompts('¡Has empuñado la Espada del Alba! Su filo rúnico puede quebrar rocas agrietadas [Clic Izq / J].', isMobile);
    }

    if (this.propType === 'relic_pedestal') {
      if (this.isConsumed) {
        return `El pedestal ya entregó el Núcleo de ${this.grantsElement || 'Fuego'} a tu Guantelete.`;
      }
      this.isConsumed = true;
      const pedestalEssence = this.essenceReward > 0 ? this.essenceReward : 6;
      if (context && context.skillTreeManager) {
        context.skillTreeManager.addEssence(pedestalEssence);
      } else if (stateManager) {
        const curEssence = stateManager.get('player_essence') ?? 0;
        stateManager.set('player_essence', curEssence + pedestalEssence);
      }

      const rawElem = this.grantsElement || 'Fuego';
      const normElem = player && typeof player._normalizeElementName === 'function'
        ? player._normalizeElementName(rawElem)
        : rawElem;
      const displayElem = normElem === 'Plantas' ? 'Raíces' : normElem;

      if (context && context.progressionManager) {
        context.progressionManager.unlockElement(normElem, player, stateManager);
      } else {
        if (player) {
          player.unlockElement(normElem);
          player.equipAbility(normElem);
        }
        if (stateManager) {
          stateManager.set('gauntlet_tier', Math.max(1, stateManager.get('gauntlet_tier') || 0));
          stateManager.set('equipped_power', displayElem);
        }
      }

      if (player) {
        player.health = player.max_health;
        player.energy = player.max_energy || 100;
      }
      if (context && context.input && typeof context.input.setPower === 'function') {
        context.input.setPower(displayElem);
      }

      const isMobile = context?.inputManager?.shouldShowTouchControls || (typeof document !== 'undefined' && document.body.classList.contains('touch-controls-active'));
      const coreMeta = {
        Fuego: {
          title: 'NÚCLEO DE FUEGO DESPERTADO',
          objective: 'Usa Fuego [Clic Der / K] para quemar las Zarzas del Puente y el Brasero',
          sub: `Ceniza Ígnea activa • Pulsa [Clic Der / K] (+${pedestalEssence} ✦)`
        },
        Raíces: {
          title: 'NÚCLEO DE RAÍCES DESPERTADO',
          objective: 'Ancla los Tótems Inestables con Raíces [Clic Der / K] y abre la Compuerta',
          sub: `Látigo y Prisión Silvestre activos • Alterna con [R] / [3] (+${pedestalEssence} ✦)`
        },
        Embestida: {
          title: 'NÚCLEO CINÉTICO DESPERTADO',
          objective: 'Demuele la Muralla de Basalto y activa los Pilares Cinéticos con [Clic Der / K]',
          sub: `Embestida Rompedora y Taladro activos • Alterna con [R] / [2] (+${pedestalEssence} ✦)`
        },
        Éter: {
          title: 'NÚCLEO DE ÉTER MAGNÉTICO DESPERTADO',
          objective: 'Sincroniza los Pilones Voltaicos con Éter [Clic Der / K] para abrir el Cenit',
          sub: `Pulso de Polaridad y Singularidad activos • Alterna con [R] / [4] (+${pedestalEssence} ✦)`
        }
      }[displayElem] || {
        title: `NÚCLEO DE ${displayElem.toUpperCase()} DESPERTADO`,
        objective: `Domina ${displayElem} [Clic Der / K] para superar los sellos del bioma`,
        sub: `Nuevo conducto activo (+${pedestalEssence} ✦)`
      };

      if (stateManager) {
        stateManager.set('intro_stage', Math.max(2, stateManager.get('intro_stage') || 0));
        stateManager.set('level_objective', formatControlPrompts(coreMeta.objective, isMobile));
        stateManager.set('horde_victory_announcement', {
          title: coreMeta.title,
          rewardText: formatControlPrompts(coreMeta.sub, isMobile)
        });
        stateManager.set('core_awakened', {
          element: displayElem,
          x: this.pos.x + this.width * 0.5,
          y: this.pos.y + this.height * 0.5,
          ts: Date.now()
        });
      }
      if (context && context.audioManager) {
        if (typeof context.audioManager.playCoreAwakening === 'function') {
          context.audioManager.playCoreAwakening(displayElem);
        } else {
          context.audioManager.playHeal();
        }
      }
      if (context && context.camera) context.camera.shake(0.38, 0.25);
      return `¡El Núcleo de ${displayElem} se funde con el Guantelete!`;
    }

    if (this.propType === 'sanctuary_altar') {
      const isMobile = context?.inputManager?.shouldShowTouchControls || (typeof document !== 'undefined' && document.body.classList.contains('touch-controls-active'));
      if (stateManager) {
        stateManager.set('intro_stage', Math.max(4, stateManager.get('intro_stage') || 0));
        stateManager.set(
          'level_objective',
          formatControlPrompts('Santuario Armonizado • Mejora talentos [U] o desafía al Guardián de la región', isMobile)
        );
        if (player) {
          player.spawnX = Math.round(this.pos.x);
          player.spawnY = Math.round(this.pos.y + 42);
          player.health = player.max_health;
          player.energy = player.max_energy || 100;
          player.guard_meter = player.max_guard || 100;
          stateManager.set('player_health', player.health);
          stateManager.set('player_energy', player.energy);
        }
        if (context && context.audioManager) context.audioManager.playHeal();
        const openHook = stateManager.get('open_sanctuary_hook');
        if (typeof openHook === 'function') {
          openHook('skills');
          return null;
        }
      }
      return 'El Altar de Resonancia restaura tu vitalidad, postura y energía elemental.';
    }

    if (this.propType === 'horde_totem') {
      if (context && context.waveManager) {
        if (!context.waveManager.isStarted) {
          if (player) {
            player.spawnX = Math.round(this.pos.x);
            player.spawnY = Math.round(this.pos.y + 42);
          }
          if (stateManager) {
            stateManager.set('level_objective', 'Supera las Oleadas del Santuario Ancestral');
          }
          context.waveManager.startHorde(context);
          return null;
        } else if (context.waveManager.state === 'INTERMISSION') {
          context.waveManager.timer = 0.05;
          return '¡Adelantando la siguiente oleada del desafío!';
        }
      }
      return 'La Estela del Desafío vibra en pleno combate. ¡Derrota a los enemigos restantes!';
    }

    if (this.propType === 'broken_statue') {
      let bonusText = '';
      if (!this.isConsumed) {
        this.isConsumed = true;
        const reward = this.essenceReward > 0 ? this.essenceReward : 18;
        if (context && context.skillTreeManager) {
          context.skillTreeManager.addEssence(reward);
        }
        if (context && context.audioManager && typeof context.audioManager.playRunicResonance === 'function') {
          context.audioManager.playRunicResonance();
        }
        bonusText = ` (+${reward} Esencia Antigua recogida)`;
      }
      const lore = this.loreText || 'Los antiguos Centinelas de la Reliquia cayeron protegiendo los 4 Portales del Mundo.';
      return `${lore}${bonusText}`;
    }

    if (this.propType === 'rusted_greatsword') {
      let bonusText = '';
      if (!this.isConsumed) {
        this.isConsumed = true;
        const reward = this.essenceReward > 0 ? this.essenceReward : 15;
        if (context && context.skillTreeManager) {
          context.skillTreeManager.addEssence(reward);
        }
        if (player) {
          const maxE = player.max_energy || player.maxEnergy || 100;
          player.energy = Math.min(maxE, player.energy + 30);
        }
        bonusText = ` (+${reward} Esencia y +30 Energía recuperada)`;
      }
      const lore = this.loreText || 'Un espadón oxidado aún tibio por el fuego de una batalla olvidada.';
      return `${lore}${bonusText}`;
    }

    if (this.propType === 'runic_obelisk') {
      this.isActivated = true;
      if (context && context.audioManager && typeof context.audioManager.playRunicResonance === 'function') {
        context.audioManager.playRunicResonance();
      }
      if (!this.isConsumed) {
        this.isConsumed = true;
        const reward = this.essenceReward > 0 ? this.essenceReward : 25;
        if (context && context.skillTreeManager) {
          context.skillTreeManager.addEssence(reward);
        }
        if (player) {
          const maxE = player.max_energy || player.maxEnergy || 100;
          player.health = Math.min(player.max_health, player.health + 1);
          player.energy = Math.min(maxE, player.energy + 45);
        }
        return `${this.loreText || 'Las runas del obelisco responden al Guantelete Elemental.'} (+1 Corazón, +45 Energía, +${reward} Esencia)`;
      }
      return this.loreText || 'El obelisco resuena en armonía con tu Guantelete.';
    }

    if (this.propType === 'weapon_shrine') {
      if (this.isConsumed) {
        return 'El relicario ya entregó su armamento ancestral.';
      }
      this.isConsumed = true;
      let unlockedName = this.label || 'Reliquia Forjada';
      if (context && context.equipmentManager) {
        if (this.grantsWeapon) {
          context.equipmentManager.unlockWeapon(this.grantsWeapon);
          context.equipmentManager.equipWeapon(this.grantsWeapon);
          unlockedName = context.equipmentManager.getWeapon()?.name || unlockedName;
        }
        if (this.grantsShield) {
          context.equipmentManager.unlockShield(this.grantsShield);
          context.equipmentManager.equipShield(this.grantsShield);
          unlockedName = context.equipmentManager.getShield()?.name || unlockedName;
        }
      }
      if (context && context.audioManager) {
        if (typeof context.audioManager.playCoreAwakening === 'function') context.audioManager.playCoreAwakening('Éter');
        else context.audioManager.playHeal();
      }
      if (context && context.vfxRenderer) {
        context.vfxRenderer.spawnImpact('parry_spark', this.pos.x + this.width * 0.5, this.pos.y + 24, { radius: 42, duration: 0.45 });
      }
      return `¡Has consagrado y equipado ${unlockedName}! Revisa el Arsenal [I] cuando quieras.`;
    }

    if (this.propType === 'root_totem') {
      return this.isActivated
        ? 'El tótem silvestre resuena con tus raíces.'
        : 'Tótem inestable: golpéalo con el poder de Raíces [Clic Der / K] para anclarlo.';
    }
    if (this.propType === 'kinetic_pillar') {
      return this.isActivated
        ? 'El pilar cinético vibra en sintonía.'
        : 'Pilar dormido: impáctalo con Embestida Cinética [Clic Der / K] para activarlo.';
    }
    if (this.propType === 'ether_pylon') {
      return this.isActivated
        ? 'El pilón voltaico canaliza corriente astral.'
        : 'Pilón apagado: energízalo con Éter Magnético [Clic Der / K] para completar el circuito.';
    }
    if (this.propType === 'runic_gate') {
      return this.sealedHint || 'Esta compuerta rúnica está sellada por mecanismos de la zona.';
    }

    if (this.propType === 'world_portal') {
      if (stateManager && this.sealedBy.length > 0 && context && context.progressionManager) {
        const currentWorld = stateManager.get('current_world');
        if (currentWorld && !context.progressionManager.areRequirementsMet(currentWorld, this.sealedBy)) {
          if (context.audioManager) context.audioManager.playHitImpact('resisted');
          return this.sealedHint || `Portal sellado. Derrota al Guardián de esta región para liberar el paso hacia ${this.worldLabel}.`;
        }
      }
      if (stateManager) {
        const loadWorldHook = stateManager.get('load_world_hook');
        if (this.targetWorld && typeof loadWorldHook === 'function') {
          loadWorldHook(this.targetWorld, { spawnId: this.targetSpawnId });
          return null;
        }
        const openHook = stateManager.get('open_sanctuary_hook');
        if (typeof openHook === 'function') {
          openHook('codex');
          return null;
        }
      }
      return `Portal del Atlas sintonizado hacia ${this.worldLabel}.`;
    }

    if (this.propType === 'custom_env_prop') {
      if (context && context.audioManager && typeof context.audioManager.playRunicResonance === 'function') {
        context.audioManager.playRunicResonance();
      }
      return this.loreText
        || (this.devDescription
          ? `[${this.label || this.customKey}] ${this.devDescription}`
          : `Objeto de ambiente: ${this.label || this.customKey}.`);
    }

    return null;
  }

  /**
   * Dibuja una sombra pixel-art escalonada bajo props terrestres visibles
   * (sustituye las sombras genéricas duplicadas en Renderer).
   * @private
   */
  _drawGroundShadow(ctx, x, y) {
    if (this.propType === 'cave_mouth' || this.propType === 'world_portal') return;
    const sw = Math.min(44, Math.max(20, Math.round(this.width * 0.62)));
    const sx = Math.round(x + this.width * 0.5 - sw * 0.5);
    const sy = Math.round(y + this.height - 6);
    ctx.fillStyle = 'rgba(11, 16, 29, 0.28)';
    ctx.fillRect(sx, sy, sw, 3);
    ctx.fillRect(sx + 3, sy + 3, Math.max(10, sw - 6), 1);
  }

  /**
   * Renderizado 2D Pixel-Art 16-bit de alta limpieza con indicadores contextuales y sombras únicas.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (this.isDead) return;
    if ((this.propType === 'cracked_rock' || this.propType === 'burnable_vines') && this.isConsumed) {
      return;
    }

    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);

    if (this.propType === 'cave_mouth') {
      const spr = CelSpriteAtlas.getCaveMouthSprite();
      if (spr) ctx.drawImage(spr, x, y);
      const pulse = 0.14 + Math.sin(this.animClock) * 0.05;
      ctx.fillStyle = `rgba(192, 132, 252, ${pulse})`;
      ctx.fillRect(x + 62, y + 114, 68, 18);
      return;
    }

    this._drawGroundShadow(ctx, x, y);

    if (this.propType === 'cliff_rock' || this.propType === 'crystal_rock') {
      const spr = CelSpriteAtlas.getCliffRockSprite(this.propType === 'crystal_rock');
      if (spr) ctx.drawImage(spr, x, y);
      return;
    }

    if (this.propType === 'broken_statue') {
      const spr = CelSpriteAtlas.getBrokenStatueSprite(this.biomeTint);
      if (spr) ctx.drawImage(spr, x, y);
    } else if (this.propType === 'rusted_greatsword') {
      const spr = CelSpriteAtlas.getRustedGreatswordSprite();
      if (spr) ctx.drawImage(spr, x, y);
    } else if (this.propType === 'runic_obelisk') {
      const spr = CelSpriteAtlas.getRunicObeliskSprite(this.isActivated || this.playerNearby, this.runeColor);
      if (spr) ctx.drawImage(spr, x, y);
      if (this.isActivated || this.playerNearby) {
        const pulse = 0.18 + Math.sin(this.animClock * 1.4) * 0.08;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = this.runeColor;
        ctx.fillRect(x + 12, y + 16, 32, 42);
        ctx.restore();
      }
    } else if (this.propType === 'world_portal') {
      const spr = CelSpriteAtlas.getWorldPortalSprite(this.portalColor);
      if (spr) {
        ctx.save();
        if (this._isPortalSealed) ctx.globalAlpha = 0.55;
        ctx.drawImage(spr, x, y);
        ctx.restore();
      }
      if (this._isPortalSealed) {
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 16, y + 18);
        ctx.lineTo(x + 60, y + 58);
        ctx.moveTo(x + 60, y + 18);
        ctx.lineTo(x + 16, y + 58);
        ctx.stroke();
        ctx.restore();
      } else {
        const pulse = 0.22 + Math.sin(this.animClock * 1.6) * 0.1;
        ctx.save();
        ctx.strokeStyle = this.portalColor;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x + 38, y + 40, Math.round(29 + Math.sin(this.animClock) * 2), 19, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else if (this.propType === 'elemental_brazier') {
      const spr = CelSpriteAtlas.getBrazierSprite(this.isActivated);
      if (spr) ctx.drawImage(spr, x, y);
    } else if (this.propType === 'root_totem') {
      const spr = CelSpriteAtlas.getRootTotemSprite(this.isActivated);
      if (spr) ctx.drawImage(spr, x, y);
    } else if (this.propType === 'kinetic_barrier') {
      const spr = CelSpriteAtlas.getKineticBarrierSprite(this.flashTimer > 0);
      if (spr) ctx.drawImage(spr, x, y);
      return;
    } else if (this.propType === 'kinetic_pillar') {
      const spr = CelSpriteAtlas.getKineticPillarSprite(this.isActivated);
      if (spr) ctx.drawImage(spr, x, y);
    } else if (this.propType === 'ether_pylon') {
      const spr = CelSpriteAtlas.getEtherPylonSprite(this.isActivated);
      if (spr) ctx.drawImage(spr, x, y);
    } else if (this.propType === 'runic_gate') {
      const spr = CelSpriteAtlas.getRunicGateSprite(this.runeColor || '#38bdf8');
      if (spr) ctx.drawImage(spr, x, y);
    } else if (this.propType === 'weapon_shrine') {
      const spr = CelSpriteAtlas.getWeaponShrineSprite(this.isConsumed, this.runeColor || '#facc15');
      if (spr) ctx.drawImage(spr, x, y);
    } else if (this.propType === 'hazard_vent') {
      const spr = CelSpriteAtlas.getHazardVentSprite(this.hazardKind, this._hazardPhase);
      if (spr) ctx.drawImage(spr, x, y);
      if (this._hazardPhase === 'telegraph') {
        const cx = x + this.width * 0.5;
        const cy = y + this.height * 0.5;
        ctx.save();
        ctx.strokeStyle = this.hazardKind === 'storm_coil' ? '#e879f9' : '#fb923c';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, this.hazardRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      return;
    } else if (this.propType === 'cracked_rock') {
      this._drawCrackedRock(ctx, x, y);
      return;
    } else if (this.propType === 'burnable_vines') {
      this._drawBurnableVines(ctx, x, y);
      return;
    } else if (this.propType === 'relic_pedestal') {
      this._drawRelicPedestal(ctx, x, y);
    } else if (this.propType === 'starter_sword') {
      this._drawStarterSword(ctx, x, y);
    } else if (this.propType === 'sanctuary_altar') {
      this._drawSanctuaryAltar(ctx, x, y);
    } else if (this.propType === 'horde_totem') {
      this._drawHordeTotem(ctx, x, y);
    } else if (this.propType === 'custom_env_prop') {
      const customImg = CelSpriteAtlas.getCustomTextureImage(this.textureUrl);
      if (customImg) {
        ctx.drawImage(customImg, x, y, this.width, this.height);
      } else {
        const placeholder = CelSpriteAtlas.getCustomPropPlaceholderSprite(this.width, this.height, this.tintColor);
        if (placeholder) ctx.drawImage(placeholder, x, y, this.width, this.height);
      }
    }

    if (
      this.playerNearby &&
      !(this.propType === 'custom_env_prop' && !this.isInteractableProp) &&
      !((this.propType === 'relic_pedestal' || this.propType === 'starter_sword') && this.isConsumed)
    ) {
      this._drawPromptBadge(ctx, x + this.width / 2, y - 8);
    }
  }

  /** @private */
  _drawCrackedRock(ctx, x, y) {
    const sprite = CelSpriteAtlas.getCrackedRockSprite(this.flashTimer > 0);
    if (sprite) ctx.drawImage(sprite, Math.round(x), Math.round(y));
  }

  /** @private */
  _drawBurnableVines(ctx, x, y) {
    const state = this.flashTimer > 0 ? 'hit' : (this.isBurning ? 'burn' : 'idle');
    const sprite = CelSpriteAtlas.getBurnableVinesSprite(state);
    if (!sprite) return;

    if (this.isBurning) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.1, 1 - this.burnProgress);
      ctx.drawImage(sprite, Math.round(x), Math.round(y));
      ctx.restore();
    } else {
      ctx.drawImage(sprite, Math.round(x), Math.round(y));
    }
  }

  /** @private */
  _drawRelicPedestal(ctx, x, y) {
    const baseSprite = CelSpriteAtlas.getOrBake('prop_relic_pedestal_v2', this.width, this.height, (sctx) => {
      CelSpriteAtlas._inkRoundRect(sctx, 8, 48, 40, 13, 2, '#475569', '#050811', 1);
      CelSpriteAtlas._inkRoundRect(sctx, 14, 32, 28, 18, 2, '#64748b', '#050811', 1);
      sctx.fillStyle = '#94a3b8';
      sctx.fillRect(16, 33, 24, 3);
      sctx.fillRect(10, 49, 36, 2);
      sctx.fillStyle = '#334155';
      sctx.fillRect(16, 45, 24, 3);
      sctx.fillStyle = '#facc15';
      sctx.fillRect(26, 38, 4, 5);
    });
    ctx.drawImage(baseSprite, Math.round(x), Math.round(y));

    // Si aún no ha sido absorbido, dibujar faro vertical cromático + Orbe Elemental flotando
    if (!this.isConsumed) {
      const elemKey = String(this.grantsElement || 'Fuego').toLowerCase();
      const isRoots = elemKey.includes('raí') || elemKey.includes('rai') || elemKey.includes('plant');
      const isKin = elemKey.includes('embest') || elemKey.includes('kinet') || elemKey.includes('cin');
      const isEther = elemKey.includes('éter') || elemKey.includes('eter') || elemKey.includes('astral');
      const beamRgba = isRoots ? '74, 222, 128' : isKin ? '56, 189, 248' : isEther ? '192, 132, 252' : '251, 146, 60';
      const orbMain = isRoots ? '#22c55e' : isKin ? '#06b6d4' : isEther ? '#a855f7' : '#f97316';
      const orbHi = isRoots ? '#86efac' : isKin ? '#67e8f9' : isEther ? '#e879f9' : '#fb923c';
      const orbKey = `prop_relic_orb_${isRoots ? 'roots' : isKin ? 'kin' : isEther ? 'ether' : 'fire'}_v2`;

      const rx = Math.round(x);
      const ry = Math.round(y);
      const pulse = 0.24 + Math.sin(this.animClock * 1.8) * 0.10;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${beamRgba}, ${pulse})`;
      ctx.fillRect(rx + 18, ry - 92, 20, 108);
      ctx.fillStyle = `rgba(254, 240, 138, ${pulse * 0.85})`;
      ctx.fillRect(rx + 25, ry - 86, 6, 100);
      // Chispas ascendentes pixel-art
      for (let i = 0; i < 3; i++) {
        const lift = ((this.animClock * 16 + i * 28) % 84);
        const sx = rx + 22 + ((i * 7) % 13);
        const sy = Math.round(ry + 10 - lift);
        ctx.fillStyle = i % 2 === 0 ? '#fef08a' : orbHi;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.restore();

      const orbSprite = CelSpriteAtlas.getOrBake(orbKey, 24, 24, (octx) => {
        CelSpriteAtlas._inkEllipse(octx, 12, 12, 9, 9, orbMain, '#050811', 1);
        octx.fillStyle = orbHi;
        octx.fillRect(7, 7, 7, 7);
        octx.fillStyle = '#fef08a';
        octx.fillRect(9, 8, 4, 4);
      });
      const floatY = Math.round(y + 6 + Math.sin(this.animClock * 1.4) * 3);
      ctx.drawImage(orbSprite, Math.round(x + 16), floatY);
    }
  }

  /**
   * Dibuja la base rúnica musgosa y la Espada del Alba clavada frente a la salida de la cueva.
   * Cuando el jugador la empuña (`isConsumed === true`), permanece la losa rúnica vacía en el suelo.
   * @private
   */
  _drawStarterSword(ctx, x, y) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const stoneBase = CelSpriteAtlas.getStarterSwordStoneSprite();
    if (stoneBase) ctx.drawImage(stoneBase, rx, ry);

    if (!this.isConsumed) {
      const pulse = 0.22 + Math.sin(this.animClock * 2.1) * 0.1;
      const hover = Math.round(Math.sin(this.animClock * 2.0));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(56, 189, 248, ${pulse * 0.85})`;
      ctx.fillRect(rx + 18, ry - 26, 12, 66);
      ctx.fillStyle = `rgba(250, 204, 21, ${pulse * 0.7})`;
      ctx.fillRect(rx + 22, ry - 18, 4, 54);
      ctx.restore();

      const bladeSprite = CelSpriteAtlas.getStarterSwordBladeSprite();
      if (bladeSprite) ctx.drawImage(bladeSprite, rx, ry + hover);

      // Destello pixelado de 4 puntas junto a la guarda
      const gl = (Math.floor(this.animClock * 3) % 2 === 0);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(gl ? rx + 31 : rx + 14, ry + 11 + hover, 2, 2);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(gl ? rx + 13 : rx + 33, ry + 26 + hover, 2, 2);
    }
  }

  /** @private */
  _drawSanctuaryAltar(ctx, x, y) {
    const altarSprite = CelSpriteAtlas.getOrBake('prop_sanctuary_altar_v2', this.width, this.height, (sctx) => {
      CelSpriteAtlas._inkEllipse(sctx, 38, 86, 30, 9, '#475569', '#050811', 1);
      sctx.fillStyle = '#64748b';
      sctx.fillRect(14, 81, 48, 3);

      // Cuerpo central de estela de piedra en píxeles enteros
      CelSpriteAtlas._inkRoundRect(sctx, 22, 16, 32, 69, 6, '#64748b', '#050811', 1);
      sctx.fillStyle = '#475569';
      sctx.fillRect(45, 24, 7, 58);
      sctx.fillStyle = '#94a3b8';
      sctx.fillRect(25, 22, 4, 56);

      // Capuchón de musgo verde píxel
      CelSpriteAtlas._inkEllipse(sctx, 38, 22, 15, 11, '#1d5c38', '#050811', 1);
      sctx.fillStyle = '#6ebd30';
      sctx.fillRect(27, 15, 22, 7);
      sctx.fillStyle = '#b6e345';
      sctx.fillRect(30, 14, 14, 3);
      // Enredaderas colgantes pixeladas
      sctx.fillStyle = '#1d5c38';
      sctx.fillRect(25, 31, 3, 6);
      sctx.fillRect(47, 30, 3, 8);
    });
    ctx.drawImage(altarSprite, Math.round(x), Math.round(y));

    // Runas cian y doradas resplandecientes en fillRect entero
    const glow = 0.65 + Math.sin(this.animClock) * 0.35;
    const rx = Math.round(x);
    const ry = Math.round(y);
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(rx + 33, ry + 40, 3, 32);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(rx + 41, ry + 40, 3, 32);
    ctx.restore();
  }

  /** @private */
  _drawHordeTotem(ctx, x, y) {
    const totemSprite = CelSpriteAtlas.getOrBake('prop_horde_totem_v2', this.width, this.height, (sctx) => {
      // Pilar de obsidiana escalonado
      sctx.fillStyle = '#1e293b';
      sctx.fillRect(15, 18, 26, 48);
      sctx.fillRect(19, 13, 18, 6);
      sctx.fillRect(23, 8, 10, 6);
      // Luz izquierda y borde bronce inferior
      sctx.fillStyle = '#334155';
      sctx.fillRect(17, 19, 6, 44);
      sctx.fillStyle = '#b45309';
      sctx.fillRect(15, 58, 26, 4);
      sctx.fillStyle = '#facc15';
      sctx.fillRect(17, 59, 22, 1);
    });
    ctx.drawImage(totemSprite, Math.round(x), Math.round(y));

    // Emblema pixelado romboidal carmesí/dorado
    const pulse = 0.7 + Math.sin(this.animClock * 1.5) * 0.3;
    const tx = Math.round(x + 28);
    const ty = Math.round(y + 34);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(tx - 1, ty - 11, 2, 22);
    ctx.fillRect(tx - 6, ty - 6, 12, 12);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(tx - 4, ty - 4, 8, 8);
    ctx.fillRect(tx - 2, ty - 8, 4, 16);
    ctx.restore();
  }

  /**
   * Dibuja una insignia flotante limpia indicando "[E]" en PC o "USAR" en móvil.
   * @private
   */
  _drawPromptBadge(ctx, cx, topY) {
    const isTouch = typeof document !== 'undefined' && document.body.classList.contains('touch-controls-active');
    const prefix = isTouch ? 'USAR ·' : '[E]';
    let action = 'EXAMINAR';
    if (this.propType === 'relic_pedestal') action = 'NÚCLEO';
    else if (this.propType === 'starter_sword') action = 'EMPUÑAR ESPADA';
    else if (this.propType === 'sanctuary_altar') action = 'ALTAR';
    else if (this.propType === 'horde_totem') action = 'HORDAS';
    else if (this.propType === 'broken_statue') action = 'ESTATUA';
    else if (this.propType === 'rusted_greatsword') action = 'ESPADÓN';
    else if (this.propType === 'runic_obelisk') action = 'OBELISCO';
    else if (this.propType === 'weapon_shrine') action = 'RELICARIO';
    else if (this.propType === 'runic_gate') action = 'SELLADO';
    else if (this.propType === 'root_totem') action = 'TÓTEM';
    else if (this.propType === 'kinetic_pillar') action = 'PILAR';
    else if (this.propType === 'ether_pylon') action = 'PILÓN';
    else if (this.propType === 'world_portal') action = this._isPortalSealed ? 'SELLADO 🔒' : this.worldLabel.toUpperCase();
    const label = `${prefix} ${action}`;
    ctx.save();
    ctx.font = '800 9px Outfit, sans-serif';
    const w = Math.max(48, ctx.measureText(label).width + 14);
    const bx = Math.round(cx - w / 2);
    const by = Math.round(topY - 16 + Math.sin(this.animClock * 1.6) * 2);

    ctx.fillStyle = 'rgba(11, 16, 29, 0.92)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, 16, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, by + 8.5);
    ctx.restore();
  }
}
