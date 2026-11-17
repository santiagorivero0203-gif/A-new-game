/**
 * @file textFormatter.js
 * @description Módulo de formateo y localización de indicaciones de control (Input Prompts)
 * para 'Be a Legend'.
 * 
 * Adapta dinámicamente textos diegéticos, objetivos de misión y banners según la plataforma:
 * - En PC / Teclado y Ratón: muestra [Clic Izq / J], [Clic Der / K], [E], [Espacio], [Q], etc.
 * - En Dispositivos Móviles / Táctil: elimina menciones a teclas o clics y las sustituye por los
 *   botones táctiles visibles en el HUD ([ESPADA], [FUEGO], [USAR], [DASH], [GUARDIA], [CORRER], [SIGILO], etc.).
 * 
 * Cumple con una arquitectura limpia, declarativa y extensible.
 * @author Be a Legend Team
 * @version 2.1.0
 */

/**
 * Tabla de sustituciones para controles táctiles en dispositivos móviles.
 * @type {Array<{regex: RegExp, replace: string}>}
 */
const MOBILE_PROMPT_REPLACEMENTS = [
  // 1. Ataque principal con espada (frases con verbo primero para evitar "Pulsa (botón ...)")
  { regex: /haz\s*clic\s*izquierdo\s*o\s*pulsa\s*J/gi, replace: 'toca el botón ESPADA' },
  { regex: /Pulsa\s*\[\s*(?:Clic\s*Izq(?:\s*\/\s*J)?|J)\s*\]/gi, replace: 'Toca ESPADA' },
  { regex: /\[\s*(?:Clic\s*Izq(?:\s*\/\s*J)?|J)\s*\]/gi, replace: '(botón ESPADA)' },

  // 2. Habilidad elemental (Fuego / Reliquia)
  { regex: /haz\s*clic\s*derecho\s*o\s*pulsa\s*K/gi, replace: 'toca el botón elemental' },
  { regex: /Pulsa\s*\[\s*(?:Clic\s*Der(?:\s*\/\s*K)?|K)\s*\]/gi, replace: 'Toca el botón elemental' },
  { regex: /\[\s*(?:Clic\s*Der(?:\s*\/\s*K)?|K)\s*\]/gi, replace: '(botón elemental)' },

  // 3. Interacción / Usar / Empuñar
  { regex: /Pulsa\s*\[\s*E(?:\s*\/\s*Clic\s*Izq)?\s*\]/gi, replace: 'Toca USAR' },
  { regex: /presiona\s*\[\s*E(?:\s*\/\s*Clic\s*Izq)?\s*\]/gi, replace: 'toca USAR' },
  { regex: /\[\s*E\s*(?:\/\s*Clic\s*Izq)?\s*\]/gi, replace: '(botón USAR)' },

  // 4. Dash / Esquiva
  { regex: /Pulsa\s*\[\s*Espacio\s*\]/gi, replace: 'Toca DASH' },
  { regex: /\[\s*Espacio\s*\]/gi, replace: '(botón DASH)' },

  // 5. Guardia / Escudo / Parry (Shift y Q)
  { regex: /Pulsa\s*\[\s*Shift\s*\]/gi, replace: 'Toca GUARDIA' },
  { regex: /\[\s*Shift\s*\]/gi, replace: '(botón GUARDIA)' },
  { regex: /\[\s*Q(?:\s*\/\s*Clic\s*Der)?\s*\]/gi, replace: '(botón GUARDIA)' },

  // 6. Selección múltiple de poderes y cambio de elemento
  { regex: /con\s*las\s*teclas\s*\[\s*1\s*\],\s*\[\s*2\s*\],\s*\[\s*3\s*\],\s*la\s*rueda\s*del\s*ratón\s*o\s*manteniendo\s*\[\s*Tab\s*\]/gi, replace: 'deslizando el botón elemental o tocando el botón de cambio' },
  { regex: /Pulsa\s*\[\s*1\s*\]\s*\[\s*2\s*\]\s*\[\s*3\s*\]\s*o\s*\[\s*R\s*\]/gi, replace: 'Desliza el botón elemental o toca cambio rápido' },
  { regex: /\[\s*1\s*\]\s*(?:,\s*)?\[\s*2\s*\]\s*(?:,\s*)?\[\s*3\s*\]/gi, replace: '(deslizar botón elemental)' },
  { regex: /\[\s*(?:R|Tab)\s*\]/gi, replace: '(botón cambio elemental)' },

  // 7. Sprint / Correr, Sigilo, Curación, Ataque fuerte y Santuario
  { regex: /\[\s*F\s*\]/gi, replace: '(botón CORRER)' },
  { regex: /\[\s*C\s*\]/gi, replace: '(botón SIGILO)' },
  { regex: /\[\s*H\s*\]/gi, replace: '(botón CURAR)' },
  { regex: /\[\s*L\s*\]/gi, replace: '(botón FUERTE)' },
  { regex: /\[\s*U\s*\]/gi, replace: '(botón superior de Esencia)' }
];

/**
 * Adapta dinámicamente una cadena de texto para eliminar atajos de teclado en pantalla táctil
 * y sustituirlos por los nombres de los botones táctiles correspondientes.
 * 
 * @param {string} text - Texto original con posibles atajos entre corchetes.
 * @param {boolean} isMobile - Si está activo el modo móvil / pantalla táctil.
 * @returns {string} Texto formateado y coherente con el esquema de entrada.
 */
export function formatControlPrompts(text, isMobile = false) {
  if (!text || typeof text !== 'string') return text || '';
  if (!isMobile) return text;
  if (text.indexOf('[') === -1 && text.indexOf('clic') === -1 && text.indexOf('Clic') === -1) {
    return text;
  }

  let formatted = text;
  for (let i = 0; i < MOBILE_PROMPT_REPLACEMENTS.length; i++) {
    const entry = MOBILE_PROMPT_REPLACEMENTS[i];
    formatted = formatted.replace(entry.regex, entry.replace);
  }

  return formatted;
}
