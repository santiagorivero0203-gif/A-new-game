/**
 * @module EditorRenderer
 * @description Motor de renderizado bajo demanda para el lienzo de la Forja de Mundos.
 * Dibuja con paridad exacta al motor de juego (`Tilemap`, `CelSpriteAtlas`, `ProceduralAssets`,
 * `EntityFootprints` y `computePerimeterTrees`), incluyendo previsualización de brochas,
 * selección top-left y asas de redimensionado para zonas AABB.
 * @author Be a Legend Team
 * @version 1.0.0
 */

import { CelSpriteAtlas } from '../render/CelSpriteAtlas.js';
import { ProceduralAssets } from '../core/ProceduralAssets.js';
import { computePerimeterTrees } from '../data/LevelSchema.js';
import { getObjectBounds } from '../data/EntityFootprints.js';
import { InteractableProp } from '../entities/InteractableProp.js';

/** Tamaño en píxeles de mundo del asa de redimensionado (esquina inferior derecha) */
export const RESIZE_HANDLE_WORLD_SIZE = 12;

/**
 * Mapa declarativo de fábricas de sprite por `propType` normalizado.
 * Evita condicionales `switch` y facilita registrar nuevos props visuales.
 */
const PROP_SPRITE_FACTORIES = {
  cave_mouth: () => CelSpriteAtlas.getCaveMouthSprite(),
  cliff_rock: () => CelSpriteAtlas.getCliffRockSprite(false),
  crystal_rock: () => CelSpriteAtlas.getCliffRockSprite(true),
  cracked_rock: () => CelSpriteAtlas.getCrackedRockSprite(false),
  burnable_vines: () => CelSpriteAtlas.getBurnableVinesSprite('idle'),
  broken_statue: (prop) => CelSpriteAtlas.getBrokenStatueSprite(prop.biomeTint || 'forest'),
  rusted_greatsword: () => CelSpriteAtlas.getRustedGreatswordSprite(),
  runic_obelisk: (prop) => CelSpriteAtlas.getRunicObeliskSprite(true, prop.runeColor || '#38bdf8'),
  world_portal: (prop) => CelSpriteAtlas.getWorldPortalSprite(prop.portalColor || '#2dd4bf'),
  starter_sword: () => CelSpriteAtlas.getStarterSwordStoneSprite(),
  relic_pedestal: () => CelSpriteAtlas.getOrBake('editor_prop_relic_pedestal', 56, 68, (ctx) => {
    CelSpriteAtlas._inkEllipse(ctx, 28, 52, 22, 8, '#334155', '#050811', 1);
    CelSpriteAtlas._inkRoundRect(ctx, 14, 24, 28, 28, 4, '#475569', '#050811', 1);
    CelSpriteAtlas._inkEllipse(ctx, 28, 14, 9, 9, '#f97316', '#050811', 1);
  }),
  sanctuary_altar: () => CelSpriteAtlas.getOrBake('editor_prop_sanctuary_altar', 76, 102, (ctx) => {
    CelSpriteAtlas._inkEllipse(ctx, 38, 86, 30, 9, '#475569', '#050811', 1);
    CelSpriteAtlas._inkRoundRect(ctx, 22, 16, 32, 69, 6, '#64748b', '#050811', 1);
    CelSpriteAtlas._inkEllipse(ctx, 38, 22, 15, 11, '#1d5c38', '#050811', 1);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(33, 40, 3, 32);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(41, 40, 3, 32);
  }),
  horde_totem: () => CelSpriteAtlas.getOrBake('editor_prop_horde_totem', 56, 78, (ctx) => {
    CelSpriteAtlas._inkRoundRect(ctx, 15, 18, 26, 48, 4, '#1e293b', '#050811', 1);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(22, 28, 12, 12);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(24, 30, 8, 8);
  })
};

export class EditorRenderer {
  constructor() {
    this._cachedPerimeterKey = '';
    this._cachedPerimeterTrees = [];
  }

  /**
   * Obtiene los árboles perimetrales cacheados mientras no cambie la configuración geométrica.
   * @param {Object} draft
   * @returns {Array<{ x: number, y: number }>}
   * @private
   */
  _getPerimeterTrees(draft) {
    const key = `${draft.cols}|${draft.rows}|${draft.tileSize}|${JSON.stringify(draft.perimeterConfig || null)}`;
    if (key !== this._cachedPerimeterKey) {
      this._cachedPerimeterKey = key;
      this._cachedPerimeterTrees = computePerimeterTrees(draft);
    }
    return this._cachedPerimeterTrees;
  }

  /**
   * Renderiza un fotograma completo del lienzo del editor bajo demanda.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} state - Estado visual procedente de `LevelEditor`
   */
  render(ctx, state) {
    if (!ctx || !state) return;

    const {
      canvas,
      dpr,
      viewport,
      tilemap,
      draft,
      showGrid,
      selectedObject,
      currentCategory,
      currentTool,
      isDrawingTerrain,
      rectStartTile,
      pointerWorldPos,
      onAsyncAssetLoaded
    } = state;

    this._onAsyncAssetLoaded = onAsyncAssetLoaded || null;

    const width = canvas.width;
    const height = canvas.height;
    const cssW = width / (dpr || 1);
    const cssH = height / (dpr || 1);
    const zoom = viewport.zoom;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Centrar en pantalla física y aplicar Zoom, DPR y Cámara
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom * dpr, zoom * dpr);
    ctx.translate(-viewport.cameraX, -viewport.cameraY);

    const ts = draft.tileSize || 32;
    const mapW = draft.cols * ts;
    const mapH = draft.rows * ts;

    // 1. Terreno auténtico mediante Tilemap
    const editorCamera = {
      getVisibleWorldBounds: (margin = 0) => viewport.getVisibleWorldBounds(cssW, cssH, margin)
    };
    tilemap.render(ctx, editorCamera);

    // 2. Colisionadores Sólidos (Top-Left)
    for (const col of draft.solidColliders) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
      ctx.fillRect(col.x, col.y, col.width, col.height);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5 / zoom;
      ctx.strokeRect(col.x, col.y, col.width, col.height);
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('SÓLIDO', col.x + 4, col.y + 12);
    }

    // 3. Zonas de Sigilo (Top-Left)
    for (const zone of draft.stealthZones) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5 / zoom;
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('SIGILO', zone.x + 4, zone.y + 12);
    }

    // 4. Luces Dinámicas (Center)
    for (const light of draft.lights) {
      const grad = ctx.createRadialGradient(light.x, light.y, 4, light.x, light.y, light.radius);
      grad.addColorStop(0, light.color || '#facc15');
      grad.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.40;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = light.color || '#facc15';
      ctx.beginPath();
      ctx.arc(light.x, light.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#050811';
      ctx.lineWidth = 1.5 / zoom;
      ctx.stroke();
    }

    // 5. Árboles del Perímetro Automático (atenuados para distinguir de los manuales)
    const treeSprite = ProceduralAssets.getSharedCanvas('tree_sprite');
    const perimeterTrees = this._getPerimeterTrees(draft);
    if (perimeterTrees.length > 0 && treeSprite) {
      ctx.save();
      ctx.globalAlpha = 0.48;
      for (const pt of perimeterTrees) {
        ctx.drawImage(treeSprite, pt.x, pt.y, 84, 98);
      }
      ctx.restore();
    }

    // 6. Estructuras manuales (Árboles 84x98 y Arbustos 48x44 en coordenadas top-left del motor)
    for (const t of draft.clearingTrees) {
      if (treeSprite) ctx.drawImage(treeSprite, t.x, t.y, 84, 98);
    }
    const bushSprite = ProceduralAssets.getSharedCanvas('bush_sprite');
    for (const f of draft.foliage) {
      if (bushSprite) ctx.drawImage(bushSprite, f.x, f.y, 48, 44);
    }

    // 7. Props Interactivos (Top-Left idéntico a InteractableProp)
    for (const prop of draft.props) {
      this._renderProp(ctx, prop);
    }

    // 8. Entidades (Casas 160x144, NPCs 32x32 con offset cel, Enemigos 32x32 con offset cel)
    for (const ent of draft.entities) {
      this._renderEntity(ctx, ent);
    }

    // 9. Marcadores de Spawn de Santi, Entradas de Zona y Centro de Arena
    this._renderActorSpawns(ctx, draft, zoom);

    // 10. Cuadrícula de losetas
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.0 / zoom;
      ctx.beginPath();
      for (let x = 0; x <= mapW; x += ts) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mapH);
      }
      for (let y = 0; y <= mapH; y += ts) {
        ctx.moveTo(0, y);
        ctx.lineTo(mapW, y);
      }
      ctx.stroke();
    }

    // 11. Borde dorado de límites del mapa
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5 / zoom;
    ctx.strokeRect(0, 0, mapW, mapH);

    // 12. Cuadro de Selección unificado + Asa de redimensionado para zonas AABB
    if (selectedObject) {
      const bounds = getObjectBounds(selectedObject.category, selectedObject.item);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4);
      ctx.setLineDash([]);

      const isResizableCustomProp = selectedObject.category === 'props' && selectedObject.item.propType === 'custom_env_prop';
      if (selectedObject.category === 'solidColliders' || selectedObject.category === 'stealthZones' || isResizableCustomProp) {
        const hs = RESIZE_HANDLE_WORLD_SIZE / Math.max(0.6, Math.min(1.5, zoom));
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#050811';
        ctx.lineWidth = 1.5 / zoom;
        ctx.fillRect(bounds.x + bounds.width - hs / 2, bounds.y + bounds.height - hs / 2, hs, hs);
        ctx.strokeRect(bounds.x + bounds.width - hs / 2, bounds.y + bounds.height - hs / 2, hs, hs);
      }
    }

    // 13. Previsualización de cursor de terreno y herramienta Rectángulo
    if (currentCategory === 'terrain' && pointerWorldPos && currentTool !== 'pan') {
      const hoverCol = Math.floor(pointerWorldPos.x / ts);
      const hoverRow = Math.floor(pointerWorldPos.y / ts);
      if (isDrawingTerrain && currentTool === 'rect' && rectStartTile) {
        const minC = Math.max(0, Math.min(rectStartTile.col, hoverCol));
        const maxC = Math.min(draft.cols - 1, Math.max(rectStartTile.col, hoverCol));
        const minR = Math.max(0, Math.min(rectStartTile.row, hoverRow));
        const maxR = Math.min(draft.rows - 1, Math.max(rectStartTile.row, hoverRow));
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2 / zoom;
        ctx.fillRect(minC * ts, minR * ts, (maxC - minC + 1) * ts, (maxR - minR + 1) * ts);
        ctx.strokeRect(minC * ts, minR * ts, (maxC - minC + 1) * ts, (maxR - minR + 1) * ts);
      } else if (hoverCol >= 0 && hoverCol < draft.cols && hoverRow >= 0 && hoverRow < draft.rows) {
        const radius = currentTool === 'brush3' ? 1 : 0;
        const startC = Math.max(0, hoverCol - radius);
        const endC = Math.min(draft.cols - 1, hoverCol + radius);
        const startR = Math.max(0, hoverRow - radius);
        const endR = Math.min(draft.rows - 1, hoverRow + radius);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.lineWidth = 1.8 / zoom;
        ctx.strokeRect(startC * ts, startR * ts, (endC - startC + 1) * ts, (endR - startR + 1) * ts);
      }
    }

    ctx.restore();
  }

  /**
   * Dibuja un prop individual en su esquina superior izquierda `(prop.x, prop.y)`.
   * @private
   */
  _renderProp(ctx, prop) {
    const normalizedType = InteractableProp._normalizePropType(prop.propType);
    const dims = InteractableProp._getDimensions(normalizedType, prop);

    if (normalizedType === 'custom_env_prop') {
      const customImg = CelSpriteAtlas.getCustomTextureImage(prop.textureUrl, this._onAsyncAssetLoaded);
      const tint = prop.tintColor || '#a855f7';
      if (customImg) {
        ctx.drawImage(customImg, prop.x, prop.y, dims.w, dims.h);
      } else {
        const placeholder = CelSpriteAtlas.getCustomPropPlaceholderSprite(dims.w, dims.h, tint);
        if (placeholder) ctx.drawImage(placeholder, prop.x, prop.y, dims.w, dims.h);
      }

      ctx.save();
      ctx.strokeStyle = tint;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(prop.x, prop.y, dims.w, dims.h);
      ctx.restore();

      const hasDesc = Boolean(prop.devDescription && prop.devDescription.trim());
      const customLabel = `${hasDesc ? '📋 ' : ''}${prop.label || prop.customKey || 'Objeto'}`;
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(customLabel, prop.x + dims.w / 2, prop.y - 6);
      return;
    }

    const factory = PROP_SPRITE_FACTORIES[normalizedType];
    const sprite = typeof factory === 'function' ? factory(prop) : null;

    if (sprite) {
      ctx.drawImage(sprite, prop.x, prop.y);
      if (normalizedType === 'starter_sword') {
        const blade = CelSpriteAtlas.getStarterSwordBladeSprite();
        if (blade) ctx.drawImage(blade, prop.x, prop.y);
      }
    } else {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(prop.x, prop.y, dims.w, dims.h);
      ctx.strokeStyle = '#050811';
      ctx.strokeRect(prop.x, prop.y, dims.w, dims.h);
    }

    const label = prop.worldLabel || prop.label || prop.loreTitle;
    if (label) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, prop.x + dims.w / 2, prop.y - 6);
    }
  }

  /**
   * Dibuja una entidad en coordenadas top-left coherentes con `House`, `NPC` y `Enemy`.
   * @private
   */
  _renderEntity(ctx, ent) {
    const { type, x, y } = ent;
    if (type === 'house') {
      const houseSprite = ProceduralAssets.getSharedCanvas('house_sprite');
      if (houseSprite) ctx.drawImage(houseSprite, x, y, 160, 144);
    } else if (type === 'npc') {
      const sprite = CelSpriteAtlas.getNPCSprite(ent.variant || 'tarak');
      if (sprite) ctx.drawImage(sprite, x - 4, y - 9);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ent.name || 'NPC', x + 16, y - 12);
    } else if (type === 'enemy') {
      const sprite = CelSpriteAtlas.getEnemySprite(ent.archetype || 'hound', ent.element || 'plantas', false);
      if (sprite) ctx.drawImage(sprite, x - 6, y - 8);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ent.name || ent.archetype || 'Enemigo', x + 16, y - 12);
    }
  }

  /**
   * Dibuja los marcadores de spawn de Santi, entradas adicionales de zona y centro de arena.
   * @private
   */
  _renderActorSpawns(ctx, draft, zoom) {
    const p = draft.playerSpawn;
    if (p) {
      const santiSprite = CelSpriteAtlas.getSantiSprite('down', 0, '#38bdf8', true);
      if (santiSprite) ctx.drawImage(santiSprite, p.x - 20, p.y - 28);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8 / zoom;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('INICIO SANTI', p.x, p.y + 26);
    }

    // Puntos de entrada secundarios de zona (para conexiones entre portales)
    if (Array.isArray(draft.spawnPoints)) {
      for (const sp of draft.spawnPoints) {
        if (sp.id === 'default') continue;
        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = 1.6 / zoom;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#2dd4bf';
        ctx.font = 'bold 9px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`ENTRADA: ${sp.id}`, sp.x, sp.y - 16);
      }
    }

    const a = draft.arenaCenter;
    if (a) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.8 / zoom;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 18, 0, Math.PI * 2);
      ctx.moveTo(a.x - 24, a.y);
      ctx.lineTo(a.x + 24, a.y);
      ctx.moveTo(a.x, a.y - 24);
      ctx.lineTo(a.x, a.y + 24);
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CENTRO DE ARENA', a.x, a.y + 30);
    }
  }
}

