import { Entity } from './Entity.js';

/**
 * @module Enemy
 * @description Entidad enemiga de entrenamiento con afinidad elemental (Fuego, Plantas o Cinético),
 * barra de vida en tiempo real, reacción física al arrastre por embestida, y feedback de efectividad elemental.
 */
export class Enemy extends Entity {
  /**
   * @param {number} x - Posición X
   * @param {number} y - Posición Y
   * @param {string} elementalAffinity - 'plantas' | 'fuego' | 'kinetic'
   * @param {string} name - Nombre descriptivo
   */
  constructor(x, y, elementalAffinity = 'plantas', name = 'Slime Elemental') {
    super(x, y, 30, 30);
    this.elementalAffinity = elementalAffinity;
    this.name = name;

    this.tags.push('enemy');
    this.tags.push('solid');
    this.tags.push(`elem_${elementalAffinity}`);

    this.health = 80;
    this.max_health = 80;

    this.hurtTimer = 0;
    this.floatingText = null;
    this.floatingColor = '#FFFFFF';
    this.floatingTimer = 0;

    this.initialX = x;
    this.initialY = y;
    this.respawnTimer = 0;
    this.isDead = false;

    this.bobPhase = Math.random() * Math.PI * 2;

    // Hitbox precisa para combate y Y-sorting
    this.hitbox = {
      offsetX: 4,
      offsetY: 12,
      width: 22,
      height: 16
    };
    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;
  }

  /**
   * Recibe daño, aplica feedback de impacto y textos flotantes.
   * @param {number} amount
   * @param {Object} attack
   * @param {Object} context
   */
  takeDamage(amount, attack, context) {
    if (this.isDead) return;

    this.health = Math.max(0, this.health - amount);
    this.hurtTimer = 0.22;

    // Determinar texto flotante y color
    const atkElem = attack.element;
    const defElem = this.elementalAffinity;
    const isSuper = (
      (atkElem === 'fuego' && (defElem === 'plantas' || defElem === 'raices' || defElem === 'tierra')) ||
      ((atkElem === 'plantas' || atkElem === 'tierra') && defElem === 'kinetic') ||
      (atkElem === 'kinetic' && defElem === 'fuego')
    );
    const isResist = (
      ((atkElem === 'plantas' || atkElem === 'tierra') && defElem === 'fuego') ||
      (atkElem === 'kinetic' && (defElem === 'plantas' || defElem === 'raices' || defElem === 'tierra')) ||
      (atkElem === 'fuego' && defElem === 'kinetic')
    );

    let label = `-${Math.round(amount)}`;
    if (isSuper) {
      label += ' ¡CRÍTICO!';
      this.floatingColor = '#facc15';
    } else if (isResist) {
      label += ' (Resist)';
      this.floatingColor = '#94a3b8';
    } else {
      this.floatingColor = '#f43f5e';
    }

    this.floatingText = label;
    this.floatingTimer = 0.85;

    // Muerte con respawn automático a los 5 segundos para seguir entrenando
    if (this.health <= 0) {
      this.isDead = true;
      this.respawnTimer = 5.0;
      if (context.vfxRenderer) {
        context.vfxRenderer.spawnImpact('fire_burst', this.pos.x + 15, this.pos.y + 15, { radius: 30, duration: 0.4 });
      }
    }
  }

  /**
   * Actualización lógica por frame.
   * @param {Object} context
   */
  update(context) {
    super.update(context);
    const dt = context.deltaTime || 0.016;

    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.floatingTimer > 0) this.floatingTimer -= dt;

    if (this.isDead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.isDead = false;
        this.health = this.max_health;
        this.pos.set(this.initialX, this.initialY);
      }
      return;
    }

    this.bobPhase += dt * 3.5;

    // Comportamiento pasivo de deambular suave si no está inmovilizado
    const isRooted = this.hasTag('inmovilizado_raices');
    if (!isRooted && this.hurtTimer <= 0) {
      // Suave flotación / oscilación
      this.pos.y += Math.sin(this.bobPhase) * 6 * dt;
    }
  }

  /**
   * Renderizado estilizado con tema elemental, barra de salud y efectos de estado.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (this.isDead) return;

    const { x, y } = this.pos;

    // 1. Sombra elíptica
    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    ctx.beginPath();
    ctx.ellipse(x + 15, y + 27, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Colores base según afinidad elemental
    let bodyColor = '#22c55e'; // Plantas
    let auraColor = '#86efac';
    if (this.elementalAffinity === 'fuego') {
      bodyColor = '#ef4444';
      auraColor = '#fca5a5';
    } else if (this.elementalAffinity === 'kinetic') {
      bodyColor = '#0284c7';
      auraColor = '#7dd3fc';
    }

    // Flash blanco al recibir daño
    if (this.hurtTimer > 0) {
      bodyColor = '#FFFFFF';
      auraColor = '#FFFFFF';
    }

    // 3. Cuerpo del Slime (Gota cute / domo)
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(x + 15, y + 18, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cresta o detalle superior elemental
    ctx.fillStyle = auraColor;
    if (this.elementalAffinity === 'plantas') {
      // Hoja / Brote verde
      ctx.beginPath();
      ctx.ellipse(x + 15, y + 7, 3, 5, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.elementalAffinity === 'fuego') {
      // Llama encendida
      ctx.beginPath();
      ctx.arc(x + 15, y + 8, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.elementalAffinity === 'kinetic') {
      // Cristal azul
      ctx.fillRect(x + 13, y + 6, 4, 5);
    }

    // 4. Ojos tiernos
    ctx.fillStyle = this.hurtTimer > 0 ? '#b91c1c' : '#0f172a';
    ctx.fillRect(x + 10, y + 15, 3, 4);
    ctx.fillRect(x + 17, y + 15, 3, 4);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 10, y + 15, 1, 2);
    ctx.fillRect(x + 17, y + 15, 1, 2);

    // 5. Jaula de Raíces si está inmovilizado (Prisión Selvática)
    if (this.hasTag('inmovilizado_raices')) {
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 26);
      ctx.lineTo(x + 10, y + 10);
      ctx.lineTo(x + 16, y + 27);
      ctx.lineTo(x + 22, y + 12);
      ctx.lineTo(x + 26, y + 26);
      ctx.stroke();

      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(x + 10, y + 10, 3, 0, Math.PI * 2);
      ctx.arc(x + 22, y + 12, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Barra de Salud Superior
    const barW = 26;
    const barH = 3.5;
    const barX = x + 15 - barW / 2;
    const barY = y - 4;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    const healthPct = Math.max(0, this.health / this.max_health);
    ctx.fillStyle = healthPct > 0.4 ? '#22c55e' : '#ef4444';
    ctx.fillRect(barX, barY, barW * healthPct, barH);
  }
}
