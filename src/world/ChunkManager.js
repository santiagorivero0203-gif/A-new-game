import { Tree } from '../entities/Tree.js';
import { House } from '../entities/House.js';
import { NPC } from '../entities/NPC.js';
import { Enemy } from '../entities/Enemy.js';
import { InteractableProp } from '../entities/InteractableProp.js';

/**
 * @module ChunkManager
 * @description Gestor espacial por chunks (256x256 px) con persistencia compacta de entidades.
 * Permite:
 * 1. Mantener en RAM únicamente los árboles, casas, arbustos, props, NPCs y enemigos
 *    cercanos a la cámara/jugador, descargando las entidades fuera de radio.
 * 2. Recordar exactamente el estado de cada entidad mutada (`entityMemory`) cuando su chunk
 *    se descarga (enemigos derrotados, tiempos de reaparición, escudos quemados, zarzas
 *    incineradas, rocas destruidas, espada recogida, rescates de Karma).
 * 3. Reutilizar referencias Flyweight únicas para sprites repetidos (`tree_sprite`, `house_sprite`, `bush_sprite`).
 *
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class ChunkManager {
  /**
   * @param {Object} deps
   * @param {import('../entities/EntityManager.js').EntityManager} deps.entityManager
   * @param {import('./FoliageSystem.js').FoliageSystem|null} [deps.foliageSystem=null]
   * @param {import('../core/ResourceManager.js').ResourceManager|null} [deps.resourceManager=null]
   * @param {number} [deps.chunkSize=256] - Lado del chunk en píxeles de mundo (8 losetas de 32px)
   */
  constructor({ entityManager, foliageSystem = null, resourceManager = null, chunkSize = 256 } = {}) {
    this.entityManager = entityManager;
    this.foliageSystem = foliageSystem;
    this.resourceManager = resourceManager;
    this.chunkSize = chunkSize;

    /** @type {Map<string, Array<Object>>} Planos ligeros de entidades indexados por `${cx}_${cy}` */
    this.chunkBlueprints = new Map();

    /** @type {Set<string>} Claves de chunks actualmente montados en EntityManager */
    this.loadedChunks = new Set();

    /** @type {Map<string, Array<Object>>} Entidades vivas instanciadas por cada chunkKey */
    this.mountedByChunk = new Map();

    /** @type {Map<string, Object>} Memoria persistente compacta indexada por `uid` único de entidad */
    this.entityMemory = new Map();

    /** @type {Map<string, Object>} Enemigos en combate activo mantenidos temporalmente al salir de su chunk */
    this._pinnedActiveEnemies = new Map();

    /** @type {boolean} Bloquea temporalmente la reaparición de enemigos de campo durante Hordas */
    this.suppressFieldEnemies = false;

    /** @type {number} Reloj lógico acumulado para simular respawns sin mantener enemigos en CPU */
    this.worldClockSec = 0;

    /** @type {number} Coordenadas del último centro de chunk procesado para evitar recorridos innecesarios */
    this._lastFocusChunkX = NaN;
    this._lastFocusChunkY = NaN;

    /** @type {import('../systems/ProgressionManager.js').ProgressionManager|null} */
    this.progressionManager = null;
    /** @type {string|null} */
    this.currentWorldId = null;
    /** @type {string} Bioma activo para variantes arquitectónicas y flora */
    this.currentBiome = 'cave_exit_intro';
  }

  /**
   * Asigna el bioma visual activo para variantes regionales de edificios, árboles y arbustos.
   * @param {string} biome
   */
  setCurrentBiome(biome) {
    this.currentBiome = biome || 'cave_exit_intro';
  }

  /**
   * Vincula el ProgressionManager y el identificador del mundo activo para persistir enlaces y escalado.
   * @param {import('../systems/ProgressionManager.js').ProgressionManager|null} pm
   * @param {string|null} [worldId=null]
   */
  setProgressionManager(pm, worldId = null) {
    this.progressionManager = pm;
    if (worldId) this.currentWorldId = worldId;
  }

  /**
   * Actualiza el identificador del mundo actualmente cargado.
   * @param {string} worldId
   */
  setCurrentWorldId(worldId) {
    this.currentWorldId = worldId || null;
  }

  /**
   * Limpia planos, entidades montadas y memoria persistente al cambiar a un nuevo mundo/bioma.
   */
  clearAll() {
    this.unloadAllChunks();
    this.chunkBlueprints.clear();
    this.entityMemory.clear();
    this.loadedChunks.clear();
    this.mountedByChunk.clear();
    this.suppressFieldEnemies = false;
    this.worldClockSec = 0;
    this._lastFocusChunkX = NaN;
    this._lastFocusChunkY = NaN;
  }

  /**
   * Descarga todos los chunks montados guardando primero el estado mutable en `entityMemory`.
   */
  unloadAllChunks() {
    for (const chunkKey of Array.from(this.loadedChunks)) {
      this._unmountChunk(chunkKey, true);
    }
    for (const [uid, ent] of this._pinnedActiveEnemies.entries()) {
      if (ent && typeof ent.serializeChunkState === 'function') {
        this.entityMemory.set(uid, ent.serializeChunkState(this.worldClockSec));
      }
      if (this.entityManager) this.entityManager.removeEntity(ent);
    }
    this._pinnedActiveEnemies.clear();
  }

  /**
   * Activa o desactiva la supresión de enemigos de campo (ej. al iniciar desafío de Hordas).
   * @param {boolean} suppress
   */
  setFieldEnemiesSuppressed(suppress) {
    this.suppressFieldEnemies = Boolean(suppress);
    if (this.suppressFieldEnemies && this.entityManager) {
      const enemies = this.entityManager.getByTag('enemy').slice();
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e || e.hasTag('wave_enemy')) continue;
        e._despawnedForHorde = true;
        if (e._chunkUid && typeof e.serializeChunkState === 'function') {
          this.entityMemory.set(e._chunkUid, e.serializeChunkState(this.worldClockSec));
        }
        this.entityManager.removeEntity(e);
      }
    }
  }

  /**
   * Calcula la clave espacial de chunk para un punto en píxeles de mundo.
   * @param {number} x
   * @param {number} y
   * @returns {string}
   */
  getChunkKey(x, y) {
    const cx = Math.max(0, Math.floor(x / this.chunkSize));
    const cy = Math.max(0, Math.floor(y / this.chunkSize));
    return `${cx}_${cy}`;
  }

  /**
   * Registra un descriptor compacto de entidad en su chunk de origen sin instanciar la clase completa aún.
   * @param {Object} blueprint - Debe contener `uid`, `kind`, `x`, `y` y sus parámetros de datos.
   */
  registerBlueprint(blueprint) {
    const cx = Math.max(0, Math.floor((blueprint.x || 0) / this.chunkSize));
    const cy = Math.max(0, Math.floor((blueprint.y || 0) / this.chunkSize));
    const key = `${cx}_${cy}`;
    blueprint.chunkKey = key;
    blueprint.cx = cx;
    blueprint.cy = cy;

    let list = this.chunkBlueprints.get(key);
    if (!list) {
      list = [];
      this.chunkBlueprints.set(key, list);
    }
    list.push(blueprint);
  }

  /**
   * Asigna las referencias Flyweight compartidas actuales (`tree_sprite`, `house_sprite`, `bush_sprite`)
   * a las entidades ya montadas o recién creadas sin duplicar bitmaps en RAM.
   */
  syncFlyweightSprites() {
    if (!this.entityManager) return;
    const trees = this.entityManager.getByTag('tree');
    for (let i = 0; i < trees.length; i++) {
      if (typeof trees[i].setSprite === 'function' && !trees[i].biome) {
        trees[i].setSprite({ biome: this.currentBiome });
      }
    }
    const houses = this.entityManager.getByTag('house');
    for (let i = 0; i < houses.length; i++) {
      if (typeof houses[i].setSprite === 'function' && !houses[i].biome) {
        houses[i].setSprite({ biome: this.currentBiome });
      }
    }
  }

  /**
   * Actualiza los chunks cargados alrededor del foco visible (`bounds` o punto de cámara/jugador)
   * aplicando histéresis de descarga para evitar cargas/descargas repetitivas al cruzar bordes.
   * @param {{minX: number, minY: number, maxX: number, maxY: number}|{x: number, y: number}} focus
   * @param {number} [deltaTime=0]
   * @param {boolean} [force=false]
   */
  update(focus, deltaTime = 0, force = false) {
    if (!focus) return;
    this.worldClockSec += deltaTime;

    const minX = typeof focus.minX === 'number' ? focus.minX : focus.x - 320;
    const maxX = typeof focus.maxX === 'number' ? focus.maxX : focus.x + 320;
    const minY = typeof focus.minY === 'number' ? focus.minY : focus.y - 220;
    const maxY = typeof focus.maxY === 'number' ? focus.maxY : focus.y + 220;

    // Radio de carga (1 chunk extra alrededor de cámara) y de descarga (> 2 chunks de margen = histéresis)
    const loadMinCx = Math.max(0, Math.floor((minX - this.chunkSize * 0.65) / this.chunkSize));
    const loadMaxCx = Math.floor((maxX + this.chunkSize * 0.65) / this.chunkSize);
    const loadMinCy = Math.max(0, Math.floor((minY - this.chunkSize * 0.65) / this.chunkSize));
    const loadMaxCy = Math.floor((maxY + this.chunkSize * 0.65) / this.chunkSize);

    const centerCx = Math.floor(((minX + maxX) * 0.5) / this.chunkSize);
    const centerCy = Math.floor(((minY + maxY) * 0.5) / this.chunkSize);

    if (force || centerCx !== this._lastFocusChunkX || centerCy !== this._lastFocusChunkY) {
      this._lastFocusChunkX = centerCx;
      this._lastFocusChunkY = centerCy;

      // 1. Descargar chunks alejados más allá del margen de histéresis
      const keepMinCx = loadMinCx - 1;
      const keepMaxCx = loadMaxCx + 1;
      const keepMinCy = loadMinCy - 1;
      const keepMaxCy = loadMaxCy + 1;

      for (const chunkKey of Array.from(this.loadedChunks)) {
        const sep = chunkKey.indexOf('_');
        const cx = Number(chunkKey.slice(0, sep));
        const cy = Number(chunkKey.slice(sep + 1));
        if (cx < keepMinCx || cx > keepMaxCx || cy < keepMinCy || cy > keepMaxCy) {
          this._unmountChunk(chunkKey, false);
        }
      }

      // 2. Montar chunks visibles o recién aproximados que tengan planos registrados
      for (let cy = loadMinCy; cy <= loadMaxCy; cy++) {
        for (let cx = loadMinCx; cx <= loadMaxCx; cx++) {
          const key = `${cx}_${cy}`;
          if (!this.loadedChunks.has(key) && this.chunkBlueprints.has(key)) {
            this._mountChunk(key);
          }
        }
      }
    }

    // 3. Liberar enemigos perseguidores fijados cuando terminen combate y su chunk siga frío
    if (this._pinnedActiveEnemies.size > 0) {
      for (const [uid, ent] of this._pinnedActiveEnemies.entries()) {
        if (!ent || ent.isDead || ent.aiState === 'IDLE' || ent.aiState === 'PATROL') {
          if (ent && ent._homeChunkKey && !this.loadedChunks.has(ent._homeChunkKey)) {
            if (typeof ent.serializeChunkState === 'function') {
              this.entityMemory.set(uid, ent.serializeChunkState(this.worldClockSec));
            }
            if (this.entityManager) this.entityManager.removeEntity(ent);
            this._pinnedActiveEnemies.delete(uid);
          } else if (ent && ent._homeChunkKey && this.loadedChunks.has(ent._homeChunkKey)) {
            this._pinnedActiveEnemies.delete(uid);
          }
        }
      }
    }
  }

  /**
   * Materializa las entidades de un chunk aplicando la textura Flyweight compartida y
   * restaurando su estado recordado si el jugador ya visitó antes esta zona.
   * @private
   * @param {string} chunkKey
   */
  _mountChunk(chunkKey) {
    if (this.loadedChunks.has(chunkKey)) return;
    const blueprints = this.chunkBlueprints.get(chunkKey);
    if (!blueprints || blueprints.length === 0) return;

    this.loadedChunks.add(chunkKey);
    const mounted = [];
    const treeSprite = this.resourceManager ? (this.resourceManager.getImage('tree_sprite') || null) : null;
    const houseSprite = this.resourceManager ? (this.resourceManager.getImage('house_sprite') || null) : null;
    const bushSprite = this.resourceManager ? (this.resourceManager.getImage('bush_sprite') || null) : null;

    for (let i = 0; i < blueprints.length; i++) {
      const bp = blueprints[i];
      const remembered = this.entityMemory.get(bp.uid) || null;
      let entity = null;

      switch (bp.kind) {
        case 'tree':
          entity = new Tree(bp.x, bp.y, {
            biome: this.currentBiome || 'cave_exit_intro',
            variant: bp.variant
          });
          break;

        case 'house':
          entity = new House(bp.x, bp.y, {
            biome: this.currentBiome || 'cave_exit_intro',
            buildingType: bp.buildingType || 'cottage',
            label: bp.label || null
          });
          break;

        case 'foliage':
          if (this.foliageSystem) {
            entity = this.foliageSystem.addFoliage(bp.x, bp.y, { biome: this.currentBiome || 'cave_exit_intro' });
            entity._chunkUid = bp.uid;
            entity._chunkKind = 'foliage';
            mounted.push(entity);
            continue;
          }
          break;

        case 'prop': {
          // Omitir creación pesada si era obstáculo destructible ya destruido en visitas anteriores
          if (
            remembered &&
            remembered.isDead &&
            (
              bp.propType === 'cracked_rock' ||
              bp.propType === 'burnable_vines' ||
              bp.propType === 'kinetic_barrier' ||
              bp.propType === 'runic_gate'
            )
          ) {
            continue;
          }
          // Omitir compuerta ya desbloqueada en ProgressionManager
          if (
            bp.propType === 'runic_gate' &&
            this.progressionManager &&
            this.currentWorldId &&
            Array.isArray(bp.propConfig?.sealedBy) &&
            bp.propConfig.sealedBy.length > 0 &&
            this.progressionManager.areRequirementsMet(this.currentWorldId, bp.propConfig.sealedBy)
          ) {
            continue;
          }
          entity = new InteractableProp(bp.propConfig);
          if (remembered && typeof entity.restoreChunkState === 'function') {
            entity.restoreChunkState(remembered);
          } else if (
            this.progressionManager &&
            bp.propType === 'starter_sword' &&
            this.progressionManager.hasSword
          ) {
            entity.restoreChunkState({ isConsumed: true });
          } else if (
            this.progressionManager &&
            bp.propType === 'relic_pedestal' &&
            bp.propConfig?.grantsElement &&
            this.progressionManager.unlockedElements.has(
              this.progressionManager.normalizeElement(bp.propConfig.grantsElement)
            )
          ) {
            entity.restoreChunkState({ isConsumed: true });
          } else if (
            this.progressionManager &&
            this.currentWorldId &&
            bp.propConfig?.id &&
            (bp.propType === 'elemental_brazier' || bp.propType === 'root_totem' || bp.propType === 'kinetic_pillar' || bp.propType === 'ether_pylon') &&
            this.progressionManager.areRequirementsMet(this.currentWorldId, [bp.propConfig.id])
          ) {
            entity.isActivated = true;
          }
          break;
        }

        case 'npc':
          entity = new NPC(bp.x, bp.y, bp.npcConfig);
          if (remembered && typeof entity.restoreChunkState === 'function') {
            entity.restoreChunkState(remembered);
          }
          break;

        case 'enemy': {
          if (this.suppressFieldEnemies) continue;
          // Re-adoptar enemigo vivo que estaba fijado en persecución al regresar a su chunk
          if (this._pinnedActiveEnemies.has(bp.uid)) {
            const pinned = this._pinnedActiveEnemies.get(bp.uid);
            this._pinnedActiveEnemies.delete(bp.uid);
            if (pinned && !pinned.isDead) {
              mounted.push(pinned);
              continue;
            }
          }
          // No instanciar enemigos únicos definitivamente derrotados
          if (remembered && remembered.isDead && bp.noRespawn) {
            continue;
          }
          if (
            (bp.bossId || bp.linkId) &&
            this.progressionManager &&
            this.currentWorldId &&
            this.progressionManager.areRequirementsMet(this.currentWorldId, [bp.linkId || bp.bossId])
          ) {
            continue;
          }
          entity = new Enemy(bp.x, bp.y, bp.element, bp.name, bp.archetype);
          if (bp.isMiniBoss) {
            entity.isMiniBoss = true;
            if (!entity.tags.includes('miniboss')) entity.tags.push('miniboss');
          }
          if (bp.hasWoodenShield) {
            entity.hasWoodenShield = true;
            entity._initialWoodenShield = true;
            if (!entity.tags.includes('wooden_shield')) entity.tags.push('wooden_shield');
          }
          if (bp.hasMetalArmor) {
            if (typeof entity.equipMetalArmor === 'function') {
              entity.equipMetalArmor(!bp.hasWoodenShield);
            } else {
              entity.hasMetalArmor = true;
              entity._initialMetalArmor = true;
              if (!entity.tags.includes('metal_armor')) entity.tags.push('metal_armor');
            }
          }
          if (bp.noRespawn) {
            entity.noRespawn = true;
            entity.tags.push('no_respawn');
          }
          if (bp.bossId) entity.bossId = bp.bossId;
          if (bp.linkId) entity.linkId = bp.linkId;
          if (bp.worldSeal) entity.worldSeal = true;
          if (bp.rewardWeapon) entity.rewardWeapon = bp.rewardWeapon;
          if (bp.rewardShield) entity.rewardShield = bp.rewardShield;
          if (bp.canSplit) entity.canSplit = true;
          if (bp.scaleWithRelicTier && this.progressionManager && this.currentWorldId) {
            entity.applyTierScaling(this.progressionManager.getWorldScalingMultiplier(this.currentWorldId, entity.isBoss));
          }
          if (Array.isArray(bp.customTags)) {
            for (let t = 0; t < bp.customTags.length; t++) {
              if (!entity.tags.includes(bp.customTags[t])) entity.tags.push(bp.customTags[t]);
            }
          }
          if (remembered && typeof entity.restoreChunkState === 'function') {
            entity.restoreChunkState(remembered, this.worldClockSec);
          }
          break;
        }

        default:
          break;
      }

      if (entity) {
        entity._chunkUid = bp.uid;
        entity._chunkKind = bp.kind;
        entity._homeChunkKey = chunkKey;
        this.entityManager.addEntity(entity);
        mounted.push(entity);
      }
    }

    this.mountedByChunk.set(chunkKey, mounted);
  }

  /**
   * Descarga un chunk frío fuera de alcance y guarda el estado de entidades mutables en `entityMemory`.
   * @private
   * @param {string} chunkKey
   * @param {boolean} force
   */
  _unmountChunk(chunkKey, force = false) {
    const list = this.mountedByChunk.get(chunkKey);
    if (!list) {
      this.loadedChunks.delete(chunkKey);
      return;
    }

    for (let i = 0; i < list.length; i++) {
      const ent = list[i];
      if (!ent) continue;

      // Mantener temporalmente al enemigo en combate sin duplicarlo al recargar el chunk
      if (
        !force &&
        ent._chunkKind === 'enemy' &&
        !ent.isDead &&
        (ent.aiState === 'CHASE' || ent.aiState === 'TELEGRAPH' || ent.aiState === 'ATTACK')
      ) {
        if (ent._chunkUid) {
          this._pinnedActiveEnemies.set(ent._chunkUid, ent);
        }
        continue;
      }

      if (ent._chunkUid && typeof ent.serializeChunkState === 'function') {
        this.entityMemory.set(ent._chunkUid, ent.serializeChunkState(this.worldClockSec));
      }

      if (ent._chunkKind === 'foliage' && this.foliageSystem) {
        this.foliageSystem.removeFoliage(ent);
      } else if (this.entityManager) {
        this.entityManager.removeEntity(ent);
      }
    }

    this.mountedByChunk.delete(chunkKey);
    this.loadedChunks.delete(chunkKey);
  }

  /**
   * Consulta en la memoria persistente de chunks si un enemigo con cierta etiqueta
   * (ej. emboscadores de Valerio) ya fue derrotado aunque su chunk se haya descargado.
   * @param {string} tag
   * @returns {boolean}
   */
  hasRememberedDefeatWithTag(tag) {
    for (const [uid, state] of this.entityMemory.entries()) {
      if (!state || !state.isDead) continue;
      for (const list of this.chunkBlueprints.values()) {
        const bp = list.find((item) => item.uid === uid);
        if (bp && Array.isArray(bp.customTags) && bp.customTags.includes(tag)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Exporta los estados persistentes actuales como pares `[uid, state]` antes de cambiar de mundo.
   * Guarda primero las entidades vivas montadas en los chunks activos para no perder cambios recientes.
   * @returns {Array<[string, Object]>}
   */
  exportMemory() {
    for (const list of this.mountedByChunk.values()) {
      for (let i = 0; i < list.length; i++) {
        const ent = list[i];
        if (ent && ent._chunkUid && typeof ent.serializeChunkState === 'function') {
          this.entityMemory.set(ent._chunkUid, ent.serializeChunkState(this.worldClockSec));
        }
      }
    }
    for (const [uid, ent] of this._pinnedActiveEnemies.entries()) {
      if (ent && typeof ent.serializeChunkState === 'function') {
        this.entityMemory.set(uid, ent.serializeChunkState(this.worldClockSec));
      }
    }
    return Array.from(this.entityMemory.entries());
  }

  /**
   * Restaura memoria persistente exportada previamente antes de montar los chunks iniciales.
   * @param {Array<[string, Object]>|null} entries
   */
  importMemory(entries) {
    this.entityMemory.clear();
    if (!Array.isArray(entries)) return;
    for (let i = 0; i < entries.length; i++) {
      const pair = entries[i];
      if (Array.isArray(pair) && pair.length >= 2) {
        this.entityMemory.set(pair[0], pair[1]);
      }
    }
  }

  /**
   * Retorna estadísticas ligeras de diagnóstico de memoria y streaming.
   * @returns {{totalBlueprints: number, loadedChunks: number, rememberedStates: number}}
   */
  getStats() {
    let totalBlueprints = 0;
    for (const list of this.chunkBlueprints.values()) {
      totalBlueprints += list.length;
    }
    return {
      totalBlueprints,
      loadedChunks: this.loadedChunks.size,
      rememberedStates: this.entityMemory.size
    };
  }
}
