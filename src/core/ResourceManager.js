export class ResourceManager {
  constructor() {
    this.images = new Map();
    this.jsons = new Map();
    this.audio = new Map();
  }

  /**
   * Carga una imagen de forma asíncrona y la cachea.
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
        console.error(`Error loading image [${key}] from ${src}`, err);
        reject(err);
      };
      img.src = src;
    });
  }

  /**
   * Carga un archivo JSON (como spritesheet data o configuraciones).
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
      console.error(`Error loading JSON [${key}] from ${url}`, err);
      throw err;
    }
  }

  /**
   * Carga múltiples assets en paralelo para transiciones de nivel sin pausas.
   */
  async loadBatch(assetList) {
    const promises = assetList.map(asset => {
      if (asset.type === 'image') return this.loadImage(asset.key, asset.url);
      if (asset.type === 'json') return this.loadJSON(asset.key, asset.url);
      return Promise.resolve();
    });

    return Promise.all(promises);
  }

  getImage(key) {
    return this.images.get(key);
  }

  getJSON(key) {
    return this.jsons.get(key);
  }
}

// Exportamos un Singleton para uso global, aunque podría inyectarse.
export const resourceManager = new ResourceManager();
