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
        console.error(`[ResourceManager] Error cargando imagen [${key}] desde ${src}`, err);
        reject(err);
      };
      img.src = src;
    });
  }

  /**
   * Carga una imagen y convierte el fondo claro/blanco en transparencia alfa.
   * Ideal para spritesheets aislados sobre fondo blanco.
   * @param {string} key - Identificador único
   * @param {string} src - Ruta al archivo
   * @param {number} [threshold=235] - Umbral de brillo RGB (0..255)
   * @returns {Promise<HTMLCanvasElement>}
   */
  async loadTransparentImage(key, src, threshold = 235) {
    if (this.images.has(key)) {
      return this.images.get(key);
    }

    const img = await this.loadImage(`_raw_${key}`, src);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Si el pixel es casi blanco puro, hacerlo transparente
      if (r >= threshold && g >= threshold && b >= threshold) {
        data[i + 3] = 0;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    this.images.set(key, canvas);
    return canvas;
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
   * @param {Array<{type: string, key: string, url: string, transparent?: boolean, threshold?: number}>} assetList
   * @returns {Promise<Array>}
   */
  async loadBatch(assetList) {
    const promises = assetList.map(asset => {
      if (asset.type === 'image') {
        if (asset.transparent) {
          return this.loadTransparentImage(asset.key, asset.url, asset.threshold);
        }
        return this.loadImage(asset.key, asset.url);
      }
      if (asset.type === 'json') return this.loadJSON(asset.key, asset.url);
      console.warn(`[ResourceManager] Tipo de asset desconocido: ${asset.type}`);
      return Promise.resolve();
    });

    return Promise.all(promises);
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
