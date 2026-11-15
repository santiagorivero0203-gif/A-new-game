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
    recoveryTime: 0.16, // 160ms de recovery para fluidez en combate
    duration: 0.20,     // 200ms de ventana activa de tajo
    knockback: 30,      // Fuerza de retroceso en píxeles
    lungeForce: 8,      // Push-Forward hacia adelante en píxeles
    energyOnHit: 2,     // Recarga moderada de energía elemental por golpe
    element: 'physical',
    description: 'Espada de acero forjada para guardias y cadetes del reino.'
  },
  relic_blade: {
    id: 'relic_blade',
    name: 'Filo Sagrado de la Reliquia',
    damage: 28,
    recoveryTime: 0.12, // 120ms de recovery
    duration: 0.20,
    knockback: 40,
    lungeForce: 12,
    energyOnHit: 4,     // Recarga equilibrada para el filo sagrado
    element: 'physical',
    description: 'Espada ceremonial imbuida con resonancia elemental arcana.'
  }
};
