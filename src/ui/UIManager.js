/**
 * @module UIManager
 * @description Gestor de interfaz de usuario desacoplado en canvas dedicado superior.
 * Renderiza el Virtual Gamepad móvil táctil (Joystick izquierdo, botón de ataque,
 * botón dinámico de habilidad con swipe direccional e icono de pausa),
 * además de la rueda radial para PC y el HUD informativo.
 * @author Be a Legend Team
 * @version 1.3.0
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
   * Renderiza el Virtual Gamepad optimizado para pantallas táctiles y móviles.
   * @param {import('../core/InputManager.js').InputManager} input
   * @param {string} equippedPower - Nombre del poder actualmente equipado
   */
  drawVirtualGamepad(input, equippedPower) {
    const ctx = this.ctx;

    // --- 1. Joystick Izquierdo (Base y Palanca) ---
    const joy = input.joystickConfig;
    ctx.save();

    // Base fija semitransparente
    ctx.beginPath();
    ctx.arc(joy.baseX, joy.baseY, joy.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.stroke();

    // Cruz direccional sutil en la base
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(joy.baseX - 2, joy.baseY - 24, 4, 48);
    ctx.fillRect(joy.baseX - 24, joy.baseY - 2, 48, 4);

    // Palanca móvil (Thumbstick)
    const thumbX = input.joystickThumb.x;
    const thumbY = input.joystickThumb.y;
    ctx.beginPath();
    ctx.arc(thumbX, thumbY, 26, 0, Math.PI * 2);
    ctx.fillStyle = input.joystickVector.lengthSquared() > 0.05 ? 'rgba(56, 189, 248, 0.85)' : 'rgba(203, 213, 225, 0.65)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.restore();

    // --- 2. Botón de Acción / Ataque (Esquina inferior derecha) ---
    const atk = input.attackButtonConfig;
    ctx.save();

    ctx.beginPath();
    ctx.arc(atk.x, atk.y, atk.radius, 0, Math.PI * 2);
    ctx.fillStyle = input.isAttackPressed ? 'rgba(239, 68, 68, 0.85)' : 'rgba(220, 38, 38, 0.55)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = input.isAttackPressed ? '#FEF08A' : 'rgba(255, 255, 255, 0.8)';
    ctx.stroke();

    // Icono / Texto de espada
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ESPADA', atk.x, atk.y - 1);

    ctx.restore();

    // --- 3. Botón Dinámico de Habilidad (Swipe - Núcleo de la Reliquia) ---
    const skl = input.skillButtonConfig;
    ctx.save();

    // Anillo exterior de direcciones de swipe
    ctx.beginPath();
    ctx.arc(skl.x, skl.y, skl.radius + (input.isSkillSwiping ? 18 : 12), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
    ctx.stroke();

    // Indicadores direccionales alrededor del botón
    this._drawSwipeDirectionHints(skl.x, skl.y, input.hoveredSwipePower);

    // Botón central de la Reliquia
    ctx.beginPath();
    ctx.arc(skl.x, skl.y, skl.radius, 0, Math.PI * 2);

    // Gradiente dorado / energía
    const relicGrad = ctx.createRadialGradient(skl.x, skl.y, 2, skl.x, skl.y, skl.radius);
    relicGrad.addColorStop(0, '#fef08a');
    relicGrad.addColorStop(1, '#ca8a04');
    ctx.fillStyle = relicGrad;
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    // Etiqueta del poder equipado o en pre-visualización
    const displayPower = input.hoveredSwipePower || equippedPower || 'Reliquia';
    ctx.fillStyle = '#1e1e24';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayPower.toUpperCase(), skl.x, skl.y);

    // Línea de rastro del swipe si está arrastrando
    if (input.isSkillSwiping && input.skillSwipeVector.length() > 5) {
      ctx.beginPath();
      ctx.moveTo(skl.x, skl.y);
      ctx.lineTo(skl.x + input.skillSwipeVector.x, skl.y + input.skillSwipeVector.y);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(skl.x + input.skillSwipeVector.x, skl.y + input.skillSwipeVector.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fde047';
      ctx.fill();
    }

    ctx.restore();

    // --- 4. Botón de Pausa (Engranaje en esquina superior derecha) ---
    const pse = input.pauseButtonConfig;
    ctx.save();

    ctx.beginPath();
    ctx.arc(pse.x, pse.y, pse.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.stroke();

    // Icono de engranaje ⚙️
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚙️', pse.x, pse.y);

    ctx.restore();
  }

  /**
   * Dibuja los indicadores direccionales de Swipe para la Reliquia.
   * @private
   */
  _drawSwipeDirectionHints(centerX, centerY, activePower) {
    const ctx = this.ctx;
    const distance = 44;

    const directions = [
      { text: '▲ Fuego', x: centerX, y: centerY - distance, power: 'Fuego' },
      { text: '▶ Embestida', x: centerX + distance + 10, y: centerY, power: 'Embestida' },
      { text: '▼ Raíces', x: centerX, y: centerY + distance, power: 'Raíces' },
      { text: '◀ Curación', x: centerX - distance - 10, y: centerY, power: 'Curación' }
    ];

    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < directions.length; i++) {
      const dir = directions[i];
      const isSelected = activePower === dir.power;
      ctx.fillStyle = isSelected ? '#fde047' : 'rgba(255, 255, 255, 0.65)';
      ctx.fillText(dir.text, dir.x, dir.y);
    }
  }

  /**
   * Dibuja la rueda de selección radial trigonométrica para PC (Tab).
   * @param {import('../core/InputManager.js').InputManager} inputManager
   * @param {Array<string>} powers - Lista de nombres de poderes
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

      if (inputManager.radialSelectionIndex === i) {
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
      } else {
        this.ctx.fillStyle = 'rgba(20, 20, 25, 0.7)';
      }

      this.ctx.fill();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = inputManager.radialSelectionIndex === i ? '#FFF' : 'rgba(255, 255, 255, 0.3)';
      this.ctx.stroke();

      const textAngle = startAngle + sliceAngle / 2;
      const textX = centerX + Math.cos(textAngle) * (radius * 0.62);
      const textY = centerY + Math.sin(textAngle) * (radius * 0.62);

      this.ctx.fillStyle = inputManager.radialSelectionIndex === i ? '#000' : '#FFF';
      this.ctx.font = 'bold 12px system-ui, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const powerName = powers[i] || `Ranura ${i + 1}`;
      this.ctx.fillText(powerName, textX, textY);
    }

    // Núcleo
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
   * Renderizado general de la interfaz de usuario.
   * @param {import('../core/InputManager.js').InputManager} inputManager
   * @param {import('../core/StateManager.js').StateManager} stateManager
   */
  render(inputManager, stateManager) {
    this.clear();

    const equipped = (stateManager && stateManager.get('equipped_power')) || 'Fuego';
    const unlocked = (stateManager && stateManager.get('unlocked_powers')) || ["Fuego", "Embestida", "Raíces", "Curación"];

    // 1. Virtual Gamepad táctil (siempre visible en el canvas superior)
    this.drawVirtualGamepad(inputManager, equipped);

    // 2. Menú radial de PC si está abierto
    if (inputManager.isRadialMenuOpen) {
      this.drawRadialWheel(inputManager, unlocked);
    } else {
      // 3. HUD contextual
      this.drawHUD(stateManager, equipped);
    }
  }

  /**
   * Dibuja la barra de estado superior con karma, poder activo y guía de controles.
   * @param {import('../core/StateManager.js').StateManager} stateManager
   * @param {string} equippedPower
   */
  drawHUD(stateManager, equippedPower) {
    const karma = (stateManager && stateManager.get('karma_level')) || 0;
    const ctx = this.ctx;

    ctx.save();
    // Tarjeta superior izquierda
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 230, 48, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.fillText(`Reliquia: ${equippedPower}`, 22, 28);

    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = karma >= 0 ? '#4ade80' : '#f87171';
    ctx.fillText(`Karma: ${karma >= 0 ? '+' : ''}${karma}  |  [WASD / Joystick]`, 22, 45);

    ctx.restore();
  }
}
