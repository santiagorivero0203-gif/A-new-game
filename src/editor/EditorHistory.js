/**
 * @module EditorHistory
 * @description Pila de Deshacer / Rehacer (Undo / Redo) basada en deltas mínimos y referencias
 * a objetos para la Forja de Mundos.
 * Almacena cambios atómicos sin clonar objetos pesados innecesariamente y resuelve los elementos
 * por referencia directa en lugar de depender de índices que pueden desplazarse tras borrados.
 * @author Be a Legend Team
 * @version 2.0.0
 */

export class EditorHistory {
  /**
   * @param {number} [maxSteps=50] - Límite de acciones memorizadas para evitar consumo de RAM
   */
  constructor(maxSteps = 50) {
    this.maxSteps = maxSteps;
    /** @type {Array<Object>} Pila de acciones para deshacer */
    this.undoStack = [];
    /** @type {Array<Object>} Pila de acciones para rehacer */
    this.redoStack = [];
  }

  /**
   * Registra una nueva acción atómica en el historial y descarta la pila de rehacer.
   * @param {Object} action - Descriptor del cambio
   */
  push(action) {
    if (!action || !action.type) return;

    if (action.type === 'tile_stroke' && (!Array.isArray(action.deltas) || action.deltas.length === 0)) {
      return;
    }

    this.undoStack.push(action);
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  /**
   * Resuelve un elemento dentro de una colección por referencia directa (o índice como respaldo).
   * @param {Array} list
   * @param {Object} action
   * @returns {Object|null}
   * @private
   */
  _resolveItem(list, action) {
    if (!Array.isArray(list)) return null;
    if (action.item) {
      const idx = list.indexOf(action.item);
      if (idx >= 0) return list[idx];
    }
    if (typeof action.index === 'number' && list[action.index]) {
      return list[action.index];
    }
    return null;
  }

  /**
   * Deshace la última acción aplicando la inversa en `draft` y refrescando `tilemap`.
   * @param {Object} draft - Borrador actual del nivel/zona
   * @param {import('../world/Tilemap.js').Tilemap|null} [tilemap=null]
   * @param {Function|null} [onResizeRebuild=null] - Callback `(cols, rows, grid) => void` para restaurar Tilemap tras resize
   * @returns {boolean} True si se aplicó un cambio
   */
  undo(draft, tilemap = null, onResizeRebuild = null) {
    if (this.undoStack.length === 0) return false;
    const action = this.undoStack.pop();

    switch (action.type) {
      case 'tile_stroke': {
        for (let i = action.deltas.length - 1; i >= 0; i--) {
          const { col, row, oldId } = action.deltas[i];
          if (tilemap && typeof tilemap.setTileAndInvalidate === 'function') {
            tilemap.setTileAndInvalidate(col, row, oldId);
          }
          if (draft.terrainGrid && draft.terrainGrid[row]) {
            draft.terrainGrid[row][col] = oldId;
          }
        }
        break;
      }

      case 'item_add': {
        const list = draft[action.collection];
        if (Array.isArray(list)) {
          const idx = action.item ? list.indexOf(action.item) : -1;
          if (idx >= 0) {
            list.splice(idx, 1);
          } else {
            list.pop();
          }
        }
        break;
      }

      case 'item_remove': {
        const list = draft[action.collection];
        if (Array.isArray(list) && action.item) {
          const targetIdx = typeof action.index === 'number'
            ? Math.max(0, Math.min(list.length, action.index))
            : list.length;
          list.splice(targetIdx, 0, action.item);
        }
        break;
      }

      case 'item_move': {
        const list = draft[action.collection];
        const item = this._resolveItem(list, action);
        if (item && action.oldPos) {
          item.x = action.oldPos.x;
          item.y = action.oldPos.y;
        }
        break;
      }

      case 'item_edit': {
        const list = draft[action.collection];
        const item = this._resolveItem(list, action);
        if (item && action.oldProps) {
          Object.assign(item, action.oldProps);
        }
        break;
      }

      case 'spawn_move': {
        if (action.target && draft[action.target] && action.oldPos) {
          draft[action.target].x = action.oldPos.x;
          draft[action.target].y = action.oldPos.y;
        }
        break;
      }

      case 'level_meta': {
        if (action.oldProps) {
          Object.assign(draft, action.oldProps);
        }
        break;
      }

      case 'level_resize': {
        draft.cols = action.oldCols;
        draft.rows = action.oldRows;
        draft.terrainGrid = action.oldGrid.map(row => row.slice());
        if (typeof onResizeRebuild === 'function') {
          onResizeRebuild(draft.cols, draft.rows, draft.terrainGrid);
        }
        break;
      }

      default:
        console.warn('[EditorHistory] Acción desconocida en undo:', action.type);
        break;
    }

    this.redoStack.push(action);
    return true;
  }

  /**
   * Rehace la última acción deshecha.
   * @param {Object} draft - Borrador actual del nivel/zona
   * @param {import('../world/Tilemap.js').Tilemap|null} [tilemap=null]
   * @param {Function|null} [onResizeRebuild=null] - Callback `(cols, rows, grid) => void`
   * @returns {boolean} True si se aplicó un cambio
   */
  redo(draft, tilemap = null, onResizeRebuild = null) {
    if (this.redoStack.length === 0) return false;
    const action = this.redoStack.pop();

    switch (action.type) {
      case 'tile_stroke': {
        for (let i = 0; i < action.deltas.length; i++) {
          const { col, row, newId } = action.deltas[i];
          if (tilemap && typeof tilemap.setTileAndInvalidate === 'function') {
            tilemap.setTileAndInvalidate(col, row, newId);
          }
          if (draft.terrainGrid && draft.terrainGrid[row]) {
            draft.terrainGrid[row][col] = newId;
          }
        }
        break;
      }

      case 'item_add': {
        const list = draft[action.collection];
        if (Array.isArray(list) && action.item) {
          list.push(action.item);
        }
        break;
      }

      case 'item_remove': {
        const list = draft[action.collection];
        if (Array.isArray(list)) {
          const idx = action.item ? list.indexOf(action.item) : -1;
          if (idx >= 0) {
            list.splice(idx, 1);
          } else if (typeof action.index === 'number' && idx < 0 && action.index < list.length) {
            list.splice(action.index, 1);
          }
        }
        break;
      }

      case 'item_move': {
        const list = draft[action.collection];
        const item = this._resolveItem(list, action);
        if (item && action.newPos) {
          item.x = action.newPos.x;
          item.y = action.newPos.y;
        }
        break;
      }

      case 'item_edit': {
        const list = draft[action.collection];
        const item = this._resolveItem(list, action);
        if (item && action.newProps) {
          Object.assign(item, action.newProps);
        }
        break;
      }

      case 'spawn_move': {
        if (action.target && draft[action.target] && action.newPos) {
          draft[action.target].x = action.newPos.x;
          draft[action.target].y = action.newPos.y;
        }
        break;
      }

      case 'level_meta': {
        if (action.newProps) {
          Object.assign(draft, action.newProps);
        }
        break;
      }

      case 'level_resize': {
        draft.cols = action.newCols;
        draft.rows = action.newRows;
        draft.terrainGrid = action.newGrid.map(row => row.slice());
        if (typeof onResizeRebuild === 'function') {
          onResizeRebuild(draft.cols, draft.rows, draft.terrainGrid);
        }
        break;
      }

      default:
        console.warn('[EditorHistory] Acción desconocida en redo:', action.type);
        break;
    }

    this.undoStack.push(action);
    return true;
  }

  /**
   * Consulta si hay acciones para deshacer.
   * @returns {boolean}
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Consulta si hay acciones para rehacer.
   * @returns {boolean}
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Vacía las pilas de historial.
   */
  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
