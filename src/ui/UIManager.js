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
 * - Menús y modales con diseño Glassmorphism translúcido y bordes redondeados suaves.
 * @author Be a Legend Team
 * @version 2.0.0
 */
export class UIManager {
  constructor() {
    // --- Cache de Elementos del DOM Overlay ---
    this.overlayEl = document.getElementById('ui-overlay');
    this.vignetteEl = document.getElementById('vignette-overlay');

    // 1. HUD Superior Flotante
    this.hudContainer = document.getElementById('hud-container');
    this.hudRelicIcon = document.getElementById('hud-relic-icon');
    this.hudPowerName = document.getElementById('hud-power-name');
    this.heartElements = [
      document.getElementById('heart-1'),
      document.getElementById('heart-2'),
      document.getElementById('heart-3')
    ];

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
  }

  /**
   * Actualiza el HUD flotante minimalista: gema de la Reliquia y corazones vectoriales SVG.
   * Cero variables numéricas o métricas internas ('Show, Don't Tell').
   * @param {import('../core/StateManager.js').StateManager} stateManager
   * @param {string} equippedPower
   */
  updateHUD(stateManager, equippedPower) {
    if (!this.hudContainer) return;

    // Actualizar nombre y color de la Reliquia
    if (this.hudPowerName) {
      this.hudPowerName.textContent = equippedPower.toUpperCase();
    }

    const themeColor = this.powerColors[equippedPower] || '#facc15';
    if (this.hudRelicIcon) {
      this.hudRelicIcon.style.stroke = themeColor;
      const innerCircle = this.hudRelicIcon.querySelector('circle');
      if (innerCircle) innerCircle.setAttribute('fill', themeColor);
      this.hudRelicIcon.style.filter = `drop-shadow(0 0 6px ${themeColor})`;
    }

    // Actualizar corazones según estado de salud
    const isCritical = !!(stateManager && stateManager.get('health_critical'));

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

    // Viñeta de peligro pulsante
    if (this.vignetteEl) {
      if (isCritical) {
        this.vignetteEl.classList.add('active');
      } else {
        this.vignetteEl.classList.remove('active');
      }
    }
  }

  /**
   * Actualiza la tarjeta flotante de diálogo inmersivo cuando se interactúa con un NPC.
   * Permite que el jugador descubra el impacto de sus acciones sin ver números.
   * @param {import('../core/StateManager.js').StateManager} stateManager
   * @param {number} deltaTime
   */
  updateDialogue(stateManager, deltaTime) {
    if (!this.dialogueCard || !stateManager) return;

    const dialogue = stateManager.get('active_dialogue');
    if (!dialogue) {
      this.dialogueCard.classList.add('hidden');
      return;
    }

    dialogue.timer -= deltaTime;
    if (dialogue.timer <= 0) {
      stateManager.set('active_dialogue', null);
      this.dialogueCard.classList.add('hidden');
      return;
    }

    // Mostrar diálogo
    if (this.dialogueSpeaker) {
      this.dialogueSpeaker.textContent = dialogue.speaker || 'HABITANTE';
    }
    if (this.dialogueText) {
      this.dialogueText.textContent = `"${dialogue.text}"`;
    }
    this.dialogueCard.classList.remove('hidden');
  }

  /**
   * Actualiza la visibilidad e iluminación de la rueda radial de poderes para PC (Tab).
   * @param {import('../core/InputManager.js').InputManager} inputManager
   */
  updateRadialWheel(inputManager) {
    if (!this.radialWheel || !inputManager) return;

    if (inputManager.isRadialMenuOpen) {
      this.radialWheel.classList.remove('hidden');

      const selectedIdx = inputManager.radialSelectionIndex;
      this.radialSectors.forEach((sector, idx) => {
        if (idx === selectedIdx) {
          sector.classList.add('active');
        } else {
          sector.classList.remove('active');
        }
      });
    } else {
      this.radialWheel.classList.add('hidden');
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

    if (inputManager.shouldShowTouchControls) {
      this.virtualGamepad.classList.remove('hidden');

      // Actualizar posición del joystick thumb
      if (this.joystickThumb && inputManager.joystickVector) {
        const maxOffset = 28;
        const offsetX = inputManager.joystickVector.x * maxOffset;
        const offsetY = inputManager.joystickVector.y * maxOffset;
        this.joystickThumb.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      }

      // Actualizar etiqueta del poder dinámico en el botón de habilidad
      if (this.touchSkillLabel) {
        const activeName = inputManager.hoveredSwipePower || equippedPower;
        this.touchSkillLabel.textContent = activeName.toUpperCase();
      }
    } else {
      this.virtualGamepad.classList.add('hidden');
    }
  }

  /**
   * Limpia o desactiva la interfaz en pantalla al pausar o volver al menú.
   */
  clear() {
    this.setGameState('STATE_MENU');
  }

  /**
   * Oculta o muestra elementos del juego según el estado de la partida.
   * @param {string} gameState - 'STATE_PLAYING', 'STATE_MENU', 'STATE_PAUSED'
   */
  setGameState(gameState) {
    const isPlaying = gameState === 'STATE_PLAYING';

    if (this.hudContainer) {
      this.hudContainer.style.display = isPlaying ? 'flex' : 'none';
    }
    const btnQuickPause = document.getElementById('btn-quick-pause');
    if (btnQuickPause) {
      btnQuickPause.style.display = isPlaying ? 'flex' : 'none';
    }

    if (!isPlaying) {
      if (this.dialogueCard) this.dialogueCard.classList.add('hidden');
      if (this.radialWheel) this.radialWheel.classList.add('hidden');
      if (this.virtualGamepad) this.virtualGamepad.classList.add('hidden');
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
