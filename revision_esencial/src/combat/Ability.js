/**
 * @module Ability
 * @description Clase base abstracta para todos los poderes elementales.
 * Dictamina la estructura para ataque primario (débil) y secundario (fuerte).
 */
export class Ability {
  constructor(name) {
    this.name = name;
  }

  /**
   * Ejecuta el ataque primario/débil. Retorna el tiempo en segundos que dura la animación/estado.
   * @param {import('../entities/Player.js').Player} player 
   * @param {Object} context 
   * @returns {number} Duración en segundos
   */
  executeWeak(player, context) {
    return 0; // Sobrescribir
  }

  /**
   * Ejecuta el ataque secundario/fuerte. Consume momentum.
   * @param {import('../entities/Player.js').Player} player 
   * @param {Object} context 
   * @returns {number} Duración en segundos
   */
  executeStrong(player, context) {
    return 0; // Sobrescribir
  }
}
