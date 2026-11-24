/**
 * @module ArtisanSystem
 * @description Gestor de oficios RPG en ciudades regionales (*Herreros* y *Magos Alquimistas*).
 * Permite invertir Esencia Ancestral en mejoras permanentes de herrería (filo, guardia,
 * quebranto de postura), elixires alquímicos permanentes (vitalidad, brisa, éter) y
 * pociones temporales recargables, aplicando el descuento orgánico del Karma Invisible.
 * @author Be a Legend Team
 * @version 1.0.0
 */

const ARTISAN_STORAGE_KEY = 'be_a_legend_artisan_v1';

/** @constant {Record<string, Object>} */
export const BLACKSMITH_UPGRADES = {
  forge_edge: {
    id: 'forge_edge',
    role: 'blacksmith',
    name: 'Templado de Filo Maestro',
    badge: 'HERRERÍA · FILO',
    svgType: 'sword',
    maxRank: 4,
    costs: [35, 65, 105, 155],
    description: 'Martilleo rúnico que refuerza la densidad del acero para causar mayor daño en cada tajo.',
    bonusPerRank: '+4 Daño Físico de Espada por rango.'
  },
  forge_bulwark: {
    id: 'forge_bulwark',
    role: 'blacksmith',
    name: 'Refuerzo de Guardia Rúnica',
    badge: 'HERRERÍA · ÉGIDA',
    svgType: 'shield',
    maxRank: 4,
    costs: [30, 55, 90, 135],
    description: 'Templa las juntas de tu égida y brazalete para resistir impactos pesados sin ceder postura.',
    bonusPerRank: '+18 Postura Máxima y -8% drenaje al bloquear por rango.'
  },
  forge_temper: {
    id: 'forge_temper',
    role: 'blacksmith',
    name: 'Impacto Quebrantador',
    badge: 'HERRERÍA · POSTURA',
    svgType: 'hammer',
    maxRank: 3,
    costs: [40, 75, 120],
    description: 'Añade peso equilibrado al pomo de la espada para desestabilizar escudos y corazas.',
    bonusPerRank: '+20% Daño a la Postura enemiga por rango.'
  }
};

/** @constant {Record<string, Object>} */
export const ALCHEMIST_BREWS = {
  elixir_vitality: {
    id: 'elixir_vitality',
    role: 'alchemist',
    name: 'Elixir de Sangre Solar',
    badge: 'ALQUIMIA · VITALIDAD',
    svgType: 'heart',
    maxRank: 2,
    costs: [50, 110],
    description: 'Destilado áureo de raíces antiguas que expande permanentemente tu recipiente vital.',
    bonusPerRank: '+1 ♥ Corazón Permanente + curación completa inmediata.'
  },
  elixir_zephyr: {
    id: 'elixir_zephyr',
    role: 'alchemist',
    name: 'Tónico de Brisa Silvestre',
    badge: 'ALQUIMIA · AGILIDAD',
    svgType: 'wind',
    maxRank: 3,
    costs: [35, 68, 110],
    description: 'Infusión ligera que agiliza la zancada y multiplica tu resistencia en carrera.',
    bonusPerRank: '+4% Velocidad, +20 Estamina Máxima y +18% Regen por rango.'
  },
  elixir_ether: {
    id: 'elixir_ether',
    role: 'alchemist',
    name: 'Destilado de Éter Puro',
    badge: 'ALQUIMIA · ENERGÍA',
    svgType: 'flask',
    maxRank: 3,
    costs: [35, 68, 110],
    description: 'Amplifica la capacidad del Guantelete para canalizar poderes elementales continuos.',
    bonusPerRank: '+15 Energía Máxima y +1.2 Energía/s por rango.'
  },
  potion_fury_draught: {
    id: 'potion_fury_draught',
    role: 'alchemist',
    name: 'Poción de Furia Arcana',
    badge: 'POCIÓN · 180s',
    svgType: 'spark',
    consumable: true,
    durationSec: 180,
    maxRank: 1,
    costs: [20],
    description: 'Frasco instantáneo recargable: restaura toda tu vitalidad e imbuye +22% daño durante 3 minutos.',
    bonusPerRank: 'Cura completa + +22% Daño Total (Espada y Poderes) por 180s.'
  }
};

export class ArtisanSystem {
  /**
   * @param {import('./ProgressionManager.js').ProgressionManager|null} [progressionManager=null]
   */
  constructor(progressionManager = null) {
    /** @type {import('./ProgressionManager.js').ProgressionManager|null} */
    this.progressionManager = progressionManager;

    /** @type {Record<string, Object>} */
    this.catalog = { ...BLACKSMITH_UPGRADES, ...ALCHEMIST_BREWS };

    /** @type {Record<string, number>} Rangos adquiridos en mejoras permanentes */
    this.ranks = {};

    /** @type {number} Tiempo restante (segundos) de la Poción de Furia Arcana */
    this.furyBuffRemaining = 0;

    this.loadProgress();
  }

  /**
   * Lee las mejoras guardadas desde `localStorage`.
   */
  loadProgress() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(ARTISAN_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.ranks && typeof parsed.ranks === 'object') {
          for (const [id, r] of Object.entries(parsed.ranks)) {
            const item = this.catalog[id];
            if (!item || item.consumable) continue;
            const n = Math.max(0, Math.min(item.maxRank || 1, Math.floor(Number(r) || 0)));
            if (n > 0) this.ranks[id] = n;
          }
        }
        if (typeof parsed.furyBuffRemaining === 'number' && parsed.furyBuffRemaining > 0) {
          this.furyBuffRemaining = parsed.furyBuffRemaining;
        }
      }
    } catch (_) {}
  }

  /**
   * Persiste rangos y tiempo de poción en `localStorage`.
   */
  saveProgress() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(ARTISAN_STORAGE_KEY, JSON.stringify({
        ranks: this.ranks,
        furyBuffRemaining: Math.round(this.furyBuffRemaining * 10) / 10
      }));
    } catch (_) {}
  }

  /**
   * Reinicia por completo mejoras artesanales y pociones para nueva campaña.
   */
  resetCampaign() {
    this.ranks = {};
    this.furyBuffRemaining = 0;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ARTISAN_STORAGE_KEY);
      }
    } catch (_) {}
  }

  /**
   * Retorna el catálogo ordenado perteneciente al rol (`'blacksmith'` o `'alchemist'`).
   * @param {'blacksmith'|'alchemist'} role
   * @returns {Array<Object>}
   */
  getCatalogForRole(role) {
    return Object.values(this.catalog).filter((item) => item.role === role);
  }

  /**
   * @param {string} id
   * @returns {number}
   */
  getRank(id) {
    return this.ranks[id] || 0;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  isMaxRank(id) {
    const item = this.catalog[id];
    if (!item || item.consumable) return false;
    return this.getRank(id) >= (item.maxRank || 1);
  }

  /**
   * Calcula el coste en Esencia del siguiente rango o frasco aplicando Karma Invisible.
   * @param {string} id
   * @returns {number}
   */
  getItemCost(id) {
    const item = this.catalog[id];
    if (!item) return 9999;
    const rank = item.consumable ? 0 : this.getRank(id);
    const idx = Math.min(rank, (item.costs?.length || 1) - 1);
    const base = item.costs ? item.costs[idx] : 30;
    const mult = (this.progressionManager && typeof this.progressionManager.getKarmaCostMultiplier === 'function')
      ? this.progressionManager.getKarmaCostMultiplier()
      : 1.0;
    return Math.max(1, Math.round(base * mult));
  }

  /**
   * Evalúa si la mejora o poción puede adquirirse con la Esencia actual.
   * @param {string} id
   * @param {import('./SkillTreeManager.js').SkillTreeManager|null} skillTreeManager
   * @returns {boolean}
   */
  canPurchase(id, skillTreeManager) {
    const item = this.catalog[id];
    if (!item || !skillTreeManager) return false;
    if (!item.consumable && this.isMaxRank(id)) return false;
    return skillTreeManager.getEssence() >= this.getItemCost(id);
  }

  /**
   * Forja una mejora permanente o elabora y aplica una poción al instante.
   * @param {string} id
   * @param {import('./SkillTreeManager.js').SkillTreeManager} skillTreeManager
   * @param {import('../entities/Player.js').Player|null} [player=null]
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=null]
   * @param {import('../core/AudioManager.js').AudioManager|null} [audioManager=null]
   * @returns {{ ok: boolean, reason: string, item?: Object }}
   */
  purchase(id, skillTreeManager, player = null, stateManager = null, audioManager = null) {
    const item = this.catalog[id];
    if (!item) return { ok: false, reason: 'not_found' };
    if (!item.consumable && this.isMaxRank(id)) return { ok: false, reason: 'max_rank' };
    const cost = this.getItemCost(id);
    if (!skillTreeManager || !skillTreeManager.spendEssence(cost)) {
      return { ok: false, reason: 'insufficient_essence' };
    }

    if (item.consumable) {
      this.furyBuffRemaining = Math.max(this.furyBuffRemaining, item.durationSec || 180);
      if (player) {
        player.health = player.max_health;
        player.energy = player.max_energy;
        if (typeof player.applyEffect === 'function') {
          player.applyEffect('vitality_shield', 6.0);
        }
      }
    } else {
      this.ranks[id] = this.getRank(id) + 1;
      if (id === 'elixir_vitality' && player) {
        const nextHp = (player.max_health || 3) + 1;
        player.max_health = nextHp;
        player.health = nextHp;
      } else if (id === 'forge_bulwark' && player) {
        const nextGuard = (player.max_guard || 100) + 18;
        player.max_guard = nextGuard;
        player.guard_meter = nextGuard;
      } else if (id === 'elixir_ether' && player) {
        const nextEnergy = (player.max_energy || 100) + 15;
        player.max_energy = nextEnergy;
        player.energy = Math.min(nextEnergy, (player.energy || 0) + 15);
      } else if (id === 'elixir_zephyr' && player) {
        const nextStam = (player.max_stamina || 100) + 20;
        player.max_stamina = nextStam;
        player.stamina = nextStam;
      }
    }

    if (stateManager && player) {
      stateManager.set('player_health', player.health);
      stateManager.set('player_max_health', player.max_health);
      stateManager.set('player_energy', player.energy);
      stateManager.set('player_max_energy', player.max_energy);
      stateManager.set('health_critical', player.health <= 1);
    }

    if (audioManager) {
      if (item.role === 'blacksmith' && typeof audioManager.playForgeHammer === 'function') {
        audioManager.playForgeHammer();
      } else if (item.role === 'alchemist' && typeof audioManager.playPotionBrew === 'function') {
        audioManager.playPotionBrew();
      } else if (typeof audioManager.playHeal === 'function') {
        audioManager.playHeal();
      }
    }

    this.saveProgress();
    return { ok: true, reason: 'purchased', item };
  }

  /**
   * Descuenta la duración activa de pociones temporales en partida.
   * @param {number} dt
   */
  updateBuffs(dt) {
    if (this.furyBuffRemaining > 0) {
      this.furyBuffRemaining = Math.max(0, this.furyBuffRemaining - (dt || 0));
    }
  }

  /** @returns {number} Daño plano añadido a la Espada del Alba */
  getSwordDamageBonus() {
    return this.getRank('forge_edge') * 4;
  }

  /** @returns {number} Multiplicador de daño sobre postura enemiga */
  getPostureDamageMultiplier() {
    return 1 + this.getRank('forge_temper') * 0.20;
  }

  /** @returns {number} Postura máxima adicional */
  getMaxGuardBonus() {
    return this.getRank('forge_bulwark') * 18;
  }

  /** @returns {number} Multiplicador de drenaje de postura al bloquear */
  getGuardDrainMultiplier() {
    return Math.max(0.60, 1 - this.getRank('forge_bulwark') * 0.08);
  }

  /** @returns {number} Corazones máximos adicionales por Elixir Solar */
  getMaxHealthBonus() {
    return this.getRank('elixir_vitality');
  }

  /** @returns {number} Multiplicador de velocidad de desplazamiento */
  getMoveSpeedMultiplier() {
    return 1 + this.getRank('elixir_zephyr') * 0.04;
  }

  /** @returns {number} Estamina máxima adicional */
  getMaxStaminaBonus() {
    return this.getRank('elixir_zephyr') * 20;
  }

  /** @returns {number} Multiplicador de regeneración de estamina */
  getStaminaRegenMultiplier() {
    return 1 + this.getRank('elixir_zephyr') * 0.18;
  }

  /** @returns {number} Energía elemental máxima adicional */
  getMaxEnergyBonus() {
    return this.getRank('elixir_ether') * 15;
  }

  /** @returns {number} Energía elemental adicional por segundo */
  getEnergyRegenBonus() {
    return this.getRank('elixir_ether') * 1.2;
  }

  /** @returns {number} Multiplicador total de daño activo (+22% con Poción de Furia) */
  getTotalDamageMultiplier() {
    return this.furyBuffRemaining > 0 ? 1.22 : 1.0;
  }
}
