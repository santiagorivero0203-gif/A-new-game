/**
 * @module StealthSystem
 * @description Módulo modular y compacto de Detección Táctica y Sigilo para 'Be a Legend'.
 *
 * Arquitectura escalable (desactivada por defecto en gameplay estándar):
 * - Permanece en estado inactivo (`enabled = false`) durante la exploración y el combate normal
 *   para garantizar 0 coste de CPU/GPU en renderizado de conos, trazado de línea de visión y UI.
 * - Diseñado para activarse exclusivamente en secciones o niveles puntuales de sigilo mediante
 *   `levelData.enableStealth = true` o `stealthSystem.setEnabled(true, stateManager)`.
 * - Cuando se activa, emplea un cono óptico reducido (`112 px`, `60°` de apertura), muestreo
 *   dosificado por intervalos y rechazo temprano Zero-GC para mantener fluidez a 60/120 FPS.
 *
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class StealthSystem {
  /**
   * @param {Object} [options]
   * @param {boolean} [options.enabled=false] - Si la mecánica inicia activa.
   * @param {number} [options.visionRange=112] - Alcance compacto del cono óptico en píxeles.
   * @param {number} [options.visionHalfAngle=Math.PI/6] - Semi-apertura angular (30° -> cono total 60°).
   * @param {number} [options.stepRadius=62] - Radio de detección cercana de pisadas erguidas.
   * @param {number} [options.sprintRadius=118] - Radio de alerta sonora al esprintar.
   * @param {number} [options.scanInterval=0.12] - Intervalo de evaluación táctica en segundos (~8 Hz).
   */
  constructor(options = {}) {
    this.enabled = Boolean(options.enabled);
    this.visionRange = options.visionRange ?? 112;
    this.visionHalfAngle = options.visionHalfAngle ?? (Math.PI / 6);
    this.stepRadius = options.stepRadius ?? 62;
    this.sprintRadius = options.sprintRadius ?? 118;
    this.scanInterval = options.scanInterval ?? 0.12;
  }

  /**
   * Activa o archiva la mecánica de sigilo y detección sincronizando estado global y clase CSS del HUD.
   * @param {boolean} isEnabled
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=null]
   * @param {import('../entities/Player.js').Player|null} [player=null]
   */
  setEnabled(isEnabled, stateManager = null, player = null) {
    this.enabled = Boolean(isEnabled);

    if (!this.enabled && player) {
      player.isProne = false;
      player.inTallGrass = false;
      player.isStealthHidden = false;
    }

    if (stateManager) {
      if (stateManager.get('stealth_mode_enabled') !== this.enabled) {
        stateManager.set('stealth_mode_enabled', this.enabled);
      }
      if (!this.enabled) {
        if (stateManager.get('player_is_prone')) stateManager.set('player_is_prone', false);
        if (stateManager.get('player_stealth_hidden')) stateManager.set('player_stealth_hidden', false);
        if (stateManager.get('player_is_stealth')) stateManager.set('player_is_stealth', false);
        if (stateManager.get('threat_level') !== 'calm') stateManager.set('threat_level', 'calm');
      }
    }

    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('stealth-mode-active', this.enabled);
    }
  }

  /**
   * Sincroniza la ocultación en grama alta del jugador solo cuando el sistema de sigilo está activo.
   * @param {import('../entities/Player.js').Player} player
   * @param {import('../world/FoliageSystem.js').FoliageSystem|null} foliageSystem
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=null]
   */
  syncPlayerConcealment(player, foliageSystem, stateManager = null) {
    if (!player) return;

    if (!this.enabled) {
      player.isProne = false;
      player.inTallGrass = false;
      player.isStealthHidden = false;
      return;
    }

    if (foliageSystem && typeof foliageSystem.updateInteraction === 'function') {
      foliageSystem.updateInteraction(player, true);
    } else {
      player.isStealthHidden = false;
    }

    if (stateManager) {
      if (stateManager.get('player_is_prone') !== player.isProne) {
        stateManager.set('player_is_prone', player.isProne);
      }
      if (stateManager.get('player_stealth_hidden') !== player.isStealthHidden) {
        stateManager.set('player_stealth_hidden', player.isStealthHidden);
        stateManager.set('player_is_stealth', player.isStealthHidden);
      }
    }
  }

  /**
   * Evalúa si un enemigo detecta al jugador bajo reglas compactas de sigilo y línea de visión.
   * Utiliza distancias al cuadrado y muestreo dosificado para evitar sobrecargar la CPU.
   * @param {import('../entities/Enemy.js').Enemy} enemy
   * @param {import('../entities/Player.js').Player} player
   * @param {number} distSq - Distancia al cuadrado al jugador
   * @param {number} toPlayerX
   * @param {number} toPlayerY
   * @param {import('./PhysicsSystem.js').PhysicsSystem|null} physics
   * @param {number} dt
   * @returns {boolean}
   */
  checkEnemyDetection(enemy, player, distSq, toPlayerX, toPlayerY, physics, dt = 0.016) {
    if (!this.enabled || !player || player.health <= 0 || player.isDead) return false;

    // 1. Contacto físico inmediato (<= 24 px)
    if (distSq <= 576) return true;

    // 2. Ocultamiento en grama alta agachado
    if (player.isStealthHidden) return false;

    // 3. Rechazo temprano por alcance máximo antes de ángulos o trazado de línea de visión
    const maxVision = enemy.stealthVisionRange || this.visionRange;
    const effectiveRange = player.isProne ? maxVision * 0.68 : maxVision;
    const aggroRange = (enemy.config && enemy.config.aggroRange) ? enemy.config.aggroRange : 165;
    const maxCheckDist = enemy.hasTag('wave_enemy')
      ? aggroRange * 1.4
      : Math.max(effectiveRange, player.isSprinting ? this.sprintRadius : this.stepRadius);

    if (distSq > maxCheckDist * maxCheckDist) {
      return false;
    }

    // 4. Dosificador temporal por enemigo (~8 Hz) cuando está en rango cercano/medio
    enemy._stealthScanTimer = (enemy._stealthScanTimer ?? (Math.random() * this.scanInterval)) - dt;
    if (enemy._stealthScanTimer > 0) {
      return false;
    }
    enemy._stealthScanTimer = this.scanInterval;

    // 5. Verificar si está dentro del radio auditivo o dentro del cono angular antes de gastar LOS
    let triggersSensory = false;
    if (enemy.hasTag('wave_enemy') && distSq <= (aggroRange * 1.4) * (aggroRange * 1.4)) {
      triggersSensory = true;
    } else if (player.isSprinting && distSq <= this.sprintRadius * this.sprintRadius) {
      triggersSensory = true;
    } else if (!player.isProne && distSq <= this.stepRadius * this.stepRadius) {
      triggersSensory = true;
    } else if (distSq <= effectiveRange * effectiveRange) {
      const baseAngle = Math.atan2(enemy.aimDir.y, enemy.aimDir.x);
      const sweep = (enemy.aiState === 'PATROL' || enemy.aiState === 'IDLE')
        ? Math.sin((enemy.animClock || 0) * 1.8) * 0.22
        : 0;
      const angleToPlayer = Math.atan2(toPlayerY, toPlayerX);
      let diff = angleToPlayer - (baseAngle + sweep);
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= (enemy.stealthHalfAngle || this.visionHalfAngle)) {
        triggersSensory = true;
      }
    }

    if (!triggersSensory) return false;

    // 6. Línea de visión optimizada solo para enemigos que realmente superaron filtro sensorial
    if (!physics || typeof physics.hasLineOfSight !== 'function') return true;
    const myCx = enemy.pos.x + enemy.width * 0.5;
    const myCy = enemy.pos.y + enemy.height * 0.5;
    const plCx = player.pos.x + (player.width || 32) * 0.5;
    const plCy = player.pos.y + (player.height || 32) * 0.5;
    return physics.hasLineOfSight(myCx, myCy, plCx, plCy);
  }

  /**
   * Dibuja un cono de visión compacto y ligero únicamente cuando la mecánica está activa.
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../entities/Enemy.js').Enemy} enemy
   */
  drawCompactVisionCone(ctx, enemy) {
    if (!this.enabled || !enemy || enemy.isDead || enemy.health <= 0) return;
    if (enemy.aiState !== 'IDLE' && enemy.aiState !== 'PATROL') return;

    const cx = Math.round(enemy.pos.x + enemy.width * 0.5);
    const cy = Math.round(enemy.pos.y + enemy.height * 0.5);
    const sweep = Math.sin((enemy.animClock || 0) * 1.8) * 0.22;
    const angle = Math.atan2(enemy.aimDir.y, enemy.aimDir.x) + sweep;
    const halfAngle = enemy.stealthHalfAngle || this.visionHalfAngle;
    const range = enemy.stealthVisionRange || this.visionRange;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, range, angle - halfAngle, angle + halfAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.24)';
    ctx.stroke();
  }
}

