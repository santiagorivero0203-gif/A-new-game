/**
 * @module ProjectileSystem
 * @description Sistema autónomo con Object Pool plano (Zero-GC) para gestionar decenas o cientos
 * de proyectiles simultáneos y renderizarlos en un único lote gráfico (*Sprite Batching*).
 *
 * Desacoplamiento estricto:
 * - No importa Player, Enemy, Tilemap, SpatialGrid ni VFXRenderer.
 * - Opera mediante datos planos y callbacks opcionales inyectados por quien orqueste la escena.
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class ProjectileSystem {
  /**
   * @param {number} [maxProjectiles=192] - Capacidad máxima simultánea del pool plano
   */
  constructor(maxProjectiles = 192) {
    this.maxProjectiles = maxProjectiles;
    /** @type {Array<Object>} Proyectiles activos actualmente */
    this.active = [];
    /** @private Pool reutilizable de ranuras planas pre-formadas */
    this._freePool = [];
    this._frameTick = 0;
  }

  /**
   * Libera todos los proyectiles activos devolviendo sus ranuras al pool (ej. cambio de mundo).
   */
  clear() {
    for (let i = this.active.length - 1; i >= 0; i--) {
      this._releaseAt(i);
    }
  }

  /**
   * Obtiene o crea una ranura reutilizable evitando alocar closures ni `new Set()` por disparo.
   * @private
   */
  _acquireSlot() {
    if (this._freePool.length > 0) {
      return this._freePool.pop();
    }
    return {
      active: false,
      owner: null,
      type: 'weak',
      element: 'fuego',
      spriteKey: 'fire_orb',
      isProjectile: true,
      isReflected: false,
      isSideOrb: false,
      isBladeWave: false,
      isFriendly: true,
      isFriendlySynergy: false,
      isPerfectTempo: false,
      reflectable: false,
      destroyOnHit: true,
      altitude: 'high', // 'high' (esquivable con Slide/Dive) | 'low' (rasante)
      x: 0,
      y: 0,
      dx: 1,
      dy: 0,
      speed: 240,
      aimAngle: 0,
      radius: 10,
      damage: 16,
      postureDamage: 20,
      duration: 1.0,
      maxDuration: 1.0,
      knockbackForce: 0,
      applyEffect: null,
      _justReflected: false,
      _evadedLow: false,
      _recentHits: [],
      hitbox: { x: 0, y: 0, width: 20, height: 20 }
    };
  }

  /**
   * Devuelve una ranura al pool en O(1) mediante swap-and-pop.
   * @private
   */
  _releaseAt(index) {
    const slot = this.active[index];
    if (!slot) return;
    slot.active = false;
    slot.owner = null;
    slot.applyEffect = null;
    slot._recentHits.length = 0;
    this._freePool.push(slot);

    const last = this.active.length - 1;
    if (index !== last) {
      this.active[index] = this.active[last];
    }
    this.active.pop();
  }

  /**
   * Emite un nuevo proyectil reutilizando el pool Zero-GC.
   * @param {Object} cfg - Parámetros planos del proyectil
   * @returns {Object|null} Ranura activa (o null si alcanzó `maxProjectiles`)
   */
  spawn(cfg) {
    if (!cfg || this.active.length >= this.maxProjectiles) return null;

    const p = this._acquireSlot();
    p.active = true;
    p.owner = cfg.owner || null;
    p.type = cfg.type || 'projectile';
    p.element = cfg.element || 'fuego';
    p.spriteKey = cfg.spriteKey || (
      cfg.isBladeWave ? 'blade_wave'
        : cfg.isReflected ? 'reflected_gold'
          : (cfg.isFriendly === false && p.element === 'fuego') ? 'enemy_fire_orb'
            : (p.element === 'plantas' || p.element === 'tierra') ? 'poison_orb'
              : p.element === 'kinetic' ? 'kinetic_bolt'
                : 'fire_orb'
    );
    p.isProjectile = true;
    p.isReflected = Boolean(cfg.isReflected);
    p.isSideOrb = Boolean(cfg.isSideOrb);
    p.isBladeWave = Boolean(cfg.isBladeWave);
    p.isFriendly = cfg.isFriendly !== undefined ? Boolean(cfg.isFriendly) : !(p.owner && p.owner.tags && p.owner.tags.includes('enemy'));
    p.isFriendlySynergy = Boolean(cfg.isFriendlySynergy);
    p.isPerfectTempo = Boolean(cfg.isPerfectTempo);
    p.reflectable = cfg.reflectable !== undefined ? Boolean(cfg.reflectable) : !p.isFriendly;
    p.destroyOnHit = cfg.destroyOnHit !== undefined ? Boolean(cfg.destroyOnHit) : true;
    p.altitude = cfg.altitude || 'high';
    p.x = cfg.x || 0;
    p.y = cfg.y || 0;
    p.dx = cfg.dx ?? 1;
    p.dy = cfg.dy ?? 0;
    p.speed = cfg.speed || 240;
    p.aimAngle = cfg.aimAngle !== undefined ? cfg.aimAngle : Math.atan2(p.dy, p.dx);
    p.radius = cfg.radius || (p.isBladeWave ? 16 : 10);
    p.damage = cfg.damage || 16;
    p.postureDamage = cfg.postureDamage || 20;
    p.duration = cfg.duration || 1.0;
    p.maxDuration = p.duration;
    p.knockbackForce = cfg.knockbackForce || 0;
    p.applyEffect = cfg.applyEffect || null;
    p._justReflected = false;
    p._evadedLow = false;
    p._recentHits.length = 0;

    const size = p.radius * 2;
    p.hitbox.x = p.x - p.radius;
    p.hitbox.y = p.y - p.radius;
    p.hitbox.width = size;
    p.hitbox.height = size;

    this.active.push(p);
    return p;
  }

  /**
   * Actualiza todos los proyectiles activos, evalúa colisiones y gestiona evasiones bajas (`lowProfile`).
   * No depende directamente de ningún módulo externo: recibe callbacks simples.
   * @param {number} dt
   * @param {Object} hooks
   * @param {(x: number, y: number) => boolean} [hooks.isTileBlockedFn] - Comprueba si choca contra acantilado/muro
   * @param {(minX: number, minY: number, maxX: number, maxY: number) => Array<Object>} [hooks.queryTargetsFn]
   * @param {Object|null} [hooks.playerTarget=null] - Referencia directa para proyectiles hostiles O(1)
   * @param {(slot: Object, target: Object) => void} [hooks.onHitFn]
   * @param {(slot: Object, prop: Object) => void} [hooks.onHitPropFn]
   * @param {(target: Object, slot: Object) => void} [hooks.onLowEvadeFn]
   * @param {(slot: Object) => void} [hooks.onTrailTickFn]
   */
  update(dt, hooks = {}) {
    if (this.active.length === 0) return;
    this._frameTick++;

    const {
      isTileBlockedFn,
      queryTargetsFn,
      playerTarget,
      onHitFn,
      onHitPropFn,
      onLowEvadeFn,
      onTrailTickFn
    } = hooks;

    const denseSwarm = this.active.length > 10;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.duration -= dt;
      if (p.duration <= 0) {
        this._releaseAt(i);
        continue;
      }

      p.x += p.dx * p.speed * dt;
      p.y += p.dy * p.speed * dt;
      p.hitbox.x = p.x - p.radius;
      p.hitbox.y = p.y - p.radius;

      // Emisión dosificada de partículas cuando hay enjambres en pantalla
      if (onTrailTickFn && (!denseSwarm || ((i + this._frameTick) & 3) === 0)) {
        onTrailTickFn(p);
      }

      if (isTileBlockedFn && isTileBlockedFn(p.x, p.y)) {
        this._releaseAt(i);
        continue;
      }

      // 1. Proyectiles hostiles evalúan primero al jugador directo en O(1) (sin consultar rejilla si no perforan props)
      if (!p.isFriendly && !p.isReflected && playerTarget && !playerTarget.isDead) {
        const hb = typeof playerTarget.getHitbox === 'function' ? playerTarget.getHitbox() : playerTarget;
        if (
          hb &&
          p.hitbox.x < hb.x + hb.width &&
          p.hitbox.x + p.hitbox.width > hb.x &&
          p.hitbox.y < hb.y + hb.height &&
          p.hitbox.y + p.hitbox.height > hb.y
        ) {
          // Sinergia Slide / Dive: proyectiles altos pasan por encima cuando `lowProfile === true`
          if (p.altitude === 'high' && playerTarget.lowProfile && playerTarget.fsmState !== 'STATE_DEFEND') {
            if (!p._evadedLow) {
              p._evadedLow = true;
              if (onLowEvadeFn) onLowEvadeFn(playerTarget, p);
            }
            continue;
          }

          if (onHitFn) onHitFn(p, playerTarget);
          if (p.isReflected) {
            // El Parry reflejó este mismo slot en caliente: actualizar facción y sprite sin re-alocar
            p.isFriendly = true;
            p.spriteKey = 'reflected_gold';
            p._justReflected = false;
            continue;
          }
          if (p.destroyOnHit) {
            this._releaseAt(i);
            continue;
          }
        }
        continue;
      }

      // 2. Proyectiles aliados o reflejados consultan candidatos cercanos mediante callback
      if (!queryTargetsFn) continue;
      const candidates = queryTargetsFn(
        p.hitbox.x - 8,
        p.hitbox.y - 8,
        p.hitbox.x + p.hitbox.width + 8,
        p.hitbox.y + p.hitbox.height + 8
      );
      if (!candidates || candidates.length === 0) continue;

      let destroyed = false;
      for (let c = 0; c < candidates.length; c++) {
        const ent = candidates[c];
        if (!ent || ent.isDead || ent === p.owner) continue;
        const isEnemy = typeof ent.hasTag === 'function' ? ent.hasTag('enemy') : false;
        const isProp = typeof ent.hasTag === 'function' ? ent.hasTag('destructible_prop') : false;
        if (!isEnemy && !isProp) continue;

        if (!p.destroyOnHit && p._recentHits.indexOf(ent) !== -1) continue;

        const hb = typeof ent.getHitbox === 'function' ? ent.getHitbox() : ent;
        if (
          !hb ||
          p.hitbox.x >= hb.x + hb.width ||
          p.hitbox.x + p.hitbox.width <= hb.x ||
          p.hitbox.y >= hb.y + hb.height ||
          p.hitbox.y + p.hitbox.height <= hb.y
        ) {
          continue;
        }

        if (!p.destroyOnHit && p._recentHits.length < 16) {
          p._recentHits.push(ent);
        }

        if (isProp) {
          if (onHitPropFn) onHitPropFn(p, ent);
        } else if (onHitFn) {
          onHitFn(p, ent);
        }

        if (p.destroyOnHit) {
          this._releaseAt(i);
          destroyed = true;
          break;
        }
      }
      if (destroyed) continue;
    }
  }

  /**
   * Renderiza todos los proyectiles visibles dentro de cámara en un único lote (`save/restore` único).
   * @param {CanvasRenderingContext2D} ctx
   * @param {{minX: number, minY: number, maxX: number, maxY: number}|null} visibleBounds
   * @param {(spriteKey: string) => HTMLCanvasElement|null} getSpriteFn
   */
  render(ctx, visibleBounds, getSpriteFn) {
    const count = this.active.length;
    if (count === 0 || !ctx || !getSpriteFn) return;

    const minX = visibleBounds ? visibleBounds.minX - 28 : -Infinity;
    const maxX = visibleBounds ? visibleBounds.maxX + 28 : Infinity;
    const minY = visibleBounds ? visibleBounds.minY - 28 : -Infinity;
    const maxY = visibleBounds ? visibleBounds.maxY + 28 : Infinity;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < count; i++) {
      const p = this.active[i];
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;

      const sprite = getSpriteFn(p.spriteKey);
      if (!sprite) continue;

      if (p.isBladeWave) {
        ctx.save();
        ctx.translate(Math.round(p.x), Math.round(p.y));
        ctx.rotate(p.aimAngle);
        ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);
        ctx.restore();
      } else {
        const scale = p.isSideOrb ? 0.84 : 1.0;
        const w = Math.round(sprite.width * scale);
        const h = Math.round(sprite.height * scale);
        ctx.drawImage(sprite, Math.round(p.x - w * 0.5), Math.round(p.y - h * 0.5), w, h);
      }
    }

    ctx.restore();
  }
}

