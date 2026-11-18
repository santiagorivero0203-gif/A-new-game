import { Entity } from '../entities/Entity.js';
import { Tree } from '../entities/Tree.js';
import { House } from '../entities/House.js';
import { NPC } from '../entities/NPC.js';
import { Enemy } from '../entities/Enemy.js';
import { InteractableProp } from '../entities/InteractableProp.js';
import { normalizeLevel, computePerimeterTrees } from '../data/LevelSchema.js';

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
   * Carga e instancia o registra en chunks espaciales todas las entidades y configuraciones de un nivel.
   * Cuando se provee `chunkManager`, registra planos ligeros en RAM y únicamente materializa
   * el chunk inicial alrededor del jugador/cámara; en modo directo instancia todo el mapa.
   * @param {Object} levelData - Esquema JSON del nivel
   * @param {Object} deps - Contenedor de sistemas dependientes
   * @param {import('../entities/EntityManager.js').EntityManager} deps.entityManager
   * @param {import('./FoliageSystem.js').FoliageSystem} [deps.foliageSystem]
   * @param {import('../render/Camera.js').Camera} [deps.camera]
   * @param {import('../systems/PhysicsSystem.js').PhysicsSystem} [deps.physicsSystem]
   * @param {import('./ChunkManager.js').ChunkManager} [deps.chunkManager]
   * @returns {{
   *   mapWidth: number,
   *   mapHeight: number,
   *   playerSpawn: {x: number, y: number},
   *   startDormant: boolean,
   *   arenaCenter: {x: number, y: number}|null,
   *   initialObjective: string|null
   * }}
   */
  static loadLevel(levelData, { entityManager, foliageSystem = null, camera = null, physicsSystem = null, chunkManager = null }) {
    if (!levelData || !entityManager) {
      throw new Error('[LevelLoader] levelData y entityManager son requeridos.');
    }

    const level = normalizeLevel(levelData);
    const { cols, rows, tileSize, playerSpawn } = level;
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

    if (chunkManager) {
      chunkManager.clearAll();
    }

    // 2. Instanciar Colisionadores Fluviales / Barrancos Invisibles (pocas franjas anchas compartidas)
    if (level.solidColliders.length > 0) {
      for (const col of level.solidColliders) {
        entityManager.addEntity(new InvisibleBarrier(col.x, col.y, col.width, col.height));
      }
    }

    let uidCounter = 0;
    const nextUid = (prefix) => `${prefix}_${uidCounter++}`;

    // 3. Props Interactivos, Puertas Elementales y Arquitectura
    if (Array.isArray(levelData.props)) {
      for (const propCfg of levelData.props) {
        if (chunkManager) {
          chunkManager.registerBlueprint({
            uid: propCfg.id || nextUid(`prop_${propCfg.propType}`),
            kind: 'prop',
            propType: InteractableProp._normalizePropType(propCfg.propType),
            x: propCfg.x,
            y: propCfg.y,
            propConfig: propCfg
          });
        } else {
          entityManager.addEntity(new InteractableProp(propCfg));
        }
      }
    }

    // 4. Entidades Principales (Casas, NPCs con variantes, Enemigos tácticos)
    if (Array.isArray(levelData.entities)) {
      for (const ent of levelData.entities) {
        if (ent.type === 'house') {
          if (chunkManager) {
            chunkManager.registerBlueprint({ uid: nextUid('house'), kind: 'house', x: ent.x, y: ent.y });
          } else {
            entityManager.addEntity(new House(ent.x, ent.y));
          }
        } else if (ent.type === 'npc') {
          const npcConfig = {
            name: ent.name,
            variant: ent.variant || 'tarak',
            rescueTag: ent.rescueTag || null
          };
          if (chunkManager) {
            chunkManager.registerBlueprint({
              uid: nextUid(`npc_${npcConfig.variant}`),
              kind: 'npc',
              x: ent.x,
              y: ent.y,
              npcConfig
            });
          } else {
            entityManager.addEntity(new NPC(ent.x, ent.y, npcConfig));
          }
        } else if (ent.type === 'enemy') {
          if (chunkManager) {
            chunkManager.registerBlueprint({
              uid: ent.id || nextUid(`enemy_${ent.archetype || 'mob'}`),
              kind: 'enemy',
              x: ent.x,
              y: ent.y,
              element: ent.element,
              name: ent.name,
              archetype: ent.archetype,
              hasWoodenShield: Boolean(ent.hasWoodenShield),
              noRespawn: Boolean(ent.noRespawn),
              customTags: ent.customTags || null
            });
          } else {
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
    }

    // 5. Vegetación y Arbustos Reactivos
    if (Array.isArray(levelData.foliage)) {
      for (const fol of levelData.foliage) {
        if (chunkManager) {
          chunkManager.registerBlueprint({ uid: nextUid('foliage'), kind: 'foliage', x: fol.x, y: fol.y });
        } else if (foliageSystem) {
          foliageSystem.addFoliage(fol.x, fol.y);
        }
      }
    }

    // 6. Árboles Interiores de Composición
    if (Array.isArray(levelData.clearingTrees)) {
      for (const t of levelData.clearingTrees) {
        if (chunkManager) {
          chunkManager.registerBlueprint({ uid: nextUid('tree'), kind: 'tree', x: t.x, y: t.y });
        } else {
          entityManager.addEntity(new Tree(t.x, t.y));
        }
      }
    }

    // 7. Perímetro Optimizado de Bosque (fórmula compartida con LevelEditor vía LevelSchema)
    const perimeterTrees = computePerimeterTrees(level);
    for (const pt of perimeterTrees) {
      if (chunkManager) {
        chunkManager.registerBlueprint({ uid: nextUid('tree'), kind: 'tree', x: pt.x, y: pt.y });
      } else {
        entityManager.addEntity(new Tree(pt.x, pt.y));
      }
    }

    // Montar únicamente los chunks próximos al punto de inicio si hay ChunkManager
    if (chunkManager) {
      chunkManager.update(playerSpawn, 0, true);
    }

    return {
      mapWidth,
      mapHeight,
      playerSpawn,
      spawnPoints: level.spawnPoints,
      startDormant: level.startDormant,
      arenaCenter: levelData.arenaCenter === null ? null : level.arenaCenter,
      initialObjective: level.initialObjective || null
    };
  }
}
