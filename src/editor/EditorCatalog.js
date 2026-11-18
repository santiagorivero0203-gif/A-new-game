/**
 * @module EditorCatalog
 * @description Catálogo unificado y declarativo de elementos, losetas, entidades, props y zonas
 * disponibles para el Creador de Niveles ("Forja de Mundos").
 * Consume las constantes del motor sin duplicar dimensiones ni arquetipos.
 * @author Be a Legend Team
 * @version 1.0.0
 */

import { ENEMY_ARCHETYPES } from '../entities/Enemy.js';
import { WORLDS_CATALOG } from '../data/worlds.js';

/**
 * Paleta de losetas lógicas reconocidas por el motor gráfico (Tilemap.js).
 * IDs canónicos 0 a 5.
 */
export const TILE_PALETTE = [
  { id: 0, key: 'grass', name: 'Césped Base', color: '#2d6a4f', border: '#1b4332', desc: 'Suelo caminable principal del bioma' },
  { id: 1, key: 'dirt', name: 'Sendero de Tierra', color: '#9c6644', border: '#7f4f24', desc: 'Caminos batidos y senderos de paso' },
  { id: 2, key: 'cliff', name: 'Acantilado Sólido', color: '#4a5568', border: '#2d3748', desc: 'Elevación infranqueable con sombra de gabinete' },
  { id: 3, key: 'liquid', name: 'Agua / Magma / Vacío', color: '#1d4ed8', border: '#1e40af', desc: 'Obstáculo líquido o abismo según bioma' },
  { id: 4, key: 'bridge', name: 'Puente de Madera', color: '#b45309', border: '#78350f', desc: 'Pasarela que permite cruzar sobre líquidos' },
  { id: 5, key: 'plaza', name: 'Plaza de Losas', color: '#94a3b8', border: '#64748b', desc: 'Piedra tallada del Santuario o terrazas' }
];

/**
 * Biomas disponibles para la atmósfera y paleta gráfica.
 */
export const BIOME_OPTIONS = Object.values(WORLDS_CATALOG).map(w => ({
  id: w.id,
  name: w.name,
  subtitle: w.subtitle,
  weather: w.weather,
  accentColor: w.accentColor,
  description: w.description
}));

/**
 * Tipos de Props interactivos con dimensiones canónicas y valores por defecto.
 */
export const PROP_CATALOG = [
  {
    type: 'custom_env_prop',
    collection: 'props',
    name: '✦ Objeto Personalizado',
    color: '#a855f7',
    width: 64,
    height: 64,
    defaultConfig: {
      customKey: 'nuevo_objeto',
      label: 'Objeto de Ambiente',
      devDescription: '',
      loreText: '',
      textureUrl: '',
      width: 64,
      height: 64,
      isSolid: true,
      isInteractable: true,
      tintColor: '#a855f7'
    },
    editableFields: []
  },
  {
    type: 'world_portal',
    collection: 'props',
    name: 'Portal / Conexión de Zona',
    width: 76,
    height: 76,
    defaultConfig: {
      portalColor: '#2dd4bf',
      targetWorld: 'marsh_of_spores',
      targetSpawnId: 'default',
      worldLabel: 'Pantano de Esporas'
    },
    editableFields: [
      { key: 'targetWorld', label: 'Zona / Mundo Destino', type: 'world_or_zone' },
      { key: 'targetSpawnId', label: 'ID de Entrada Destino', type: 'text' },
      { key: 'worldLabel', label: 'Etiqueta del Destino', type: 'text' },
      { key: 'portalColor', label: 'Color del Portal', type: 'color' }
    ]
  },
  {
    type: 'relic_pedestal',
    name: 'Pedestal de Reliquia',
    width: 56,
    height: 68,
    defaultConfig: {
      id: 'pedestal_element',
      label: 'Pedestal Elemental',
      grantsElement: 'Fuego'
    },
    editableFields: [
      { key: 'id', label: 'ID Único', type: 'text' },
      { key: 'label', label: 'Nombre en Pantalla', type: 'text' },
      { key: 'grantsElement', label: 'Poder que Otorga', type: 'select', options: ['Fuego', 'Embestida', 'Raíces', 'Sellado', 'All'] }
    ]
  },
  {
    type: 'sanctuary_altar',
    name: 'Altar del Santuario',
    width: 76,
    height: 102,
    defaultConfig: {
      id: 'sanctuary_altar',
      label: 'Altar de Resonancia Sagrada',
      grantsElement: 'All'
    },
    editableFields: [
      { key: 'id', label: 'ID Único', type: 'text' },
      { key: 'label', label: 'Nombre en Pantalla', type: 'text' }
    ]
  },
  {
    type: 'horde_totem',
    name: 'Tótem de Desafío / Horda',
    width: 56,
    height: 78,
    defaultConfig: {
      id: 'horde_totem',
      label: 'Estela de Desafío de Hordas'
    },
    editableFields: [
      { key: 'id', label: 'ID Único', type: 'text' },
      { key: 'label', label: 'Nombre en Pantalla', type: 'text' }
    ]
  },
  {
    type: 'runic_obelisk',
    name: 'Obelisco Rúnico (Lore)',
    width: 56,
    height: 88,
    defaultConfig: {
      runeColor: '#38bdf8',
      loreTitle: 'Obelisco de Sabiduría',
      loreText: 'Un fragmento de memoria antigua grabado sobre la piedra primordial.',
      essenceReward: 25
    },
    editableFields: [
      { key: 'loreTitle', label: 'Título del Lore', type: 'text' },
      { key: 'loreText', label: 'Texto de Crónica', type: 'textarea' },
      { key: 'runeColor', label: 'Color de Runas', type: 'color' },
      { key: 'essenceReward', label: 'Recompensa Esencia', type: 'number' }
    ]
  },
  {
    type: 'broken_statue',
    name: 'Efigie / Estatua Rota',
    width: 64,
    height: 80,
    defaultConfig: {
      biomeTint: 'forest',
      loreTitle: 'Centinela Caído',
      loreText: 'El antiguo guardián custodia los senderos olvidados.',
      essenceReward: 18
    },
    editableFields: [
      { key: 'loreTitle', label: 'Título del Lore', type: 'text' },
      { key: 'loreText', label: 'Texto de Crónica', type: 'textarea' },
      { key: 'essenceReward', label: 'Recompensa Esencia', type: 'number' }
    ]
  },
  {
    type: 'cracked_rock',
    name: 'Roca Agrietada (Destructible)',
    width: 64,
    height: 56,
    defaultConfig: {
      id: 'cracked_rock_block',
      label: 'Roca Mineral Agrietada'
    },
    editableFields: [
      { key: 'id', label: 'ID Único', type: 'text' },
      { key: 'label', label: 'Nombre en Pantalla', type: 'text' }
    ]
  },
  {
    type: 'burnable_vines',
    name: 'Zarzas Espinosas (Incinerables)',
    width: 72,
    height: 96,
    defaultConfig: {
      id: 'burnable_vines_gate',
      label: 'Zarzas Espinosas'
    },
    editableFields: [
      { key: 'id', label: 'ID Único', type: 'text' },
      { key: 'label', label: 'Nombre en Pantalla', type: 'text' }
    ]
  },
  {
    type: 'crystal_rock',
    name: 'Roca Cristalina',
    width: 64,
    height: 60,
    defaultConfig: {},
    editableFields: []
  },
  {
    type: 'cliff_rock',
    name: 'Peñasco de Risco',
    width: 64,
    height: 60,
    defaultConfig: {},
    editableFields: []
  },
  {
    type: 'starter_sword',
    name: 'Pedestal de Espada del Alba',
    width: 48,
    height: 58,
    defaultConfig: {
      id: 'starter_sword',
      label: 'Espada del Alba'
    },
    editableFields: [
      { key: 'id', label: 'ID Único', type: 'text' },
      { key: 'label', label: 'Nombre en Pantalla', type: 'text' }
    ]
  },
  {
    type: 'rusted_greatsword',
    name: 'Gran Espada Hundida (Lore)',
    width: 48,
    height: 56,
    defaultConfig: {
      loreTitle: 'Hoja Ancestral Olvidada',
      loreText: 'El filo yace inmóvil, recordando batallas de una era remota.',
      essenceReward: 15
    },
    editableFields: [
      { key: 'loreTitle', label: 'Título del Lore', type: 'text' },
      { key: 'loreText', label: 'Texto de Crónica', type: 'textarea' },
      { key: 'essenceReward', label: 'Recompensa Esencia', type: 'number' }
    ]
  },
  {
    type: 'cave_mouth',
    name: 'Boca de Cueva Hendida',
    width: 192,
    height: 156,
    defaultConfig: {
      id: 'cave_entrance'
    },
    editableFields: [
      { key: 'id', label: 'ID Único', type: 'text' }
    ]
  }
];

/**
 * Estructuras de entorno y vegetación (dimensiones canónicas de Tree, FoliageProp y House).
 */
export const STRUCTURE_CATALOG = [
  { kind: 'tree', collection: 'clearingTrees', name: 'Árbol Ancestral', width: 84, height: 98 },
  { kind: 'foliage', collection: 'foliage', name: 'Arbusto / Hierba Alta', width: 48, height: 44 },
  { kind: 'house', collection: 'entities', name: 'Cabaña del Sabio', width: 160, height: 144 }
];

/**
 * Zonas espaciales AABB (Colisionadores invisibles y hierba de sigilo).
 */
export const ZONE_CATALOG = [
  { type: 'solidCollider', collection: 'solidColliders', name: 'Barrera Sólida Invisible', width: 96, height: 64, color: '#ef4444' },
  { type: 'stealthZone', collection: 'stealthZones', name: 'Zona de Sigilo (Hierba)', width: 96, height: 64, color: '#22c55e' }
];

/**
 * Puntos de iluminación dinámica.
 */
export const LIGHT_CATALOG = [
  { type: 'pointLight', collection: 'lights', name: 'Punto de Luz Rúnica', width: 24, height: 24, color: '#facc15' }
];

/**
 * Catálogo de Actores: Jugador, NPCs y Arquetipos de Enemigos.
 */
export const ACTOR_CATALOG = [
  {
    category: 'player',
    name: 'Punto de Inicio de Santi',
    width: 32,
    height: 32,
    color: '#38bdf8'
  },
  {
    category: 'arena',
    name: 'Centro de Arena / Cámara',
    width: 32,
    height: 32,
    color: '#facc15'
  },
  {
    category: 'npc',
    variant: 'tarak',
    name: 'Sabio Tarak',
    width: 32,
    height: 48,
    defaultConfig: {
      name: 'Sabio Tarak',
      variant: 'tarak'
    }
  },
  {
    category: 'npc',
    variant: 'valerio',
    name: 'Valerio el Viajero',
    width: 32,
    height: 48,
    defaultConfig: {
      name: 'Valerio el Viajero',
      variant: 'valerio',
      rescueTag: 'ambush_valerio'
    }
  },
  ...Object.keys(ENEMY_ARCHETYPES).map(archetype => ({
    category: 'enemy',
    archetype,
    name: `Enemigo: ${archetype.toUpperCase()}`,
    width: 36,
    height: 44,
    defaultConfig: {
      type: 'enemy',
      archetype,
      element: 'plantas',
      name: `Guardián ${archetype}`,
      hasWoodenShield: archetype === 'tank',
      noRespawn: false,
      customTags: []
    }
  }))
];

/**
 * Elementos mágicos disponibles para enemigos y pedestales.
 */
export const ELEMENT_OPTIONS = ['plantas', 'fuego', 'kinetic', 'tierra'];

/**
 * Fábrica declarativa unificada para instanciar un objeto plano de borrador desde cualquier catálogo.
 * Evita ramas condicionales duplicadas al añadir nuevos props, estructuras, zonas o actores.
 * @param {Object} itemDef - Descriptor del catálogo
 * @param {number} x - Coordenada X canónica (top-left para entidades/props/zonas, centro para spawns/luces)
 * @param {number} y - Coordenada Y canónica
 * @returns {{ collection: string, item: Object, isSpawn?: boolean, spawnTarget?: 'playerSpawn'|'arenaCenter' }}
 */
export function createCatalogItem(itemDef, x, y) {
  if (!itemDef) return null;

  if (itemDef.category === 'player') {
    return { collection: 'player', isSpawn: true, spawnTarget: 'playerSpawn', item: { x, y } };
  }
  if (itemDef.category === 'arena') {
    return { collection: 'arena', isSpawn: true, spawnTarget: 'arenaCenter', item: { x, y } };
  }
  if (itemDef.category === 'enemy' || itemDef.category === 'npc') {
    return {
      collection: 'entities',
      item: {
        type: itemDef.category,
        x,
        y,
        ...(itemDef.defaultConfig || {}),
        customTags: itemDef.defaultConfig?.customTags ? [...itemDef.defaultConfig.customTags] : []
      }
    };
  }
  if (itemDef.kind === 'tree') {
    return { collection: 'clearingTrees', item: { x, y } };
  }
  if (itemDef.kind === 'foliage') {
    return { collection: 'foliage', item: { x, y } };
  }
  if (itemDef.kind === 'house') {
    return { collection: 'entities', item: { type: 'house', x, y } };
  }
  if (itemDef.type === 'solidCollider' || itemDef.type === 'stealthZone') {
    return {
      collection: itemDef.type === 'solidCollider' ? 'solidColliders' : 'stealthZones',
      item: { x, y, width: itemDef.width || 96, height: itemDef.height || 64 }
    };
  }
  if (itemDef.type === 'pointLight') {
    return {
      collection: 'lights',
      item: { x, y, radius: 180, color: '#facc15', intensity: 0.75, flickerSpeed: 1.5 }
    };
  }

  // Props estándar
  return {
    collection: 'props',
    item: {
      propType: itemDef.type,
      x,
      y,
      ...(itemDef.defaultConfig ? { ...itemDef.defaultConfig } : {})
    }
  };
}

/** Llave de persistencia para plantillas reutilizables de objetos personalizados en la paleta */
export const CUSTOM_PROPS_STORAGE_KEY = 'be_a_legend_custom_props_v1';

/**
 * Lista las plantillas de objetos de ambiente personalizados guardadas en `localStorage`.
 * Cada plantilla conserva el formato de entrada de `PROP_CATALOG` para su uso directo con `createCatalogItem`.
 * @returns {Array<Object>}
 */
export function listCustomPropTemplates() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CUSTOM_PROPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[EditorCatalog] No se pudieron leer las plantillas personalizadas:', err);
    return [];
  }
}

/**
 * Guarda o actualiza en `localStorage` una plantilla reutilizable a partir de un `custom_env_prop`.
 * @param {Object} propItem - Instancia de objeto personalizado configurado en el editor
 * @returns {{ ok: boolean, template?: Object, error?: string }}
 */
export function saveCustomPropTemplate(propItem) {
  if (!propItem || typeof localStorage === 'undefined') {
    return { ok: false, error: 'Almacenamiento local no disponible.' };
  }

  const cleanKey = (propItem.customKey || '').trim() || 'objeto_personalizado';
  const cleanLabel = (propItem.label || '').trim() || cleanKey;
  const width = Math.max(16, Math.min(384, Number(propItem.width) || 64));
  const height = Math.max(16, Math.min(384, Number(propItem.height) || 64));
  const tintColor = propItem.tintColor || '#a855f7';
  const textureUrl = propItem.textureUrl || '';

  const templates = listCustomPropTemplates();
  const existingIdx = templates.findIndex(
    t => t.defaultConfig?.customKey === cleanKey && cleanKey !== 'nuevo_objeto'
  );

  const templateId = existingIdx >= 0
    ? templates[existingIdx].templateId
    : `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const template = {
    templateId,
    isCustomTemplate: true,
    type: 'custom_env_prop',
    collection: 'props',
    name: cleanLabel,
    color: tintColor,
    width,
    height,
    textureUrl,
    defaultConfig: {
      customKey: cleanKey,
      label: cleanLabel,
      devDescription: propItem.devDescription || '',
      loreText: propItem.loreText || '',
      textureUrl,
      width,
      height,
      isSolid: propItem.isSolid !== false,
      isInteractable: propItem.isInteractable !== false,
      tintColor
    },
    editableFields: []
  };

  if (existingIdx >= 0) {
    templates[existingIdx] = template;
  } else {
    templates.push(template);
  }

  try {
    localStorage.setItem(CUSTOM_PROPS_STORAGE_KEY, JSON.stringify(templates));
    return { ok: true, template };
  } catch (err) {
    const isQuota = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
    console.warn('[EditorCatalog] Error guardando plantilla personalizada:', err);
    return {
      ok: false,
      error: isQuota
        ? 'Espacio insuficiente en almacenamiento local para guardar la textura.'
        : 'No se pudo guardar la plantilla personalizada.'
    };
  }
}

/**
 * Elimina una plantilla de objeto personalizado de `localStorage` por su `templateId`.
 * @param {string} templateId
 * @returns {boolean}
 */
export function deleteCustomPropTemplate(templateId) {
  if (!templateId || typeof localStorage === 'undefined') return false;
  try {
    const next = listCustomPropTemplates().filter(t => t.templateId !== templateId);
    localStorage.setItem(CUSTOM_PROPS_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch (err) {
    console.warn('[EditorCatalog] Error eliminando plantilla personalizada:', err);
    return false;
  }
}

