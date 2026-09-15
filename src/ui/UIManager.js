export class UIManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawRadialWheel(inputManager, powers) {
    if (!inputManager.isRadialMenuOpen) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = 100;
    const slots = inputManager.totalRadialSlots;
    const sliceAngle = (2 * Math.PI) / slots;

    this.ctx.save();
    this.ctx.globalAlpha = 0.8;

    for (let i = 0; i < slots; i++) {
      const startAngle = i * sliceAngle - Math.PI / 2 - sliceAngle / 2;
      const endAngle = startAngle + sliceAngle;

      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      this.ctx.closePath();

      // Highlight selected slot
      if (inputManager.radialSelectionIndex === i) {
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.7)'; // Gold highlight
      } else {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      }

      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.stroke();

      // Draw Power Name
      const textAngle = startAngle + sliceAngle / 2;
      const textX = centerX + Math.cos(textAngle) * (radius * 0.6);
      const textY = centerY + Math.sin(textAngle) * (radius * 0.6);
      
      this.ctx.fillStyle = 'white';
      this.ctx.font = '12px Courier New';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      const powerName = powers[i] || `Slot ${i}`;
      this.ctx.fillText(powerName, textX, textY);
    }

    this.ctx.restore();
  }

  render(inputManager, stateManager) {
    this.clear();
    
    // Test powers for UI
    const powers = ["Fuego", "Embestida", "Raíces", "Curación"];
    
    this.drawRadialWheel(inputManager, powers);
    
    // Future: Draw mobile controls here (joystick, etc.) if touch is detected
  }
}
