import { Enemy } from '../entities/Enemy.js';
import { Vector2 } from '../utils/Vector2.js';

/**
 * @module WaveManager
 * @description Gestor integral de hordas y oleadas enemigas progresivas para 'Be a Legend'.
 * Diseñado específicamente para poner a prueba y calibrar todas las mecánicas del juego:
 * - Sabuesos (Swarmers): Barridos en área, control de multitudes y Dash-Strikes.
 * - Artilleros (Ranged): Desvío de proyectiles con Parry Perfecto e invulnerabilidad en esquivas.
 * - Tanques con Escudo (Pavés): Ruptura e incineración permanente de escudos con Fuego.
 * - Duelistas (High-Tempo): Cancelación de animaciones, ritmo AAA y contraataque.
 * - Horda Mixta de Élite: Sinergias elementales cruzadas y combate multidireccional 360°.
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class WaveManager {
  /**
   * @param {import('../entities/EntityManager.js').EntityManager} entityManager
   * @param {import('../core/StateManager.js').StateManager} stateManager
   */
  constructor(entityManager, stateManager) {
    this.entityManager = entityManager;
    this.stateManager = stateManager;

    /** @type {number} Índice de la oleada actual (1-based) */
    this.currentWaveIndex = 0;

    /** @type {'IDLE'|'SPAWNING'|'ACTIVE'|'INTERMISSION'|'VICTORY'} Estado de la horda */
    this.state = 'IDLE';

    /** @type {number} Temporizador de transición o cuenta regresiva */
    this.timer = 0;

    /** @type {Array<import('../entities/Enemy.js').Enemy>} Enemigos pertenecientes a la oleada activa */
    this.activeWaveEnemies = [];

    /** @type {number} Total de enemigos generados en la oleada actual */
    this.totalWaveEnemies = 0;

    /** @type {Array<{name: string, title: string, subtitle: string, reward: number, enemies: Array<Object>}>} */
    this.waveConfigs = [
      // Oleada 1: Sabuesos Rápidos (Prueba de barrido en área y esquiva)
      {
        waveNumber: 1,
        title: 'OLEADA 1: MANADA DEL BOSQUE HENDIDO',
        subtitle: 'Enjambre de Sabuesos de Zarzas • Pon a prueba tus Barridos y Dash-Strike',
        reward: 4,
        enemies: [
          { archetype: 'hound', element: 'plantas', name: 'Sabueso de Zarzas', x: 430, y: 530 },
          { archetype: 'hound', element: 'plantas', name: 'Sabueso de Zarzas', x: 810, y: 530 },
          { archetype: 'hound', element: 'plantas', name: 'Sabueso Alfa', x: 620, y: 760 },
          { archetype: 'hound', element: 'plantas', name: 'Sabueso Acechador', x: 540, y: 455 }
        ]
      },
      // Oleada 2: Artillería de Distancia (Prueba de desvío con Parry Dorado y aproximación)
      {
        waveNumber: 2,
        title: 'OLEADA 2: BATERÍA DE ESPORAS Y BRASAS',
        subtitle: 'Artilleros a distancia • Desvía sus proyectiles teledirigidos con Parry Perfecto',
        reward: 6,
        enemies: [
          { archetype: 'artillery', element: 'plantas', name: 'Esporífero Artillero', x: 460, y: 465 },
          { archetype: 'artillery', element: 'fuego', name: 'Artillero de Brasa', x: 790, y: 465 },
          { archetype: 'artillery', element: 'plantas', name: 'Esporífero Mayor', x: 624, y: 760 },
          { archetype: 'hound', element: 'plantas', name: 'Sabueso Protector', x: 500, y: 640 }
        ]
      },
      // Oleada 3: Falange con Escudos de Madera (Prueba de quema con Fuego y flanqueo)
      {
        waveNumber: 3,
        title: 'OLEADA 3: FALANGE CORTEZASOL',
        subtitle: 'Centinelas Pavés con Escudo de Roble • ¡Incinera sus defensas con Ceniza Ígnea!',
        reward: 8,
        enemies: [
          { archetype: 'tank', element: 'plantas', name: 'Centinela Pavés', x: 510, y: 505, hasWoodenShield: true },
          { archetype: 'tank', element: 'plantas', name: 'Centinela Blindado', x: 740, y: 505, hasWoodenShield: true },
          { archetype: 'hound', element: 'plantas', name: 'Sabueso de Apoyo', x: 440, y: 700 },
          { archetype: 'hound', element: 'plantas', name: 'Sabueso de Apoyo', x: 800, y: 700 }
        ]
      },
      // Oleada 4: Duelo de Reflejos (Prueba de ritmo, tiempo de reacción y contraataque)
      {
        waveNumber: 4,
        title: 'OLEADA 4: DUELO DE ACERO Y REFLEJOS',
        subtitle: 'Duelistas Cinéticos Implacables • Mantén la cadencia rítmica y tempo perfecto',
        reward: 10,
        enemies: [
          { archetype: 'duelist', element: 'kinetic', name: 'Duelista Implacable', x: 480, y: 580 },
          { archetype: 'duelist', element: 'kinetic', name: 'Duelista Maestro', x: 770, y: 580 },
          { archetype: 'artillery', element: 'fuego', name: 'Artillero de Hostigamiento', x: 545, y: 460 }
        ]
      },
      // Oleada 5: Gran Invasión Mixta (Sinergias completas y control de multitudes 360°)
      {
        waveNumber: 5,
        title: 'OLEADA 5: HORDA DEL ECLIPSE ANCESTRAL',
        subtitle: 'Invasión Total de Élite • Combina Fuego, Cinética y Raíces para alcanzar Rango S',
        reward: 15,
        enemies: [
          { archetype: 'tank', element: 'plantas', name: 'Centinela Élite', x: 500, y: 500, hasWoodenShield: true },
          { archetype: 'tank', element: 'plantas', name: 'Centinela Élite', x: 750, y: 500, hasWoodenShield: true },
          { archetype: 'duelist', element: 'kinetic', name: 'Campeón Cinético', x: 624, y: 760 },
          { archetype: 'artillery', element: 'fuego', name: 'Artillero Ígneo', x: 440, y: 680 },
          { archetype: 'artillery', element: 'plantas', name: 'Esporífero de Asedio', x: 810, y: 680 },
          { archetype: 'hound', element: 'plantas', name: 'Sabueso Voraz', x: 470, y: 460 },
          { archetype: 'hound', element: 'plantas', name: 'Sabueso Voraz', x: 715, y: 460 }
        ]
      }
    ];

    /** @type {boolean} Si la horda ha sido iniciada */
    this.isStarted = false;

    /** @type {boolean} Si debe auto-iniciar al comenzar la partida (false en niveles de aventura/introducción) */
    this.autoStart = false;

    /** @type {{x: number, y: number}} Centro táctico de la arena donde emergen las oleadas */
    this.arenaCenter = { x: 624, y: 600 };
  }

  /**
   * Configura las coordenadas centrales de la arena del Santuario para adaptar las oleadas a cualquier nivel.
   * @param {number} x
   * @param {number} y
   */
  setArenaCenter(x, y) {
    this.arenaCenter = { x, y };
  }

  /**
   * Indica si existe una oleada de horda actualmente activa o invocándose.
   * @returns {boolean}
   */
  get isWaveActive() {
    return Boolean(this.isStarted && (this.state === 'ACTIVE' || this.state === 'SPAWNING'));
  }

  /**
   * Reinicia el gestor de oleadas y limpia enemigos activos al viajar a otro bioma o mundo.
   * @param {{x: number, y: number}|null} [arenaCenter=null]
   */
  resetForWorld(arenaCenter = null) {
    this.isStarted = false;
    this.state = 'IDLE';
    this.timer = 0;
    this.currentWaveIndex = 0;

    if (this.activeWaveEnemies && this.activeWaveEnemies.length > 0) {
      for (let i = 0; i < this.activeWaveEnemies.length; i++) {
        const enemy = this.activeWaveEnemies[i];
        enemy._despawnedForHorde = true;
        if (this.entityManager) {
          this.entityManager.removeEntity(enemy);
        }
      }
      this.activeWaveEnemies.length = 0;
    }

    if (arenaCenter && typeof arenaCenter.x === 'number' && typeof arenaCenter.y === 'number') {
      this.arenaCenter = { x: arenaCenter.x, y: arenaCenter.y };
    }

    if (this.stateManager) {
      this.stateManager.set('horde_wave_number', 0);
      this.stateManager.set('horde_enemies_remaining', 0);
      this.stateManager.set('horde_enemies_total', 0);
      this.stateManager.set('horde_banner_active', false);
      this.stateManager.set('horde_intermission', null);
    }
  }

  /**
   * Inicia el sistema de hordas desde la primera oleada.
   * Limpia enemigos estáticos heredados en el mapa para garantizar orden y coherencia.
   * @param {Object} context
   */
  startHorde(context) {
    this.isStarted = true;
    this.currentWaveIndex = 0;

    // Limpiar enemigos residuales marcándolos como despawneados (no derrotados) y suprimir reaparición por chunk
    if (context && context.chunkManager && typeof context.chunkManager.setFieldEnemiesSuppressed === 'function') {
      context.chunkManager.setFieldEnemiesSuppressed(true);
    } else if (this.entityManager) {
      const existingEnemies = this.entityManager.getByTag('enemy');
      existingEnemies.forEach(e => {
        e._despawnedForHorde = true;
        this.entityManager.removeEntity(e);
      });
    }

    this._startWave(1, context);
  }

  /**
   * Busca una posición segura libre de colisiones sólidas alrededor de `(rawX, rawY)` para que
   * ningún enemigo de horda nazca atrapado dentro de altares, casas, rocas o árboles.
   * @private
   * @param {number} rawX
   * @param {number} rawY
   * @returns {{x: number, y: number}}
   */
  _findSafeSpawnPosition(rawX, rawY) {
    if (!this.entityManager) return { x: rawX, y: rawY };
    const solids = this.entityManager.getSolids();

    const isClear = (cx, cy) => {
      const boxX = cx + 5;
      const boxY = cy + 14;
      const boxW = 22;
      const boxH = 16;
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        const hb = s.getHitbox();
        if (
          boxX < hb.x + hb.width &&
          boxX + boxW > hb.x &&
          boxY < hb.y + hb.height &&
          boxY + boxH > hb.y
        ) {
          return false;
        }
      }
      return true;
    };

    if (isClear(rawX, rawY)) return { x: rawX, y: rawY };

    // Búsqueda espiral concéntrica hacia el centro de la arena si el punto estaba ocupado
    const radii = [28, 48, 68, 92];
    for (let rIdx = 0; rIdx < radii.length; rIdx++) {
      const r = radii[rIdx];
      for (let step = 0; step < 8; step++) {
        const ang = (step * Math.PI) / 4;
        const tx = Math.round(rawX + Math.cos(ang) * r);
        const ty = Math.round(rawY + Math.sin(ang) * r);
        if (isClear(tx, ty)) {
          return { x: tx, y: ty };
        }
      }
    }

    return { x: this.arenaCenter.x, y: this.arenaCenter.y + 40 };
  }

  /**
   * Inicia una oleada específica.
   * @private
   * @param {number} waveNumber - Índice 1-based de la oleada
   * @param {Object} context
   */
  _startWave(waveNumber, context) {
    this.currentWaveIndex = waveNumber;
    this.state = 'SPAWNING';
    this.activeWaveEnemies = [];

    // Obtener configuración de oleada predeterminada o generar oleada infinita escalada
    let config = this.waveConfigs[waveNumber - 1];
    if (!config) {
      config = this._generateInfiniteWaveConfig(waveNumber);
    }

    this.totalWaveEnemies = config.enemies.length;

    // Actualizar StateManager con los datos de la oleada para el HUD
    if (this.stateManager) {
      this.stateManager.set('horde_wave_number', waveNumber);
      this.stateManager.set('horde_wave_title', config.title);
      this.stateManager.set('horde_wave_subtitle', config.subtitle);
      this.stateManager.set('horde_enemies_remaining', this.totalWaveEnemies);
      this.stateManager.set('horde_enemies_total', this.totalWaveEnemies);
      this.stateManager.set('horde_banner_active', true);
      this.stateManager.set('horde_intermission', null);
    }

    if (context && context.audioManager) {
      context.audioManager.playExplosion();
    }
    if (context && context.camera) {
      context.camera.shake(0.45, 0.25);
    }

    // Instanciar enemigos con portal visual de invocación reubicados respecto a `arenaCenter`
    const offsetX = this.arenaCenter.x - 624;
    const offsetY = this.arenaCenter.y - 600;

    for (const entData of config.enemies) {
      const rawX = config.isRelativeToArena ? entData.x : (entData.x + offsetX);
      const rawY = config.isRelativeToArena ? entData.y : (entData.y + offsetY);
      const safeSpawn = this._findSafeSpawnPosition(rawX, rawY);
      const spawnX = safeSpawn.x;
      const spawnY = safeSpawn.y;

      const enemy = new Enemy(
        spawnX,
        spawnY,
        entData.element || 'plantas',
        entData.name || 'Hostil de Horda',
        entData.archetype || 'hound'
      );

      // Los enemigos de horda tienen un tag especial y no reviven por su cuenta en su posición
      enemy.tags.push('wave_enemy');
      enemy.noRespawn = true;
      enemy.respawnTimer = 999999; // Gestionado exclusivamente por WaveManager

      // Orientar inicialmente al enemigo hacia el centro táctico de la arena
      if (this.arenaCenter && typeof enemy._faceVector === 'function') {
        enemy._faceVector(this.arenaCenter.x - spawnX, this.arenaCenter.y - spawnY, 1.0);
      }

      if (entData.hasWoodenShield) {
        enemy.hasWoodenShield = true;
        if (!enemy.tags.includes('wooden_shield')) enemy.tags.push('wooden_shield');
      }

      this.entityManager.addEntity(enemy);
      this.activeWaveEnemies.push(enemy);

      // Efecto visual de portal de invocación
      if (context && context.vfxRenderer) {
        context.vfxRenderer.spawnImpact('parry_spark', spawnX + 16, spawnY + 16, {
          radius: 38,
          duration: 0.55
        });
      }
    }

    this.state = 'ACTIVE';
  }

  /**
   * Genera dinámicamente oleadas infinitas escaladas para garantizar rejugabilidad tras la oleada 5.
   * @private
   * @param {number} waveNumber
   * @returns {Object}
   */
  _generateInfiniteWaveConfig(waveNumber) {
    const houndCount = Math.min(8, 2 + Math.floor(waveNumber * 0.8));
    const artCount = Math.min(5, 1 + Math.floor(waveNumber * 0.5));
    const tankCount = Math.min(4, Math.floor(waveNumber * 0.4));
    const duelistCount = Math.min(4, Math.floor(waveNumber * 0.4));

    const enemies = [];
    const clearCenter = { x: this.arenaCenter.x, y: this.arenaCenter.y };
    const radius = 190;

    let total = houndCount + artCount + tankCount + duelistCount;
    for (let i = 0; i < total; i++) {
      const angle = (i * Math.PI * 2) / total;
      const ex = Math.round(clearCenter.x + Math.cos(angle) * radius);
      const ey = Math.round(clearCenter.y + Math.sin(angle) * (radius * 0.75));

      let archetype = 'hound';
      let element = 'plantas';
      let name = 'Sabueso de Enjambre';

      if (i < tankCount) {
        archetype = 'tank';
        element = 'plantas';
        name = `Centinela Guardián V${waveNumber}`;
      } else if (i < tankCount + artCount) {
        archetype = 'artillery';
        element = (i % 2 === 0) ? 'fuego' : 'plantas';
        name = `Artillero de Asedio V${waveNumber}`;
      } else if (i < tankCount + artCount + duelistCount) {
        archetype = 'duelist';
        element = 'kinetic';
        name = `Duelista Élite V${waveNumber}`;
      }

      enemies.push({ archetype, element, name, x: ex, y: ey, hasWoodenShield: archetype === 'tank' });
    }

    return {
      waveNumber,
      isRelativeToArena: true,
      title: `OLEADA ${waveNumber}: TORMENTA DEL VACÍO INFINITO`,
      subtitle: `Dificultad Pesadilla • ${total} enemigos hostiles convergiendo hacia el Claro`,
      reward: 10 + waveNumber * 2,
      enemies
    };
  }

  /**
   * Ciclo principal de actualización de la horda.
   * Verifica bajas enemigas, gestiona intermisiones entre oleadas y sincroniza el HUD.
   * @param {Object} context
   */
  update(context) {
    const dt = context.deltaTime || 0.016;

    if (!this.isStarted) {
      if (this.autoStart && this.stateManager && this.stateManager.get('game_state') === 'STATE_PLAYING') {
        this.startHorde(context);
      }
      return;
    }

    // 1. Estado ACTIVO: contar enemigos restantes vivos
    if (this.state === 'ACTIVE') {
      let aliveCount = 0;
      for (let i = this.activeWaveEnemies.length - 1; i >= 0; i--) {
        const enemy = this.activeWaveEnemies[i];
        if (enemy && !enemy.isDead && enemy.health > 0) {
          aliveCount++;
        }
      }

      if (this.stateManager) {
        this.stateManager.set('horde_enemies_remaining', aliveCount);
      }

      // Si todos los enemigos de la oleada fueron derrotados
      if (aliveCount === 0) {
        this._handleWaveVictory(context);
      }
    }

    // 2. Estado INTERMISSION: cuenta regresiva hacia la siguiente oleada
    if (this.state === 'INTERMISSION') {
      this.timer -= dt;
      const secondsLeft = Math.ceil(this.timer);

      if (this.stateManager) {
        this.stateManager.set('horde_intermission', secondsLeft);
      }

      if (this.timer <= 0) {
        // Remover del EntityManager los cuerpos de la oleada anterior
        for (const deadEnemy of this.activeWaveEnemies) {
          if (this.entityManager) {
            this.entityManager.removeEntity(deadEnemy);
          }
        }
        this.activeWaveEnemies = [];
        this._startWave(this.currentWaveIndex + 1, context);
      }
    }
  }

  /**
   * Celebra la victoria de una oleada, otorga botín y arranca la intermisión.
   * @private
   * @param {Object} context
   */
  _handleWaveVictory(context) {
    this.state = 'INTERMISSION';
    this.timer = 4.5; // 4.5 segundos de respiro táctico

    let config = this.waveConfigs[this.currentWaveIndex - 1];
    const reward = config ? config.reward : (10 + this.currentWaveIndex * 2);

    if (context && context.skillTreeManager) {
      context.skillTreeManager.addEssence(reward);
    }

    if (context && context.audioManager) {
      context.audioManager.playHeal();
    }
    if (context && context.camera) {
      context.camera.shake(0.3, 0.2);
    }

    if (this.stateManager) {
      this.stateManager.set('horde_enemies_remaining', 0);
      this.stateManager.set('horde_intermission', 4);
      this.stateManager.set('horde_victory_announcement', {
        title: `¡OLEADA ${this.currentWaveIndex} COMPLETADA!`,
        rewardText: `+${reward} Esencia Ancestral ✦`,
        timer: 3.5
      });
    }

    // Diálogo de ánimo de Tarak
    if (this.stateManager) {
      const messages = [
        '¡Excelente barrido, Santi! Los sabuesos han sido dispersados.',
        '¡Gran reflejo desviando proyectiles! Pero se acercan tropas con escudos pesados.',
        '¡La falange enemiga ha caído! Prepárate para duelistas de alta velocidad.',
        '¡Sobreviviste a los duelistas! La horda de élite final converge hacia el Claro Sagrado.',
        '¡Has conquistado la horda legendaria! La Reliquia brilla con poder inquebrantable.'
      ];
      const text = messages[this.currentWaveIndex - 1] || `¡Oleada ${this.currentWaveIndex} superada con maestría marcial!`;
      this.stateManager.set('active_dialogue', {
        speaker: 'ECO DE TARAK',
        text,
        timer: 3.5
      });
    }
  }
}
