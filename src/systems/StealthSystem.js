/**
 * @module StealthSystem
 * @description Módulo opcional y compacto de detección, zonas específicas y sospecha gradual (v2.0).
 *
 * Principios de desacoplamiento y optimización:
 * - No importa Player, Enemy, LightManager ni CelSpriteAtlas; opera con escalares y callbacks planos.
 * - Activo globalmente (`enableStealth`) o por zonas delimitadas (`zones`: AABB), sin alterar la postura
 *   baja (`player.isProne` / `lowProfile`) fuera de escena para no interferir con Slide/Dive.
 * - Recicla la distancia al cuadrado `distSq` ya calculada en `Enemy.update()` y el nivel de
 *   iluminación `lightLevel` del frame actual calculado una única vez.
 * - Eventos sonoros (`emitNoise`) disparados bajo demanda (sin polling constante) y renderizado Flyweight
 *   de conos de visión pre-horneados.
 *
 * @author Be a Legend Team
 * @version 2.0.0
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
    this.globalEnabled = this.enabled;
    this.visionRange = options.visionRange ?? 112;
    this.visionHalfAngle = options.visionHalfAngle ?? (Math.PI / 6);
    this.stepRadius = options.stepRadius ?? 62;
    this.sprintRadius = options.sprintRadius ?? 118;
    this.scanInterval = options.scanInterval ?? 0.12;

    /** @type {Array<{x: number, y: number, w?: number, h?: number, width?: number, height?: number}>} Zonas acotadas de sigilo */
    this.zones = [];
    /** @type {number} Escalar de luz del jugador (0.35 - 1.0) reciclado por el bucle principal */
    this.lightLevel = 1.0;
    /** @private Callback opcional Zero-Coupling `(minX, minY, maxX, maxY) => Array<Object>` */
    this._noiseQueryFn = null;
    /** @private Timer para muestrear zonas AABB (~4 Hz en lugar de cada fotograma) */
    this._zoneEvalTimer = 0;
  }

  /**
   * Configura las zonas específicas de sigilo del nivel actual y resetea el modo por defecto.
   * @param {Array<Object>} [zones=[]]
   * @param {boolean} [globalEnabled=false]
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=null]
   * @param {Object|null} [player=null]
   */
  setZones(zones = [], globalEnabled = false, stateManager = null, player = null) {
    this.zones = Array.isArray(zones) ? zones : [];
    this.globalEnabled = Boolean(globalEnabled);
    this._zoneEvalTimer = 0;
    this.setEnabled(this.globalEnabled, stateManager, player);
  }

  /**
   * Registra la función lectora del espacio para pulsos sonoros sin importar SpatialGrid.
   * @param {((minX: number, minY: number, maxX: number, maxY: number) => Array<Object>)|null} fn
   */
  setNoiseQueryFn(fn) {
    this._noiseQueryFn = typeof fn === 'function' ? fn : null;
  }

  /**
   * Actualiza la intensidad lumínica actual sobre el jugador (reciclada desde LightManager en `main.js`).
   * @param {number} lightFactor - Valor normalizado entre 0.35 y 1.0
   */
  setPlayerLightLevel(lightFactor) {
    const val = Number(lightFactor);
    this.lightLevel = Number.isFinite(val) ? Math.max(0.35, Math.min(1.0, val)) : 1.0;
  }

  /**
   * Evalúa si el jugador entró o salió de una zona designada de sigilo sin acoplar con el mapa.
   * @param {number} x
   * @param {number} y
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=null]
   * @param {Object|null} [player=null]
   * @param {number} [dt=0.016]
   */
  evaluateZoneAt(x, y, stateManager = null, player = null, dt = 0.016) {
    if (this.globalEnabled) {
      if (!this.enabled) this.setEnabled(true, stateManager, player);
      return true;
    }
    if (!this.zones || this.zones.length === 0) {
      return this.enabled;
    }

    this._zoneEvalTimer -= dt;
    if (this._zoneEvalTimer > 0) return this.enabled;
    this._zoneEvalTimer = 0.22;

    let inside = false;
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      const zw = z.w ?? z.width ?? 0;
      const zh = z.h ?? z.height ?? 0;
      if (x >= z.x && x <= z.x + zw && y >= z.y && y <= z.y + zh) {
        inside = true;
        break;
      }
    }

    if (inside !== this.enabled) {
      this.setEnabled(inside, stateManager, player);
    }
    return this.enabled;
  }

  /**
   * Activa o archiva la mecánica de sigilo y detección sincronizando estado global y clase CSS del HUD.
   * Conserva `player.isProne` y `player.lowProfile` para que Slide/Dive funcionen fuera de zonas de sigilo.
   * @param {boolean} isEnabled
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=null]
   * @param {Object|null} [player=null]
   */
  setEnabled(isEnabled, stateManager = null, player = null) {
    this.enabled = Boolean(isEnabled);

    if (!this.enabled && player) {
      player.inTallGrass = false;
      player.isStealthHidden = false;
    }

    if (stateManager) {
      if (stateManager.get('stealth_mode_enabled') !== this.enabled) {
        stateManager.set('stealth_mode_enabled', this.enabled);
      }
      if (!this.enabled) {
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
   * Sincroniza la ocultación en grama alta del jugador sin desactivar postura baja fuera de sigilo.
   * @param {Object} player
   * @param {Object|null} foliageSystem
   * @param {import('../core/StateManager.js').StateManager|null} [stateManager=null]
   */
  syncPlayerConcealment(player, foliageSystem, stateManager = null) {
    if (!player) return;

    if (!this.enabled) {
      player.inTallGrass = false;
      player.isStealthHidden = false;
      if (stateManager && stateManager.get('player_is_prone') !== Boolean(player.isProne || player.lowProfile)) {
        stateManager.set('player_is_prone', Boolean(player.isProne || player.lowProfile));
      }
      return;
    }

    if (foliageSystem && typeof foliageSystem.updateInteraction === 'function') {
      foliageSystem.updateInteraction(player, true);
    } else {
      player.isStealthHidden = false;
    }

    if (stateManager) {
      const isLow = Boolean(player.isProne || player.lowProfile);
      if (stateManager.get('player_is_prone') !== isLow) {
        stateManager.set('player_is_prone', isLow);
      }
      if (stateManager.get('player_stealth_hidden') !== player.isStealthHidden) {
        stateManager.set('player_stealth_hidden', player.isStealthHidden);
        stateManager.set('player_is_stealth', player.isStealthHidden);
      }
    }
  }

  /**
   * Emite un pulso sonoro por evento (ej. carrera, slide o golpe fuerte) hacia guardias cercanos.
   * No mantiene arrays ni polls constantes en idle.
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {Array<Object>|null} [candidates=null]
   */
  emitNoise(x, y, radius, candidates = null) {
    if (!this.enabled || radius <= 0) return;

    const list = candidates || (this._noiseQueryFn ? this._noiseQueryFn(x - radius, y - radius, x + radius, y + radius) : null);
    if (!list || list.length === 0) return;

    const rSq = radius * radius;
    const invR = 1 / Math.max(1, radius);

    for (let i = 0; i < list.length; i++) {
      const ent = list[i];
      if (!ent || ent.isDead) continue;
      if (typeof ent.hasTag === 'function' && !ent.hasTag('enemy')) continue;
      if (typeof ent.hasTag === 'function' && ent.hasTag('wave_enemy')) continue;

      const ex = (ent.pos ? ent.pos.x : 0) + (ent.width || 32) * 0.5;
      const ey = (ent.pos ? ent.pos.y : 0) + (ent.height || 32) * 0.5;
      const dx = x - ex;
      const dy = y - ey;
      const dSq = dx * dx + dy * dy;
      if (dSq > rSq) continue;

      const intensity = Math.max(0.2, 1 - Math.sqrt(dSq) * invR);
      ent.suspicion = Math.min(95, (ent.suspicion || 0) + Math.round(52 * intensity));

      if (ent.aiState === 'IDLE' || ent.aiState === 'PATROL') {
        if (typeof ent._faceVector === 'function') {
          ent._faceVector(dx, dy, 1.0);
        }
        if (ent.patrolTarget && typeof ent.patrolTarget.set === 'function') {
          ent.patrolTarget.set(x - 16, y - 16);
          ent.aiState = 'PATROL';
          ent.aiTimer = Math.max(ent.aiTimer || 0, 2.2);
        }
      }
    }
  }

  /**
   * Evalúa sospecha gradual (0-100) y detección reciclando `distSq`, `lowProfile` y `lightLevel`.
   * @param {Object} enemy
   * @param {Object} player
   * @param {number} distSq - Distancia al cuadrado al jugador (reciclada de `Enemy.update`)
   * @param {number} toPlayerX
   * @param {number} toPlayerY
   * @param {Object|null} physics
   * @param {number} [dt=0.016]
   * @param {number} [lightLevel=this.lightLevel]
   * @returns {boolean}
   */
  checkEnemyDetection(enemy, player, distSq, toPlayerX, toPlayerY, physics, dt = 0.016, lightLevel = this.lightLevel) {
    if (!this.enabled || !player || player.health <= 0 || player.isDead) return false;

    // 1. Contacto físico inmediato (<= 24 px) -> Alerta directa
    if (distSq <= 576) {
      enemy.suspicion = 100;
      return true;
    }

    // 2. Ocultamiento en grama alta agachado -> Sospecha decae progresivamente
    if (player.isStealthHidden) {
      enemy.suspicion = Math.max(0, (enemy.suspicion || 0) - 26 * dt);
      return false;
    }

    // 3. Rechazo temprano por alcance visual modulado por perfil bajo e iluminación reciclada
    const lowPosture = Boolean(player.lowProfile || player.isProne);
    const lightScalar = Math.max(0.35, Math.min(1.0, Number(lightLevel) || 1.0));
    const maxVision = enemy.stealthVisionRange || this.visionRange;
    const effectiveRange = maxVision * (lowPosture ? 0.65 : 1.0) * (0.58 + 0.42 * lightScalar);
    const aggroRange = (enemy.config && enemy.config.aggroRange) ? enemy.config.aggroRange : 165;
    const maxCheckDist = (typeof enemy.hasTag === 'function' && enemy.hasTag('wave_enemy'))
      ? aggroRange * 1.4
      : Math.max(effectiveRange, player.isSprinting ? this.sprintRadius : this.stepRadius);

    if (distSq > maxCheckDist * maxCheckDist) {
      enemy.suspicion = Math.max(0, (enemy.suspicion || 0) - 18 * dt);
      return false;
    }

    // 4. Dosificador temporal (~8 Hz) acumulando dt real para sospecha consistente independiente de FPS
    enemy._stealthAccDt = (enemy._stealthAccDt || 0) + dt;
    enemy._stealthScanTimer = (enemy._stealthScanTimer ?? (Math.random() * this.scanInterval)) - dt;
    if (enemy._stealthScanTimer > 0) {
      return false;
    }
    const stepDt = Math.min(0.35, enemy._stealthAccDt);
    enemy._stealthAccDt = 0;
    enemy._stealthScanTimer = this.scanInterval;

    // 5. Filtro sensorial: oleada / sprint ruidoso / pisada erguida / cono de visión frontal
    let triggersSensory = false;
    let instantTrigger = false;
    if (typeof enemy.hasTag === 'function' && enemy.hasTag('wave_enemy') && distSq <= (aggroRange * 1.4) * (aggroRange * 1.4)) {
      triggersSensory = true;
      instantTrigger = true;
    } else if (player.isSprinting && distSq <= this.sprintRadius * this.sprintRadius) {
      triggersSensory = true;
      instantTrigger = true;
    } else if (!lowPosture && distSq <= this.stepRadius * this.stepRadius) {
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

    if (!triggersSensory) {
      enemy.suspicion = Math.max(0, (enemy.suspicion || 0) - 28 * stepDt);
      return false;
    }

    // 6. Línea de visión optimizada solo para enemigos que superan filtro sensorial
    if (physics && typeof physics.hasLineOfSight === 'function') {
      const myCx = enemy.pos.x + enemy.width * 0.5;
      const myCy = enemy.pos.y + enemy.height * 0.5;
      const plCx = player.pos.x + (player.width || 32) * 0.5;
      const plCy = player.pos.y + (player.height || 32) * 0.5;
      if (!physics.hasLineOfSight(myCx, myCy, plCx, plCy)) {
        enemy.suspicion = Math.max(0, (enemy.suspicion || 0) - 24 * stepDt);
        return false;
      }
    }

    if (instantTrigger) {
      enemy.suspicion = 100;
      return true;
    }

    // 7. Acumulación gradual de sospecha (0..100) ponderada por cercanía, luz y postura baja
    const closeness = Math.max(0.35, 1.35 - (Math.sqrt(distSq) / Math.max(40, effectiveRange)));
    const rate = (enemy.stealthSuspicionRate || 165) * closeness * (0.48 + 0.52 * lightScalar) * (lowPosture ? 0.62 : 1.0);
    enemy.suspicion = Math.min(100, (enemy.suspicion || 0) + rate * stepDt);

    return enemy.suspicion >= 100;
  }

  /**
   * Dibuja un cono de visión compacto reciclado vía Flyweight (`getConeSpriteFn`) e indicador de sospecha.
   * Recurre a trazo ligero directo solo si no se inyectó callback de sprites horneados.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} enemy
   * @param {((key: string) => HTMLCanvasElement|null)|null} [getConeSpriteFn=null]
   */
  drawCompactVisionCone(ctx, enemy, getConeSpriteFn = null) {
    if (!this.enabled || !enemy || enemy.isDead || enemy.health <= 0) return;
    if (enemy.aiState !== 'IDLE' && enemy.aiState !== 'PATROL') return;

    const cx = Math.round(enemy.pos.x + enemy.width * 0.5);
    const cy = Math.round(enemy.pos.y + enemy.height * 0.5);
    const sweep = Math.sin((enemy.animClock || 0) * 1.8) * 0.22;
    const angle = Math.atan2(enemy.aimDir.y, enemy.aimDir.x) + sweep;
    const range = enemy.stealthVisionRange || this.visionRange;
    const suspicion = enemy.suspicion || 0;
    const sprite = getConeSpriteFn ? getConeSpriteFn(suspicion >= 35 ? 'cone_alert' : 'cone_patrol') : null;

    if (sprite) {
      const scale = range / 112;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      if (Math.abs(scale - 1.0) > 0.02) {
        ctx.scale(scale, scale);
      }
      ctx.drawImage(sprite, -8, -64);
      ctx.restore();
    } else {
      const halfAngle = enemy.stealthHalfAngle || this.visionHalfAngle;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, range, angle - halfAngle, angle + halfAngle);
      ctx.closePath();
      ctx.fillStyle = suspicion >= 35 ? 'rgba(239, 68, 68, 0.14)' : 'rgba(250, 204, 21, 0.08)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = suspicion >= 35 ? 'rgba(239, 68, 68, 0.38)' : 'rgba(250, 204, 21, 0.24)';
      ctx.stroke();
    }

    // Mini barra/rombo de sospecha sobre la cabeza solo si superó el umbral de atención (>= 18%)
    if (suspicion >= 18 && suspicion < 100) {
      const ratio = suspicion / 100;
      const barW = 16;
      const bx = Math.round(cx - barW * 0.5);
      const by = Math.round(enemy.pos.y - 12);
      ctx.fillStyle = '#0b101d';
      ctx.fillRect(bx - 1, by - 1, barW + 2, 4);
      ctx.fillStyle = suspicion >= 65 ? '#ef4444' : '#facc15';
      ctx.fillRect(bx, by, Math.round(barW * ratio), 2);
    }
  }
}
