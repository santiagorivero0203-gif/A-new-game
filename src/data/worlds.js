/**
 * @module worlds
 * @description Catálogo oficial de los 4 Mundos / Biomas de *Be a Legend: El Legado de la Reliquia*.
 * Centraliza los archivos JSON de nivel, colores temáticos, clima de partículas
 * y resúmenes narrativos para `main.js` y el Atlas del Códice en `UIManager.js`.
 *
 * @author Be a Legend Team
 * @version 1.0.0
 */
import caveExitIntro from './levels/cave_exit_intro.json';
import marshOfSpores from './levels/marsh_of_spores.json';
import ashCaldera from './levels/ash_caldera.json';
import astralCitadel from './levels/astral_citadel.json';

/**
 * Metadatos y definiciones de los 4 mundos explorables.
 * @constant {Record<string, Object>}
 */
export const WORLDS_CATALOG = {
  cave_exit_intro: {
    id: 'cave_exit_intro',
    index: 1,
    name: 'Claro de las Reliquias',
    subtitle: 'Mundo 1 · Valle del Despertar',
    biome: 'cave_exit_intro',
    weather: 'pollen',
    accentColor: '#4ade80',
    description: 'Praderas verdes, ruinas musgosas y la cueva donde Santi empuña el Guantelete Elemental por primera vez.',
    data: caveExitIntro
  },
  marsh_of_spores: {
    id: 'marsh_of_spores',
    index: 2,
    name: 'Pantano de Esporas',
    subtitle: 'Mundo 2 · Marismas Bioluminiscentes',
    biome: 'marsh_of_spores',
    weather: 'spores',
    accentColor: '#2dd4bf',
    description: 'Lagos turquesa iluminados por esporas flotantes, pasarelas antiguas y slimes mutados.',
    data: marshOfSpores
  },
  ash_caldera: {
    id: 'ash_caldera',
    index: 3,
    name: 'Caldera de Ceniza',
    subtitle: 'Mundo 3 · Forja Volcánica',
    biome: 'ash_caldera',
    weather: 'embers',
    accentColor: '#fb923c',
    description: 'Ríos de magma incandescente, ceniza ardiente y guardianes blindados de Fuego y Cinética.',
    data: ashCaldera
  },
  astral_citadel: {
    id: 'astral_citadel',
    index: 4,
    name: 'Ciudadela Astral',
    subtitle: 'Mundo 4 · Santuario del Cenit',
    biome: 'astral_citadel',
    weather: 'stardust',
    accentColor: '#c084fc',
    description: 'Terrazas de cuarzo suspendidas sobre éter estelar donde convergen los obeliscos primordiales.',
    data: astralCitadel
  }
};

/** Lista ordenada de los mundos para itinerarios del Atlas */
export const WORLDS_LIST = [
  WORLDS_CATALOG.cave_exit_intro,
  WORLDS_CATALOG.marsh_of_spores,
  WORLDS_CATALOG.ash_caldera,
  WORLDS_CATALOG.astral_citadel
];

