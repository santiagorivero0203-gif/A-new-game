/**
 * @module EditorInspector
 * @description Panel contextual del Inspector derecho para la Forja de Mundos.
 * Permite editar coordenadas, dimensiones, atributos de entidades/props, conexiones de portales
 * entre zonas del mismo mundo (`targetWorld` + `targetSpawnId`), puntos de entrada (`spawnPoints`)
 * y metadatos de la zona (`worldId`, `zoneId`, `zoneOrder`, `perimeterConfig`), registrando cada
 * cambio mediante `EditorCommands` para soporte completo de Undo/Redo.
 * @author Be a Legend Team
 * @version 1.0.0
 */

import { WORLDS_CATALOG, WORLDS_LIST } from '../data/worlds.js';
import { PROP_CATALOG, ELEMENT_OPTIONS, BIOME_OPTIONS, saveCustomPropTemplate } from './EditorCatalog.js';
import { levelRepository } from './LevelRepository.js';

/**
 * Escapa caracteres HTML especiales para incrustar valores de usuario de forma segura en inputs.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class EditorInspector {
  /**
   * @param {import('./LevelEditor.js').LevelEditor} editor
   * @param {HTMLElement} inspectorEl
   */
  constructor(editor, inspectorEl) {
    this.editor = editor;
    this.inspectorEl = inspectorEl;
    this._showZoneMeta = false;
  }

  /**
   * Abre o alterna el inspector de propiedades generales de la Zona actual.
   * @param {boolean} [forceOpen=true]
   */
  toggleZoneMeta(forceOpen = true) {
    this._showZoneMeta = forceOpen ? !this._showZoneMeta : false;
    this.render();
  }

  /**
   * Actualiza los valores X/Y mostrados sin reconstruir todo el DOM durante el arrastre.
   * @param {number} x
   * @param {number} y
   */
  updateCoordinates(x, y) {
    if (!this.inspectorEl) return;
    const xIn = this.inspectorEl.querySelector('#inspector-x');
    const yIn = this.inspectorEl.querySelector('#inspector-y');
    if (xIn) xIn.value = Math.round(x);
    if (yIn) yIn.value = Math.round(y);
  }

  /**
   * Actualiza los valores Ancho/Alto mostrados durante el redimensionado por arrastre.
   * @param {number} width
   * @param {number} height
   */
  updateDimensions(width, height) {
    if (!this.inspectorEl) return;
    const wIn = this.inspectorEl.querySelector('[data-field="width"]');
    const hIn = this.inspectorEl.querySelector('[data-field="height"]');
    if (wIn) wIn.value = Math.round(width);
    if (hIn) hIn.value = Math.round(height);
  }

  /**
   * Renderiza el contenido contextual según el objeto seleccionado o metadatos de la zona.
   */
  render() {
    if (!this.inspectorEl) return;
    const selected = this.editor.selectedObject;

    if (!selected) {
      if (this._showZoneMeta) {
        this._renderZoneMetaInspector();
      } else {
        this.inspectorEl.classList.add('hidden');
        this.inspectorEl.innerHTML = '';
      }
      return;
    }

    this._showZoneMeta = false;
    this.inspectorEl.classList.remove('hidden');

    const { category, item } = selected;
    let title = 'Elemento';
    let fieldsHtml = '';

    if (category === 'player') {
      title = 'Inicio de Santi y Entradas';
      fieldsHtml = this._buildPlayerSpawnFields();
    } else if (category === 'arena') {
      title = 'Centro de Arena / Cámara';
      fieldsHtml = `<p class="inspector-hint">Punto focal para encuadres de horda y límites de combate.</p>`;
    } else if (category === 'props') {
      title = item.propType === 'custom_env_prop'
        ? `✦ ${escapeHtml(item.label || item.customKey || 'Objeto Personalizado')}`
        : `Prop: ${item.propType}`;
      fieldsHtml = this._buildPropFields(item);
    } else if (category === 'entities') {
      if (item.type === 'enemy') {
        title = `Enemigo: ${item.archetype?.toUpperCase() || 'MOB'}`;
        fieldsHtml = this._buildEnemyFields(item);
      } else if (item.type === 'npc') {
        title = `NPC: ${item.name || item.variant}`;
        fieldsHtml = this._buildNpcFields(item);
      } else if (item.type === 'house') {
        title = 'Cabaña del Sabio';
        fieldsHtml = `<p class="inspector-hint">Cabaña estructural (160×144 px) con hitbox en cimientos.</p>`;
      }
    } else if (category === 'clearingTrees') {
      title = 'Árbol Ancestral';
      fieldsHtml = `<p class="inspector-hint">Árbol manual (84×98 px) con colisión en la base del tronco.</p>`;
    } else if (category === 'foliage') {
      title = 'Arbusto Reactivo';
      fieldsHtml = `<p class="inspector-hint">Arbusto elástico (48×44 px) que reacciona al paso de Santi.</p>`;
    } else if (category === 'solidColliders' || category === 'stealthZones') {
      title = category === 'solidColliders' ? 'Barrera Sólida' : 'Zona de Sigilo';
      fieldsHtml = `
        <div class="inspector-row-coords">
          <div class="inspector-field">
            <label>Ancho (px)</label>
            <input type="number" data-field="width" min="16" step="8" value="${item.width || 64}" />
          </div>
          <div class="inspector-field">
            <label>Alto (px)</label>
            <input type="number" data-field="height" min="16" step="8" value="${item.height || 64}" />
          </div>
        </div>
        <p class="inspector-hint">También puedes arrastrar el asa azul inferior derecha en el lienzo.</p>
      `;
    } else if (category === 'lights') {
      title = 'Punto de Luz Dinámica';
      fieldsHtml = `
        <div class="inspector-field">
          <label>Radio de Iluminación</label>
          <input type="number" data-field="radius" value="${item.radius || 180}" min="30" max="600" />
        </div>
        <div class="inspector-field">
          <label>Color de la Luz</label>
          <input type="color" data-field="color" value="${item.color || '#facc15'}" />
        </div>
        <div class="inspector-field">
          <label>Intensidad (0.1 - 1.0)</label>
          <input type="number" data-field="intensity" step="0.05" value="${item.intensity ?? 0.75}" min="0.1" max="1.0" />
        </div>
      `;
    }

    this.inspectorEl.innerHTML = `
      <div class="inspector-header">
        <h4 class="inspector-title">${title}</h4>
        <button type="button" id="btn-inspector-delete" class="inspector-delete-btn" title="Eliminar [Supr]">🗑</button>
      </div>

      <div class="inspector-coords-card">
        <div class="inspector-coord-box">
          <span>X</span>
          <input type="number" id="inspector-x" value="${Math.round(item.x)}" />
        </div>
        <div class="inspector-coord-box">
          <span>Y</span>
          <input type="number" id="inspector-y" value="${Math.round(item.y)}" />
        </div>
      </div>

      <div class="inspector-body">
        ${fieldsHtml}
      </div>
    `;

    this._bindObjectEvents(category, item);
  }

  /** @private */
  _buildPlayerSpawnFields() {
    const draft = this.editor.draft;
    const spawns = Array.isArray(draft.spawnPoints) ? draft.spawnPoints : [];
    const extraSpawns = spawns.filter(sp => sp.id !== 'default');

    return `
      <p class="inspector-hint">Coordenadas iniciales de Santi (entrada <code>default</code>) y puntos adicionales para portales entre zonas.</p>
      <div class="inspector-field">
        <label>Entradas de esta Zona (${spawns.length})</label>
        <div class="inspector-spawns-list">
          ${extraSpawns.map(sp => `
            <div class="inspector-spawn-chip">
              <span>${sp.id} (${Math.round(sp.x)}, ${Math.round(sp.y)})</span>
              <button type="button" class="btn-del-spawn" data-spawn-id="${sp.id}" title="Eliminar entrada">✕</button>
            </div>
          `).join('') || '<span class="inspector-hint">Solo entrada principal ("default").</span>'}
        </div>
      </div>
      <div class="inspector-row-coords">
        <input type="text" id="new-spawn-id" class="inspector-mini-input" placeholder="ej. puerta_sur" />
        <button type="button" id="btn-add-spawn" class="editor-btn-secondary">+ Entrada aquí</button>
      </div>
    `;
  }

  /** @private */
  _buildPropFields(item) {
    if (item.propType === 'custom_env_prop') {
      return this._buildCustomPropFields(item);
    }
    const propDef = PROP_CATALOG.find(p => p.type === item.propType);
    if (!propDef || !propDef.editableFields) return '';

    return propDef.editableFields.map(f => {
      const val = item[f.key] ?? '';
      if (f.type === 'world_or_zone') {
        const savedZones = levelRepository.list();
        const officialOpts = WORLDS_LIST.map(w =>
          `<option value="${w.id}" ${w.id === val ? 'selected' : ''}>${w.name} (Oficial)</option>`
        ).join('');
        const zoneOpts = savedZones.map(z => {
          const parentName = WORLDS_CATALOG[z.worldId]?.name || z.worldId;
          return `<option value="${z.id}" ${z.id === val ? 'selected' : ''}>[${parentName}] ${z.name}</option>`;
        }).join('');
        const knownIds = new Set([...WORLDS_LIST.map(w => w.id), ...savedZones.map(z => z.id)]);
        const customFallback = (val && !knownIds.has(val))
          ? `<option value="${val}" selected>${val} (Personalizado)</option>`
          : '';

        return `
          <div class="inspector-field">
            <label>${f.label}</label>
            <select data-field="${f.key}">
              <optgroup label="Mundos Oficiales">${officialOpts}</optgroup>
              ${zoneOpts ? `<optgroup label="Zonas Guardadas">${zoneOpts}</optgroup>` : ''}
              ${customFallback}
            </select>
          </div>
        `;
      }
      if (f.type === 'select') {
        return `
          <div class="inspector-field">
            <label>${f.label}</label>
            <select data-field="${f.key}">
              ${f.options.map(opt => `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
          </div>
        `;
      }
      if (f.type === 'textarea') {
        return `
          <div class="inspector-field">
            <label>${f.label}</label>
            <textarea data-field="${f.key}" rows="3">${val}</textarea>
          </div>
        `;
      }
      return `
        <div class="inspector-field">
          <label>${f.label}</label>
          <input type="${f.type || 'text'}" data-field="${f.key}" value="${val}" />
        </div>
      `;
    }).join('');
  }

  /**
   * Construye los campos del Inspector para objetos de ambiente personalizados (`custom_env_prop`),
   * incluyendo carga de textura local/URL, dimensiones, físicas y especificación funcional.
   * @private
   * @param {Object} item
   * @returns {string}
   */
  _buildCustomPropFields(item) {
    const texUrl = item.textureUrl || '';
    const tint = item.tintColor || '#a855f7';
    const w = Math.max(16, Math.min(384, Number(item.width) || 64));
    const h = Math.max(16, Math.min(384, Number(item.height) || 64));
    const isSolid = item.isSolid !== false;
    const isInteractable = item.isInteractable !== false;

    const previewHtml = texUrl
      ? `<img class="inspector-texture-preview" src="${escapeHtml(texUrl)}" alt="Vista previa" />`
      : `<div class="inspector-texture-preview empty" style="border-color:${escapeHtml(tint)};color:${escapeHtml(tint)};">✦</div>`;

    return `
      <div class="inspector-texture-card">
        ${previewHtml}
        <div class="inspector-texture-actions">
          <button type="button" id="btn-upload-custom-tex" class="editor-btn-secondary">🖼 Subir Textura</button>
          <input type="file" id="input-upload-custom-tex" accept="image/*" style="display:none;" />
          ${texUrl ? `<button type="button" id="btn-clear-custom-tex" class="editor-btn-secondary">Quitar</button>` : ''}
        </div>
      </div>

      <div class="inspector-field">
        <label>Ruta o Data URL de Textura</label>
        <input type="text" data-field="textureUrl" value="${escapeHtml(texUrl)}" placeholder="/assets/environment/..." />
      </div>

      <div class="inspector-field">
        <label>Nombre Visible (label)</label>
        <input type="text" data-field="label" value="${escapeHtml(item.label || '')}" placeholder="ej. Estatua del Guardián" />
      </div>

      <div class="inspector-field">
        <label>ID / Clave Técnica (customKey)</label>
        <input type="text" data-field="customKey" value="${escapeHtml(item.customKey || '')}" placeholder="ej. altar_esporas" />
      </div>

      <div class="inspector-row-coords">
        <div class="inspector-field">
          <label>Ancho (px)</label>
          <input type="number" data-field="width" min="16" max="384" step="8" value="${w}" />
        </div>
        <div class="inspector-field">
          <label>Alto (px)</label>
          <input type="number" data-field="height" min="16" max="384" step="8" value="${h}" />
        </div>
      </div>

      <div class="inspector-field">
        <label>Color Guía / Borde</label>
        <input type="color" data-field="tintColor" value="${escapeHtml(tint)}" />
      </div>

      <div class="inspector-field-checkbox">
        <label>
          <input type="checkbox" data-field="isSolid" ${isSolid ? 'checked' : ''} />
          <span>Colisión Sólida en Base</span>
        </label>
      </div>

      <div class="inspector-field-checkbox">
        <label>
          <input type="checkbox" data-field="isInteractable" ${isInteractable ? 'checked' : ''} />
          <span>Interactuable con [E]</span>
        </label>
      </div>

      <div class="inspector-field">
        <label>Descripción Funcional (para implementación definitiva)</label>
        <textarea data-field="devDescription" rows="4" placeholder="Describe qué debe hacer este objeto en el juego (ej: Al golpearlo con fuego abre la compuerta norte)...">${escapeHtml(item.devDescription || '')}</textarea>
      </div>

      <div class="inspector-field">
        <label>Texto de Prueba al Pulsar [E] (Playtest)</label>
        <input type="text" data-field="loreText" value="${escapeHtml(item.loreText || '')}" placeholder="Opcional: mensaje al inspeccionar" />
      </div>

      <div class="inspector-row-coords">
        <button type="button" id="btn-save-custom-template" class="editor-btn-secondary" title="Guardar en la paleta para reutilizar">★ En Paleta</button>
        <button type="button" id="btn-copy-custom-spec" class="editor-btn-secondary" title="Copiar descripción y datos al portapapeles">📋 Copiar Spec</button>
      </div>
    `;
  }

  /** @private */
  _buildEnemyFields(item) {
    return `
      <div class="inspector-field">
        <label>Nombre en Pantalla</label>
        <input type="text" data-field="name" value="${item.name || ''}" />
      </div>
      <div class="inspector-field">
        <label>Elemento Mágico</label>
        <select data-field="element">
          ${ELEMENT_OPTIONS.map(elem => `<option value="${elem}" ${elem === item.element ? 'selected' : ''}>${elem.toUpperCase()}</option>`).join('')}
        </select>
      </div>
      <div class="inspector-field-checkbox">
        <label>
          <input type="checkbox" data-field="hasWoodenShield" ${item.hasWoodenShield ? 'checked' : ''} />
          <span>Escudo de Madera (Destructible con Fuego)</span>
        </label>
      </div>
      <div class="inspector-field-checkbox">
        <label>
          <input type="checkbox" data-field="noRespawn" ${item.noRespawn ? 'checked' : ''} />
          <span>Sin Reaparición (Único)</span>
        </label>
      </div>
    `;
  }

  /** @private */
  _buildNpcFields(item) {
    return `
      <div class="inspector-field">
        <label>Nombre del NPC</label>
        <input type="text" data-field="name" value="${item.name || ''}" />
      </div>
      <div class="inspector-field">
        <label>Etiqueta de Rescate (rescueTag)</label>
        <input type="text" data-field="rescueTag" value="${item.rescueTag || ''}" placeholder="ej. ambush_valerio" />
      </div>
    `;
  }

  /** @private */
  _bindObjectEvents(category, item) {
    const xInput = this.inspectorEl.querySelector('#inspector-x');
    const yInput = this.inspectorEl.querySelector('#inspector-y');
    if (xInput) {
      xInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
          this.editor.commands.moveItem(category, item, { x: item.x, y: item.y }, { x: val, y: item.y });
        }
      });
    }
    if (yInput) {
      yInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
          this.editor.commands.moveItem(category, item, { x: item.x, y: item.y }, { x: item.x, y: val });
        }
      });
    }

    const delBtn = this.inspectorEl.querySelector('#btn-inspector-delete');
    if (delBtn) {
      delBtn.addEventListener('click', () => this.editor._deleteSelectedObject());
    }

    this.inspectorEl.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('change', () => {
        const field = input.dataset.field;
        let val = input.value;
        if (input.type === 'checkbox') val = input.checked;
        else if (input.type === 'number') {
          val = parseFloat(input.value) || 0;
          if (category === 'props' && item.propType === 'custom_env_prop' && (field === 'width' || field === 'height')) {
            val = Math.max(16, Math.min(384, Math.round(val)));
            input.value = val;
          }
        }

        this.editor.commands.editItem(category, item, { [field]: val });

        if (category === 'props' && item.propType === 'custom_env_prop' && (field === 'textureUrl' || field === 'tintColor' || field === 'label')) {
          this.render();
        }

        // Si se eligió un destino en world_portal, sugerir automáticamente su etiqueta
        if (category === 'props' && item.propType === 'world_portal' && field === 'targetWorld') {
          const targetZone = WORLDS_CATALOG[val] || levelRepository.get(val);
          if (targetZone && targetZone.name) {
            this.editor.commands.editItem(category, item, { worldLabel: targetZone.name });
            this.render();
          }
        }
      });
    });

    // Carga de imagen local para objetos personalizados (custom_env_prop)
    const btnUploadTex = this.inspectorEl.querySelector('#btn-upload-custom-tex');
    const inputUploadTex = this.inspectorEl.querySelector('#input-upload-custom-tex');
    if (btnUploadTex && inputUploadTex) {
      btnUploadTex.addEventListener('click', () => inputUploadTex.click());
      inputUploadTex.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        this._handleCustomTextureUpload(category, item, file);
        inputUploadTex.value = '';
      });
    }

    const btnClearTex = this.inspectorEl.querySelector('#btn-clear-custom-tex');
    if (btnClearTex) {
      btnClearTex.addEventListener('click', () => {
        this.editor.commands.editItem(category, item, { textureUrl: '' });
        this.render();
      });
    }

    const btnSaveTpl = this.inspectorEl.querySelector('#btn-save-custom-template');
    if (btnSaveTpl) {
      btnSaveTpl.addEventListener('click', () => {
        const res = saveCustomPropTemplate(item);
        if (res.ok) {
          this.editor._renderPalette();
          this.editor.showToast(`"${res.template.name}" guardado en la paleta de Props`);
        } else {
          this.editor.showToast(res.error || 'No se pudo guardar la plantilla', true);
        }
      });
    }

    const btnCopySpec = this.inspectorEl.querySelector('#btn-copy-custom-spec');
    if (btnCopySpec) {
      btnCopySpec.addEventListener('click', () => this._copyCustomPropSpec(item));
    }

    // Gestión de puntos de entrada adicionales (spawnPoints) en el nodo de Santi
    const btnAddSpawn = this.inspectorEl.querySelector('#btn-add-spawn');
    if (btnAddSpawn) {
      btnAddSpawn.addEventListener('click', () => {
        const rawId = this.inspectorEl.querySelector('#new-spawn-id')?.value.trim();
        if (!rawId) return;
        const cleanId = rawId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const nextSpawns = [...(this.editor.draft.spawnPoints || [])];
        const existing = nextSpawns.find(sp => sp.id === cleanId);
        if (existing) {
          existing.x = Math.round(item.x);
          existing.y = Math.round(item.y);
        } else {
          nextSpawns.push({ id: cleanId, label: cleanId, x: Math.round(item.x), y: Math.round(item.y) });
        }
        this.editor.commands.editLevelMeta({ spawnPoints: nextSpawns });
        this.render();
      });
    }

    this.inspectorEl.querySelectorAll('.btn-del-spawn').forEach(btn => {
      btn.addEventListener('click', () => {
        const spId = btn.dataset.spawnId;
        const nextSpawns = (this.editor.draft.spawnPoints || []).filter(sp => sp.id !== spId);
        this.editor.commands.editLevelMeta({ spawnPoints: nextSpawns });
        this.render();
      });
    });
  }

  /**
   * Muestra el inspector de propiedades globales de la Zona actual (Mundo padre, orden, perímetro).
   * @private
   */
  _renderZoneMetaInspector() {
    const draft = this.editor.draft;
    this.inspectorEl.classList.remove('hidden');
    const hasPerimeter = Boolean(draft.perimeterConfig && draft.perimeterConfig.enabled !== false);

    this.inspectorEl.innerHTML = `
      <div class="inspector-header">
        <h4 class="inspector-title">Propiedades de Zona</h4>
        <button type="button" id="btn-zone-meta-close" class="editor-btn-close" title="Cerrar">✕</button>
      </div>
      <div class="inspector-body">
        <div class="inspector-field">
          <label>Mundo Padre (worldId)</label>
          <select id="meta-world-id">
            ${BIOME_OPTIONS.map(b => `<option value="${b.id}" ${b.id === draft.worldId ? 'selected' : ''}>${b.name}</option>`).join('')}
          </select>
        </div>
        <div class="inspector-field">
          <label>ID de Zona (zoneId)</label>
          <input type="text" id="meta-zone-id" value="${draft.zoneId || draft.id}" />
        </div>
        <div class="inspector-field">
          <label>Orden en el Mundo</label>
          <input type="number" id="meta-zone-order" min="1" value="${draft.zoneOrder || 1}" />
        </div>
        <div class="inspector-field">
          <label>Objetivo Inicial</label>
          <textarea id="meta-objective" rows="2">${draft.initialObjective || ''}</textarea>
        </div>
        <div class="inspector-field-checkbox">
          <label>
            <input type="checkbox" id="meta-perimeter-enabled" ${hasPerimeter ? 'checked' : ''} />
            <span>Perímetro Automático de Árboles</span>
          </label>
        </div>
      </div>
    `;

    this.inspectorEl.querySelector('#btn-zone-meta-close').addEventListener('click', () => {
      this._showZoneMeta = false;
      this.render();
    });

    this.inspectorEl.querySelector('#meta-world-id').addEventListener('change', (e) => {
      this.editor.commands.editLevelMeta({ worldId: e.target.value });
    });
    this.inspectorEl.querySelector('#meta-zone-id').addEventListener('change', (e) => {
      const val = e.target.value.trim();
      if (val) this.editor.commands.editLevelMeta({ zoneId: val });
    });
    this.inspectorEl.querySelector('#meta-zone-order').addEventListener('change', (e) => {
      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
      this.editor.commands.editLevelMeta({ zoneOrder: val });
    });
    this.inspectorEl.querySelector('#meta-objective').addEventListener('change', (e) => {
      this.editor.commands.editLevelMeta({ initialObjective: e.target.value });
    });
    this.inspectorEl.querySelector('#meta-perimeter-enabled').addEventListener('change', (e) => {
      const enabled = e.target.checked;
      const nextPerimeter = enabled
        ? { ...(draft.perimeterConfig || { step: 116 }), enabled: true }
        : { ...(draft.perimeterConfig || {}), enabled: false };
      this.editor.commands.editLevelMeta({ perimeterConfig: nextPerimeter });
    });
  }

  /**
   * Lee una imagen local, la optimiza hasta un máximo de 160x160 px manteniendo pixel-art nítido
   * para ahorrar espacio en `localStorage` y la asigna al objeto `custom_env_prop`.
   * @private
   * @param {string} category
   * @param {Object} item
   * @param {File} file
   */
  _handleCustomTextureUpload(category, item, file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawDataUrl = ev.target?.result;
      if (typeof rawDataUrl !== 'string') return;

      const img = new Image();
      img.onload = () => {
        const natW = Math.max(1, img.naturalWidth || 64);
        const natH = Math.max(1, img.naturalHeight || 64);
        const maxSide = 160;
        let outW = natW;
        let outH = natH;
        let finalUrl = rawDataUrl;

        if (natW > maxSide || natH > maxSide) {
          const scale = Math.min(maxSide / natW, maxSide / natH);
          outW = Math.max(16, Math.round(natW * scale));
          outH = Math.max(16, Math.round(natH * scale));
          const canvas = document.createElement('canvas');
          canvas.width = outW;
          canvas.height = outH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, outW, outH);
            finalUrl = canvas.toDataURL('image/png');
          }
        }

        const nextWidth = Math.max(16, Math.min(384, outW));
        const nextHeight = Math.max(16, Math.min(384, outH));
        this.editor.commands.editItem(category, item, {
          textureUrl: finalUrl,
          width: nextWidth,
          height: nextHeight
        });
        this.render();
        this.editor.showToast(`Textura cargada (${nextWidth}×${nextHeight} px)`);
      };
      img.onerror = () => {
        this.editor.showToast('No se pudo leer el archivo de imagen seleccionado', true);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Copia al portapapeles un resumen estructurado del objeto personalizado y su descripción funcional
   * para facilitar su posterior implementación definitiva en el motor.
   * @private
   * @param {Object} item
   */
  _copyCustomPropSpec(item) {
    if (!item) return;
    const texSummary = item.textureUrl
      ? (item.textureUrl.startsWith('data:') ? '[Data URL incrustada en el nivel]' : item.textureUrl)
      : '[Sin textura asignada]';

    const specText = [
      `Objeto de Ambiente Personalizado: ${item.label || item.customKey || 'Sin nombre'}`,
      `- customKey: ${item.customKey || 'objeto_personalizado'}`,
      `- Posición: (${Math.round(item.x || 0)}, ${Math.round(item.y || 0)})`,
      `- Tamaño: ${Math.round(item.width || 64)}x${Math.round(item.height || 64)} px`,
      `- Sólido: ${item.isSolid !== false ? 'Sí' : 'No'} | Interactuable [E]: ${item.isInteractable !== false ? 'Sí' : 'No'}`,
      `- Textura: ${texSummary}`,
      `- Descripción Funcional:`,
      `${item.devDescription || '(Sin descripción funcional)'}`
    ].join('\n');

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(specText)
        .then(() => this.editor.showToast('Especificación copiada al portapapeles'))
        .catch(() => this.editor.showToast('No se pudo copiar automáticamente; exporta el JSON', true));
    } else {
      this.editor.showToast('Portapapeles no disponible; exporta el JSON del nivel', true);
    }
  }
}

