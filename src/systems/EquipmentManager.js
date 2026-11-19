import { WEAPONS } from '../data/weapons.js';
import { SHIELDS } from '../data/shields.js';

const EQUIPMENT_STORAGE_KEY = 'be_a_legend_equipment';

/**
 * @module EquipmentManager
 * @description Gestor data-driven de equipamiento del jugador con persistencia en `localStorage`.
 * Administra los slots activos de arma principal (espada) y escudo defensivo,
 * permitiendo inyección de estadísticas, mitigación de postura y sinergias RPG.
 * @author Be a Legend Team
 * @version 2.1.0
 */
export class EquipmentManager {
  constructor() {
    /** @type {Object} Arma actualmente equipada por defecto */
    this.equippedWeapon = { ...WEAPONS.training_sword };

    /** @type {Object|null} Escudo actualmente equipado por defecto */
    this.equippedShield = { ...SHIELDS.wooden_shield };

    /**
     * @type {Set<string>} Armas descubiertas y desbloqueadas en el inventario.
     */
    this.unlockedWeapons = new Set(['training_sword']);

    /**
     * @type {Set<string>} Escudos desbloqueados en el inventario.
     */
    this.unlockedShields = new Set(['wooden_shield']);

    this._loadFromStorage();
  }

  /**
   * Carga equipamiento y desbloqueos guardados en `localStorage`.
   * @private
   */
  _loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;

      if (Array.isArray(data.unlockedWeapons)) {
        for (const id of data.unlockedWeapons) {
          if (WEAPONS[id]) this.unlockedWeapons.add(id);
        }
      }
      if (Array.isArray(data.unlockedShields)) {
        for (const id of data.unlockedShields) {
          if (SHIELDS[id]) this.unlockedShields.add(id);
        }
      }
      if (data.weaponId && this.unlockedWeapons.has(data.weaponId) && WEAPONS[data.weaponId]) {
        this.equippedWeapon = { ...WEAPONS[data.weaponId] };
      }
      if (data.shieldId && this.unlockedShields.has(data.shieldId) && SHIELDS[data.shieldId]) {
        this.equippedShield = { ...SHIELDS[data.shieldId] };
      }
    } catch (_) {
      // Ignorar errores de acceso en modo estricto
    }
  }

  /**
   * Guarda el estado del inventario y equipo activo en `localStorage`.
   * @private
   */
  _saveToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify({
        weaponId: this.equippedWeapon ? this.equippedWeapon.id : 'training_sword',
        shieldId: this.equippedShield ? this.equippedShield.id : 'wooden_shield',
        unlockedWeapons: Array.from(this.unlockedWeapons),
        unlockedShields: Array.from(this.unlockedShields)
      }));
    } catch (_) {}
  }

  /**
   * Reinicia el arsenal desbloqueado al equipamiento básico de campaña nueva.
   */
  reset() {
    this.unlockedWeapons = new Set(['training_sword']);
    this.unlockedShields = new Set(['wooden_shield']);
    this.equippedWeapon = { ...WEAPONS.training_sword };
    this.equippedShield = { ...SHIELDS.wooden_shield };
    this._saveToStorage();
  }

  // --- Progresión y Desbloqueos de Inventario ---

  /**
   * Comprueba si un arma está desbloqueada en el inventario del jugador.
   * @param {string} weaponId
   * @returns {boolean}
   */
  isWeaponUnlocked(weaponId) {
    if (!weaponId) return false;
    return this.unlockedWeapons.has(weaponId);
  }

  /**
   * Desbloquea un arma de siguiente nivel en el inventario.
   * @param {string} weaponId
   * @returns {boolean}
   */
  unlockWeapon(weaponId) {
    if (WEAPONS[weaponId]) {
      const isNew = !this.unlockedWeapons.has(weaponId);
      this.unlockedWeapons.add(weaponId);
      if (isNew) this._saveToStorage();
      return isNew;
    }
    return false;
  }

  /**
   * Comprueba si un escudo está desbloqueado en el inventario del jugador.
   * @param {string} shieldId
   * @returns {boolean}
   */
  isShieldUnlocked(shieldId) {
    if (!shieldId) return false;
    return this.unlockedShields.has(shieldId);
  }

  /**
   * Desbloquea un escudo de siguiente nivel en el inventario.
   * @param {string} shieldId
   * @returns {boolean}
   */
  unlockShield(shieldId) {
    if (SHIELDS[shieldId]) {
      const isNew = !this.unlockedShields.has(shieldId);
      this.unlockedShields.add(shieldId);
      if (isNew) this._saveToStorage();
      return isNew;
    }
    return false;
  }

  // --- Gestión de Armas ---
  getWeapon() {
    return this.equippedWeapon;
  }

  /**
   * Equipa un arma desbloqueada por ID u objeto de configuración.
   * @param {string|Object} weaponIdOrConfig
   * @returns {boolean}
   */
  equipWeapon(weaponIdOrConfig) {
    let targetId = null;
    let targetConfig = null;

    if (typeof weaponIdOrConfig === 'string') {
      targetId = weaponIdOrConfig;
      targetConfig = WEAPONS[targetId] ? { ...WEAPONS[targetId] } : null;
    } else if (typeof weaponIdOrConfig === 'object' && weaponIdOrConfig !== null) {
      targetId = weaponIdOrConfig.id;
      targetConfig = weaponIdOrConfig;
    }

    if (!targetId || !this.isWeaponUnlocked(targetId)) {
      if (typeof window !== 'undefined' && window.DEBUG_MODE) {
        console.warn(`[EquipmentManager] Arma bloqueada: ${targetId}. Requiere desbloqueo en la progresión.`);
      }
      return false;
    }

    if (targetConfig) {
      this.equippedWeapon = targetConfig;
      this._saveToStorage();
    }
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log(`[EquipmentManager] Arma equipada: ${this.equippedWeapon.name}`);
    }
    return true;
  }

  // --- Gestión de Escudos ---
  getShield() {
    return this.equippedShield;
  }

  /**
   * Equipa un escudo desbloqueado por ID u objeto de configuración.
   * @param {string|Object} shieldIdOrConfig
   * @returns {boolean}
   */
  equipShield(shieldIdOrConfig) {
    let targetId = null;
    let targetConfig = null;

    if (typeof shieldIdOrConfig === 'string') {
      targetId = shieldIdOrConfig;
      targetConfig = SHIELDS[targetId] ? { ...SHIELDS[targetId] } : null;
    } else if (typeof shieldIdOrConfig === 'object' && shieldIdOrConfig !== null) {
      targetId = shieldIdOrConfig.id;
      targetConfig = shieldIdOrConfig;
    }

    if (!targetId || !this.isShieldUnlocked(targetId)) {
      if (typeof window !== 'undefined' && window.DEBUG_MODE) {
        console.warn(`[EquipmentManager] Escudo bloqueado: ${targetId}. Requiere desbloqueo en la progresión.`);
      }
      return false;
    }

    if (targetConfig) {
      this.equippedShield = targetConfig;
      this._saveToStorage();
    }
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log(`[EquipmentManager] Escudo equipado: ${this.equippedShield ? this.equippedShield.name : 'Ninguno'}`);
    }
    return true;
  }

  removeShield() {
    this.equippedShield = null;
  }
}
