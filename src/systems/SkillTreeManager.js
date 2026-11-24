/**
 * @module SkillTreeManager
 * @description Gestor del Árbol de Maestría del Santuario de 36 Nodos simétricos
 * (3 Disciplinas × 3 Carriles/Sendas × 4 Tiers) con soporte **Multi-Rango** (`maxRank: 1..3`),
 * progresión vertical coherente (Tier 0 abierto con libre elección horizontal; Tiers 1–3 desbloqueables
 * peldaño a peldaño al completar el nodo anterior e invertir en la disciplina), economía calibrada
 * (`essence: 0` al iniciar campaña y curva `30/55/90/145`) y 36 iconos semánticos únicos.
 *
 * @author Be a Legend Team
 * @version 4.0.0
 */

const STORAGE_KEYS = {
  SKILLS_LEGACY_V2: 'be_a_legend_skills_v2',
  SKILL_RANKS_V3: 'be_a_legend_skill_ranks_v3',
  SKILL_RANKS_V4: 'be_a_legend_skill_ranks_v4',
  ESSENCE: 'be_a_legend_essence_v3'
};

/**
 * Requisitos de puntos acumulados en una disciplina para desbloquear cada Tier.
 * @constant {Record<number, number>}
 */
export const TIER_POINT_REQUIREMENTS = {
  0: 0,
  1: 1,
  2: 3,
  3: 6
};

export class SkillTreeManager {
  /**
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=null]
   * @param {import('./ProgressionManager.js').ProgressionManager|null} [progressionManager=null]
   */
  constructor(stateManager = null, progressionManager = null) {
    /** @type {import('../core/StateManager.js').StateManager|null} */
    this.state = stateManager;

    /** @type {import('./ProgressionManager.js').ProgressionManager|null} */
    this.progressionManager = progressionManager;

    /** @type {number} Esencia Antigua ganada en combate y exploración (0 al iniciar nueva campaña) */
    this.essence = 0;

    /** @type {Record<string, number>} Mapa de rangos adquiridos por `skillId` */
    this.skillRanks = {};

    /** @type {Set<string>} Vista booleana compatible (`rank >= 1`) */
    this.unlockedSkills = new Set();

    /** @type {number|null} Handle para debounce de persistencia */
    this._saveTimer = null;

    /**
     * Definición simétrica de 36 habilidades (3 Disciplinas × 3 Carriles × 4 Tiers).
     * @type {Record<string, Object>}
     */
    this.skills = {
      // =====================================================================
      // 1. DISCIPLINA ÉGIDA Y PARRY (`aegis`) — 12 Habilidades
      // =====================================================================
      // --- Carril 0: Guardia ---
      parry_window: {
        id: 'parry_window',
        name: 'Reflejos del Guardián',
        description: 'Amplía la ventana temporal para ejecutar un Parry Perfecto tras alzar el escudo.',
        mechanicsText: 'Ventana base 0.16s ➔ hasta 0.28s según rango.',
        inputHint: 'Pulsa [Shift] justo antes del impacto',
        laneTitle: 'GUARDIA',
        tree: 'aegis',
        tier: 0,
        lane: 0,
        dependsOn: [],
        reqTreePoints: TIER_POINT_REQUIREMENTS[0],
        maxRank: 3,
        cost: 30,
        costScale: 1.5,
        badge: 'PARRY',
        svgType: 'shield_parry'
      },
      aegis_counter: {
        id: 'aegis_counter',
        name: 'Contra-Estallido Solar',
        description: 'Un Parry Perfecto detona una onda expansiva radial que daña y aturde enemigos próximos.',
        mechanicsText: 'Onda radial tras Parry; Rango 2 aumenta radio y daño sísmico +35%.',
        inputHint: 'Automático al ejecutar un Parry Perfecto',
        laneTitle: 'GUARDIA',
        tree: 'aegis',
        tier: 1,
        lane: 0,
        dependsOn: ['parry_window'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[1],
        maxRank: 2,
        cost: 55,
        costScale: 1.5,
        badge: 'PARRY II',
        svgType: 'shield_shockwave'
      },
      mirror_ricochet: {
        id: 'mirror_ricochet',
        name: 'Espejo Astral',
        description: 'Los Ripostes críticos sobre enemigos aturdidos infligen daño masivo y potencian el contraataque.',
        mechanicsText: 'Multiplicador de Riposte x3.0 ➔ x3.8 (R1) / x4.4 (R2).',
        inputHint: 'Ataca [J] a un enemigo desequilibrado tras Parry',
        laneTitle: 'GUARDIA',
        tree: 'aegis',
        tier: 2,
        lane: 0,
        dependsOn: ['aegis_counter'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[2],
        maxRank: 2,
        cost: 90,
        costScale: 1.5,
        badge: 'CRÍTICO',
        svgType: 'reflect_prism'
      },
      bastion_immortal: {
        id: 'bastion_immortal',
        name: 'Bastión Inmortal',
        description: 'Maestría suprema de guardia: todo Parry exitoso restaura Postura al instante y otorga 0.35s de invulnerabilidad.',
        mechanicsText: 'Capstone: +28 Postura y ventana inmune 0.35s al ejecutar Parry.',
        inputHint: 'Maestría pasiva al ejecutar Parry Perfecto',
        laneTitle: 'GUARDIA',
        tree: 'aegis',
        tier: 3,
        lane: 0,
        dependsOn: ['mirror_ricochet'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[3],
        maxRank: 1,
        cost: 145,
        costScale: 1.0,
        isMastery: true,
        badge: 'CAPSTONE',
        svgType: 'bastion_citadel'
      },

      // --- Carril 1: Vitalidad ---
      vital_surge: {
        id: 'vital_surge',
        name: 'Vigor del Núcleo',
        description: 'Potencia el pulso curativo del Santuario y reduce el coste de energía para sanar o crear escudo.',
        mechanicsText: '-4 coste Energía por rango al curar y +25 Postura restaurada.',
        inputHint: 'Pulsa [Q] para curar o activar Escudo Vital',
        laneTitle: 'VITALIDAD',
        tree: 'aegis',
        tier: 0,
        lane: 1,
        dependsOn: [],
        reqTreePoints: TIER_POINT_REQUIREMENTS[0],
        maxRank: 3,
        cost: 30,
        costScale: 1.5,
        badge: 'VITAL',
        svgType: 'vital_pulse'
      },
      iron_posture: {
        id: 'iron_posture',
        name: 'Temple de Acero',
        description: 'Endurece la guardia de Santi reduciendo la pérdida de Postura al bloquear golpes pesados.',
        mechanicsText: '-15% / -28% / -40% daño a Postura y +3/s recuperación por rango.',
        inputHint: 'Pasivo al mantener Guardia [Shift]',
        laneTitle: 'VITALIDAD',
        tree: 'aegis',
        tier: 1,
        lane: 1,
        dependsOn: ['vital_surge'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[1],
        maxRank: 3,
        cost: 55,
        costScale: 1.5,
        badge: 'POSTURA',
        svgType: 'steel_anvil'
      },
      max_health_up: {
        id: 'max_health_up',
        name: 'Corazón del Santuario',
        description: 'Incrementa permanentemente tus corazones máximos y libera una Supernova de Renacimiento al caer.',
        mechanicsText: '+1 Corazón máximo por rango (hasta 5 corazones totales).',
        inputHint: 'Aumenta vitalidad máxima de forma permanente',
        laneTitle: 'VITALIDAD',
        tree: 'aegis',
        tier: 2,
        lane: 1,
        dependsOn: ['iron_posture'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[2],
        maxRank: 2,
        cost: 90,
        costScale: 1.5,
        badge: 'CORAZÓN',
        svgType: 'crystal_heart'
      },
      undying_resolve: {
        id: 'undying_resolve',
        name: 'Voluntad Inquebrantable',
        description: 'Cuando un golpe fatal fuera a derribarte, consume 15 de Energía para sobrevivir con 1 Corazón.',
        mechanicsText: 'Capstone: Salva letal automática (enfriamiento 45s) + pulso repelente.',
        inputHint: 'Activación automática ante golpe letal',
        laneTitle: 'VITALIDAD',
        tree: 'aegis',
        tier: 3,
        lane: 1,
        dependsOn: ['max_health_up'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[3],
        maxRank: 1,
        cost: 145,
        costScale: 1.0,
        isMastery: true,
        badge: 'CAPSTONE',
        svgType: 'phoenix_rise'
      },

      // --- Carril 2: Sifón ---
      guardian_stride: {
        id: 'guardian_stride',
        name: 'Paso Firme',
        description: 'Mejora la movilidad mientras sostienes el escudo alzado frente a ataques múltiples.',
        mechanicsText: '+18% velocidad al defender por rango.',
        inputHint: 'Muévete con [WASD] manteniendo [Shift]',
        laneTitle: 'SIFÓN',
        tree: 'aegis',
        tier: 0,
        lane: 2,
        dependsOn: [],
        reqTreePoints: TIER_POINT_REQUIREMENTS[0],
        maxRank: 3,
        cost: 30,
        costScale: 1.5,
        badge: 'MOVILIDAD',
        svgType: 'shield_stride'
      },
      siphon_guard: {
        id: 'siphon_guard',
        name: 'Escudo Sifón',
        description: 'Cada bloqueo exitoso con escudo convierte parte del impacto en Energía Elemental pura.',
        mechanicsText: 'Recarga +8 (R1) o +14 (R2) de Energía por bloqueo.',
        inputHint: 'Pasivo al bloquear ataques enemigos',
        laneTitle: 'SIFÓN',
        tree: 'aegis',
        tier: 1,
        lane: 2,
        dependsOn: ['guardian_stride'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[1],
        maxRank: 2,
        cost: 55,
        costScale: 1.5,
        badge: 'SIFÓN',
        svgType: 'shield_siphon'
      },
      punishing_rebound: {
        id: 'punishing_rebound',
        name: 'Represalia Sísmica',
        description: 'Romper una postura o rematar con Riposte aturde brevemente a enemigos cercanos.',
        mechanicsText: 'Pulso de desequilibrio en 90px / 130px tras Riposte.',
        inputHint: 'Automático al ejecutar Riposte o quebrar postura',
        laneTitle: 'SIFÓN',
        tree: 'aegis',
        tier: 2,
        lane: 2,
        dependsOn: ['siphon_guard'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[2],
        maxRank: 2,
        cost: 90,
        costScale: 1.5,
        badge: 'CONTROL',
        svgType: 'seismic_hammer'
      },
      relic_aegis_halo: {
        id: 'relic_aegis_halo',
        name: 'Halo de la Égida Eterna',
        description: 'Un sello pasivo rodea a Santi cada 18s y anula por completo el siguiente golpe recibido.',
        mechanicsText: 'Capstone: Barrera automática periódica (0 daño + +20 Energía al absorber).',
        inputHint: 'Maestría pasiva cada 18 segundos',
        laneTitle: 'SIFÓN',
        tree: 'aegis',
        tier: 3,
        lane: 2,
        dependsOn: ['punishing_rebound'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[3],
        maxRank: 1,
        cost: 145,
        costScale: 1.0,
        isMastery: true,
        badge: 'CAPSTONE',
        svgType: 'eternal_halo'
      },

      // =====================================================================
      // 2. DISCIPLINA IRA DEL ACERO Y CINÉTICA (`wrath`) — 12 Habilidades
      // =====================================================================
      // --- Carril 0: Esgrima ---
      blade_tempo: {
        id: 'blade_tempo',
        name: 'Tempo Cortante',
        description: 'Acelera los tajos en ritmo perfecto y aumenta la Energía generada por cada espadazo.',
        mechanicsText: 'Ventana de ritmo más fluida y +1/+2/+3 Energía extra por golpe.',
        inputHint: 'Combo rítmico con [Clic Izq] o [J]',
        laneTitle: 'ESGRIMA',
        tree: 'wrath',
        tier: 0,
        lane: 0,
        dependsOn: [],
        reqTreePoints: TIER_POINT_REQUIREMENTS[0],
        maxRank: 3,
        cost: 30,
        costScale: 1.5,
        badge: 'COMBO',
        svgType: 'metronome_blade'
      },
      combo_mastery: {
        id: 'combo_mastery',
        name: 'Maestría del Filo',
        description: 'Incrementa el daño bruto y alcance de los tajos 2 y 3 del combo cuerpo a cuerpo.',
        mechanicsText: '+12% / +24% / +36% daño físico y empuje en cadena.',
        inputHint: 'Encadena golpes 2 y 3 con [Clic Izq] o [J]',
        laneTitle: 'ESGRIMA',
        tree: 'wrath',
        tier: 1,
        lane: 0,
        dependsOn: ['blade_tempo'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[1],
        maxRank: 3,
        cost: 55,
        costScale: 1.5,
        badge: 'FILO',
        svgType: 'twin_swords'
      },
      whirlwind_finisher: {
        id: 'whirlwind_finisher',
        name: 'Torbellino 360°',
        description: 'Transforma el 3er golpe en un remate giratorio completo que proyecta ondas sagradas.',
        mechanicsText: 'Golpe circular 360°; Rango 2 dispara 3 ondas sagradas.',
        inputHint: '3er golpe consecutivo del combo de espada',
        laneTitle: 'ESGRIMA',
        tree: 'wrath',
        tier: 2,
        lane: 0,
        dependsOn: ['combo_mastery'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[2],
        maxRank: 2,
        cost: 90,
        costScale: 1.5,
        badge: 'REMATE',
        svgType: 'whirlwind_slash'
      },
      executioner_edge: {
        id: 'executioner_edge',
        name: 'Filo del Verdugo',
        description: 'Los enemigos por debajo del 35% de salud reciben un incremento devastador de daño.',
        mechanicsText: 'Capstone: +45% daño letal contra enemigos malheridos.',
        inputHint: 'Golpea enemigos debilitados (< 35% vida)',
        laneTitle: 'ESGRIMA',
        tree: 'wrath',
        tier: 3,
        lane: 0,
        dependsOn: ['whirlwind_finisher'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[3],
        maxRank: 1,
        cost: 145,
        costScale: 1.0,
        isMastery: true,
        badge: 'CAPSTONE',
        svgType: 'execution_blade'
      },

      // --- Carril 1: Cinética ---
      dash_cooldown: {
        id: 'dash_cooldown',
        name: 'Paso Relámpago',
        description: 'Reduce progresivamente la recarga de la Embestida y potencia la estocada Dash-Strike.',
        mechanicsText: '-14% / -26% / -38% enfriamiento del Dash y +10% daño por rango.',
        inputHint: 'Pulsa [Espacio] o botón DASH para esquivar',
        laneTitle: 'CINÉTICA',
        tree: 'wrath',
        tier: 0,
        lane: 1,
        dependsOn: [],
        reqTreePoints: TIER_POINT_REQUIREMENTS[0],
        maxRank: 3,
        cost: 30,
        costScale: 1.5,
        badge: 'VELOZ',
        svgType: 'winged_dash'
      },
      kinetic_overdrive: {
        id: 'kinetic_overdrive',
        name: 'Sobrecarga Cinética',
        description: 'Libera un pulso de plasma perforador al atacar durante un Dash o deslizamiento táctico.',
        mechanicsText: 'Dash-Strike genera explosión cinética AoE que quiebra corazas.',
        inputHint: 'Ataca [J] justo durante un Dash [Espacio]',
        laneTitle: 'CINÉTICA',
        tree: 'wrath',
        tier: 1,
        lane: 1,
        dependsOn: ['dash_cooldown'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[1],
        maxRank: 3,
        cost: 55,
        costScale: 1.5,
        badge: 'CINÉTICA',
        svgType: 'kinetic_fist'
      },
      phantom_step: {
        id: 'phantom_step',
        name: 'Asalto Fantasma',
        description: 'Atravesar enemigos durante un Dash inflige daño cortante y reembolsa Energía Elemental.',
        mechanicsText: 'Dash ofensivo atravesando filas; R2 reembolsa +18 Energía.',
        inputHint: 'Atraviesa enemigos usando Dash [Espacio]',
        laneTitle: 'CINÉTICA',
        tree: 'wrath',
        tier: 2,
        lane: 1,
        dependsOn: ['kinetic_overdrive'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[2],
        maxRank: 2,
        cost: 90,
        costScale: 1.5,
        badge: 'FANTASMA',
        svgType: 'phantom_afterimage'
      },
      tempest_clone: {
        id: 'tempest_clone',
        name: 'Estela Tempestuosa',
        description: 'Al iniciar un Dash dejas un eco cinético que detona en área a tus espaldas.',
        mechanicsText: 'Capstone: Detonación cinética retardada de área amplia en origen del Dash.',
        inputHint: 'Automático al ejecutar Dash [Espacio]',
        laneTitle: 'CINÉTICA',
        tree: 'wrath',
        tier: 3,
        lane: 1,
        dependsOn: ['phantom_step'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[3],
        maxRank: 1,
        cost: 145,
        costScale: 1.0,
        isMastery: true,
        badge: 'CAPSTONE',
        svgType: 'storm_twin'
      },

      // --- Carril 2: Frenesí ---
      stamina_mastery: {
        id: 'stamina_mastery',
        name: 'Temple de Titán',
        description: 'Expande tu Resistencia máxima, acelera su regeneración y acorta el aturdimiento por Guardia Rota.',
        mechanicsText: '+25 Resistencia máx, +20% regen y -22% aturdimiento por rango.',
        inputHint: 'Corre con [F] o doble toque en DASH',
        laneTitle: 'FRENESÍ',
        tree: 'wrath',
        tier: 0,
        lane: 2,
        dependsOn: [],
        reqTreePoints: TIER_POINT_REQUIREMENTS[0],
        maxRank: 3,
        cost: 30,
        costScale: 1.5,
        badge: 'TEMPLE',
        svgType: 'titan_breath'
      },
      crimson_momentum: {
        id: 'crimson_momentum',
        name: 'Inercia Carmesí',
        description: 'Mantener un Rango de Estilo alto infunde tus golpes físicos con precisión letal.',
        mechanicsText: '+18% (R1) / +30% (R2) daño adicional al combatir con Estilo A/S.',
        inputHint: 'Encadena golpes variados sin recibir daño',
        laneTitle: 'FRENESÍ',
        tree: 'wrath',
        tier: 1,
        lane: 2,
        dependsOn: ['stamina_mastery'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[1],
        maxRank: 2,
        cost: 55,
        costScale: 1.5,
        badge: 'ESTILO',
        svgType: 'style_crest'
      },
      relentless_flurry: {
        id: 'relentless_flurry',
        name: 'Lluvia Imparable',
        description: 'Derrotar a un enemigo cuerpo a cuerpo reinicia tu Dash e inyecta adrenalina energética.',
        mechanicsText: 'Al matar con espada: resetea Dash y recupera +15/+24 Energía.',
        inputHint: 'Derrota enemigos con tajos de la Espada del Alba',
        laneTitle: 'FRENESÍ',
        tree: 'wrath',
        tier: 2,
        lane: 2,
        dependsOn: ['crimson_momentum'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[2],
        maxRank: 2,
        cost: 90,
        costScale: 1.5,
        badge: 'FRENESÍ',
        svgType: 'chain_slashes'
      },
      blade_ascension: {
        id: 'blade_ascension',
        name: 'Ascensión de la Espada',
        description: 'Cada 3er golpe de espada dispara múltiples cortes astrales penetrantes sin costo alguno.',
        mechanicsText: 'Capstone: Ondas penetrantes múltiples gratuitas en todo Finisher.',
        inputHint: 'Maestría automática en el 3er golpe de espada',
        laneTitle: 'FRENESÍ',
        tree: 'wrath',
        tier: 3,
        lane: 2,
        dependsOn: ['relentless_flurry'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[3],
        maxRank: 1,
        cost: 145,
        costScale: 1.0,
        isMastery: true,
        badge: 'CAPSTONE',
        svgType: 'celestial_wave'
      },

      // =====================================================================
      // 3. DISCIPLINA DOMINIO DE LA RELIQUIA (`relic`) — 12 Habilidades
      // =====================================================================
      // --- Carril 0: Senda Pírica ---
      ember_fan: {
        id: 'ember_fan',
        name: 'Abanico de Brasas',
        description: 'Multiplica los proyectiles ígneos en abanico y amplía su alcance térmico.',
        mechanicsText: 'Orbes laterales en Fuego débil; mayores rangos potencian su calibre.',
        inputHint: 'Lanza Fuego rápido con [Clic Der] o [K]',
        laneTitle: 'PÍRICA',
        tree: 'relic',
        tier: 0,
        lane: 0,
        dependsOn: [],
        reqTreePoints: TIER_POINT_REQUIREMENTS[0],
        maxRank: 3,
        cost: 30,
        costScale: 1.5,
        badge: 'FUEGO',
        svgType: 'triple_flame'
      },
      elemental_synergy: {
        id: 'elemental_synergy',
        name: 'Sinergia Elemental',
        description: 'Detona una Nova Explosiva masiva al combinar Fuego sobre objetivos enraizados o cargados.',
        mechanicsText: 'Habilita reacciones elementales; R2 incrementa +30% radio y trauma sísmico.',
        inputHint: 'Combina dos elementos distintos sobre un mismo enemigo',
        laneTitle: 'PÍRICA',
        tree: 'relic',
        tier: 1,
        lane: 0,
        dependsOn: ['ember_fan'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[1],
        maxRank: 2,
        cost: 55,
        costScale: 1.5,
        badge: 'SINERGIA',
        svgType: 'fusion_rings'
      },
      solar_cataclysm: {
        id: 'solar_cataclysm',
        name: 'Cataclismo Solar',
        description: 'El ataque fuerte de Fuego deja un crisol de magma hirviente persistente en el suelo.',
        mechanicsText: 'Zona de magma continua; R2 prolonga duración e ignición.',
        inputHint: 'Poder Fuerte de Fuego con tecla [L] o botón FUERTE',
        laneTitle: 'PÍRICA',
        tree: 'relic',
        tier: 2,
        lane: 0,
        dependsOn: ['elemental_synergy'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[2],
        maxRank: 2,
        cost: 90,
        costScale: 1.5,
        badge: 'CATACLISMO',
        svgType: 'magma_crater'
      },
      supernova_protocol: {
        id: 'supernova_protocol',
        name: 'Protocolo Supernova',
        description: 'Cada detonación de Sinergia Elemental devuelve Energía pura por enemigo golpeado.',
        mechanicsText: 'Capstone: +12 Energía por enemigo alcanzado en explosiones elementales.',
        inputHint: 'Maestría automática al provocar Sinergias',
        laneTitle: 'PÍRICA',
        tree: 'relic',
        tier: 3,
        lane: 0,
        dependsOn: ['solar_cataclysm'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[3],
        maxRank: 1,
        cost: 145,
        costScale: 1.0,
        isMastery: true,
        badge: 'CAPSTONE',
        svgType: 'solar_supernova'
      },

      // --- Carril 1: Senda Silvestre ---
      thorn_leech: {
        id: 'thorn_leech',
        name: 'Espinas Sifón',
        description: 'Las raíces y espinas absorben esencia energética de los enemigos lacerados.',
        mechanicsText: '+5/+8/+12 Energía robada por impacto de Planta.',
        inputHint: 'Canaliza Raíces con [K] / [L] tras desbloquearlas',
        laneTitle: 'SILVESTRE',
        tree: 'relic',
        tier: 0,
        lane: 1,
        dependsOn: [],
        reqTreePoints: TIER_POINT_REQUIREMENTS[0],
        maxRank: 3,
        cost: 30,
        costScale: 1.5,
        badge: 'PLANTA',
        svgType: 'thorn_vine'
      },
      bramble_snare: {
        id: 'bramble_snare',
        name: 'Prisión Selvática',
        description: 'Prolonga el enraizamiento de los enemigos y reduce su armadura elemental.',
        mechanicsText: 'Aumenta duración de raíces e inmovilización táctica (+45% en R2).',
        inputHint: 'Aplica Raíces [K] / [L] sobre enemigos',
        laneTitle: 'SILVESTRE',
        tree: 'relic',
        tier: 1,
        lane: 1,
        dependsOn: ['thorn_leech'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[1],
        maxRank: 2,
        cost: 55,
        costScale: 1.5,
        badge: 'RAÍCES',
        svgType: 'root_cage'
      },
      verdant_sanctuary: {
        id: 'verdant_sanctuary',
        name: 'Santuario Esmeralda',
        description: 'El estallido fuerte silvestre crea un aura que regenera vitalidad y postura.',
        mechanicsText: 'Regeneración en área esmeralda; R2 aumenta curación adicional.',
        inputHint: 'Usa Poder Fuerte [L] con Raíces equipadas',
        laneTitle: 'SILVESTRE',
        tree: 'relic',
        tier: 2,
        lane: 1,
        dependsOn: ['bramble_snare'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[2],
        maxRank: 2,
        cost: 90,
        costScale: 1.5,
        badge: 'AURA',
        svgType: 'sprout_aura'
      },
      ancient_bloom: {
        id: 'ancient_bloom',
        name: 'Floración Primordial',
        description: 'Tus poderes de Planta curan la Postura de Santi al alcanzar múltiples objetivos.',
        mechanicsText: 'Capstone: +18 Postura recuperada al golpear 2+ enemigos con Planta.',
        inputHint: 'Maestría automática con poderes silvestres en grupo',
        laneTitle: 'SILVESTRE',
        tree: 'relic',
        tier: 3,
        lane: 1,
        dependsOn: ['verdant_sanctuary'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[3],
        maxRank: 1,
        cost: 145,
        costScale: 1.0,
        isMastery: true,
        badge: 'CAPSTONE',
        svgType: 'bloom_lotus'
      },

      // --- Carril 2: Flujo Arcano ---
      energy_regen: {
        id: 'energy_regen',
        name: 'Flujo Elemental',
        description: 'Acelera la regeneración pasiva del Guantelete para canalizar habilidades más a menudo.',
        mechanicsText: '+2.4/s por rango de regeneración pasiva de Energía.',
        inputHint: 'Pasivo constante durante todo el combate',
        laneTitle: 'ARCANA',
        tree: 'relic',
        tier: 0,
        lane: 2,
        dependsOn: [],
        reqTreePoints: TIER_POINT_REQUIREMENTS[0],
        maxRank: 3,
        cost: 30,
        costScale: 1.5,
        badge: 'FLUJO',
        svgType: 'essence_spring'
      },
      relic_efficiency: {
        id: 'relic_efficiency',
        name: 'Eficiencia Rúnica',
        description: 'Optimiza las canalizaciones reduciendo el coste energético de todas tus habilidades.',
        mechanicsText: '-10% / -18% / -25% coste energético en habilidades elementales.',
        inputHint: 'Aplica a Poder Rápido [K] y Fuerte [L]',
        laneTitle: 'ARCANA',
        tree: 'relic',
        tier: 1,
        lane: 2,
        dependsOn: ['energy_regen'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[1],
        maxRank: 3,
        cost: 55,
        costScale: 1.5,
        badge: 'AHORRO',
        svgType: 'rune_hourglass'
      },
      arcane_overload: {
        id: 'arcane_overload',
        name: 'Saturación Rúnica',
        description: 'Cuando tienes más del 75% de Energía, tus magias infligen daño elemental sobrecargado.',
        mechanicsText: '+22% (R1) / +38% (R2) daño mágico con Energía alta.',
        inputHint: 'Lanza habilidades por encima del 75% de Energía',
        laneTitle: 'ARCANA',
        tree: 'relic',
        tier: 2,
        lane: 2,
        dependsOn: ['relic_efficiency'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[2],
        maxRank: 2,
        cost: 90,
        costScale: 1.5,
        badge: 'SOBRECARGA',
        svgType: 'charged_spire'
      },
      omega_catalyst: {
        id: 'omega_catalyst',
        name: 'Catalizador Omega',
        description: 'Expande la capacidad del Guantelete en +35 Energía y premia alternar elementos.',
        mechanicsText: 'Capstone: +35 Energía Máxima y +10 Energía inmediata al rotar elemento.',
        inputHint: 'Alterna poderes con [R], [1-4] o toque elemental',
        laneTitle: 'ARCANA',
        tree: 'relic',
        tier: 3,
        lane: 2,
        dependsOn: ['arcane_overload'],
        reqTreePoints: TIER_POINT_REQUIREMENTS[3],
        maxRank: 1,
        cost: 145,
        costScale: 1.0,
        isMastery: true,
        badge: 'CAPSTONE',
        svgType: 'omega_gauntlet'
      }
    };

    this.loadProgress();
  }

  /**
   * Carga rangos guardados (v4) o migra automáticamente rangos previos y Esencia calibrada.
   */
  loadProgress() {
    try {
      const savedRanksV4 = localStorage.getItem(STORAGE_KEYS.SKILL_RANKS_V4);
      const savedRanksLegacy = savedRanksV4 || localStorage.getItem(STORAGE_KEYS.SKILL_RANKS_V3);
      if (savedRanksLegacy) {
        const parsed = JSON.parse(savedRanksLegacy);
        if (parsed && typeof parsed === 'object') {
          this.skillRanks = {};
          for (const [rawId, r] of Object.entries(parsed)) {
            const id = rawId === 'swift_recovery' ? 'stamina_mastery' : rawId;
            if (this.skills[id] && Number(r) > 0) {
              const prev = this.skillRanks[id] || 0;
              this.skillRanks[id] = Math.min(this.skills[id].maxRank || 1, Math.max(prev, Math.floor(Number(r))));
            }
          }
        }
      } else {
        const legacyRaw = localStorage.getItem(STORAGE_KEYS.SKILLS_LEGACY_V2);
        if (legacyRaw) {
          const arr = JSON.parse(legacyRaw);
          if (Array.isArray(arr)) {
            for (const rawId of arr) {
              const id = rawId === 'swift_recovery' ? 'stamina_mastery' : rawId;
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
      const jsonRanks = JSON.stringify(this.skillRanks);
      localStorage.setItem(STORAGE_KEYS.SKILL_RANKS_V4, jsonRanks);
      localStorage.setItem(STORAGE_KEYS.SKILL_RANKS_V3, jsonRanks);
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
   * Mantiene compatibilidad transparente con `'swift_recovery'` unificado en `'stamina_mastery'`.
   * @param {string} skillId
   * @returns {number}
   */
  getSkillRank(skillId) {
    if (skillId === 'swift_recovery') {
      return Math.max(this.skillRanks.swift_recovery || 0, this.skillRanks.stamina_mastery || 0);
    }
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
    if (this.progressionManager && typeof this.progressionManager.getKarmaCostMultiplier === 'function') {
      return this.progressionManager.getKarmaCostMultiplier();
    }
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
    const scale = sk.costScale || 1.5;
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
   * Evalúa la progresión coherente vertical del Árbol:
   * - Tier 0: abierto libremente desde el inicio (9 sendas iniciales a elegir según estilo).
   * - Tiers 1–3: requieren al menos Rango 1 en su nodo padre (`dependsOn`) y alcanzar la inversión mínima en su disciplina.
   * @param {string} skillId
   * @returns {boolean}
   */
  areDependenciesMet(skillId) {
    const sk = this.skills[skillId];
    if (!sk) return false;
    if ((sk.tier || 0) === 0) return true;

    const deps = Array.isArray(sk.dependsOn) ? sk.dependsOn : [];
    for (let i = 0; i < deps.length; i++) {
      if (this.getSkillRank(deps[i]) < 1) return false;
    }

    const reqPts = sk.reqTreePoints || 0;
    if (reqPts > 0 && this.getTreePoints(sk.tree) < reqPts) {
      return false;
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
   * Indica en O(N) ligero si existe al menos una habilidad disponible para comprar/mejorar con la Esencia actual.
   * @returns {boolean}
   */
  hasAffordableSkill() {
    for (const skillId in this.skills) {
      if (this.canUnlock(skillId)) return true;
    }
    return false;
  }

  /**
   * Calcula el progreso hacia el siguiente desbloqueo o mejora disponible más económico.
   * Útil para mostrar la barra de progreso hacia el próximo punto en la cabecera del Árbol.
   * @returns {{ nextCost: number, currentEssence: number, pct: number, targetSkillName: string, ready: boolean }}
   */
  getNextUnlockProgress() {
    let minCost = Infinity;
    let targetName = 'MAESTRÍA COMPLETA';

    for (const sk of Object.values(this.skills)) {
      if (this.isMaxRank(sk.id) || !this.areDependenciesMet(sk.id)) continue;
      const cost = this.getSkillCost(sk.id);
      if (cost < minCost) {
        minCost = cost;
        targetName = sk.name;
      }
    }

    if (!Number.isFinite(minCost)) {
      return { nextCost: 0, currentEssence: this.essence, pct: 1, targetSkillName: targetName, ready: false };
    }

    const pct = Math.max(0, Math.min(1, this.essence / Math.max(1, minCost)));
    return {
      nextCost: minCost,
      currentEssence: this.essence,
      pct,
      targetSkillName: targetName,
      ready: this.essence >= minCost
    };
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
      const scale = sk.costScale || 1.5;
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
   * Reinicia por completo el progreso del árbol y la esencia a su valor de campaña nueva (`0`).
   */
  resetCampaign() {
    this.skillRanks = {};
    this.unlockedSkills.clear();
    this.essence = 0;
    this.saveProgress();
    if (this.state) {
      this.state.set('player_essence', this.essence);
      this.state.set('unlocked_skills', []);
      this.state.set('skill_ranks', {});
    }
  }
}
