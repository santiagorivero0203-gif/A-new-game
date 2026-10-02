/**
 * @module SkillTreeManager
 * @description Gestor del árbol de habilidades.
 * Administra el estado de los nodos desbloqueados y su persistencia en localStorage.
 * Evalúa las dependencias y el costo (si aplica) para desbloquear habilidades.
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class SkillTreeManager {
  /**
   * @param {import('../core/StateManager.js').StateManager} stateManager 
   */
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.storageKey = 'be_a_legend_skills';

    // Definición de nodos de habilidades
    // Estructura: id, name, description, cost (karma o skill_points), dependsOn (array de ids)
    this.skills = {
      'dash_cooldown': {
        id: 'dash_cooldown',
        name: 'Agilidad Mejorada',
        description: 'Reduce el enfriamiento del Dash.',
        cost: 10,
        dependsOn: []
      },
      'max_health_up': {
        id: 'max_health_up',
        name: 'Vitalidad Ancestral',
        description: 'Añade un corazón extra a tu salud máxima.',
        cost: 20,
        dependsOn: ['dash_cooldown']
      },
      'parry_window': {
        id: 'parry_window',
        name: 'Reflejos de Duelista',
        description: 'Aumenta ligeramente la ventana de parry.',
        cost: 15,
        dependsOn: []
      },
      'energy_regen': {
        id: 'energy_regen',
        name: 'Flujo Elemental',
        description: 'Aumenta la regeneración pasiva de energía.',
        cost: 25,
        dependsOn: ['parry_window']
      }
    };

    this.unlockedSkills = new Set();
    this.load();
  }

  /**
   * Carga las habilidades desbloqueadas desde localStorage
   */
  load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const arr = JSON.parse(data);
        if (Array.isArray(arr)) {
          this.unlockedSkills = new Set(arr);
        }
      }
    } catch (e) {
      console.warn('[SkillTreeManager] Error cargando habilidades:', e);
    }
    
    // Sincronizar al estado global
    if (this.stateManager) {
      this.stateManager.set('unlocked_skills', Array.from(this.unlockedSkills));
    }
  }

  /**
   * Guarda las habilidades desbloqueadas en localStorage
   */
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(Array.from(this.unlockedSkills)));
      if (this.stateManager) {
        this.stateManager.set('unlocked_skills', Array.from(this.unlockedSkills));
      }
    } catch (e) {
      console.warn('[SkillTreeManager] Error guardando habilidades:', e);
    }
  }

  /**
   * Verifica si una habilidad puede ser desbloqueada (dependencias)
   * @param {string} skillId 
   * @returns {boolean}
   */
  canUnlock(skillId) {
    if (this.unlockedSkills.has(skillId)) return false;
    const skill = this.skills[skillId];
    if (!skill) return false;

    // Verificar dependencias
    if (skill.dependsOn && skill.dependsOn.length > 0) {
      for (const dep of skill.dependsOn) {
        if (!this.unlockedSkills.has(dep)) {
          return false;
        }
      }
    }

    // Aquí podríamos verificar el coste usando karma o skill_points
    // const currentPoints = this.stateManager.get('skill_points') || 0;
    // if (currentPoints < skill.cost) return false;

    return true;
  }

  /**
   * Desbloquea una habilidad si cumple los requisitos
   * @param {string} skillId 
   * @returns {boolean} true si se desbloqueó con éxito
   */
  unlockSkill(skillId) {
    if (this.canUnlock(skillId)) {
      this.unlockedSkills.add(skillId);
      
      // Aplicar el coste si tuviéramos un currency
      // const currentPoints = this.stateManager.get('skill_points') || 0;
      // this.stateManager.set('skill_points', currentPoints - this.skills[skillId].cost);

      this.save();
      
      if (typeof window !== 'undefined' && window.DEBUG_MODE) {
        console.log(`[SkillTreeManager] Habilidad desbloqueada: ${this.skills[skillId].name}`);
      }
      return true;
    }
    return false;
  }

  /**
   * Verifica si una habilidad está desbloqueada
   * @param {string} skillId 
   * @returns {boolean}
   */
  hasSkill(skillId) {
    return this.unlockedSkills.has(skillId);
  }

  /**
   * Resetea el árbol de habilidades (útil para nueva partida o debug)
   */
  reset() {
    this.unlockedSkills.clear();
    this.save();
  }
}
