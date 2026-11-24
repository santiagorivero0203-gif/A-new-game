import { WEAPONS } from '../data/weapons.js';
import { SHIELDS } from '../data/shields.js';
import { WORLDS_LIST } from '../data/worlds.js';
import { formatControlPrompts } from '../utils/textFormatter.js';

/**
 * @module UIManager
 * @description Gestor desacoplado de interfaz de usuario en DOM Overlay (HTML5/CSS3 + High-DPI SVGs).
 * Implementa la estética 2D Cel-Shaded Cartoon/Anime RPG y el Hub Unificado del Santuario (4 pestañas:
 * Habilidades, Arsenal, Crónica & Códice y Sistema), garantizando cero solapamientos entre capas
 * (Cinemáticas, Título, Santuario y Gameplay) y soporte responsivo 16:9 <-> 9:16.
 * @author Be a Legend Team
 * @version 3.0.0
 */
export class UIManager {
  constructor() {
    // --- Capas Maestras del DOM Overlay ---
    this.overlayEl = document.getElementById('ui-overlay');
    this.vignetteEl = document.getElementById('vignette-overlay');
    this.gameplayLayer = document.getElementById('hud-gameplay-layer');

    // 1. HUD Principal Cel-Shaded del Jugador (Top-Left)
    this.hudContainer = document.getElementById('hud-container');
    this.hudRelicBadge = document.getElementById('hud-relic-badge');
    this.hudCrestImg = document.getElementById('hud-crest-img');
    this.hudRelicIcon = document.getElementById('hud-relic-icon');
    this.hudRelicCircle = this.hudRelicIcon ? this.hudRelicIcon.querySelector('circle') : null;
    this.hudCrestTag = document.getElementById('hud-crest-tag');
    this.hudPowerName = document.getElementById('hud-power-name');
    this.hudHeartsContainer = document.getElementById('hud-hearts');
    this.heartElements = [];
    this.hudHpFill = document.getElementById('hud-hp-fill');
    this.hudHpGhostFill = document.getElementById('hud-hp-ghost-fill');
    this.hudHpChassis = this.hudHpFill ? this.hudHpFill.parentElement : null;
    this.hudHpSegments = document.getElementById('hud-hp-segments');
    this.hudHpText = document.getElementById('hud-hp-text');
    this.hudEnergyFill = document.getElementById('hud-energy-fill');
    this.hudEnergyGhostFill = document.getElementById('hud-energy-ghost-fill');
    this.hudEnergyChassis = this.hudEnergyFill ? this.hudEnergyFill.parentElement : null;
    this.hudEnergyHealTick = document.getElementById('hud-energy-heal-tick');
    this.hudEnergyStrongTick = document.getElementById('hud-energy-strong-tick');
    this.hudEnergyStatIcon = document.getElementById('hud-energy-stat-icon');
    this.gaugePct = document.getElementById('gauge-pct');
    this.gaugePowerAbbr = document.getElementById('gauge-power-abbr');
    this.gaugeIcon = document.getElementById('gauge-icon');
    this.hudPostureWrap = document.getElementById('hud-posture-wrap');
    this.hudPostureFill = document.getElementById('hud-posture-fill');
    this.hudPostureGhostFill = document.getElementById('hud-posture-ghost-fill');
    this.hudPostureText = document.getElementById('hud-posture-text');
    this.threatVignetteEl = document.getElementById('threat-corner-vignette');
    this.hudStaminaWrap = document.getElementById('hud-stamina-wrap');
    this.hudStaminaFill = document.getElementById('hud-stamina-fill');
    this.hudStaminaText = document.getElementById('hud-stamina-text');

    // 1.B Botones Rápidos Superiores Derechos (Top-Right)
    this.btnQuickPause = document.getElementById('btn-quick-pause');
    this.btnQuickTalents = document.getElementById('btn-quick-talents');
    this.hudTalentBadgeDot = document.getElementById('hud-talent-badge-dot');
    this.btnQuickArsenal = document.getElementById('btn-quick-arsenal');
    this.hudEssenceVal = document.getElementById('hud-essence-val');

    // 1.C Rumbo / Objetivo (Brújula God of War Ragnarök), Combo, Jefe y Hordas
    this.objectiveTracker = document.getElementById('objective-hud-tracker');
    this.objectiveTextEl = document.getElementById('objective-hud-text');
    this.compassMarkerEl = document.getElementById('compass-target-marker');
    this.compassDirEl = document.getElementById('compass-target-dir');
    this.compassDistEl = document.getElementById('compass-target-dist');
    this.compassCardNW = document.getElementById('compass-card-nw');
    this.compassCardCenter = document.getElementById('compass-card-center');
    this.compassCardNE = document.getElementById('compass-card-ne');
    this.comboHud = document.getElementById('combo-hud');
    this.comboRankBadge = document.getElementById('combo-rank-badge');
    this.comboCountText = document.getElementById('combo-count-text');
    this.comboRankTitle = document.getElementById('combo-rank-title');
    this.comboTimerFill = document.getElementById('combo-timer-fill');

    this.bossThreatBar = document.getElementById('boss-threat-bar');
    this.bossThreatName = document.getElementById('boss-threat-name');
    this.bossThreatStatus = document.getElementById('boss-threat-status');
    this.bossThreatFill = document.getElementById('boss-threat-fill');

    this.hordeTracker = document.getElementById('horde-hud-tracker');
    this.hordeWaveLabel = document.getElementById('horde-tracker-wave-label');
    this.hordeEnemiesVal = document.getElementById('horde-tracker-enemies-val');
    this.hordeBanner = document.getElementById('horde-announcement-banner');
    this.hordeBannerTitle = document.getElementById('horde-banner-title');
    this.hordeBannerSub = document.getElementById('horde-banner-sub');
    this.hordeBannerEyebrow = document.getElementById('horde-banner-eyebrow');

    // 2. Hub Unificado del Santuario (4 Pestañas)
    this.sanctuaryModal = document.getElementById('skill-tree-modal');
    this.stPreviewImg = document.getElementById('st-preview-img');
    this.sanctuaryTabBtns = Array.from(document.querySelectorAll('[data-sanctuary-tab]'));
    this.sanctuaryPanes = Array.from(document.querySelectorAll('[data-sanctuary-pane]'));
    this.activeSanctuaryTab = 'skills';
    this.tabOrder = ['skills', 'arsenal', 'codex', 'system'];

    this.skillModalEssence = document.getElementById('skill-modal-essence');
    this.stTopMastery = document.getElementById('st-top-mastery');
    this.stTopVitality = document.getElementById('st-top-vitality');
    this.stNextUnlockLabel = document.getElementById('st-next-unlock-label');
    this.stNextUnlockVal = document.getElementById('st-next-unlock-val');
    this.stNextUnlockFill = document.getElementById('st-next-unlock-fill');
    this.skillTreeList = document.getElementById('skill-tree-list');
    this._lastPreviewSrc = '';
    this.stDisciplineTitle = document.querySelector('.st-discipline-title');
    this.stDiamondSlots = Array.from(document.querySelectorAll('.st-diamond-slot'));
    this.stInspectorTitle = document.getElementById('st-inspector-title');
    this.stInspectorInputBadge = document.getElementById('st-inspector-input-badge');
    this.stInspectorDesc = document.getElementById('st-inspector-desc');
    this.stInspectorBuyBtn = document.getElementById('st-inspector-buy-btn');
    this.stInspectorBonusText = document.getElementById('st-inspector-bonus-text');
    this.stInspectorReqLabel = document.getElementById('st-inspector-req-label');
    this.stInspectorReqVal = document.getElementById('st-inspector-req-val');
    this.stInspectorPanel = document.getElementById('st-inspector-panel');
    this.arsenalContainer = document.getElementById('sanctuary-arsenal-content');
    this.codexContainer = document.getElementById('sanctuary-codex-content');
    this.selectedSkillId = 'parry_window';
    this._lastUnlockedSkillId = null;

    // 2.B Taller de Oficios RPG (Herrero y Mago de Pociones)
    this.artisanModal = document.getElementById('artisan-shop-modal');
    this.artisanRoleBadge = document.getElementById('artisan-role-badge');
    this.artisanNpcName = document.getElementById('artisan-npc-name');
    this.artisanNpcQuote = document.getElementById('artisan-npc-quote');
    this.artisanEssenceVal = document.getElementById('artisan-essence-val');
    this.artisanBuffStatus = document.getElementById('artisan-buff-status');
    this.artisanItemsGrid = document.getElementById('artisan-items-grid');

    // 3. Diálogo, Aviso de Interacción, Rueda Radial y Gamepad Táctil
    this.hudInteractPrompt = document.getElementById('hud-interact-prompt');
    this.hudInteractKey = document.getElementById('hud-interact-key');
    this.hudInteractText = document.getElementById('hud-interact-text');
    this.dialogueCard = document.getElementById('dialogue-card');
    this.dialogueBadge = document.getElementById('dialogue-badge');
    this.dialogueSpeaker = document.getElementById('dialogue-speaker');
    this.dialogueText = document.getElementById('dialogue-text');
    this.dialogueTimerFill = document.getElementById('dialogue-timer-fill');

    this.radialWheel = document.getElementById('radial-wheel');
    this.radialSectors = Array.from(document.querySelectorAll('.radial-sector'));

    this.virtualGamepad = document.getElementById('virtual-gamepad');
    this.joystickThumb = document.getElementById('touch-joystick-thumb');
    this.touchAttackBtn = document.getElementById('touch-btn-attack');
    this.touchSkillBtn = document.getElementById('touch-btn-skill');
    this.touchSkillStrongBtn = document.getElementById('touch-btn-skill-strong');
    this.touchSkillLabel = document.getElementById('touch-skill-label');
    this.touchSwitchLabel = document.getElementById('touch-switch-label');
    this.touchHealBtn = document.getElementById('touch-btn-heal');
    this.touchHealLabel = document.getElementById('touch-heal-label');
    this.touchInteractBtn = document.getElementById('touch-btn-interact');
    this.touchInteractLabel = document.getElementById('touch-interact-label');
    this.touchDashBtn = document.getElementById('touch-btn-dash');
    this.touchDashLabel = document.getElementById('touch-dash-label');
    this.touchSwipeHints = Array.from(document.querySelectorAll('#touch-btn-skill .swipe-hint[data-power]'));

    // Etiqueta de compilación en Ajustes > Sistema (evita ReferenceError fuera de Vite)
    this.buildVersionEl = document.getElementById('st-build-version');
    if (this.buildVersionEl) {
      const buildTag = (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) ? __APP_VERSION__ : 'v·dev';
      this.buildVersionEl.textContent = buildTag;
    }

    // Paleta cromática Cel-Shaded de la Reliquia
    this.powerColors = {
      'Dormido': '#94a3b8',
      'Fuego': '#fb923c',
      'Embestida': '#38bdf8',
      'Plantas': '#4ade80',
      'Raíces': '#4ade80',
      'Éter': '#c084fc',
      'Eter': '#c084fc'
    };

    // --- Dirty-Checking Cache para 60 FPS sin Reflows Redundantes ---
    this._lastPowerSignature = null;
    this._lastCritical = null;
    this._lastHealth = -1;
    this._lastEnergy = -1;
    this._lastMaxEnergy = -1;
    this._lastHealCost = -1;
    this._lastPosture = -1;
    this._lastDefending = null;
    this._lastStamina = -1;
    this._lastStaminaExhausted = null;
    this._lastThreatLevel = null;
    this._lastGameState = null;
    this._lastRadialIndex = -1;
    this._lastRadialOpen = false;
    this._lastTouchShow = null;
    this._lastJoyX = 0;
    this._lastJoyY = 0;
    this._lastSkillLabel = null;
    this._lastTouchSprinting = null;
    this._lastTouchProne = null;
    this._lastTouchHidden = null;
    this._lastSwipeMask = null;
    this._lastGamepadCombatMask = null;
    this._lastInteractSig = null;
    this._lastDialogueTimerPct = -1;
    this._lastUpgradeReady = null;
    this._lastSwordTint = null;
    this._lastCompassPct = null;
    this._lastCompassDir = null;
    this._lastCompassDist = null;
    this._lastCompassHemi = null;
    this._lastCompassAccent = null;
    this._lastCompassArrived = null;
    this._lastEssence = -1;
    this._lastComboCount = 0;
    this._lastComboRank = 'D';
    this._lastComboTimerPct = -1;
    this._lastThreatName = '';
    this._lastThreatPct = -1;
    this._lastThreatStatusKey = null;
    this._lastWaveNumber = -1;
    this._lastEnemiesRemaining = -1;
    this._lastIntermission = null;
    this._lastObjectiveText = '';
    this._lastRawObjective = null;
    this._lastObjectiveMobile = null;
    this._lastRawDialogueText = null;
    this._lastDialogueMobile = null;
    this._dialogueVisible = false;
    this._bossThreatVisible = false;
    this._isMobileUA = (typeof navigator !== 'undefined') && (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      Boolean(navigator.userAgentData && navigator.userAgentData.mobile === true)
    );
    this._bannerDismissTimeout = null;
    this._bannerHideTimeout = null;
    this._comboPulseTimeout = null;

    // --- Pool de Números de Daño Flotantes ---
    this.damageNumbersPool = [];
    this.activeDamageNumbers = [];
    this.damageNumbersContainer = document.getElementById('damage-numbers-container');
    if (!this.damageNumbersContainer) {
      this.damageNumbersContainer = document.createElement('div');
      this.damageNumbersContainer.id = 'damage-numbers-container';
      if (this.overlayEl) {
        this.overlayEl.appendChild(this.damageNumbersContainer);
      } else {
        document.body.appendChild(this.damageNumbersContainer);
      }
    }
  }

  /**
   * Genera un número de daño flotante reutilizando nodos DOM del pool sin forzar Reflows síncronos.
   * Limita el máximo simultáneo a 28 indicadores para mantener 60/120 FPS estables en hordas masivas.
   * @param {number} worldX
   * @param {number} worldY
   * @param {number|string} amount
   * @param {string} color
   */
  spawnDamageNumber(worldX, worldY, amount, color) {
    const jitterX = worldX + (Math.random() * 10 - 5);
    const startY = worldY - 10;

    // Si se alcanza el tope en pantalla, reciclar en O(1) el indicador más antiguo sin crear más nodos DOM
    if (this.activeDamageNumbers.length >= 28) {
      const oldest = this.activeDamageNumbers[0];
      oldest.el.textContent = String(amount);
      oldest.el.style.color = color;
      oldest.el.style.opacity = '1';
      oldest.el.style.visibility = 'visible';
      oldest.worldX = jitterX;
      oldest.worldY = startY;
      oldest.timer = 0.82;
      oldest.velY = -22;
      return;
    }

    let el;
    if (this.damageNumbersPool.length > 0) {
      el = this.damageNumbersPool.pop();
    } else {
      el = document.createElement('div');
      el.className = 'damage-number';
      this.damageNumbersContainer.appendChild(el);
    }

    el.textContent = String(amount);
    el.style.color = color;
    el.style.opacity = '1';
    el.style.visibility = 'visible';

    this.activeDamageNumbers.push({
      el,
      worldX: jitterX,
      worldY: startY,
      timer: 0.82,
      velY: -22
    });
  }

  /**
   * Actualiza los números de daño flotantes en coordenadas de pantalla usando únicamente GPU `translate3d` y `opacity`.
   * Emplea remoción O(1) swap-and-pop libre de `Array.splice`.
   * @param {import('../render/Camera.js').Camera} camera
   * @param {number} deltaTime
   */
  updateDamageNumbers(camera, deltaTime) {
    if (!camera || this.activeDamageNumbers.length === 0) return;

    for (let i = this.activeDamageNumbers.length - 1; i >= 0; i--) {
      const data = this.activeDamageNumbers[i];
      data.timer -= deltaTime;

      if (data.timer <= 0) {
        data.el.style.opacity = '0';
        data.el.style.visibility = 'hidden';
        this.damageNumbersPool.push(data.el);
        const lastIdx = this.activeDamageNumbers.length - 1;
        if (i !== lastIdx) {
          this.activeDamageNumbers[i] = this.activeDamageNumbers[lastIdx];
        }
        this.activeDamageNumbers.pop();
        continue;
      }

      data.worldY += data.velY * deltaTime;
      const screenPos = camera.worldToScreen({ x: data.worldX, y: data.worldY });
      data.el.style.transform = `translate3d(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y)}px, 0)`;

      if (data.timer < 0.28) {
        data.el.style.opacity = String(Math.max(0, data.timer / 0.28));
      }
    }
  }

  /**
   * Actualiza el HUD Cel-Shaded del jugador (Medallón + Vitalidad, Energía Elemental y Égida).
   * Respeta la progresión narrativa: muestra el Guantelete como LATENTE cuando `gauntlet_tier === 0`.
   * @param {import('../core/StateManager.js').StateManager} stateManager
   * @param {string} equippedPower
   */
  updateHUD(stateManager, equippedPower) {
    if (!this.hudContainer) return;

    const gauntletTier = stateManager ? (stateManager.get('gauntlet_tier') ?? 1) : 1;
    const isDormant = gauntletTier <= 0;
    const signature = isDormant ? 'DORMANT' : (equippedPower || 'Fuego');

    // 1. Medallón y Tema Elemental
    if (signature !== this._lastPowerSignature) {
      const hadPrevSignature = this._lastPowerSignature !== null;
      this._lastPowerSignature = signature;

      if (hadPrevSignature && !isDormant && this.hudRelicBadge) {
        this.hudRelicBadge.classList.remove('crest-pulse');
        void this.hudRelicBadge.offsetWidth;
        this.hudRelicBadge.classList.add('crest-pulse');
        clearTimeout(this._crestPulseTimeout);
        this._crestPulseTimeout = setTimeout(() => {
          if (this.hudRelicBadge) this.hudRelicBadge.classList.remove('crest-pulse');
        }, 300);
      }

      if (isDormant) {
        const dormantColor = this.powerColors.Dormido;
        if (this.hudPowerName) this.hudPowerName.textContent = 'LATENTE';
        if (this.hudRelicIcon) {
          this.hudRelicIcon.style.color = dormantColor;
          this.hudRelicIcon.style.filter = 'none';
        }
        if (this.hudCrestTag) {
          this.hudCrestTag.style.borderColor = '#050811';
          this.hudCrestTag.style.color = dormantColor;
        }
        if (this.hudEnergyFill) {
          this.hudEnergyFill.className = 'rpg-bar-fill hud-energy-fill energy-dormant';
        }
        if (this.hudEnergyStatIcon) {
          this.hudEnergyStatIcon.style.color = dormantColor;
          this.hudEnergyStatIcon.style.filter = 'none';
        }
        if (this.gaugeIcon) {
          this.gaugeIcon.style.color = dormantColor;
          this.gaugeIcon.innerHTML = '<polygon points="12,3 19,12 12,21 5,12" />';
        }
        if (this.gaugePowerAbbr) {
          this.gaugePowerAbbr.textContent = 'LATENTE';
          this.gaugePowerAbbr.style.color = dormantColor;
        }
        if (this.touchSwitchLabel) {
          this.touchSwitchLabel.textContent = '---';
        }
      } else {
        const displayPower = (equippedPower || 'Fuego').toUpperCase();
        const themeColor = this.powerColors[equippedPower] || '#facc15';
        let normName = (equippedPower || 'Fuego').toLowerCase();
        if (normName === 'raíces' || normName === 'raices') normName = 'plantas';
        if (normName === 'éter' || normName === 'eter' || normName === 'astral') normName = 'eter';

        if (this.hudPowerName) this.hudPowerName.textContent = displayPower;

        if (this.hudRelicIcon) {
          this.hudRelicIcon.style.color = themeColor;
          this.hudRelicIcon.style.filter = 'none';
        }
        if (this.hudCrestTag) {
          this.hudCrestTag.style.borderColor = '#050811';
          this.hudCrestTag.style.color = themeColor;
        }
        if (this.hudEnergyFill) {
          this.hudEnergyFill.className = `rpg-bar-fill hud-energy-fill energy-${normName}`;
        }
        if (this.hudEnergyStatIcon) {
          this.hudEnergyStatIcon.style.color = themeColor;
          this.hudEnergyStatIcon.style.filter = 'none';
        }
        if (this.gaugeIcon) {
          this.gaugeIcon.style.color = themeColor;
          if (normName === 'fuego') {
            this.gaugeIcon.innerHTML = '<path d="M12 2C8 6 6 9 6 13a6 6 0 0 0 12 0c0-4-2-7-6-11zm0 15a3 3 0 0 1-3-3c0-2 1-3 3-5 2 2 3 3 3 5a3 3 0 0 1-3 3z" />';
          } else if (normName === 'embestida') {
            this.gaugeIcon.innerHTML = '<polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2" />';
          } else if (normName === 'eter') {
            this.gaugeIcon.innerHTML = '<polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" />';
          } else {
            this.gaugeIcon.innerHTML = '<path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.22V8c0 .24 0 .47.03.7 4.12-.92 9.07-1.4 12.97-.7z" />';
          }
        }

        const abbr = normName === 'embestida'
          ? 'EMB'
          : normName === 'plantas'
            ? 'RAÍ'
            : normName === 'eter'
              ? 'ÉTE'
              : 'FUE';
        if (this.gaugePowerAbbr) {
          this.gaugePowerAbbr.textContent = displayPower;
          this.gaugePowerAbbr.style.color = themeColor;
        }
        if (this.touchSwitchLabel) {
          this.touchSwitchLabel.textContent = abbr;
        }
      }
    }

    // 2. Barra de Energía Elemental (GPU scaleX libre de Layout Thrashing + Umbrales + Brillo de Carga)
    const energy = stateManager ? (stateManager.get('player_energy') ?? 100) : 100;
    const maxEnergy = Math.max(1, stateManager ? (stateManager.get('player_max_energy') ?? 100) : 100);
    const healCost = Math.max(12, stateManager ? (stateManager.get('player_heal_cost') ?? 30) : 30);

    if (maxEnergy !== this._lastMaxEnergy || healCost !== this._lastHealCost) {
      this._lastMaxEnergy = maxEnergy;
      this._lastHealCost = healCost;
      if (this.hudEnergyHealTick) {
        this.hudEnergyHealTick.style.left = `${Math.min(95, Math.round((healCost / maxEnergy) * 100))}%`;
      }
      if (this.hudEnergyStrongTick) {
        this.hudEnergyStrongTick.style.left = `${Math.min(95, Math.round((38 / maxEnergy) * 100))}%`;
      }
      this._lastEnergy = -999; // Forzar actualización de barra cuando cambie el tope máximo (ej. Catalizador Omega)
    }

    if (Math.abs(energy - this._lastEnergy) > 0.5 || this._lastEnergy < 0) {
      const prevEnergy = this._lastEnergy;
      this._lastEnergy = energy;
      const clampedEnergy = Math.max(0, Math.min(maxEnergy, energy));
      const ratio = clampedEnergy / maxEnergy;
      if (this.hudEnergyFill) {
        this.hudEnergyFill.style.transform = `scaleX(${ratio})`;
        if (prevEnergy >= 0 && energy - prevEnergy >= 4) {
          this.hudEnergyFill.classList.add('is-gaining');
          clearTimeout(this._energyGainTimeout);
          this._energyGainTimeout = setTimeout(() => {
            if (this.hudEnergyFill) this.hudEnergyFill.classList.remove('is-gaining');
          }, 320);
        }
      }
      if (this.hudEnergyChassis) {
        this.hudEnergyChassis.classList.toggle('can-heal', !isDormant && clampedEnergy >= healCost);
        this.hudEnergyChassis.classList.toggle('low-energy', !isDormant && clampedEnergy < 18);
      }
      if (this.hudEnergyGhostFill) {
        if (prevEnergy >= 0 && energy < prevEnergy - 1) {
          clearTimeout(this._energyGhostTimeout);
          this._energyGhostTimeout = setTimeout(() => {
            if (this.hudEnergyGhostFill) this.hudEnergyGhostFill.style.transform = `scaleX(${ratio})`;
          }, 110);
        } else {
          this.hudEnergyGhostFill.style.transform = `scaleX(${ratio})`;
        }
      }
      if (this.gaugePct) {
        this.gaugePct.textContent = maxEnergy > 100
          ? `${Math.round(clampedEnergy)}/${Math.round(maxEnergy)}`
          : `${Math.round(clampedEnergy)}%`;
      }
    }

    // 3. Barra de Postura / Égida (GPU scaleX)
    const posture = stateManager ? (stateManager.get('player_posture') ?? 100) : 100;
    const isDefending = !!(stateManager && stateManager.get('player_defending'));

    if (Math.abs(posture - this._lastPosture) > 0.5 || isDefending !== this._lastDefending) {
      this._lastPosture = posture;
      this._lastDefending = isDefending;
      const clampedPosture = Math.max(0, Math.min(100, posture));

      if (this.hudPostureWrap) {
        this.hudPostureWrap.classList.toggle('defending-active', isDefending);
        this.hudPostureWrap.classList.toggle('is-active', isDefending || clampedPosture < 99);
      }

      if (this.hudPostureGhostFill) {
        this.hudPostureGhostFill.style.transform = `scaleX(${clampedPosture / 100})`;
      }

      if (this.hudPostureFill) {
        this.hudPostureFill.style.transform = `scaleX(${clampedPosture / 100})`;
        if (clampedPosture < 25) {
          this.hudPostureFill.className = 'rpg-bar-fill hud-posture-fill posture-danger';
        } else if (clampedPosture < 55) {
          this.hudPostureFill.className = 'rpg-bar-fill hud-posture-fill posture-warning';
        } else if (isDefending) {
          this.hudPostureFill.className = 'rpg-bar-fill hud-posture-fill posture-guarding';
        } else {
          this.hudPostureFill.className = 'rpg-bar-fill hud-posture-fill';
        }
      }

      if (this.hudPostureText) {
        if (clampedPosture < 25) {
          this.hudPostureText.textContent = '¡BAJA!';
          this.hudPostureText.style.color = '#f87171';
        } else if (isDefending) {
          this.hudPostureText.textContent = 'GUARD';
          this.hudPostureText.style.color = '#fde68a';
        } else {
          this.hudPostureText.textContent = `${Math.round(clampedPosture)}%`;
          this.hudPostureText.style.color = '#d6c5a7';
        }
      }
    }

    // 4. Barra de Vitalidad + Cristales SVG
    const health = stateManager ? (stateManager.get('player_health') ?? 3) : 3;
    const maxHealth = stateManager ? (stateManager.get('player_max_health') ?? 3) : 3;
    const isCritical = !!(stateManager && stateManager.get('health_critical')) || (health <= 1);

    if (this.hudHeartsContainer && this.heartElements.length !== maxHealth) {
      this.hudHeartsContainer.innerHTML = '';
      this.heartElements = [];
      for (let i = 0; i < maxHealth; i++) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'relic-heart-svg filled');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.innerHTML = `
          <polygon class="relic-heart-bracket" points="12,2 22,9 18,22 6,22 2,9" />
          <polygon class="relic-heart-core" points="12,4.5 19.5,10 16.5,19.5 7.5,19.5 4.5,10" />
          <polygon class="relic-heart-facet" points="12,4.5 16.5,10 12,13.5 7.5,10" />
        `;
        this.hudHeartsContainer.appendChild(svg);
        this.heartElements.push(svg);
      }

      if (this.hudHpSegments) {
        this.hudHpSegments.innerHTML = '';
        for (let i = 1; i < maxHealth; i++) {
          const notch = document.createElement('span');
          notch.className = 'rpg-hp-notch';
          notch.style.left = `${(i / maxHealth) * 100}%`;
          this.hudHpSegments.appendChild(notch);
        }
      }

      this._lastHealth = -1;
    }

    const player = stateManager ? stateManager.get('player') : null;
    const isActivelyHealing = Boolean(player && player.healTimer > 0);
    const hasVitalityShield = Boolean(player && typeof player.hasTag === 'function' && player.hasTag('vitality_shield'));

    if (this.hudHpChassis) {
      this.hudHpChassis.classList.toggle('has-vitality-shield', hasVitalityShield);
    }

    if (health !== this._lastHealth || isCritical !== this._lastCritical || isActivelyHealing !== this._lastActivelyHealing) {
      const prevHealth = this._lastHealth;
      const isHealGain = (prevHealth >= 0 && health > prevHealth) || (isActivelyHealing && !this._lastActivelyHealing);
      const isDamageLoss = prevHealth >= 0 && health < prevHealth;

      this._lastHealth = health;
      this._lastCritical = isCritical;
      this._lastActivelyHealing = isActivelyHealing;

      const hpPct = maxHealth > 0 ? Math.max(0, Math.min(100, (health / maxHealth) * 100)) : 100;
      const hpRatio = hpPct / 100;
      if (this.hudHpFill) {
        this.hudHpFill.style.transform = `scaleX(${hpRatio})`;
        this.hudHpFill.classList.toggle('critical-pulse', isCritical);
        if (isHealGain) {
          this.hudHpFill.classList.add('is-healing');
          if (this.hudHpChassis) this.hudHpChassis.classList.add('is-healing');
          clearTimeout(this._healAnimTimeout);
          this._healAnimTimeout = setTimeout(() => {
            if (this.hudHpFill) this.hudHpFill.classList.remove('is-healing');
            if (this.hudHpChassis) this.hudHpChassis.classList.remove('is-healing');
            if (this.hudHpText) {
              this.hudHpText.style.color = this._lastCritical ? '#fda4af' : '#fecdd3';
            }
            for (let j = 0; j < this.heartElements.length; j++) {
              if (this.heartElements[j]) {
                const cls = this.heartElements[j].getAttribute('class') || '';
                if (cls.includes('heart-restored')) {
                  this.heartElements[j].setAttribute('class', cls.replace(/\s*heart-restored/g, ''));
                }
              }
            }
          }, 740);
        }
      }
      if (this.hudHpGhostFill) {
        if (isDamageLoss) {
          clearTimeout(this._ghostHpTimeout);
          this._ghostHpTimeout = setTimeout(() => {
            if (this.hudHpGhostFill) {
              this.hudHpGhostFill.style.transform = `scaleX(${hpRatio})`;
            }
          }, 130);
        } else {
          this.hudHpGhostFill.style.transform = `scaleX(${hpRatio})`;
        }
      }
      if (isDamageLoss && this.hudContainer) {
        this.hudContainer.classList.remove('is-damaged');
        void this.hudContainer.offsetWidth;
        this.hudContainer.classList.add('is-damaged');
        clearTimeout(this._damageJoltTimeout);
        this._damageJoltTimeout = setTimeout(() => {
          if (this.hudContainer) this.hudContainer.classList.remove('is-damaged');
          for (let j = 0; j < this.heartElements.length; j++) {
            if (this.heartElements[j]) {
              const cls = this.heartElements[j].getAttribute('class') || '';
              if (cls.includes('heart-shattered')) {
                this.heartElements[j].setAttribute('class', cls.replace(/\s*heart-shattered/g, ''));
              }
            }
          }
        }, 360);
      }
      if (this.hudHpText) {
        this.hudHpText.textContent = `${health} / ${maxHealth}`;
        this.hudHpText.style.color = isHealGain ? '#4ade80' : isCritical ? '#fda4af' : '#fecdd3';
      }

      for (let i = 0; i < this.heartElements.length; i++) {
        const heart = this.heartElements[i];
        if (!heart) continue;
        if (i < health) {
          const restoredClass = (isHealGain && (i >= Math.max(0, prevHealth) || i === health - 1)) ? ' heart-restored' : '';
          heart.setAttribute(
            'class',
            (health === 1 && i === 0 ? 'relic-heart-svg filled pulsing' : 'relic-heart-svg filled') + restoredClass
          );
        } else {
          const shatteredClass = (isDamageLoss && i >= health && i < prevHealth) ? ' heart-shattered' : '';
          heart.setAttribute('class', 'relic-heart-svg empty' + shatteredClass);
        }
      }

      if (this.vignetteEl) {
        this.vignetteEl.classList.toggle('active', isCritical);
      }
    }

    // 5. Barra de Resistencia / Stamina (Sprint y Tácticas de Sigilo)
    const stamina = stateManager ? (stateManager.get('player_stamina') ?? 100) : 100;
    const maxStamina = stateManager ? (stateManager.get('player_max_stamina') ?? 100) : 100;
    const staminaExhausted = !!(stateManager && stateManager.get('player_stamina_exhausted'));

    if (Math.abs(stamina - this._lastStamina) > 0.4 || staminaExhausted !== this._lastStaminaExhausted) {
      this._lastStamina = stamina;
      this._lastStaminaExhausted = staminaExhausted;
      const clampedStamina = Math.max(0, Math.min(maxStamina, stamina));
      const staminaRatio = maxStamina > 0 ? (clampedStamina / maxStamina) : 1;

      const isStaminaIdle = !staminaExhausted && staminaRatio >= 0.99;
      if (this.hudStaminaWrap) {
        this.hudStaminaWrap.classList.toggle('is-idle', isStaminaIdle);
        this.hudStaminaWrap.classList.toggle('is-active', !isStaminaIdle);
      }
      if (this.hudStaminaFill) {
        this.hudStaminaFill.style.transform = `scaleX(${staminaRatio})`;
        this.hudStaminaFill.classList.toggle('exhausted', staminaExhausted);
      }
      if (this.hudStaminaText) {
        this.hudStaminaText.textContent = staminaExhausted ? 'AGOT.' : `${Math.round(staminaRatio * 100)}%`;
        this.hudStaminaText.style.color = staminaExhausted ? '#f87171' : '#a7f3d0';
      }
    }

    // 6. Viñeta Táctica de Amenaza en Esquinas (solo activa si StealthSystem está habilitado)
    const stealthEnabled = Boolean(stateManager && stateManager.get('stealth_mode_enabled'));
    const threatLevel = stealthEnabled ? (stateManager.get('threat_level') || 'calm') : 'calm';
    if (threatLevel !== this._lastThreatLevel) {
      this._lastThreatLevel = threatLevel;
      if (this.threatVignetteEl) {
        this.threatVignetteEl.className = 'threat-corner-vignette';
        if (!stealthEnabled || threatLevel === 'calm') {
          this.threatVignetteEl.classList.add('hidden');
        } else if (threatLevel === 'danger') {
          this.threatVignetteEl.classList.add('threat-danger');
        } else if (threatLevel === 'alert') {
          this.threatVignetteEl.classList.add('threat-alert');
        } else if (threatLevel === 'stealth') {
          this.threatVignetteEl.classList.add('threat-stealth');
        }
      }
    }
  }

  /**
   * Determina en O(1) si la sesión actual está operando bajo controles táctiles / modo móvil.
   * Utiliza resultado precalculado del User-Agent y estado DOM actual sin ejecutar RegEx por frame.
   * @private
   * @returns {boolean}
   */
  _isMobileActive() {
    return Boolean(
      this._lastTouchShow ||
      (typeof document !== 'undefined' && document.body.classList.contains('touch-controls-active')) ||
      this._isMobileUA
    );
  }

  /**
   * Actualiza la tarjeta inferior de diálogo diegético con caché RegEx O(1) por cambio de texto
   * y alterna `body.dialogue-open` para despejar el medidor de combo.
   * @param {import('../core/StateManager.js').StateManager} stateManager
   * @param {number} deltaTime
   */
  updateDialogue(stateManager, deltaTime) {
    if (!this.dialogueCard || !stateManager) return;

    const dialogue = stateManager.get('active_dialogue');
    if (!dialogue) {
      if (this._dialogueVisible || !this.dialogueCard.classList.contains('hidden')) {
        this.dialogueCard.classList.add('hidden');
        this._dialogueVisible = false;
        this._lastDialogueTimerPct = -1;
        if (document.body) document.body.classList.remove('dialogue-open');
      }
      return;
    }

    if (!dialogue._maxTimer || dialogue._maxTimer < dialogue.timer) {
      dialogue._maxTimer = Math.max(0.5, dialogue.timer);
    }

    dialogue.timer -= deltaTime;
    if (dialogue.timer <= 0) {
      stateManager.set('active_dialogue', null);
      this.dialogueCard.classList.add('hidden');
      this._dialogueVisible = false;
      this._lastDialogueTimerPct = -1;
      if (document.body) document.body.classList.remove('dialogue-open');
      return;
    }

    const speaker = dialogue.speaker || 'HABITANTE';
    if (this.dialogueSpeaker && this.dialogueSpeaker.textContent !== speaker) {
      this.dialogueSpeaker.textContent = speaker;
    }
    const speakerRole = speaker.includes('SANTI')
      ? 'santi'
      : speaker.includes('TARAK')
        ? 'tarak'
        : speaker.includes('VALERIO')
          ? 'valerio'
          : 'reliquia';
    if (this.dialogueCard.dataset && this.dialogueCard.dataset.speaker !== speakerRole) {
      this.dialogueCard.dataset.speaker = speakerRole;
    }
    if (this.dialogueBadge) {
      const badge = speakerRole === 'santi' ? 'PORTADOR' : speakerRole === 'tarak' ? 'SABIO' : speakerRole === 'valerio' ? 'VIAJERO' : 'RELIQUIA';
      if (this.dialogueBadge.textContent !== badge) this.dialogueBadge.textContent = badge;
    }

    if (this.dialogueTimerFill) {
      const pct = Math.max(0, Math.min(1, dialogue.timer / dialogue._maxTimer));
      if (Math.abs(pct - this._lastDialogueTimerPct) > 0.015) {
        this._lastDialogueTimerPct = pct;
        this.dialogueTimerFill.style.transform = `scaleX(${pct.toFixed(3)})`;
      }
    }

    const isMobile = this._isMobileActive();
    if (dialogue.text !== this._lastRawDialogueText || isMobile !== this._lastDialogueMobile) {
      this._lastRawDialogueText = dialogue.text;
      this._lastDialogueMobile = isMobile;
      const cleanDialogue = formatControlPrompts(dialogue.text, isMobile);
      const formattedText = `"${cleanDialogue}"`;
      if (this.dialogueText && this.dialogueText.textContent !== formattedText) {
        this.dialogueText.textContent = formattedText;
      }
    }

    if (!this._dialogueVisible) {
      this.dialogueCard.classList.remove('hidden');
      this._dialogueVisible = true;
      if (document.body) document.body.classList.add('dialogue-open');
    }
  }

  /**
   * Actualiza la rueda radial de selección de poderes reflejando qué elementos están despiertos.
   * @param {import('../core/InputManager.js').InputManager} inputManager
   * @param {import('../core/StateManager.js').StateManager} [stateManager=null]
   */
  updateRadialWheel(inputManager, stateManager = null) {
    if (!this.radialWheel || !inputManager) return;

    const isOpen = inputManager.isRadialMenuOpen;
    const selectedIdx = inputManager.radialSelectionIndex;
    const player = stateManager ? stateManager.get('player') : null;

    if (isOpen) {
      if (!this._lastRadialOpen) {
        this.radialWheel.classList.remove('hidden');
        this._lastRadialOpen = true;
      }

      this.radialSectors.forEach((sector, idx) => {
        const powerName = sector.dataset.power;
        const isLocked = powerName === 'Sellado' || (player && typeof player.hasElement === 'function' && !player.hasElement(powerName));
        if (sector.classList.contains('sector-west')) {
          const lbl = sector.querySelector('#radial-west-label') || sector.querySelector('span');
          if (lbl) lbl.textContent = isLocked ? 'SELLADO' : 'ÉTER';
        }
        sector.classList.toggle('locked', isLocked);
        sector.classList.toggle('active', idx === selectedIdx && !isLocked);
      });
      this._lastRadialIndex = selectedIdx;
    } else if (this._lastRadialOpen) {
      this.radialWheel.classList.add('hidden');
      this._lastRadialOpen = false;
      this._lastRadialIndex = -1;
    }
  }

  /**
   * Actualiza el Virtual Gamepad móvil y sincroniza la clase `touch-controls-active` para elevar diálogos.
   * Incluye estado visual del botón unificado Dash/Correr y del indicador central de agacharse en el stick.
   * @param {import('../core/InputManager.js').InputManager} inputManager
   * @param {string} equippedPower
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=null]
   */
  updateVirtualGamepad(inputManager, equippedPower, stateManager = null) {
    if (!this.virtualGamepad || !inputManager) return;

    const shouldShow = inputManager.shouldShowTouchControls;

    if (shouldShow !== this._lastTouchShow) {
      this._lastTouchShow = shouldShow;
      this.virtualGamepad.classList.toggle('hidden', !shouldShow);
      document.body.classList.toggle('touch-controls-active', shouldShow);
    }

    if (!shouldShow) return;

    if (this.joystickThumb && inputManager.joystickVector) {
      const jx = Math.round(inputManager.joystickVector.x * 34);
      const jy = Math.round(inputManager.joystickVector.y * 34);
      if (jx !== this._lastJoyX || jy !== this._lastJoyY) {
        this._lastJoyX = jx;
        this._lastJoyY = jy;
        this.joystickThumb.style.transform = `translate(${jx}px, ${jy}px)`;
      }
    }

    if (this.joystickThumb && stateManager) {
      const isProne = Boolean(stateManager.get('player_is_prone'));
      const isHidden = Boolean(stateManager.get('player_stealth_hidden'));
      if (isProne !== this._lastTouchProne) {
        this._lastTouchProne = isProne;
        this.joystickThumb.classList.toggle('is-prone', isProne);
      }
      if (isHidden !== this._lastTouchHidden) {
        this._lastTouchHidden = isHidden;
        this.joystickThumb.classList.toggle('is-hidden', isHidden);
      }
    }

    const isTouchSprint = Boolean(inputManager.isTouchSprintActive || inputManager.isSprintPressed);
    if (isTouchSprint !== this._lastTouchSprinting) {
      this._lastTouchSprinting = isTouchSprint;
      if (this.touchDashBtn) this.touchDashBtn.classList.toggle('sprint-active', isTouchSprint);
      if (this.touchDashLabel) this.touchDashLabel.textContent = isTouchSprint ? 'CORRER' : 'DASH';
    }

    const gauntletTier = stateManager ? (stateManager.get('gauntlet_tier') ?? 1) : 1;
    const rawPower = (gauntletTier <= 0 || equippedPower === 'Dormido')
      ? 'LATENTE'
      : (inputManager.hoveredSwipePower || equippedPower || 'Fuego');
    const activeName = rawPower.toUpperCase();
    if (this.touchSkillLabel && activeName !== this._lastSkillLabel) {
      this._lastSkillLabel = activeName;
      this.touchSkillLabel.textContent = activeName;
    }

    const powerKey = (gauntletTier <= 0 || equippedPower === 'Dormido') ? 'Dormido' : (inputManager.hoveredSwipePower || equippedPower || 'Fuego');
    const accentHex = this.powerColors[powerKey] || '#facc15';
    const energy = stateManager ? (stateManager.get('player_energy') ?? 100) : 100;
    const healCost = stateManager ? (stateManager.get('player_heal_cost') ?? 30) : 30;
    const health = stateManager ? (stateManager.get('player_health') ?? 3) : 3;
    const maxHealth = stateManager ? (stateManager.get('player_max_health') ?? 3) : 3;
    const player = stateManager ? stateManager.get('player') : null;
    const hasSword = stateManager ? (stateManager.get('player_has_sword') !== false) : true;
    const hasVitalityShield = Boolean(player && typeof player.hasTag === 'function' && player.hasTag('vitality_shield'));
    const interactAvail = Boolean(stateManager && stateManager.get('interact_available'));
    const interactVerb = interactAvail ? (stateManager.get('interact_verb') || 'USAR') : 'USAR';

    const canCastWeak = gauntletTier > 0 && energy >= 18;
    const canCastStrong = gauntletTier > 0 && energy >= 36;
    const canHealNow = energy >= healCost;
    const healUrgent = canHealNow && health <= 1;
    const healLabelText = health >= maxHealth
      ? (hasVitalityShield ? 'ACTIVO' : 'ESCUDO')
      : 'CURAR';

    const combatSig = `${powerKey}|${canCastWeak ? 1 : 0}${canCastStrong ? 1 : 0}${canHealNow ? 1 : 0}${healUrgent ? 1 : 0}${hasSword ? 1 : 0}${interactAvail ? 1 : 0}|${healLabelText}|${interactVerb}`;
    if (combatSig !== this._lastGamepadCombatMask) {
      this._lastGamepadCombatMask = combatSig;
      if (this.touchSkillBtn) {
        if (this.touchSkillBtn.style && typeof this.touchSkillBtn.style.setProperty === 'function') {
          this.touchSkillBtn.style.setProperty('--skill-accent', accentHex);
        }
        this.touchSkillBtn.classList.toggle('is-insufficient', !canCastWeak);
      }
      if (this.touchSkillStrongBtn) {
        if (this.touchSkillStrongBtn.style && typeof this.touchSkillStrongBtn.style.setProperty === 'function') {
          this.touchSkillStrongBtn.style.setProperty('--skill-accent', accentHex);
        }
        this.touchSkillStrongBtn.classList.toggle('is-insufficient', !canCastStrong);
      }
      if (this.touchAttackBtn) {
        this.touchAttackBtn.classList.toggle('is-locked', !hasSword);
      }
      if (this.touchHealBtn) {
        this.touchHealBtn.classList.toggle('is-insufficient', !canHealNow);
        this.touchHealBtn.classList.toggle('is-urgent', healUrgent);
      }
      if (this.touchHealLabel) {
        this.touchHealLabel.textContent = healLabelText;
      }
      if (this.touchInteractBtn) {
        this.touchInteractBtn.classList.toggle('is-available', interactAvail);
        this.touchInteractBtn.classList.toggle('is-idle', !interactAvail);
      }
      if (this.touchInteractLabel) {
        this.touchInteractLabel.textContent = interactAvail ? interactVerb.slice(0, 8) : 'USAR';
      }
    }

    if (this.touchSwipeHints && this.touchSwipeHints.length > 0 && stateManager) {
      const player = stateManager.get('player');
      const eqNorm = inputManager && typeof inputManager._normalizeDisplayPower === 'function'
        ? inputManager._normalizeDisplayPower(equippedPower || '')
        : (equippedPower === 'Plantas' ? 'Raíces' : equippedPower);
      let mask = `${gauntletTier}:${eqNorm}`;
      for (let i = 0; i < this.touchSwipeHints.length; i++) {
        const pName = this.touchSwipeHints[i].dataset?.power;
        const unlocked = gauntletTier > 0 && (!player || typeof player.hasElement !== 'function' || player.hasElement(pName));
        mask += unlocked ? '1' : '0';
      }
      if (mask !== this._lastSwipeMask) {
        this._lastSwipeMask = mask;
        for (let i = 0; i < this.touchSwipeHints.length; i++) {
          const hintEl = this.touchSwipeHints[i];
          const pName = hintEl.dataset?.power;
          const unlocked = gauntletTier > 0 && (!player || typeof player.hasElement !== 'function' || player.hasElement(pName));
          hintEl.classList.toggle('is-locked', !unlocked);
          hintEl.classList.toggle('is-active', Boolean(unlocked && pName === eqNorm));
        }
      }
    }
  }

  /**
   * Oculta inmediatamente cualquier HUD de gameplay al salir de STATE_PLAYING.
   */
  clear() {
    this.setGameState('STATE_MENU');
  }

  /**
   * Aisla estrictamente la capa de gameplay para impedir que cualquier banner o barra se superponga
   * sobre Cinemáticas, Pantalla de Título o el Hub del Santuario.
   * @param {string} gameState
   */
  setGameState(gameState) {
    if (gameState === this._lastGameState) return;
    this._lastGameState = gameState;

    const isPlaying = gameState === 'STATE_PLAYING';

    if (this.hudCrestImg) {
      if (isPlaying) {
        if (this.hudCrestImg.dataset?.src && !this.hudCrestImg.getAttribute('src')) {
          this.hudCrestImg.setAttribute('src', this.hudCrestImg.dataset.src);
        }
      } else if (gameState === 'STATE_MENU' && typeof this.hudCrestImg.removeAttribute === 'function') {
        this.hudCrestImg.removeAttribute('src');
      }
    }

    if (this.gameplayLayer) {
      this.gameplayLayer.classList.toggle('hidden', !isPlaying);
    }

    if (!isPlaying) {
      clearTimeout(this._bannerDismissTimeout);
      clearTimeout(this._bannerHideTimeout);
      if (this.hordeBanner) {
        this.hordeBanner.classList.add('hidden');
        this.hordeBanner.classList.remove('banner-slide-in', 'banner-fade-out');
      }
      if (this.bossThreatBar) this.bossThreatBar.classList.add('hidden');
      if (this.hudInteractPrompt) this.hudInteractPrompt.classList.add('hidden');
      this._lastInteractSig = null;
      if (this.dialogueCard) this.dialogueCard.classList.add('hidden');
      this._dialogueVisible = false;
      if (document.body) document.body.classList.remove('dialogue-open');
      if (this.radialWheel) this.radialWheel.classList.add('hidden');
      if (this.virtualGamepad) this.virtualGamepad.classList.add('hidden');
      if (this.comboHud) this.comboHud.classList.add('hidden');
      document.body.classList.remove('touch-controls-active');
      this._lastTouchShow = false;
      this._lastRadialOpen = false;
    }
  }

  /**
   * Actualiza la Esencia Ancestral y el Medidor Rítmico de Combo AAA.
   * @param {import('../core/StateManager.js').StateManager} stateManager
   */
  updateComboAndEssence(stateManager) {
    if (!stateManager) return;

    const essence = stateManager.get('player_essence') ?? 0;
    if (essence !== this._lastEssence) {
      const prevEssence = this._lastEssence;
      this._lastEssence = essence;
      if (this.hudEssenceVal) this.hudEssenceVal.textContent = String(essence);
      if (this.skillModalEssence) this.skillModalEssence.textContent = String(essence);
      if (prevEssence >= 0 && essence > prevEssence && this.btnQuickTalents) {
        this.btnQuickTalents.classList.remove('essence-gain-pop');
        void this.btnQuickTalents.offsetWidth;
        this.btnQuickTalents.classList.add('essence-gain-pop');
        clearTimeout(this._essencePopTimeout);
        this._essencePopTimeout = setTimeout(() => {
          if (this.btnQuickTalents) this.btnQuickTalents.classList.remove('essence-gain-pop');
        }, 280);
      }
    }

    const canUpgrade = Boolean(stateManager.get('can_upgrade_skill'));
    if (canUpgrade !== this._lastUpgradeReady) {
      this._lastUpgradeReady = canUpgrade;
      if (this.btnQuickTalents) this.btnQuickTalents.classList.toggle('can-upgrade', canUpgrade);
      if (this.hudTalentBadgeDot) this.hudTalentBadgeDot.classList.toggle('hidden', !canUpgrade);
    }

    const swordTint = stateManager.get('sword_enchant_color') || '';
    if (swordTint !== this._lastSwordTint && this.btnQuickArsenal) {
      this._lastSwordTint = swordTint;
      this.btnQuickArsenal.style.borderColor = swordTint || '';
    }

    if (!this.comboHud) return;
    const count = stateManager.get('combo_count') || 0;
    const rank = stateManager.get('combo_rank') || 'D';
    const timerPct = stateManager.get('combo_timer_pct') || 0;

    if (count < 2) {
      if (this._lastComboCount >= 2) {
        this.comboHud.classList.add('hidden');
      }
      this._lastComboCount = count;
      return;
    }

    this.comboHud.classList.remove('hidden');

    if (count !== this._lastComboCount) {
      if (count > this._lastComboCount) {
        this.comboHud.classList.add('combo-pulse');
        clearTimeout(this._comboPulseTimeout);
        this._comboPulseTimeout = setTimeout(() => {
          if (this.comboHud) this.comboHud.classList.remove('combo-pulse');
        }, 110);
      }
      this._lastComboCount = count;
      if (this.comboCountText) this.comboCountText.textContent = `x${count} GOLPES`;
    }

    if (rank !== this._lastComboRank) {
      this._lastComboRank = rank;
      if (this.comboRankBadge) {
        this.comboRankBadge.textContent = rank;
        this.comboRankBadge.className = `combo-rank-badge rank-${rank.toLowerCase()}`;
      }
      if (this.comboRankTitle) {
        const titles = { D: 'CADENCIA', C: 'ÁGIL +5%', B: 'FEROZ +10%', A: 'IMPLACABLE +20%', S: '¡LEYENDA! +35%' };
        this.comboRankTitle.textContent = titles[rank] || 'CADENCIA';
      }
    }

    if (Math.abs(timerPct - this._lastComboTimerPct) > 1.0) {
      this._lastComboTimerPct = timerPct;
      if (this.comboTimerFill) {
        const clampedTimer = Math.max(0, Math.min(100, timerPct));
        this.comboTimerFill.style.transform = `scaleX(${clampedTimer / 100})`;
      }
    }
  }

  /**
   * Mantiene oculta la barra superior de enemigo en el HUD: la vitalidad, escudo, coraza y fase
   * se dibujan directamente encima de cada enemigo en el campo de batalla (`Enemy.draw`)
   * para no desorientar al jugador durante el combate.
   * @param {import('../core/StateManager.js').StateManager} stateManager
   */
  updateBossThreat(stateManager) {
    if (!this.bossThreatBar || !stateManager) return;
    if (this._bossThreatVisible || !this.bossThreatBar.classList.contains('hidden')) {
      this.bossThreatBar.classList.add('hidden');
      this._bossThreatVisible = false;
    }
  }

  /**
   * Muestra el aviso contextual de interacción en mundo cuando hay un NPC, Altar, Estela o Pedestal al alcance.
   * Se oculta automáticamente mientras hay un diálogo activo para evitar solapamientos.
   * @param {import('../core/StateManager.js').StateManager} stateManager
   */
  updateInteractPrompt(stateManager) {
    if (!this.hudInteractPrompt || !stateManager) return;
    const isAvail = Boolean(stateManager.get('interact_available')) && !this._dialogueVisible;
    const verb = isAvail ? (stateManager.get('interact_verb') || 'USAR') : '';
    const targetName = isAvail ? (stateManager.get('interact_target_name') || '') : '';
    const isMobile = this._isMobileActive();
    const sig = isAvail ? `1|${verb}|${targetName}|${isMobile ? 'M' : 'D'}` : '0';

    if (sig === this._lastInteractSig) return;
    this._lastInteractSig = sig;

    if (!isAvail) {
      this.hudInteractPrompt.classList.add('hidden');
      return;
    }

    if (this.hudInteractKey) {
      this.hudInteractKey.textContent = isMobile ? 'TOCAR' : 'E';
    }
    if (this.hudInteractText) {
      this.hudInteractText.textContent = targetName ? `${verb} · ${targetName}` : verb;
    }
    this.hudInteractPrompt.classList.remove('hidden');
  }

  /**
   * Actualiza el Rumbo de Misión del Nivel Introductorio y el Tracker/Banner de Hordas Opcionales.
   * @param {import('../core/StateManager.js').StateManager} stateManager
   */
  updateHordeHUD(stateManager) {
    if (!stateManager) return;

    // 0. Rumbo / Objetivo Activo del Nivel y Brújula Funcional estilo God of War Ragnarök
    const rawObjective = stateManager.get('level_objective') || 'Explora el Claro del Santuario';
    const isMobile = this._isMobileActive();
    if (rawObjective !== this._lastRawObjective || isMobile !== this._lastObjectiveMobile) {
      this._lastRawObjective = rawObjective;
      this._lastObjectiveMobile = isMobile;
      const objective = formatControlPrompts(rawObjective, isMobile);
      if (objective !== this._lastObjectiveText && this.objectiveTextEl) {
        this._lastObjectiveText = objective;
        this.objectiveTextEl.textContent = objective;
      }
    }

    if (this.compassMarkerEl) {
      const bearingPct = stateManager.get('compass_bearing_pct') ?? 50;
      const dirSym = stateManager.get('compass_dir_symbol') || '▲';
      const distM = stateManager.get('compass_dist_m') ?? 0;
      const hemi = stateManager.get('compass_hemisphere') || 'N';
      const accent = stateManager.get('compass_accent_color') || '#fde047';
      const isArrived = distM <= 2;

      if (bearingPct !== this._lastCompassPct) {
        this._lastCompassPct = bearingPct;
        this.compassMarkerEl.style.left = `${bearingPct}%`;
      }
      if (this.compassDirEl && dirSym !== this._lastCompassDir) {
        this._lastCompassDir = dirSym;
        this.compassDirEl.textContent = dirSym;
      }
      if (this.compassDistEl && distM !== this._lastCompassDist) {
        this._lastCompassDist = distM;
        this.compassDistEl.textContent = distM > 0 ? `${distM}m` : 'AQUÍ';
      }
      if (accent !== this._lastCompassAccent) {
        this._lastCompassAccent = accent;
        if (typeof this.compassMarkerEl.style.setProperty === 'function') {
          this.compassMarkerEl.style.setProperty('--compass-accent', accent);
        }
      }
      if (isArrived !== this._lastCompassArrived) {
        this._lastCompassArrived = isArrived;
        this.compassMarkerEl.classList.toggle('is-arrived', isArrived);
      }
      if (hemi !== this._lastCompassHemi) {
        this._lastCompassHemi = hemi;
        if (this.compassCardNW) this.compassCardNW.textContent = hemi === 'S' ? 'SO' : 'NO';
        if (this.compassCardCenter) this.compassCardCenter.textContent = hemi === 'S' ? 'S' : 'N';
        if (this.compassCardNE) this.compassCardNE.textContent = hemi === 'S' ? 'SE' : 'NE';
      }
    }

    const waveNum = stateManager.get('horde_wave_number') || 0;
    const remaining = stateManager.get('horde_enemies_remaining') ?? 0;
    const total = stateManager.get('horde_enemies_total') || 1;
    const intermission = stateManager.get('horde_intermission');
    const bannerActive = stateManager.get('horde_banner_active');

    // 1. Tracker compacto (SOLO visible cuando el desafío de hordas está activo: waveNum > 0)
    if (this.hordeTracker) {
      if (waveNum <= 0) {
        if (!this.hordeTracker.classList.contains('hidden')) {
          this.hordeTracker.classList.add('hidden');
        }
      } else {
        this.hordeTracker.classList.remove('hidden');
        if (waveNum !== this._lastWaveNumber && this.hordeWaveLabel) {
          this._lastWaveNumber = waveNum;
          this.hordeWaveLabel.textContent = `OLEADA ${waveNum}`;
        }

        if ((remaining !== this._lastEnemiesRemaining || intermission !== this._lastIntermission) && this.hordeEnemiesVal) {
          this._lastEnemiesRemaining = remaining;
          this._lastIntermission = intermission;
          if (intermission !== null && intermission !== undefined) {
            this.hordeEnemiesVal.textContent = `SIGUIENTE: ${intermission}s`;
            this.hordeEnemiesVal.style.color = '#38bdf8';
          } else {
            this.hordeEnemiesVal.textContent = `${remaining} / ${total}`;
            this.hordeEnemiesVal.style.color = remaining <= 1 ? '#f87171' : '#f8fafc';
          }
        }
      }
    }

    // 2. Banner cinemático de oleada (únicamente en STATE_PLAYING)
    if (this.hordeBanner && bannerActive) {
      stateManager.set('horde_banner_active', false);
      const title = stateManager.get('horde_wave_title') || `OLEADA ${waveNum}`;
      const sub = stateManager.get('horde_wave_subtitle') || '';

      this._showHordeBanner('AMENAZA DETECTADA', title, sub, 3200);
    }

    // 3. Banner de victoria táctica
    const victoryAnnounce = stateManager.get('horde_victory_announcement');
    if (this.hordeBanner && victoryAnnounce) {
      stateManager.set('horde_victory_announcement', null);
      this._showHordeBanner('¡VICTORIA TÁCTICA!', victoryAnnounce.title, victoryAnnounce.rewardText, 2700);
    }
  }

  /**
   * Despliega el banner superior con animación limpia libre de `translate(-50%)`.
   * @private
   */
  _showHordeBanner(eyebrow, title, subtitle, durationMs) {
    if (!this.hordeBanner) return;
    const isMobile = this._isMobileActive();
    const cleanTitle = formatControlPrompts(title, isMobile);
    const cleanSub = formatControlPrompts(subtitle, isMobile);

    if (this.hordeBannerEyebrow) this.hordeBannerEyebrow.textContent = eyebrow;
    if (this.hordeBannerTitle) this.hordeBannerTitle.textContent = cleanTitle;
    if (this.hordeBannerSub) this.hordeBannerSub.textContent = cleanSub;

    this.hordeBanner.classList.remove('hidden', 'banner-fade-out');
    this.hordeBanner.classList.add('banner-slide-in');

    clearTimeout(this._bannerDismissTimeout);
    clearTimeout(this._bannerHideTimeout);
    this._bannerDismissTimeout = setTimeout(() => {
      if (!this.hordeBanner) return;
      this.hordeBanner.classList.remove('banner-slide-in');
      this.hordeBanner.classList.add('banner-fade-out');
      this._bannerHideTimeout = setTimeout(() => {
        if (this.hordeBanner) {
          this.hordeBanner.classList.add('hidden');
          this.hordeBanner.classList.remove('banner-fade-out');
        }
      }, 380);
    }, durationMs);
  }

  /**
   * Hidrata perezosamente las texturas del Santuario únicamente al abrir el modal.
   */
  mountSanctuaryAssets() {
    if (this.sanctuaryModal) {
      this.sanctuaryModal.classList.add('sanctuary-assets-loaded');
    }
    if (this.stPreviewImg && this.stPreviewImg.dataset?.src && !this.stPreviewImg.getAttribute('src')) {
      this.stPreviewImg.setAttribute('src', this.stPreviewImg.dataset.src);
    }
  }

  /**
   * Libera el DOM pesado y las texturas decodificadas del Santuario al cerrarlo
   * para no mantener el menú precargado en RAM durante el combate.
   */
  unmountSanctuary() {
    if (this.sanctuaryModal) {
      this.sanctuaryModal.classList.remove('sanctuary-assets-loaded');
    }
    if (this.stPreviewImg && typeof this.stPreviewImg.removeAttribute === 'function') {
      this.stPreviewImg.removeAttribute('src');
    }
    if (this.skillTreeList) this.skillTreeList.innerHTML = '';
    if (this.arsenalContainer) this.arsenalContainer.innerHTML = '';
    if (this.codexContainer) this.codexContainer.innerHTML = '';
  }

  /**
   * Activa una pestaña específica del Hub Unificado del Santuario ('skills' | 'arsenal' | 'codex' | 'system')
   * y refresca su contenido dinámico.
   * @param {string} tabName
   * @param {Object} deps
   */
  setSanctuaryTab(tabName, deps = {}) {
    this.mountSanctuaryAssets();
    const validTab = this.tabOrder.includes(tabName) ? tabName : 'skills';
    this.activeSanctuaryTab = validTab;

    this.sanctuaryTabBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.sanctuaryTab === validTab);
    });

    this.sanctuaryPanes.forEach((pane) => {
      const isMatch = pane.dataset.sanctuaryPane === validTab;
      pane.classList.toggle('hidden', !isMatch);
      if (isMatch) {
        pane.classList.remove('st-pane-enter');
        void pane.offsetWidth;
        pane.classList.add('st-pane-enter');
      }
    });

    const { skillTreeManager, audioManager } = deps;
    if (skillTreeManager) {
      const essence = skillTreeManager.getEssence();
      if (this.skillModalEssence) this.skillModalEssence.textContent = String(essence);
      if (this.hudEssenceVal) this.hudEssenceVal.textContent = String(essence);
      if (this.stTopMastery) {
        this.stTopMastery.textContent = `NV. ${1 + skillTreeManager.getTotalAllocatedRanks()}`;
      }
      if (this.stTopVitality) {
        const maxHp = 3 + skillTreeManager.getSkillRank('max_health_up');
        this.stTopVitality.textContent = String(maxHp);
      }
    }

    if (validTab === 'skills' && skillTreeManager) {
      this.renderSkillTree(skillTreeManager, audioManager);
    } else if (validTab === 'arsenal') {
      this.renderArsenalTab(deps);
    } else if (validTab === 'codex') {
      this.renderCodexTab(deps);
    }
  }

  /**
   * Cicla a la pestaña anterior (-1) o siguiente (+1) del Santuario mediante [Q] / [E].
   * @param {number} direction
   * @param {Object} deps
   */
  cycleSanctuaryTab(direction, deps = {}) {
    const idx = this.tabOrder.indexOf(this.activeSanctuaryTab);
    const nextIdx = (idx + direction + this.tabOrder.length) % this.tabOrder.length;
    this.setSanctuaryTab(this.tabOrder[nextIdx], deps);
  }

  /**
   * Renderiza la Pestaña 2 (ARSENAL): Armas, Escudos y Estado de los Engarces Elementales.
   * @param {Object} deps
   */
  renderArsenalTab(deps = {}) {
    if (!this.arsenalContainer) return;
    const { equipmentManager, stateManager, player, audioManager } = deps;

    const currentWeaponId = equipmentManager?.getWeapon()?.id || 'training_sword';
    const currentShieldId = equipmentManager?.getShield()?.id || 'wooden_shield';
    const equippedPower = stateManager?.get('equipped_power') || 'Fuego';

    const hasSword = player ? Boolean(player.hasSword) : (stateManager ? stateManager.get('has_sword') !== false : true);
    const weaponCardsHtml = Object.values(WEAPONS).map((w) => {
      const isUnlocked = hasSword && (equipmentManager ? equipmentManager.isWeaponUnlocked(w.id) : w.id === 'training_sword');
      const isEq = isUnlocked && w.id === currentWeaponId;
      const tierChip = w.tierLabel
        ? `<span class="st-stat-chip" style="border-color:${w.enchantmentColor || '#38bdf8'};color:${w.enchantmentColor || '#38bdf8'};">${w.tierLabel}</span>`
        : '';
      const finisherChip = w.finisherEffect
        ? `<span class="st-stat-chip">REMATE: ${w.finisherEffect.tag === 'armor_break' ? 'ROMPE-ARMADURA' : 'SANGRADO'}</span>`
        : '';
      return `
        <div class="st-equip-card ${isEq ? 'equipped' : ''} ${!isUnlocked ? 'locked' : ''}">
          <div class="st-equip-info">
            <div class="st-equip-title-row">
              <h4>${w.name}</h4>
              ${!isUnlocked ? '<span class="st-lock-pill">SELLADO 🔒</span>' : ''}
            </div>
            <p>${!isUnlocked ? (w.unlockHint || 'Encantamiento arcano de la Espada del Alba.') : w.description}</p>
            <div class="st-equip-stats">
              ${tierChip}
              <span class="st-stat-chip">DAÑO ${w.damage}</span>
              <span class="st-stat-chip">AVANCE ${w.lungeForce}</span>
              <span class="st-stat-chip">+${w.energyOnHit} ENERGÍA/GOLPE</span>
              ${finisherChip}
            </div>
          </div>
          ${!isUnlocked
            ? `<button type="button" class="cel-action-btn locked-badge" disabled>SELLADO</button>`
            : `<button type="button" class="cel-action-btn ${isEq ? 'equipped-badge' : 'primary'}" data-equip-weapon="${w.id}" ${isEq ? 'disabled' : ''}>
                 ${isEq ? 'IMBUIDA' : 'IMBUIR'}
               </button>`
          }
        </div>
      `;
    }).join('');

    const shieldCardsHtml = Object.values(SHIELDS).map((sh) => {
      const isUnlocked = equipmentManager ? equipmentManager.isShieldUnlocked(sh.id) : sh.id === 'wooden_shield';
      const isEq = sh.id === currentShieldId;
      const mitigation = Math.round((1 - (sh.posture_drain_rate || 1)) * 100);
      return `
        <div class="st-equip-card ${isEq ? 'equipped' : ''} ${!isUnlocked ? 'locked' : ''}">
          <div class="st-equip-info">
            <div class="st-equip-title-row">
              <h4>${sh.name}</h4>
              ${!isUnlocked ? '<span class="st-lock-pill">BLOQUEADO 🔒</span>' : ''}
            </div>
            <p>${!isUnlocked ? (sh.unlockHint || 'Escudo templado de nivel superior. Requiere progreso en la crónica.') : sh.description}</p>
            <div class="st-equip-stats">
              <span class="st-stat-chip">MITIGACIÓN ${mitigation >= 0 ? `+${mitigation}%` : `${mitigation}%`}</span>
              <span class="st-stat-chip">${sh.elemental_weakness ? `VULNERABLE A ${sh.elemental_weakness.toUpperCase()}` : 'IGNÍFUGO'}</span>
            </div>
          </div>
          ${!isUnlocked
            ? `<button type="button" class="cel-action-btn locked-badge" disabled>BLOQUEADO</button>`
            : `<button type="button" class="cel-action-btn ${isEq ? 'equipped-badge' : 'primary'}" data-equip-shield="${sh.id}" ${isEq ? 'disabled' : ''}>
                 ${isEq ? 'EQUIPADO' : 'EQUIPAR'}
               </button>`
          }
        </div>
      `;
    }).join('');

    const conduits = [
      { id: 'Fuego', title: 'Engarce Ígneo (Fuego)', desc: 'Dispara Bolas de Fuego que incineran zarzas gigantes y quiebran escudos de madera.' },
      { id: 'Embestida', title: 'Engarce Cinético (Embestida)', desc: 'Canaliza impulsos de alta velocidad y ondas de choque que parten coraza volcánica y basalto.' },
      { id: 'Raíces', title: 'Engarce Silvestre (Raíces)', desc: 'Invoca raíces ancestrales que inmovilizan manadas, anclan tótems y habilitan detonaciones.' },
      { id: 'Éter', title: 'Engarce Astral (Éter Magnético)', desc: 'Emite Pulsos de Polaridad que reflejan proyectiles y Singularidades que agrupan y sobrecargan enemigos.' }
    ];

    const conduitCardsHtml = conduits.map((c) => {
      const unlocked = player && typeof player.hasElement === 'function' ? player.hasElement(c.id) : false;
      const isActive = unlocked && (equippedPower === c.id || (c.id === 'Raíces' && equippedPower === 'Plantas'));
      return `
        <div class="st-equip-card ${isActive ? 'equipped' : ''}">
          <div class="st-equip-info">
            <h4>${c.title}</h4>
            <p>${unlocked ? c.desc : 'Conducto dormido. Explora su mundo correspondiente y reclama el Pedestal del Núcleo.'}</p>
          </div>
          <button type="button" class="cel-action-btn ${isActive ? 'equipped-badge' : unlocked ? 'secondary' : ''}" data-equip-element="${c.id}" ${(!unlocked || isActive) ? 'disabled' : ''}>
            ${isActive ? 'ACTIVO' : unlocked ? 'CANALIZAR' : 'DORMIDO'}
          </button>
        </div>
      `;
    }).join('');

    const isMobile = this._isMobileActive();
    const switchHint = formatControlPrompts(
      'Alterna rápidamente en combate con las teclas [1], [2], [3], [4], la rueda del ratón o manteniendo [Tab].',
      isMobile
    );

    const activeWeapon = equipmentManager?.getWeapon?.() || { damage: 16 };
    const activeShield = equipmentManager?.getShield?.() || { posture_drain_rate: 1 };
    const activeShieldMit = Math.round((1 - (activeShield.posture_drain_rate || 1)) * 100);
    const activeEnergyRegen = (player?.energy_regen_rate ?? 6.5).toFixed(1);

    this.arsenalContainer.innerHTML = `
      <div class="st-arsenal-summary-strip">
        <div class="st-summary-stat"><span>FILO ACTUAL</span><strong>${hasSword ? `${activeWeapon.damage} DAÑO` : 'SIN ESPADA'}</strong></div>
        <div class="st-summary-stat"><span>ÉGIDA ACTIVA</span><strong>${activeShieldMit >= 0 ? `+${activeShieldMit}% MIT.` : `${activeShieldMit}%`}</strong></div>
        <div class="st-summary-stat"><span>PODER ACTIVO</span><strong>${(stateManager?.get('gauntlet_tier') || 0) > 0 ? equippedPower.toUpperCase() : 'LATENTE'}</strong></div>
        <div class="st-summary-stat"><span>REGENERACIÓN</span><strong>+${activeEnergyRegen}/s</strong></div>
      </div>

      <div class="st-pane-section">
        <div class="st-card-header-eyebrow">ESPADA DEL ALBA & ÉGIDAS</div>
        <h3 class="st-pane-heading">ENCANTAMIENTOS DE FILO Y ESCUDOS</h3>
        <div class="st-equip-cards-list">
          ${weaponCardsHtml}
          ${shieldCardsHtml}
        </div>
      </div>

      <div class="st-pane-section">
        <div class="st-card-header-eyebrow">RELIQUIA DE TARAK</div>
        <h3 class="st-pane-heading">ENGARCES ELEMENTALES</h3>
        <p class="st-pane-sub">${switchHint}</p>
        <div class="st-equip-cards-list">
          ${conduitCardsHtml}
        </div>
      </div>
    `;

    const bindArsenalBtn = (btn, handler) => {
      let lastTap = -Infinity;
      const run = (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const now = performance.now();
        if (now - lastTap < 200) return;
        lastTap = now;
        handler();
      };
      btn.addEventListener('click', run);
      btn.addEventListener('touchend', (e) => {
        if (e && e.cancelable) e.preventDefault();
        run(e);
      }, { passive: false });
    };

    this.arsenalContainer.querySelectorAll('[data-equip-weapon]').forEach((btn) => {
      bindArsenalBtn(btn, () => {
        if (equipmentManager) {
          equipmentManager.equipWeapon(btn.dataset.equipWeapon);
          const wp = equipmentManager.getWeapon();
          if (player && wp?.enchantmentColor) {
            player.activeSwordTint = wp.enchantmentColor;
          }
          if (audioManager) audioManager.playHeal();
          this.renderArsenalTab(deps);
        }
      });
    });

    this.arsenalContainer.querySelectorAll('[data-equip-shield]').forEach((btn) => {
      bindArsenalBtn(btn, () => {
        if (equipmentManager) {
          equipmentManager.equipShield(btn.dataset.equipShield);
          if (audioManager) audioManager.playHeal();
          this.renderArsenalTab(deps);
        }
      });
    });

    this.arsenalContainer.querySelectorAll('[data-equip-element]').forEach((btn) => {
      bindArsenalBtn(btn, () => {
        const elem = btn.dataset.equipElement;
        if (player && player.hasElement(elem)) {
          player.equipAbility(elem);
          if (stateManager) stateManager.set('equipped_power', elem);
          if (deps.inputManager) deps.inputManager.setPower(elem);
          this.updateHUD(stateManager, elem);
          if (deps.inputManager) this.updateVirtualGamepad(deps.inputManager, elem, stateManager);
          if (audioManager) audioManager.playHeal();
          this.renderArsenalTab(deps);
        }
      });
    });
  }

  /**
   * Renderiza la Pestaña 3 (CRÓNICA & CÓDICE): Hitos del Nivel Introductorio, Bestiario y Prueba de Hordas.
   * @param {Object} deps
   */
  renderCodexTab(deps = {}) {
    if (!this.codexContainer) return;
    const { stateManager, waveManager, progressionManager, onTriggerHorde } = deps;

    const currentWorldId = stateManager?.get('current_world') || 'cave_exit_intro';
    const currentWorldInfo = WORLDS_LIST.find((w) => w.id === currentWorldId) || WORLDS_LIST[0];
    const hordeRunning = !!(waveManager && waveManager.isStarted && waveManager.state !== 'VICTORY');

    const hasFire = progressionManager ? progressionManager.unlockedElements.has('Fuego') : ((stateManager?.get('gauntlet_tier') || 0) >= 1);
    const hasRoots = progressionManager ? progressionManager.unlockedElements.has('Plantas') : false;
    const hasKinetic = progressionManager ? progressionManager.unlockedElements.has('Embestida') : false;
    const hasEther = progressionManager ? progressionManager.unlockedElements.has('Éter') : false;
    const worldConquered = Boolean(progressionManager && progressionManager.completedWorlds.has(currentWorldId));

    const checkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12" /></svg>`;

    const milestones = [
      { done: hasFire, text: 'Mundo I · Despertar el Núcleo de Fuego y liberar la salida del Claro.' },
      { done: hasRoots, text: 'Mundo II · Dominar las Raíces en el Pantano de Esporas.' },
      { done: hasKinetic, text: 'Mundo III · Forjar la Embestida Cinética y demoler basaltos en la Caldera.' },
      { done: hasEther, text: 'Mundo IV · Sintonizar el Éter Magnético en la Ciudadela Astral.' },
      { done: worldConquered, text: `Región Actual (${currentWorldInfo?.name || 'Bioma'}) · Derrotar a su Guardián Regional.` }
    ];

    const milestonesHtml = milestones.map((m) => `
      <div class="st-milestone-item ${m.done ? 'done' : ''}">
        <span class="st-milestone-dot">${m.done ? checkSvg : ''}</span>
        <span>${m.text}</span>
      </div>
    `).join('');

    const worldsHtml = WORLDS_LIST.map((w) => {
      const isCurrent = w.id === currentWorldId;
      const isUnlocked = !progressionManager || progressionManager.isWorldUnlocked(w.id);
      const isCompleted = Boolean(progressionManager && progressionManager.completedWorlds.has(w.id));
      const coreLabel = w.coreElement ? `Núcleo: ${w.coreElement}` : '';
      const statusPill = isCompleted ? 'CONQUISTADO ✓' : (!isUnlocked ? 'SELLADO 🔒' : coreLabel);

      return `
        <div class="st-world-card ${isCurrent ? 'is-active' : ''} ${!isUnlocked ? 'is-locked' : ''}" style="border-left: 4px solid ${w.accentColor};">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <span style="font-size:10px;font-weight:900;letter-spacing:0.08em;color:${w.accentColor};">${w.subtitle}</span>
            ${statusPill ? `<span style="font-size:9px;font-weight:800;color:${isCompleted ? '#4ade80' : '#94a3b8'};">${statusPill}</span>` : ''}
          </div>
          <h4 style="margin:0;font-size:13px;font-weight:900;color:#f8fafc;">${w.name}</h4>
          <p style="margin:0;font-size:11px;line-height:1.35;color:#cbd5e1;">${w.description}</p>
          <button type="button" class="st-world-travel-btn ${isCurrent ? 'is-current' : ''}" data-travel-world="${w.id}" ${(isCurrent || !isUnlocked) ? 'disabled' : ''}>
            ${isCurrent ? 'BIOMA ACTUAL' : !isUnlocked ? 'DERROTA AL GUARDIÁN PREVIO' : 'VIAJAR AQUÍ'}
          </button>
        </div>
      `;
    }).join('');

    const isMobile = this._isMobileActive();
    const codexObjective = formatControlPrompts(
      stateManager?.get('level_objective') || 'Sigue el sendero exterior hacia el Claro del Santuario.',
      isMobile
    );
    const artilleryHint = formatControlPrompts(
      'Mantiene distancia y dispara orbes tóxicos. Alza la Égida con [Shift] justo antes del impacto para devolverle su propio proyectil.',
      isMobile
    );
    const tankHint = formatControlPrompts(
      'Bloquea cortes frontales de acero. Destroza e incinera su pavés de madera con una Bola de Fuego o flanquéalo con [Espacio].',
      isMobile
    );

    this.codexContainer.innerHTML = `
      <div class="st-pane-section">
        <div class="st-card-header-eyebrow">${currentWorldInfo?.subtitle?.toUpperCase() || 'CAPÍTULO I · NIVEL INTRODUCTORIO'}</div>
        <h3 class="st-pane-heading">${currentWorldInfo?.name?.toUpperCase() || 'UMBRAL DE LA CUEVA HENDIDA'}</h3>
        <p class="st-pane-sub">${codexObjective}</p>
        <div class="st-milestone-list">
          ${milestonesHtml}
        </div>

        <div class="st-world-atlas-banner">
          <div class="st-card-header-eyebrow">ATLAS DE LA RELIQUIA · 4 MUNDOS INTERCONECTADOS</div>
          <div class="st-world-atlas-grid">
            ${worldsHtml}
          </div>
        </div>

        <div class="st-equip-card" style="margin-top: auto;">
          <div class="st-equip-info">
            <h4>Estela de Prueba de Hordas (5 Oleadas)</h4>
            <p>${hordeRunning ? '¡El desafío de hordas ya ruge en la plaza del Santuario!' : 'Invoca las 5 oleadas tácticas en la plaza del Santuario cuando quieras poner a prueba todas las mecánicas.'}</p>
          </div>
          <button type="button" id="btn-trigger-horde-ui" class="cel-action-btn ${hordeRunning ? 'equipped-badge' : 'primary'}" ${hordeRunning ? 'disabled' : ''}>
            ${hordeRunning ? 'EN CURSO' : 'INICIAR HORDAS'}
          </button>
        </div>
      </div>

      <div class="st-pane-section">
        <div class="st-card-header-eyebrow">CÓDICE DE COMBATE</div>
        <h3 class="st-pane-heading">ARQUETIPOS HOSTILES</h3>
        <div class="st-bestiary-grid">
          <div class="st-bestiary-card">
            <h4>Sabueso de Zarzas (Hostigador)</h4>
            <p>Veloz en manada, coordina turnos de embestida orbitales. Aprovecha el tercer tajo amplio o enraízalos antes de que te rodeen.</p>
          </div>
          <div class="st-bestiary-card">
            <h4>Escupidor de Esporas (Artillería)</h4>
            <p>${artilleryHint}</p>
          </div>
          <div class="st-bestiary-card">
            <h4>Centinela con Pavés de Roble (Tanque)</h4>
            <p>${tankHint}</p>
          </div>
          <div class="st-bestiary-card">
            <h4>Acechador de Sombra (Duelista)</h4>
            <p>Amaga y ejecuta estocadas relámpago tras un destello dorado. Un Parry Perfecto quiebra su postura al instante.</p>
          </div>
          <div class="st-bestiary-card">
            <h4>Slime Elemental (Mutágeno)</h4>
            <p>Cuerpo gelatinoso elástico que se divide en dos brotes en el Pantano de Esporas si no se neutraliza rápidamente.</p>
          </div>
          <div class="st-bestiary-card">
            <h4>Centinela de Éter (Astral)</h4>
            <p>Proyecta descargas magnéticas a distancia. Devuelve sus orbes con Pulso de Polaridad o desarma a los acorazados con Embestida/Éter.</p>
          </div>
          <div class="st-bestiary-card">
            <h4>Guardianes Regionales (Jefes de 2 Fases)</h4>
            <p>Al caer bajo el 50% de vida entran en Fase II furiosa. Rompe sus escudos o corazas volcánicas para abrir ventana crítica.</p>
          </div>
        </div>
      </div>
    `;

    const bindCodexBtn = (btn, handler) => {
      let lastTap = -Infinity;
      const run = (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const now = performance.now();
        if (now - lastTap < 220) return;
        lastTap = now;
        handler();
      };
      btn.addEventListener('click', run);
      btn.addEventListener('touchend', (e) => {
        if (e && e.cancelable) e.preventDefault();
        run(e);
      }, { passive: false });
    };

    const btnTrigger = this.codexContainer.querySelector('#btn-trigger-horde-ui');
    if (btnTrigger && typeof onTriggerHorde === 'function') {
      bindCodexBtn(btnTrigger, () => {
        onTriggerHorde();
      });
    }

    const travelHook = stateManager?.get('load_world_hook');
    this.codexContainer.querySelectorAll('[data-travel-world]').forEach((btn) => {
      bindCodexBtn(btn, () => {
        const targetWorld = btn.dataset.travelWorld;
        if (!targetWorld || typeof travelHook !== 'function') return;
        travelHook(targetWorld, { animated: true });
        const closeBtn = document.getElementById('btn-close-talents') || document.getElementById('btn-close-talents-x');
        if (closeBtn) closeBtn.click();
      });
    });
  }

  /**
   * Retorna un icono `<svg>` vectorial único y semántico (`currentColor`, `viewBox="0 0 24 24"`,
   * `aria-hidden="true"`, `focusable="false"`) para cada uno de los 36 talentos del Santuario.
   * @private
   * @param {string} svgType
   * @returns {string}
   */
  _getSkillSvgIcon(svgType) {
    const o = `xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"`;
    switch (svgType) {
      // --- DISCIPLINA 1: ÉGIDA Y PARRY (12 iconos únicos) ---
      case 'shield_parry':
        return `<svg ${o}><path d="M12 3l7 3.5v5c0 4.6-2.9 8.7-7 9.9-4.1-1.2-7-5.3-7-9.9v-5L12 3z" /><path d="M16 4l4-1-1 4M9 12l2.5 2.5L16 9.5" /></svg>`;
      case 'shield_shockwave':
        return `<svg ${o}><path d="M12 4.5l5.5 2.8v4c0 3.7-2.2 7-5.5 8-3.3-1-5.5-4.3-5.5-8v-4L12 4.5z" /><path d="M3 12h1.5M19.5 12H21M4.5 5.5l1.5 1.5M18 5.5l1.5-1.5M4.5 18.5l1.5-1.5M18 17l1.5 1.5" /></svg>`;
      case 'reflect_prism':
        return `<svg ${o}><polygon points="10,4 16,12 10,20 4,12" /><path d="M2 12h3M16 12h6M14.5 9l6-4M14.5 15l6 4" /></svg>`;
      case 'bastion_citadel':
        return `<svg ${o}><path d="M4 9l3-4 5 3 5-3 3 4-2 9c-2 2-4 3-6 3s-4-1-6-3L4 9z" /><path d="M12 11v6M9 14h6" /></svg>`;
      case 'vital_pulse':
        return `<svg ${o}><path d="M12 20.5l-1.3-1.2C5.6 14.7 2.5 11.9 2.5 8.4 2.5 5.6 4.7 3.5 7.5 3.5c1.6 0 3.1.75 4.5 2.1 1.4-1.35 2.9-2.1 4.5-2.1 2.8 0 5 2.1 5 4.9 0 3.5-3.1 6.3-8.2 10.9L12 20.5z" /><path d="M12 8.5v5M9.5 11h5" /></svg>`;
      case 'steel_anvil':
        return `<svg ${o}><path d="M4 8h16l-2 4h-3v4h4v3H5v-3h4v-4H6z" /><path d="M12 4v3" /></svg>`;
      case 'crystal_heart':
        return `<svg ${o}><polygon points="12,2.5 21,9 18,21 6,21 3,9" /><polygon points="12,7 16.5,10.5 14.8,17.5 9.2,17.5 7.5,10.5" /></svg>`;
      case 'phoenix_rise':
        return `<svg ${o}><path d="M12 3c2 3 4 4 8 3-1 3-3 5-5 6 1 3 0 6-3 8-3-2-4-5-3-8-2-1-4-3-5-6 4 1 6 0 8-3z" /><path d="M12 10v5" /></svg>`;
      case 'shield_stride':
        return `<svg ${o}><path d="M13 3l6 3v4.5c0 4.2-2.6 8-6 9-3.4-1-6-4.8-6-9V6l6-3z" /><path d="M3 9h3M2 13h4M3.5 17h3.5" /></svg>`;
      case 'shield_siphon':
        return `<svg ${o}><path d="M12 3l7 3.5v4.5c0 4.4-2.8 8.3-7 9.5-4.2-1.2-7-5.1-7-9.5V6.5L12 3z" /><path d="M13 7.5l-3.5 5h3l-1 4.5 3.5-5h-3z" /></svg>`;
      case 'seismic_hammer':
        return `<svg ${o}><path d="M7 4h10v5H7zM12 9v8M5 20h14M4 16l2 2M20 16l-2 2" /></svg>`;
      case 'eternal_halo':
        return `<svg ${o}><circle cx="12" cy="12" r="9" /><path d="M12 6.5l4.5 2.2v3.3c0 2.9-1.9 5.6-4.5 6.5-2.6-.9-4.5-3.6-4.5-6.5V8.7L12 6.5z" /></svg>`;

      // --- DISCIPLINA 2: IRA DEL ACERO Y CINÉTICA (12 iconos únicos) ---
      case 'metronome_blade':
        return `<svg ${o}><path d="M19 4L8 15M15 4h4v4" /><path d="M5 13l6 6M4 19l3-3M11 6l-5 5" /></svg>`;
      case 'twin_swords':
        return `<svg ${o}><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /><line x1="13" y1="19" x2="19" y2="13" /><line x1="16" y1="16" x2="20" y2="20" /><polyline points="9.5 17.5 21 6 21 3 18 3 6.5 14.5" /></svg>`;
      case 'whirlwind_slash':
        return `<svg ${o}><path d="M21 12a9 9 0 0 1-14.5 7.1" /><path d="M3 12a9 9 0 0 1 14.5-7.1" /><polyline points="17 2 18 5 15 6" /><polyline points="7 22 6 19 9 18" /><circle cx="12" cy="12" r="2.2" fill="currentColor" /></svg>`;
      case 'execution_blade':
        return `<svg ${o}><path d="M5 19L19 5M14 4c3 2 5 5 6 9l-5 1-3-3zM4 16l4 4" /><circle cx="15" cy="9" r="1.2" fill="currentColor" /></svg>`;
      case 'winged_dash':
        return `<svg ${o}><path d="M3 12h15M13 6l7 6-7 6" /><path d="M4 7h6M5 17h5" /></svg>`;
      case 'kinetic_fist':
        return `<svg ${o}><polygon points="13 2 5 13 12 13 11 22 19 11 12 11 13 2" /></svg>`;
      case 'phantom_afterimage':
        return `<svg ${o}><path d="M4 8h7M4 12h9M4 16h6" /><polygon points="15,5 21,12 15,19 12,15.5 15,12 12,8.5" /></svg>`;
      case 'storm_twin':
        return `<svg ${o}><path d="M11 3L5 12h5l-1 8 6-9h-5z" /><path d="M18 5l-3 5h3l-2 6" /></svg>`;
      case 'titan_breath':
        return `<svg ${o}><path d="M4 17c3 0 5-2 7-5 2-3 5-5 9-5" /><path d="M4 12c2.5 0 4.5-1.2 6.5-3.5M4 20h10c3 0 5-1.5 6-4" /></svg>`;
      case 'style_crest':
        return `<svg ${o}><polygon points="12,3 14.8,8.8 21,9.7 16.5,14.1 17.6,20.3 12,17.3 6.4,20.3 7.5,14.1 3,9.7 9.2,8.8" /></svg>`;
      case 'chain_slashes':
        return `<svg ${o}><path d="M4 18L13 5M9 19l9-13M14 19l6-9" /></svg>`;
      case 'celestial_wave':
        return `<svg ${o}><path d="M5 19L19 5" /><path d="M14 4c4 1 6 3 6 7" /><path d="M9 2c7 1.5 11 5.5 12.5 12.5" /><path d="M4 15l5 5" /></svg>`;

      // --- DISCIPLINA 3: DOMINIO DE LA RELIQUIA (12 iconos únicos) ---
      case 'triple_flame':
        return `<svg ${o}><path d="M12 3c-2.5 3-4 5.5-4 8.5a4 4 0 0 0 8 0C16 8.5 14.5 6 12 3z" /><path d="M5.5 9C4 11 3 12.8 3 14.8a3 3 0 0 0 5.2 2" /><path d="M18.5 9c1.5 2 2.5 3.8 2.5 5.8a3 3 0 0 1-5.2 2" /></svg>`;
      case 'fusion_rings':
        return `<svg ${o}><circle cx="9.5" cy="12" r="5" /><circle cx="14.5" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /></svg>`;
      case 'magma_crater':
        return `<svg ${o}><path d="M3 19h18l-3-7h-2l-2-3h-4L8 12H6z" /><path d="M12 3c-1.5 1.8-2 3-2 4.2a2 2 0 0 0 4 0c0-1.2-.5-2.4-2-4.2z" /></svg>`;
      case 'solar_supernova':
        return `<svg ${o}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" /></svg>`;
      case 'thorn_vine':
        return `<svg ${o}><path d="M4 20c3-6 5-12 15-15" /><path d="M9 13l-2.5-1.5M13 9l1.5 2.5M16 5.5L19.5 5l-.5 3.5" /></svg>`;
      case 'root_cage':
        return `<svg ${o}><path d="M4 21c1-5 4-8 8-8s7 3 8 8" /><path d="M7 21c.5-3 2.5-5 5-5s4.5 2 5 5" /><path d="M8 9l4 4 4-4M12 4v9" /></svg>`;
      case 'sprout_aura':
        return `<svg ${o}><path d="M12 20V10" /><path d="M12 13c-4 0-6.5-2.5-6.5-6 3.5 0 6.5 2 6.5 6z" /><path d="M12 11c4 0 6.5-2.5 6.5-6-3.5 0-6.5 2-6.5 6z" /><circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3" /></svg>`;
      case 'bloom_lotus':
        return `<svg ${o}><path d="M12 4c2.5 3.5 2.5 7 0 10-2.5-3-2.5-6.5 0-10z" /><path d="M12 14c-4-1-7-3.5-8-7 3.5 0 6.5 1.5 8 7zM12 14c4-1 7-3.5 8-7-3.5 0-6.5 1.5-8 7z" /><path d="M6 19h12" /></svg>`;
      case 'essence_spring':
        return `<svg ${o}><path d="M12 3c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10z" /><path d="M12 10v6M9.5 13.5h5" /></svg>`;
      case 'rune_hourglass':
        return `<svg ${o}><polygon points="12,3 20,8 20,16 12,21 4,16 4,8" /><circle cx="12" cy="12" r="2.8" /></svg>`;
      case 'charged_spire':
        return `<svg ${o}><polygon points="12,2 16,12 12,22 8,12" /><path d="M4 12h2M18 12h2M6 6l2 2M16 6l2 2" /></svg>`;
      case 'omega_gauntlet':
        return `<svg ${o}><path d="M6 19h4v-2a6 6 0 1 1 4 0v2h4" /><circle cx="12" cy="11" r="2" /></svg>`;

      default:
        return `<svg ${o}><polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" /></svg>`;
    }
  }

  /**
   * Construye o refresca interactivamente el Árbol de Habilidades simétrico de 18 nodos
   * (3 Disciplinas × 2 Carriles × 3 Rangos: Égida & Esgrima, Furia Elemental y Reliquia & Agilidad).
   * @param {import('../systems/SkillTreeManager.js').SkillTreeManager} skillTreeManager
   * @param {import('../core/AudioManager.js').AudioManager} [audioManager=null]
   */
  renderSkillTree(skillTreeManager, audioManager = null) {
    if (!this.skillTreeList || !skillTreeManager) return;

    const essence = skillTreeManager.getEssence();
    const totalAllocated = skillTreeManager.getTotalAllocatedRanks();
    if (this.skillModalEssence) this.skillModalEssence.textContent = String(essence);
    if (this.hudEssenceVal) this.hudEssenceVal.textContent = String(essence);
    if (this.stTopMastery) this.stTopMastery.textContent = `NV. ${1 + totalAllocated}`;
    if (this.stTopVitality) {
      const maxHp = 3 + skillTreeManager.getSkillRank('max_health_up');
      this.stTopVitality.textContent = String(maxHp);
    }

    if (typeof skillTreeManager.getNextUnlockProgress === 'function') {
      const progInfo = skillTreeManager.getNextUnlockProgress();
      if (this.stNextUnlockLabel) {
        this.stNextUnlockLabel.textContent = progInfo.ready
          ? `¡DESPERTAR DISPONIBLE: ${progInfo.targetSkillName.toUpperCase()}!`
          : `PRÓXIMO DESPERTAR: ${progInfo.targetSkillName.toUpperCase()}`;
      }
      if (this.stNextUnlockVal) {
        this.stNextUnlockVal.textContent = progInfo.nextCost > 0
          ? `${progInfo.currentEssence} / ${progInfo.nextCost} ✦`
          : 'MÁXIMO';
      }
      if (this.stNextUnlockFill) {
        this.stNextUnlockFill.style.transform = `scaleX(${progInfo.pct.toFixed(3)})`;
        this.stNextUnlockFill.classList.toggle('is-ready', Boolean(progInfo.ready));
      }
    }

    const allSkills = Object.values(skillTreeManager.skills);
    if (!this.selectedSkillId || !skillTreeManager.skills[this.selectedSkillId]) {
      this.selectedSkillId = allSkills[0]?.id || 'parry_window';
    }

    this.skillTreeList.innerHTML = '';

    const treeConfigs = [
      { key: 'aegis', title: 'ÉGIDA Y PARRY', headerTitle: 'DISCIPLINA · ÉGIDA Y PARRY', rootId: 'parry_window', lanesCount: 3 },
      { key: 'wrath', title: 'IRA DEL ACERO', headerTitle: 'DISCIPLINA · IRA DEL ACERO Y CINÉTICA', rootId: 'blade_tempo', lanesCount: 3 },
      { key: 'relic', title: 'DOMINIO DE RELIQUIA', headerTitle: 'DISCIPLINA · DOMINIO DE LA RELIQUIA', rootId: 'ember_fan', lanesCount: 3 }
    ];

    // Vincular diamantes superiores para enfocar rápidamente cualquiera de las 3 disciplinas (Clic + Touch)
    this.stDiamondSlots.forEach((slot, idx) => {
      const cfg = treeConfigs[idx];
      if (!cfg) return;
      slot.dataset.discipline = cfg.key;
      slot.style.cursor = 'pointer';
      const focusBranch = (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const targetSkill = skillTreeManager.skills[cfg.rootId];
        if (targetSkill) {
          this.selectedSkillId = targetSkill.id;
          this._highlightSelectedNode();
          this._updateSkillInspector(targetSkill, skillTreeManager, audioManager);
          const col = this.skillTreeList.querySelector(`[data-branch-key="${cfg.key}"]`);
          if (col && typeof col.scrollIntoView === 'function') {
            col.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      };
      slot.onclick = focusBranch;
      slot.ontouchend = (e) => {
        if (e && e.cancelable) e.preventDefault();
        focusBranch(e);
      };
    });

    // Botón táctico de Reembolso / Respec en cabecera del árbol para redistribuir Esencia libremente
    const boardHeader = this.skillTreeList.parentElement
      ? this.skillTreeList.parentElement.querySelector('.st-board-header')
      : null;
    if (boardHeader && typeof boardHeader.querySelector === 'function') {
      let respecBtn = boardHeader.querySelector('.st-respec-btn');
      if (!respecBtn && typeof document !== 'undefined' && typeof document.createElement === 'function') {
        respecBtn = document.createElement('button');
        respecBtn.type = 'button';
        respecBtn.className = 'st-respec-btn';
        respecBtn.textContent = 'REEMBOLSAR';
        respecBtn.title = 'Reinicia todas las habilidades y devuelve toda la Esencia invertida';
        boardHeader.appendChild(respecBtn);
      }
      if (respecBtn) {
        const allocated = skillTreeManager.getTotalAllocatedRanks();
        respecBtn.disabled = allocated <= 0;
        respecBtn.classList.toggle('is-empty', allocated <= 0);
        let lastRespecMs = -Infinity;
        const doRespec = (e) => {
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          const now = performance.now();
          if (now - lastRespecMs < 240) return;
          lastRespecMs = now;
          const refunded = skillTreeManager.reset();
          if (refunded > 0) {
            if (audioManager) audioManager.playHeal();
            this.renderSkillTree(skillTreeManager, audioManager);
          }
        };
        respecBtn.onclick = doRespec;
        respecBtn.ontouchend = (e) => {
          if (e && e.cancelable) e.preventDefault();
          doRespec(e);
        };
      }
    }

    for (const tCfg of treeConfigs) {
      const branchCol = document.createElement('div');
      branchCol.className = `st-branch-column branch-${tCfg.key}`;
      branchCol.dataset.branchKey = tCfg.key;

      const branchSkills = allSkills.filter((s) => s.tree === tCfg.key);
      const branchPoints = skillTreeManager.getTreePoints(tCfg.key);
      const branchMaxPoints = branchSkills.reduce((sum, s) => sum + (s.maxRank || 1), 0);
      const branchPct = branchMaxPoints > 0 ? Math.min(1, branchPoints / branchMaxPoints) : 0;

      const branchHeader = document.createElement('div');
      branchHeader.className = 'st-branch-header';
      branchHeader.innerHTML = `
        <div class="st-branch-header-top">
          <span class="st-branch-title">${tCfg.title}</span>
          <span class="st-branch-progress">${branchPoints}/${branchMaxPoints} PTS</span>
        </div>
        <div class="st-branch-progress-bar">
          <div class="st-branch-progress-fill" style="transform: scaleX(${branchPct.toFixed(3)});"></div>
        </div>
      `;
      branchCol.appendChild(branchHeader);

      const lanesWrap = document.createElement('div');
      lanesWrap.className = 'st-lanes-container';

      for (let laneIdx = 0; laneIdx < tCfg.lanesCount; laneIdx++) {
        const laneSkills = allSkills
          .filter((s) => s.tree === tCfg.key && s.lane === laneIdx)
          .sort((a, b) => (a.tier || 0) - (b.tier || 0));

        const laneEl = document.createElement('div');
        laneEl.className = 'st-vertical-lane';

        if (laneSkills[0]?.laneTitle) {
          const laneSub = document.createElement('span');
          laneSub.className = 'st-lane-subtitle';
          laneSub.textContent = laneSkills[0].laneTitle;
          laneEl.appendChild(laneSub);
        }

        laneSkills.forEach((skill, idx) => {
          const rank = skillTreeManager.getSkillRank(skill.id);
          const maxRank = skill.maxRank || 1;
          const isOwned = rank >= 1;
          const isMax = skillTreeManager.isMaxRank(skill.id);
          const nextCost = skillTreeManager.getSkillCost(skill.id);
          const depsMet = skillTreeManager.areDependenciesMet(skill.id);
          const canBuy = skillTreeManager.canUnlock(skill.id);
          const isSelected = skill.id === this.selectedSkillId;

          const isJustUnlocked = skill.id === this._lastUnlockedSkillId;

          if (idx > 0) {
            const connector = document.createElement('div');
            const connectorLit = isOwned || depsMet;
            connector.className = `st-node-connector ${isOwned ? 'owned' : connectorLit ? 'active' : 'locked'}${isJustUnlocked ? ' just-energized' : ''}`;
            laneEl.appendChild(connector);
          }

          const nodeWrap = document.createElement('button');
          nodeWrap.type = 'button';
          nodeWrap.className = [
            'st-octa-node',
            skill.isMastery ? 'mastery-node' : '',
            isMax ? 'state-owned' : canBuy ? 'state-available' : isOwned ? 'state-owned' : depsMet ? 'state-affordable-wait' : 'state-locked',
            isSelected ? 'is-selected' : '',
            isJustUnlocked ? 'just-unlocked' : ''
          ].filter(Boolean).join(' ');
          const statusDesc = isMax ? `Máximo (${rank}/${maxRank})` : `Rango ${rank}/${maxRank} · ${nextCost} Esencia`;
          nodeWrap.setAttribute('aria-label', `${skill.name} (${statusDesc})`);
          nodeWrap.title = `${skill.name} · ${statusDesc}`;
          nodeWrap.dataset.skillId = skill.id;
          nodeWrap.dataset.tier = String(skill.tier || 0);

          nodeWrap.innerHTML = `
            <span class="st-node-halo"></span>
            <span class="st-node-spurs"></span>
            <span class="st-node-bezel">
              <span class="st-node-core">
                ${this._getSkillSvgIcon(skill.svgType)}
              </span>
            </span>
            ${(maxRank > 1 || rank > 0) ? `<span class="st-node-rank-pill">R${rank}/${maxRank}</span>` : ''}
            ${isMax ? '' : `<span class="st-node-cost-pill">${nextCost}</span>`}
          `;

          const selectAndInspectNode = (e) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            const changed = this.selectedSkillId !== skill.id;
            this.selectedSkillId = skill.id;
            this._highlightSelectedNode();
            this._updateSkillInspector(skill, skillTreeManager, audioManager);
            if (changed && this.stInspectorPanel) {
              this.stInspectorPanel.classList.remove('inspector-flash');
              void this.stInspectorPanel.offsetWidth;
              this.stInspectorPanel.classList.add('inspector-flash');
            }
            if (this.stInspectorBuyBtn && typeof this.stInspectorBuyBtn.scrollIntoView === 'function' && typeof window !== 'undefined' && window.innerWidth <= 860) {
              this.stInspectorBuyBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          };

          let touchStartX = 0;
          let touchStartY = 0;
          nodeWrap.addEventListener('touchstart', (e) => {
            const t = e.changedTouches && e.changedTouches[0];
            if (t) {
              touchStartX = t.clientX;
              touchStartY = t.clientY;
            }
          }, { passive: true });
          nodeWrap.addEventListener('click', selectAndInspectNode);
          nodeWrap.addEventListener('touchend', (e) => {
            const t = e.changedTouches && e.changedTouches[0];
            if (t && Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY) >= 12) {
              return;
            }
            if (e && e.cancelable) e.preventDefault();
            selectAndInspectNode(e);
          }, { passive: false });

          laneEl.appendChild(nodeWrap);
        });

        lanesWrap.appendChild(laneEl);
      }

      branchCol.appendChild(lanesWrap);
      this.skillTreeList.appendChild(branchCol);
    }

    this._lastUnlockedSkillId = null;

    const activeSkill = skillTreeManager.skills[this.selectedSkillId] || allSkills[0];
    if (activeSkill) {
      this._updateSkillInspector(activeSkill, skillTreeManager, audioManager);
    }
  }

  /**
   * Resalta el nodo seleccionado sin reconstruir el árbol completo.
   * @private
   */
  _highlightSelectedNode() {
    if (!this.skillTreeList) return;
    const nodes = this.skillTreeList.querySelectorAll('.st-octa-node');
    nodes.forEach((n) => {
      n.classList.toggle('is-selected', n.dataset.skillId === this.selectedSkillId);
    });
  }

  /**
   * Sincroniza el Panel Inspector Derecho con la habilidad enfocada y sus rangos (cero emojis, texto limpio).
   * @private
   */
  _updateSkillInspector(skill, skillTreeManager, audioManager) {
    if (!skill || !skillTreeManager) return;

    const rank = skillTreeManager.getSkillRank(skill.id);
    const maxRank = skill.maxRank || 1;
    const isMax = skillTreeManager.isMaxRank(skill.id);
    const nextCost = skillTreeManager.getSkillCost(skill.id);
    const depsMet = skillTreeManager.areDependenciesMet(skill.id);
    const canBuy = skillTreeManager.canUnlock(skill.id);
    const essence = skillTreeManager.getEssence();
    const treePts = skillTreeManager.getTreePoints(skill.tree);
    const reqPts = skill.reqTreePoints || 0;

    // Sincronizar encabezado de disciplina activa y diamantes superiores
    if (this.stDisciplineTitle) {
      const titles = {
        aegis: 'ÉGIDA Y PARRY',
        wrath: 'IRA DEL ACERO Y CINÉTICA',
        relic: 'DOMINIO DE LA RELIQUIA'
      };
      this.stDisciplineTitle.textContent = titles[skill.tree] || 'SANTUARIO DEL GUANTELETE';
    }
    this.stDiamondSlots.forEach((slot) => {
      slot.classList.toggle('active', slot.dataset.discipline === skill.tree);
    });

    if (this.stInspectorTitle) {
      this.stInspectorTitle.textContent = maxRank > 1 ? `${skill.name.toUpperCase()} · R${rank}/${maxRank}` : skill.name.toUpperCase();
    }
    if (this.stPreviewImg) {
      const previewMap = {
        aegis: '/assets/ui/skill_aegis_preview.jpg',
        wrath: '/assets/ui/skill_wrath_preview.jpg',
        relic: '/assets/ui/skill_relic_preview.jpg'
      };
      const targetSrc = previewMap[skill.tree] || '/assets/ui/skill_wrath_preview.jpg';
      if (this._lastPreviewSrc !== targetSrc) {
        this._lastPreviewSrc = targetSrc;
        this.stPreviewImg.classList.add('is-switching');
        this.stPreviewImg.setAttribute('src', targetSrc);
        setTimeout(() => {
          if (this.stPreviewImg) this.stPreviewImg.classList.remove('is-switching');
        }, 200);
      }
    }
    if (this.stInspectorInputBadge) {
      this.stInspectorInputBadge.textContent = skill.inputHint || skill.badge || 'Técnica del Guantelete';
    }
    if (this.stInspectorDesc) this.stInspectorDesc.textContent = skill.description;
    if (this.stInspectorBonusText) {
      this.stInspectorBonusText.textContent = skill.bonusText || skill.mechanicsText || 'Aumenta la eficacia rítmica y la resistencia a la interrupción.';
    }

    if (this.stInspectorReqLabel && this.stInspectorReqVal) {
      if (isMax) {
        this.stInspectorReqLabel.textContent = `DOMINIO MÁXIMO · ${skill.statReqLabel || 'MAESTRÍA'}`;
        this.stInspectorReqVal.textContent = `RANGO ${rank}/${maxRank}`;
        this.stInspectorReqVal.className = 'st-req-val req-met';
      } else if (!depsMet) {
        const missingParent = (skill.dependsOn || []).find((depId) => skillTreeManager.getSkillRank(depId) < 1);
        if (missingParent) {
          const parentName = skillTreeManager.skills[missingParent]?.name || 'Nodo Anterior';
          this.stInspectorReqLabel.textContent = `REQUIERE: ${parentName.toUpperCase()}`;
          this.stInspectorReqVal.textContent = `${essence} / ${nextCost} ESENCIA`;
        } else {
          const branchNames = { aegis: 'Égida', wrath: 'Ira', relic: 'Reliquia' };
          this.stInspectorReqLabel.textContent = `INVERSIÓN EN RAMA (${branchNames[skill.tree] || skill.tree})`;
          this.stInspectorReqVal.textContent = `${treePts} / ${reqPts} PTS`;
        }
        this.stInspectorReqVal.className = 'st-req-val req-unmet';
      } else {
        const missing = Math.max(0, nextCost - essence);
        this.stInspectorReqLabel.textContent = rank > 0
          ? `SIGUIENTE RANGO (${rank + 1}/${maxRank})`
          : 'COSTE DE ESENCIA ANCESTRAL';
        this.stInspectorReqVal.textContent = missing > 0
          ? `${essence} / ${nextCost} (FALTAN ${missing})`
          : `${essence} / ${nextCost} · LISTO`;
        this.stInspectorReqVal.className = essence >= nextCost ? 'st-req-val req-met' : 'st-req-val req-unmet';
      }
    }

    if (this.stInspectorBuyBtn) {
      this.stInspectorBuyBtn.onclick = null;
      this.stInspectorBuyBtn.ontouchend = null;
      if (isMax) {
        this.stInspectorBuyBtn.textContent = `RANGO MÁXIMO (${rank}/${maxRank})`;
        this.stInspectorBuyBtn.className = 'st-buy-action-btn is-owned';
        this.stInspectorBuyBtn.disabled = true;
      } else if (canBuy) {
        this.stInspectorBuyBtn.textContent = `${rank > 0 ? 'MEJORAR RANGO' : 'DESPERTAR HABILIDAD'} (${nextCost} ESENCIA)`;
        this.stInspectorBuyBtn.className = 'st-buy-action-btn can-buy';
        this.stInspectorBuyBtn.disabled = false;
        let lastBuyTap = -Infinity;
        const doBuy = (e) => {
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          const now = performance.now();
          if (now - lastBuyTap < 220) return;
          lastBuyTap = now;
          if (skillTreeManager.unlockSkill(skill.id)) {
            this._lastUnlockedSkillId = skill.id;
            if (this.skillModalEssence) {
              this.skillModalEssence.classList.remove('just-spent');
              void this.skillModalEssence.offsetWidth;
              this.skillModalEssence.classList.add('just-spent');
            }
            if (audioManager) audioManager.playHeal();
            this.renderSkillTree(skillTreeManager, audioManager);
          }
        };
        this.stInspectorBuyBtn.onclick = doBuy;
        this.stInspectorBuyBtn.ontouchend = (e) => {
          if (e && e.cancelable) e.preventDefault();
          doBuy(e);
        };
      } else if (!depsMet) {
        const missingParent = (skill.dependsOn || []).some((depId) => skillTreeManager.getSkillRank(depId) < 1);
        this.stInspectorBuyBtn.textContent = missingParent ? 'REQUIERE NODO ANTERIOR' : `REQUIERE ${reqPts} PTS EN RAMA`;
        this.stInspectorBuyBtn.className = 'st-buy-action-btn is-locked';
        this.stInspectorBuyBtn.disabled = true;
      } else {
        this.stInspectorBuyBtn.textContent = `ESENCIA INSUFICIENTE (${nextCost})`;
        this.stInspectorBuyBtn.className = 'st-buy-action-btn is-locked';
        this.stInspectorBuyBtn.disabled = true;
      }
    }
  }

  /**
   * Ciclo general de renderizado del DOM Overlay durante la partida.
   * @param {import('../core/InputManager.js').InputManager} inputManager
   * @param {import('../core/StateManager.js').StateManager} stateManager
   * @param {number} [deltaTime=0.016]
   * @param {import('../render/Camera.js').Camera} [camera=null]
   */
  render(inputManager, stateManager, deltaTime = 0.016, camera = null) {
    const gameState = stateManager ? stateManager.get('game_state') : 'STATE_PLAYING';
    this.setGameState(gameState);

    if (gameState !== 'STATE_PLAYING') return;

    const equipped = (stateManager && stateManager.get('equipped_power')) || 'Fuego';

    this.updateHUD(stateManager, equipped);
    this.updateComboAndEssence(stateManager);
    this.updateBossThreat(stateManager);
    this.updateHordeHUD(stateManager);
    this.updateDialogue(stateManager, deltaTime);
    this.updateInteractPrompt(stateManager);
    this.updateRadialWheel(inputManager, stateManager);
    this.updateVirtualGamepad(inputManager, equipped, stateManager);

    if (camera) {
      this.updateDamageNumbers(camera, deltaTime);
    }
  }

  /**
   * Genera iconos vectoriales semánticos limpios para el Taller de Herrería y Alquimia.
   * @private
   * @param {string} svgType
   * @returns {string}
   */
  _getArtisanSvgIcon(svgType) {
    const svgStart = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`;
    switch (svgType) {
      case 'sword':
        return `${svgStart}<path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="m13 19 6-6" /><path d="m16 16 4 4" /><path d="m19 21 2-2" /></svg>`;
      case 'shield':
        return `${svgStart}<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M12 7v10" /></svg>`;
      case 'hammer':
        return `${svgStart}<path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0a2.12 2.12 0 0 1 0-3L12 9" /><path d="M17.64 15 22 10.64" /><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91" /></svg>`;
      case 'heart':
        return `${svgStart}<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>`;
      case 'wind':
        return `${svgStart}<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" /><path d="M9.6 4.6A2 2 0 1 1 11 8H2" /><path d="M12.6 19.4A2 2 0 1 0 14 16H2" /></svg>`;
      case 'flask':
        return `${svgStart}<path d="M9 3h6" /><path d="M10 3v5l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" /><path d="M7.5 15h9" /></svg>`;
      case 'spark':
      default:
        return `${svgStart}<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>`;
    }
  }

  /**
   * Renderiza el Taller Regional del Herrero o Mago Alquimista con tarjetas interactivas.
   * @param {Object} npc
   * @param {import('../systems/ArtisanSystem.js').ArtisanSystem} artisanSystem
   * @param {import('../systems/SkillTreeManager.js').SkillTreeManager} skillTreeManager
   * @param {Object} [deps={}]
   */
  renderArtisanShop(npc, artisanSystem, skillTreeManager, deps = {}) {
    if (!this.artisanItemsGrid || !npc || !artisanSystem || !skillTreeManager) return;

    const isBlacksmith = npc.role === 'blacksmith';
    const items = artisanSystem.getCatalogForRole(isBlacksmith ? 'blacksmith' : 'alchemist');
    const essence = skillTreeManager.getEssence();

    if (this.artisanModal) {
      this.artisanModal.dataset.artisanRole = isBlacksmith ? 'blacksmith' : 'alchemist';
    }
    if (this.artisanRoleBadge) {
      this.artisanRoleBadge.textContent = npc.shopTitle
        || (isBlacksmith ? 'HERRERÍA Y TEMPLE DEL GREMIO' : 'BOTICA Y ALQUIMIA ARCANA');
    }
    if (this.artisanNpcName) {
      this.artisanNpcName.textContent = npc.name || (isBlacksmith ? 'Maestro Herrero' : 'Mago Alquimista');
    }
    if (this.artisanNpcQuote) {
      this.artisanNpcQuote.textContent = npc.shopSubtitle
        || (isBlacksmith
          ? 'Refuerza tu espada, tu escudo y la contundencia de tu guardia con Esencia Ancestral.'
          : 'Destila elixires permanentes o frascos instantáneos para potenciar tu aventura.');
    }
    if (this.artisanEssenceVal) {
      this.artisanEssenceVal.textContent = String(essence);
    }

    if (this.artisanBuffStatus) {
      if (artisanSystem.furyBuffRemaining > 0) {
        const secs = Math.ceil(artisanSystem.furyBuffRemaining);
        this.artisanBuffStatus.textContent = `✦ FURIA ARCANA ACTIVA (+22% DAÑO TOTAL · ${secs}s restantes)`;
        this.artisanBuffStatus.classList.remove('hidden');
      } else {
        this.artisanBuffStatus.classList.add('hidden');
      }
    }

    this.artisanItemsGrid.innerHTML = items.map((item) => {
      const rank = artisanSystem.getRank(item.id);
      const isMax = !item.consumable && artisanSystem.isMaxRank(item.id);
      const cost = artisanSystem.getItemCost(item.id);
      const canBuy = artisanSystem.canPurchase(item.id, skillTreeManager);
      const rankLabel = item.consumable
        ? (artisanSystem.furyBuffRemaining > 0 ? 'ACTIVA' : 'LISTA')
        : `NV. ${rank} / ${item.maxRank}`;
      const btnText = isMax
        ? 'MAESTRÍA COMPLETA'
        : canBuy
          ? `${isBlacksmith ? 'FORJAR' : item.consumable ? 'BEBER' : 'DESTILAR'} · ${cost} ✦`
          : `FALTAN ${Math.max(0, cost - essence)} ✦`;

      return `
        <article class="artisan-item-card ${isMax ? 'is-owned' : ''} ${canBuy ? 'can-buy' : ''}">
          <div class="artisan-card-top">
            <span class="artisan-icon-box" aria-hidden="true">${this._getArtisanSvgIcon(item.svgType)}</span>
            <div class="artisan-card-meta">
              <span class="artisan-card-badge">${item.badge}</span>
              <h4>${item.name}</h4>
            </div>
            <span class="artisan-rank-pill">${rankLabel}</span>
          </div>
          <p class="artisan-card-desc">${item.description}</p>
          <p class="artisan-card-bonus">${item.bonusPerRank}</p>
          <button
            type="button"
            class="artisan-buy-btn ${isMax ? 'is-owned' : (canBuy ? 'can-buy' : 'is-locked')}"
            data-artisan-buy="${item.id}"
            ${(isMax || !canBuy) ? 'disabled' : ''}
          >${btnText}</button>
        </article>
      `;
    }).join('');

    this.artisanItemsGrid.querySelectorAll('[data-artisan-buy]').forEach((btn) => {
      let lastTap = -Infinity;
      const runBuy = (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const now = performance.now();
        if (now - lastTap < 220) return;
        lastTap = now;
        const id = btn.dataset.artisanBuy;
        const res = artisanSystem.purchase(
          id,
          skillTreeManager,
          deps.player || null,
          deps.stateManager || null,
          deps.audioManager || null
        );
        if (res.ok) {
          this.renderArtisanShop(npc, artisanSystem, skillTreeManager, deps);
          if (deps.stateManager) {
            this.updateHUD(deps.stateManager, deps.stateManager.get('equipped_power') || 'Fuego');
            this.updateComboAndEssence(deps.stateManager);
          }
          const updatedBtn = this.artisanItemsGrid.querySelector(`[data-artisan-buy="${id}"]`);
          const updatedCard = updatedBtn ? updatedBtn.closest('.artisan-item-card') : null;
          if (updatedCard) {
            updatedCard.classList.add('artisan-card-purchased');
            setTimeout(() => updatedCard.classList.remove('artisan-card-purchased'), 420);
          }
        }
      };
      btn.addEventListener('click', runBuy);
      btn.addEventListener('touchend', (e) => {
        if (e && e.cancelable) e.preventDefault();
        runBuy(e);
      }, { passive: false });
    });
  }
}
