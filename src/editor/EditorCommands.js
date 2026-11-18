/**
 * @module EditorCommands
 * @description Patrón Command centralizado para todas las mutaciones sobre el borrador de Zona.
 * Garantiza que cada operación (agregar, eliminar, mover, editar campos del inspector,
 * editar metadatos del nivel o redimensionar) quede registrada con referencias directas en `EditorHistory`.
 * @author Be a Legend Team
 * @version 1.0.0
 */

export class EditorCommands {
  /**
   * @param {import('./LevelEditor.js').LevelEditor} editor
   */
  constructor(editor) {
    this.editor = editor;
  }

  /**
   * Añade un elemento a una colección del borrador y registra `item_add`.
   * @param {string} collection - Nombre del arreglo en `draft`
   * @param {Object} item
   */
  addItem(collection, item) {
    const list = this.editor.draft[collection];
    if (!Array.isArray(list) || !item) return;
    list.push(item);
    this.editor.history.push({ type: 'item_add', collection, item });
    this.editor.markDirty();
  }

  /**
   * Elimina un elemento de una colección del borrador por referencia y registra `item_remove`.
   * @param {string} collection
   * @param {Object} item
   * @returns {boolean}
   */
  removeItem(collection, item) {
    const list = this.editor.draft[collection];
    if (!Array.isArray(list) || !item) return false;
    const index = list.indexOf(item);
    if (index < 0) return false;

    list.splice(index, 1);
    this.editor.history.push({ type: 'item_remove', collection, index, item });
    this.editor.markDirty();
    return true;
  }

  /**
   * Registra el movimiento de un elemento o marcador de spawn (`playerSpawn`/`arenaCenter`).
   * @param {string} category - `'player'|'arena'|collectionName`
   * @param {Object} item
   * @param {{ x: number, y: number }} oldPos
   * @param {{ x: number, y: number }} newPos
   */
  moveItem(category, item, oldPos, newPos) {
    if (!item || !oldPos || !newPos) return;
    item.x = newPos.x;
    item.y = newPos.y;
    if (oldPos.x === newPos.x && oldPos.y === newPos.y) return;

    if (category === 'player' || category === 'arena') {
      const target = category === 'player' ? 'playerSpawn' : 'arenaCenter';
      this.editor.history.push({
        type: 'spawn_move',
        target,
        oldPos: { x: oldPos.x, y: oldPos.y },
        newPos: { x: newPos.x, y: newPos.y }
      });
      // Mantener sincronizado el spawnPoint 'default' cuando se mueve playerSpawn
      if (target === 'playerSpawn' && Array.isArray(this.editor.draft.spawnPoints)) {
        const def = this.editor.draft.spawnPoints.find(sp => sp.id === 'default');
        if (def) {
          def.x = newPos.x;
          def.y = newPos.y;
        }
      }
    } else {
      this.editor.history.push({
        type: 'item_move',
        collection: category,
        item,
        oldPos: { x: oldPos.x, y: oldPos.y },
        newPos: { x: newPos.x, y: newPos.y }
      });
    }
    this.editor.markDirty();
  }

  /**
   * Edita propiedades de un objeto en una colección registrando `item_edit` con valores previos y nuevos.
   * @param {string} category - Colección del objeto (`'props'|'entities'|'solidColliders'|...` o `'player'|'arena'`)
   * @param {Object} item
   * @param {Object} propChanges - Diccionario `{ campo: nuevoValor }`
   */
  editItem(category, item, propChanges) {
    if (!item || !propChanges || typeof propChanges !== 'object') return;

    const oldProps = {};
    const newProps = {};
    let hasChanges = false;

    for (const [key, nextVal] of Object.entries(propChanges)) {
      if (item[key] !== nextVal) {
        oldProps[key] = item[key];
        newProps[key] = nextVal;
        item[key] = nextVal;
        hasChanges = true;
      }
    }

    if (!hasChanges) return;

    if (category === 'player' || category === 'arena') {
      if (typeof newProps.x === 'number' || typeof newProps.y === 'number') {
        const target = category === 'player' ? 'playerSpawn' : 'arenaCenter';
        this.editor.history.push({
          type: 'spawn_move',
          target,
          oldPos: { x: oldProps.x ?? item.x, y: oldProps.y ?? item.y },
          newPos: { x: item.x, y: item.y }
        });
        if (target === 'playerSpawn' && Array.isArray(this.editor.draft.spawnPoints)) {
          const def = this.editor.draft.spawnPoints.find(sp => sp.id === 'default');
          if (def) {
            def.x = item.x;
            def.y = item.y;
          }
        }
      }
    } else {
      this.editor.history.push({
        type: 'item_edit',
        collection: category,
        item,
        oldProps,
        newProps
      });
    }
    this.editor.markDirty();
  }

  /**
   * Edita metadatos raíz del nivel/zona (`name`, `worldId`, `zoneId`, `biome`, `perimeterConfig`, etc.)
   * registrando `level_meta` en el historial.
   * @param {Object} propChanges
   */
  editLevelMeta(propChanges) {
    if (!propChanges || typeof propChanges !== 'object') return;
    const draft = this.editor.draft;
    const oldProps = {};
    const newProps = {};
    let hasChanges = false;

    for (const [key, nextVal] of Object.entries(propChanges)) {
      if (draft[key] !== nextVal) {
        oldProps[key] = draft[key];
        newProps[key] = nextVal;
        draft[key] = nextVal;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.editor.history.push({ type: 'level_meta', oldProps, newProps });
      this.editor.markDirty();
    }
  }
}

