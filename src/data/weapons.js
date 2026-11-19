/**
 * @module weapons
 * @description Catálogo data-driven de armas cuerpo a cuerpo del juego.
 * Define daño base, tiempos de recuperación (cooldown), duración del tajo, fuerza de knockback
 * y efectos de remate en el 3er golpe (`finisherEffect`).
 * @author Be a Legend Team
 * @version 2.0.0
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
    unlockHint: 'Empuñada frente a la Cueva Hendida (Mundo 1).',
    description: 'Espada de acero forjada para guardias y cadetes del reino.'
  },
  thorn_saber: {
    id: 'thorn_saber',
    name: 'Sable de Espino Vivo',
    damage: 22,
    recoveryTime: 0.14,
    duration: 0.19,
    knockback: 32,
    lungeForce: 11,
    energyOnHit: 4,
    element: 'physical',
    finisherEffect: { tag: 'sangrado_espinas', duration: 3.0 },
    unlockHint: 'Rescata al vigía en el Pantano de Esporas (Mundo 2).',
    description: 'Hoja curva recubierta de espinas druídicas cuyo remate provoca sangrado continuo.'
  },
  forge_claymore: {
    id: 'forge_claymore',
    name: 'Mandoble del Crisol',
    damage: 30,
    recoveryTime: 0.18,
    duration: 0.23,
    knockback: 46,
    lungeForce: 10,
    energyOnHit: 5,
    element: 'physical',
    finisherEffect: { tag: 'armor_break', duration: 3.2 },
    unlockHint: 'Oculto tras la muralla de basalto en la Caldera de Ceniza (Mundo 3).',
    description: 'Espadón pesado templado en magma; su tercer golpe quiebra defensas enemigas.'
  },
  relic_blade: {
    id: 'relic_blade',
    name: 'Filo Sagrado de la Reliquia',
    damage: 34,
    recoveryTime: 0.11, // 110ms de recovery
    duration: 0.20,
    knockback: 42,
    lungeForce: 13,
    energyOnHit: 6,     // Recarga superior para el filo sagrado
    element: 'physical',
    unlockHint: 'Consagrado en la Galería Sur de la Ciudadela Astral (Mundo 4).',
    description: 'Espada ceremonial imbuida con resonancia elemental arcana.'
  }
};
