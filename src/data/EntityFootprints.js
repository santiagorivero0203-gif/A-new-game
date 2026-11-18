/**
 * @module EntityFootprints
 * @description Fuente única de verdad para dimensiones y convención de anclaje
 * compartida entre el Motor de Juego (`Entity`, `InteractableProp`, `Tree`, `House`, `NPC`, `Enemy`)
 * y la Forja de Mundos (`LevelEditor`).
 *
 * Convención unificada:
 * - Props, estructuras, árboles, arbustos, casas, NPCs, enemigos y zonas usan `(x, y)`
 *   como esquina superior izquierda (`anchor: 'top-left'`), coincidiendo 1:1 con `Entity.pos`.
 * - Marcadores puntuales (`playerSpawn`, `arenaCenter`, `lights`) usan `(x, y)`
 *   como punto central (`anchor: 'center'`).
 *
 * @author Be a Legend Team
 * @version 1.0.0
 */

import { InteractableProp } from '../entities/InteractableProp.js';

/**
 * Retorna la huella lógica (`width`, `height`, `anchor`) de un objeto del nivel.
 * @param {string} category - Colección del nivel (`'props'|'entities'|'clearingTrees'|'foliage'|'solidColliders'|'stealthZones'|'lights'|'player'|'arena'`)
 * @param {Object} [item={}] - Instancia o descriptor del elemento
 * @returns {{ width: number, height: number, anchor: 'top-left'|'center' }}
 */
export function getObjectFootprint(category, item = {}) {
  switch (category) {
    case 'player':
    case 'arena':
      return { width: 32, height: 32, anchor: 'center' };

    case 'lights':
      return { width: 24, height: 24, anchor: 'center' };

    case 'solidColliders':
    case 'stealthZones':
      return {
        width: Math.max(16, Number(item.width) || 64),
        height: Math.max(16, Number(item.height) || 64),
        anchor: 'top-left'
      };

    case 'props': {
      const dims = InteractableProp._getDimensions(item.propType || 'cliff_rock', item);
      return { width: dims.w, height: dims.h, anchor: 'top-left' };
    }

    case 'clearingTrees':
      // Coincide con Tree (super(x, y, 84, 98))
      return { width: 84, height: 98, anchor: 'top-left' };

    case 'foliage':
      // Coincide con FoliageProp (super(x, y, 48, 44))
      return { width: 48, height: 44, anchor: 'top-left' };

    case 'entities': {
      if (item.type === 'house') {
        // Coincide con House (super(x, y, 160, 144))
        return { width: 160, height: 144, anchor: 'top-left' };
      }
      if (item.type === 'npc') {
        // Coincide con NPC (super(x, y, 32, 32))
        return { width: 32, height: 32, anchor: 'top-left' };
      }
      // Coincide con Enemy (super(x, y, 32, 32))
      return { width: 32, height: 32, anchor: 'top-left' };
    }

    default:
      return {
        width: Math.max(16, Number(item.width) || 32),
        height: Math.max(16, Number(item.height) || 32),
        anchor: 'top-left'
      };
  }
}

/**
 * Calcula la caja delimitadora top-left y el centro geométrico de un objeto del nivel.
 * @param {string} category
 * @param {Object} item
 * @returns {{ x: number, y: number, width: number, height: number, cx: number, cy: number, anchor: 'top-left'|'center' }}
 */
export function getObjectBounds(category, item = {}) {
  const fp = getObjectFootprint(category, item);
  const rawX = Number(item?.x) || 0;
  const rawY = Number(item?.y) || 0;

  if (fp.anchor === 'center') {
    const x = rawX - fp.width / 2;
    const y = rawY - fp.height / 2;
    return {
      x,
      y,
      width: fp.width,
      height: fp.height,
      cx: rawX,
      cy: rawY,
      anchor: fp.anchor
    };
  }

  return {
    x: rawX,
    y: rawY,
    width: fp.width,
    height: fp.height,
    cx: rawX + fp.width / 2,
    cy: rawY + fp.height / 2,
    anchor: fp.anchor
  };
}

