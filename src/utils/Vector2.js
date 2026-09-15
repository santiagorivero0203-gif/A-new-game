/**
 * @module Vector2
 * @description Clase de vector 2D con operaciones matemáticas completas.
 * Todas las operaciones mutables retornan `this` para encadenamiento.
 * Incluye métodos estáticos para operaciones no-destructivas.
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class Vector2 {
  /**
   * @param {number} x - Componente horizontal
   * @param {number} y - Componente vertical
   */
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * Establece ambos componentes.
   * @returns {Vector2} this (encadenable)
   */
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Suma otro vector a este (mutación in-place).
   * @param {Vector2} v
   * @returns {Vector2} this
   */
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  /**
   * Resta otro vector de este (mutación in-place).
   * @param {Vector2} v
   * @returns {Vector2} this
   */
  subtract(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  /**
   * Multiplica ambos componentes por un escalar.
   * @param {number} s
   * @returns {Vector2} this
   */
  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }

  /**
   * Magnitud (longitud) del vector.
   * @returns {number}
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Magnitud al cuadrado — más eficiente que length() para comparaciones.
   * @returns {number}
   */
  lengthSquared() {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Normaliza el vector a longitud 1 (in-place).
   * Vectores de longitud 0 permanecen sin cambios.
   * @returns {Vector2} this
   */
  normalize() {
    const len = this.length();
    if (len > 0) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }

  /**
   * Producto punto con otro vector.
   * @param {Vector2} v
   * @returns {number}
   */
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  /**
   * Distancia euclidiana hasta otro vector.
   * @param {Vector2} v
   * @returns {number}
   */
  distanceTo(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Distancia al cuadrado — más eficiente para comparaciones de rango.
   * @param {Vector2} v
   * @returns {number}
   */
  distanceToSquared(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  /**
   * Ángulo del vector en radianes (desde el eje X positivo).
   * @returns {number} Ángulo en radianes [-PI, PI]
   */
  angle() {
    return Math.atan2(this.y, this.x);
  }

  /**
   * Interpolación lineal hacia otro vector (in-place).
   * @param {Vector2} target - Vector destino
   * @param {number} t - Factor de interpolación [0..1]
   * @returns {Vector2} this
   */
  lerp(target, t) {
    this.x += (target.x - this.x) * t;
    this.y += (target.y - this.y) * t;
    return this;
  }

  /**
   * Crea una copia independiente de este vector.
   * @returns {Vector2}
   */
  clone() {
    return new Vector2(this.x, this.y);
  }

  // --- Métodos estáticos (no-destructivos) ---

  /**
   * Interpolación lineal estática entre dos vectores.
   * @param {Vector2} a
   * @param {Vector2} b
   * @param {number} t - Factor [0..1]
   * @returns {Vector2} Nuevo vector interpolado
   */
  static lerp(a, b, t) {
    return new Vector2(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t
    );
  }

  /**
   * Distancia entre dos vectores.
   * @param {Vector2} a
   * @param {Vector2} b
   * @returns {number}
   */
  static distance(a, b) {
    return a.distanceTo(b);
  }
}
