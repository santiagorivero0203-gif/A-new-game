/**
 * @file PlayerStats.js
 * @description Parámetros y estadísticas base calibradas para el héroe (Santi).
 * Velocidad ágil y responsiva (190 px/s) con tasa de recarga de energía táctica medida (2.2/s),
 * evitando tanto el desplazamiento pesado como la recarga instantánea de energía.
 */
export const PLAYER_STATS = {
  health: 3,
  max_health: 3,
  energy: 100,
  max_energy: 100,
  energy_regen_rate: 2.2, // Tasa moderada para que la energía sea un recurso táctico medido
  guard_meter: 100,
  max_guard: 100,
  speed: 190, // Velocidad base ágil y precisa para exploración y combate fluido
  
  // Combate & Utilidad
  dash_cost: 15,
  dash_cooldown_base: 0.36,
  dash_cooldown_upgraded: 0.22,
  dash_speed: 400, // Deslizamiento ágil y responsivo sin salto desmedido
  dash_duration: 0.20,
  slide_speed: 330,
  slide_duration: 0.34,
  slide_cooldown: 0.25,
  dive_cost: 12,
  dive_speed: 445,
  dive_duration: 0.30,
  dive_cooldown: 0.42,
  heal_cost: 35,
  heal_cooldown: 1.2,
  sword_cooldown: 0.08,
  guard_break_duration: 1.8,
  parry_window_base: 0.16,
  parry_window_upgraded: 0.26
};
