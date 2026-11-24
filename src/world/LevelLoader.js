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
   * @param {import('./Tilemap.js').Tilemap} [deps.tilemap]
   * @returns {{
   *   mapWidth: number,
   *   mapHeight: number,
   *   playerSpawn: {x: number, y: number},
   *   startDormant: boolean,
   *   arenaCenter: {x: number, y: number}|null,
   *   initialObjective: string|null
   * }}
   */
  static loadLevel(levelData, { entityManager, foliageSystem = null, camera = null, physicsSystem = null, chunkManager = null, tilemap = null }) {
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
      if (typeof chunkManager.setCurrentBiome === 'function') {
        chunkManager.setCurrentBiome(level.biome);
      }
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

    // 4. Entidades Principales (Casas por bioma/oficio, NPCs con oficios/patrullas, Enemigos y Mini-Jefes)
    if (Array.isArray(levelData.entities)) {
      for (const ent of levelData.entities) {
        if (ent.type === 'house') {
          const houseCfg = {
            biome: level.biome,
            buildingType: ent.buildingType || 'cottage',
            label: ent.label || null
          };
          if (chunkManager) {
            chunkManager.registerBlueprint({
              uid: nextUid('house'),
              kind: 'house',
              x: ent.x,
              y: ent.y,
              buildingType: houseCfg.buildingType,
              label: houseCfg.label
            });
          } else {
            entityManager.addEntity(new House(ent.x, ent.y, houseCfg));
          }
        } else if (ent.type === 'npc') {
          const npcConfig = {
            name: ent.name,
            role: ent.role || null,
            biome: level.biome,
            variant: ent.variant || undefined,
            rescueTag: ent.rescueTag || null,
            worldId: level.id,
            karmaEventId: ent.karmaEventId || null,
            rewardWeapon: ent.rewardWeapon || null,
            rewardShield: ent.rewardShield,
            rewardEssence: ent.rewardEssence || 12,
            dialogues: ent.dialogues || null,
            patrolPoints: ent.patrolPoints || null,
            wanderRadius: ent.wanderRadius,
            shopTitle: ent.shopTitle || null,
            shopSubtitle: ent.shopSubtitle || null
          };
          if (chunkManager) {
            chunkManager.registerBlueprint({
              uid: ent.id || nextUid(`npc_${ent.role || ent.variant || 'npc'}`),
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
              isMiniBoss: Boolean(ent.isMiniBoss),
              hasWoodenShield: Boolean(ent.hasWoodenShield),
              hasMetalArmor: Boolean(ent.hasMetalArmor),
              noRespawn: Boolean(ent.noRespawn),
              bossId: ent.bossId || null,
              linkId: ent.linkId || null,
              worldSeal: Boolean(ent.worldSeal),
              rewardWeapon: ent.rewardWeapon || null,
              rewardShield: ent.rewardShield || null,
              scaleWithRelicTier: Boolean(ent.scaleWithRelicTier),
              canSplit: Boolean(ent.canSplit),
              customTags: ent.customTags || null
            });
          } else {
            const enemy = new Enemy(ent.x, ent.y, ent.element, ent.name, ent.archetype);
            if (ent.isMiniBoss) {
              enemy.isMiniBoss = true;
              if (!enemy.tags.includes('miniboss')) enemy.tags.push('miniboss');
            }
            if (ent.hasWoodenShield) {
              enemy.hasWoodenShield = true;
              enemy._initialWoodenShield = true;
              if (!enemy.tags.includes('wooden_shield')) enemy.tags.push('wooden_shield');
            }
            if (ent.hasMetalArmor) {
              if (typeof enemy.equipMetalArmor === 'function') {
                enemy.equipMetalArmor(!ent.hasWoodenShield);
              } else {
                enemy.hasMetalArmor = true;
                enemy._initialMetalArmor = true;
                if (!enemy.tags.includes('metal_armor')) enemy.tags.push('metal_armor');
              }
            }
            if (ent.noRespawn) {
              enemy.noRespawn = true;
              enemy.tags.push('no_respawn');
            }
            if (ent.bossId) enemy.bossId = ent.bossId;
            if (ent.linkId) enemy.linkId = ent.linkId;
            if (ent.worldSeal) enemy.worldSeal = true;
            if (ent.rewardWeapon) enemy.rewardWeapon = ent.rewardWeapon;
            if (ent.rewardShield) enemy.rewardShield = ent.rewardShield;
            if (ent.canSplit) enemy.canSplit = true;
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
          foliageSystem.addFoliage(fol.x, fol.y, { biome: level.biome });
        }
      }
    }

    // 6. Árboles Interiores de Composición
    if (Array.isArray(levelData.clearingTrees)) {
      for (let ti = 0; ti < levelData.clearingTrees.length; ti++) {
        const t = levelData.clearingTrees[ti];
        const treeCfg = { biome: level.biome, variant: ti & 1 };
        if (chunkManager) {
          chunkManager.registerBlueprint({ uid: nextUid('tree'), kind: 'tree', x: t.x, y: t.y, variant: treeCfg.variant });
        } else {
          entityManager.addEntity(new Tree(t.x, t.y, treeCfg));
        }
      }
    }

    // 7. Perímetro Optimizado de Bosque (fórmula compartida con LevelEditor vía LevelSchema; filtra acantilados/fluidos)
    const activeGrid = tilemap?.grid || physicsSystem?.tilemap?.grid || null;
    const perimeterTrees = computePerimeterTrees(level, activeGrid);
    for (let pi = 0; pi < perimeterTrees.length; pi++) {
      const pt = perimeterTrees[pi];
      const ptCfg = { biome: level.biome, variant: pi & 1 };
      if (chunkManager) {
        chunkManager.registerBlueprint({ uid: nextUid('tree'), kind: 'tree', x: pt.x, y: pt.y, variant: ptCfg.variant });
      } else {
        entityManager.addEntity(new Tree(pt.x, pt.y, ptCfg));
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
