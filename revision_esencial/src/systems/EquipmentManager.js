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
  }

  // --- Gestión de Armas ---
  getWeapon() {
    return this.equippedWeapon;
  }

  equipWeapon(weaponIdOrConfig) {
    if (typeof weaponIdOrConfig === 'string') {
      if (WEAPONS[weaponIdOrConfig]) {
        this.equippedWeapon = { ...WEAPONS[weaponIdOrConfig] };
      }
    } else if (typeof weaponIdOrConfig === 'object' && weaponIdOrConfig !== null) {
      this.equippedWeapon = weaponIdOrConfig;
    }
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log(`[EquipmentManager] Arma equipada: ${this.equippedWeapon.name}`);
    }
  }

  // --- Gestión de Escudos ---
  getShield() {
    return this.equippedShield;
  }

  equipShield(shieldIdOrConfig) {
    if (typeof shieldIdOrConfig === 'string') {
      if (SHIELDS[shieldIdOrConfig]) {
        this.equippedShield = { ...SHIELDS[shieldIdOrConfig] };
      }
    } else if (typeof shieldIdOrConfig === 'object' && shieldIdOrConfig !== null) {
      this.equippedShield = shieldIdOrConfig;
    }
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log(`[EquipmentManager] Escudo equipado: ${this.equippedShield ? this.equippedShield.name : 'Ninguno'}`);
    }
  }

  removeShield() {
    this.equippedShield = null;
  }
}
