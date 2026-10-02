/**
 * @module shields
 * @description Catálogo data-driven de escudos y defensas del jugador.
 * Define la tasa de drenaje de postura, capacidad de reflejar proyectiles y debilidades elementales reactivas.
 */

export const SHIELDS = {
  wooden_shield: {
    id: 'wooden_shield',
    name: 'Escudo de Roble',
    posture_drain_rate: 1.0,        // 1.0 = drenaje estándar
    can_reflect_projectiles: true,   // Permite Parry Deportivo a proyectiles
    elemental_weakness: 'fuego',     // Débil a fuego (x5 coste de postura o ignición)
    description: 'Escudo robusto tallado en roble milenario con refuerzos de cuero.'
  },
  iron_pavise: {
    id: 'iron_pavise',
    name: 'Broquel de Acero Templado',
    posture_drain_rate: 0.65,       // Mitiga 35% extra de postura
    can_reflect_projectiles: true,
    elemental_weakness: null,       // Sin debilidad elemental
    description: 'Broquel de aleación forjado para desviar impactos brutales.'
  }
};
