/**
 * @file PlayerStats.js
 * @description Parámetros y estadísticas base calibradas para el héroe (Santi).
 * Velocidad controlada y precisa (168 px/s) con tasa de recarga de energía táctica medida (2.2/s),
 * brindando un desplazamiento con peso táctico sin sentirse excesivamente rápido.
 */
export const PLAYER_STATS = {
  health: 3,
  max_health: 3,
  energy: 100,
  max_energy: 100,
  energy_regen_rate: 2.2, // Tasa moderada para que la energía sea un recurso táctico medido
  guard_meter: 100,
  max_guard: 100,
  speed: 168, // Velocidad base calibrada para exploración precisa y combate con control táctico
  
  // Combate & Utilidad
  dash_cost: 15,
  dash_cooldown_base: 0.36,
  dash_cooldown_upgraded: 0.22,
  dash_speed: 365, // Deslizamiento ágil y controlado sin salto desmedido
  dash_duration: 0.20,
  slide_speed: 300,
  slide_duration: 0.34,
  slide_cooldown: 0.25,
  dive_cost: 12,
  dive_speed: 405,
  dive_duration: 0.30,
  dive_cooldown: 0.42,
  heal_cost: 35,
  heal_cooldown: 1.2,
  sword_cooldown: 0.08,
  guard_break_duration: 1.8,
  parry_window_base: 0.16,
  parry_window_upgraded: 0.26
};
