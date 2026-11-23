/**
 * @module ProgressionManager
 * @description Gestor central de campaña, World-State Tiering, progresión elemental por mundo,
 * Karma Invisible y enlaces lógicos (`logic_links` / `sealedBy`) para *Be a Legend*.
 *
 * Responsabilidades:
 * 1. Persistir el progreso global entre sesiones en `localStorage` (`be_a_legend_campaign_v1`).
 * 2. Garantizar desbloqueo progresivo real de 1 poder elemental por mundo (`Fuego` -> `Raíces` -> `Embestida` -> `Éter`).
 * 3. Calcular multiplicadores moderados de World-State Tiering (escalado híbrido sin esponjas de daño).
 * 4. Registrar eventos de Karma Invisible con idempotencia y multiplicador económico orgánico (`0.85x`..`1.15x`).
 * 5. Coordinar `logic_links` entre interruptores/jefes y compuertas/portales sellados (`sealedBy`).
 *
 * @author Be a Legend Team
 * @version 1.0.0
 */

const STORAGE_KEY = 'be_a_legend_campaign_v1';

/**
 * Orden oficial de progresión entre los 4 mundos de la campaña.
 * @constant {Record<string, { prereq: string|null, coreElement: string, index: number }>}
 */
export const CAMPAIGN_WORLD_ORDER = {
  cave_exit_intro: { prereq: null, coreElement: 'Fuego', index: 1 },
  marsh_of_spores: { prereq: 'cave_exit_intro', coreElement: 'Raíces', index: 2 },
  ash_caldera: { prereq: 'marsh_of_spores', coreElement: 'Embestida', index: 3 },
  astral_citadel: { prereq: 'ash_caldera', coreElement: 'Éter', index: 4 }
};

export class ProgressionManager {
  /**
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=null]
   */
  constructor(stateManager = null) {
    /** @type {import('../core/StateManager.js').StateManager|null} */
    this.state = stateManager;

    /** @type {Set<string>} Elementos canónicos despertados ('Fuego', 'Plantas', 'Embestida', 'Éter') */
    this.unlockedElements = new Set();

    /** @type {Set<string>} Mundos cuyo Guardián Regional fue derrotado */
    this.completedWorlds = new Set();

    /** @type {Set<string>} Mundos ya alcanzados/desbloqueados por el jugador */
    this.visitedWorlds = new Set(['cave_exit_intro']);

    /** @type {number} Karma acumulado invisible (-N .. +N) */
    this.karmaLevel = 0;

    /** @type {Set<string>} IDs de eventos morales ya registrados para idempotencia */
    this.karmaEvents = new Set();

    /** @type {Set<string>} Enlaces lógicos resueltos en formato `${worldId}:${linkId}` */
    this.resolvedLinks = new Set();

    /** @type {Set<string>} Mundos cuya secuencia de revelación inicial de poder ya se mostró */
    this.seenWorldReveals = new Set();

    /** @type {number|null} Handle de guardado diferido */
    this._saveTimer = null;

    this.loadProgress();
  }

  /**
   * Normaliza cualquier alias elemental hacia la clave canónica interna usada por `Player`.
   * @param {string} name
   * @returns {string}
   */
  normalizeElement(name) {
    if (!name) return '';
    const key = String(name).trim().toLowerCase();
    if (key === 'fuego' || key === 'fire') return 'Fuego';
    if (key === 'raíces' || key === 'raices' || key === 'plantas' || key === 'tierra' || key === 'earth') {
      return 'Plantas';
    }
    if (key === 'embestida' || key === 'kinetic' || key === 'cinético' || key === 'cinetico') {
      return 'Embestida';
    }
    if (key === 'éter' || key === 'eter' || key === 'astral' || key === 'ether' || key === 'magnetico' || key === 'magnético') {
      return 'Éter';
    }
    return name;
  }

  /**
   * Convierte una clave elemental canónica en su nombre visible para HUD/Rueda Radial.
   * @param {string} name
   * @returns {string}
   */
  toDisplayElement(name) {
    const norm = this.normalizeElement(name);
    if (norm === 'Plantas') return 'Raíces';
    return norm;
  }

  /**
   * Nivel global de la Reliquia (0..4) equivalente al número de núcleos despertados.
   * @returns {number}
   */
  getWorldTier() {
    return Math.min(4, this.unlockedElements.size);
  }

  /**
   * Sincroniza los campos globales de campaña hacia `StateManager`.
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=this.state]
   */
  syncState(stateManager = this.state) {
    const st = stateManager || this.state;
    if (!st || typeof st.set !== 'function') return;
    st.set('gauntlet_tier', this.getWorldTier());
    st.set('unlocked_powers', Array.from(this.unlockedElements).map((e) => this.toDisplayElement(e)));
    st.set('completed_worlds', Array.from(this.completedWorlds));
    st.set('visited_worlds', Array.from(this.visitedWorlds));
    st.set('karma_level', this.karmaLevel);
  }

  /**
   * Despierta un núcleo elemental en la campaña, actualiza al jugador y guarda progreso.
   * @param {string} elem
   * @param {import('../entities/Player.js').Player|null} [player=null]
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=this.state]
   * @returns {boolean} True si es un elemento nuevo en la campaña
   */
  unlockElement(elem, player = null, stateManager = this.state) {
    const norm = this.normalizeElement(elem);
    if (!norm) return false;
    const isNew = !this.unlockedElements.has(norm);
    this.unlockedElements.add(norm);

    const display = this.toDisplayElement(norm);
    if (player && typeof player.unlockElement === 'function') {
      player.unlockElement(norm);
    }

    const st = stateManager || this.state;
    if (st && typeof st.set === 'function') {
      st.set('equipped_power', display);
    }
    this.syncState(st);
    this._scheduleSave();
    return isNew;
  }

  /**
   * Sincroniza los elementos y estado de espada del jugador con el estado persistente de campaña.
   * En modo Playtest del editor desbloquea los 4 elementos para permitir probar cualquier zona libremente.
   * @param {import('../entities/Player.js').Player} player
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=this.state]
   * @param {{ isPlaytest?: boolean, startDormant?: boolean }} [opts={}]
   */
  syncPlayerFromCampaign(player, stateManager = this.state, { isPlaytest = false, startDormant = false } = {}) {
    if (!player) return;
    const st = stateManager || this.state;

    if (isPlaytest) {
      if (typeof player.unlockSword === 'function') player.unlockSword();
      if (typeof player.unlockAllElements === 'function') player.unlockAllElements();
      if (st && typeof st.set === 'function') {
        st.set('gauntlet_tier', 4);
        st.set('unlocked_powers', ['Fuego', 'Raíces', 'Embestida', 'Éter']);
        if (!player.currentAbility || !player.hasElement(player.currentAbility)) {
          player.equipAbility('Fuego');
        }
        st.set('equipped_power', this.toDisplayElement(player.currentAbility || 'Fuego'));
      }
      return;
    }

    player.unlockedElements.clear();
    for (const elem of this.unlockedElements) {
      if (player.abilities && player.abilities[elem]) {
        player.unlockedElements.add(elem);
      }
    }

    if (player.unlockedElements.size > 0 || !startDormant) {
      if (typeof player.unlockSword === 'function') {
        player.unlockSword();
      } else {
        player.hasSword = true;
      }
    } else if (startDormant && this.unlockedElements.size === 0) {
      player.hasSword = false;
    }

    if (player.unlockedElements.size > 0) {
      if (!player.currentAbility || !player.hasElement(player.currentAbility)) {
        const firstElem = Array.from(player.unlockedElements)[0];
        player.equipAbility(firstElem);
      }
      if (st && typeof st.set === 'function') {
        st.set('equipped_power', this.toDisplayElement(player.currentAbility));
      }
    }

    this.syncState(st);
  }

  /**
   * Garantiza coherencia retroactiva en partidas guardadas: si el jugador ya accedió
   * a un mundo posterior en la campaña, asegura que los Núcleos Elementales obligatorios
   * de los mundos previos estén despiertos en `unlockedElements`.
   * @private
   */
  _healPrerequisiteCores() {
    const entries = Object.entries(CAMPAIGN_WORLD_ORDER);
    for (let i = 0; i < entries.length; i++) {
      const [, cfg] = entries[i];
      if (!cfg || !cfg.coreElement) continue;
      let laterVisited = false;
      for (let j = i + 1; j < entries.length; j++) {
        const [laterId] = entries[j];
        if (this.visitedWorlds.has(laterId) || this.completedWorlds.has(laterId)) {
          laterVisited = true;
          break;
        }
      }
      if (laterVisited) {
        const norm = this.normalizeElement(cfg.coreElement);
        if (norm) this.unlockedElements.add(norm);
      }
    }
  }

  /**
   * Marca un mundo como visitado para habilitar su acceso directo en sesiones posteriores.
   * @param {string} worldId
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=this.state]
   */
  markWorldVisited(worldId, stateManager = this.state) {
    if (!worldId) return;
    const hadWorld = this.visitedWorlds.has(worldId);
    this.visitedWorlds.add(worldId);
    const sizeBefore = this.unlockedElements.size;
    this._healPrerequisiteCores();
    if (!hadWorld || this.unlockedElements.size !== sizeBefore) {
      this.syncState(stateManager);
      this._scheduleSave();
    }
  }

  /**
   * Consulta si ya se mostró la guía inicial de ubicación del Núcleo Elemental para `worldId`.
   * @param {string} worldId
   * @returns {boolean}
   */
  hasSeenWorldReveal(worldId) {
    return Boolean(worldId && this.seenWorldReveals.has(worldId));
  }

  /**
   * Marca como vista la guía inicial de ubicación del Núcleo Elemental en `worldId`.
   * @param {string} worldId
   */
  markWorldRevealSeen(worldId) {
    if (!worldId || this.seenWorldReveals.has(worldId)) return;
    this.seenWorldReveals.add(worldId);
    this._scheduleSave();
  }

  /**
   * Consulta si el Núcleo Elemental propio de `worldId` ya fue despertado.
   * @param {string} worldId
   * @returns {boolean}
   */
  hasUnlockedWorldCore(worldId) {
    const cfg = CAMPAIGN_WORLD_ORDER[worldId];
    if (!cfg || !cfg.coreElement) return true;
    const norm = this.normalizeElement(cfg.coreElement);
    return this.unlockedElements.has(norm);
  }

  /**
   * Marca un mundo como conquistado tras derrotar a su Guardián Regional.
   * @param {string} worldId
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=this.state]
   * @returns {boolean} True si es la primera vez que se completa este mundo
   */
  completeWorld(worldId, stateManager = this.state) {
    if (!worldId) return false;
    const isNew = !this.completedWorlds.has(worldId);
    this.completedWorlds.add(worldId);
    this.visitedWorlds.add(worldId);
    this.syncState(stateManager);
    this._scheduleSave();
    return isNew;
  }

  /**
   * Verifica si un mundo oficial está desbloqueado para viajar desde el Códice o portales.
   * @param {string} worldId
   * @returns {boolean}
   */
  isWorldUnlocked(worldId) {
    if (!worldId) return false;
    const cfg = CAMPAIGN_WORLD_ORDER[worldId];
    if (!cfg || !cfg.prereq) return true;
    if (this.visitedWorlds.has(worldId)) return true;
    return this.completedWorlds.has(cfg.prereq) && this.hasUnlockedWorldCore(cfg.prereq);
  }

  /**
   * Registra un evento moral de Karma Invisible de manera idempotente.
   * @param {string} eventId
   * @param {number} delta
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=this.state]
   * @returns {boolean} True si se aplicó por primera vez
   */
  recordKarmaEvent(eventId, delta, stateManager = this.state) {
    if (!eventId || this.karmaEvents.has(eventId)) return false;
    this.karmaEvents.add(eventId);
    this.karmaLevel += Number(delta) || 0;
    const st = stateManager || this.state;
    if (st && typeof st.set === 'function') {
      st.set('karma_level', this.karmaLevel);
    }
    this._scheduleSave();
    return true;
  }

  /**
   * Retorna el multiplicador económico invisible derivado del Karma acumulado.
   * @returns {number} `0.85` (karma positivo >= 2), `1.15` (karma negativo <= -2), o `1.0`
   */
  getKarmaCostMultiplier() {
    if (this.karmaLevel >= 2) return 0.85;
    if (this.karmaLevel <= -2) return 1.15;
    return 1.0;
  }

  /**
   * Calcula un escalado híbrido moderado de World-State Tiering (1.0 .. 1.36x) para enemigos
   * que vuelven a zonas previas o patrullas escaladas, evitando esponjas de daño.
   * @param {string} worldId
   * @param {boolean} [isBoss=false]
   * @returns {number}
   */
  getWorldScalingMultiplier(worldId, isBoss = false) {
    const tier = this.getWorldTier();
    const worldIdx = CAMPAIGN_WORLD_ORDER[worldId]?.index || 1;
    const extraTiers = Math.max(0, tier - (worldIdx - 1));
    const step = isBoss ? 0.05 : 0.09;
    return Math.min(1.36, 1.0 + extraTiers * step);
  }

  /**
   * Verifica si todos los enlaces lógicos requeridos (`sealedBy`) ya fueron resueltos en `worldId`.
   * @param {string} worldId
   * @param {Array<string>} [reqList=[]]
   * @returns {boolean}
   */
  areRequirementsMet(worldId, reqList = []) {
    if (!Array.isArray(reqList) || reqList.length === 0) return true;
    for (let i = 0; i < reqList.length; i++) {
      const reqId = reqList[i];
      if (!reqId) continue;
      if (!this.resolvedLinks.has(`${worldId}:${reqId}`)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Registra la resolución de un interruptor o jefe (`sourceId`) y desbloquea las compuertas
   * o portales (`sealedBy`) cuyas condiciones queden completas, emitiendo haz de luz y sonido.
   * @param {string} worldId
   * @param {string} sourceId
   * @param {Object|null} [context=null]
   * @param {{ x: number, y: number }|null} [sourcePos=null]
   */
  registerLinkEvent(worldId, sourceId, context = null, sourcePos = null) {
    if (!worldId || !sourceId) return;
    const key = `${worldId}:${sourceId}`;
    this.resolvedLinks.add(key);
    this._scheduleSave();

    const em = context && context.entityManager;
    if (!em || typeof em.getByTag !== 'function') return;

    const props = em.getByTag('prop');
    for (let i = props.length - 1; i >= 0; i--) {
      const prop = props[i];
      if (!prop || prop.isDead || !Array.isArray(prop.sealedBy) || prop.sealedBy.length === 0) continue;
      if (!prop.sealedBy.includes(sourceId)) continue;

      if (this.areRequirementsMet(worldId, prop.sealedBy)) {
        const targetCx = prop.pos.x + prop.width * 0.5;
        const targetCy = prop.pos.y + prop.height * 0.5;
        if (sourcePos && context.vfxRenderer && typeof context.vfxRenderer.spawnLogicBeam === 'function') {
          context.vfxRenderer.spawnLogicBeam(
            sourcePos.x,
            sourcePos.y,
            targetCx,
            targetCy,
            prop.runeColor || prop.portalColor || '#38bdf8'
          );
        }
        if (typeof prop.onSealBroken === 'function') {
          prop.onSealBroken(context);
        }
        if (context.audioManager && typeof context.audioManager.playGateUnlock === 'function') {
          context.audioManager.playGateUnlock();
        }
      }
    }
  }

  /**
   * Programa guardado diferido para evitar I/O síncrono en ráfagas de eventos.
   * @private
   */
  _scheduleSave() {
    if (typeof localStorage === 'undefined' || this._saveTimer !== null) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.saveProgress();
    }, 400);
  }

  /**
   * Persiste inmediatamente el estado de la campaña en `localStorage`.
   */
  saveProgress() {
    if (this._saveTimer !== null) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    if (typeof localStorage === 'undefined') return;
    try {
      const payload = {
        unlockedElements: Array.from(this.unlockedElements),
        completedWorlds: Array.from(this.completedWorlds),
        visitedWorlds: Array.from(this.visitedWorlds),
        karmaLevel: this.karmaLevel,
        karmaEvents: Array.from(this.karmaEvents),
        resolvedLinks: Array.from(this.resolvedLinks),
        seenWorldReveals: Array.from(this.seenWorldReveals)
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[ProgressionManager] Error guardando campaña:', e);
    }
  }

  /**
   * Carga el estado guardado de campaña desde `localStorage`.
   */
  loadProgress() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.syncState(this.state);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.unlockedElements)) {
          this.unlockedElements = new Set(parsed.unlockedElements.map((e) => this.normalizeElement(e)).filter(Boolean));
        }
        if (Array.isArray(parsed.completedWorlds)) {
          this.completedWorlds = new Set(parsed.completedWorlds);
        }
        if (Array.isArray(parsed.visitedWorlds)) {
          this.visitedWorlds = new Set(['cave_exit_intro', ...parsed.visitedWorlds]);
        }
        if (typeof parsed.karmaLevel === 'number' && !Number.isNaN(parsed.karmaLevel)) {
          this.karmaLevel = parsed.karmaLevel;
        }
        if (Array.isArray(parsed.karmaEvents)) {
          this.karmaEvents = new Set(parsed.karmaEvents);
        }
        if (Array.isArray(parsed.resolvedLinks)) {
          this.resolvedLinks = new Set(parsed.resolvedLinks);
        }
        if (Array.isArray(parsed.seenWorldReveals)) {
          this.seenWorldReveals = new Set(parsed.seenWorldReveals);
        }
        this._healPrerequisiteCores();
      }
    } catch (e) {
      console.warn('[ProgressionManager] Error cargando campaña:', e);
    }
    this.syncState(this.state);
  }

  /**
   * Reinicia íntegramente el progreso de campaña a estado inicial dormido.
   */
  resetCampaign() {
    this.unlockedElements.clear();
    this.completedWorlds.clear();
    this.visitedWorlds = new Set(['cave_exit_intro']);
    this.karmaLevel = 0;
    this.karmaEvents.clear();
    this.resolvedLinks.clear();
    this.seenWorldReveals.clear();
    this.saveProgress();
    this.syncState(this.state);
  }
}

