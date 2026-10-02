/**
 * @module ResourceManager
 * @description Gestor centralizado de carga asíncrona de assets.
 * Cachea imágenes, patrones, texturas con canal alfa procesado y JSONs en Maps para acceso O(1).
 * Soporta carga en lote (batch) para enmascarar transiciones de nivel.
 * @author Be a Legend Team
 * @version 1.2.0
 */
export class ResourceManager {
  constructor() {
    /** @type {Map<string, HTMLImageElement|HTMLCanvasElement>} Caché de imágenes y sprites procesados */
    this.images = new Map();

    /** @type {Map<string, Object>} Caché de archivos JSON */
    this.jsons = new Map();

    /** @type {Map<string, HTMLAudioElement>} Caché de audio (futuro) */
    this.audio = new Map();
  }

  /**
   * Carga una imagen estándar de forma asíncrona y la cachea.
   * Si la imagen ya está cacheada, devuelve la referencia existente.
   * Tolerante: si falla, rechaza la promesa para que loadBatch maneje el fallback.
   * @param {string} key - Identificador único del asset
   * @param {string} src - Ruta al archivo de imagen
   * @returns {Promise<HTMLImageElement>}
   */
  loadImage(key, src) {
    return new Promise((resolve, reject) => {
      if (this.images.has(key)) {
        return resolve(this.images.get(key));
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.images.set(key, img);
        resolve(img);
      };
      img.onerror = (err) => {
        // Rechazar limpiamente sin alertar en consola si DEBUG_MODE está inactivo
        reject(new Error(`[ResourceManager] No se pudo cargar la imagen [${key}] desde '${src}'`));
      };
      img.src = src;
    });
  }

  /**
   * Carga un archivo JSON (spritesheet data, configuraciones, mapas).
   * @param {string} key - Identificador único
   * @param {string} url - Ruta al archivo JSON
   * @returns {Promise<Object>}
   */
  async loadJSON(key, url) {
    if (this.jsons.has(key)) {
      return this.jsons.get(key);
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} al cargar ${url}`);
      }
      const data = await response.json();
      this.jsons.set(key, data);
      return data;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Carga múltiples assets en paralelo tolerando ausencias con Promise.allSettled.
   * Un asset faltante (404 / no existente) nunca impide el arranque del juego ni bloquea a los demás.
   * 
   * Formato esperado de los assets:
   * - Formato: PNG con canal alfa propio (RGBA de 32-bit), sin clave de color ni thresholding.
   * - Terreno / Tiles: 32x32 px exactos para repetición seamless.
   * - Sprites de entidades: proporciones alineadas a cuadrícula de 32x32 px.
   * 
   * @param {Array<{type: string, key: string, url: string, tileSize?: number, required?: boolean}>} assetList
   * @returns {Promise<PromiseSettledResult<any>[]>}
   */
  async loadBatch(assetList) {
    if (!Array.isArray(assetList)) return [];

    const promises = assetList.map(asset => {
      if (asset.type === 'image') {
        return this.loadImage(asset.key, asset.url);
      }
      if (asset.type === 'json') {
        return this.loadJSON(asset.key, asset.url);
      }
      return Promise.resolve();
    });

    const results = await Promise.allSettled(promises);

    const isDebug = typeof window !== 'undefined' && window.DEBUG_MODE;

    results.forEach((res, index) => {
      if (res.status === 'rejected') {
        const asset = assetList[index];
        if (isDebug) {
          console.warn(`[ResourceManager] Asset opcional ausente [${asset.key}] (${asset.url}):`, res.reason?.message || res.reason);
        }
      }
    });

    return results;
  }

  /**
   * Obtiene una imagen o canvas cacheado.
   * @param {string} key
   * @returns {HTMLImageElement|HTMLCanvasElement|undefined}
   */
  getImage(key) {
    return this.images.get(key);
  }

  /**
   * Obtiene un JSON cacheado.
   * @param {string} key
   * @returns {Object|undefined}
   */
  getJSON(key) {
    return this.jsons.get(key);
  }
}

