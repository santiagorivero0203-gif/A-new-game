import { WEAPONS } from '../data/weapons.js';
import { SHIELDS } from '../data/shields.js';

/**
 * @module EquipmentManager
 * @description Gestor data-driven de equipamiento del jugador.
 * Administra los slots activos de arma principal (espada) y escudo defensivo,
 * permitiendo inyección de estadísticas, mitigación de postura y sinergias RPG.
 * @author Be a Legend Team
 * @version 2.0.0
 */
export class EquipmentManager {
  constructor() {
    /** @type {Object} Arma actualmente equipada por defecto */
    this.equippedWeapon = { ...WEAPONS.training_sword };

    /** @type {Object|null} Escudo actualmente equipado por defecto */
    this.equippedShield = { ...SHIELDS.wooden_shield };

    /**
     * @type {Set<string>} Armas descubiertas y desbloqueadas en el inventario.
     * Al inicio el jugador solo posee el arma básica de práctica; las armas de siguiente
     * nivel (ej. relic_blade) deben ser descubiertas en la progresión.
     */
    this.unlockedWeapons = new Set(['training_sword']);

    /**
     * @type {Set<string>} Escudos desbloqueados en el inventario.
     * Solo el escudo de roble básico está disponible al inicio.
     */
    this.unlockedShields = new Set(['wooden_shield']);
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
      this.unlockedWeapons.add(weaponId);
      return true;
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
      this.unlockedShields.add(shieldId);
      return true;
    }
    return false;
  }

  // --- Gestión de Armas ---
  getWeapon() {
    return this.equippedWeapon;
  }

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
