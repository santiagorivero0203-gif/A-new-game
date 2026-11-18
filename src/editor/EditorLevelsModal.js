/**
 * @module EditorLevelsModal
 * @description Modal Gestor de Mundos y Zonas para la Forja de Mundos.
 * Permite crear nuevas zonas asignadas a un Mundo Padre (`worldId`), redimensionar
 * la zona actual, abrir/eliminar zonas guardadas agrupadas por mundo y clonar
 * plantillas de los mundos oficiales.
 * @author Be a Legend Team
 * @version 1.0.0
 */

import { WORLDS_CATALOG, WORLDS_LIST, loadWorldData } from '../data/worlds.js';
import { createBlankLevel } from '../data/LevelSchema.js';
import { BIOME_OPTIONS } from './EditorCatalog.js';
import { levelRepository } from './LevelRepository.js';

export class EditorLevelsModal {
  /**
   * @param {import('./LevelEditor.js').LevelEditor} editor
   * @param {HTMLElement} modalEl
   */
  constructor(editor, modalEl) {
    this.editor = editor;
    this.modalEl = modalEl;
  }

  /**
   * Cierra el modal si está abierto.
   */
  close() {
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
  }

  /**
   * Consulta si el modal está visible.
   * @returns {boolean}
   */
  isOpen() {
    return Boolean(this.modalEl && !this.modalEl.classList.contains('hidden'));
  }

  /**
   * Abre y renderiza el gestor de zonas agrupadas por mundo.
   */
  open() {
    if (!this.modalEl) return;
    const savedZones = levelRepository.list().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const draft = this.editor.draft;

    // Agrupar zonas por Mundo Padre (worldId)
    const groupsMap = new Map();
    for (const w of WORLDS_LIST) {
      groupsMap.set(w.id, { worldMeta: w, zones: [] });
    }
    for (const z of savedZones) {
      const wId = z.worldId || z.biome || 'cave_exit_intro';
      if (!groupsMap.has(wId)) {
        groupsMap.set(wId, {
          worldMeta: WORLDS_CATALOG[wId] || { id: wId, name: wId, accentColor: '#38bdf8' },
          zones: []
        });
      }
      groupsMap.get(wId).zones.push(z);
    }

    const groupsHtml = Array.from(groupsMap.values()).map(({ worldMeta, zones }) => `
      <div class="editor-world-group">
        <div class="editor-world-group-head" style="border-left: 3px solid ${worldMeta.accentColor || '#38bdf8'};">
          <div>
            <strong>${worldMeta.name}</strong>
            <span>${zones.length} zona(s) guardada(s)</span>
          </div>
          <button type="button" class="editor-btn-secondary btn-new-in-world" data-world-id="${worldMeta.id}">+ Nueva Zona</button>
        </div>
        ${zones.length > 0 ? `
          <div class="editor-levels-list">
            ${zones.sort((a, b) => (a.zoneOrder || 1) - (b.zoneOrder || 1)).map(lvl => `
              <div class="editor-level-row" data-lvl-id="${lvl.id}">
                <div class="editor-level-info">
                  <strong>#${lvl.zoneOrder || 1} · ${lvl.name || lvl.id}</strong>
                  <span>ID: ${lvl.id} · ${WORLDS_CATALOG[lvl.biome]?.name || lvl.biome} · ${lvl.cols}×${lvl.rows}</span>
                </div>
                <div class="editor-level-actions">
                  <button type="button" class="editor-btn-secondary btn-lvl-open" data-id="${lvl.id}">ABRIR</button>
                  <button type="button" class="editor-btn-danger btn-lvl-del" data-id="${lvl.id}" title="Eliminar">✕</button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');

    this.modalEl.innerHTML = `
      <div class="editor-levels-card">
        <header class="editor-levels-header">
          <h3>GESTOR DE MUNDOS Y ZONAS</h3>
          <button type="button" id="btn-levels-close" class="editor-btn-close" aria-label="Cerrar">✕</button>
        </header>

        <div class="editor-levels-body">
          <section class="editor-levels-section">
            <h4>Crear Nueva Zona en un Mundo</h4>
            <div class="editor-levels-form-row">
              <input type="text" id="new-lvl-name" class="editor-name-input" placeholder="Nombre de la zona" value="Nueva Zona" />
              <select id="new-lvl-world" class="editor-select-pill" title="Mundo Padre">
                ${BIOME_OPTIONS.map(b => `<option value="${b.id}" ${b.id === draft.worldId ? 'selected' : ''}>Mundo: ${b.name}</option>`).join('')}
              </select>
              <select id="new-lvl-biome" class="editor-select-pill" title="Bioma Visual">
                ${BIOME_OPTIONS.map(b => `<option value="${b.id}" ${b.id === draft.biome ? 'selected' : ''}>Bioma: ${b.name}</option>`).join('')}
              </select>
              <input type="number" id="new-lvl-cols" class="editor-dim-input" value="52" min="16" max="160" title="Columnas (ancho)" />
              <span class="editor-dim-x">×</span>
              <input type="number" id="new-lvl-rows" class="editor-dim-input" value="36" min="16" max="120" title="Filas (alto)" />
              <button type="button" id="btn-new-lvl-create" class="editor-btn-playtest">CREAR ZONA</button>
            </div>
          </section>

          <section class="editor-levels-section">
            <h4>Redimensionar Zona Actual (${draft.cols}×${draft.rows})</h4>
            <div class="editor-levels-form-row">
              <label class="editor-dim-label">Ancho (cols):</label>
              <input type="number" id="resize-lvl-cols" class="editor-dim-input" value="${draft.cols}" min="16" max="160" />
              <label class="editor-dim-label">Alto (filas):</label>
              <input type="number" id="resize-lvl-rows" class="editor-dim-input" value="${draft.rows}" min="16" max="120" />
              <button type="button" id="btn-resize-lvl-apply" class="editor-btn-secondary">APLICAR TAMAÑO</button>
            </div>
          </section>

          <section class="editor-levels-section">
            <h4>Zonas Guardadas por Mundo (${savedZones.length})</h4>
            <div class="editor-worlds-groups">
              ${groupsHtml}
            </div>
          </section>

          <section class="editor-levels-section">
            <h4>Plantillas de Mundos Oficiales</h4>
            <div class="editor-templates-grid">
              ${WORLDS_LIST.map(w => `
                <button type="button" class="editor-template-btn" data-world-id="${w.id}" style="border-left: 3px solid ${w.accentColor};">
                  <strong>${w.name}</strong>
                  <span>${w.subtitle}</span>
                </button>
              `).join('')}
            </div>
          </section>
        </div>
      </div>
    `;

    this.modalEl.classList.remove('hidden');
    this._bindEvents(savedZones);
  }

  /** @private */
  _bindEvents(savedZones) {
    this.modalEl.querySelector('#btn-levels-close').addEventListener('click', () => this.close());
    this.modalEl.onclick = (e) => {
      if (e.target === this.modalEl) this.close();
    };

    const createZoneForWorld = (worldId, customName = null) => {
      const name = customName || this.modalEl.querySelector('#new-lvl-name').value.trim() || 'Nueva Zona';
      const biome = this.modalEl.querySelector('#new-lvl-biome').value || worldId;
      const cols = Math.max(16, Math.min(160, parseInt(this.modalEl.querySelector('#new-lvl-cols').value, 10) || 52));
      const rows = Math.max(16, Math.min(120, parseInt(this.modalEl.querySelector('#new-lvl-rows').value, 10) || 36));
      const weather = WORLDS_CATALOG[biome]?.weather || 'pollen';
      const existingInWorld = savedZones.filter(z => z.worldId === worldId);
      const zoneOrder = existingInWorld.length + 1;

      const blank = createBlankLevel({
        name,
        worldId,
        zoneOrder,
        biome,
        cols,
        rows,
        weather
      });
      this.editor._loadDraftIntoEditor(blank);
      this.close();
      this.editor.showToast(`Zona "${name}" creada en ${WORLDS_CATALOG[worldId]?.name || worldId}`);
    };

    this.modalEl.querySelector('#btn-new-lvl-create').addEventListener('click', () => {
      const worldId = this.modalEl.querySelector('#new-lvl-world').value;
      createZoneForWorld(worldId);
    });

    this.modalEl.querySelectorAll('.btn-new-in-world').forEach(btn => {
      btn.addEventListener('click', () => {
        const wId = btn.dataset.worldId;
        const count = savedZones.filter(z => z.worldId === wId).length + 1;
        createZoneForWorld(wId, `Zona ${count} · ${WORLDS_CATALOG[wId]?.name || wId}`);
      });
    });

    this.modalEl.querySelector('#btn-resize-lvl-apply').addEventListener('click', () => {
      const cols = this.modalEl.querySelector('#resize-lvl-cols').value;
      const rows = this.modalEl.querySelector('#resize-lvl-rows').value;
      this.editor.resizeLevel(cols, rows);
      this.close();
    });

    this.modalEl.querySelectorAll('.btn-lvl-open').forEach(btn => {
      btn.addEventListener('click', () => {
        const found = savedZones.find(l => l.id === btn.dataset.id);
        if (found) {
          this.editor._loadDraftIntoEditor(found);
          this.close();
          this.editor.showToast(`Zona "${found.name}" cargada`);
        }
      });
    });

    this.modalEl.querySelectorAll('.btn-lvl-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (levelRepository.remove(id)) {
          this.editor.showToast('Zona eliminada del almacenamiento');
          this.open();
        }
      });
    });

    this.modalEl.querySelectorAll('.editor-template-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const worldId = btn.dataset.worldId;
        const data = await loadWorldData(worldId, false);
        if (data) {
          const copy = {
            ...data,
            id: `zone_${worldId}_${Date.now().toString(36)}`,
            worldId,
            zoneId: `copia_${worldId}`,
            name: `${WORLDS_CATALOG[worldId]?.name || worldId} (Copia)`,
            biome: WORLDS_CATALOG[worldId]?.biome || worldId
          };
          this.editor._loadDraftIntoEditor(copy);
          this.close();
          this.editor.showToast(`Plantilla "${WORLDS_CATALOG[worldId]?.name}" cargada`);
        }
      });
    });
  }
}

