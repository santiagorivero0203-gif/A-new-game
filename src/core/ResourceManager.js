/**
 * @module ResourceManager
 * @description Gestor centralizado de carga asíncrona de assets.
 * Cachea imágenes y JSONs en Maps para acceso O(1). Soporta carga
 * en lote (batch) para enmascarar transiciones de nivel.
 * Se inyecta como dependencia; NO se exporta como singleton ambiguo.
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class ResourceManager {
  constructor() {
    /** @type {Map<string, HTMLImageElement>} Caché de imágenes */
    this.images = new Map();

    /** @type {Map<string, Object>} Caché de archivos JSON */
    this.jsons = new Map();

    /** @type {Map<string, HTMLAudioElement>} Caché de audio (futuro) */
    this.audio = new Map();
  }

  /**
   * Carga una imagen de forma asíncrona y la cachea.
   * Si la imagen ya está cacheada, devuelve la referencia existente.
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
      img.onload = () => {
        this.images.set(key, img);
        resolve(img);
      };
      img.onerror = (err) => {
        console.error(`[ResourceManager] Error cargando imagen [${key}] desde ${src}`, err);
        reject(err);
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
      const data = await response.json();
      this.jsons.set(key, data);
      return data;
    } catch (err) {
      console.error(`[ResourceManager] Error cargando JSON [${key}] desde ${url}`, err);
      throw err;
    }
  }

  /**
   * Carga múltiples assets en paralelo.
   * Ideal para pantallas de carga o pasillos de transición.
   * @param {Array<{type: string, key: string, url: string}>} assetList
   * @returns {Promise<Array>}
   */
  async loadBatch(assetList) {
    const promises = assetList.map(asset => {
      if (asset.type === 'image') return this.loadImage(asset.key, asset.url);
      if (asset.type === 'json') return this.loadJSON(asset.key, asset.url);
      console.warn(`[ResourceManager] Tipo de asset desconocido: ${asset.type}`);
      return Promise.resolve();
    });

    return Promise.all(promises);
  }

  /**
   * Obtiene una imagen cacheada.
   * @param {string} key
   * @returns {HTMLImageElement|undefined}
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
