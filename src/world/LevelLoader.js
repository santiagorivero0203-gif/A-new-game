import { Entity } from '../entities/Entity.js';
import { Tree } from '../entities/Tree.js';
import { House } from '../entities/House.js';
import { NPC } from '../entities/NPC.js';
import { Enemy } from '../entities/Enemy.js';
import { InteractableProp } from '../entities/InteractableProp.js';

/**
 * Colisionador invisible ligero para riberas de ríos, barrancos o muros naturales del terreno.
 */
class InvisibleBarrier extends Entity {
  constructor(x, y, width, height) {
    super(x, y, width, height);
    this.tags.push('solid');
    this.tags.push('terrain_barrier');
    this.hitbox = { offsetX: 0, offsetY: 0, width, height };
    this._hitboxCache.width = width;
    this._hitboxCache.height = height;
  }

  draw() {
    // Invisible: el cauce del río ya se renderiza en el Tilemap offscreen O(1)
  }
}

/**
 * @module LevelLoader
 * @description Cargador data-driven de niveles y zonas sistémicas para 'Be a Legend'.
 * Instancia desde JSON el mapa, colisiones fluviales, props interactivos/destructibles
 * (`InteractableProp`), NPCs con variantes de Karma Invisible, enemigos etiquetados y follaje.
 * @author Be a Legend Team
 * @version 2.0.0
 */
export class LevelLoader {
  /**
   * Carga e instancia todas las entidades y configuraciones espaciales de un nivel.
   * @param {Object} levelData - Esquema JSON del nivel
   * @param {Object} deps - Contenedor de sistemas dependientes
   * @param {import('../entities/EntityManager.js').EntityManager} deps.entityManager
   * @param {import('./FoliageSystem.js').FoliageSystem} [deps.foliageSystem]
   * @param {import('../render/Camera.js').Camera} [deps.camera]
   * @returns {{
   *   mapWidth: number,
   *   mapHeight: number,
   *   playerSpawn: {x: number, y: number},
   *   startDormant: boolean,
   *   arenaCenter: {x: number, y: number}|null,
   *   initialObjective: string|null
   * }}
   */
  static loadLevel(levelData, { entityManager, foliageSystem = null, camera = null, physicsSystem = null }) {
    if (!levelData || !entityManager) {
      throw new Error('[LevelLoader] levelData y entityManager son requeridos.');
    }

    const mapCfg = levelData.map || levelData;
    const cols = mapCfg.cols || levelData.cols || 40;
    const rows = mapCfg.rows || levelData.rows || 40;
    const tileSize = mapCfg.tileSize || levelData.tileSize || 32;
    const mapWidth = cols * tileSize;
    const mapHeight = rows * tileSize;

    // 1. Ajustar límites de cámara (Room Clamping) y límites físicos del mundo (Out-of-Bounds Clamping)
    const bounds = { x: 0, y: 0, width: mapWidth, height: mapHeight };
    if (camera) {
      camera.setRoomBounds(bounds);
    }
    if (physicsSystem && typeof physicsSystem.setWorldBounds === 'function') {
      physicsSystem.setWorldBounds(bounds);
    }

    // 2. Instanciar Colisionadores Fluviales / Barrancos Invisibles
    const solidColliders = Array.isArray(levelData.solidColliders)
      ? levelData.solidColliders
      : Array.isArray(levelData.colliders)
        ? levelData.colliders
        : null;
    if (solidColliders) {
      for (const col of solidColliders) {
        entityManager.addEntity(new InvisibleBarrier(col.x, col.y, col.width, col.height));
      }
    }

    // 3. Instanciar Props Interactivos, Puertas Elementales y Arquitectura (Cueva, Rocas, Altares)
    if (Array.isArray(levelData.props)) {
      for (const propCfg of levelData.props) {
        entityManager.addEntity(new InteractableProp(propCfg));
      }
    }

    // 4. Instanciar Entidades Principales (Casas, NPCs con variantes, Enemigos tácticos)
    if (Array.isArray(levelData.entities)) {
      for (const ent of levelData.entities) {
        if (ent.type === 'house') {
          entityManager.addEntity(new House(ent.x, ent.y));
        } else if (ent.type === 'npc') {
          entityManager.addEntity(new NPC(ent.x, ent.y, {
            name: ent.name,
            variant: ent.variant || 'tarak',
            rescueTag: ent.rescueTag || null
          }));
        } else if (ent.type === 'enemy') {
          const enemy = new Enemy(ent.x, ent.y, ent.element, ent.name, ent.archetype);
          if (ent.hasWoodenShield) {
            enemy.hasWoodenShield = true;
            enemy._initialWoodenShield = true;
            if (!enemy.tags.includes('wooden_shield')) enemy.tags.push('wooden_shield');
          }
          if (ent.noRespawn) {
            enemy.noRespawn = true;
            enemy.tags.push('no_respawn');
          }
          if (Array.isArray(ent.customTags)) {
            for (const tag of ent.customTags) {
              if (!enemy.tags.includes(tag)) enemy.tags.push(tag);
            }
          }
          entityManager.addEntity(enemy);
        }
      }
    }

    // 5. Instanciar Vegetación y Arbustos Reactivos
    if (foliageSystem && Array.isArray(levelData.foliage)) {
      for (const fol of levelData.foliage) {
        foliageSystem.addFoliage(fol.x, fol.y);
      }
    }

    // 6. Instanciar Árboles Interiores de Composición
    if (Array.isArray(levelData.clearingTrees)) {
      for (const t of levelData.clearingTrees) {
        entityManager.addEntity(new Tree(t.x, t.y));
      }
    }

    // 7. Generar Perímetro Optimizado de Bosque (fila única escalonada de alto rendimiento)
    if (levelData.perimeterConfig) {
      const step = Math.max(108, levelData.perimeterConfig.step || 108);
      const roadGap = levelData.perimeterConfig.roadGapY || [560, 700];
      const streamGapX = levelData.perimeterConfig.streamGapX || null;
      const caveSafeZone = levelData.perimeterConfig.caveSafeZone || null;

      const isInsideCaveSafeZone = (tx, ty) => {
        if (!caveSafeZone) return false;
        return (
          tx >= caveSafeZone.x &&
          tx <= caveSafeZone.x + caveSafeZone.width &&
          ty >= caveSafeZone.y &&
          ty <= caveSafeZone.y + caveSafeZone.height
        );
      };

      // Linderos Norte y Sur
      let colIdx = 0;
      for (let x = 0; x < mapWidth - 40; x += step) {
        const staggerY = (colIdx % 2) * 24;
        colIdx++;
        if (streamGapX && x + 64 > streamGapX[0] && x < streamGapX[1]) {
          continue; // No plantar árboles encima del cauce del río
        }
        if (!isInsideCaveSafeZone(x, staggerY)) {
          entityManager.addEntity(new Tree(x, staggerY));
        }
        entityManager.addEntity(new Tree(x, mapHeight - 96 - staggerY));
      }

      // Linderos Oeste y Este
      let rowIdx = 0;
      for (let y = 96; y < mapHeight - 120; y += step) {
        const staggerX = (rowIdx % 2) * 24;
        rowIdx++;
        if (levelData.perimeterConfig.hasOpenRoad && y > roadGap[0] && y < roadGap[1]) {
          continue;
        }
        if (!isInsideCaveSafeZone(staggerX, y)) {
          entityManager.addEntity(new Tree(staggerX, y));
        }
        entityManager.addEntity(new Tree(mapWidth - 96 - staggerX, y));
      }
    }

    return {
      mapWidth,
      mapHeight,
      playerSpawn: levelData.playerSpawn || { x: 224, y: 218 },
      startDormant: !!levelData.startDormant,
      arenaCenter: levelData.arenaCenter || null,
      initialObjective: levelData.initialObjective || null
    };
  }
}
