import { Entity } from './Entity.js';
import { CelSpriteAtlas } from '../render/CelSpriteAtlas.js';

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
    const dims = InteractableProp._getDimensions(normalizedType);
    super(config.x, config.y, dims.w, dims.h);

    this.propId = config.id || `${normalizedType}_${Math.round(config.x)}_${Math.round(config.y)}`;
    this.propType = normalizedType;
    this.label = config.label || '';
    this.grantsElement = config.grantsElement || 'Fuego';

    // Metadatos narrativos y de portales entre mundos
    this.biomeTint = config.biomeTint || 'forest';
    this.loreTitle = config.loreTitle || '';
    this.loreText = config.loreText || '';
    this.runeColor = config.runeColor || '#38bdf8';
    this.portalColor = config.portalColor || '#38bdf8';
    this.targetWorld = config.targetWorld || '';
    this.worldLabel = config.worldLabel || 'Atlas de Mundos';
    this.essenceReward = Number(config.essenceReward || 0);

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
   * Retorna dimensiones canónicas por tipo de prop.
   * @private
   */
  static _getDimensions(propType) {
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
    }
  }

  /**
   * Destruye el obstáculo liberando su paso físico y otorgando Esencia solo si se indica explícitamente.
   * @private
   */
  _destroyObstacle(context, message = null, essenceReward = 0) {
    this.isDead = true;
    this.tags = this.tags.filter(t => t !== 'solid' && t !== 'destructible_prop');

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
      if (stateManager) {
        stateManager.set('has_sword', true);
        if ((stateManager.get('intro_stage') || 0) < 1) {
          stateManager.set('intro_stage', 1);
        }
        stateManager.set(
          'level_objective',
          'Rompe la roca agrietada [Clic Izq / J] y sigue el rastro ígneo hacia el Núcleo de Fuego'
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
      return '¡Has empuñado la Espada del Alba! Su filo rúnico puede quebrar rocas agrietadas [Clic Izq / J].';
    }

    if (this.propType === 'relic_pedestal') {
      if (this.isConsumed) {
        return 'El pedestal ya entregó su Núcleo de Brasa a tu Guantelete.';
      }
      this.isConsumed = true;
      const pedestalEssence = 4;
      if (context && context.skillTreeManager) {
        context.skillTreeManager.addEssence(pedestalEssence);
      } else if (stateManager) {
        const curEssence = stateManager.get('player_essence') ?? 0;
        stateManager.set('player_essence', curEssence + pedestalEssence);
      }
      if (stateManager) {
        stateManager.set('gauntlet_tier', Math.max(1, stateManager.get('gauntlet_tier') || 0));
        stateManager.set('equipped_power', 'Fuego');
        stateManager.set('intro_stage', 2);
        stateManager.set('level_objective', 'Usa Fuego [Clic Der / K] para quemar las Zarzas del Puente');
        stateManager.set('horde_victory_announcement', {
          title: 'NÚCLEO DE FUEGO DESPERTADO',
          rewardText: `Ceniza Ígnea activa • Pulsa [Clic Der / K] para lanzar proyectiles de fuego (+${pedestalEssence} ✦)`
        });
      }
      if (player) {
        player.unlockElement('Fuego');
        player.equipAbility('Fuego');
        player.health = player.max_health;
        player.energy = 100;
      }
      if (context && context.audioManager) context.audioManager.playHeal();
      if (context && context.camera) context.camera.shake(0.35, 0.25);
      return '¡El Núcleo de Brasa se funde con el Guantelete! El calor recorre tu brazo: ahora puedes incinerar las zarzas del puente.';
    }

    if (this.propType === 'sanctuary_altar') {
      if (stateManager) {
        const prevTier = stateManager.get('gauntlet_tier') || 0;
        stateManager.set('gauntlet_tier', 3);
        stateManager.set('intro_stage', 4);
        stateManager.set('level_objective', 'Santuario Armonizado • Mejora tus talentos [U] o activa la Estela de Hordas');
        if (player) {
          player.unlockAllElements();
          player.spawnX = Math.round(this.pos.x);
          player.spawnY = Math.round(this.pos.y + 42);
          player.health = player.max_health;
          player.energy = 100;
          stateManager.set('player_health', player.health);
          stateManager.set('player_energy', player.energy);
        }
        if (prevTier < 3) {
          stateManager.set('horde_victory_announcement', {
            title: 'RESONANCIA ANCESTRAL COMPLETA',
            rewardText: 'Fuego, Embestida Cinética y Raíces desbloqueados • Pulsa [1][2][3] o [R] para alternar'
          });
        }
        // Solicitar apertura limpia del Santuario de Habilidades si se invocó con [E]
        const openHook = stateManager.get('open_sanctuary_hook');
        if (typeof openHook === 'function') {
          openHook('skills');
          return null;
        }
      }
      return 'El Altar de Resonancia restaura tu vitalidad y despierta los conductos de Embestida y Raíces.';
    }

    if (this.propType === 'horde_totem') {
      if (context && context.waveManager) {
        if (!context.waveManager.isStarted) {
          if (player) {
            player.unlockAllElements();
            player.spawnX = Math.round(this.pos.x);
            player.spawnY = Math.round(this.pos.y + 42);
          }
          if (stateManager) {
            stateManager.set('gauntlet_tier', 3);
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

    if (this.propType === 'world_portal') {
      if (stateManager) {
        const loadWorldHook = stateManager.get('load_world_hook');
        if (this.targetWorld && typeof loadWorldHook === 'function') {
          loadWorldHook(this.targetWorld);
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
      if (spr) ctx.drawImage(spr, x, y);
      const pulse = 0.22 + Math.sin(this.animClock * 1.6) * 0.1;
      ctx.save();
      ctx.strokeStyle = this.portalColor;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + 38, y + 40, Math.round(29 + Math.sin(this.animClock) * 2), 19, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
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
    }

    if (this.playerNearby && !((this.propType === 'relic_pedestal' || this.propType === 'starter_sword') && this.isConsumed)) {
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

    // Si aún no ha sido absorbido, dibujar faro vertical ígneo + Orbe de Fuego flotando
    if (!this.isConsumed) {
      const rx = Math.round(x);
      const ry = Math.round(y);
      const pulse = 0.24 + Math.sin(this.animClock * 1.8) * 0.10;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(251, 146, 60, ${pulse})`;
      ctx.fillRect(rx + 18, ry - 92, 20, 108);
      ctx.fillStyle = `rgba(254, 240, 138, ${pulse * 0.85})`;
      ctx.fillRect(rx + 25, ry - 86, 6, 100);
      // Chispas ascendentes pixel-art
      for (let i = 0; i < 3; i++) {
        const lift = ((this.animClock * 16 + i * 28) % 84);
        const sx = rx + 22 + ((i * 7) % 13);
        const sy = Math.round(ry + 10 - lift);
        ctx.fillStyle = i % 2 === 0 ? '#fde047' : '#fb923c';
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.restore();

      const orbSprite = CelSpriteAtlas.getOrBake('prop_relic_orb_fire_v2', 24, 24, (octx) => {
        CelSpriteAtlas._inkEllipse(octx, 12, 12, 9, 9, '#f97316', '#050811', 1);
        octx.fillStyle = '#fb923c';
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
   * Dibuja una insignia flotante limpia indicando "[E]" sobre objetos interactivos cercanos.
   * @private
   */
  _drawPromptBadge(ctx, cx, topY) {
    let label = '[E] EXAMINAR';
    if (this.propType === 'relic_pedestal') label = '[E] NÚCLEO';
    else if (this.propType === 'starter_sword') label = '[E] EMPUÑAR ESPADA';
    else if (this.propType === 'sanctuary_altar') label = '[E] ALTAR';
    else if (this.propType === 'horde_totem') label = '[E] HORDAS';
    else if (this.propType === 'broken_statue') label = '[E] ESTATUA';
    else if (this.propType === 'rusted_greatsword') label = '[E] ESPADÓN';
    else if (this.propType === 'runic_obelisk') label = '[E] OBELISCO';
    else if (this.propType === 'world_portal') label = `[E] ${this.worldLabel.toUpperCase()}`;
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
