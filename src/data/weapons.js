/**
 * @module weapons
 * @description Catálogo data-driven de los niveles de despertar y encantamientos de la Espada del Alba.
 * Todas las mejoras de filo son encantamientos progresivos sobre la misma espada ancestral de Santi,
 * preservando su identidad única mientras escala su daño, recarga elemental y efectos de remate (`finisherEffect`).
 * @author Be a Legend Team
 * @version 2.1.0
 */

export const WEAPONS = {
  training_sword: {
    id: 'training_sword',
    name: 'Espada del Alba · Filo Despierto',
    tierLabel: 'NIVEL I · ESTADO BASE',
    enchantmentColor: '#38bdf8',
    damage: 16,
    recoveryTime: 0.16, // 160ms de recovery para fluidez en combate
    duration: 0.20,     // 200ms de ventana activa de tajo
    knockback: 30,      // Fuerza de retroceso en píxeles
    lungeForce: 8,      // Push-Forward hacia adelante en píxeles
    energyOnHit: 2,     // Recarga moderada de energía elemental por golpe
    element: 'physical',
    unlockHint: 'Empuñada frente a la Cueva Hendida (Mundo 1).',
    description: 'La hoja ancestral ligada a la Reliquia. Su acero rúnico canaliza encantamientos elementales sin perder su esencia única.'
  },
  thorn_saber: {
    id: 'thorn_saber',
    name: 'Espada del Alba · Encantamiento de Zarza',
    tierLabel: 'NIVEL II · ENCANTAMIENTO SILVESTRE',
    enchantmentColor: '#4ade80',
    damage: 22,
    recoveryTime: 0.14,
    duration: 0.19,
    knockback: 32,
    lungeForce: 11,
    energyOnHit: 4,
    element: 'physical',
    finisherEffect: { tag: 'sangrado_espinas', duration: 3.0 },
    unlockHint: 'Bendición de Lira al rescatarla en el Pantano de Esporas (Mundo 2).',
    description: 'Imbuye la Espada del Alba con espinas druídicas vivas; su tercer tajo provoca sangrado continuo.'
  },
  forge_claymore: {
    id: 'forge_claymore',
    name: 'Espada del Alba · Temple de Magma',
    tierLabel: 'NIVEL III · TEMPLE ÍGNEO',
    enchantmentColor: '#fb923c',
    damage: 30,
    recoveryTime: 0.18,
    duration: 0.23,
    knockback: 46,
    lungeForce: 10,
    energyOnHit: 5,
    element: 'physical',
    finisherEffect: { tag: 'armor_break', duration: 3.2 },
    unlockHint: 'Relicario oculto tras la muralla de basalto en la Caldera de Ceniza (Mundo 3).',
    description: 'Templa la Espada del Alba en magma incandescente del Crisol; su tercer golpe quiebra defensas enemigas.'
  },
  relic_blade: {
    id: 'relic_blade',
    name: 'Espada del Alba · Cenit Astral',
    tierLabel: 'NIVEL IV · DESPERTAR SUPREMO',
    enchantmentColor: '#c084fc',
    damage: 34,
    recoveryTime: 0.11, // 110ms de recovery
    duration: 0.20,
    knockback: 42,
    lungeForce: 13,
    energyOnHit: 6,     // Recarga superior para el filo sagrado
    element: 'physical',
    unlockHint: 'Consagrado en la Galería Sur de la Ciudadela Astral (Mundo 4).',
    description: 'El despertar supremo de la Espada del Alba, imbuida con la resonancia astral pura de los cuatro núcleos.'
  }
};
