import { Vector2 } from '../utils/Vector2.js';

export class InputManager {
  constructor() {
    this.keys = {};
    this.mouse = new Vector2(0, 0);
    this.isRadialMenuOpen = false;
    this.radialSelectionIndex = -1; // -1 significa ninguno
    this.totalRadialSlots = 4; // Ej. Fuego, Embestida, Raíces, Curación

    // Touch Support
    this.touches = [];
    this.swipeVector = new Vector2(0, 0);
    
    this._bindEvents();
  }

  _bindEvents() {
    // Teclado
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Tab') { // Tecla para abrir rueda radial (ejemplo)
        e.preventDefault();
        this.isRadialMenuOpen = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Tab') {
        this.isRadialMenuOpen = false;
      }
    });

    // Ratón
    window.addEventListener('mousemove', (e) => {
      // Offset de canvas se calcularía idealmente desde el DOM, pero asumimos fullscreen/centrado
      this.mouse.set(e.clientX, e.clientY);
      
      if (this.isRadialMenuOpen) {
        this._calculateRadialSelection();
      }
    });

    // Táctil (Esquema base para swipe)
    let touchStartX = 0;
    let touchStartY = 0;

    window.addEventListener('touchstart', (e) => {
      // Guardar todos los toques activos (para joystick virtual futuro)
      this.touches = Array.from(e.touches);
      
      // Simular inicio de arrastre para habilidad
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    });

    window.addEventListener('touchmove', (e) => {
      this.touches = Array.from(e.touches);
      // Actualizar vector de swipe
      this.swipeVector.set(
        e.touches[0].clientX - touchStartX,
        e.touches[0].clientY - touchStartY
      );
    });

    window.addEventListener('touchend', (e) => {
      this.touches = Array.from(e.touches);
      this.swipeVector.set(0, 0); // Resetear al soltar
    });
  }

  /**
   * Calcula el ángulo del ratón respecto al centro de la pantalla
   * y determina qué cuadrante (slot) está seleccionado.
   */
  _calculateRadialSelection() {
    // Asumimos centro de pantalla (podría ser la posición de la ventana)
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // Vector desde el centro hacia el ratón
    const dx = this.mouse.x - centerX;
    const dy = this.mouse.y - centerY;

    // Distancia mínima (zona muerta para no seleccionar nada si está muy al centro)
    const deadZone = 50; 
    if (Math.hypot(dx, dy) < deadZone) {
      this.radialSelectionIndex = -1;
      return;
    }

    // Calcular ángulo en radianes (-PI a PI)
    let angle = Math.atan2(dy, dx);
    
    // Convertir ángulo a positivo (0 a 2PI) empezando desde arriba (desplazamiento de -PI/2)
    // Para que el slot 0 esté arriba.
    angle += Math.PI / 2;
    if (angle < 0) {
      angle += 2 * Math.PI;
    }

    // Dividir el círculo en ranuras
    const sliceSize = (2 * Math.PI) / this.totalRadialSlots;
    
    // Desplazamiento de medio slice para que el slot esté centrado en el eje
    const offsetAngle = (angle + sliceSize / 2) % (2 * Math.PI);
    
    this.radialSelectionIndex = Math.floor(offsetAngle / sliceSize);
  }

  isKeyPressed(code) {
    return !!this.keys[code];
  }

  update() {
    // Para encuestar Gamepads en el futuro
  }
}

