/**
 * @module LevelEditor
 * @description Orquestador principal de la Forja de Mundos (Creador de Zonas y Mundos).
 * Desacoplado bajo demanda (0 FPS en reposo), coordinando:
 * - `EditorViewport`: cámara, zoom centrado y gestos multitáctiles (pinch/pan).
 * - `EditorCommands` + `EditorHistory`: mutaciones atómicas por referencia con Undo/Redo.
 * - `EditorRenderer`: renderizado 1:1 con `Tilemap`, `EntityFootprints` y perímetro compartido.
 * - `EditorInspector`: inspector contextual de objetos, entradas y propiedades de zona.
 * - `EditorLevelsModal` + `levelRepository`: gestión de zonas agrupadas por mundo y persistencia RLE.
 * @author Be a Legend Team
 * @version 2.0.0
 */

import { Tilemap, BIOME_PALETTES } from '../world/Tilemap.js';
import { registerCustomWorld, WORLDS_CATALOG } from '../data/worlds.js';
import { createBlankLevel, normalizeLevel } from '../data/LevelSchema.js';
import { getObjectFootprint, getObjectBounds } from '../data/EntityFootprints.js';
import {
  TILE_PALETTE,
  BIOME_OPTIONS,
  PROP_CATALOG,
  STRUCTURE_CATALOG,
  ACTOR_CATALOG,
  ZONE_CATALOG,
  LIGHT_CATALOG,
  createCatalogItem,
  listCustomPropTemplates,
  deleteCustomPropTemplate
} from './EditorCatalog.js';
import {
  cloneLevelDraft,
  validateLevel,
  exportLevelToFile,
  parseLevelFromJSON
} from './LevelSerializer.js';
import { levelRepository } from './LevelRepository.js';
import { EditorHistory } from './EditorHistory.js';
import { EditorCommands } from './EditorCommands.js';
import { EditorViewport } from './EditorViewport.js';
import { EditorRenderer, RESIZE_HANDLE_WORLD_SIZE } from './EditorRenderer.js';
import { EditorInspector } from './EditorInspector.js';
import { EditorLevelsModal } from './EditorLevelsModal.js';

/** Instancia única activa del editor */
let _activeEditorInstance = null;

export class LevelEditor {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container] - Contenedor padre (#game-container)
   * @param {Object} [options.initialDraft] - Borrador opcional preexistente
   * @param {Function} [options.onExit] - Callback al cerrar el editor
   * @param {Function} [options.onPlaytest] - Callback al iniciar playtest
   */
  constructor(options = {}) {
    this.container = options.container || document.getElementById('game-container') || document.body;
    this.onExit = options.onExit || null;
    this.onPlaytest = options.onPlaytest || null;

    // Sincronizar zonas guardadas para habilitar destinos de portales desde el inicio
    levelRepository.syncAllToEngine();

    /** @type {Object} Borrador de zona activo normalizado */
    this.draft = options.initialDraft ? cloneLevelDraft(options.initialDraft) : createBlankLevel();
    /** @type {EditorHistory} Gestor de Deshacer / Rehacer por referencia */
    this.history = new EditorHistory(50);
    /** @type {EditorCommands} Fachada de comandos mutables */
    this.commands = new EditorCommands(this);
    /** @type {EditorRenderer} Renderizador de lienzo bajo demanda */
    this.renderer = new EditorRenderer();

    /** @type {Tilemap} Instancia auténtica del motor (4.º arg: biome/preset, 5.º arg: terrainGrid) */
    this.tilemap = this._createTilemap(
      this.draft.cols,
      this.draft.rows,
      this.draft.tileSize,
      this.draft.biome,
      this.draft.terrainGrid
    );

    // Estado de Interacción
    this.currentCategory = 'terrain'; // 'terrain' | 'props' | 'structures' | 'actors' | 'zones' | 'lights'
    this.currentTool = 'pencil1'; // 'pan' | 'select' | 'place' | 'pencil1' | 'brush3' | 'rect' | 'flood'
    this.selectedTileId = 0;
    this.selectedPaletteItem = null;
    this.snapMode = 32; // 32 | 16 | 0
    this.showGrid = true;

    // Selección, arrastre y redimensionado de zonas
    this.selectedObject = null; // { category, item }
    this._isDraggingObject = false;
    this._isResizingZone = false;
    this._dragOffset = { x: 0, y: 0 };
    this._dragStartPos = null;
    this._resizeStartDims = null;

    // Trazo de terreno
    this._isDrawingTerrain = false;
    this._activeStrokeDeltas = [];
    this._rectStartTile = null;

    // Puntero y Render bajo demanda
    this.pointerWorldPos = { x: 0, y: 0 };
    this._isDirty = false;
    this._rafId = null;
    this._dpr = 1;

    // Elementos DOM y sub-controladores UI
    this.overlayEl = null;
    this.canvas = null;
    this.ctx = null;
    this.paletteContainer = null;
    this.statusMsgEl = null;
    this.viewport = null;
    this.inspector = null;
    this.levelsModal = null;

    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundResize = this._onResize.bind(this);

    this._initDOM();
    this._initViewport();
    this._initEvents();
    this._onResize();
    this._renderPalette();
    this.markDirty();
  }

  /**
   * Fábrica canónica de `Tilemap` garantizando el orden correcto de parámetros `(cols, rows, tileSize, preset, customGrid)`.
   * @private
   */
  _createTilemap(cols, rows, tileSize, biome, terrainGrid) {
    const tm = new Tilemap(cols, rows, tileSize, biome, terrainGrid);
    tm.maxCachedChunks = 64;
    tm.build();
    return tm;
  }

  /**
   * Construye la estructura DOM periférica responsive (compatible 16:9 y 9:16).
   * @private
   */
  _initDOM() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.id = 'level-editor-overlay';
    this.overlayEl.className = 'level-editor-overlay';

    this.overlayEl.innerHTML = `
      <canvas id="level-editor-canvas" class="editor-canvas"></canvas>

      <header class="editor-top-bar">
        <div class="editor-top-left">
          <div class="editor-logo-pill">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            <span>FORJA DE ZONAS</span>
          </div>

          <input type="text" id="editor-level-name" class="editor-name-input" value="${this.draft.name}" title="Nombre de la Zona" />

          <select id="editor-biome-select" class="editor-select-pill" title="Bioma y Paleta Cromática">
            ${BIOME_OPTIONS.map(b => `
              <option value="${b.id}" ${b.id === this.draft.biome ? 'selected' : ''}>${b.name}</option>
            `).join('')}
          </select>

          <button type="button" id="btn-editor-zone-meta" class="editor-tool-btn" title="Propiedades de Zona y Mundo Padre">⚙</button>
        </div>

        <div class="editor-top-center">
          <button type="button" id="btn-editor-pan" class="editor-tool-btn" title="Modo Mano / Desplazar Lienzo (1 dedo) [H]">✋</button>

          <div class="editor-divider"></div>

          <button type="button" id="btn-editor-undo" class="editor-tool-btn" title="Deshacer [Ctrl+Z]">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          </button>
          <button type="button" id="btn-editor-redo" class="editor-tool-btn" title="Rehacer [Ctrl+Y]">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
          </button>

          <div class="editor-divider"></div>

          <button type="button" id="btn-editor-grid" class="editor-tool-btn active" title="Alternar Cuadrícula [G]">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
          </button>

          <select id="editor-snap-select" class="editor-select-pill" title="Ajuste a Rejilla (Snap)">
            <option value="32" selected>Snap 32px</option>
            <option value="16">Snap 16px</option>
            <option value="0">Snap Libre</option>
          </select>

          <div class="editor-divider"></div>

          <button type="button" id="btn-editor-zoom-out" class="editor-tool-btn" title="Alejar Cámara [-]">-</button>
          <span id="editor-zoom-label" class="editor-zoom-label">100%</span>
          <button type="button" id="btn-editor-zoom-in" class="editor-tool-btn" title="Acercar Cámara [+]">+</button>
        </div>

        <div class="editor-top-right">
          <button type="button" id="btn-editor-levels" class="editor-btn-secondary" title="Gestor de Mundos, Zonas y Plantillas">
            <span>ZONAS</span>
          </button>

          <button type="button" id="btn-editor-save" class="editor-btn-secondary" title="Guardar en Almacenamiento Local">
            <span>GUARDAR</span>
          </button>

          <button type="button" id="btn-editor-export" class="editor-btn-secondary" title="Exportar archivo .JSON compatible">
            <span>EXPORTAR</span>
          </button>

          <label class="editor-btn-secondary editor-file-label" title="Importar zona desde archivo .JSON">
            <span>IMPORTAR</span>
            <input type="file" id="editor-file-input" accept=".json" style="display:none;" />
          </label>

          <button type="button" id="btn-editor-playtest" class="editor-btn-playtest" title="Probar Zona en Vivo [F5]">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20" /></svg>
            <span>PROBAR</span>
          </button>

          <button type="button" id="btn-editor-close" class="editor-btn-close" aria-label="Cerrar Forja" title="Salir al Menú Principal [Esc]">✕</button>
        </div>
      </header>

      <footer class="editor-bottom-bar">
        <div class="editor-category-tabs">
          <button type="button" class="editor-cat-tab active" data-category="terrain">TERRENO</button>
          <button type="button" class="editor-cat-tab" data-category="props">PROPS</button>
          <button type="button" class="editor-cat-tab" data-category="structures">ESTRUCTURAS</button>
          <button type="button" class="editor-cat-tab" data-category="actors">ACTORES</button>
          <button type="button" class="editor-cat-tab" data-category="zones">ZONAS & COLISIÓN</button>
          <button type="button" class="editor-cat-tab" data-category="lights">LUCES</button>
        </div>

        <div class="editor-palette-dock">
          <div id="editor-subtools" class="editor-subtools"></div>
          <div class="editor-divider vertical"></div>
          <div id="editor-items-list" class="editor-items-list"></div>
        </div>
      </footer>

      <aside id="editor-inspector-dock" class="editor-inspector-dock hidden"></aside>
      <div id="editor-status-toast" class="editor-status-toast hidden"></div>
      <div id="editor-levels-modal" class="editor-levels-modal hidden"></div>
    `;

    this.container.appendChild(this.overlayEl);

    this.canvas = this.overlayEl.querySelector('#level-editor-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.paletteContainer = this.overlayEl.querySelector('#editor-items-list');
    this.statusMsgEl = this.overlayEl.querySelector('#editor-status-toast');

    this.inspector = new EditorInspector(this, this.overlayEl.querySelector('#editor-inspector-dock'));
    this.levelsModal = new EditorLevelsModal(this, this.overlayEl.querySelector('#editor-levels-modal'));
  }

  /**
   * Inicializa el controlador de cámara y gestos multitáctiles (`EditorViewport`).
   * @private
   */
  _initViewport() {
    this.viewport = new EditorViewport({
      canvas: this.canvas,
      cameraX: (this.draft.cols * this.draft.tileSize) / 2,
      cameraY: (this.draft.rows * this.draft.tileSize) / 2,
      zoom: 1.0,
      isPanToolActive: () => this.currentTool === 'pan',
      onCameraChange: (zoomPct) => {
        const label = this.overlayEl.querySelector('#editor-zoom-label');
        if (label) label.textContent = `${zoomPct}%`;
        this.markDirty();
      },
      onCancelSingleStroke: () => this._cancelActiveStroke(),
      onSingleDown: (e) => this._onSinglePointerDown(e),
      onSingleMove: (e) => this._onSinglePointerMove(e),
      onSingleUp: () => this._onSinglePointerUp()
    });
  }

  /**
   * Conecta escuchadores de barra superior, paleta y atajos de teclado.
   * @private
   */
  _initEvents() {
    window.addEventListener('resize', this._boundResize);
    window.addEventListener('keydown', this._boundKeyDown);

    const nameInput = this.overlayEl.querySelector('#editor-level-name');
    nameInput.addEventListener('change', (e) => {
      const nextName = e.target.value.trim() || 'Nueva Zona';
      this.commands.editLevelMeta({ name: nextName, worldTitle: nextName });
    });

    const biomeSelect = this.overlayEl.querySelector('#editor-biome-select');
    biomeSelect.addEventListener('change', (e) => this.setBiome(e.target.value));

    this.overlayEl.querySelector('#btn-editor-zone-meta').addEventListener('click', () => {
      this.selectedObject = null;
      this.inspector.toggleZoneMeta(true);
      this.markDirty();
    });

    const panBtn = this.overlayEl.querySelector('#btn-editor-pan');
    panBtn.addEventListener('click', () => this._togglePanTool());

    this.overlayEl.querySelector('#btn-editor-undo').addEventListener('click', () => this.undo());
    this.overlayEl.querySelector('#btn-editor-redo').addEventListener('click', () => this.redo());

    const gridBtn = this.overlayEl.querySelector('#btn-editor-grid');
    gridBtn.addEventListener('click', () => {
      this.showGrid = !this.showGrid;
      gridBtn.classList.toggle('active', this.showGrid);
      this.markDirty();
    });

    this.overlayEl.querySelector('#editor-snap-select').addEventListener('change', (e) => {
      this.snapMode = parseInt(e.target.value, 10);
    });

    this.overlayEl.querySelector('#btn-editor-zoom-in').addEventListener('click', () => this.viewport.adjustZoomAt(1.25));
    this.overlayEl.querySelector('#btn-editor-zoom-out').addEventListener('click', () => this.viewport.adjustZoomAt(0.8));

    this.overlayEl.querySelector('#btn-editor-levels').addEventListener('click', () => this.levelsModal.open());
    this.overlayEl.querySelector('#btn-editor-save').addEventListener('click', () => this.save());
    this.overlayEl.querySelector('#btn-editor-export').addEventListener('click', () => this.exportJSON());

    const fileInput = this.overlayEl.querySelector('#editor-file-input');
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) this.importJSON(file);
      fileInput.value = '';
    });

    this.overlayEl.querySelector('#btn-editor-playtest').addEventListener('click', () => this.playtest());
    this.overlayEl.querySelector('#btn-editor-close').addEventListener('click', () => this.close());

    const categoryTabs = this.overlayEl.querySelectorAll('.editor-cat-tab');
    categoryTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        categoryTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentCategory = tab.dataset.category;
        if (this.currentCategory === 'terrain') {
          if (!['pencil1', 'brush3', 'rect', 'flood'].includes(this.currentTool)) {
            this.currentTool = 'pencil1';
          }
        } else {
          this.currentTool = 'select';
          this.selectedPaletteItem = null;
        }
        this._syncPanButtonUI();
        this.selectedObject = null;
        this.updateInspector();
        this._renderPalette();
        this.markDirty();
      });
    });
  }

  /** @private */
  _syncPanButtonUI() {
    const panBtn = this.overlayEl.querySelector('#btn-editor-pan');
    if (panBtn) panBtn.classList.toggle('active', this.currentTool === 'pan');
    if (this.canvas) this.canvas.style.cursor = this.currentTool === 'pan' ? 'grab' : 'crosshair';
  }

  /** @private */
  _togglePanTool() {
    if (this.currentTool === 'pan') {
      this.currentTool = this.currentCategory === 'terrain' ? 'pencil1' : 'select';
    } else {
      this.currentTool = 'pan';
    }
    this._syncPanButtonUI();
    this._renderPalette();
  }

  /**
   * Actualiza el bioma activo y reconstruye el `Tilemap` registrando el cambio en el historial.
   * @param {string} biomeKey
   */
  setBiome(biomeKey) {
    if (!BIOME_PALETTES[biomeKey]) return;
    this.commands.editLevelMeta({
      biome: biomeKey,
      layoutPreset: biomeKey,
      weather: WORLDS_CATALOG[biomeKey]?.weather || 'pollen'
    });
    this.tilemap.biomeKey = biomeKey;
    this.tilemap.layoutPreset = biomeKey;
    this.tilemap.build();
    this.showToast(`Bioma cambiado a: ${WORLDS_CATALOG[biomeKey]?.name || biomeKey}`);
    this.markDirty();
  }

  /**
   * Renderiza los botones de sub-herramientas y la paleta de la categoría activa.
   * @private
   */
  _renderPalette() {
    const subtoolsEl = this.overlayEl.querySelector('#editor-subtools');
    const itemsEl = this.overlayEl.querySelector('#editor-items-list');
    subtoolsEl.innerHTML = '';
    itemsEl.innerHTML = '';

    if (this.currentCategory === 'terrain') {
      subtoolsEl.innerHTML = `
        <button type="button" class="editor-subtool-btn ${this.currentTool === 'pencil1' ? 'active' : ''}" data-tool="pencil1" title="Lápiz 1x1 [1]">1x1</button>
        <button type="button" class="editor-subtool-btn ${this.currentTool === 'brush3' ? 'active' : ''}" data-tool="brush3" title="Pincel 3x3 [2]">3x3</button>
        <button type="button" class="editor-subtool-btn ${this.currentTool === 'rect' ? 'active' : ''}" data-tool="rect" title="Rectángulo Relleno [3]">Rect</button>
        <button type="button" class="editor-subtool-btn ${this.currentTool === 'flood' ? 'active' : ''}" data-tool="flood" title="Bote de Pintura (Relleno BFS) [4]">Bote</button>
      `;

      itemsEl.innerHTML = TILE_PALETTE.map(tile => `
        <button type="button" class="editor-palette-item ${this.selectedTileId === tile.id ? 'active' : ''}" data-tile-id="${tile.id}" title="${tile.name}">
          <span class="editor-tile-swatch" style="background:${tile.color};border-color:${tile.border};"></span>
          <span class="editor-palette-label">${tile.name}</span>
        </button>
      `).join('');

      subtoolsEl.querySelectorAll('[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
          subtoolsEl.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentTool = btn.dataset.tool;
          this._syncPanButtonUI();
        });
      });

      itemsEl.querySelectorAll('[data-tile-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          itemsEl.querySelectorAll('[data-tile-id]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.selectedTileId = parseInt(btn.dataset.tileId, 10);
          if (this.currentTool === 'pan') {
            this.currentTool = 'pencil1';
            this._syncPanButtonUI();
            this._renderPalette();
          }
        });
      });
    } else {
      subtoolsEl.innerHTML = `
        <button type="button" class="editor-subtool-btn ${this.currentTool === 'select' ? 'active' : ''}" data-tool="select" title="Seleccionar y Mover [V]">Mover</button>
      `;
      subtoolsEl.querySelector('[data-tool="select"]').addEventListener('click', () => {
        this.currentTool = 'select';
        this.selectedPaletteItem = null;
        this._syncPanButtonUI();
        subtoolsEl.querySelector('[data-tool="select"]').classList.add('active');
        itemsEl.querySelectorAll('.editor-palette-item').forEach(b => b.classList.remove('active'));
      });

      const customTemplates = this.currentCategory === 'props' ? listCustomPropTemplates() : [];
      const itemsByCategory = {
        props: [...PROP_CATALOG, ...customTemplates],
        structures: STRUCTURE_CATALOG,
        actors: ACTOR_CATALOG,
        zones: ZONE_CATALOG,
        lights: LIGHT_CATALOG
      };
      const items = itemsByCategory[this.currentCategory] || [];

      const escapeAttr = (str) => String(str || '').replace(/"/g, '&quot;');
      itemsEl.innerHTML = items.map((item, idx) => {
        const isSelected = this.selectedPaletteItem === item
          || (item.templateId && this.selectedPaletteItem?.templateId === item.templateId);
        const swatch = item.textureUrl
          ? `<img class="editor-palette-thumb" src="${escapeAttr(item.textureUrl)}" alt="" />`
          : `<span class="editor-tile-swatch" style="background:${item.color || '#38bdf8'};"></span>`;
        const delBtn = item.isCustomTemplate
          ? `<span class="editor-palette-del-tpl" data-delete-tpl-id="${escapeAttr(item.templateId)}" title="Eliminar plantilla de paleta">✕</span>`
          : '';
        return `
          <button type="button" class="editor-palette-item ${isSelected ? 'active' : ''}" data-palette-index="${idx}" title="${escapeAttr(item.name)}">
            ${swatch}
            <span class="editor-palette-label">${item.name}</span>
            ${delBtn}
          </button>
        `;
      }).join('');

      itemsEl.querySelectorAll('[data-delete-tpl-id]').forEach(del => {
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          const tplId = del.dataset.deleteTplId;
          if (deleteCustomPropTemplate(tplId)) {
            if (this.selectedPaletteItem?.templateId === tplId) {
              this.selectedPaletteItem = null;
              this.currentTool = 'select';
            }
            this._renderPalette();
            this.showToast('Plantilla eliminada de la paleta');
          }
        });
      });

      itemsEl.querySelectorAll('[data-palette-index]').forEach(btn => {
        btn.addEventListener('click', () => {
          itemsEl.querySelectorAll('.editor-palette-item').forEach(b => b.classList.remove('active'));
          subtoolsEl.querySelector('[data-tool="select"]').classList.remove('active');
          btn.classList.add('active');
          const idx = parseInt(btn.dataset.paletteIndex, 10);
          this.selectedPaletteItem = items[idx];
          this.currentTool = 'place';
          this._syncPanButtonUI();
        });
      });
    }
  }

  /**
   * Marca el lienzo como sucio y programa un único redibujado bajo demanda.
   */
  markDirty() {
    if (this._isDirty) return;
    this._isDirty = true;
    if (!this._rafId) {
      this._rafId = requestAnimationFrame(() => {
        this._rafId = null;
        this.render();
      });
    }
  }

  /** @private */
  _onResize() {
    if (!this.canvas || !this.overlayEl) return;
    const rect = this.overlayEl.getBoundingClientRect();
    const cssW = rect.width > 0 ? rect.width : window.innerWidth;
    const cssH = rect.height > 0 ? rect.height : window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._dpr = dpr;
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.markDirty();
  }

  /**
   * Ajusta una coordenada de mundo al snap activo.
   * @param {number} worldVal
   * @param {number} [snapSize=this.snapMode]
   * @returns {number}
   */
  snapCoord(worldVal, snapSize = this.snapMode) {
    if (snapSize <= 0) return Math.round(worldVal);
    return Math.round(worldVal / snapSize) * snapSize;
  }

  /** @private */
  _onKeyDown(e) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      this._togglePanTool();
      return;
    }

    if (e.key === 'g' || e.key === 'G') {
      this.showGrid = !this.showGrid;
      const gridBtn = this.overlayEl.querySelector('#btn-editor-grid');
      if (gridBtn) gridBtn.classList.toggle('active', this.showGrid);
      this.markDirty();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedObject) {
        e.preventDefault();
        this._deleteSelectedObject();
      }
      return;
    }

    if (e.key === 'F5') {
      e.preventDefault();
      this.playtest();
      return;
    }

    if (this.currentCategory === 'terrain') {
      const toolByKey = { '1': 'pencil1', '2': 'brush3', '3': 'rect', '4': 'flood' };
      if (toolByKey[e.key]) {
        this.currentTool = toolByKey[e.key];
        this._syncPanButtonUI();
        this._renderPalette();
        this.markDirty();
        return;
      }
    } else if (e.key === 'v' || e.key === 'V') {
      this.currentTool = 'select';
      this.selectedPaletteItem = null;
      this._syncPanButtonUI();
      this._renderPalette();
      this.markDirty();
      return;
    }

    if (e.key === 'Escape') {
      if (this.levelsModal && this.levelsModal.isOpen()) {
        this.levelsModal.close();
        return;
      }
      if (this.selectedObject) {
        this.selectedObject = null;
        this.updateInspector();
        this.markDirty();
      } else {
        this.close();
      }
    }
  }

  /**
   * Cancela cualquier trazo o arrastre en curso si entra un segundo dedo (pinch/pan multitáctil).
   * Revierte los deltas parciales para evitar puntos accidentales en el lienzo.
   * @private
   */
  _cancelActiveStroke() {
    if (this._isDrawingTerrain && this._activeStrokeDeltas.length > 0) {
      for (let i = this._activeStrokeDeltas.length - 1; i >= 0; i--) {
        const { col, row, oldId } = this._activeStrokeDeltas[i];
        this.tilemap.setTileAndInvalidate(col, row, oldId);
        this.draft.terrainGrid[row][col] = oldId;
      }
    }
    this._isDrawingTerrain = false;
    this._activeStrokeDeltas = [];
    this._rectStartTile = null;

    if (this._isDraggingObject && this.selectedObject && this._dragStartPos) {
      this.selectedObject.item.x = this._dragStartPos.x;
      this.selectedObject.item.y = this._dragStartPos.y;
    }
    if (this._isResizingZone && this.selectedObject && this._resizeStartDims) {
      this.selectedObject.item.width = this._resizeStartDims.width;
      this.selectedObject.item.height = this._resizeStartDims.height;
    }
    this._isDraggingObject = false;
    this._isResizingZone = false;
    this._dragStartPos = null;
    this._resizeStartDims = null;
    this.markDirty();
  }

  /** @private */
  _onSinglePointerDown(e) {
    const world = this.viewport.screenToWorld(e.clientX, e.clientY);
    this.pointerWorldPos = world;

    if (this.currentCategory === 'terrain') {
      const col = Math.floor(world.x / this.draft.tileSize);
      const row = Math.floor(world.y / this.draft.tileSize);

      if (this.currentTool === 'pencil1' || this.currentTool === 'brush3') {
        this._isDrawingTerrain = true;
        this._activeStrokeDeltas = [];
        this._applyTerrainBrush(col, row);
      } else if (this.currentTool === 'rect') {
        this._isDrawingTerrain = true;
        this._rectStartTile = { col, row };
      } else if (this.currentTool === 'flood') {
        this._executeFloodFill(col, row);
      }
      return;
    }

    if (this.currentTool === 'place' && this.selectedPaletteItem) {
      this._placeItemAt(world.x, world.y, this.selectedPaletteItem);
      return;
    }

    // Comprobar primero si pulsa sobre el asa de redimensionado de la zona seleccionada
    if (this.selectedObject && this._isOverResizeHandle(world.x, world.y, this.selectedObject)) {
      const item = this.selectedObject.item;
      this._isResizingZone = true;
      this._resizeStartDims = { width: item.width || 64, height: item.height || 64 };
      return;
    }

    // Selección y arrastre de objeto usando huella exacta top-left/center
    const hit = this._pickObjectAt(world.x, world.y);
    if (hit) {
      this.selectedObject = hit;
      this._isDraggingObject = true;
      this._dragStartPos = { x: hit.item.x, y: hit.item.y };
      this._dragOffset = { x: world.x - hit.item.x, y: world.y - hit.item.y };
      this.updateInspector();
      this.markDirty();
    } else {
      this.selectedObject = null;
      this.updateInspector();
      this.markDirty();
    }
  }

  /** @private */
  _onSinglePointerMove(e) {
    const world = this.viewport.screenToWorld(e.clientX, e.clientY);
    this.pointerWorldPos = world;

    if (this._isDrawingTerrain && (this.currentTool === 'pencil1' || this.currentTool === 'brush3')) {
      const col = Math.floor(world.x / this.draft.tileSize);
      const row = Math.floor(world.y / this.draft.tileSize);
      this._applyTerrainBrush(col, row);
    } else if (this._isResizingZone && this.selectedObject) {
      const item = this.selectedObject.item;
      const snapStep = this.snapMode > 0 ? this.snapMode : 16;
      const isCustomProp = this.selectedObject.category === 'props' && item.propType === 'custom_env_prop';
      const maxDim = isCustomProp ? 384 : Infinity;
      const nextW = Math.min(maxDim, Math.max(16, this.snapCoord(world.x - item.x, snapStep)));
      const nextH = Math.min(maxDim, Math.max(16, this.snapCoord(world.y - item.y, snapStep)));
      item.width = nextW;
      item.height = nextH;
      this.inspector.updateDimensions(nextW, nextH);
      this.markDirty();
    } else if (this._isDraggingObject && this.selectedObject) {
      const newX = this.snapCoord(world.x - this._dragOffset.x);
      const newY = this.snapCoord(world.y - this._dragOffset.y);
      this.selectedObject.item.x = newX;
      this.selectedObject.item.y = newY;
      this.inspector.updateCoordinates(newX, newY);
      this.markDirty();
    } else {
      this.markDirty();
    }
  }

  /** @private */
  _onSinglePointerUp() {
    if (this._isDrawingTerrain) {
      if (this.currentTool === 'rect' && this._rectStartTile) {
        const endCol = Math.floor(this.pointerWorldPos.x / this.draft.tileSize);
        const endRow = Math.floor(this.pointerWorldPos.y / this.draft.tileSize);
        this._applyTerrainRect(this._rectStartTile.col, this._rectStartTile.row, endCol, endRow);
        this._rectStartTile = null;
      } else if (this._activeStrokeDeltas.length > 0) {
        this.history.push({ type: 'tile_stroke', deltas: this._activeStrokeDeltas });
        this._activeStrokeDeltas = [];
      }
      this._isDrawingTerrain = false;
    }

    if (this._isResizingZone && this.selectedObject && this._resizeStartDims) {
      const item = this.selectedObject.item;
      const finalW = item.width;
      const finalH = item.height;
      // Restaurar brevemente para que EditorCommands registre el delta limpio old->new
      item.width = this._resizeStartDims.width;
      item.height = this._resizeStartDims.height;
      this.commands.editItem(this.selectedObject.category, item, { width: finalW, height: finalH });
      this._isResizingZone = false;
      this._resizeStartDims = null;
    }

    if (this._isDraggingObject && this.selectedObject && this._dragStartPos) {
      const item = this.selectedObject.item;
      const finalPos = { x: item.x, y: item.y };
      this.commands.moveItem(this.selectedObject.category, item, this._dragStartPos, finalPos);
      this._isDraggingObject = false;
      this._dragStartPos = null;
    }
  }

  /**
   * Comprueba si el puntero está sobre el asa de redimensionado de una zona seleccionada.
   * @private
   */
  _isOverResizeHandle(wx, wy, selected) {
    if (!selected) return false;
    const isZone = selected.category === 'solidColliders' || selected.category === 'stealthZones';
    const isCustomProp = selected.category === 'props' && selected.item?.propType === 'custom_env_prop';
    if (!isZone && !isCustomProp) {
      return false;
    }
    const b = getObjectBounds(selected.category, selected.item);
    const hx = b.x + b.width;
    const hy = b.y + b.height;
    const hitRadius = Math.max(12, RESIZE_HANDLE_WORLD_SIZE / this.viewport.zoom);
    return Math.abs(wx - hx) <= hitRadius && Math.abs(wy - hy) <= hitRadius;
  }

  /** @private */
  _applyTerrainBrush(col, row) {
    const radius = this.currentTool === 'brush3' ? 1 : 0;
    const tileId = this.selectedTileId;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = col + dx;
        const r = row + dy;
        if (c < 0 || c >= this.draft.cols || r < 0 || r >= this.draft.rows) continue;

        const oldId = this.tilemap.getTile(c, r);
        if (oldId !== tileId) {
          const changed = this.tilemap.setTileAndInvalidate(c, r, tileId);
          if (changed) {
            this.draft.terrainGrid[r][c] = tileId;
            this._activeStrokeDeltas.push({ col: c, row: r, oldId, newId: tileId });
          }
        }
      }
    }
    this.markDirty();
  }

  /** @private */
  _applyTerrainRect(c1, r1, c2, r2) {
    const minCol = Math.max(0, Math.min(c1, c2));
    const maxCol = Math.min(this.draft.cols - 1, Math.max(c1, c2));
    const minRow = Math.max(0, Math.min(r1, r2));
    const maxRow = Math.min(this.draft.rows - 1, Math.max(r1, r2));
    const tileId = this.selectedTileId;
    const deltas = [];

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const oldId = this.tilemap.getTile(c, r);
        if (oldId !== tileId) {
          this.tilemap.setTileAndInvalidate(c, r, tileId);
          this.draft.terrainGrid[r][c] = tileId;
          deltas.push({ col: c, row: r, oldId, newId: tileId });
        }
      }
    }

    if (deltas.length > 0) {
      this.history.push({ type: 'tile_stroke', deltas });
      this.markDirty();
    }
  }

  /** @private */
  _executeFloodFill(startCol, startRow) {
    if (startCol < 0 || startCol >= this.draft.cols || startRow < 0 || startRow >= this.draft.rows) return;
    const targetId = this.tilemap.getTile(startCol, startRow);
    const fillId = this.selectedTileId;
    if (targetId === fillId) return;

    const queue = [[startCol, startRow]];
    const visited = new Uint8Array(this.draft.cols * this.draft.rows);
    const deltas = [];
    const cols = this.draft.cols;
    const rows = this.draft.rows;
    let iterations = 0;
    const maxIterations = cols * rows;

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const [c, r] = queue.shift();
      const idx = r * cols + c;
      if (visited[idx]) continue;
      visited[idx] = 1;

      if (this.tilemap.getTile(c, r) === targetId) {
        this.tilemap.setTileAndInvalidate(c, r, fillId);
        this.draft.terrainGrid[r][c] = fillId;
        deltas.push({ col: c, row: r, oldId: targetId, newId: fillId });

        if (c > 0 && !visited[r * cols + (c - 1)]) queue.push([c - 1, r]);
        if (c < cols - 1 && !visited[r * cols + (c + 1)]) queue.push([c + 1, r]);
        if (r > 0 && !visited[(r - 1) * cols + c]) queue.push([c, r - 1]);
        if (r < rows - 1 && !visited[(r + 1) * cols + c]) queue.push([c, r + 1]);
      }
    }

    if (deltas.length > 0) {
      this.history.push({ type: 'tile_stroke', deltas });
      this.markDirty();
    }
  }

  /**
   * Coloca un elemento desde el catálogo declarativo alineándolo con la convención del motor
   * (top-left centrado bajo el cursor para entidades/props/zonas, centro directo para spawns/luces).
   * @private
   */
  _placeItemAt(worldX, worldY, itemDef) {
    const preview = createCatalogItem(itemDef, 0, 0);
    if (!preview) return;

    const fp = getObjectFootprint(preview.collection, preview.item);
    const rawX = fp.anchor === 'top-left' ? (worldX - fp.width / 2) : worldX;
    const rawY = fp.anchor === 'top-left' ? (worldY - fp.height / 2) : worldY;
    const placeX = this.snapCoord(rawX);
    const placeY = this.snapCoord(rawY);

    if (preview.isSpawn) {
      const targetKey = preview.spawnTarget;
      const targetObj = this.draft[targetKey];
      const oldPos = { ...targetObj };
      this.commands.moveItem(preview.collection, targetObj, oldPos, { x: placeX, y: placeY });
      this.selectedObject = { category: preview.collection, item: targetObj };
    } else {
      const created = createCatalogItem(itemDef, placeX, placeY);
      this.commands.addItem(created.collection, created.item);
      this.selectedObject = { category: created.collection, item: created.item };
    }

    this.updateInspector();
    this.markDirty();
  }

  /**
   * Selección precisa usando las cajas delimitadoras de `EntityFootprints`.
   * @private
   */
  _pickObjectAt(x, y) {
    const hitPoint = (cat, item) => {
      if (!item) return false;
      const b = getObjectBounds(cat, item);
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
    };

    if (hitPoint('player', this.draft.playerSpawn)) {
      return { category: 'player', item: this.draft.playerSpawn };
    }
    if (hitPoint('arena', this.draft.arenaCenter)) {
      return { category: 'arena', item: this.draft.arenaCenter };
    }

    const searchOrder = ['entities', 'props', 'clearingTrees', 'foliage', 'lights', 'solidColliders', 'stealthZones'];
    for (const category of searchOrder) {
      const list = this.draft[category];
      if (!Array.isArray(list)) continue;
      for (let i = list.length - 1; i >= 0; i--) {
        if (hitPoint(category, list[i])) {
          return { category, item: list[i] };
        }
      }
    }
    return null;
  }

  /** @private */
  _deleteSelectedObject() {
    if (!this.selectedObject) return;
    const { category, item } = this.selectedObject;

    if (category === 'player' || category === 'arena') {
      this.showToast('No puedes eliminar el punto de inicio del jugador ni el centro de arena.');
      return;
    }

    if (this.commands.removeItem(category, item)) {
      this.selectedObject = null;
      this.updateInspector();
      this.markDirty();
      this.showToast('Elemento eliminado');
    }
  }

  /**
   * Actualiza el panel contextual del Inspector.
   */
  updateInspector() {
    if (this.inspector) {
      this.inspector.render();
    }
  }

  /**
   * Deshace la última acción y sincroniza `Tilemap` / UI.
   */
  undo() {
    const changed = this.history.undo(this.draft, this.tilemap, (cols, rows, grid) => {
      this._rebuildTilemap(cols, rows, grid);
    });
    if (changed) {
      this._syncHeaderInputs();
      this.updateInspector();
      this.markDirty();
      this.showToast('Acción deshecha');
    }
  }

  /**
   * Rehace la última acción y sincroniza `Tilemap` / UI.
   */
  redo() {
    const changed = this.history.redo(this.draft, this.tilemap, (cols, rows, grid) => {
      this._rebuildTilemap(cols, rows, grid);
    });
    if (changed) {
      this._syncHeaderInputs();
      this.updateInspector();
      this.markDirty();
      this.showToast('Acción rehecha');
    }
  }

  /** @private */
  _rebuildTilemap(cols, rows, grid) {
    if (this.tilemap) this.tilemap.clearChunks();
    this.tilemap = this._createTilemap(cols, rows, this.draft.tileSize, this.draft.biome, grid);
  }

  /** @private */
  _syncHeaderInputs() {
    const nameInput = this.overlayEl.querySelector('#editor-level-name');
    if (nameInput) nameInput.value = this.draft.name;
    const biomeSelect = this.overlayEl.querySelector('#editor-biome-select');
    if (biomeSelect && BIOME_PALETTES[this.draft.biome]) biomeSelect.value = this.draft.biome;
    if (this.tilemap.biomeKey !== this.draft.biome) {
      this.tilemap.biomeKey = this.draft.biome;
      this.tilemap.layoutPreset = this.draft.biome;
      this.tilemap.build();
    }
  }

  /**
   * Guarda la zona actual mediante `levelRepository` y la registra en el motor para portales.
   */
  save() {
    const res = levelRepository.save(this.draft);
    if (res.ok) {
      this.showToast(`Zona "${this.draft.name}" guardada y vinculable por portales`);
    } else {
      this.showToast(res.error || 'Error al guardar la zona', true);
    }
  }

  /**
   * Exporta el borrador como archivo `.json`.
   */
  exportJSON() {
    const validation = validateLevel(this.draft);
    if (!validation.valid) {
      this.showToast(`Error: ${validation.errors[0]}`, true);
      return;
    }
    exportLevelToFile(this.draft);
    this.showToast(`Archivo "${this.draft.id}.json" generado y descargado`);
  }

  /**
   * Normaliza y carga un borrador en el editor preservando terreno procedural si procede.
   * @private
   */
  _loadDraftIntoEditor(rawDraft) {
    const normalized = normalizeLevel(rawDraft, {
      generateMissingGrid: (cols, rows, tileSize, layoutPreset) => {
        const tempMap = new Tilemap(cols, rows, tileSize, layoutPreset);
        return tempMap.grid;
      }
    });

    this.draft = normalized;
    this._rebuildTilemap(this.draft.cols, this.draft.rows, this.draft.terrainGrid);

    this.viewport.centerAt(
      (this.draft.cols * this.draft.tileSize) / 2,
      (this.draft.rows * this.draft.tileSize) / 2
    );
    this.selectedObject = null;
    this.history.clear();

    this._syncHeaderInputs();
    this.updateInspector();
    this._renderPalette();
    this.markDirty();
  }

  /**
   * Redimensiona el mapa actual preservando las losetas existentes y registrando el cambio en `EditorHistory`.
   * @param {number} newCols
   * @param {number} newRows
   */
  resizeLevel(newCols, newRows) {
    const cols = Math.max(16, Math.min(160, parseInt(newCols, 10) || this.draft.cols));
    const rows = Math.max(16, Math.min(120, parseInt(newRows, 10) || this.draft.rows));
    if (cols === this.draft.cols && rows === this.draft.rows) return;

    const oldCols = this.draft.cols;
    const oldRows = this.draft.rows;
    const oldGrid = this.draft.terrainGrid.map(row => row.slice());
    const newGrid = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => (this.draft.terrainGrid[r]?.[c] ?? 0))
    );

    this.draft.cols = cols;
    this.draft.rows = rows;
    this.draft.terrainGrid = newGrid;
    this._rebuildTilemap(cols, rows, newGrid);

    this.history.push({
      type: 'level_resize',
      oldCols,
      oldRows,
      oldGrid,
      newCols: cols,
      newRows: rows,
      newGrid: newGrid.map(r => r.slice())
    });

    this.markDirty();
    this.showToast(`Zona redimensionada a ${cols}×${rows} losetas`);
  }

  /**
   * Procesa la importación de un archivo `.json`.
   * @param {File} file
   */
  importJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loadedDraft = parseLevelFromJSON(e.target.result, {
          generateMissingGrid: (cols, rows, tileSize, layoutPreset) => {
            const tempMap = new Tilemap(cols, rows, tileSize, layoutPreset);
            return tempMap.grid;
          }
        });
        this._loadDraftIntoEditor(loadedDraft);
        this.showToast(`Zona "${this.draft.name}" importada exitosamente`);
      } catch (err) {
        console.error('[LevelEditor] Error importando JSON:', err);
        this.showToast('Archivo JSON no válido o corrupto', true);
      }
    };
    reader.readAsText(file);
  }

  /**
   * Inicia el Playtest en 1 clic registrando la zona y sincronizando las demás zonas del mundo.
   */
  playtest() {
    const validation = validateLevel(this.draft);
    if (!validation.valid) {
      this.showToast(`No se puede probar: ${validation.errors[0]}`, true);
      return;
    }

    levelRepository.syncAllToEngine();
    const playtestWorld = {
      ...cloneLevelDraft(this.draft),
      id: '__editor_playtest__'
    };
    registerCustomWorld(playtestWorld);

    this.overlayEl.classList.add('hidden');

    if (typeof this.onPlaytest === 'function') {
      this.onPlaytest('__editor_playtest__', this);
    }
  }

  /**
   * Reabre el editor tras finalizar un Playtest.
   */
  resumeFromPlaytest() {
    if (this.overlayEl) {
      this.overlayEl.classList.remove('hidden');
      this._onResize();
      this.markDirty();
    }
  }

  /**
   * Muestra un mensaje Toast temporal.
   * @param {string} msg
   * @param {boolean} [isError=false]
   */
  showToast(msg, isError = false) {
    if (!this.statusMsgEl) return;
    this.statusMsgEl.textContent = msg;
    this.statusMsgEl.classList.toggle('error', isError);
    this.statusMsgEl.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.statusMsgEl.classList.add('hidden');
    }, 2800);
  }

  /**
   * Delega el renderizado del fotograma actual a `EditorRenderer`.
   */
  render() {
    this._isDirty = false;
    this.renderer.render(this.ctx, {
      canvas: this.canvas,
      dpr: this._dpr,
      viewport: this.viewport,
      tilemap: this.tilemap,
      draft: this.draft,
      showGrid: this.showGrid,
      selectedObject: this.selectedObject,
      currentCategory: this.currentCategory,
      currentTool: this.currentTool,
      isDrawingTerrain: this._isDrawingTerrain,
      rectStartTile: this._rectStartTile,
      pointerWorldPos: this.pointerWorldPos,
      onAsyncAssetLoaded: () => this.markDirty()
    });
  }

  /**
   * Cierra el editor y libera escuchadores y cachés de chunks.
   */
  close() {
    window.removeEventListener('resize', this._boundResize);
    window.removeEventListener('keydown', this._boundKeyDown);

    if (this.viewport) {
      this.viewport.detach();
    }

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    if (this.tilemap) {
      this.tilemap.clearChunks();
    }

    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }

    _activeEditorInstance = null;

    if (typeof this.onExit === 'function') {
      this.onExit();
    }
  }
}

/**
 * Función de entrada dinámica para abrir la Forja de Mundos y Zonas.
 * @param {Object} [options={}]
 * @returns {LevelEditor}
 */
export function openLevelEditor(options = {}) {
  if (_activeEditorInstance) {
    _activeEditorInstance.resumeFromPlaytest();
    return _activeEditorInstance;
  }
  _activeEditorInstance = new LevelEditor(options);
  return _activeEditorInstance;
}

/**
 * Retorna la instancia activa del editor si existe.
 * @returns {LevelEditor|null}
 */
export function getActiveLevelEditor() {
  return _activeEditorInstance;
}
