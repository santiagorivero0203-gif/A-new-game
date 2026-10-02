import { Tree } from '../entities/Tree.js';
import { House } from '../entities/House.js';
import { NPC } from '../entities/NPC.js';
import { Enemy } from '../entities/Enemy.js';

/**
 * @module LevelLoader
 * @description Cargador data-driven de niveles y zonas para 'Be a Legend'.
 * Lee esquemas JSON estructurados para instanciar el mapa, colisiones perimetrales,
 * follaje reactivo, NPCs y distribución de enemigos sin código acoplado en main.js.
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class LevelLoader {
  /**
   * Carga e instancia todas las entidades y configuraciones espaciales de un nivel.
   * @param {Object} levelData - Esquema JSON del nivel
   * @param {Object} deps - Contenedor de sistemas dependientes
   * @param {import('../entities/EntityManager.js').EntityManager} deps.entityManager
   * @param {import('./FoliageSystem.js').FoliageSystem} [deps.foliageSystem]
   * @param {import('../render/Camera.js').Camera} [deps.camera]
   * @returns {{ mapWidth: number, mapHeight: number, playerSpawn: {x: number, y: number} }}
   */
  static loadLevel(levelData, { entityManager, foliageSystem = null, camera = null }) {
    if (!levelData || !entityManager) {
      throw new Error('[LevelLoader] levelData y entityManager son requeridos.');
    }

    const { cols = 40, rows = 40, tileSize = 32 } = levelData.map || {};
    const mapWidth = cols * tileSize;
    const mapHeight = rows * tileSize;

    // 1. Ajustar límites de cámara (Room Clamping)
    if (camera) {
      camera.setRoomBounds({ x: 0, y: 0, width: mapWidth, height: mapHeight });
    }

    // 2. Instanciar Entidades Principales
    if (Array.isArray(levelData.entities)) {
      for (const ent of levelData.entities) {
        if (ent.type === 'house') {
          entityManager.addEntity(new House(ent.x, ent.y));
        } else if (ent.type === 'npc') {
          entityManager.addEntity(new NPC(ent.x, ent.y, ent.name));
        } else if (ent.type === 'enemy') {
          entityManager.addEntity(new Enemy(ent.x, ent.y, ent.element, ent.name));
        }
      }
    }

    // 3. Instanciar Vegetación y Arbustos Físicos
    if (foliageSystem && Array.isArray(levelData.foliage)) {
      for (const fol of levelData.foliage) {
        foliageSystem.addFoliage(fol.x, fol.y);
      }
    }

    // 4. Instanciar Árboles en el Claro
    if (Array.isArray(levelData.clearingTrees)) {
      for (const t of levelData.clearingTrees) {
        entityManager.addEntity(new Tree(t.x, t.y));
      }
    }

    // 5. Generar Perímetro Denso de Bosque
    if (levelData.perimeterConfig) {
      const step = levelData.perimeterConfig.step || 75;
      const roadGap = levelData.perimeterConfig.roadGapY || [560, 700];

      // Linderos Norte y Sur
      for (let x = 0; x < mapWidth; x += step) {
        entityManager.addEntity(new Tree(x, 0));
        entityManager.addEntity(new Tree(x + 35, 60));
        entityManager.addEntity(new Tree(x, mapHeight - 110));
        entityManager.addEntity(new Tree(x + 35, mapHeight - 70));
      }

      // Linderos Este y Oeste con sendero transitable
      for (let y = 100; y < mapHeight - 120; y += step) {
        if (levelData.perimeterConfig.hasOpenRoad && y > roadGap[0] && y < roadGap[1]) {
          continue; // Dejar abierto el camino central de tierra
        }
        entityManager.addEntity(new Tree(0, y));
        entityManager.addEntity(new Tree(55, y + 35));
        entityManager.addEntity(new Tree(mapWidth - 85, y));
        entityManager.addEntity(new Tree(mapWidth - 140, y + 35));
      }
    }

    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log(`[LevelLoader] Nivel cargado con éxito: ${levelData.name} (${mapWidth}x${mapHeight}px)`);
    }

    return {
      mapWidth,
      mapHeight,
      playerSpawn: levelData.playerSpawn || { x: 624, y: 624 }
    };
  }
}
