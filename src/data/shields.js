/**
 * @module shields
 * @description Catálogo data-driven de escudos y defensas del jugador.
 * Define la tasa de drenaje de postura, capacidad de reflejar proyectiles y debilidades elementales reactivas.
 * @author Be a Legend Team
 * @version 2.0.0
 */

export const SHIELDS = {
  wooden_shield: {
    id: 'wooden_shield',
    name: 'Escudo de Roble',
    posture_drain_rate: 1.0,        // 1.0 = drenaje estándar
    can_reflect_projectiles: true,   // Permite Parry Deportivo a proyectiles
    elemental_weakness: 'fuego',     // Débil a fuego (x2.5 coste de postura)
    unlockHint: 'Equipado al iniciar la travesía.',
    description: 'Escudo robusto tallado en roble milenario con refuerzos de cuero.'
  },
  iron_pavise: {
    id: 'iron_pavise',
    name: 'Broquel de Acero Templado',
    posture_drain_rate: 0.65,       // Mitiga 35% extra de postura
    can_reflect_projectiles: true,
    elemental_weakness: null,       // Sin debilidad elemental
    unlockHint: 'Auxilia a Valerio en el sendero norte del Claro (Mundo 1).',
    description: 'Broquel de aleación forjado para desviar impactos brutales sin arder.'
  },
  obsidian_aegis: {
    id: 'obsidian_aegis',
    name: 'Égida de Obsidiana',
    posture_drain_rate: 0.50,       // Mitiga 50% de drenaje de postura
    can_reflect_projectiles: true,
    elemental_weakness: null,
    unlockHint: 'Auxilia al Maestro Herrero en la Caldera de Ceniza (Mundo 3).',
    description: 'Escudo volcánico de obsidiana astral capaz de absorber golpes de titanes.'
  }
};
