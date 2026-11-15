# Arquitectura Narrativa y Diseño de Progresión Sistémica para el Action-RPG Be a Legend

## 1. Tesis Temática y Deconstrucción del Mito Heroico

El diseño narrativo de un videojuego de rol y acción (Action-RPG) moderno exige que la historia no funcione como una capa cosmética superpuesta al código, sino como el eje estructural que justifica cada sistema mecánico, desde la física del combate hasta la topología del mapa. En el caso de *Be a Legend*, la premisa fundacional parte de un tropo clásico —el llamado a la aventura tras la caída de un mentor— pero introduce una subversión temática profunda sobre qué construye realmente a una leyenda.

En la cinemática de apertura, el jugador presencia la derrota de Caelus, el Héroe Milenario, a manos del antagonista principal, Vortigern, en un Salón del Trono en ruinas azotado por la lluvia. Cuando Vortigern aplasta el brazo de Caelus y fractura El Brazalete del Vínculo —una reliquia ancestral de metal oscuro similar a la obsidiana—, los cuatro núcleos elementales salen disparados hacia las Bestias Elementales que custodian las cuatro ciudades del continente. Este incidente incitador establece una dicotomía filosófica explícita en el diálogo entre el héroe caído y el tirano: mientras Vortigern concibe el poder como una magnitud estática alojada en el artefacto, Caelus afirma antes de morir que la luz no reside en el metal, sino en la voluntad de quien lo empuña.

Al heredar Santi —un protagonista joven de proporciones chibi y complexión pequeña— un brazalete frío, vacío y desprovisto de magia, el juego plantea su tesis central: **la condición de leyenda no es un estado heredado por derecho divino, sino un proceso cinético, adaptativo y moral**. Esta premisa resuelve de inmediato el problema clásico de la disonancia ludonarrativa en los juegos de rol al alinear la ficción con las reglas del motor:

1. **Vulnerabilidad Orgánica:** La fractura y el vaciamiento del brazalete justifican por qué el jugador comienza en el nivel cero de poder mágico y se ve obligado a sobrevivir mediante reflejos puros, el uso táctico de una espada básica y un escudo direccional con mecánicas de guardia perfecta (parry).
2. **Push-Forward Combat:** Dado que el poder nace de la voluntad y la determinación en combate, el medidor de energía de la reliquia (`power_bar`) rechaza la regeneración pasiva detrás de una cobertura y exige una agresividad continua, obligando a encadenar ataques débiles y esquivas en el último milisegundo para mantener la inercia.
3. **Karma Invisible:** La tesis de Caelus dota de peso dramático a la moralidad implícita: si el jugador ignora el sufrimiento de los civiles en los caminos por priorizar únicamente la obtención utilitarista de los cuatro poderes elementales, estará replicando la filosofía de Vortigern; por el contrario, intervenir en combates opcionales sin recompensa explícita en la interfaz valida moralmente al nuevo portador de la reliquia.

### El Círculo de la Historia Aplicado a una Arquitectura Branch-and-Bottleneck

Para estructurar el viaje de Santi sin caer en la dispersión narrativa propia de los mundos abiertos ni en la rigidez de un pasillo lineal, la macro-estructura del guion combina el **Círculo de la Historia de Dan Harmon** con el patrón de diseño interactivo **Branch-and-Bottleneck** (Ramificación y Cuello de Botella):

| Fase del Círculo (Harmon) | Hito Narrativo en *Be a Legend* | Estado de Progresión y Mecánicas Activas | Implementación en Motor (`src/`) |
| :--- | :--- | :--- | :--- |
| **1. Tú (Zona de Confort / Preludio)** | Santi observa oculto tras una columna en el Salón del Trono mientras Caelus libra su última batalla contra Vortigern. | Estado contemplativo; introducción visual al contraste entre la escala imponente del villano y la fragilidad del protagonista. | `StateManager.js` cambia de `STATE_MENU` a cinemática inicial; `LightManager.js` aplica lluvia y relámpagos con Screen Shake. |
| **2. Necesidad (Incidente Incitador)** | Vortigern fractura el Brazalete; las 4 esferas de luz huyen hacia las ciudades. Caelus entrega el artefacto apagado a Santi y muere. | El jugador recibe el Brazalete del Vínculo con 4 ranuras vacías (`poderes_desbloqueados = []`) y el armamento base (Espada y Escudo nivel 1). | Eventos de diálogo inicial; activación de `EquipmentManager.js` con parámetros base de hitbox y postura. |
| **3. Ir (Cruzar el Umbral)** | Huida por el túnel subterráneo oscuro tras el abandono del salón por parte de Vortigern, emergiendo hacia el primer claro exterior. | Mazmorra tutorial enfocada en colisiones, paredes falsas (`pared_falsa`), bloqueo direccional y ventana de Parry (0.15 s) sin poderes mágicos. | Pasillo estrecho activa `ResourceManager.js` (`Promise.all`) para carga asíncrona; `LightManager.js` conmuta `isInterior` de `true` a `false`. |
| **4. Buscar (Adaptación / Hub-and-Spoke)** | Viaje a través de las primeras ciudades y rutas comerciales asediadas; descubrimiento de las crisis locales provocadas por las Bestias Elementales. | Apertura del mundo en cruz. El jugador enfrenta dilemas de Karma pasivo en los caminos y absorbe los primeros poderes (ej. Fuego y Embestida). | `StateManager.js` registra fluctuaciones de `karma_level`; desbloqueo progresivo de segmentos en la rueda radial (`UIManager.js` con `Math.atan2`). |
| **5. Encontrar (Meta Aparente)** | Conquista de las 4 Mazmorras Elementales y absorción de los 4 núcleos en el Brazalete, dominando las sinergias cruzadas. | Plenitud ofensiva: el jugador ejecuta combos de Push-Forward Combat, cancelación de animaciones y reacciones elementales (ej. Raíces + Fuego). | `CombatManager.js` opera al 100% de capacidad con las 4 clases heredadas de `Ability.js` y el `ObjectPool.js` gestionando partículas. |
| **6. Tomar (Pagar el Precio)** | Al encender la cuarta ranura del Brazalete, Vortigern lanza una represalia sobre el mundo; las consecuencias del Karma acumulado se vuelven irreversibles. | Escalado máximo de las patrullas enemigas; cierre o fortificación de asentamientos según el nivel de ayuda prestada previamente a los civiles. | Actualización global de estados de mundo y tablas de spawn; evaluación definitiva de `karma_level` para bloquear o abrir rutas de apoyo. |
| **7. Retornar (Regreso al Origen)** | Asedio a la fortaleza central y retorno al Salón del Trono donde murió Caelus, rompiendo la barrera de los 4 elementos. | Mazmorra final ("El Gauntlet"): exige alternar los 4 poderes y el Parry en tiempo real contra combinaciones de los 4 arquetipos de enemigos. | `Camera.js` aplica triggers cinemáticos de zoom; `Renderer.js` e iluminación combinan exteriores tormentosos e interiores oscuros. |
| **8. Cambiar (La Leyenda Forjada)** | Confrontación final contra Vortigern; resolución del arco de Santi según cómo obtuvo y utilizó su poder. | Jefe final multifase que pone a prueba la barra de postura, la cancelación de animaciones y la maestría elemental; epílogo reactivo al Karma. | Selección de script de cierre mediante agencia invisible sin menús de elección explícitos. |

---

## 2. Topología del Mundo y Progresión Macro-Estructural

El diseño espacial de *Be a Legend* se fundamenta en una topología **Hub-and-Spoke** en forma de cruz: cuatro ciudades situadas en los extremos cardinales, cada una afectada por un desastre ecológico o militar vinculado a una mazmorra local, y una zona central bloqueada donde aguarda Vortigern.

### El Sistema de Progresión Escalonada Híbrida (World-State Tiering)

Para resolver la disyuntiva entre un mundo plano (sin tensión tardía) y el escalado de niveles puro (que vuelve a los enemigos esponjas de daño), la progresión macro-estructural implementa un modelo de **Escalado Híbrido por Hitos del Brazalete combinado con Gating Suave de Entorno**:

1. **Evolución Cualitativa del Ejército Enemigo:** Cada vez que Santi derrota a un jefe regional y rellena una de las cuatro ranuras del Brazalete, el mundo reacciona de forma cualitativa:
   - *Tier 0 (0 Núcleos):* Exploradores básicos y fauna corrompida ligera.
   - *Tier 1 (1 Núcleo):* Los Artilleros Ágiles reciben armaduras ligeras y mayor velocidad de proyectil, obligando a emplear `armor_break` o reflexión con escudo.
   - *Tier 2 y 3 (2-3 Núcleos):* Las patrullas incorporan al Tanque de Postura y al Duelista Implacable, activando rutinas avanzadas de flanqueo coordinado (*steering behaviors*).
2. **Distribución Probabilística por Tipo de Territorio:**
   - *Caminos y Rutas Comerciales:* Conservan una mayoría de encuentros estáticos (75%–90%), permitiendo a Santi experimentar dominio al revisitar zonas tempranas.
   - *Zonas Salvajes Profundas y Mazmorras Tardías:* Invierten el balance hacia un 66%–75% de escuadrones de élite escalados.
3. **Dosificación del Tiempo de Juego (Flow State):**
   - *Micro-puzzles ambientales exteriores:* 1 minuto.
   - *Cuevas secretas / Eventos de Karma:* 5 a 20 minutos.
   - *Laberinto regional exterior previo:* 40 minutos.
   - *Mazmorra Elemental Principal:* 100 minutos.

### Definición de las Cuatro Ciudades y Consolidación del Cuarto Poder Elemental

Para completar las cuatro ranuras de la reliquia y las cuatro ciudades cardinales, el cuarto poder cubre el nicho táctico de manipulación espacial, defensa reactiva y alteración de trayectorias: **Éter Magnético (Polaridad Voltaica)**.

| Ciudad y Bioma Regional | Crisis Narrativa Local | Poder de la Reliquia (Núcleo) | Ataque Débil (Inercia) | Ataque Fuerte (Consume `power_bar`) | Sinergia de Exploración y Puzzles (Gating) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Ignisgrad**<br>*(Caldera Cenicienta / Bosque Petrificado)* | Invierno de ceniza perpetuo; hornos apagados y minas a oscuras. | **Fuego**<br>*(Daño a distancia y área)* | *Bolas de Ceniza:* Proyectiles rápidos de bajo daño que mantienen el combo activo a distancia. | *Erupción Cíclica:* Golpe al suelo que expande un anillo ígneo radial, empujando y quemando hordas. | Quema enredaderas con etiqueta `debil_fuego`, enciende antorchas apagadas e ilumina cuevas oscuras mediante `LightManager.js`. |
| **2. Kinetia**<br>*(Cañones de Viento y Ruinas Suspendidas)* | Puentes colapsados tras el terremoto de Vortigern; caravanas aisladas. | **Energía Cinética**<br>*(Movilidad y ruptura)* | *Golpe de Fricción:* Dash direccional corto con *iframes* que atraviesa ataques y suma combo. | *Taladro Humano:* Embestida supersónica instantánea de largo alcance que aplica `armor_break`. | Cruza abismos pequeños, supera trampas de velocidad y destruye rocas agrietadas o bloques con `pared_falsa`. |
| **3. Sylvanor**<br>*(Pantano Viviente y Arboleda Hundida)* | Flora desbocada y hostil que devora los caminos comerciales. | **Tierra / Raíces**<br>*(Control de masas y agrupación)* | *Látigo de Enredadera:* Arco frontal de 180° con micro-atracción (*pull-in*) hacia Santi. | *Prisión del Bosque:* Brota raíces bajo el objetivo, aplicando `inmovilizado_raices` por 4.0 s (congela su FSM). | Inmoviliza interruptores móviles, detiene engranajes gigantes y agrupa objetos o enemigos sobre placas de presión. |
| **4. Aetherium**<br>*(Ciudadela Ferroviaria y Agujas de Obsidiana)* | Tormentas electromagnéticas inutilizan elevadores y sellan compuertas. | **Éter Magnético**<br>*(Manipulación espacial y vectorial)* | *Pulso de Polaridad:* Onda corta que electrifica objetivos metálicos y desvía proyectiles ligeros al emisor. | *Singularidad Magnética:* Nodo gravitacional que atrae a enemigos con armadura al centro y los descarga. | Atrae bloques metálicos lejanos sobre rieles, activa circuitos y permite impulsarse hacia postes magnéticos en grandes vacíos. |

---

## 3. Diseño de Mazmorras: Grafos de Misión, Kishōtenketsu y Enmascaramiento Técnico

Una mazmorra memorable no es una sucesión lineal de habitaciones, sino un espacio interconectado donde la arquitectura misma constituye un macro-rompecabezas (*puzzle box*).

### Topología de Grafos y Leyes de Espacio Compartido
1. **Primera Ley:** *La cerradura debe ser visible antes que la llave.* Al entrar a la sala central (Hub), el jugador observa inmediatamente la puerta del Jefe Principal sellada junto a un obstáculo ambiental específico (brecha insalvable, red de espinas o generador magnético apagado).
2. **Segunda Ley:** *La llave debe ser visible antes de ser alcanzable.* Ubicada en un plano elevado, tras una reja o al otro lado de un `borde_caida`, convirtiendo el desafío en deducción táctica de ruta.

### Ritmo Interno Mediante Kishōtenketsu y Enmascaramiento de Carga
- **Pasillo de Entrada (Streaming Asíncrono):** Corredor angosto donde `ResourceManager.js` ejecuta `Promise.all` en segundo plano para cargar spritesheets y animaciones sin bloquear el hilo principal, mientras `LightManager.js` conmuta `isInterior = true` activando la máscara de oscuridad.
- **1. Ki (Introducción Segura):** Sala cerrada con obstáculo estático sin enemigos donde se aprende la mecánica básica del poder elemental adquirido.
- **2. Sho (Desarrollo Cinético):** Presión temporal, enemigos activos y bifurcaciones con paredes falsas (`pared_falsa`) que ocultan rutas exploratorias.
- **3. Ten (El Giro Sistémico):** Desafío que exige sinergia cruzada con equipamiento o con un poder obtenido en otra región, conectando de vuelta al Hub mediante atajos unidireccionales (`borde_caida`).
- **4. Ketsu (El Gauntlet y Jefe Elemental):** Tramo de alta velocidad que culmina en la arena de la Bestia Elemental, con múltiples vectores de victoria (inercia agresiva o Parry Perfecto seguido de Riposte de 3.0x de daño).

---

## 4. Progresión Micro-Sistémica: Economía de Agresividad, Postura y Química Elemental

La progresión minuto a minuto rechaza los niveles pasivos planos (+2% fuerza) en favor de una evolución horizontal y táctica en `CombatManager.js` y `EquipmentManager.js`:

### El Triángulo de Supervivencia
1. **Defensa Direccional y Riesgo/Recompensa:** El motor verifica que el vector de orientación de Santi sea opuesto al del ataque enemigo. Mantener el bloqueo mitiga daño pero drena `guard_meter` (llegar a 0 provoca un *Guard Break* de 2.0 s). Activar la defensa en los primeros **0.15 s** ejecuta un **Parry Perfecto**: 0 desgaste de postura, *HitStop* de 0.08 s, y el rival entra en estado *staggered* por 1.5 s, quedando expuesto a un **Riposte con multiplicador de daño x3.0**.
2. **Economía de Agresividad (Push-Forward Combat):** La `power_bar` (0 a 100) se recarga únicamente conectando ataques débiles o esquivando en el último cuadro con *iframes*. Tras 3.0 s sin golpear, la barra decae rápidamente. Estar al borde de la muerte (viñeta roja) exige atacar agresivamente para llenar la barra y desatar un ataque fuerte resolutivo.
3. **Cancelación de Animaciones y Escalabilidad:** `AnimationController.js` permite interrumpir fotogramas de carga de ataques fuertes con un dash débil o con el escudo. A su vez, `EquipmentManager.js` escala la espada (mayor hitbox, daño base y combos) y el escudo (menor drenaje de postura, eliminación de debilidad inflamable y reflejo de proyectiles con `can_reflect_projectiles`).

### Matriz de Arquetipos y Reacciones Cruzadas

| Arquetipo de Enemigo | Lógica de IA (FSM) | Función Táctica | Contra-Mecánica Directa | Sinergia Elemental Cruzada |
| :--- | :--- | :--- | :--- | :--- |
| **El Artillero Ágil** | Mantiene distancia; huye si Santi se acerca a menos de $X$ px; dispara orbes veloces. | Presiona desde los bordes de la sala y amenaza con cortar la inercia del jugador. | Golpe de Fricción (dash cinético) o Parry Perfecto con escudo mejorado para reflejar proyectiles. | *Imán Voltaico:* Singularidad Magnética arrastra al Artillero acorazado hacia el centro, anulando su ventaja posicional. |
| **El Tanque de Postura** | Avance lento e implacable; ignora el knockback básico; porta gran escudo pesado. | Castiga el ataque frontal indiscriminado; escuda a los artilleros que se colocan detrás. | Provocar su ataque para hacer Parry Perfecto (1.5 s stagger + Riposte 3.0x) o Taladro Humano (`armor_break`). | *Explosión de Madera:* Inmovilizar con Prisión del Bosque (`inmovilizado_raices`) y aplicar Fuego para detonar su escudo en área. |
| **La Manada Errática** | Lógica de enjambre (*steering behaviors*); buscan rodear a Santi para atacar por la espalda desprotegida. | Satura el espacio visual; sirve como "batería" para recargar rápidamente `power_bar`. | Látigo de Enredadera (Tierra Débil): barrido de 180° con atracción frontal (*pull-in*) que interrumpe saltos. | *Vórtice Ígneo:* Agrupar a la manada con Látigo o Singularidad y rematar de inmediato con Erupción Cíclica (Fuego Fuerte). |
| **El Duelista Implacable** | Mismo tamaño que Santi; esgrima rápida, fintas y contraataques que leen al jugador. | Valida la cancelación de animaciones; castiga ataques fuertes lentos sin lectura previa. | Iniciar ataque pesado, leer su finta y cancelar con dash corto o Parry en el último cuadro. | *Aislamiento Táctico:* Detener al Duelista con Prisión del Bosque (4.0 s de FSM congelada) para limpiar la sala antes del duelo singular. |

---

## 5. Moralidad Implícita y Agencia Invisible: El Sistema de Karma

Siguiendo la regla de oro **Anti-AI Slop**, el jugador jamás ve un número, barra de alineamiento ni notificación moral en la interfaz. La variable global `karma_level` en `StateManager.js` opera de manera invisible (*Invisible Agency*):

| Vector de Evaluación Implícita | Acción Positiva ($\uparrow$) | Acción Negativa ($\downarrow$) | Consecuencia en el Mundo (*Show, Don't Tell*) |
| :--- | :--- | :--- | :--- |
| **1. Encuentros de Camino** | Desviarse para defender a civiles o mercaderes emboscados (+1 a +2). | Ignorar el combate para ahorrar vida/tiempo, o dejar morir a los civiles (-1 a -2). | *Caminos Seguros vs. Desiertos:* Mercaderes salvados reaparecen en ciudades vendiendo materiales raros; con karma bajo, las rutas se llenan de más patrullas. |
| **2. Conducta en Asentamientos** | Proteger estructuras en incursiones y dialogar con los habitantes tras liberar mazmorras (+1). | Destruir propiedades civiles, cosechas o puestos comerciales con poderes mágicos (-1). | *Estética Ambiental Reactiva:* Plazas luminosas, pobladas y florecientes vs. calles desiertas, puertas trancadas y vegetación marchita. |
| **3. Economía y Comercio** | Umbral positivo alto por auxilio desinteresado. | Umbral negativo por negligencia sistemática. | *Multiplicador de Precios:* Tiendas aplican $0.80\times$ (20% de descuento) y desbloquean mejoras de nivel 3; en karma bajo aplican $1.25\times$ por desconfianza. |
| **4. Diálogos Hub-and-Spoke** | Reconocimiento cálido del portador y revelación espontánea de secretos (`pared_falsa`). | Desconfianza, recelo y silenciamiento de pistas sobre tesoros locales. | *Resolución Climática (Acto III):* Determina la variante del final contra Vortigern sin preguntas de menú de última hora. |

### Los Dos Finales del Acto III
- **El Ascenso del Nuevo Amanecer (Karma Positivo Alto):** Los pueblos protegidos envían guerreros para apoyar el asedio al castillo. El Brazalete resuena con la voluntad unida del continente y purifica a Vortigern sin destruir la reliquia, culminando la misión de Caelus.
- **El Ciclo del Metal Frío (Karma Negativo / Indiferencia):** Santi asalta la fortaleza en soledad. Al derrotar a Vortigern, el villano agonizante le hace ver que para obtener poder sacrificó a los débiles, convirtiéndose en el nuevo tirano del Salón del Trono bajo la misma lluvia gélida.

---

## 6. Especificación de Datos para el Constructor de Niveles (Level Builder)

El motor funciona como un intérprete desacoplado de archivos `.json` estructurados:

| Capa del JSON Maestro | Estructura de Datos | Módulos Receptores | Función en Historia y Progresión |
| :--- | :--- | :--- | :--- |
| `level_meta` | `level_id`, `region_tier` (0 a 3), `isInterior` (boolean), `preload_next_assets` (array), `ambient_darkness` | `ResourceManager.js`, `LightManager.js`, `Camera.js` | Control de oscuridad global, límites de cámara y precarga asíncrona en pasillos estrechos. |
| `tilemap_layers` | Matriz de casillas con etiquetas: `solido`, `pared_falsa` (`required_damage`), `borde_caida` (`allowed_direction`) | `PhysicsSystem.js`, `Renderer.js` (Y-Sorting) | Traza rutas críticas y exploratorias, atajos de un solo sentido y secretos agrietados. |
| `light_sources` | Array de fuentes con `x`, `y`, `radius`, `color_gradient`, `flicker`, `requires_fire_ignition` | `LightManager.js` | Tensión visual y puzzles donde antorchas apagadas se encienden con Fuego. |
| `entity_spawns` | `prefab_type` (Artillero, Tanque, Manada, Duelista), `room_difficulty` (2 a 4), `scale_with_relic_tier` (boolean) | `EntityManager.js`, `CombatManager.js`, `ObjectPool.js` | Ritmo de salas y aplicación automática de mejoras al subir de Tier de mundo. |
| `logic_links` | `source_entity_id`, `event` (`on_death`, `on_ignite`), `target_id`, `action` (`open_door`, `camera_shake`) | `StateManager.js`, `Camera.js` | Automatización de cerraduras y llaves de mazmorra sin escribir código manual. |
| `dialogue_and_karma` | Nodos de diálogo condicionados por `min_karma`, `max_karma`, `karma_delta` y `shop_multiplier` | `InteractionSystem.js`, `StateManager.js`, `UIManager.js` | Diálogos reactivos y alteración económica orgánica según la conducta del jugador. |

---

## 7. Hoja de Ruta de Implementación en 4 Fases

1. **Fase 1: Vertical Slice del Prólogo y Túnel de Escape:** Cinemática del Salón del Trono, caída de Caelus, pasillo de streaming subterráneo, colisiones Y-Sort, iluminación interior (`isInterior = true`) y calibración del Parry de 0.15 s y HitStop de 0.08 s sin poderes mágicos.
2. **Fase 2: Laboratorio de Química Elemental y Sinergias:** Escena sandbox con las 4 clases de `Ability.js` (Fuego, Cinética, Raíces, Éter Magnético) enfrentadas a los 4 arquetipos de IA en `Enemy.js`, probando el drenaje de 3.0 s de inercia y el reciclaje de `ObjectPool.js`.
3. **Fase 3: Level Builder y Esquema JSON:** Editor visual in-engine para ensamblar las mazmorras de las cuatro ciudades aplicando las leyes de Espacio Compartido y los cuatro pasos del *Kishōtenketsu*.
4. **Fase 4: Red de Karma Invisible y Escalado Regional Híbrido:** Eventos de caminos interurbanos conectados a `karma_level`, diálogos con multiplicadores económicos (0.8x a 1.25x), tablas de spawn dinámicas por número de núcleos y bifurcación invisible de los dos finales en el Salón del Trono.
