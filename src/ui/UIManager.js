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
    this.btnQuickArsenal = document.getElementById('btn-quick-arsenal');
    this.hudEssenceVal = document.getElementById('hud-essence-val');

    // 1.C Rumbo / Objetivo (Brújula God of War Ragnarök), Combo, Jefe y Hordas
    this.objectiveTracker = document.getElementById('objective-hud-tracker');
    this.objectiveTextEl = document.getElementById('objective-hud-text');
    this.compassMarkerEl = document.getElementById('compass-target-marker');
    this.compassDirEl = document.getElementById('compass-target-dir');
    this.compassDistEl = document.getElementById('compass-target-dist');
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
    this.stTopVitality = document.getElementById('st-top-vitality');
    this.skillTreeList = document.getElementById('skill-tree-list');
    this.stDisciplineTitle = document.querySelector('.st-discipline-title');
    this.stDiamondSlots = Array.from(document.querySelectorAll('.st-diamond-slot'));
    this.stInspectorTitle = document.getElementById('st-inspector-title');
    this.stInspectorInputBadge = document.getElementById('st-inspector-input-badge');
    this.stInspectorDesc = document.getElementById('st-inspector-desc');
    this.stInspectorBuyBtn = document.getElementById('st-inspector-buy-btn');
    this.stInspectorBonusText = document.getElementById('st-inspector-bonus-text');
    this.stInspectorReqLabel = document.getElementById('st-inspector-req-label');
    this.stInspectorReqVal = document.getElementById('st-inspector-req-val');
    this.arsenalContainer = document.getElementById('sanctuary-arsenal-content');
    this.codexContainer = document.getElementById('sanctuary-codex-content');
    this.selectedSkillId = 'parry_window';

    // 3. Diálogo, Rueda Radial y Gamepad Táctil
    this.dialogueCard = document.getElementById('dialogue-card');
    this.dialogueBadge = document.getElementById('dialogue-badge');
    this.dialogueSpeaker = document.getElementById('dialogue-speaker');
    this.dialogueText = document.getElementById('dialogue-text');

    this.radialWheel = document.getElementById('radial-wheel');
    this.radialSectors = Array.from(document.querySelectorAll('.radial-sector'));

    this.virtualGamepad = document.getElementById('virtual-gamepad');
    this.joystickThumb = document.getElementById('touch-joystick-thumb');
    this.touchSkillLabel = document.getElementById('touch-skill-label');
    this.touchSwitchLabel = document.getElementById('touch-switch-label');
    this.touchDashBtn = document.getElementById('touch-btn-dash');
    this.touchDashLabel = document.getElementById('touch-dash-label');

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
      this._lastPowerSignature = signature;

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

    // 2. Barra de Energía Elemental (GPU scaleX libre de Layout Thrashing)
    const energy = stateManager ? (stateManager.get('player_energy') ?? 100) : 100;
    if (Math.abs(energy - this._lastEnergy) > 0.5) {
      this._lastEnergy = energy;
      const clampedEnergy = Math.max(0, Math.min(100, energy));
      const ratio = clampedEnergy / 100;
      if (this.hudEnergyFill) this.hudEnergyFill.style.transform = `scaleX(${ratio})`;
      if (this.hudEnergyGhostFill) this.hudEnergyGhostFill.style.transform = `scaleX(${ratio})`;
      if (this.gaugePct) this.gaugePct.textContent = `${Math.round(clampedEnergy)}%`;
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
          this.hudPostureText.style.color = '#7dd3fc';
        } else {
          this.hudPostureText.textContent = `${Math.round(clampedPosture)}%`;
          this.hudPostureText.style.color = '#93c5fd';
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
        this.hudStaminaText.style.color = staminaExhausted ? '#f87171' : '#7dd3fc';
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
        if (document.body) document.body.classList.remove('dialogue-open');
      }
      return;
    }

    dialogue.timer -= deltaTime;
    if (dialogue.timer <= 0) {
      stateManager.set('active_dialogue', null);
      this.dialogueCard.classList.add('hidden');
      this._dialogueVisible = false;
      if (document.body) document.body.classList.remove('dialogue-open');
      return;
    }

    const speaker = dialogue.speaker || 'HABITANTE';
    if (this.dialogueSpeaker && this.dialogueSpeaker.textContent !== speaker) {
      this.dialogueSpeaker.textContent = speaker;
    }
    if (this.dialogueBadge) {
      const badge = speaker.includes('SANTI') ? 'PORTADOR' : speaker.includes('TARAK') ? 'SABIO' : speaker.includes('VALERIO') ? 'VIAJERO' : 'RELIQUIA';
      if (this.dialogueBadge.textContent !== badge) this.dialogueBadge.textContent = badge;
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
      this._lastEssence = essence;
      if (this.hudEssenceVal) this.hudEssenceVal.textContent = String(essence);
      if (this.skillModalEssence) this.skillModalEssence.textContent = String(essence);
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
      pane.classList.toggle('hidden', pane.dataset.sanctuaryPane !== validTab);
    });

    const { skillTreeManager, audioManager } = deps;
    if (skillTreeManager) {
      const essence = skillTreeManager.getEssence();
      if (this.skillModalEssence) this.skillModalEssence.textContent = String(essence);
      if (this.hudEssenceVal) this.hudEssenceVal.textContent = String(essence);
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

    this.arsenalContainer.innerHTML = `
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

    const btnTrigger = this.codexContainer.querySelector('#btn-trigger-horde-ui');
    if (btnTrigger && typeof onTriggerHorde === 'function') {
      btnTrigger.addEventListener('click', () => {
        onTriggerHorde();
      });
    }

    const travelHook = stateManager?.get('load_world_hook');
    this.codexContainer.querySelectorAll('[data-travel-world]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetWorld = btn.dataset.travelWorld;
        if (!targetWorld || typeof travelHook !== 'function') return;
        travelHook(targetWorld, { animated: true });
        const closeBtn = document.getElementById('btn-close-talents') || document.getElementById('btn-close-talents-x');
        if (closeBtn) closeBtn.click();
      });
    });
  }

  /**
   * Retorna el icono `<svg>` vectorial limpio (`currentColor`, `viewBox="0 0 24 24"`, `aria-hidden="true"`,
   * `focusable="false"`, cero colores fijos) para los 18 talentos del Santuario.
   * @private
   * @param {string} svgType
   * @returns {string}
   */
  _getSkillSvgIcon(svgType) {
    switch (svgType) {
      case 'shield':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3l8 4v5c0 5.25-3.4 9.74-8 11-4.6-1.26-8-5.75-8-11V7l8-4z" /><path d="M12 7v9" /></svg>`;
      case 'shield_burst':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3l7 3.5v4.5c0 4.5-3 8.5-7 9.8-4-1.3-7-5.3-7-9.8V6.5L12 3z" /><circle cx="12" cy="11.5" r="2.5" fill="currentColor" /><path d="M3 3l3 3M21 3l-3 3M3 21l3-3M21 21l-3-3" /></svg>`;
      case 'mirror_prism':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points="10,4 16,12 10,20 4,12" /><path d="M16 12h6M14.5 9l6.5-4M14.5 15l6.5 4" /></svg>`;
      case 'swords':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /><line x1="13" y1="19" x2="19" y2="13" /><line x1="16" y1="16" x2="20" y2="20" /><polyline points="9.5 17.5 21 6 21 3 18 3 6.5 14.5" /></svg>`;
      case 'blade_wave':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19L19 5" /><path d="M14 4c4 1 6 3 6 7" /><path d="M10 2c6 1.5 10 5.5 11.5 11.5" /><path d="M4 15l5 5" /></svg>`;
      case 'whirlwind_slash':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 12a9 9 0 0 1-14.5 7.1" /><path d="M3 12a9 9 0 0 1 14.5-7.1" /><polyline points="17 2 18 5 15 6" /><polyline points="7 22 6 19 9 18" /><circle cx="12" cy="12" r="2.5" fill="currentColor" /></svg>`;
      case 'triple_flame':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3c-2.5 3-4 5.5-4 8.5a4 4 0 0 0 8 0C16 8.5 14.5 6 12 3z" /><path d="M5.5 9C4 11 3 12.8 3 14.8a3 3 0 0 0 5.2 2" /><path d="M18.5 9c1.5 2 2.5 3.8 2.5 5.8a3 3 0 0 1-5.2 2" /></svg>`;
      case 'flame_orb':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 2.5c-3.5 3.8-5.5 6.8-5.5 10.5a5.5 5.5 0 0 0 11 0c0-3.7-2-6.7-5.5-10.5z" /><circle cx="12" cy="14" r="2.2" fill="currentColor" /></svg>`;
      case 'sun_nova':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" /></svg>`;
      case 'vine_whip':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 20c3-6 5-12 15-15" /><path d="M9 13l-2.5-1.5M13 9l1.5 2.5M16 5.5L19.5 5l-.5 3.5" /></svg>`;
      case 'root_snare':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 21c1-5 4-8 8-8s7 3 8 8" /><path d="M7 21c.5-3 2.5-5 5-5s4.5 2 5 5" /><path d="M8 9l4 4 4-4M12 4v9" /></svg>`;
      case 'oak_crest':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 2.5L4.5 6.5v5.5c0 4.8 3.2 9 7.5 10 4.3-1 7.5-5.2 7.5-10V6.5L12 2.5z" /><path d="M12 17V9M9 13l3-3 3 3" /></svg>`;
      case 'lightning':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2" /></svg>`;
      case 'meteor_strike':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 2v13" /><polyline points="7 11 12 16 17 11" /><path d="M4 20h16" /><path d="M7 17l-3 3M17 17l3 3" /></svg>`;
      case 'phantom_dash':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 8h8M3 16h6M3 12h14" /><polyline points="14 7 21 12 14 17" /></svg>`;
      case 'heart_plus':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20.5l-1.3-1.2C5.6 14.7 2.5 11.9 2.5 8.4 2.5 5.6 4.7 3.5 7.5 3.5c1.6 0 3.1.75 4.5 2.1 1.4-1.35 2.9-2.1 4.5-2.1 2.8 0 5 2.1 5 4.9 0 3.5-3.1 6.3-8.2 10.9L12 20.5z" /><path d="M12 8.5v6M9 11.5h6" /></svg>`;
      case 'relic_star':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points="12,2.5 14.8,9.2 21.5,12 14.8,14.8 12,21.5 9.2,14.8 2.5,12 9.2,9.2" /><circle cx="12" cy="12" r="2.2" fill="currentColor" /></svg>`;
      case 'crystal_heart':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points="12,2.5 21,9 18,21 6,21 3,9" /><polygon points="12,7 16.5,10.5 14.8,17.5 9.2,17.5 7.5,10.5" /></svg>`;
      case 'bastion_crown':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 17h16l-1.5-9-4.5 4-2-6-2 6-4.5-4z" /><path d="M5 20h14" /></svg>`;
      case 'iron_tower':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 21h12M7 21V8l5-4 5 4v13M9 11h6M10 21v-5h4v5" /></svg>`;
      case 'undying_phoenix':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 4c2 3 4 4 8 3-1 3-3 5-5 6 1 3 0 6-3 7-3-1-4-4-3-7-2-1-4-3-5-6 4 1 6 0 8-3z" /><circle cx="12" cy="11" r="1.5" /></svg>`;
      case 'execution_cleaver':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19L19 5M14 4c3 2 5 5 6 9l-5 1-3-3zM4 16l4 4" /></svg>`;
      case 'tempest_twin':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M13 3L5 14h6l-1 7 9-11h-6z" /><path d="M19 6l2-2M3 18l2-2" /></svg>`;
      case 'omega_rune':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 19h4v-2a6 6 0 1 1 4 0v2h4" /><circle cx="12" cy="11" r="2" /></svg>`;
      case 'bloom_lotus':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 4c2.5 3.5 2.5 7 0 10-2.5-3-2.5-6.5 0-10z" /><path d="M12 14c-4-1-7-3.5-8-7 3.5 0 6.5 1.5 8 7zM12 14c4-1 7-3.5 8-7-3.5 0-6.5 1.5-8 7z" /><path d="M6 19h12" /></svg>`;
      case 'arcane_core':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points="12,3 20,8 20,16 12,21 4,16 4,8" /><circle cx="12" cy="12" r="3" /></svg>`;
      default:
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" /></svg>`;
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
    if (this.skillModalEssence) this.skillModalEssence.textContent = String(essence);
    if (this.hudEssenceVal) this.hudEssenceVal.textContent = String(essence);
    if (this.stTopVitality) {
      const maxHp = 3 + skillTreeManager.getSkillRank('max_health_up');
      this.stTopVitality.textContent = String(maxHp);
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

    // Vincular diamantes superiores para enfocar rápidamente cualquiera de las 3 disciplinas
    this.stDiamondSlots.forEach((slot, idx) => {
      const cfg = treeConfigs[idx];
      if (!cfg) return;
      slot.dataset.discipline = cfg.key;
      slot.style.cursor = 'pointer';
      slot.onclick = () => {
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
    });

    for (const tCfg of treeConfigs) {
      const branchCol = document.createElement('div');
      branchCol.className = `st-branch-column branch-${tCfg.key}`;
      branchCol.dataset.branchKey = tCfg.key;

      const branchSkills = allSkills.filter((s) => s.tree === tCfg.key);
      const branchPoints = skillTreeManager.getTreePoints(tCfg.key);
      const branchMaxPoints = branchSkills.reduce((sum, s) => sum + (s.maxRank || 1), 0);

      const branchHeader = document.createElement('div');
      branchHeader.className = 'st-branch-header';
      branchHeader.innerHTML = `
        <span class="st-branch-title">${tCfg.title}</span>
        <span class="st-branch-progress">${branchPoints}/${branchMaxPoints} PTS</span>
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

        laneSkills.forEach((skill, idx) => {
          const rank = skillTreeManager.getSkillRank(skill.id);
          const maxRank = skill.maxRank || 1;
          const isOwned = rank >= 1;
          const isMax = skillTreeManager.isMaxRank(skill.id);
          const nextCost = skillTreeManager.getSkillCost(skill.id);
          const depsMet = skillTreeManager.areDependenciesMet(skill.id);
          const canBuy = skillTreeManager.canUnlock(skill.id);
          const isSelected = skill.id === this.selectedSkillId;

          if (idx > 0) {
            const connector = document.createElement('div');
            const connectorLit = isOwned || depsMet;
            connector.className = `st-node-connector ${isOwned ? 'owned' : connectorLit ? 'active' : 'locked'}`;
            laneEl.appendChild(connector);
          }

          const nodeWrap = document.createElement('button');
          nodeWrap.type = 'button';
          nodeWrap.className = [
            'st-octa-node',
            skill.isMastery ? 'mastery-node' : '',
            isMax ? 'state-owned' : canBuy ? 'state-available' : isOwned ? 'state-owned' : depsMet ? 'state-affordable-wait' : 'state-locked',
            isSelected ? 'is-selected' : ''
          ].filter(Boolean).join(' ');
          const statusDesc = isMax ? `Máximo (${rank}/${maxRank})` : `Rango ${rank}/${maxRank} · ${nextCost} Esencia`;
          nodeWrap.setAttribute('aria-label', `${skill.name} (${statusDesc})`);
          nodeWrap.title = `${skill.name} · ${statusDesc}`;
          nodeWrap.dataset.skillId = skill.id;

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
            this.selectedSkillId = skill.id;
            this._highlightSelectedNode();
            this._updateSkillInspector(skill, skillTreeManager, audioManager);
            if (this.stInspectorBuyBtn && typeof this.stInspectorBuyBtn.scrollIntoView === 'function' && this._isMobileActive()) {
              this.stInspectorBuyBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          };

          nodeWrap.addEventListener('click', selectAndInspectNode);
          nodeWrap.addEventListener('touchend', (e) => {
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
        this.stInspectorReqLabel.textContent = rank > 0
          ? `SIGUIENTE RANGO (${rank + 1}/${maxRank})`
          : 'COSTE DE ESENCIA ANCESTRAL';
        this.stInspectorReqVal.textContent = `${essence} / ${nextCost}`;
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
    this.updateRadialWheel(inputManager, stateManager);
    this.updateVirtualGamepad(inputManager, equipped, stateManager);

    if (camera) {
      this.updateDamageNumbers(camera, deltaTime);
    }
  }
}
