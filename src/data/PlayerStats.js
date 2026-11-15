/**
 * @file PlayerStats.js
 * @description Parámetros y estadísticas base calibradas para el héroe (Santi).
 * Modificado para ofrecer un ritmo de desplazamiento controlado (155 px/s) y una tasa de
 * recarga de energía táctica y medida (2.2/s), evitando que la barra se llene de forma instantánea.
 */
export const PLAYER_STATS = {
  health: 3,
  max_health: 3,
  energy: 100,
  max_energy: 100,
  energy_regen_rate: 2.2, // Tasa moderada para que la energía sea un recurso táctico medido
  guard_meter: 100,
  max_guard: 100,
  speed: 155, // Velocidad base optimizada y calibrada (controlada y precisa)
  
  // Combate & Utilidad
  dash_cost: 15,
  dash_cooldown_base: 0.40,
  dash_cooldown_upgraded: 0.25,
  dash_speed: 360, // Deslizamiento ágil sin salto desmedido
  dash_duration: 0.20,
  heal_cost: 35,
  heal_cooldown: 1.2,
  sword_cooldown: 0.08,
  guard_break_duration: 1.8,
  parry_window_base: 0.16,
  parry_window_upgraded: 0.26
};
