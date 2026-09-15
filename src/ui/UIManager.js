/**
 * @module UIManager
 * @description Gestor de interfaz de usuario desacoplado en canvas dedicado.
 * Renderiza la rueda de selección radial de habilidades de la Reliquia (estilo GTA V / Zelda BotW)
 * y consume el estado del jugador de manera reactiva desde el StateManager.
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class UIManager {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas overlay dedicado a la interfaz
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * Limpia el lienzo de la interfaz antes de dibujar el frame actual.
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Dibuja la rueda de selección radial trigonométrica.
   * @param {import('../core/InputManager.js').InputManager} inputManager
   * @param {Array<string>} powers - Lista de nombres de poderes desbloqueados
   */
  drawRadialWheel(inputManager, powers) {
    if (!inputManager.isRadialMenuOpen) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = 110;
    const slots = inputManager.totalRadialSlots;
    const sliceAngle = (2 * Math.PI) / slots;

    this.ctx.save();
    this.ctx.globalAlpha = 0.88;

    for (let i = 0; i < slots; i++) {
      const startAngle = i * sliceAngle - Math.PI / 2 - sliceAngle / 2;
      const endAngle = startAngle + sliceAngle;

      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      this.ctx.closePath();

      // Resaltar el sector activo seleccionado por el vector del ratón
      if (inputManager.radialSelectionIndex === i) {
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.75)'; // Dorado brillante
      } else {
        this.ctx.fillStyle = 'rgba(20, 20, 25, 0.65)';
      }

      this.ctx.fill();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = inputManager.radialSelectionIndex === i ? '#FFF' : 'rgba(255, 255, 255, 0.3)';
      this.ctx.stroke();

      // Dibujar etiqueta del poder
      const textAngle = startAngle + sliceAngle / 2;
      const textX = centerX + Math.cos(textAngle) * (radius * 0.62);
      const textY = centerY + Math.sin(textAngle) * (radius * 0.62);

      this.ctx.fillStyle = inputManager.radialSelectionIndex === i ? '#000' : '#FFF';
      this.ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const powerName = powers[i] || `Ranura ${i + 1}`;
      this.ctx.fillText(powerName, textX, textY);
    }

    // Dibujar núcleo central de la reliquia
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 24, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * STD-08 FIX: Renderizado de la UI obteniendo datos dinámicos desde StateManager.
   * @param {import('../core/InputManager.js').InputManager} inputManager
   * @param {import('../core/StateManager.js').StateManager} stateManager
   */
  render(inputManager, stateManager) {
    this.clear();

    // Obtener poderes desbloqueados desde el StateManager con fallback informativo
    const unlocked = (stateManager && stateManager.get('unlocked_powers')) || [];
    const defaultPowers = ["Fuego", "Embestida", "Raíces", "Curación"];
    const activePowers = unlocked.length > 0 ? unlocked : defaultPowers;

    this.drawRadialWheel(inputManager, activePowers);

    // Indicador sutil de controles si no está abierto el menú radial
    if (!inputManager.isRadialMenuOpen) {
      this.drawHUD(stateManager);
    }
  }

  /**
   * Dibuja información contextual discreta en pantalla (Karma y ayuda rápida).
   * @param {import('../core/StateManager.js').StateManager} stateManager
   */
  drawHUD(stateManager) {
    const karma = (stateManager && stateManager.get('karma_level')) || 0;
    this.ctx.save();
    this.ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Karma: ${karma >= 0 ? '+' : ''}${karma}`, 12, 20);
    this.ctx.fillText(`[WASD]: Moverse | [Espacio]: Interactuar | [Tab / R]: Reliquia`, 12, 36);
    this.ctx.restore();
  }
}
