/**
 * @module UIManager
 * @description Gestor de interfaz de usuario desacoplado en DOM Overlay (HTML5/CSS3 + High-DPI SVGs).
 * Implementa una arquitectura pura fuera del Canvas para lograr máxima nitidez, accesibilidad
 * y contraste sofisticado contra el mundo de pixel art inferior:
 * - Tipografía nítida moderna sans-serif ('Inter' / 'Outfit').
 * - HUD minimalista flotante con gema elemental reactiva y corazones vectoriales SVG.
 * - Banner inmersivo de diálogo ("Show, Don't Tell" para el sistema de Karma).
 * - Rueda de selección radial DOM para PC (Tab) con sectores iluminados.
 * - Virtual Gamepad táctil con vectores SVG renderizado ÚNICAMENTE en dispositivos móviles.
 * - Mutaciones del DOM condicionadas a cambios de estado para garantizar 60 FPS estables sin reflows innecesarios.
 * @author Be a Legend Team
 * @version 2.2.0
 */
export class UIManager {
  constructor() {
    // --- Cache de Elementos del DOM Overlay ---
    this.overlayEl = document.getElementById('ui-overlay');
    this.vignetteEl = document.getElementById('vignette-overlay');

    // 1. HUD Superior Flotante
    this.hudContainer = document.getElementById('hud-container');
    this.hudRelicIcon = document.getElementById('hud-relic-icon');
    this.hudRelicCircle = this.hudRelicIcon ? this.hudRelicIcon.querySelector('circle') : null;
    this.hudPowerName = document.getElementById('hud-power-name');
    this.heartElements = [
      document.getElementById('heart-1'),
      document.getElementById('heart-2'),
      document.getElementById('heart-3')
    ];
    this.btnQuickPause = document.getElementById('btn-quick-pause');

    // 2. Diálogo Inmersivo
    this.dialogueCard = document.getElementById('dialogue-card');
    this.dialogueSpeaker = document.getElementById('dialogue-speaker');
    this.dialogueText = document.getElementById('dialogue-text');

    // 3. Rueda Radial de Poderes
    this.radialWheel = document.getElementById('radial-wheel');
    this.radialSectors = Array.from(document.querySelectorAll('.radial-sector'));

    // 4. Virtual Gamepad Móvil
    this.virtualGamepad = document.getElementById('virtual-gamepad');
    this.joystickThumb = document.getElementById('touch-joystick-thumb');
    this.touchSkillLabel = document.getElementById('touch-skill-label');

    // Paleta de colores elementales de la Reliquia
    this.powerColors = {
      'Fuego': '#fb923c',
      'Embestida': '#38bdf8',
      'Raíces': '#4ade80',
      'Curación': '#f472b6'
    };

    // --- Variables de Tracking para Evitar Reflows y Mutaciones Redundantes del DOM ---
    this._lastEquippedPower = null;
    this._lastCritical = null;
    this._lastGameState = null;
    this._lastRadialIndex = -1;
    this._lastRadialOpen = false;
    this._lastTouchShow = null;
    this._lastJoyX = 0;
    this._lastJoyY = 0;
    this._lastSkillLabel = null;
  }

  /**
   * Actualiza el HUD flotante minimalista: gema de la Reliquia y corazones vectoriales SVG.
   * Aplica dirty-checking para mutar el DOM únicamente cuando los valores cambian.
   * Cero variables numéricas o métricas internas ('Show, Don't Tell').
   * @param {import('../core/StateManager.js').StateManager} stateManager
   * @param {string} equippedPower
   */
  updateHUD(stateManager, equippedPower) {
    if (!this.hudContainer) return;

    // 1. Actualizar Reliquia solo si el poder cambió
    if (equippedPower !== this._lastEquippedPower) {
      this._lastEquippedPower = equippedPower;

      if (this.hudPowerName) {
        this.hudPowerName.textContent = equippedPower.toUpperCase();
      }

      const themeColor = this.powerColors[equippedPower] || '#facc15';
      if (this.hudRelicIcon) {
        this.hudRelicIcon.style.stroke = themeColor;
        if (this.hudRelicCircle) {
          this.hudRelicCircle.setAttribute('fill', themeColor);
        }
        this.hudRelicIcon.style.filter = `drop-shadow(0 0 6px ${themeColor})`;
      }
    }

    // 2. Actualizar corazones y viñeta solo si el estado de salud crítico cambió
    const isCritical = !!(stateManager && stateManager.get('health_critical'));
    if (isCritical !== this._lastCritical) {
      this._lastCritical = isCritical;

      for (let i = 0; i < this.heartElements.length; i++) {
        const heart = this.heartElements[i];
        if (!heart) continue;

        if (isCritical) {
          if (i === 0) {
            heart.setAttribute('class', 'heart-svg filled pulsing');
          } else {
            heart.setAttribute('class', 'heart-svg empty');
          }
        } else {
          heart.setAttribute('class', 'heart-svg filled');
        }
      }

      if (this.vignetteEl) {
        if (isCritical) {
          this.vignetteEl.classList.add('active');
        } else {
          this.vignetteEl.classList.remove('active');
        }
      }
    }
  }

  /**
   * Actualiza la tarjeta flotante de diálogo inmersivo cuando se interactúa con un NPC.
   * @param {import('../core/StateManager.js').StateManager} stateManager
   * @param {number} deltaTime
   */
  updateDialogue(stateManager, deltaTime) {
    if (!this.dialogueCard || !stateManager) return;

    const dialogue = stateManager.get('active_dialogue');
    if (!dialogue) {
      if (!this.dialogueCard.classList.contains('hidden')) {
        this.dialogueCard.classList.add('hidden');
      }
      return;
    }

    dialogue.timer -= deltaTime;
    if (dialogue.timer <= 0) {
      stateManager.set('active_dialogue', null);
      this.dialogueCard.classList.add('hidden');
      return;
    }

    // Mostrar diálogo
    if (this.dialogueSpeaker && this.dialogueSpeaker.textContent !== (dialogue.speaker || 'HABITANTE')) {
      this.dialogueSpeaker.textContent = dialogue.speaker || 'HABITANTE';
    }
    const formattedText = `"${dialogue.text}"`;
    if (this.dialogueText && this.dialogueText.textContent !== formattedText) {
      this.dialogueText.textContent = formattedText;
    }
    this.dialogueCard.classList.remove('hidden');
  }

  /**
   * Actualiza la visibilidad e iluminación de la rueda radial de poderes para PC (Tab).
   * @param {import('../core/InputManager.js').InputManager} inputManager
   */
  updateRadialWheel(inputManager) {
    if (!this.radialWheel || !inputManager) return;

    const isOpen = inputManager.isRadialMenuOpen;
    const selectedIdx = inputManager.radialSelectionIndex;

    if (isOpen) {
      if (!this._lastRadialOpen) {
        this.radialWheel.classList.remove('hidden');
        this._lastRadialOpen = true;
      }

      if (selectedIdx !== this._lastRadialIndex) {
        this._lastRadialIndex = selectedIdx;
        this.radialSectors.forEach((sector, idx) => {
          if (idx === selectedIdx) {
            sector.classList.add('active');
          } else {
            sector.classList.remove('active');
          }
        });
      }
    } else {
      if (this._lastRadialOpen) {
        this.radialWheel.classList.add('hidden');
        this._lastRadialOpen = false;
        this._lastRadialIndex = -1;
      }
    }
  }

  /**
   * Actualiza la visualización y física del Virtual Gamepad.
   * Se muestra ÚNICAMENTE si se detecta un dispositivo móvil/táctil o si se activa el preview.
   * @param {import('../core/InputManager.js').InputManager} inputManager
   * @param {string} equippedPower
   */
  updateVirtualGamepad(inputManager, equippedPower) {
    if (!this.virtualGamepad || !inputManager) return;

    const shouldShow = inputManager.shouldShowTouchControls;

    if (shouldShow !== this._lastTouchShow) {
      this._lastTouchShow = shouldShow;
      if (shouldShow) {
        this.virtualGamepad.classList.remove('hidden');
      } else {
        this.virtualGamepad.classList.add('hidden');
      }
    }

    if (!shouldShow) return;

    // Actualizar posición del joystick thumb solo si cambió significativamente
    if (this.joystickThumb && inputManager.joystickVector) {
      const jx = Math.round(inputManager.joystickVector.x * 28);
      const jy = Math.round(inputManager.joystickVector.y * 28);

      if (jx !== this._lastJoyX || jy !== this._lastJoyY) {
        this._lastJoyX = jx;
        this._lastJoyY = jy;
        this.joystickThumb.style.transform = `translate(${jx}px, ${jy}px)`;
      }
    }

    // Actualizar etiqueta del poder dinámico en el botón de habilidad
    const activeName = (inputManager.hoveredSwipePower || equippedPower).toUpperCase();
    if (this.touchSkillLabel && activeName !== this._lastSkillLabel) {
      this._lastSkillLabel = activeName;
      this.touchSkillLabel.textContent = activeName;
    }
  }

  /**
   * Limpia o desactiva la interfaz en pantalla al pausar o volver al menú.
   */
  clear() {
    this.setGameState('STATE_MENU');
  }

  /**
   * Oculta o muestra elementos del juego según el estado de la partida con dirty-checking.
   * @param {string} gameState - 'STATE_PLAYING', 'STATE_MENU', 'STATE_PAUSED', 'STATE_CINEMATIC'
   */
  setGameState(gameState) {
    if (gameState === this._lastGameState) return;
    this._lastGameState = gameState;

    const isPlaying = gameState === 'STATE_PLAYING';

    if (this.hudContainer) {
      this.hudContainer.style.display = isPlaying ? 'flex' : 'none';
    }
    if (this.btnQuickPause) {
      this.btnQuickPause.style.display = isPlaying ? 'flex' : 'none';
    }

    if (!isPlaying) {
      if (this.dialogueCard) this.dialogueCard.classList.add('hidden');
      if (this.radialWheel) this.radialWheel.classList.add('hidden');
      if (this.virtualGamepad) this.virtualGamepad.classList.add('hidden');
      this._lastTouchShow = false;
      this._lastRadialOpen = false;
    }
  }

  /**
   * Ciclo de actualización general de la UI en DOM Overlay.
   * @param {import('../core/InputManager.js').InputManager} inputManager
   * @param {import('../core/StateManager.js').StateManager} stateManager
   * @param {number} [deltaTime=0.016]
   */
  render(inputManager, stateManager, deltaTime = 0.016) {
    const gameState = stateManager ? stateManager.get('game_state') : 'STATE_PLAYING';
    this.setGameState(gameState);

    if (gameState !== 'STATE_PLAYING') return;

    const equipped = (stateManager && stateManager.get('equipped_power')) || 'Fuego';

    // 1. Actualizar HUD flotante
    this.updateHUD(stateManager, equipped);

    // 2. Actualizar diálogo inmersivo
    this.updateDialogue(stateManager, deltaTime);

    // 3. Actualizar rueda radial de poderes
    this.updateRadialWheel(inputManager);

    // 4. Actualizar gamepad táctil (solo en móvil)
    this.updateVirtualGamepad(inputManager, equipped);
  }
}
