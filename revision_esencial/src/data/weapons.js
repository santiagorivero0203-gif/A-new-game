/**
 * @module weapons
 * @description Catálogo data-driven de armas cuerpo a cuerpo del juego.
 * Define daño base, tiempos de recuperación (cooldown), duración del tajo y fuerza de knockback.
 */

export const WEAPONS = {
  training_sword: {
    id: 'training_sword',
    name: 'Espada de Práctica',
    damage: 16,
    recoveryTime: 0.38, // 380ms de recovery anti-spam
    duration: 0.22,     // 220ms de ventana activa de tajo
    knockback: 32,      // Fuerza de retroceso en píxeles
    lungeForce: 10,     // Push-Forward hacia adelante en píxeles
    energyOnHit: 6,     // Recarga activa de energía elemental
    element: 'physical',
    description: 'Espada de acero forjada para guardias y cadetes del reino.'
  },
  relic_blade: {
    id: 'relic_blade',
    name: 'Filo Sagrado de la Reliquia',
    damage: 28,
    recoveryTime: 0.28,
    duration: 0.22,
    knockback: 42,
    lungeForce: 14,
    energyOnHit: 10,
    element: 'physical',
    description: 'Espada ceremonial imbuida con resonancia elemental arcana.'
  }
};
