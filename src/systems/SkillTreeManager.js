/**
 * @module SkillTreeManager
 * @description Gestor del Árbol de Maestría del Santuario de 36 Nodos (3 Disciplinas × 3 Ramas × 4 Tiers)
 * con soporte **Multi-Rango** (`maxRank: 1..3`), costes escalables (`costScale`), requisitos de
 * inversión por disciplina (`reqTreePoints`) y migración automática desde v2.
 *
 * Mantiene sincronizados los 18 IDs clásicos junto a los 18 nuevos talentos avanzados de Tier 3 y Rama 2,
 * exponiendo tanto `hasSkill(id)` como `getSkillRank(id)` para escalado numérico en combate.
 *
 * @author Be a Legend Team
 * @version 3.0.0
 */

const STORAGE_KEYS = {
  SKILLS_LEGACY_V2: 'be_a_legend_skills_v2',
  SKILL_RANKS_V3: 'be_a_legend_skill_ranks_v3',
  ESSENCE: 'be_a_legend_essence_v2'
};

/**
 * Requisitos de puntos acumulados en una disciplina para desbloquear cada Tier.
 * @constant {Record<number, number>}
 */
export const TIER_POINT_REQUIREMENTS = {
  0: 0,
  1: 2,
  2: 5,
  3: 8
};

export class SkillTreeManager {
  /**
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=null]
   */
  constructor(stateManager = null) {
    /** @type {import('../core/StateManager.js').StateManager|null} */
    this.state = stateManager;

    /** @type {number} Esencia Antigua disponible para invertir en el Santuario */
    this.essence = 40;

    /** @type {Record<string, number>} Mapa de rangos adquiridos por `skillId` */
    this.skillRanks = {};

    /** @type {Set<string>} Vista booleana compatible (`rank >= 1`) */
    this.unlockedSkills = new Set();

    /** @type {number|null} Handle para debounce de persistencia */
    this._saveTimer = null;

    /**
     * Definición oficial de 36 habilidades organizadas en 3 Disciplinas × 3 Ramas × 4 Tiers.
     * @type {Record<string, Object>}
     */
    this.skills = {
      // =====================================================================
      // 1. DISCIPLINA ÉGIDA Y PARRY (`aegis`) — 12 Habilidades
      // =====================================================================
      // --- Rama 0: Guardia Inquebrantable ---
      parry_window: {
        id: 'parry_window',
        name: 'Reflejos del Guardián',
        description: 'Amplía la ventana temporal para ejecutar un Parry Perfecto tras alzar el escudo.',
        mechanicsText: 'Ventana base 0.16s ➔ hasta 0.28s según rango.',
        tree: 'aegis',
        tier: 0,
        lane: 0,
        dependsOn: [],
        reqTreePoints: 0,
        maxRank: 3,
        cost: 25,
        costScale: 1.45,
        badge: 'PARRY',
        svgType: 'shield'
      },
      aegis_counter: {
        id: 'aegis_counter',
        name: 'Contra-Estallido Solar',
        description: 'Un Parry Perfecto detona una onda expansiva radial que daña y aturde enemigos próximos.',
        mechanicsText: 'Onda radial tras Parry; Rango 2 aumenta radio y daño sísmico +35%.',
        tree: 'aegis',
        tier: 1,
        lane: 0,
        dependsOn: ['parry_window'],
        reqTreePoints: 2,
        maxRank: 2,
        cost: 45,
        costScale: 1.5,
        badge: 'PARRY II',
        svgType: 'shield_burst'
      },
      mirror_ricochet: {
        id: 'mirror_ricochet',
        name: 'Espejo Astral',
        description: 'Los Ripostes críticos sobre enemigos aturdidos infligen daño masivo y potencian el contraataque.',
        mechanicsText: 'Multiplicador de Riposte x3.0 ➔ x3.8 (R1) / x4.4 (R2).',
        tree: 'aegis',
        tier: 2,
        lane: 0,
        dependsOn: ['aegis_counter'],
        reqTreePoints: 5,
        maxRank: 2,
        cost: 70,
        costScale: 1.5,
        badge: 'CRÍTICO',
        svgType: 'mirror_prism'
      },
      bastion_immortal: {
        id: 'bastion_immortal',
        name: 'Bastión Inmortal',
        description: 'Maestría suprema de guardia: todo Parry exitoso restaura Postura al instante y otorga 0.35s de invulnerabilidad.',
        mechanicsText: 'Capstone: +28 Postura y ventana inmune 0.35s al ejecutar Parry.',
        tree: 'aegis',
        tier: 3,
        lane: 0,
        dependsOn: ['mirror_ricochet'],
        reqTreePoints: 8,
        maxRank: 1,
        cost: 115,
        costScale: 1.0,
        badge: 'CAPSTONE',
        svgType: 'bastion_crown'
      },

      // --- Rama 1: Resiliencia Vital ---
      vital_surge: {
        id: 'vital_surge',
        name: 'Vigor del Núcleo',
        description: 'Potencia el pulso curativo del Santuario y otorga estabilidad vital prolongada.',
        mechanicsText: 'Aumenta duración/eficacia del escudo curativo (+35% por rango).',
        tree: 'aegis',
        tier: 0,
        lane: 1,
        dependsOn: [],
        reqTreePoints: 0,
        maxRank: 3,
        cost: 25,
        costScale: 1.45,
        badge: 'VITAL',
        svgType: 'heart_plus'
      },
      iron_posture: {
        id: 'iron_posture',
        name: 'Temple de Acero',
        description: 'Endurece la guardia de Santi reduciendo la pérdida de Postura al bloquear golpes pesados.',
        mechanicsText: '-15% / -28% / -40% daño a Postura y +20% recuperación pasiva.',
        tree: 'aegis',
        tier: 1,
        lane: 1,
        dependsOn: ['vital_surge'],
        reqTreePoints: 2,
        maxRank: 3,
        cost: 40,
        costScale: 1.45,
        badge: 'POSTURA',
        svgType: 'iron_tower'
      },
      max_health_up: {
        id: 'max_health_up',
        name: 'Corazón del Santuario',
        description: 'Incrementa permanentemente tus corazones máximos y libera una Supernova al curarte.',
        mechanicsText: '+1 Corazón máximo por rango (hasta 5 corazones totales).',
        tree: 'aegis',
        tier: 2,
        lane: 1,
        dependsOn: ['iron_posture'],
        reqTreePoints: 5,
        maxRank: 2,
        cost: 75,
        costScale: 1.55,
        badge: 'CORAZÓN',
        svgType: 'crystal_heart'
      },
      undying_resolve: {
        id: 'undying_resolve',
        name: 'Voluntad Inquebrantable',
        description: 'Cuando un golpe fatal fuera a derribarte, consume 15 de Energía para sobrevivir con 1 Corazón.',
        mechanicsText: 'Capstone: Salva letal automática (enfriamiento 45s) + pulso repelente.',
        tree: 'aegis',
        tier: 3,
        lane: 1,
        dependsOn: ['max_health_up'],
        reqTreePoints: 8,
        maxRank: 1,
        cost: 120,
        costScale: 1.0,
        badge: 'CAPSTONE',
        svgType: 'undying_phoenix'
      },

      // --- Rama 2: Sangre Fría & Sifón ---
      guardian_stride: {
        id: 'guardian_stride',
        name: 'Paso Firme',
        description: 'Mejora la movilidad mientras sostienes el escudo alzado frente a ataques múltiples.',
        mechanicsText: '+18% velocidad al defender por rango.',
        tree: 'aegis',
        tier: 0,
        lane: 2,
        dependsOn: [],
        reqTreePoints: 0,
        maxRank: 3,
        cost: 25,
        costScale: 1.4,
        badge: 'MOVILIDAD',
        svgType: 'shield'
      },
      siphon_guard: {
        id: 'siphon_guard',
        name: 'Escudo Sifón',
        description: 'Cada bloqueo exitoso con escudo convierte parte del impacto en Energía Elemental pura.',
        mechanicsText: 'Recarga +8 (R1) o +14 (R2) de Energía por bloqueo.',
        tree: 'aegis',
        tier: 1,
        lane: 2,
        dependsOn: ['guardian_stride'],
        reqTreePoints: 2,
        maxRank: 2,
        cost: 44,
        costScale: 1.5,
        badge: 'SIFÓN',
        svgType: 'shield_burst'
      },
      punishing_rebound: {
        id: 'punishing_rebound',
        name: 'Represalia Sísmica',
        description: 'Romper una postura o rematar con Riposte aturde brevemente a enemigos cercanos.',
        mechanicsText: 'Pulso de desequilibrio en 90px / 130px tras Riposte.',
        tree: 'aegis',
        tier: 2,
        lane: 2,
        dependsOn: ['siphon_guard'],
        reqTreePoints: 5,
        maxRank: 2,
        cost: 68,
        costScale: 1.45,
        badge: 'CONTROL',
        svgType: 'mirror_prism'
      },
      relic_aegis_halo: {
        id: 'relic_aegis_halo',
        name: 'Halo de la Égida Eterna',
        description: 'Un sello pasivo rodea a Santi cada 18s y anula por completo el siguiente golpe recibido.',
        mechanicsText: 'Capstone: Barrera automática periódica (0 daño + +20 Energía al absorber).',
        tree: 'aegis',
        tier: 3,
        lane: 2,
        dependsOn: ['punishing_rebound'],
        reqTreePoints: 8,
        maxRank: 1,
        cost: 120,
        costScale: 1.0,
        badge: 'CAPSTONE',
        svgType: 'bastion_crown'
      },

      // =====================================================================
      // 2. DISCIPLINA IRA DEL ACERO Y CINÉTICA (`wrath`) — 12 Habilidades
      // =====================================================================
      // --- Rama 0: Esgrima Implacable ---
      blade_tempo: {
        id: 'blade_tempo',
        name: 'Tempo Cortante',
        description: 'Acelera los tajos en ritmo perfecto y aumenta la Energía generada por cada espadazo.',
        mechanicsText: 'Ventana de ritmo más fluida y +1/+2/+3 Energía extra por golpe.',
        tree: 'wrath',
        tier: 0,
        lane: 0,
        dependsOn: [],
        reqTreePoints: 0,
        maxRank: 3,
        cost: 25,
        costScale: 1.45,
        badge: 'COMBO',
        svgType: 'swords'
      },
      combo_mastery: {
        id: 'combo_mastery',
        name: 'Maestría del Filo',
        description: 'Incrementa el daño bruto y alcance de los tajos 2 y 3 del combo cuerpo a cuerpo.',
        mechanicsText: '+12% / +24% / +36% daño físico y empuje en cadena.',
        tree: 'wrath',
        tier: 1,
        lane: 0,
        dependsOn: ['blade_tempo'],
        reqTreePoints: 2,
        maxRank: 3,
        cost: 45,
        costScale: 1.45,
        badge: 'FILO',
        svgType: 'blade_wave'
      },
      whirlwind_finisher: {
        id: 'whirlwind_finisher',
        name: 'Torbellino 360°',
        description: 'Transforma el 3er golpe en un remate giratorio completo que proyecta ondas de vacío.',
        mechanicsText: 'Golpe circular 360°; Rango 2 dispara doble onda sagrada.',
        tree: 'wrath',
        tier: 2,
        lane: 0,
        dependsOn: ['combo_mastery'],
        reqTreePoints: 5,
        maxRank: 2,
        cost: 75,
        costScale: 1.5,
        badge: 'REMATE',
        svgType: 'whirlwind_slash'
      },
      executioner_edge: {
        id: 'executioner_edge',
        name: 'Filo del Verdugo',
        description: 'Los enemigos por debajo del 35% de salud reciben un incremento devastador de daño.',
        mechanicsText: 'Capstone: +45% daño letal contra enemigos malheridos.',
        tree: 'wrath',
        tier: 3,
        lane: 0,
        dependsOn: ['whirlwind_finisher'],
        reqTreePoints: 8,
        maxRank: 1,
        cost: 110,
        costScale: 1.0,
        badge: 'CAPSTONE',
        svgType: 'execution_cleaver'
      },

      // --- Rama 1: Tormenta Cinética & Dash ---
      dash_cooldown: {
        id: 'dash_cooldown',
        name: 'Paso Relámpago',
        description: 'Reduce progresivamente la recarga de la Embestida y extiende los fotogramas de esquiva.',
        mechanicsText: '-14% / -26% / -38% enfriamiento del Dash.',
        tree: 'wrath',
        tier: 0,
        lane: 1,
        dependsOn: [],
        reqTreePoints: 0,
        maxRank: 3,
        cost: 25,
        costScale: 1.45,
        badge: 'VELOZ',
        svgType: 'lightning'
      },
      kinetic_overdrive: {
        id: 'kinetic_overdrive',
        name: 'Sobrecarga Cinética',
        description: 'Potencia los impactos cinéticos del Guantelete y otorga prisa breve al completar un Dash.',
        mechanicsText: '+14% daño cinético y +10% velocidad post-Dash por rango.',
        tree: 'wrath',
        tier: 1,
        lane: 1,
        dependsOn: ['dash_cooldown'],
        reqTreePoints: 2,
        maxRank: 3,
        cost: 45,
        costScale: 1.45,
        badge: 'CINÉTICA',
        svgType: 'meteor_strike'
      },
      phantom_step: {
        id: 'phantom_step',
        name: 'Asalto Fantasma',
        description: 'Atravesar enemigos durante un Dash inflige daño cortante y reembolsa Energía Elemental.',
        mechanicsText: 'Dash ofensivo atravesando filas; R2 duplica daño y reembolsa +16 Energía.',
        tree: 'wrath',
        tier: 2,
        lane: 1,
        dependsOn: ['kinetic_overdrive'],
        reqTreePoints: 5,
        maxRank: 2,
        cost: 70,
        costScale: 1.5,
        badge: 'FANTASMA',
        svgType: 'phantom_dash'
      },
      tempest_clone: {
        id: 'tempest_clone',
        name: 'Estela Tempestuosa',
        description: 'Al iniciar un Dash dejas un eco cinético que detona en área a tus espaldas.',
        mechanicsText: 'Capstone: Detonación cinética retardada de área amplia en origen del Dash.',
        tree: 'wrath',
        tier: 3,
        lane: 1,
        dependsOn: ['phantom_step'],
        reqTreePoints: 8,
        maxRank: 1,
        cost: 115,
        costScale: 1.0,
        badge: 'CAPSTONE',
        svgType: 'tempest_twin'
      },

      // --- Rama 2: Frenesí de Combate y Resistencia ---
      stamina_mastery: {
        id: 'stamina_mastery',
        name: 'Pulmones de Titán',
        description: 'Aumenta la reserva total de Resistencia y acelera la recuperación para carreras continuas.',
        mechanicsText: '+25 Resistencia máxima y +20% regeneración por rango.',
        tree: 'wrath',
        tier: 0,
        lane: 2,
        dependsOn: [],
        reqTreePoints: 0,
        maxRank: 3,
        cost: 20,
        costScale: 1.4,
        badge: 'RESISTENCIA',
        svgType: 'boots'
      },
      swift_recovery: {
        id: 'swift_recovery',
        name: 'Recuperación Ágil',
        description: 'Acorta la vulnerabilidad si rompen tu guardia y acelera la cancelación de tajos.',
        mechanicsText: '-18% duración de aturdimiento por Guardia Rota por rango.',
        tree: 'wrath',
        tier: 0,
        lane: 2,
        dependsOn: [],
        reqTreePoints: 0,
        maxRank: 3,
        cost: 28,
        costScale: 1.4,
        badge: 'AGILIDAD',
        svgType: 'swords'
      },
      crimson_momentum: {
        id: 'crimson_momentum',
        name: 'Inercia Carmesí',
        description: 'Mantener un Rango de Estilo A o S infunde tus golpes físicos con críticos espontáneos.',
        mechanicsText: '+18% (R1) / +30% (R2) daño adicional al combatir con Estilo A/S.',
        tree: 'wrath',
        tier: 1,
        lane: 2,
        dependsOn: ['swift_recovery'],
        reqTreePoints: 2,
        maxRank: 2,
        cost: 48,
        costScale: 1.45,
        badge: 'ESTILO',
        svgType: 'blade_wave'
      },
      relentless_flurry: {
        id: 'relentless_flurry',
        name: 'Lluvia Imparable',
        description: 'Derrotar a un enemigo cuerpo a cuerpo reinicia tu Dash e inyecta adrenalina energética.',
        mechanicsText: 'Al matar con espada: resetea Dash y recupera +15/+24 Energía.',
        tree: 'wrath',
        tier: 2,
        lane: 2,
        dependsOn: ['crimson_momentum'],
        reqTreePoints: 5,
        maxRank: 2,
        cost: 72,
        costScale: 1.5,
        badge: 'FRENESÍ',
        svgType: 'whirlwind_slash'
      },
      blade_ascension: {
        id: 'blade_ascension',
        name: 'Ascensión de la Espada',
        description: 'Cada 3er golpe de espada dispara un corte astral penetrante adicional sin costo alguno.',
        mechanicsText: 'Capstone: Doble onda penetrante gratuita en todo Finisher.',
        tree: 'wrath',
        tier: 3,
        lane: 2,
        dependsOn: ['relentless_flurry'],
        reqTreePoints: 8,
        maxRank: 1,
        cost: 120,
        costScale: 1.0,
        badge: 'CAPSTONE',
        svgType: 'execution_cleaver'
      },

      // =====================================================================
      // 3. DISCIPLINA DOMINIO DE LA RELIQUIA (`relic`) — 12 Habilidades
      // =====================================================================
      // --- Rama 0: Senda Pírica (Fuego) ---
      ember_fan: {
        id: 'ember_fan',
        name: 'Abanico de Brasas',
        description: 'Multiplica los proyectiles ígneos en abanico y amplía su alcance térmico.',
        mechanicsText: 'Orbes laterales en Fuego débil; mayores rangos potencian su calibre.',
        tree: 'relic',
        tier: 0,
        lane: 0,
        dependsOn: [],
        reqTreePoints: 0,
        maxRank: 3,
        cost: 25,
        costScale: 1.45,
        badge: 'FUEGO',
        svgType: 'triple_flame'
      },
      elemental_synergy: {
        id: 'elemental_synergy',
        name: 'Sinergia Elemental',
        description: 'Detona una Nova Explosiva masiva al combinar Fuego sobre objetivos enraizados o cargados.',
        mechanicsText: 'Habilita reacciones elementales; R2 incrementa +30% radio y trauma sísmico.',
        tree: 'relic',
        tier: 1,
        lane: 0,
        dependsOn: ['ember_fan'],
        reqTreePoints: 2,
        maxRank: 2,
        cost: 50,
        costScale: 1.55,
        badge: 'SINERGIA',
        svgType: 'sun_nova'
      },
      solar_cataclysm: {
        id: 'solar_cataclysm',
        name: 'Cataclismo Solar',
        description: 'El ataque fuerte de Fuego deja un crisol de magma hirviente persistente en el suelo.',
        mechanicsText: 'Zona de magma continua; R2 prolonga duración e ignición.',
        tree: 'relic',
        tier: 2,
        lane: 0,
        dependsOn: ['elemental_synergy'],
        reqTreePoints: 5,
        maxRank: 2,
        cost: 78,
        costScale: 1.5,
        badge: 'CATACLISMO',
        svgType: 'flame_orb'
      },
      supernova_protocol: {
        id: 'supernova_protocol',
        name: 'Protocolo Supernova',
        description: 'Cada detonación de Sinergia Elemental devuelve Energía pura por enemigo golpeado.',
        mechanicsText: 'Capstone: +12 Energía por enemigo alcanzado en explosiones elementales.',
        tree: 'relic',
        tier: 3,
        lane: 0,
        dependsOn: ['solar_cataclysm'],
        reqTreePoints: 8,
        maxRank: 1,
        cost: 115,
        costScale: 1.0,
        badge: 'CAPSTONE',
        svgType: 'omega_rune'
      },

      // --- Rama 1: Senda Silvestre (Planta) ---
      thorn_leech: {
        id: 'thorn_leech',
        name: 'Espinas Sifón',
        description: 'Las raíces y espinas absorben esencia energética de los enemigos lacerados.',
        mechanicsText: '+5/+8/+12 Energía robada por impacto de Planta.',
        tree: 'relic',
        tier: 0,
        lane: 1,
        dependsOn: [],
        reqTreePoints: 0,
        maxRank: 3,
        cost: 25,
        costScale: 1.45,
        badge: 'PLANTA',
        svgType: 'vine_whip'
      },
      bramble_snare: {
        id: 'bramble_snare',
        name: 'Prisión Selvática',
        description: 'Prolonga el enraizamiento de los enemigos y reduce su armadura elemental.',
        mechanicsText: 'Aumenta duración de raíces e inmovilización táctica (+45% en R2).',
        tree: 'relic',
        tier: 1,
        lane: 1,
        dependsOn: ['thorn_leech'],
        reqTreePoints: 2,
        maxRank: 2,
        cost: 45,
        costScale: 1.45,
        badge: 'RAÍCES',
        svgType: 'root_snare'
      },
      verdant_sanctuary: {
        id: 'verdant_sanctuary',
        name: 'Santuario Esmeralda',
        description: 'El estallido fuerte silvestre crea un aura que regenera vitalidad y postura.',
        mechanicsText: 'Regeneración en área esmeralda; R2 aumenta curación adicional.',
        tree: 'relic',
        tier: 2,
        lane: 1,
        dependsOn: ['bramble_snare'],
        reqTreePoints: 5,
        maxRank: 2,
        cost: 75,
        costScale: 1.5,
        badge: 'AURA',
        svgType: 'oak_crest'
      },
      ancient_bloom: {
        id: 'ancient_bloom',
        name: 'Floración Primordial',
        description: 'Tus poderes de Planta curan la Postura de Santi al alcanzar múltiples objetivos.',
        mechanicsText: 'Capstone: +18 Postura recuperada al golpear 2+ enemigos con Planta.',
        tree: 'relic',
        tier: 3,
        lane: 1,
        dependsOn: ['verdant_sanctuary'],
        reqTreePoints: 8,
        maxRank: 1,
        cost: 110,
        costScale: 1.0,
        badge: 'CAPSTONE',
        svgType: 'bloom_lotus'
      },

      // --- Rama 2: Flujo Arcano & Resonancia ---
      energy_regen: {
        id: 'energy_regen',
        name: 'Flujo Elemental',
        description: 'Acelera la regeneración pasiva del Guantelete y abarata habilidades pesadas.',
        mechanicsText: '+2.5/s (hasta +6.5/s) regeneración pasiva de Energía.',
        tree: 'relic',
        tier: 0,
        lane: 2,
        dependsOn: [],
        reqTreePoints: 0,
        maxRank: 3,
        cost: 25,
        costScale: 1.45,
        badge: 'FLUJO',
        svgType: 'relic_star'
      },
      relic_efficiency: {
        id: 'relic_efficiency',
        name: 'Eficiencia Rúnica',
        description: 'Optimiza las canalizaciones reduciendo el coste energético de todas tus habilidades.',
        mechanicsText: '-10% / -18% / -25% coste energético en habilidades elementales.',
        tree: 'relic',
        tier: 1,
        lane: 2,
        dependsOn: ['energy_regen'],
        reqTreePoints: 2,
        maxRank: 3,
        cost: 42,
        costScale: 1.45,
        badge: 'AHORRO',
        svgType: 'arcane_core'
      },
      arcane_overload: {
        id: 'arcane_overload',
        name: 'Saturación Rúnica',
        description: 'Cuando tienes más del 75% de Energía, tus magias infligen daño elemental sobrecargado.',
        mechanicsText: '+22% (R1) / +38% (R2) daño mágico en alta Energía.',
        tree: 'relic',
        tier: 2,
        lane: 2,
        dependsOn: ['relic_efficiency'],
        reqTreePoints: 5,
        maxRank: 2,
        cost: 70,
        costScale: 1.5,
        badge: 'SOBRECARGA',
        svgType: 'sun_nova'
      },
      omega_catalyst: {
        id: 'omega_catalyst',
        name: 'Catalizador Omega',
        description: 'Expande la capacidad del Guantelete en +35 Energía y premia alternar elementos.',
        mechanicsText: 'Capstone: +35 Energía Máxima y +10 Energía inmediata al rotar elemento.',
        tree: 'relic',
        tier: 3,
        lane: 2,
        dependsOn: ['arcane_overload'],
        reqTreePoints: 8,
        maxRank: 1,
        cost: 120,
        costScale: 1.0,
        badge: 'CAPSTONE',
        svgType: 'omega_rune'
      }
    };

    this.loadProgress();
  }

  /**
   * Carga rangos guardados (v3) o migra automáticamente progreso heredado (v2) y Esencia.
   */
  loadProgress() {
    try {
      const savedRanks = localStorage.getItem(STORAGE_KEYS.SKILL_RANKS_V3);
      if (savedRanks) {
        const parsed = JSON.parse(savedRanks);
        if (parsed && typeof parsed === 'object') {
          this.skillRanks = {};
          for (const [id, r] of Object.entries(parsed)) {
            if (this.skills[id] && Number(r) > 0) {
              this.skillRanks[id] = Math.min(this.skills[id].maxRank || 1, Math.floor(Number(r)));
            }
          }
        }
      } else {
        // Migración automática sin pérdidas desde v2 (`unlockedSkills` booleanos)
        const legacyRaw = localStorage.getItem(STORAGE_KEYS.SKILLS_LEGACY_V2);
        if (legacyRaw) {
          const arr = JSON.parse(legacyRaw);
          if (Array.isArray(arr)) {
            for (const id of arr) {
              if (this.skills[id]) {
                this.skillRanks[id] = 1;
              }
            }
          }
        }
      }

      this._syncUnlockedSet();

      const savedEssence = localStorage.getItem(STORAGE_KEYS.ESSENCE);
      if (savedEssence !== null) {
        const num = Number(savedEssence);
        if (!Number.isNaN(num)) {
          this.essence = Math.max(0, num);
        }
      }
    } catch (e) {
      console.warn('[SkillTreeManager] Error cargando progresión:', e);
    }

    if (this.state) {
      this.state.set('player_essence', this.essence);
      this.state.set('unlocked_skills', Array.from(this.unlockedSkills));
      this.state.set('skill_ranks', { ...this.skillRanks });
    }
  }

  /**
   * Sincroniza `unlockedSkills` (`Set<string>`) con `this.skillRanks`.
   * @private
   */
  _syncUnlockedSet() {
    this.unlockedSkills.clear();
    for (const [id, rank] of Object.entries(this.skillRanks)) {
      if (rank >= 1) {
        this.unlockedSkills.add(id);
      }
    }
  }

  /**
   * Programa guardado diferido (Debounce) para no saturar `localStorage`.
   * @private
   */
  _scheduleSave() {
    if (this._saveTimer !== null) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.saveProgress();
    }, 350);
  }

  /**
   * Persiste rangos actuales y Esencia Antigua en `localStorage`.
   */
  saveProgress() {
    if (this._saveTimer !== null) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.SKILL_RANKS_V3, JSON.stringify(this.skillRanks));
      localStorage.setItem(STORAGE_KEYS.SKILLS_LEGACY_V2, JSON.stringify(Array.from(this.unlockedSkills)));
      localStorage.setItem(STORAGE_KEYS.ESSENCE, String(this.essence));
    } catch (e) {
      console.warn('[SkillTreeManager] Error guardando progresión:', e);
    }
  }

  /** @returns {number} */
  getEssence() {
    return this.essence;
  }

  /**
   * Añade Esencia Antigua tras combates o exploración.
   * @param {number} amount
   * @returns {number} Nuevo total
   */
  addEssence(amount) {
    const val = Math.max(0, Math.round(amount));
    if (val <= 0) return this.essence;
    this.essence += val;
    if (this.state) {
      this.state.set('player_essence', this.essence);
    }
    this._scheduleSave();
    return this.essence;
  }

  /**
   * Consume Esencia Antigua para mejoras.
   * @param {number} amount
   * @returns {boolean}
   */
  spendEssence(amount) {
    if (this.essence < amount) return false;
    this.essence -= amount;
    if (this.state) {
      this.state.set('player_essence', this.essence);
    }
    this._scheduleSave();
    return true;
  }

  /**
   * Devuelve el rango actual invertido en un talento (`0` si no adquirido).
   * @param {string} skillId
   * @returns {number}
   */
  getSkillRank(skillId) {
    return this.skillRanks[skillId] || 0;
  }

  /**
   * Indica si el nodo alcanzó su rango máximo.
   * @param {string} skillId
   * @returns {boolean}
   */
  isMaxRank(skillId) {
    const sk = this.skills[skillId];
    if (!sk) return true;
    return this.getSkillRank(skillId) >= (sk.maxRank || 1);
  }

  /**
   * Calcula el multiplicador económico invisible derivado del Karma acumulado.
   * @private
   * @returns {number}
   */
  _getKarmaMultiplier() {
    const karma = this.state ? (this.state.get('karma_level') || 0) : 0;
    if (karma >= 2) return 0.85;
    if (karma <= -2) return 1.15;
    return 1.0;
  }

  /**
   * Calcula el coste en Esencia para el siguiente rango de un nodo, ajustado por Karma Invisible.
   * @param {string} skillId
   * @returns {number}
   */
  getSkillCost(skillId) {
    const sk = this.skills[skillId];
    if (!sk) return 9999;
    const rank = this.getSkillRank(skillId);
    const scale = sk.costScale || 1.45;
    const raw = sk.cost * Math.pow(scale, rank);
    return Math.max(1, Math.round(raw * this._getKarmaMultiplier()));
  }

  /**
   * Suma los puntos (rangos) invertidos dentro de una disciplina (`aegis`, `wrath`, `relic`).
   * @param {string} treeKey
   * @returns {number}
   */
  getTreePoints(treeKey) {
    let total = 0;
    for (const [id, sk] of Object.entries(this.skills)) {
      if (sk.tree === treeKey) {
        total += this.getSkillRank(id);
      }
    }
    return total;
  }

  /**
   * Total de rangos invertidos entre las 3 disciplinas.
   * @returns {number}
   */
  getTotalAllocatedRanks() {
    let total = 0;
    for (const rank of Object.values(this.skillRanks)) {
      total += rank;
    }
    return total;
  }

  /**
   * Capacidad total posible del Árbol del Santuario (todos los rangos sumados).
   * @returns {number}
   */
  getTotalMaxRanks() {
    let total = 0;
    for (const sk of Object.values(this.skills)) {
      total += (sk.maxRank || 1);
    }
    return total;
  }

  /**
   * Verifica tanto los nodos padres como los puntos mínimos en la disciplina (`reqTreePoints`).
   * @param {string} skillId
   * @returns {boolean}
   */
  areDependenciesMet(skillId) {
    const sk = this.skills[skillId];
    if (!sk) return false;

    const reqPts = sk.reqTreePoints !== undefined ? sk.reqTreePoints : (TIER_POINT_REQUIREMENTS[sk.tier] || 0);
    if (this.getTreePoints(sk.tree) < reqPts) {
      return false;
    }

    if (!sk.dependsOn || sk.dependsOn.length === 0) return true;
    for (let i = 0; i < sk.dependsOn.length; i++) {
      if (this.getSkillRank(sk.dependsOn[i]) < 1) return false;
    }
    return true;
  }

  /**
   * Determina si un talento puede adquirirse o subir de rango ahora mismo.
   * @param {string} skillId
   * @returns {boolean}
   */
  canUnlock(skillId) {
    const sk = this.skills[skillId];
    if (!sk) return false;
    if (this.isMaxRank(skillId)) return false;
    if (!this.areDependenciesMet(skillId)) return false;
    return this.essence >= this.getSkillCost(skillId);
  }

  /**
   * Compra o sube de rango un talento descontando su coste dinámico en Esencia.
   * @param {string} skillId
   * @returns {boolean}
   */
  unlockSkill(skillId) {
    if (!this.canUnlock(skillId)) return false;
    const cost = this.getSkillCost(skillId);
    if (!this.spendEssence(cost)) return false;

    const nextRank = this.getSkillRank(skillId) + 1;
    this.skillRanks[skillId] = nextRank;
    this._syncUnlockedSet();
    this.saveProgress();

    if (this.state) {
      this.state.set('unlocked_skills', Array.from(this.unlockedSkills));
      this.state.set('skill_ranks', { ...this.skillRanks });
    }
    return true;
  }

  /**
   * Devuelve true si el talento posee al menos Rango 1.
   * @param {string} skillId
   * @returns {boolean}
   */
  hasSkill(skillId) {
    return this.getSkillRank(skillId) >= 1;
  }

  /**
   * Reinicia el árbol reembolsando íntegramente toda la Esencia invertida en los rangos actuales.
   * @returns {number} Esencia total reembolsada.
   */
  reset() {
    let refunded = 0;
    const karmaMult = this._getKarmaMultiplier();
    for (const [id, rank] of Object.entries(this.skillRanks)) {
      const sk = this.skills[id];
      if (!sk || rank <= 0) continue;
      const scale = sk.costScale || 1.45;
      for (let r = 0; r < rank; r++) {
        refunded += Math.max(1, Math.round(sk.cost * Math.pow(scale, r) * karmaMult));
      }
    }

    this.skillRanks = {};
    this.unlockedSkills.clear();
    if (refunded > 0) {
      this.essence += refunded;
    }
    this.saveProgress();

    if (this.state) {
      this.state.set('player_essence', this.essence);
      this.state.set('unlocked_skills', []);
      this.state.set('skill_ranks', {});
    }
    return refunded;
  }

  /**
   * Reinicia por completo el progreso del árbol y la esencia a su valor de campaña nueva.
   */
  resetCampaign() {
    this.skillRanks = {};
    this.unlockedSkills.clear();
    this.essence = 40;
    this.saveProgress();
    if (this.state) {
      this.state.set('player_essence', this.essence);
      this.state.set('unlocked_skills', []);
      this.state.set('skill_ranks', {});
    }
  }
}
