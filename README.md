# Sistema Fën · v0.77.1

**App:** v0.77.1 · **Cocina:** v0.17.11 (sin cambios) · **Caja (fen-ventas):** v2.3.0 (sin cambios) · **Reglas de Firestore:** ninguna cambia (fen-ventas v1.5.0, fen-b2b v1.7.0, fen-produccion v1.8.0, fen-gastos v0.1.0) · **Logística (fen-logistica):** v1.3.1 · **Apps Script:** ninguno cambia · 22 de octubre de 2026
**Dirección:** https://panaderiafen.github.io/sistema-fen/

Solo entra la cuenta de administración (la misma de la caja). Sistema Fën es solo para el dueño: las jefas siguen en Cocina con su PIN, y logística usa su app (fen-logistica).

## Novedades de la v0.77.1: la Bodega se calcula sola

- **Producción → Bodega** calcula el stock al abrir la pestaña, sin tocar nada. Usa lo que Sistema Fën ya tiene en memoria: la primera vez gasta parecido a un "Calcular" de antes; si vuelves en los minutos siguientes, casi nada.
- El botón ahora dice **"Actualizar ahora"**: vuelve a leer todo (por ejemplo, justo después de un conteo en Cocina).
- Los correos de stock bajo siguen igual: como máximo uno al día por materia prima.
- **Dónde va:** repo **sistema-fen**, raíz. Cambia `vista-produccion.js`; los demás, solo la versión. Reglas y Apps Script sin cambios.

### Lista de verificación v0.77.1
- [ ] Abajo dice **v0.77.1**.
- [ ] Producción → Bodega muestra el stock sin tocar "Calcular".

## Novedades de la v0.77.0: Producción en pestañas

Producción deja de ser una página larga con tarjetas y pliegues: ahora tiene **siete pestañas**, como Gastos, Ventas B2B y el Catálogo, en este orden: **Por revisar · Plan de Panadería · Recetas · Materias primas · Bodega · Merma · Configuración**. Abre siempre en **Por revisar**, que lleva el número de lo que espera. En el celular las pestañas se pasan con el dedo. Es el diseño aprobado (`diseno/produccion-rediseno.html`). No cambia ningún dato, ni Cocina, ni las reglas.

- **Dónde va:** repo **sistema-fen**, raíz. Archivos nuevos: `recetas-ver-modelo.js` (qué cambió entre versiones, el costo y su variación; reglas puras) y `vista-prod-recetas.js` (la pestaña Recetas). Cambian `vista-produccion.js` (las pestañas; Por revisar; Configuración → Cocina), `vista-plan-pan.js` (es una pestaña), `vista-finanzas.js` (el maestro de materias primas se dibuja en Producción; en Finanzas, el enlace), `finanzas.js` (el costo de todas las propuestas de una vez; los costos guardados para Recetas), `produccion.js` (costear varias; versiones anteriores al pedirlas), `app.js` (Hoy y Configuración → Cocina), `finanzas-eerr.js`, `vista-productos.js`, `vista-catalogo.js` (enlaces), `estilos.css` y este README; los demás, solo la versión. `cocina/` y `fermentacion.js` **no cambian** (idénticos a Cocina v0.17.11).
- **Cocina:** sin cambios (v0.17.11). **Reglas:** sin cambios (lo revisé: todo lo que se lee o escribe ya estaba permitido; las versiones anteriores `versiones/{id}_v{n}` las lee la administración con fen-produccion v1.8.0). **Apps Script:** ninguno.

### Qué cambia en cómo trabajas
| Antes | Ahora |
|---|---|
| Tarjeta "Desde Cocina" | **Producción → Por revisar** (`#produccion`) |
| Tarjeta "Plan de Panadería" (página aparte) | **Producción → Plan de Panadería** (`#produccion/plan-pan`, con Cómo nos fue y Ainavillo y pisos) |
| — | **Producción → Recetas** (nueva, solo para mirar; `#produccion/recetas`) |
| Finanzas → Costos → Materias primas | **Producción → Materias primas** (`#produccion/mp`); en Finanzas queda un enlace |
| Pliegue Bodega / Merma | **Producción → Bodega** / **Merma** |
| Pliegues Configuración de Producción y Pasar recetas de Bollería a Pastelería | **Producción → Configuración** |
| Pliegue Cuentas de las áreas y la conexión con la base | **Configuración → Cocina** (`#ajustes/cocina`) |
| Pliegue Recetas y materias primas (solo números) | Desaparece: los números van arriba de Recetas y de Materias primas |

1. **Por revisar:** cada receta por aprobar dice en su fila **qué cambió** (por ejemplo "Agua 70 % → 72 % · Rinde 10 un → 9 un · Pasos 2 → 3": en % de panadero cuando la receta tiene harina, si no en gramos; ingredientes nuevos y los que salen; insumos y notas) y **cuánto cambia el costo** ("Costo por unidad $485 → $539 (+11,1 %)"; si rinde gramos, el lote y el kilo). Una receta nueva dice su costo por unidad. Si falta un precio lo dice ("sin precio: …") y si un ingrediente no está en la base de Cocina, también (no se puede aprobar). Al tocar **Revisar** se abre lo de siempre (la tabla, ahora con el % al lado de los gramos, el costo por ingrediente, el lote y la unidad) con **Aprobar** y **Devolver**. Las materias primas pedidas se crean o habilitan igual que antes. Las (i) de siempre siguen ahí; aprobar no se bloquea.
2. **Recetas** (solo para mirar): las recetas aprobadas de la base de Cocina, por área y tipo (**Productos** o **Masas y sub recetas**), con buscador. Cada una con su rendimiento, versión, quién y cuándo se aprobó, y su **costo neto por unidad** (o por kg) con la **flecha y el %** contra su costo anterior y desde cuándo valía ese costo. Al abrir una: ingredientes (g y %), insumos, pasos, notas, el enlace **Ver en Finanzas → Costos → Productos** y **Versiones anteriores** (cada aprobación guarda la anterior): elige una y ves qué cambió contra la vigente. Las archivadas, con "Ver solo las archivadas". Archivar o reactivar sigue en el Catálogo.
3. **Si cambia el costo, ¿dónde se ve?** (lo explica la (i) de Recetas): en **Hoy**, el aviso "Subió el costo de N productos" (de Finanzas, sobre el % de aviso contra el mes anterior); en **Producción → Recetas**, la flecha con el % de cada receta; y el análisis completo en **Finanzas → Costos → Productos** (qué materia prima lo movió, historial y detalle).
4. **Materias primas:** es la misma pantalla de la v0.76.0 (crear, cambiar nombre, categoría y áreas, archivar y reactivar, el precio a la vista, las parecidas), un solo componente, ahora en Producción; arriba dice cuántas hay en la base de Cocina. Se ve aunque la base de Cocina no esté conectada (sin crear ni cambiar). En **Finanzas → Costos**, la pastilla Materias primas muestra "Las materias primas están en Producción → Materias primas" con el botón para ir. **Compras del SII → "Crear desde esta línea"** sigue igual y, al crear, el mensaje trae "Verla en Producción → Materias primas".
5. **Bodega, Merma y Configuración:** lo mismo de antes, cada una en su pestaña (Calcular y Ver se piden igual que antes).
6. **Configuración → Cocina:** la conexión con la base de Cocina (pegar la configuración, entrar, marcar administración) y las **Cuentas de las áreas** (las tablets). Si la base no está conectada, Producción lo dice y lleva ahí.
7. **Enlaces:** en Hoy, "recetas de Cocina por aprobar" y "materias primas pedidas" llevan a Por revisar; "Bajo el mínimo" a **Bodega**; el conteo del cierre de mes (Finanzas) también a Bodega; "Ver en Producción" de Revisión de datos abre esa receta; "Conéctala en…" lleva a Configuración → Cocina. Los enlaces viejos siguen funcionando: `#produccion/revisar`, `/desde-cocina` → Por revisar; `/materias-primas` → Materias primas; `/configuracion`, `/mover` → Configuración; `/cuentas` → Configuración → Cocina; una ruta que no existe → Por revisar; `#finanzas/costos` → el enlace a Producción.

### Lecturas (Spark), medidas con Firebase simulado (`pruebas/capturas/produccion-tabs-v0770/lecturas.json`)
Cada pestaña lee solo lo suyo al abrirla. Lecturas estimadas (documentos + 1 por pedido, como en Configuración → Uso de la base):

| Pestaña | Primera vez (Cocina / Gastos) | Al volver (Cocina / Gastos) | Qué lee |
|---|---|---|---|
| Por revisar | 6 / 19 | 6 / 0 | las propuestas en revisión y las pedidas (2 consultas, 1 lectura por cada una); el costo: los precios de la memoria de fen-gastos, **una sola vez para toda la lista** (antes, al abrir cada una) |
| Plan de Panadería | 0 / 4 | 0 / 0 | lo de siempre (su pie de lecturas; caja y B2B aparte) |
| Recetas | 0 / 2 | 0 / 2 | recetas: de la memoria (0); costos guardados de Finanzas (memoria de fen-gastos). Abrir una: 0. **Versiones anteriores: 1 lectura por versión**, solo al tocar el botón |
| Materias primas | 0 / 8 | 0 / 4 | como en Finanzas (precios, revisión, por confirmar; memoria de fen-gastos) |
| Bodega / Merma | 0 / 0 | 0 / 0 | nada hasta Calcular / Ver (igual que antes) |
| Configuración | 2 / 0 | 0 / 0 | configuración de la memoria; la fermentación en bloque y el ajuste de sábado (como antes al abrir el pliegue) |
| Número de Por revisar (en las otras pestañas) | — | — | el mismo resumen de Hoy (limit + count, 2 minutos en memoria) |

Con datos reales, Por revisar cuesta 1 lectura por propuesta y por pedido (hoy, unas pocas). Antes, abrir Producción leía de una vez las cuentas, los totales (con un conteo de personas) y lo que llegó de Cocina; ahora eso queda en sus pestañas o en Configuración → Cocina.

### Instalación v0.77.0 (unos 3 minutos)
1. **Sistema Fën v0.77.0:** GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.77.0.zip` (con la carpeta `cocina/`, que no cambia, y los archivos nuevos `recetas-ver-modelo.js` y `vista-prod-recetas.js`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).
2. Cocina, reglas y Apps Script: nada.

### Lista de verificación v0.77.0
- [ ] Abajo dice **v0.77.0**.
- [ ] **Producción** abre en **Por revisar** con las siete pestañas en orden; si hay algo esperando, la pestaña tiene su número. En el celular las pestañas se pasan con el dedo y la página no se mueve de lado.
- [ ] Por revisar: una receta cambiada dice qué cambió y "Costo por unidad $… → $…"; **Revisar → Aprobar** y **Devolver** funcionan como antes; una materia prima pedida se crea o habilita.
- [ ] **Recetas:** filtra por área y tipo; una receta con costo muestra la flecha y el %; ábrela → ingredientes con g y %, pasos; **Ver la versión anterior** compara con la vigente.
- [ ] **Materias primas:** está el maestro (Nueva materia prima o insumo, tocar una fila, Nombre, categoría y áreas). En **Finanzas → Costos → Materias primas** aparece solo el enlace; Compras del SII → Crear desde esta línea sigue y ofrece "Verla en Producción → Materias primas".
- [ ] **Bodega** (Calcular), **Merma** (Ver) y **Configuración** (por área, fermentación en bloque, ajuste de sábado, pasar recetas) como siempre.
- [ ] **Configuración → Cocina:** dice Conectada y muestra las Cuentas de las áreas.
- [ ] **Hoy:** "Bajo el mínimo" lleva a Producción → Bodega; las recetas por aprobar, a Por revisar.

**Si algo sale mal:** vuelve a subir la v0.76.0. No se pierde nada: esta versión no cambia datos (solo dónde se ve cada cosa).

**Pruebas:** `pruebas/sistemafen/produccion-tabs-v0770.test.js` (12/12) y las demás suites (`pruebas/resultados-v0770.txt`, con `pruebas/correr-v0770.sh`). Capturas de cada pestaña a 390 y 1280, Configuración → Cocina y el enlace de Finanzas en `pruebas/capturas/produccion-tabs-v0770/`.

## Novedades de la v0.76.0: crear y cambiar materias primas e insumos desde Finanzas

Hasta ahora una materia prima solo nacía cuando Cocina la pedía. Desde esta versión la creas tú en **Finanzas → Costos → Materias primas**, o directo desde una factura en **Compras del SII**. La base de Cocina sigue siendo la maestra (mismo ID, misma regla) y el precio sigue viviendo solo en Finanzas.

- **Dónde va:** repo **sistema-fen**, raíz. Archivo nuevo: `mp-alta-modelo.js`. Cambian `produccion.js` (alta compartida con las pedidas, cambiar, archivar), `recetas-maestro.js`, `finanzas.js`, `vista-finanzas.js`, `estilos.css` y este README; los demás, solo la versión. `cocina/` y `fermentacion.js` **no cambian** (idénticos a Cocina v0.17.10).
- **Cocina v0.17.10:** repo **fen-cocina**, raíz. Cambian `editor.js`, `app.js`, `config.js`, `index.html` y su README (zip `fen-cocina-v0.17.10.zip`).
- **Reglas:** sin cambios. Lo revisé: fen-produccion v1.8.0 ya deja a la administración escribir `mps` y `recetas` (`allow write: if admin()`), y fen-gastos v0.1.0 deja escribir todo a la administración (`costos_mp`, `costos_mp_hist`, `costos_asoc`). **Apps Script:** ninguno.

### Qué cambia en cómo trabajas
1. **Nueva materia prima o insumo** (botón arriba del Maestro de materias primas): nombre, si es materia prima o insumo, categoría (te sugiere las que ya existen), unidad de compra con lo que trae (por ejemplo 25kg → 25 kg; 10un → te pregunta si el precio es por las 10 o por 1), precio neto de esa unidad (o con IVA, marcando la casilla) y las **áreas** que la ven en Cocina (sin marcar ninguna = todas, lo explica la (i)). Queda en la base de Cocina con el ID que sigue (MP### o IN###, la misma regla y la misma transacción que una pedida) y su precio aquí, "A mano", con su historial ("Creada en Sistema Fën").
2. **Nombre único:** si el nombre ya existe (sin importar mayúsculas, tildes ni espacios), aunque esté inactiva o archivada, te lo dice al escribir y te ofrece **abrir esa** (para habilitarle un área o reactivarla) en vez de crear otra. Mientras escribes, también te muestra **las 3 más parecidas** ("¿Es alguna de estas?").
3. **Nombre, categoría y áreas** (toca una fila del maestro → botón "Nombre, categoría y áreas"): cambiar el nombre no rompe nada porque las recetas guardan el ID; el nombre nuevo se ve en Cocina, en la copia del nombre dentro de las recetas que la usan (sin cambiarles la versión) y en Finanzas. Si a una harina le sacas la palabra "Harina" te avisa (Cocina la reconoce por el nombre).
4. **Archivar / Reactivar** (en el mismo diálogo): archivar la saca de Cocina (no se ofrece para elegir ni para pedir); **no se puede** si una receta viva (no archivada) la usa, y te dice cuáles. Nada se borra. Reactivar la deja activa con sus mismas áreas. Cada cambio queda en el historial de la materia prima y en el historial de Sistema Fën.
5. **Compras del SII → "Crear desde esta línea"** (en los productos sin asociar): abre el mismo diálogo lleno con la factura: el nombre limpio ("HNA PANADERA 25KG" → "Harina panadera"), lo que trae una unidad (la misma lectura de Asociar), el precio neto de la última compra y si parece insumo. Al guardar crea la materia prima **y asocia** ese producto del proveedor a ella (se aprende para las próximas facturas), con el precio de esa compra (origen SII). Si cambias el precio, queda "A mano". Si el nombre ya existe, te ofrece **Asociar a esa**.
6. **Asociar** (lo de siempre) ahora muestra arriba **las 3 más parecidas**, también cuando el proveedor la llama distinto o abreviada (HNA = harina, MANTEQ = mantequilla, S/SAL = sin sal…): toca "Usar esta". Y si no está, "No está: crear desde esta línea".

### Cómo queda guardado (para el que venga)
- **fen-produccion** `mps/{MP###|IN###}`: lo de siempre (`docMp`) + `areas` (lista; vacía = todas), `origen { base: 'sistema-fen', manual: true, sii? { rut, proveedor, nombreItem } }`, `historial [{ accion creó|cambió|archivó|reactivó, detalle, por, en }]` (últimos 50); al archivar `estado 'archivada', estadoAntes, archivadaPor, archivadaEn`; al reactivar `estado 'activa', reactivadaPor, reactivadaEn`. `recetas/{id}.ingredientes[].nombre` / `insumos[].nombre` se actualizan al cambiar el nombre (el ID no cambia).
- **fen-gastos** `costos_mp/{id}`: `origen 'manual'` (o `'sii'` con `sii { rut, proveedor, folio, fecha, linea, nombreItem }` si el precio es el de la línea), `creadaDesde 'sistema-fen'`; `nombre` y `estado` se copian al cambiarlos. `costos_mp_hist` con el motivo. `costos_asoc/{rut__nombre}` con nota "Creada desde esta línea".

### Lecturas y escrituras (Spark)
- **Abrir el diálogo:** 0 lecturas (las materias primas y recetas ya están en la memoria compartida con Hoy y Producción).
- **Crear:** 1 transacción en la base de Cocina (1 lectura + 1 escritura) + la marca de cambio (1 escritura); en Finanzas 1 transacción (1 lectura + 2 escrituras). Desde una línea: + la asociación (2 lecturas, 2 escrituras) y la revisión de compras de siempre.
- **Cambiar / archivar:** 1 transacción (1 lectura + 1 escritura) + la marca; un cambio de nombre escribe además 1 documento por receta que la usa; en Finanzas 1 lectura (+1 escritura si cambia).
- Nadie vuelve a leer las ≈ 300 materias primas por un cambio tuyo: la memoria queda con lo nuevo (como al resolver un pedido de Cocina). Las tablets ven el cambio con la marca de cambio.

### Instalación v0.76.0 (unos 5 minutos)
1. **Sistema Fën v0.76.0:** GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.76.0.zip` (con la carpeta `cocina/`, que no cambia, y el archivo nuevo `mp-alta-modelo.js`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).
2. **Cocina v0.17.10:** GitHub, repo **fen-cocina**, raíz → sube los archivos del zip `fen-cocina-v0.17.10.zip` → **Commit changes**. En cada tablet, cierra y abre la app.
3. Reglas y Apps Script: nada.

### Lista de verificación v0.76.0
- [ ] Abajo dice **v0.76.0**; en las tablets, **Cocina v0.17.10**.
- [ ] Finanzas → Costos → Materias primas → **Nueva materia prima o insumo**: escribe el nombre de una que ya existe → dice "Ya existe…" con "Abrir esa". Crea una de prueba (por ejemplo "Prueba ficticia", 1kg, $1.000, solo Panadería) → aparece en la lista con su precio por kg.
- [ ] En la tablet de Panadería, al agregar un ingrediente aparece "Prueba ficticia"; en la de Cafetería, no.
- [ ] Toca su fila → **Nombre, categoría y áreas** → cámbiale el nombre y suma Cafetería → Guardar; en la tablet de Cafetería ahora aparece con el nombre nuevo.
- [ ] En el mismo diálogo → **Archivar** → en la tablet ya no aparece (ni en "Falta una materia prima"). Una que usa una receta viva (por ejemplo la sal) no deja archivar y dice cuál receta.
- [ ] Compras del SII: en un producto sin asociar, **Asociar** muestra "Las más parecidas"; **Crear desde esta línea** abre el diálogo lleno; al guardar el producto queda asociado y el precio dice "SII".
- [ ] Hoy y Producción abren normal.

**Si algo sale mal:** vuelve a subir la v0.75.1 (y Cocina v0.17.9). No se pierde nada: lo creado queda en la base de Cocina y en Finanzas (las versiones anteriores lo muestran igual; solo no tienen los botones nuevos). Ojo: Cocina v0.17.9 ofrecería las archivadas en "Falta una materia prima" (al habilitarlas desde Producción se reactivan).

**Pruebas:** `pruebas/sistemafen/mp-crear-v0760.test.js` (12/12) y las demás suites (`pruebas/resultados-v0760.txt`, con `pruebas/correr-v0760.sh`). Capturas en `pruebas/capturas/mp-crear-v0760/` (lista y diálogo a 390 y 1280, datos y archivar, asociar con parecidas, crear desde una línea a 390 y 1280, Cocina sin las archivadas).

## Novedades de la v0.75.1: habilitar una materia prima inactiva

- **Arreglo:** cuando Cocina pide habilitar una materia prima que estaba **inactiva**, al tocar "Habilitar" en Producción → Materias primas pedidas ahora también se **reactiva** (antes solo se le sumaba el área y seguía sin aparecer en Cocina). Va con Cocina v0.17.6, que ahora ofrece las inactivas para habilitar.
- **Dónde va:** repo **sistema-fen**, raíz. Cambia `produccion.js`; los demás, solo la versión.
- **Reglas y Apps Script:** sin cambios.

### Lista de verificación v0.75.1
- [ ] Abajo dice **v0.75.1**.
- [ ] Producción → Materias primas pedidas: los pedidos de Cocina aparecen; "Habilitar" en una inactiva la deja activa y con el área.
- [ ] Hoy muestra las recetas por aprobar y las materias primas pedidas.

## Novedades de la v0.75.0: Catálogo, Etapa 2b (la caja solo vende y pide; un ID para cada precio especial; sin planillas)

Decisiones tuyas (plan de coherencia): un dueño por cosa; unir por ID, nunca por nombre; se crea en un solo lugar y los demás piden; una sola lista de áreas (`areas.js`); la venta guarda su foto; nada se borra. En esta entrega: **la caja ya no crea ni cambia productos** (los pide), **la reventa tiene un solo código (REVENTA)**, **cada precio especial de B2B va pegado al ID de su producto**, **el despacho va en el bloque del canal B2B** del estado de resultados y **ya no queda ninguna copia a las planillas** (caja, merma de la caja, Cocina).

- **Dónde va:** repo **sistema-fen**, raíz. Cambian `areas.js` (las pestañas de la caja y el alias REV → REVENTA), `caja.js` (cierres sin planilla, resumen con la foto, áreas fijas), `stock.js` (merma sin planilla), `app.js` (Hoy, Ventas de caja, Configuración, Ventas B2B → Clientes: unir los precios especiales), `ajustes.js`, `b2b-modelo.js` y `b2b.js` (precios especiales por ID), `catalogo-productos-modelo.js` y `vista-productos.js` (la reventa va a la pestaña Reventa de la caja), `finanzas-ventas.js` (REV = REVENTA; la foto de la caja), `finanzas-eerr.js` y `vista-finanzas-eerr.js` (bloque del canal B2B), `produccion.js` y `vista-produccion.js` (la merma solo con costos_mp), `estilos.css`, `firestore.rules` (**v1.5.0**); los demás, solo la versión. `cocina/` y `fermentacion.js` **no cambian** (siguen idénticos a Cocina v0.17.5, que no cambió sus módulos compartidos).
- **Caja v2.3.0:** zip `caja-v2.3.0.zip` (ver su README). **Cocina v0.17.5:** zip `fen-cocina-v0.17.5.zip`. **Logística v1.3.1:** zip `fen-logistica-v1.3.1.zip`.
- **Apps Script:** ninguno cambia. Opcional: borrar el activador nocturno de B2B (paso 6 de la instalación).

### Qué cambia en cómo trabajas
1. **La caja (v2.3.0) solo vende lo habilitado y pide lo que falta.** Ya no tiene formulario de producto, ni lista de recetas de la planilla, ni vincular recetas, ni áreas, ni equivalencias de nombres, ni "Ventas mensuales hacia fën". Las cajeras usan **Pedir producto** (nombre, precio sugerido con IVA y nota): el pedido llega a **Hoy** ("N productos pedidos") y a **Catálogo → Productos → Pedidos**, con "Caja · Barros Arana · cajera@…". Lo resuelves como en la v0.74.0 (Crear desde su receta o reventa, o Habilitar) o lo rechazas con un motivo; la cajera ve "Aprobado" o "Rechazado" con la respuesta en **Tus pedidos**. La administración ve en la caja la lista de productos **solo para mirar**.
2. **Reventa con un solo código: REVENTA.** La caja muestra la pestaña **"Reventa"** con los productos de área REVENTA y los antiguos de área **REV** (REV se lee como REVENTA en todas partes: la historia de la caja, los resúmenes de cierre, Ventas de caja → Reportes, Finanzas). En **Catálogo → Productos**, una reventa ya **no elige pestaña**: va siempre a "Reventa" (el diálogo lo dice). Una receta o un cargo eligen su pestaña como antes. Las pestañas de la caja son las de `areas.js`: Panadería, Bollería, Pastelería, Cafetería y Reventa.
3. **"Sin área" nunca es Bollería.** Un producto de la caja con un área que no está en la lista (o vacía) sale en la caja en la pestaña "Sin área" y en la lista de la administración con su aviso; en los resúmenes cuenta como "Otros". Corrígelo en el Catálogo (Cambiar → pestaña de la caja).
4. **La venta guarda su foto también en la caja:** cada línea lleva `catalogoId`, `tipo`, `area`, `recetaId` o `reventaId` y, si el producto las tiene, `unidadesPorVenta` (la copia de la caja que escribe el Catálogo ahora las incluye). Finanzas la usa primero (como con las órdenes B2B). Si la foto no trae unidades por venta (productos que todavía no cambiaste en el Catálogo), usa las del maestro o de Asociar productos.
5. **Precios especiales de B2B por ID** (Ventas B2B → **Clientes**, arriba, una sola vez): **"Unir los precios especiales a su producto"**. Los que tienen el mismo nombre que un producto se unen solos (primero el nombre exacto, después sin tildes ni mayúsculas; si hay dos con el nombre, el que no está archivado). Los que no calzan —el producto se llama distinto, hay varios con ese nombre o su producto ya no existe— los **eliges de la lista** (no escribes IDs). **"Unir N precios"** solo agrega el ID: el nombre y el precio no cambian, nada se borra. Desde ahí, Sistema Fën y logística (v1.3.1) buscan cada precio especial **por el ID del producto**; el nombre solo sirve para un precio antiguo que todavía no tiene ID (los que dejes sin elegir siguen funcionando así). Cuando ya no queda nada por unir, la tarjeta desaparece.
6. **Estado de resultados (Finanzas → Resultados):** un bloque nuevo **"Canal B2B · despacho y costos del canal"** entre el margen del área y los comunes, con una cifra en Total: **+ Despacho cobrado** (el cargo del Catálogo que se cobra solo a B2B) **− Costos del canal B2B** (remuneraciones y fijos con área B2B: atención de clientes, órdenes y despacho, que antes iban a Común) **= Resultado del canal B2B**. El despacho ya no está en Común ni en el margen de contribución. **El resultado operacional y el del mes no cambian.** Aparece solo si el mes (o el anterior, al comparar) tiene algo. Un mes cerrado antes se ve como quedó; sus ajustes se calculan en la forma de entonces, así que el cambio no genera "Ajustes de meses cerrados". En la vista "Comunes repartidos", el resultado del canal B2B va en Común (el total sigue siendo el operacional).
7. **Sin copias a planillas:** los cierres de caja ya **no se pasan a la planilla** (ni desde la caja ni desde Sistema Fën), ni la merma de la caja, ni el correo de descuadre por script. En **Ventas de caja**, "Cierres sin pasar a planilla" pasa a ser **"Cierres sin resumen"** (solo si un resumen no alcanzó a guardarse: "Generar resumen") y ya no está "Merma sin pasar a planilla". En **Hoy** ya no aparece "Cierre sin pasar a planilla" (y Hoy ya no lee las cajas de 60 días); aparece "Cierre sin resumen" si hiciera falta. **Cocina v0.17.5** tampoco copia nada a la planilla de Producción.
8. **Merma de Producción** (Producción → Merma y el estado de resultados): se costea **solo** con los costos de Finanzas (`costos_mp`, Finanzas → Costos). Ya no se piden costos a la planilla: lo que no tiene costo ahí queda "sin costo" (no suma) y lo que le falta algún precio dice "costo incompleto".
9. **Configuración:** "Recetas sin producto en la caja" (que leía la lista de la planilla) se reemplaza por un enlace a **Catálogo → Productos**. Las subcategorías se ordenan por las áreas de la caja (las de `areas.js`, con Reventa).

### Cómo queda guardado (para el que venga)
- **fen-ventas** `ventas/{id}.lineas[]`: + `catalogoId, tipo, area, recetaId, reventaId` (+ `unidadesPorVenta` si el producto la tiene). `resumenes_caja/{cajaId}.porProducto[id]`: + `catalogoId, tipo, recetaId, reventaId` (+ `unidadesPorVenta`), `versionCaja '2.3.0'`. `cajas/{id}.resumenPendiente` (true solo si el resumen no se guardó; ya no se escriben `exportadaSheets` ni `exportPendiente`).
- **fen-ventas** `productos/{docId}` (lo escribe solo Sistema Fën): + `unidadesPorVenta`. Una reventa, `area: 'REVENTA'`.
- **fen-ventas** `solicitudes_producto/{id}` (la caja v2.3.0) = `{ tipo 'producto', nombre, sucursal, precioSugerido | null, nota, estado 'pendiente', por, en }`; al resolver (como en la v0.74.0): `estado, catalogoId, productoId, respuesta, resuelta`.
- **fen-ventas** `merma/{id}` (Sistema Fën): ya no lleva `enPlanilla`.
- **fen-b2b** `clientes/{id}.precios[]`: `{ producto, productoId, precio }` + `unidoPorId { como 'exacto'|'normalizado'|'elegido', por, en, antes? }` en los que se unieron; `clientes/{id}.preciosPorId { en, por, n }`; `config/preciosPorId = { en, por, unidos, clientes, pendientes }`.
- **Estado de resultados** (`fin_cierres/{AAAA-MM}` desde esta versión): filas nuevas `canalB2B` y `resCanalB2B`; `cargos` (despacho) se guarda en la celda `comun` y se muestra en Total; `info.canalB2B = { rem, fijos, total }`.
- **Áreas** (`areas.js`): `CAJA = PAN, BOL, PAS, CAF, REVENTA`, `ALIAS { REV: REVENTA }`, `deCaja(a)` (una de CAJA o `SIN`).

### Lecturas y escrituras (Spark)
- **Hoy:** **menos** — ya no lee las cajas de 60 días (≈ 120 lecturas cada 10 minutos): solo las abiertas desde ayer (para las ventas de hoy, ≈ 2–4) y 1 consulta de cierres sin resumen (casi siempre 1 lectura).
- **Ventas de caja → Cierres:** igual (sin el reenvío a la planilla). **Merma:** sin la consulta de merma sin planilla (−1 consulta) y sin llamadas al script.
- **Unir los precios especiales:** 0 lecturas al abrir (los clientes y productos ya están en vivo); al unir, 1 transacción por cliente (1 lectura y 1 escritura) + 1 escritura de `config/preciosPorId`.
- **Configuración:** sin la lectura de la lista de recetas de la planilla ni de las áreas de la caja (−1 consulta).
- **Merma de Producción:** sin la llamada al script de costos.

### Reglas de Firestore
- **fen-ventas v1.5.0 (obligatoria, antes de subir la caja v2.3.0):** `productos`: crear, cambiar y borrar solo la administración; la cajera solo marca `tuvoVentas` (true) al vender. `areas`: solo la administración. `solicitudes_producto`: la cajera crea **su** pedido, pendiente, con los campos de siempre (tipo 'producto', nombre de 2 a 120 letras, sucursal Ainavillo o Barros Arana, por = su correo, en; precio sugerido > 0 y nota de hasta 300, opcionales) y lee los suyos; la administración los lee y los resuelve; nada se borra. **Todo lo demás queda idéntico a la v1.4.0.**
- fen-b2b v1.7.0, fen-produccion v1.8.0 y fen-gastos v0.1.0: sin cambios.

### Instalación v0.75.0 (unos 15 minutos, en este orden)
1. **Reglas de fen-ventas v1.5.0:** consola de Firebase → proyecto **fen-ventas** → Firestore Database → pestaña **Reglas** → borra todo y pega `firestore.rules` (de este zip; arriba dice v1.5.0) → **Publicar**.
2. **Caja v2.3.0:** GitHub, repo **fen-ventas**, **raíz** → **Add file → Upload files** → `index.html` del zip `caja-v2.3.0.zip` → **Commit changes**. Recarga los equipos de caja (Ctrl+Shift+R en el PC; en la tablet, cerrar y abrir).
3. **Sistema Fën v0.75.0:** GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.75.0.zip` (con la carpeta `cocina/`, que no cambia) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).
4. **Cocina v0.17.5:** repo **fen-cocina**, raíz → sube los archivos del zip `fen-cocina-v0.17.5.zip` → Commit. En cada tablet, cerrar y abrir la app.
5. **Logística v1.3.1:** repo **fen-logistica**, raíz → sube los archivos del zip `fen-logistica-v1.3.1.zip` → Commit. En el celular de logística, cerrar y abrir la app.
6. *(Opcional)* **Borrar el activador nocturno de B2B** (`tareaNocturnaB2B`, el que arma las "Hojas para Producción" cada noche a las 3–4 am; ya nada las lee):
   1. Abre la **planilla de B2B** en Google Sheets → menú **Extensiones → Apps Script** (se abre el proyecto del script de B2B).
   2. En la barra de la izquierda, toca el **reloj** (**Activadores**).
   3. Busca la fila cuya columna **Función** dice **`tareaNocturnaB2B`** (evento "Basado en el tiempo", "Temporizador por días").
   4. A la derecha de esa fila, toca los **tres puntos verticales (⋮)** → **Eliminar activador** → en el aviso, **Eliminar** (o "Eliminar permanentemente").
   5. Listo: la fila desaparece. No se borra ninguna función ni ninguna hoja; las "Hojas para Producción" quedan como estaban (historial). Si algún día la quisieras de vuelta: en el editor elige `instalarTareaNocturna` → **Ejecutar**.

### Lista de verificación v0.75.0
- [ ] **Reglas:** en la consola de fen-ventas → Reglas, arriba dice **v1.5.0**.
- [ ] **Caja:** Productos dice **Caja v2.3.0**; no hay formulario de producto; las pestañas incluyen **Reventa** (con lo que antes estaba en REV); una venta de prueba se cobra igual.
- [ ] **Caja → Pedir producto** (un nombre de prueba) → **Hoy** dice "1 producto pedido" → Catálogo → Productos → Pedidos: Crear o Rechazar → en la caja, "Tus pedidos" dice Aprobado o Rechazado.
- [ ] **Catálogo → Productos → Nuevo producto → Una reventa:** no pide pestaña ("una reventa va siempre ahí"); en la caja aparece en Reventa.
- [ ] **Ventas B2B → Clientes:** arriba "Unir los precios especiales a su producto": revisa "Se unen solos", elige los de la lista y toca **Unir**; al terminar dice "Listo: N precios especiales quedaron unidos…". Abre un cliente: cada precio especial muestra la base de su producto.
- [ ] **Logística v1.3.1:** una orden para un cliente con precio especial dice "precio especial" con su precio.
- [ ] **Finanzas → Resultados** de este mes: si hubo despacho, el bloque **Canal B2B** (Despacho cobrado − Costos del canal B2B = Resultado del canal B2B); el resultado del mes es el mismo que antes de subir. Un mes cerrado se ve igual que antes y sin "Ajustes" nuevos.
- [ ] **Ventas de caja:** cerrar una caja anterior funciona sin avisos de planilla; no aparece "Cierres sin pasar a planilla" ni "Merma sin pasar a planilla". **Hoy:** no aparece "Cierre sin pasar a planilla".
- [ ] **Producción → Merma:** el total sale; no dice "costo de la planilla".
- [ ] **Cocina v0.17.5:** abajo dice Cocina v0.17.5; un número del plan se guarda sin aviso de planilla.
- [ ] *(Si hiciste el paso 6)* En Apps Script → Activadores ya no está `tareaNocturnaB2B`.

**Si algo sale mal:** vuelve a subir la v0.74.0 (y la caja v2.2.0, Cocina v0.17.4, logística v1.3.0). No se pierde nada: los pedidos de la caja, los IDs de los precios especiales y la foto de las ventas quedan guardados (las versiones anteriores simplemente no los usan). Ojo: con las reglas v1.5.0, la caja v2.2.0 ya no deja a las cajeras crear productos ni áreas (vender y cerrar sí); si necesitas volver del todo, vuelve a publicar las reglas v1.4.0 (`firestore.rules` del zip de la v0.74.0). La v0.74.0 vuelve a encender la copia de los cierres a la planilla desde Sistema Fën, y Cocina v0.17.4 la de los planes y registros: lo hecho mientras estuvieron apagadas no se copia solo.

**Pruebas:** `pruebas/sistemafen/etapa2b-v0750.test.js` (la caja v2.3.0 en el navegador con Firebase simulado, las reglas v1.5.0, los precios por ID, el bloque del canal B2B, Cocina sin copias) y las demás suites (`pruebas/resultados-v0750.txt`, con `pruebas/correr-v0750.sh`). Capturas en `pruebas/capturas/etapa2b-v0750/` (la caja con la pestaña Reventa y el diálogo Pedir producto a 390, 768 y 1280; Unir los precios especiales a 390 y 1280). Todas pasan salvo b2b-v013 #10 y b2b-v014 #3 (dependen del calendario, igual que en la v0.74.0). Se ajustaron (cambio a propósito, no regresión): `ajuste-sabado-v0721` y `etapa1-v0730` (Cocina v0.17.5), `finanzas-f1c` y `cocina-p1` (merma valorizada solo con el motor; Cocina sin copias a la planilla), `cuentas-boletas-v0700` (lo del área B2B va al bloque del canal B2B), `e2e` ("Cierre sin resumen", cierres y merma sin script, Ajustes sin "Recetas sin producto"), `caja-tarjetas-v0701` (compara con la caja v2.3.0) y `catalogo-v0740` (reventa en REVENTA, Despacho en el canal B2B).

## Novedades de la v0.74.0: Catálogo, Etapa 2 (un solo catálogo de productos)

Decisiones tuyas (plan de coherencia): un dueño por cosa; unir por ID, nunca por nombre; se crea en un solo lugar y los demás piden; una sola lista de áreas (`areas.js`); la venta guarda su foto; nada se borra (se archiva). **Los productos se crean solo aquí, por ti**, siempre desde una **receta aprobada** de Cocina, una **reventa** (Catálogo → Reventa) o como **cargo** (Despacho, que se cobra solo a B2B). Tú habilitas cada producto en la caja y/o en B2B con su precio; la caja y logística **solo piden**. El tipo "armado" (varias recetas con sus gramos) queda en el modelo, sin pantalla (Pastelería en pausa).

- **Dónde va:** repo **sistema-fen**, raíz. Archivos nuevos: `catalogo-productos-modelo.js` (reglas puras), `catalogo-productos.js` (lecturas y escrituras), `vista-productos.js` (pestañas Productos y Armar el catálogo). Cambian `vista-catalogo.js` (pestañas; un producto unido se archiva en Productos), `catalogo-modelo.js`, `caja.js` (copia del producto en la caja, pestañas de la caja, pedidos de la caja), `b2b.js` (copia en B2B, lista para logística, pedidos; ya no crea productos sueltos), `app.js` (Hoy, Ventas B2B → Productos y Solicitudes, ícono "más"), `finanzas.js`, `finanzas-ventas.js`, `finanzas-margenes.js`, `finanzas-eerr.js`, `vista-finanzas.js`, `vista-finanzas-eerr.js` (foto → maestro → fin_productos; despacho aparte), `plan-pan.js`, `plan-pan-modelo.js` (maestro, foto y la clave `n-…`), `estilos.css`, `firestore-b2b.rules` (v1.7.0), `firestore.rules` (v1.4.0); los demás, solo la versión. `cocina/` y `fermentacion.js` **no cambian**.
- **Logística v1.3.0:** repo **fen-logistica**, zip `fen-logistica-v1.3.0.zip` (ver su README).
- **Apps Script:** ninguno cambia.

### Qué cambia en cómo trabajas
1. **Catálogo → Armar el catálogo** (`#catalogo/armar`, **una sola vez**): propone grupos con lo vivo de la caja y de B2B (un producto de la caja y uno de B2B que llevan a la misma receta o reventa, con las mismas unidades por venta, quedan juntos: primero por Finanzas → Asociar productos; si no, por el ID de receta de la caja o de B2B). Revisas cada grupo (nombre, de dónde sale, unidades por venta), puedes **Separar** caja y B2B o **Juntar con** otro. Lo que no tiene receta aprobada ni reventa queda "Falta" y hay que resolverlo (receta, reventa, cargo o **Archivar**) antes de **Guardar el catálogo**. Los precios no cambian (se copian tal cual).
2. **Catálogo → Productos** (`#catalogo/productos`): la lista (Activos, En la caja, En B2B, **Sin canal**, Archivados), filtros por estado, canal y de dónde sale, y buscador. **Nuevo producto**: eliges de dónde sale (solo recetas aprobadas: una en revisión o en prueba no aparece; una sub receta solo si "vende directo"), y en cada canal: **la caja** (pestaña, categoría, control de stock con precio por tarjeta o precio único, excepción horaria, se elimina solo) y **B2B** (precio base neto, categoría). **Cambiar**, **Archivar** (sale de los dos canales) y **Reactivar** (vuelve sin canales: lo habilitas con su precio). `#catalogo/productos/PR0003` abre ese producto.
3. **Pedidos de productos** (arriba en Productos, y en **Hoy**: "N productos pedidos"): lo que pide logística y (desde la caja 2b) la caja. **Habilitar** / **Crear** abre el diálogo con lo pedido (precio incluido); al guardar, el pedido queda aprobado y le llega la respuesta. **Rechazar** pide un motivo.
4. **Ventas B2B → Productos:** ya no está "Nuevo producto" (está "Crear en el Catálogo"). Los productos unidos dicen su PR… y se cambian en el Catálogo ("Cambiar en el Catálogo"); los que no están unidos (antes de armar) se cambian ahí como siempre. **Solicitudes:** un producto nuevo dice "Resolver en el Catálogo".
5. **Logística v1.3.0:** "Producto nuevo" pide **de la lista del Catálogo** (los productos activos que todavía no están en B2B), con su `catalogoId` (ya no lee la planilla). Cada línea de una orden guarda su **foto** (catalogoId, de dónde sale, área, receta o reventa). La **copia a la planilla está apagada**.
6. **Finanzas:** la receta de cada venta sale de **1) la foto de la línea, 2) el producto del Catálogo** (desde el mes en que lo armaste) y **3) Asociar productos** (lo antiguo y lo no unido). Asociar productos tiene su (i) "Asociar y el Catálogo"; un producto unido dice "Catálogo PR…" con "Ver en el Catálogo" y "Meses anteriores". **Despacho** (cargo) es una fila aparte en el estado de resultados: **"Despacho cobrado (canal B2B)"**, en Común, que suma al margen de contribución pero no a las ventas ni al margen de un producto. Los meses cerrados no cambian (se ven como quedaron).
7. **Plan de Panadería:** también toma la receta del Catálogo y de la foto. **Arreglo:** una línea B2B sin productoId (copiada de la planilla) ahora usa la misma clave que Finanzas (`n-nombre`), así su vínculo se encuentra.
8. **Áreas:** la copia en B2B guarda el área como **código** (PAN, BOL, REVENTA, B2B…); los nombres salen de `areas.js`.
9. **Qué está vivo:** un producto de la caja o de B2B unido al Catálogo ya no se archiva ahí (ni se sugiere archivar): dice **"En Productos (PR…)"** y se archiva en Productos, para que el catálogo y el canal no se separen.

### Cómo armar el catálogo (mini guía)
1. Conecta en este equipo las cuatro bases (Gastos → Base nueva, Producción, Ventas B2B; la caja ya está).
2. Antes, en Catálogo → **Reventa**, deja la reventa con su ID (si no lo hiciste en la v0.73.0) y, en **Qué está vivo**, archiva lo que ya no se vende.
3. Catálogo → **Armar el catálogo**. Arriba: Listos / Por resolver / A archivar / Nombres repetidos.
4. Primero los "Falta" (arriba): elige receta, reventa, cargo o "Archivar".
5. Revisa los repetidos: si la Hogaza de la caja y la de B2B quedaron separadas, usa **Juntar con**; si una caja y un B2B no son lo mismo, **Separar**.
6. Corrige los nombres (el del catálogo; en B2B el nombre antiguo no cambia).
7. **Guardar el catálogo** → confirma. Queda "Armado el … por …". Si algo se corta, aparece **Terminar de unir**.
8. En **Productos** revisa los "Sin canal" y los precios. Desde ahí, todo producto nuevo se crea en Productos.

### Cómo queda guardado (para el que venga)
- **fen-gastos** `cat_productos/{PR0001}` = `{ id, nombre, tipo 'receta'|'reventa'|'cargo'|'armado', recetaId | reventaId | componentes [{ recetaId, gramos }], area (código), unidadesPorVenta, estado 'activo'|'archivado', canales: { caja: { habilitado, docId, controlStock, precios { hoy, ayer, antesayer, cuartoDia, ultimaOferta } | null, precioUnico, excepcionHoraria, autoEliminar, categoria, areaCaja }, b2b: { habilitado, docId, precioBase, categoria } }, historial [40], creadoEn/Por, editadoEn/Por, origen 'manual'|'migracion'|'solicitud' }`.
- **fen-gastos** `cat_config/productos` = `{ siguiente, armadoEn, armadoPor, vigenteDesde 'AAAA-MM', n, historial }`.
- **fen-ventas** `productos/{docId}`: los campos de siempre (nombre, area, categoria, activo, precio, precioHoy…precioUltimaOferta, controlStock, excepcionHoraria, autoEliminar, idRecetaFen) + `catalogoId, tipo, reventaId`. Uno nuevo usa el ID del maestro; los que existían conservan el suyo. Deshabilitar = `activo: false`.
- **fen-b2b** `productos/{docId}`: nombre (solo al crear), precioBase (con historialPrecios), categoria, idReceta, area (código), estado + `catalogoId, tipo, reventaId`. Deshabilitar = `estado: 'archivado'`.
- **fen-b2b** `config/catalogoDisponible` = `{ productos [{ id, nombre, area, tipo }], n, en, por }` (lo activo que no está en B2B).
- **fen-b2b** `solicitudes` tipo `producto`: + `catalogoId` (logística v1.3.0); al resolver: `estado 'aprobada'|'rechazada', catalogoId, productoId, precioAprobado, respuesta, resuelta`.
- **fen-ventas** `solicitudes_producto/{id}` (la escribe la caja 2b) = `{ tipo 'producto', nombre, catalogoId | recetaId | reventaId, sucursal, precioSugerido, nota, estado 'pendiente', por, en }`; al resolver: `estado, catalogoId, productoId, respuesta, resuelta`.
- **Línea de una orden B2B** (logística v1.3.0): + `catalogoId, tipo, area, recetaId, reventaId, unidadesPorVenta`. `fin_ventas_mes` guarda esa foto (`foto`) en sus líneas.
- **fen-gastos** `fin_productos/{canal}_{docId}`: se crea con `origen 'catalogo_maestro', catalogoId` solo donde no había uno decidido; uno distinto se deja (vale para los meses antes de `vigenteDesde`). Tipo nuevo `cargo`.

### Lecturas y escrituras (Spark)
- **Productos al abrir** (medido con datos ficticios, después de armar: 4 productos del catálogo, 5 de la caja, 4 de B2B): Gastos y Finanzas **12**, caja **7**, B2B **6**, Cocina **1**. Con la operación real: el catálogo y la reventa (≈ 20–60, después la memoria de fs-gastos: solo lo que cambió), los productos de la caja y de B2B una vez por sesión (≈ 40–80, los mismos de Finanzas), las pestañas de la caja (4), los pedidos pendientes (1 + 1 si no hay), recetas de la memoria compartida (0). Filtrar y buscar: 0.
- **Armar el catálogo al abrir** (medido): Gastos y Finanzas **9**, caja **7**, B2B **6**, Cocina **1**. **Guardar:** 1 lectura (contador) + 1 lote en fen-gastos (productos + vínculos + su historial + contador) + 1 escritura por documento de la caja + 1 transacción por documento de B2B (lee y escribe) + 1 de la lista para logística.
- **Crear un producto:** 1 transacción en fen-gastos (2 lecturas, 2 escrituras) + por canal 1–2 (lee que el ID esté libre y escribe) + 1 lote de vínculos (2 por canal) + 1 de la lista. **Cambiar:** 1 transacción + 1 por canal + 1 de la lista si cambia lo disponible.
- **Finanzas / Cierre / Plan:** + 1 lectura de `cat_config/productos` cada 2 minutos (+1 de la regla); si ya hay catálogo, `cat_productos` y `cat_reventa` de la memoria. **Hoy:** + 1 lectura de `solicitudes_producto` (fen-ventas).
- **Logística:** 1 lectura de `config/catalogoDisponible` al abrir "Producto nuevo" (antes, el CSV); ya no llama al script ni marca para la planilla.

### Reglas de Firestore
- **fen-b2b v1.7.0 (obligatoria, antes de subir logística v1.3.0):** logística lee `config/catalogoDisponible` y crea órdenes con `planillaPendiente` true o false. Nada más cambia.
- **fen-ventas v1.4.0 (opcional ahora; obligatoria con la caja 2b):** `solicitudes_producto` (la cajera crea y lee los suyos; la administración lee y resuelve; nada se borra). Sin ella, Sistema Fën sigue igual: en Productos dice "Pedidos de la caja (i)" y Hoy no los cuenta.

### Instalación v0.74.0 (unos 10 minutos, en este orden)
1. **Reglas de fen-b2b:** consola de Firebase → proyecto **fen-b2b** → Firestore → **Reglas** → pega `firestore-b2b.rules` (v1.7.0) → **Publicar**.
2. *(Opcional ahora)* **Reglas de fen-ventas:** proyecto **fen-ventas** → Firestore → Reglas → pega `firestore.rules` (v1.4.0) → Publicar.
3. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.74.0.zip` (con la carpeta `cocina/`, que no cambia) → **Commit changes**.
4. GitHub, repo **fen-logistica**, raíz → sube los archivos del zip `fen-logistica-v1.3.0.zip` → Commit.
5. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC; en el celular, cierra y abre la app). En el celular de logística, cerrar y abrir la app.
6. Sistema Fën → Catálogo → **Armar el catálogo** (ver la mini guía).

### Lista de verificación v0.74.0
- [ ] Abajo a la izquierda dice **v0.74.0**; Catálogo tiene **Qué está vivo · Productos · Armar el catálogo · Reventa**.
- [ ] Armar el catálogo: los grupos se ven; lo que falta no deja guardar; al guardar dice "Listo: N productos…" y "Armado el …".
- [ ] En la caja (app de la caja) los productos se ven igual y se venden igual (mismos precios).
- [ ] Ventas B2B → Productos: cada uno dice su PR…; "Cambiar en el Catálogo" abre ese producto.
- [ ] Productos → Nuevo producto: la lista de recetas solo trae aprobadas; créalo en la caja → aparece en la caja con su precio.
- [ ] Logística (v1.3.0): Solicitudes → "Producto nuevo del catálogo" muestra la lista; manda uno → en Hoy aparece "1 producto pedido" → Productos → Pedidos → Habilitar con su precio → en logística aparece para las órdenes.
- [ ] Logística: arriba dice "Copia a la planilla apagada"; una orden nueva se guarda sin error.
- [ ] Finanzas → Resultados del mes en curso: si hubo despacho, la fila "Despacho cobrado (canal B2B)". Un mes cerrado se ve igual que antes.
- [ ] Finanzas → Márgenes → Asociar productos: los unidos dicen "Catálogo PR…".

**Si algo sale mal:** vuelve a subir la v0.73.0 (y logística v1.2.1). No se pierde nada: el catálogo (`cat_productos`) queda guardado, y los documentos de la caja y de B2B solo ganaron campos (`catalogoId`, `tipo`, `reventaId`); la caja y B2B siguen funcionando con sus mismos IDs. Las reglas v1.7.0 de fen-b2b sirven también para logística v1.2.1.

**Pruebas:** `pruebas/sistemafen/catalogo-v0740.test.js` (11) y las demás suites (`pruebas/resultados-v0740.txt`, con `pruebas/correr-v0740.sh`). Capturas en `pruebas/capturas/catalogo-v0740/` (Productos, el diálogo del producto y Armar el catálogo a 390 y 1280). Se ajustaron (cambio a propósito, no regresión): `etapa1-v0730` y `catalogo-v0720` (pestañas del Catálogo; versión y reglas posteriores), `plan-pan-v0710` (reglas fen-ventas v1.4.0 y fen-b2b v1.7.0), `b2b-v012` (logística: copia apagada, lista del Catálogo, el producto nuevo se resuelve en el Catálogo), `b2b-v013` (sin "Nuevo producto" en Ventas B2B), `cierre-previred-v0695` (+2 lecturas al abrir Cierre: ¿hay catálogo?). El simulador de fen-b2b aplica las reglas v1.7.0.

## Novedades de la v0.73.0: Etapa 1 (la base de Cocina es la maestra, Reventa, copias a planillas apagadas, respaldo mensual)

Decisiones tuyas: nadie usa ya las apps antiguas; la reventa vive en Sistema Fën y la ingresas tú; las copias en vivo a las planillas se apagan (Looker Studio sale) y en su lugar va un respaldo mensual; el domingo haces tú la masa madre del martes. **Cambio de último momento (21-oct):** aprobar recetas y crear materias primas escriben **solo en Firestore**: no se escribe la planilla de Producción y **no cambia ningún Apps Script**.

- **Dónde va:** repo **sistema-fen**, raíz. Archivos nuevos: `recetas-maestro.js` (IDs y documentos de receta, sub receta y materia prima; sin red), `reventa-modelo.js`, `reventa.js`, `vista-reventa.js` (Catálogo → Reventa), `respaldo-modelo.js`, `respaldo.js`, `vista-respaldo.js` (Configuración → Respaldo). Cambian `produccion.js` (aprobar, materias primas, mover de área y costo: solo Firestore y Finanzas), `vista-produccion.js`, `finanzas.js` (precio de una materia prima nueva; sin "Traer precios desde la planilla"), `vista-finanzas.js` (Asociar con la lista de reventa), `finanzas-ventas.js` (`reventaId`), `catalogo.js` y `vista-catalogo.js` (pestaña Reventa; la reventa cuenta en Vivo/Archivado), `gastos-planilla.js`, `gastos-base.js` y `vista-gastos-base.js` (copia apagada), `b2b.js` y `app.js` (copia de B2B apagada; Respaldo en Configuración; recordatorio en la Agenda; ícono "bajar"), `plan-pan-modelo.js` y `vista-plan-pan.js` (masa madre del domingo), `estilos.css`; los demás, solo la versión. `cocina/` y `fermentacion.js` **no cambian** (siguen idénticos a Cocina v0.17.4).
- **Apps Script:** **ninguno cambia** (Producción v2.11.0, Gastos v2.18.0, B2B v2.8.2). Nada que pegar.
- **Reglas de Firestore:** no cambian. fen-produccion v1.8.0 ya deja a la administración escribir `recetas`, `mps`, `versiones` y `solicitudes`; fen-gastos v0.1.0 deja todo a la administración (`cat_reventa` y `cat_config` son nuevas, no necesitan reglas); fen-ventas v1.3.0 deja a la administración escribir `config/respaldo`.

### Qué cambia en cómo trabajas
1. **Producción → Desde Cocina (aprobar):** la receta aprobada queda **solo en la base de Cocina** (la maestra), con su ID de siempre: receta nueva = **ÁREA + id de la propuesta** en mayúsculas (por ejemplo `PANMX7K2AB`); si es sub receta, su entrada para usarla como ingrediente es **SR + hora + 2 letras** (la que ya tenía la conserva). Un cambio a una vigente sube la versión y la anterior queda en `versiones/{id}_v{n}`. Reintentar no duplica. Si falta un ingrediente en la base de Cocina, o una sub receta se llama igual que una materia prima comprada, no deja aprobar (como antes).
2. **El costo** de cada propuesta sale **solo de Finanzas** (Finanzas → Costos, en neto). Sin la base de Gastos y Finanzas conectada en el equipo, dice que la conectes.
3. **(i) "Recetas nuevas en la caja y en logística"** (junto a "Recetas por aprobar"): la caja y logística todavía leen la lista publicada desde la planilla; como la planilla ya no recibe recetas nuevas, **una receta aprobada desde ahora llegará a esas listas en la etapa 2**. Mientras, **los productos los creas tú igual** (en la caja y en Ventas B2B) y en Finanzas → Asociar productos eliges la receta (esa lista sí sale de la base de Cocina).
4. **Materias primas pedidas:** se crean en la base de Cocina con el **ID que sigue** (`MP###` o `IN###`: el mayor de ese prefijo + 1, contado en la base de Cocina) y su **precio neto** por la unidad de compra queda en **Finanzas → Costos** (origen "A mano", con su historial). "Habilitar" suma el área. Si el nombre ya existe, ofrece "Habilitar esa". Sin la base de Gastos y Finanzas conectada no se crea (así nunca queda una materia prima sin precio).
5. **"Leer la planilla / Copiar"** y "Control de totales" ya no están. En su lugar, el pliegue **"Recetas y materias primas"** con la (i) **"La base de Cocina es la maestra"** y lo que hay en ella. "Pasar recetas de Bollería a Pastelería" también trabaja solo en la base de Cocina (mismo ID).
6. **Finanzas → Costos:** ya no está **"Traer precios desde la planilla"**; una (i) "Precios solo de Finanzas" explica que `costos_mp` es la única fuente. Los precios siguen cambiando con la última compra del SII o a mano.
7. **Catálogo → pestaña Reventa** (`#catalogo/reventa`): lo que se compra hecho, con su ID (`REV###`), costo neto por unidad, unidad y proveedor (RUT y razón social, opcional). **Agregar reventa**, **Cambiar**, **Archivar** y **Reactivar** con diálogos en la página (nada se borra; cada cambio queda en su historial). **"Traer reventa de la planilla"** (una sola vez): lee la lista publicada (CSV) y trae las filas con código de área REV **con su mismo ID**, proponiendo el costo desde Finanzas (productos ya asociados como reventa); lo revisas y corriges antes de guardar. En "Qué está vivo", **Vivo** y **Archivado** cuentan también la reventa.
8. **Finanzas → Asociar productos → "Es reventa":** nuevo campo **"De la lista de reventa"**: al elegirla se copia su costo (lo puedes cambiar para ese producto) y el vínculo guarda `reventaId`. Los vínculos antiguos sin reventa elegida siguen igual.
9. **Copias a las planillas apagadas (Gastos y B2B):** lo que haces en Sistema Fën ya no se marca para la planilla (`planillaPendiente` queda en `false`) ni se manda al script (`planilla_sync` de Gastos, `b2b_planilla` de B2B). Gastos → Base nueva → "Copia a la planilla" dice **Apagada** con su (i); en Ventas B2B, "Copia a la planilla apagada" reemplaza a "Copia en la planilla / Pasar ahora" (y ya no está "Volver a la app antigua"). **Las planillas quedan como estaban, como historial.** Sigue igual: la copia de la **Agenda a Google Calendar** (script de Gastos) y la **caja** (fen-ventas: sus cierres y merma a la planilla; eso cambia en la etapa 2).
10. **Configuración → Respaldo** (`#ajustes/respaldo`): **"Descargar respaldo de <mes>"** (por defecto el mes anterior) arma un Excel en el navegador con 13 hojas: Resumen, Gastos del mes, Vencimientos, SII docs del mes, Cartola cargos del mes, B2B órdenes del mes (una fila por producto), Clientes B2B, Productos B2B, Ventas caja del mes (de cada cierre, por producto), Recetas (con su costo neto de Finanzas), Materias primas (con su precio), Reventa y Catálogo vínculos. **"Descargar respaldo completo de catálogos"**: solo los maestros (recetas, materias primas, reventa, vínculos, productos de la caja y de B2B). **Antes de bajar** muestra cuántos documentos va a leer por base. No escribe en ninguna planilla.
11. **Agenda:** el **día 1 de cada mes**, "Bajar respaldo de <mes anterior>" (gris; queda como hecho cuando ya lo bajaste), con enlace a Configuración → Respaldo. También en la semana de Hoy cuando toca.
12. **Plan de Panadería:** el horneado del **martes** (amasado del lunes) lleva la **masa madre del domingo en la tarde, que haces tú** ("Masa madre Dom 25 oct, 19:00 (la haces tú)"; en el texto para copiar y la hoja impresa: "(la hace Emmanuel)"). El lunes sigue: masa madre del viernes, amasado del sábado.

### Cómo queda guardado (para el que venga)
- **fen-produccion** `recetas/{ÁREA+PID}`: los mismos campos que armaba la copia desde la planilla (área, nombre, estado `consolidada`, tipo, porciones, unidad, harinaTotal, ingredientes `{id, nombre, gramos, unidades, pct}`, insumos, pasos, notas, clasificación, pesoUnidad, planificable, vendeDirecto, seCongela, unidadesPorCaja, version, aprobadaPor, aprobadaEn, mpId, creadaPor) + `propuesta` y `origen: { base: 'sistema-fen', propuesta, id }`. Sin costos. Lo que no maneja Cocina (procedimiento, variante, vende directo) queda como estaba; lo archivado sigue archivado.
- **fen-produccion** `mps/{SR…}` (sub receta): `{ nombre, categoria 'Sub recetas', tipo 'sub_receta', unidad, estado 'activa', areas, recetaOrigen, … }`; `mps/{MP###|IN###}` (pedida): `{ nombre, categoria, tipo 'mp'|'insumo', unidad (la de compra), estado 'activa', areas: [área], solicitadaPor, origen: { base, solicitud }, creadaPor, creadaEn }`.
- **fen-gastos** `costos_mp/{id}` de una materia prima nueva: `{ nombre, tipo, estado, unidadCompra, contenido, precioNeto, ivaPct 19, impAdicionalPct 0, precioPorBase, origen 'manual', creadaDesde 'cocina', fecha, por }` + `costos_mp_hist`.
- **fen-gastos** `cat_reventa/{REV###}` = `{ id, nombre, costoNeto, unidad, proveedor { rut, razon } | null, estado 'activo'|'archivado', origen 'planilla'|'manual', creadoEn, creadoPor, editadoEn, editadoPor, historial [30] }`; `cat_config/reventa = { importadoEn, importadoPor, n }`.
- **fen-gastos** `fin_productos/{canal}_{id}` de reventa: además `reventaId` y `reventaNombre` (los antiguos sin ellos siguen valiendo).
- **fen-ventas** `config/respaldo = { meses: { 'AAAA-MM' | 'catalogos': { archivo, hojas, filas, en, por } } }`.

### Lecturas y escrituras (Spark)
- **Aprobar:** 1 lectura de la receta (o del ID nuevo) + 2 de la propuesta (transacciones); recetas y materias primas de la memoria compartida (0; si no estaban, una vez). Escrituras: 1 lote (receta + versión anterior + sub receta) + 2 de la propuesta + 1 de la marca de cambio. **Ya no se pide nada al script** (antes, el script tardaba y releía la planilla).
- **Materia prima pedida:** 1 lectura (que el ID esté libre) + 1 (su precio en Finanzas). Escrituras: 2 en fen-produccion (materia prima + pedido) + 1 marca + 2 en fen-gastos (precio + historial).
- **Reventa:** al abrir, la colección `cat_reventa` (≈ 10–40 documentos, después la memoria) + 1 de `cat_config`; los vínculos y productos, de la memoria de Finanzas. 1 escritura por cambio. Traer de la planilla: la lista publicada no cuesta lecturas de Firestore.
- **Respaldo del mes:** primero cuenta (≈ 10 lecturas: una por pregunta) y te muestra el estimado. Después lee lo que no está en memoria: en fen-gastos la memoria de siempre (con sus paquetes); en la caja los cierres del mes (≈ 60); en B2B las órdenes del mes (≈ 250–500), clientes y productos (≈ 70); Cocina casi siempre 0. Medido con datos ficticios: 21 (Gastos y Finanzas 17 · caja 1 · B2B 3 · Cocina 0). 1 escritura (`config/respaldo`).
- **Agenda:** 1 lectura de `config/respaldo` cada 6 horas (y solo si la semana o el mes tiene un día 1).
- **Copias apagadas:** menos lecturas y escrituras en fen-gastos y fen-b2b (el script ya no revisa lo pendiente cada vez).

### Instalación v0.73.0 (unos 3 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.73.0.zip`, con la carpeta `cocina/` (no cambia).
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC; en el celular, cierra y abre la app).

**Nada en Apps Script, ni en las reglas de Firestore, ni en Cocina.**

### Lista de verificación v0.73.0
- [ ] Abajo a la izquierda dice **v0.73.0**.
- [ ] Producción: ya no está "Leer la planilla"; el pliegue "Recetas y materias primas" dice "La base de Cocina es la maestra" (i).
- [ ] Una receta propuesta en Cocina: Revisar → costo de Finanzas → Aprobar. En Cocina aparece al tiro (o al recargar). La (i) de "Recetas por aprobar" explica lo de la caja y logística.
- [ ] Una materia prima pedida: Crear con su precio → en Cocina sale como "Lista"; en Finanzas → Costos está con su precio (origen "A mano").
- [ ] Finanzas → Costos: ya no está "Traer precios desde la planilla" (está la (i) "Precios solo de Finanzas").
- [ ] Catálogo → **Reventa** → "Traer reventa de la planilla": revisa los costos y guarda. Agrega una nueva, archívala y reactívala.
- [ ] Finanzas → Márgenes → Asociar un producto de reventa: elige de "De la lista de reventa"; el costo se copia.
- [ ] Gastos → Base nueva: "Copia a la planilla · Apagada". Ventas B2B: "Copia a la planilla apagada".
- [ ] Configuración → Respaldo → "Descargar respaldo de septiembre 2026": muestra el estimado, baja el Excel y lo abres (13 hojas). Guárdalo en Drive.
- [ ] Agenda → noviembre: el 1 dice "Bajar respaldo de octubre".
- [ ] Plan de Panadería → Martes: "Masa madre Dom …, 19:00 (la haces tú)".
- [ ] Agenda → un evento con "Copiar a mi Google Calendar": sigue llegando a tu calendario.

**Si algo sale mal:** vuelve a subir la v0.72.1. No se pierde nada de la base: lo aprobado en la v0.73.0 queda en la base de Cocina; la reventa y el respaldo quedan guardados (la v0.72.1 no los muestra). Ojo: la v0.72.1 vuelve a encender las copias a las planillas, y lo hecho mientras estuvieron apagadas no se copia solo.

**Pruebas:** `pruebas/sistemafen/etapa1-v0730.test.js` (16) y las demás suites (`pruebas/resultados-v0730.txt`, con `pruebas/correr-v0730.sh`). Capturas en `pruebas/capturas/etapa1-v0730/` (Reventa y Respaldo a 390 y 1280, y el Excel del mes). Se ajustaron (cambio a propósito, no regresión): `plan-pan-v0710` y `ajuste-sabado-v0721` (masa madre del martes: el domingo), `catalogo-v0720` (pestaña Reventa; sin "Leer la planilla"), `cocina-p1` (costo de Finanzas, aprobar y crear sin script, IDs `MP018`), `cocina-pantallas`, `cocina-pan-masas`, `cocina-tandas-bitacora-v0172`, `fb-v0171` y `ajuste-sabado-v0721` (siembran la base de prueba con la copia desde el código, ya sin botón), `finanzas-f1a` (sin el botón de traer precios), y las de la copia a la planilla de Gastos y B2B (`gastos-g2`, `gastos-g2b`, `gastos-g2c`, `gastos-g3a`, `gastos-g3b`, `gastos-g3c`, `gastos-g3d`, `gastos-v063`, `gastos-v0631`, `conciliacion-v064`, `area-reventa-v0691`, `b2b-v012`, `b2b-v013`): ahora comprueban que la copia está apagada. El Firestore simulado de fen-ventas ahora entiende `<=`, `<` y `>` (como Firestore).

## Novedades de la v0.72.1: ajuste de sábado (masa para el lunes) y Plan de Panadería sábado → lunes

Va con **Cocina v0.17.4**. El sábado se amasa lo que se hornea el **lunes** (el domingo no hay producción) y la masa madre de ese pan se hace el **viernes** en la tarde. Las recetas "48 h" ya no hacen falta: en Cocina, la jefa pone un ajuste de % "Todos los sábados (masa para el lunes)" en la misma receta, que se pausa, se salta un sábado o se usa solo un día (feriados: nunca automáticos). Ver el README de Cocina.

- **Dónde va:** repo **sistema-fen**, raíz. Cambian `plan-pan-modelo.js`, `plan-pan.js`, `vista-plan-pan.js` (sábado → lunes), `produccion.js` y `vista-produccion.js` (el ajuste de sábado, solo para mirar), `estilos.css`, y en `cocina/`: `modelo.js`, `consumo.js`, `bolleria.js`, `registros.js` (copias exactas de Cocina v0.17.4); los demás, solo la versión. `fermentacion.js` no cambia. El Catálogo (v0.72.0) no cambia, salvo la versión.
- **Reglas y scripts:** no cambian. fen-produccion v1.8.0 ya deja a las jefas escribir `ajustes` (el campo nuevo `sabado` va en el mismo documento) y a la administración leerlos.

### Qué cambia en cómo trabajas
1. **Plan de Panadería** (Producción → Plan de Panadería): cada día de horneado dice su amasado y su masa madre con los días reales:
   - **Lunes:** masa madre el **viernes** 19:00 · amasado el **sábado** · horneado el lunes.
   - **Martes:** masa madre el **sábado** · amasado el lunes (el domingo no hay producción).
   - Miércoles a sábado: como antes (masa madre la tarde antes del amasado; amasado el día antes).
   - **Domingo:** "El domingo no hay producción: no se hornea"; sin propuesta (si hay órdenes B2B con fecha domingo, avisa).
   - La masa madre de cada horneado se calcula con el ajuste que vale el día del amasado (el del lunes, con el **ajuste de sábado**).
   - **Cómo nos fue:** lo amasado el sábado cuenta como producido del **lunes** (antes caía en el domingo). Las semanas pasadas se ven así también.
   - "Copiar como texto" y la hoja para imprimir: lo mismo ("Lunes 26 de oct (se amasa Sáb 24 oct)", "Masa madre Vie 23 oct 19:00…", "Domingo …: sin horneado").
   - La fecha de una orden B2B sigue siendo el día de entrega = día de horneado.
2. **Bodega y consumo** (Producción → Bodega): calculan con la **misma regla** que Cocina (`cocina/modelo.js` → `ajusteDelDia`): "solo este día" > ajuste de sábado (los sábados) > el último ajuste que cubre el día. Lo pasado no cambia al pausar o cambiar el ajuste de sábado.
3. **Producción → Configuración de Producción:** nuevo bloque **"Ajuste de sábado · Panadería"** (solo para mirar): cada receta con ajuste de sábado, **Activo** o **En pausa**, sus %, desde cuándo y quién; "no el sáb …" si se saltó este sábado. Se cambia en Cocina.

### Lecturas y escrituras (Spark)
- Plan de Panadería: lee los días de Cocina desde **2 días** antes de la ventana (antes, 1), para el sábado de un lunes: +1 documento por sesión.
- "Ajuste de sábado" en Configuración: los `ajustes` de fen-produccion (uno por receta con ajuste; ≈ 10–30), con la misma memoria que la Bodega (si ya calculaste la bodega, 0).
- Sin escrituras nuevas en Sistema Fën.

### Instalación v0.72.1 (unos 3 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.72.1.zip`, **con la carpeta `cocina/`** (cambia).
3. **Commit changes**.
4. Repo **fen-cocina**, raíz: sube el zip `fen-cocina-v0.17.4.zip` (ver su README).
5. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC; en el celular, cierra y abre la app).

**Nada en Apps Script ni en las reglas de Firestore.**

### Lista de verificación v0.72.1
- [ ] Abajo a la izquierda dice **v0.72.1**.
- [ ] Plan de Panadería → Propuesta → **Lunes**: "Masa madre Vie …, 19:00 · Amasado Sáb … · Horneado Lun …". **Martes**: masa madre del sábado. **Domingo**: "no hay producción".
- [ ] Cómo nos fue: el producido del lunes es lo amasado el sábado.
- [ ] Con un ajuste de sábado puesto en Cocina: Configuración de Producción → "Ajuste de sábado · Panadería" lo muestra (Activo). Pausado en Cocina → "En pausa" (Actualizar o vuelve a abrir Sistema Fën).
- [ ] Producción → Bodega → Calcular: sin errores.

**Si algo sale mal:** vuelve a subir la v0.72.0 (y Cocina v0.17.3). No se pierde nada.

**Pruebas:** `pruebas/sistemafen/ajuste-sabado-v0721.test.js` (20/20) y las demás suites (`pruebas/resultados-v0721.txt`, con `pruebas/correr-v0721.sh`). Se ajustaron `plan-pan-v0710` (sábado → lunes es un cambio a propósito), `catalogo-v0720` y `area-reventa-v0691` (los módulos compartidos ya no son iguales a zips anteriores: ahora se exige que sean iguales entre Cocina y Sistema Fën).

## Novedades de la v0.72.0: Catálogo, Etapa 0 "Qué está vivo"

Hoy Fën produce solo lo base (pan, croissant, pan de chocolate, café) y algo de reventa; Pastelería y los croissants rellenos están en pausa. Antes de armar un solo catálogo de productos, esta etapa limpia lo que no se usa **sin perder historia**: se marca lo vivo y se archiva el resto (archivar se deshace con "Reactivar"; nada se borra).

- **Dónde va:** repo **sistema-fen**, raíz. Archivos nuevos: `catalogo-modelo.js` (reglas, sin red), `catalogo.js` (lecturas y escrituras), `vista-catalogo.js` (pantalla). Cambian `app.js` (sección Catálogo en el menú, después de Producción), `index.html`, `estilos.css`, `produccion.js` (archivar y reactivar recetas; copiar, mover de área y aprobar conservan lo archivado; f.b. y mover sin archivadas), `vista-produccion.js` (la (i) de "Leer la planilla"), `caja.js` (activo del producto), `finanzas.js`, `finanzas-ventas.js`, `finanzas-motor.js`, `vista-finanzas.js` (no se proponen ni se ofrecen archivadas), `plan-pan.js` (la propuesta sin archivadas); los demás, solo la versión. `cocina/` y `fermentacion.js` no cambian.
- **Reglas y scripts:** no cambian. fen-produccion v1.8.0 ya deja escribir `recetas` a la administración; fen-gastos v0.1.0 deja todo a la administración (`cat_revision` es nueva, no necesita reglas); fen-ventas v1.3.0 deja cambiar `activo` de un producto a la administración; fen-b2b v1.6.0, archivar un producto como siempre.
- **Cocina:** instala también **Cocina v0.17.3** (repo fen-cocina): esconde las recetas archivadas. Sin ella, Cocina sigue mostrándolas (como "Archivada" sin traducir) hasta que la subas.

### Qué cambia en cómo trabajas
1. Menú → **Catálogo** (`#catalogo`), pestaña **Qué está vivo** (queda espacio para las próximas pestañas del catálogo).
2. Arriba: **Por decidir N · Vivo N · Archivado N**, los filtros (Por decidir / Vivo / Archivado / Todo) y el buscador (nombre o ID, también el SR… de una sub receta).
3. **Recetas** por área (Panadería, Bollería, Pastelería, Cafetería; las sub recetas dicen "sub receta"): su estado de aprobación, **Se usa en** (recetas vivas que la llevan como ingrediente), **Se vende como** (productos de la caja y de B2B que llevan a ella: vínculo de Finanzas o ID de receta del catálogo) y lo vendido en 60 días en unidades de la receta.
4. **Productos de la caja** y **Productos B2B**: área, vínculo (la receta, Reventa, No es producto o Sin asociar), unidades vendidas en 60 días y última venta (caja: las dos sucursales; B2B: sin órdenes anuladas), Activo o Archivado. Los de reventa llevan la marca **Reventa** (en una etapa siguiente la reventa tendrá su propia entrada).
5. **Sugerido archivar:** un producto sin ventas en 60 días; una receta que no usa ninguna receta viva y que no se vendió en 60 días (una sub receta que solo usan recetas también sugeridas, también). **Archivar las N sugeridas** abre la lista con casillas para desmarcar lo que quieras dejar.
6. Por fila: **Vivo** (queda marcado), **Archivar** y, si está archivado, **Reactivar**. Todo con confirmación en la página.
7. **Guardias:** una sub receta que usa una receta viva no se archiva sola ("La usa: X, Y — archívalas primero o junto"; se ofrece archivarlas juntas). Al archivar una receta con productos a la venta, avisa y ofrece archivarlos también (los que se vendieron en 60 días vienen sin marcar). Al reactivar una receta con sub recetas archivadas, ofrece reactivarlas.
8. **Qué hace archivar:** receta → `recetas/{id}`: estado `archivada`, `estadoAntes`, `archivadaEn`, `archivadaPor` e `historialArchivo` (Reactivar vuelve a `estadoAntes` y deja esos campos en null; el historial sigue). Producto de la caja → `activo: false` (lo mismo que "inactivo" en la caja). Producto B2B → `estado: 'archivado'` (lo mismo que archivar en Ventas B2B). "Vivo" → fen-gastos `cat_revision/{recetas|caja|b2b}_{id}` = { decision: 'vivo', en, por }. Lo archivado se lee de las fuentes (no se guarda aparte). Reactivar marca "Vivo". Cada acción queda en el historial de Sistema Fën.
9. **El resto de Sistema Fën:** una receta archivada no se propone ni se ofrece en Finanzas → Asociar productos (un producto que ya la tenía la sigue mostrando), no sale en Costos → Productos (se sigue costeando con aprobada = false: los meses pasados siguen calculándose), no entra en la propuesta del Plan de Panadería (Cómo nos fue sí la cuenta), ni en la lista de f.b. ni en "Mover recetas". Las ventas de meses pasados asociadas a ella siguen contando.
10. **Copiar desde la planilla** (Producción) ya no pisa lo archivado: una receta archivada sigue archivada (con su estado anterior, quién y cuándo) y una reactivada conserva su historial. Lo mismo al mover de área o aprobar. Nueva (i) junto a "Leer la planilla": ya nadie usa la app antigua.

### Lecturas y escrituras (Spark)
- **Al abrir** (medido con datos ficticios: 59 días con cierre en las dos tiendas, 9 órdenes B2B): caja **125** (118 resúmenes de cierre + 7 productos), B2B **13** (9 órdenes + 4 productos), Cocina **0** (recetas de la memoria compartida con Hoy, Producción y Finanzas), Finanzas **6** (vínculos y `cat_revision` con la memoria de fen-gastos).
- **Con la operación real** (estimado): resúmenes de cierre ≈ 120 a 180 (uno por cierre en 60 días), productos de la caja y de B2B una vez por sesión (los mismos de Finanzas y los cierres), órdenes B2B de 60 días ≈ 500 a 1.000, recetas 0 si ya están en memoria (si no, ≈ 300 una vez al día, más la marca). Total la primera vez: ≈ 700 a 1.500 repartidas entre fen-ventas y fen-b2b (de 50.000 al día cada una).
- **Volver a abrir** (6 horas, también en este navegador): 0 de resúmenes y órdenes (quedan resumidas por producto); medido: 0 en las cuatro bases. Filtrar y buscar: 0. "Actualizar" vuelve a leer todo.
- **Escrituras:** 1 por receta o producto archivado o reactivado (las recetas en un solo lote, +1 de la marca de cambio de fen-produccion; las recetas no se vuelven a leer: la memoria queda con lo nuevo), 1 por "Vivo", y 1 línea en el historial por acción.

### Instalación v0.72.0 (unos 3 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.72.0.zip`, con la carpeta `cocina/` (no cambia).
3. **Commit changes**.
4. Repo **fen-cocina**, raíz: sube el zip `fen-cocina-v0.17.3.zip` (ver su README).
5. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC; en el celular, cierra y abre la app).

**Nada en Apps Script ni en las reglas de Firestore.**

### Lista de verificación v0.72.0
- [ ] Abajo a la izquierda dice **v0.72.0**; en el menú (PC y celular) **Catálogo** está después de Producción.
- [ ] Catálogo abre con Por decidir / Vivo / Archivado y "Lecturas al abrir".
- [ ] Una sub receta en uso (por ejemplo, la masa madre) dice "Se usa en …"; Archivar avisa "La usa: … — archívalas primero o junto".
- [ ] "Archivar las N sugeridas": revisa la lista, desmarca lo que se queda y archiva. Después, filtro **Archivado**: están con "Reactivar".
- [ ] En Cocina (v0.17.3) la receta archivada ya no aparece en Recetas (sí en "Archivadas (N)") ni para agregar al plan.
- [ ] Reactivar una: vuelve a su estado y aparece otra vez en Cocina.
- [ ] Configuración → Historial: cada acción del Catálogo está con tu correo.

## Novedades de la v0.71.1: Producción en el menú del celular

- **Arreglo:** en el celular, el Menú no mostraba **Producción** (en el computador sí). Ahora los dos menús salen de una misma lista, para que no vuelva a pasar que una sección aparezca en uno y no en el otro.
- **Dónde va:** repo **sistema-fen**, raíz. Cambia `app.js`; los demás archivos, solo la versión. `cocina/` y `fermentacion.js` no cambian.
- **Reglas y scripts:** no cambian. **Lecturas y escrituras:** sin cambios.

### Instalación v0.71.1 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.71.1.zip`, con la carpeta `cocina/` (no cambia).
3. **Commit changes**.
4. Espera 1 o 2 minutos. En el celular, cierre la app y vuelva a abrirla (si sigue la versión anterior, recargue la página).

### Lista de verificación v0.71.1
- [ ] En el Menú del celular, abajo, dice **v0.71.1**.
- [ ] Menú (celular) → **Producción** aparece entre Ventas B2B y Ventas de caja, y abre Producción.
- [ ] En el computador el menú de la izquierda sigue igual.

## Novedades de la v0.71.0: Plan de Panadería, Etapa 1 (Producción → Plan de Panadería)

- **Dónde va:** repo **sistema-fen**, raíz. Archivos nuevos: `plan-pan-modelo.js`, `plan-pan.js`, `vista-plan-pan.js`. Cambian `produccion.js` (lectura para el plan), `vista-produccion.js` (la entrada y la ruta), `vista-finanzas.js` (el enlace "Asociar" abre ese producto), `estilos.css`; los demás, solo la versión. `cocina/` y `fermentacion.js` no cambian.
- **Reglas:** no cambian (fen-ventas v1.3.0, fen-b2b v1.6.0, fen-produccion v1.8.0). **Scripts:** no cambian.

### El caso
Saber cuánto pan sale de verdad por tipo y tienda, y proponer la producción de la semana siguiente con datos exactos. Decisiones del 19-oct: solo datos exactos (opción A, sin estimar fresco o rebajado por precio); la fecha de la orden B2B es el día de horneado; en el plan de Cocina cada d es el día de amasado (se hornea al día siguiente); Ainavillo, por ahora, con una tabla fija.

### Qué cambia en cómo trabajas
1. **Producción** tiene arriba "Plan de Panadería" → **Abrir el Plan de Panadería** (`#produccion/plan-pan`). Tres partes:
2. **Propuesta próxima semana** (lunes a domingo, por día de horneado): por tipo de pan, **B2B estimado | B2C Barros | B2C Ainavillo (fijo) | Total**, con la masa madre del día 0 (19:00) y "De N clientes activos, se esperan M el lunes" (se despliega con cada cliente, sus veces de 4 y su cantidad usual). Cada número se toca y muestra de dónde sale (la semana pasada, las 4 semanas, la misma semana del mes anterior; la del año pasado aparecerá cuando haya datos, desde junio de 2027). Las fórmulas están en los (i).
3. **Cómo nos fue** (semana a elegir, las dos tiendas o una): recibido, vendido por lote, merma y su %, fresco/rebajado y agotado (solo en los días con la caja v2.2.0), producido (plan de Cocina, d+1), B2B y el costo en $. Tendencia semanal del % de merma y del % rebajado. Lista de **productos sin asociar** con su botón "Asociar" (abre Finanzas → Asociar productos con ese producto).
4. **Ainavillo y pisos**: la tabla fija de Ainavillo por día y pan (parte en 0) y un piso opcional por tienda, día y pan. Cada cambio queda en el historial (quién, cuándo, antes → después). El plan avisa cuando los datos sugieren subir o bajar un piso.
5. **Copiar como texto** (para WhatsApp) e **Imprimir (viernes)**: la semana completa en una hoja.
6. Todo lo demás es solo lectura: no escribe en Cocina, B2B ni Finanzas.

### Lecturas y escrituras (Spark)
- **Una vez por sesión** (6 horas en memoria; "Actualizar" vuelve a leer). Cambiar de día, pestaña, semana (dentro de las 6 leídas) o tienda: 0 lecturas.
- **fen-ventas:** resúmenes de cierre (1 por cierre), ingresos de stock (solo los ingresos: la consulta por `fechaKey` no trae las ventas), merma registrada, el stock de cada pan (1 por producto y tienda) y la configuración (1). Con datos de prueba de 6 semanas: 334. Con la operación real se estima ≈ 1.000 a 2.200 la primera vez de la sesión (la mayor parte son los ingresos de stock de todas las áreas; de 50.000 al día).
- **fen-b2b:** las órdenes de las 6 semanas (≈ 350 a 700). **fen-produccion y fen-gastos:** lo que ya está en la memoria compartida con Producción y Finanzas (casi siempre 0 a 30).
- **Escrituras:** solo al guardar la tabla de Ainavillo o los pisos (1 por guardado, en `config/planPanaderia` de fen-ventas, más 1 en el historial de Sistema Fën).

### Instalación v0.71.0 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.71.0.zip`, con la carpeta `cocina/` (no cambia).
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script ni en las reglas de Firestore.**

### Lista de verificación v0.71.0
- [ ] Abajo a la izquierda dice **v0.71.0**.
- [ ] Producción → **Abrir el Plan de Panadería**: carga la propuesta del lunes siguiente con sus cuatro columnas y la masa madre del sábado.
- [ ] Toca un número de B2C Barros: se ven sus referencias; "Hace un año" no aparece (todavía no hay datos).
- [ ] Cómo nos fue → la semana pasada: recibido, vendido y merma por pan. Si la caja v2.2.0 ya está instalada, aparecen fresco/rebajado y agotado; si no, la nota.
- [ ] Productos sin asociar: "Asociar" abre Finanzas con ese producto.
- [ ] Ainavillo y pisos: pon una cantidad para Ainavillo un día, guarda, y revisa el historial y la propuesta.
- [ ] Copiar como texto e Imprimir (viernes) funcionan.
- [ ] En el celular se ve bien (sin moverse de lado).

### Si algo sale mal
Sube de nuevo la v0.70.1. La configuración de Ainavillo y pisos (`config/planPanaderia`) queda guardada y la v0.70.1 la ignora.

**Por dentro:**
- `plan-pan-modelo.js` (puro, sin imports): lotes exactos (vendido = recibido − merma del lote − lo que queda; la merma enviada sin registrar cuenta; si una merma pasa de lo que tenía su lote, se corre al siguiente), tarjetas por lote (solo `porTarjeta` de la caja v2.2.0), producido d+1, B2B por frecuencia, B2C por mediana con ajustes, Ainavillo y pisos con historial, masa madre con `pieMasaMadre` de Cocina (todos los días como elaboración, sin reserva y sin el pie: así da la masa madre del amasado del día siguiente) y el texto para copiar.
- `plan-pan.js`: lecturas de las cuatro bases con `fs-memoria.js` y conteo de lecturas por base; escribe solo `config/planPanaderia` (transacción).
- `produccion.js`: `datosPlanPan(desde, hasta)` (recetas, materias primas, configuración, ajustes, planes y días de Panadería, con la memoria de siempre).
- `cocina/` y `fermentacion.js`: byte a byte iguales a la v0.70.1.

## Novedades de la v0.70.1: Sistema Fën lee las tarjetas y el agotado de la caja v2.2.0

- **Dónde va:** repo **sistema-fen**, raíz. No hay archivos nuevos. No cambian scripts ni reglas.
- Va junto con la **caja v2.2.0** (zip aparte, repo **fen-ventas**, raíz). El orden da lo mismo: esta versión funciona igual con resúmenes antiguos.

### El caso
Para medir la sobreproducción de pan hace falta saber cuánto pan se vendió fresco (tarjeta Hoy) y cuánto rebajado (Ayer, Antes de ayer, 4° día, Última oferta), y a qué hora se agotó. Desde la v2.2.0 la caja lo anota en cada venta y en el resumen de cada cierre. Esta versión deja esos datos listos para el **Plan de Panadería** (próxima etapa); todavía no hay pantallas nuevas.

### Qué cambia en cómo trabajas
1. **Caja → Reportes, un solo día** (por ejemplo "Ayer"): junto a cada pan que se agotó dice **"agotado 11:40"** (y "y de nuevo 16:05" si se volvió a ingresar y se agotó otra vez). Con las dos sucursales, dice en cuál. El (i) junto a "Producto" lo explica. Con varios días no se muestra.
2. **Cerrar cajas, reenviar cierres, generar resúmenes y anular desde Sistema Fën** escriben el resumen con el mismo formato de la caja v2.2.0 (`porTarjeta`, `agotadoHoy`), así un resumen rehecho aquí no pierde esos datos. Al anular una venta, si faltara su movimiento de stock, el stock vuelve a los lotes guardados en la venta.
3. Todo lo demás queda igual: los totales de ventas, Finanzas, Hoy y Producción leen los mismos números que antes.

### Lecturas y escrituras (Spark)
- **0 lecturas nuevas:** los datos vienen dentro de los mismos resúmenes de cierre que ya se leen (un documento por cierre).
- **0 escrituras nuevas:** el resumen se escribe en el mismo documento de siempre.

### Instalación v0.70.1 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.70.1.zip`, con la carpeta `cocina/` (no cambia).
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script ni en las reglas de Firestore.**

### Lista de verificación v0.70.1
- [ ] Abajo a la izquierda dice **v0.70.1**.
- [ ] Caja → Reportes → Ayer y Este mes: los totales son los mismos que con la v0.70.0.
- [ ] Después del primer cierre con la caja v2.2.0: Caja → Reportes → ese día. Si algún pan se agotó, dice "agotado HH:MM" bajo su nombre, y el (i) junto a "Producto" lo explica.
- [ ] En el celular se ve bien (la hora va en su propia línea, sin scroll hacia el lado).

### Si algo sale mal
Sube de nuevo la v0.70.0. Los resúmenes que ya tienen `porTarjeta` siguen funcionando igual con la v0.70.0 (los ignora); si la v0.70.0 rehace un resumen, ese cierre pierde el detalle por tarjeta (se recupera rehaciéndolo con la v0.70.1).

**Por dentro:**
- `caja.js`: `guardarResumenCaja` con `porTarjeta`, `agotadoHoy` y `reagotadoHoy` (igual que la caja v2.2.0; lo vendido sin tarjeta va a `sinDato`, así `porTarjeta` suma lo mismo que el total); `devolverStockVenta` usa los lotes de la línea si falta el movimiento. Nuevo, para el Plan de Panadería (puro, 0 lecturas): `TARJETAS`, `normalizarTarjeta` (acepta también `dia4` y `oferta`), `tarjetasProducto(pp)` → `{ registrado, porTarjeta, fresco, rebajado, agotadoHoy, reagotadoHoy }` y `tarjetasDeResumenes(resumenes)` → filas por día, sucursal y producto.
- `app.js`: `sumarResumenes` junta `porTarjeta` y las horas de agotado; Reportes muestra "agotado HH:MM" en un día. `estilos.css`: la hora en su propia línea.
- Los demás: solo la versión. `cocina/` y `fermentacion.js` no cambian (byte a byte iguales a la v0.70.0).

## Novedades de la v0.70.0: Cuentas recurrentes y Por pagar, el canal B2C y las boletas de luz y agua en PDF

- **Dónde va:** repo **sistema-fen**, raíz. Hay un archivo nuevo: `boletas.js`. No cambian scripts ni reglas.

### El caso
- "Obligaciones" y "Vencimientos" se confundían: una es la ficha de algo que pagas seguido y la otra cada cobro con su fecha y su monto. Ahora se llaman así en la pantalla. Los datos son los mismos.
- Las boletas de luz (CGE) y agua (ESSBIO) traen el consumo del período, a veces intereses, un "saldo anterior" (lo que no se pagó antes) y, si hay deuda, un aviso de corte. Antes había que escribir el monto a mano y el saldo anterior se podía contar dos veces.
- Lo que cuesta atender a los clientes de las tiendas (por ejemplo, la parte de la luz y el agua de la sala de venta) no tenía dónde ir.

### Qué cambia en cómo trabajas
1. **Nombres nuevos, mismos datos:** en Gastos, la pestaña "Vencimientos" ahora es **Por pagar** y "Obligaciones" es **Cuentas recurrentes**. También en los botones, las ayudas (i), Agenda, Hoy y la conciliación ("Paga vencimientos" ahora es **Paga cuentas por pagar**). "Vencimiento suelto" ahora es **Pago suelto**.
   - (i) arriba de Por pagar y de Cuentas recurrentes: "Cuenta recurrente = la ficha de algo que pagas seguido. Por pagar = cada cobro, con su fecha y monto. Los arriendos (sin documento) se crean solos cada mes; luz, agua, internet, Previred y créditos nacen de su documento o tabla."
   - Las direcciones de siempre siguen funcionando (por ejemplo, `#gastos/obligaciones`). En la base y en la planilla las colecciones y columnas no cambian de nombre.
2. **De dónde viene cada por pagar:** cada uno dice **Fijo** (monto fijo cada mes: arriendos), **Boleta** (su PDF), **Factura SII**, **Archivo** (Previred: comprobante o CSV; más adelante el de remuneraciones) o **Tabla** (cuotas de un crédito o cuponera). Además: Boleta (saldo anterior), Compra a crédito y Suelto.
3. **Esperando boleta de <mes>:** una cuenta de luz o agua no se crea sola cada mes: nace de su boleta. Mientras no subas la boleta del mes, Por pagar y la Agenda muestran **"Esperando boleta de octubre"** con un **estimado** (el promedio de las últimas 3 boletas de esa cuenta) y la fecha en que suele vencer. Es solo un estimado, con borde punteado: **nunca es un gasto** ni se paga desde ahí.
4. **Canal B2C:** un código nuevo de **costo de canal**, como B2B: lo que cuesta atender a los clientes de las tiendas.
   - Aparece en todas las listas de área de Gastos. **Nunca entra solo en un reparto** (solo si lo eliges tú) y **no está en Cocina ni en Producción**.
   - En el estado de resultados va como B2B hoy: a **Común**, con su nota de costo de canal (Resultados → Clasificación), hasta que exista la fila de costo de canal.
   - Cada gasto de boleta guarda su cuenta y su local, para poder ver más adelante por tienda. "Cómo trabajamos" lo explica: es la base para calcular después cuánto cuesta conseguir y atender a un cliente.
5. **Crear cuentas de luz y agua** (una vez, en Por pagar o en Cuentas recurrentes): crea las 4 cuentas, que se pagan por banco y que puedes editar después:

   | Cuenta | Empresa | Reparto |
   |---|---|---|
   | Luz Ainavillo | CGE | PAN 40, BOL 40, PAS 10, B2C 10 |
   | Agua Ainavillo | ESSBIO | PAN 40, BOL 40, PAS 10, B2C 10 |
   | Luz Barros Arana | CGE | CAF 70, B2C 30 |
   | Agua Barros Arana | ESSBIO | CAF 80, B2C 20 |

   - El ítem: el que se llame LUZ / ELECTRICIDAD o AGUA, si existe; si no, lo eliges (o después).
   - Si ya tenías una cuenta de luz o agua, te ofrece **usarla** en vez de crear otra (queda como cuenta de boleta, con su historial). Nunca se borra nada. Las que ya existen no se vuelven a crear.
   - **Los N° de cliente no se escriben aquí:** los aprende la primera boleta (o los escribes tú al editar la cuenta).
6. **Subir la boleta en PDF** (Por pagar → Subir boleta, o Conciliación → Subir archivo: se reconoce sola y se abre en Por pagar). La vista previa muestra todo lo leído y nada se guarda hasta "Guardar boleta":
   - **Lo leído:** empresa (por su RUT o su nombre), N° de cliente o de servicio, N° de boleta, emisión, período, vencimiento (si no trae, la emisión; se puede cambiar), boleta del período, intereses, saldo anterior, ajustes y total a pagar.
   - **El cruce:** boleta del período + saldo anterior + ajustes chicos (hasta $100) = total a pagar. Si no cuadra, **no deja guardar** y dice exactamente qué no cuadra.
   - **La cuenta:** se encuentra sola por la empresa y el N° de cliente. Si la cuenta todavía no tiene su N°, eliges cuál es (y lo aprende). Si no hay ninguna, te ofrece crearla.
   - **El gasto es del mes en que termina el período**, con fecha del último día de ese mes: 16 ago – 15 sep es de **septiembre**; 8 sep – 7 oct es de **octubre** (está en un (i)). Una boleta no da crédito de IVA: el costo es el total.
   - **Los intereses van aparte**, como gasto financiero (eliges el ítem, como las multas de Previred). El resto va al ítem de la cuenta, con su reparto.
   - **El saldo anterior** se compara con lo que sigue por pagar de esa cuenta: si calza (±$100) dice "El saldo anterior son: julio, agosto" (no es un gasto nuevo). Si no calza, dice la diferencia y ofrece **"Registrar saldo anterior sin boleta"**: queda por pagar como "Boleta (saldo anterior)", con su gasto en el mes que eliges (por defecto el anterior) y el ítem que eliges. Si después subes la boleta de ese mes, la reemplaza: **nunca se cuenta dos veces**.
   - **Corte:** si la boleta dice "Corte en trámite" (y, si viene, la fecha de corte), Hoy lo muestra arriba y en rojo, por ejemplo "Agua Ainavillo: corte desde el 12 nov si no se paga $14.380", hasta que se pague lo que la boleta cubre.
   - **La misma boleta dos veces** no se duplica: la vista previa dice "ya está registrada".
   - **El PDF** va a Drive por el camino de siempre (Fën · Gastos / Boletas y facturas).
7. **Pagar: lo más antiguo primero.**
   - En la cartola, un cargo igual al **total a pagar** de una boleta propone pagar todo lo que cubre en una sola acción (su saldo anterior y la boleta del mes), lo más antiguo primero; queda **Listo** si la glosa dice la empresa (CGE o ESSBIO). Un cargo igual al **saldo anterior** paga solo lo de antes.
   - Un cargo menor (pago parcial) paga lo más antiguo y lo que no alcanza queda como **abono** en el más antiguo que sigue abierto, con su saldo (siempre a revisar).
   - En efectivo o con tarjeta: **"Pagar en orden"** (Por pagar → Varias boletas por pagar) hace lo mismo.
   - Deshacer, como siempre.

### Lecturas y escrituras (Spark)
- **Abrir la vista previa de una boleta:** 0 lecturas con la sesión abierta (los ítems de Finanzas se leen una vez por sesión: en la prueba, 3 lecturas la primera vez).
- **Guardar una boleta con saldo anterior sin boleta:** 8 lecturas y 13 escrituras (medido: 9 líneas de gasto, 2 por pagar, la cuenta que aprende su N° y el contador de siempre). Una boleta sin saldo anterior: unas 8 escrituras.
- **Pagar con la cartola el total a pagar (2 por pagar, 9 gastos):** 30 lecturas y 15 escrituras (incluye la lista que se refresca); deshacer, parecido.
- **"Crear cuentas de luz y agua":** una vez, 9 lecturas y 5 escrituras.
- **Esperando boleta, origen de cada por pagar, avisos de corte en Hoy y la Agenda:** 0 lecturas nuevas (salen de lo ya leído).

### Instalación v0.70.0 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.70.0.zip`, con la carpeta `cocina/` (no cambia). Hay un archivo nuevo: `boletas.js`.
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script ni en las reglas de Firestore.** El script de Gastos v2.18.0 copia a la planilla las columnas que conoce: un gasto con área B2C, un por pagar de boleta y una cuenta con reparto en % pasan tal cual (probado con el script real, como REVENTA en la v0.69.1). Las reglas de fen-gastos v0.1.0 no enumeran áreas.
**A mano (opcional):** si tienes una validación de datos en la columna Área de la planilla, o un filtro fijo en Looker Studio, agrega B2C.

### Lista de verificación v0.70.0
- [ ] Abajo a la izquierda dice **v0.70.0**.
- [ ] Gastos: las pestañas dicen **Por pagar** y **Cuentas recurrentes**, y arriba está el (i) "Cuenta recurrente = …".
- [ ] Por pagar: cada uno dice de dónde viene (Fijo, Boleta, Factura SII, Archivo o Tabla).
- [ ] Por pagar → **Crear cuentas de luz y agua**: las 4 con su reparto. Si ya tenías una de luz o agua, elige "Usar" o "Crear nueva". Revisa en Cuentas recurrentes que digan "Nace de su boleta" y su reparto.
- [ ] Sube la boleta de luz de Ainavillo (PDF): revisa período, total, el cruce en verde, la cuenta (elige Luz Ainavillo la primera vez), el ítem, los intereses (ítem financiero) y "Gasto de <mes>". Si el saldo anterior no calza, decide si registrarlo sin boleta.
- [ ] Sube la de agua desde **Conciliación → Subir archivo**: se abre en Por pagar con su vista previa.
- [ ] Hoy: si la boleta dice corte, el aviso sale arriba en rojo.
- [ ] Sube otra vez la misma boleta: dice "ya está registrada" y no deja guardar.
- [ ] Conciliación → Cargos: el cargo del total a pagar propone pagar todo, lo más antiguo primero (Listo si la glosa dice CGE o ESSBIO).
- [ ] Por pagar → "Esperando boleta de <mes>" con su estimado en las cuentas que esperan su boleta (no suma a los gastos).
- [ ] Finanzas → Resultados → Clasificación: B2C aparece como "Canal B2C (costo de canal): por ahora a Común".
- [ ] En el celular se ve bien (Por pagar, la vista previa de la boleta, Cuentas recurrentes).

### Si algo sale mal
Sube de nuevo la v0.69.5. Lo guardado con la v0.70.0 queda: los por pagar de boleta se ven como por pagar normales (con su monto y fecha) y sus gastos ya están en su mes; las 4 cuentas siguen como cuentas recurrentes (con la v0.69.5 se crean solas cada mes, como las de antes).

**Por dentro:**
- `boletas.js` (nuevo, puro): el lector de boletas (`leerBoleta`, un solo lector por etiquetas), `revisarBoleta` (el cruce otra vez al guardar), `planBoleta` (el por pagar, sus gastos, el saldo anterior y los reemplazos), `esperandoBoleta` y `agendaEsperando`, `avisosCorte`, `planOrden`, `propuestaBoleta` y `propuestaOrden` (cartola), `origenDe`, `planCuentas` y `CUENTAS_LUZ_AGUA`.
- `areas.js`: B2C (CANAL, SOLO_A_MANO). `finanzas-resultados.js` y `vista-finanzas-resultados.js`: B2C a Común como costo de canal. `vista-finanzas.js`: Cómo trabajamos.
- `gastos-fs.js`: `datosBoleta`, `registrarBoletaServicio` (una transacción), `crearCuentasLuzAgua`; las cuentas de boleta no se generan solas; `datos()` trae el origen, "Esperando boleta" y los cortes; Hoy, el corte. `gastos-g3.js` (`esDevengado`: lo nacido de su boleta no crea gastos al pagarse), `gastos-g2.js` (vista con la boleta y la cuenta con su empresa y reparto), `gastos.js`.
- `gastos-cartola.js` y `gastos-cartola-fs.js`: la propuesta de la boleta, lo más antiguo primero y el abono dentro de "Paga cuentas por pagar" (y su deshacer). `puntaje.js`: el puntaje de la boleta.
- `app.js` y `estilos.css`: nombres, Por pagar, vista previa, Crear cuentas de luz y agua, Pagar en orden, formulario de la cuenta (empresa, local, reparto), Agenda y Hoy. Textos de otros módulos: solo los nombres visibles.
- Los demás: solo la versión. `cocina/` y `fermentacion.js` no cambian.

## Novedades de la v0.69.5: el Previred del mes es parte del cierre de ese mes

- **Dónde va:** repo **sistema-fen**, raíz. No cambian scripts ni reglas.

### El caso
Las cotizaciones de Previred de un mes son un **costo de ese mes**: su gasto queda con fecha del último día del mes y se pagan hasta el día 13 del mes siguiente. Si octubre se cerraba antes de cargarlas, octubre quedaba con menos costo y la diferencia entraba a noviembre como "Ajustes de meses cerrados". Además, el Resumen del mes de Conciliación pedía el Previred del mes **anterior** (cerrar octubre pedía el de septiembre).

### Qué cambia en cómo trabajas
1. **Cuándo se cierra el mes:** después de pagar y cargar su Previred, **a más tardar el día 13 del mes siguiente** (antes se cerraba en la primera semana del mes siguiente, antes de que el Previred estuviera cargado). Orden recomendado:
   1. pagar Previred, ojalá antes del día 10;
   2. subir el comprobante o el CSV en Conciliación → Previred;
   3. cerrar el mes en Finanzas → Resultados → Cierre de mes.
2. **Cierre de mes tiene una revisión nueva: "Previred de <mes> cargado"** (va después de "Cartola conciliada"). Cuenta como cargado si están las cotizaciones de ese mes (por el certificado, el comprobante o el CSV).
   - **Falta** si no están: igual que las demás, para cerrar igual marcas "Cerrar igual" y escribes el motivo.
   - **Aviso** si están cargadas pero todavía no unidas a sus cargos del banco (dice cuánto falta unir): no impide cerrar.
   - **Listo** si están pagadas y conciliadas con la cartola.
3. **Conciliación → Resumen del mes** usa esa misma revisión, con el mismo texto: octubre pide "Previred de octubre" y septiembre "Previred de septiembre", en el mismo lugar de la lista y con su enlace a Conciliación → Previred. Ya no pide el del mes anterior.
4. **Hoy y Agenda:** el aviso "Previred de <mes> vence el …" (desde el día 10) suma una línea: **"Es lo que falta para cerrar <mes>"**, solo si ese mes no está cerrado. Para no leer nada, sale cuando la app ya sabe el estado del cierre en esa pestaña (después de abrir Finanzas → Resultados o Cierre de mes); si no lo sabe, el aviso sale como siempre, sin esa línea.
5. **Textos:** "Cómo trabajamos" (Finanzas), el (i) de Cierre de mes, el mes en curso en Cierre de mes y el (i) del Resumen del mes dicen la regla nueva.

### Lecturas (Spark)
- Abrir Cierre de mes después de Hoy o de Conciliación: **0 lecturas nuevas** (medido contra la v0.69.4: 18 y 18). El Previred sale de lo que Hoy y Conciliación ya leyeron.
- Si Cierre de mes es lo primero que abres en la sesión, lee una vez las cotizaciones y las planillas de Previred (en la prueba, 8 lecturas más; después, 0).
- La línea de Hoy y Agenda: 0 lecturas (sale de la memoria).

### Instalación v0.69.5 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.69.5.zip`, con la carpeta `cocina/` (no cambia). No hay archivos nuevos.
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script ni en las reglas de Firestore.** No se escribe nada nuevo.

### Lista de verificación v0.69.5
- [ ] Abajo a la izquierda dice **v0.69.5**.
- [ ] Finanzas → Cómo trabajamos: "Cierre del mes" dice "después de Previred, hasta el día 13" y el orden recomendado (pagar, subir, cerrar).
- [ ] Finanzas → Resultados → Cierre de mes, septiembre: aparece "Previred de septiembre cargado" (después de Cartola conciliada) con Listo, Aviso o Falta.
- [ ] Si dice Falta, "Cerrar septiembre" pide marcar "Cerrar igual" y el motivo.
- [ ] Conciliación → Cargos → Resumen del mes: con Octubre elegido dice "Previred de octubre cargado"; con Septiembre, "Previred de septiembre cargado", igual que en Cierre de mes.
- [ ] Desde el día 10, si el Previred del mes pasado no está cargado: abre Cierre de mes, vuelve a Hoy y el aviso dice "Es lo que falta para cerrar <mes>" (si ese mes no está cerrado).
- [ ] En el celular se ve bien (Hoy, Cierre de mes y Cómo trabajamos).

### Si algo sale mal
Sube de nuevo la v0.69.4. No se guarda nada nuevo: un mes cerrado con la v0.69.5 guarda en su cierre la revisión de Previred como una más.

**Por dentro:**
- `finanzas-eerr.js`: `checkPrevired` (la revisión, una sola vez) y `tituloPrevired`; `checksCierre` la agrega cuando recibe las planillas; `CHECKS_CONCILIACION` la incluye.
- `conc-resumen.js`: "Qué falta para cerrar el mes" usa `checkPrevired` del mismo mes (sale el del mes anterior).
- `fs-gastos.js` (`enMemoriaDocs`: lo ya cargado en la sesión, sin leer), `gastos-cartola-fs.js` (`planillasCierre`), `finanzas.js` (`planillasPrevired`) y `vista-finanzas-eerr.js` (la revisión y los textos).
- `gastos-g3d.js` (`conCierre`), `gastos-g3d-fs.js` (el aviso de Previred con el estado del cierre de la memoria), `app.js` (Hoy, Agenda y el (i) del resumen), `vista-finanzas.js` (Cómo trabajamos) y `estilos.css`. `finanzas-ventas.js`: solo un comentario. Los demás: solo la versión. `cocina/` y `fermentacion.js` no cambian.

## Novedades de la v0.69.4: devoluciones visibles en el PDF "Resumen" de órdenes B2B

- **Dónde va:** repo **sistema-fen**, raíz. No cambian scripts ni reglas.
- En Ventas B2B → marcar órdenes → PDF → **Resumen**, la sección **Detalle por orden** muestra, en el día y en la fila del producto, lo que cambió al editar la orden: "8 × Pan de molde · eran 10, se devolvieron 2". Un producto devuelto completo queda tachado en $0, y el motivo del cambio va bajo la orden ("Cambio: 06-10-2026: …").
- **Total por producto** dice cuánto se descontó: "18 × $3.000 · se descontaron 2 devueltos".
- Lecturas: solo las órdenes editadas leen su historial (1 consulta cada una); las demás, 0.

**Checklist:** (1) subir los archivos y recargar: abajo dice v0.69.4; (2) marcar una orden editada con devolución y otra sin cambios → PDF → Resumen; (3) revisar que la devolución sale en su día y su producto.

## Novedades de la v0.69.3: Resumen del mes en Conciliación (cuánto falta y qué falta para cerrar)
**Dónde:** Conciliación → Cartola, arriba de todo (el mismo en Abonos y en Cargos). También una línea en Hoy.

### El caso
Para saber cómo iba el mes había que sumar a mano lo de Cargos, lo de Abonos y revisar en Finanzas → Cierre de mes qué faltaba. Ahora está en una tarjeta arriba de la bandeja.

### Qué cambia en cómo trabajas
1. **Resumen del mes** (plegable): eliges **el mes de hoy o el anterior**. Arriba dice en una línea "Octubre: 87% conciliado · 12 por revisar · 3 para cerrar".
2. **Avance** (por la fecha del movimiento en la cartola):
   - Cargos: "41 de 53 conciliados", la barra y "$3.120.400 de $3.870.000";
   - Abonos B2B: lo mismo;
   - los estados de la bandeja del mes: Listo, Revisar, Sin coincidencia y Repetido o ignorado. **Tocar uno filtra la bandeja** a ese estado y a ese mes ("Solo octubre", que se quita con su X). En Cargos, "Repetido o ignorado" abre Ya revisados.
   - Conciliado = revisado (ya dijiste qué es). Los repetidos no cuentan en el total.
3. **Lo más antiguo sin revisar:** 3 cargos y 3 abonos, con su edad ("hace 23 días"). Tocar uno lo abre en la bandeja (si es de la otra pestaña, va allá).
4. **Cobertura:** hasta dónde llega la cartola de cada cuenta, si el mes está completo y hasta dónde llega el SII (lo mismo de "Qué está cubierto").
5. **Qué falta para cerrar el mes**, cada punto con Listo / Falta / Aviso y su enlace:
   - cartola hasta el último día del mes;
   - 0 cargos por revisar del mes (**la misma regla de Cierre de mes**);
   - 0 abonos B2B por revisar (Cierre de mes no lo revisa: aquí es un aviso);
   - SII cargado hasta fin de mes y 0 documentos del SII sin clasificar (**las mismas reglas de Cierre de mes**, con el mismo texto);
   - Previred del mes anterior cargada y pagada;
   - facturas con saldo vencido (aviso, no impide cerrar).
   Y el botón **Ir a Cierre de mes** (abre ese mismo mes).
6. **Señales** (una línea cada una, solo si hay): pagos parciales con saldo abierto, facturas por clasificar, efectivo pagado en el mes ("cobros B2B $X · otro $Y") y reglas sugeridas por revisar.
7. **Hoy:** "Conciliación de octubre: 87% · faltan 12" lleva al resumen. Sale solo si Conciliación ya se abrió en esa pestaña (usa lo que está en la memoria; si no, no aparece, para no leer nada).
8. **Celular:** el resumen viene plegado en una línea; se abre al tocarla.

### Lecturas (Spark)
- Abrir el resumen, plegarlo, cambiar de mes, filtrar y elegir un movimiento: **0 lecturas** (medido). Abrir Conciliación lee exactamente lo mismo que la v0.69.2 (medido: Cargos 50 + 13, Abonos después 0 + 8).
- Los abonos de B2B ya conciliados no están en la memoria: se cuentan con lo ya leído en la sesión. Si falta una parte del mes aparece **"Contar todo el mes"**: lee solo los días que faltan, una vez por sesión (más o menos 1 lectura por abono; en la prueba, 1). Mientras no se cuente, el % del mes usa solo los cargos (los abonos por revisar sí se suman siempre).
- En Abonos, si todavía no abriste Cargos en esa pestaña, la parte de Cargos dice "Se cuentan al abrir Cargos" (no se leen para esto).

### Instalación v0.69.3 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.69.3.zip`, con la carpeta `cocina/` (no cambia). Hay un archivo nuevo: `conc-resumen.js`.
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script ni en las reglas de Firestore.** No se escribe nada nuevo.

### Lista de verificación v0.69.3
- [ ] Abajo a la izquierda dice **v0.69.3**.
- [ ] Conciliación → Cargos: arriba está **Resumen del mes** con la línea "Octubre: …% conciliado · … por revisar · … para cerrar".
- [ ] Cambia a Septiembre: cambian los números de Cargos y Abonos.
- [ ] Toca "Sin coincidencia": la bandeja muestra solo esos, con "Solo octubre". Quítalo con su X.
- [ ] Toca un cargo de "Lo más antiguo sin revisar": queda abierto en la bandeja.
- [ ] Con Septiembre elegido, "Ir a Cierre de mes": los puntos SII, Cartola conciliada y Documentos del SII dicen lo mismo que el resumen.
- [ ] Vuelve a Hoy: aparece "Conciliación de octubre: …% · faltan …".
- [ ] En el celular el resumen es una línea y se abre al tocarla.

### Si algo sale mal
Sube de nuevo la v0.69.2. El resumen solo lee: no guarda nada.

**Por dentro:**
- `conc-resumen.js` (nuevo, puro): avance por mes, estados, lo más antiguo, cobertura, "Qué falta para cerrar el mes", señales y las líneas.
- `finanzas-eerr.js`: las revisiones de SII cargado, cartola conciliada y documentos del SII sin clasificar quedan como funciones propias (`checkSiiCargado`, `checkCartolaConciliada`, `checkSiiClasificados`, `cargosPorRevisarDelMes`) que usan **Cierre de mes y el resumen**; Cierre de mes da lo mismo que antes.
- `vista-finanzas-eerr.js` (`elegirMes`), `sii-pendientes-fs.js` (`conteos` entrega también lo del resumen, de lo ya leído), `b2b.js` (`abonosDelMes`, `leerAbonosDelMes`), `app.js` y `estilos.css`. Los demás: solo la versión. `cocina/` y `fermentacion.js` no cambian.


## Novedades de la v0.69.2: pagos mixtos y en partes (un cargo paga una parte de la factura y el resto fue en efectivo, con tarjeta o se debe)
**Dónde:** Conciliación → Cartola (Cargos), Conciliación → Pagos sin banco y Gastos → Vencimientos ("Registrar abono").

### El caso
Un cargo del banco pagó una parte de una factura que ya estaba en Gastos (por ejemplo, $113.780 de $125.000) y la diferencia se pagó en efectivo. Hasta ahora "Ya está en Gastos" pedía el mismo monto (±$1), "Pagos sin banco" marcaba la factura COMPLETA en efectivo, y el abono de Vencimientos no preguntaba de dónde salió el efectivo.

### Qué cambia en cómo trabajas
1. **"¿Y el resto?" en el cargo.** Al elegir una factura o un gasto MAYOR que el cargo (en "Ya está en Gastos" o en "Paga vencimientos"), aparece: "Este cargo paga $113.780 de $125.000. ¿Y el resto ($11.220)?", con tres opciones:
   - **Lo pagué en efectivo:** la fecha (por defecto, la del cargo) y de dónde salió (Efectivo de cobros B2B u Otro, con una nota);
   - **Lo pagué con tarjeta:** la fecha;
   - **Todavía lo debo:** una factura a crédito sigue "Con abonos · saldo $Z" (como siempre); una al contado queda por pagar con la fecha que eliges (Vencimientos, Agenda, Hoy y "Todavía por pagar" en Pagos sin banco).
   Nada se registra solo: primero eliges qué pasó con el resto. Al confirmar se ve "Pagado: $113.780 banco (cargo 15-10) + $11.220 efectivo (17-10, cobros B2B)".
2. **El gasto nunca se duplica.** Su monto sigue siendo el total del documento. Cada pago queda como una **parte** (medio, fecha y cargo u origen). Cuando las partes suman el total (±$1) el documento queda pagado, con la fecha de pago de la última parte, y el detalle del gasto dice "Pagado: … + …".
3. **El efectivo cuenta donde siempre.** La parte en efectivo queda como pago guardado (igual que en Pagos sin banco): baja el "Efectivo en mano estimado" si salió de los cobros B2B, y llega al flujo de caja. La parte con tarjeta también queda guardada (no toca el efectivo).
4. **Varios cargos para un documento.** Un cargo menor que una factura del proveedor reconocido se propone como **"Pago parcial: $113.780 de $125.000 · falta $11.220"** (siempre en Revisar, nunca Listo). El cargo siguiente que es el **saldo exacto** de ese documento se propone solo ("Abono al saldo de … · queda pagado") y puede quedar **Listo** si el proveedor se reconoce (RUT o nombre). En la bandeja, el documento muestra sus **pagos** (cada parte con medio, fecha y cargo u origen) y lo que falta.
5. **Vencimientos → Registrar abono** tiene **Medio**: Banco/transferencia, Efectivo (por defecto) o Tarjeta. En efectivo pregunta de dónde salió, así el efectivo de B2B cuadra venga de donde venga la parte en efectivo.
6. **Deshacer el cargo** saca solo la parte del banco. Si el resto (efectivo o tarjeta) se registró junto con ese cargo, pregunta "¿Quitar también el pago en efectivo de $Z?": **Sí** (sale también, queda anotado) o **No, dejarlo** (el documento vuelve a deber solo lo del cargo). Si el documento era al contado y queda sin pagos, vuelve exactamente a como estaba (su vencimiento "en partes" queda anulado, no se borra).
7. **Pagos sin banco:** no muestra los documentos pagados por completo en partes, y SÍ muestra los que tienen saldo y ya pasó su fecha: ahí pagas el saldo en efectivo o con tarjeta, o lo reagendas.

### Lecturas y escrituras (Spark)
- Abrir el cargo, elegir el resto, ver el historial de pagos y la propuesta del saldo: **0 lecturas** (sale de lo ya leído).
- Confirmar cargo + resto en efectivo (una transacción): el cargo, el vencimiento, cada línea del gasto, el documento del SII y el pago guardado. Medido con 1 línea: **11 lecturas** (con la lista que se refresca) y **6 escrituras** (contando el contador de siempre).
- Abono en efectivo desde Vencimientos (el último): **11 lecturas y 4 escrituras** medidas.
- Deshacer con "Sí": **12 lecturas y 6 escrituras**; con "No, dejarlo": **10 lecturas y 4 escrituras**.

### Instalación v0.69.2 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.69.2.zip`, con la carpeta `cocina/` (no cambia). Hay un archivo nuevo: `pagos-mixtos.js`.
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script ni en las reglas de Firestore.** Las reglas de fen-gastos v0.1.0 ya dejan a administración escribir `vencimientos`, `gastos` y `sii_pagos`. El Script de Gastos v2.18.0 copia a la planilla las columnas que conoce: los campos nuevos (partes, pagoMixto) no pasan a la planilla y no molestan.

### Lista de verificación v0.69.2
- [ ] Abajo a la izquierda dice **v0.69.2**.
- [ ] Un cargo menor que una factura del proveedor dice "Pago parcial: $X de $Y · falta $Z" y está en Revisar.
- [ ] Al abrirlo: "Este cargo paga $X de $Y. ¿Y el resto ($Z)?". Elige "Lo pagué en efectivo", la fecha y "Efectivo de cobros B2B", y confirma.
- [ ] Gastos → Registrados: el gasto es UNO, con el total de la factura; su detalle dice "Pagado: $X banco (cargo …) + $Z efectivo (…, cobros B2B)".
- [ ] Pagos sin banco: la factura ya no aparece y el "Efectivo en mano estimado" bajó $Z.
- [ ] Vencimientos → Abonar: el campo Medio y, en efectivo, de dónde salió.
- [ ] Deshacer un cargo con resto: pregunta "¿Quitar también…?" con Sí y No, dejarlo.
- [ ] En el celular se ve bien.

### Si algo sale mal
Sube de nuevo la v0.69.1. Lo guardado queda: los documentos pagados en partes se ven como vencimientos con abonos (pagados o con saldo), los gastos con su fecha de pago y los pagos en efectivo en Pagos sin banco. Nada se borra.

**Por dentro:**
- `pagos-mixtos.js` (nuevo, puro): textos, revisar el resto, el vencimiento "en partes" de un documento al contado, las partes y su texto, quitar partes al deshacer, saldos para Pagos sin banco y las partes para el flujo de caja (`pagosDeCaja`).
- `gastos-cartola-fs.js` (`resolverPagoParcial`: todo en una transacción; `deshacer` con `quitarResto`), `gastos-fs.js` (`abonoParcial` con medio, origen, pago guardado y `pagoMixto`; `gastosDelDocumento`), `gastos-g3.js` (el abono guarda su medio; la fecha de pago es la de la última parte).
- `gastos-cartola.js` (la propuesta del saldo de un documento y el pago parcial), `puntaje.js`, `bandeja.js` (estado "pagado en partes" e historial), `gastos-banco.js` (el detalle del gasto), `sii-pendientes-fs.js` (saldos atrasados y `pagarSaldo`), `registro-detalle.js`, `cartola.js`, `app.js` y `estilos.css`. Los demás: solo la versión. `cocina/` y `fermentacion.js` no cambian.


## Novedades de la v0.69.1: área REVENTA (lo que se compra hecho y se vende tal cual)
**Dónde:** Gastos → Ítems y Registrar, Finanzas → Resultados (estado de resultados), Finanzas → Márgenes → Asociar productos y Finanzas → Cómo trabajamos.

### El caso
Los chocolates, el té, las infusiones y Magia se compran hechos y se venden tal cual. Hasta ahora iban al área donde se venden (por ejemplo, Cafetería), y su margen se mezclaba con el de lo que produce esa área.

### Qué cambia en cómo trabajas
1. **Área nueva REVENTA** en la lista de áreas de Gastos: ítems, Registrar, cartola, abonos, Previred y las reglas de conciliación. La lista de áreas ahora está en un solo lugar de la app (`areas.js`).
2. **El ítem "PRODUCTOS DE REVENTA"**: en Gastos → Ítems, ponle **área fija REVENTA**. Si el nombre dice REVENTA y el área es otra, aparece una nota (i). Su compra sigue sin ser un gasto del mes: en Resultados → Clasificación va como "Compras de productos de reventa" y queda en **Fuera del resultado**.
3. **Estado de resultados:** columna **Reventa**, entre Cafetería y Común. Muestra sus ventas, el costo de lo vendido (costo de compra neto × unidades), su margen de contribución y sus fijos, si algún gasto tiene área REVENTA (por ejemplo, el arriendo de una vitrina). **La columna aparece solo si el mes tiene algo de Reventa.** Un mes ya cerrado se ve como quedó al cerrarlo.
4. **Márgenes → Asociar productos:** al elegir "Es reventa" se propone el **área Reventa** (puedes elegir otra). Lo que ya estaba asociado **no se cambia solo**: una reventa que estaba en Cafetería sigue ahí, y al abrirla dice "Hoy está en Cafetería". Una reventa antigua sin área cuenta en Reventa.
5. **"Pasar los productos de reventa al área REVENTA (N)"** (Asociar productos, aparece solo si hay alguna): se usa una sola vez. Primero muestra la lista ("Hoy: Cafetería → Reventa") y pide confirmar. Solo cambia el área: el costo, las unidades por venta y el envase quedan iguales. Cada cambio queda en el historial del producto. Nada se borra.
6. **REVENTA es solo un área de margen:**
   - no está en Cocina ni en Producción (bodegas, jefas, recetas, stock);
   - en un reparto (PRORRATEADO, "Agregar área", "Repartir en %") la app nunca la pone sola: solo si la eliges tú;
   - no recibe comunes en "Comunes repartidos por causa": ahí su margen va en Común y el total no cambia.
7. **Textos:** el (i) de Productos de reventa (Gastos) y "Cómo trabajamos" en Finanzas ahora dicen área REVENTA.

### Lecturas y escrituras (Spark)
- Nada nuevo al abrir pantallas: la columna Reventa y la propuesta salen de lo que ya se leía (**0 lecturas**).
- "Pasar los productos de reventa al área REVENTA": **1 lectura y 2 escrituras por producto** (el vínculo y su historial, en una transacción), una sola vez. Medido en las pruebas: 2 productos → 2 lecturas y 4 escrituras.
- Asociar un producto: igual que antes (1 lectura y 2 escrituras).

### Instalación v0.69.1 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.69.1.zip`, con la carpeta `cocina/` (no cambia). Hay un archivo nuevo: `areas.js`.
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script ni en las reglas de Firestore.**
- **Script de Gastos v2.18.0, sin cambios:** con Gastos en la base nueva, la copia a la planilla (`planilla_sync`, BaseNueva.gs) pasa el área tal cual, sin revisarla contra una lista. Probado con el script real: un gasto REVENTA llega a Registro Gasto con Área REVENTA. La lista fija de áreas del script (`SF_AREAS` en SistemaFen.gs) solo se usa en el modo antiguo con la planilla, que está bloqueado con la base nueva (igual que pasó con B2B en la v0.63.1).
- **Reglas de fen-gastos v0.1.0, sin cambios:** no nombran áreas.

**A mano, si los usas (opcional):**
- Si la planilla de Gastos tiene una **validación de datos** (lista desplegable) en la columna Área de Registro Gasto, Ítems u Obligaciones, agrégale **REVENTA**. Si no, la fila igual se copia, pero la celda puede quedar marcada en rojo.
- Si algún informe de **Looker Studio** filtra o agrupa por una lista fija de áreas, agrégale REVENTA.

### Lista de verificación v0.69.1
- [ ] Abajo a la izquierda dice **v0.69.1**.
- [ ] Gastos → Ítems: "PRODUCTOS DE REVENTA" con área **REVENTA** (créalo o edítalo).
- [ ] Registra o clasifica una compra de chocolates con ese ítem: en Registrados aparece con área REVENTA.
- [ ] Finanzas → Resultados → Clasificación: "PRODUCTOS DE REVENTA" está como **Compras de productos de reventa**.
- [ ] Finanzas → Márgenes → Asociar productos: si aparece **"Pasar los productos de reventa al área REVENTA (N)"**, revisa la lista y confirma.
- [ ] Asocia un producto nuevo como "Es reventa": propone el área Reventa.
- [ ] Finanzas → Resultados: el mes con reventa muestra la columna **Reventa**; un mes sin reventa no la muestra.
- [ ] "Comunes repartidos por causa" no tiene columna Reventa y el total es el mismo.
- [ ] En el celular se ve bien.

### Si algo sale mal
Sube de nuevo la v0.69.0. Lo guardado queda (gastos con área REVENTA, vínculos con área REVENTA): la v0.69.0 los muestra en Común (el estado de resultados) y en Registrados tal cual. Nada se borra.

**Por dentro:**
- `areas.js` (nuevo, puro): las listas `GASTO`, `PRODUCCION`, `MARGEN`, `NOMBRE`, `SOLO_A_MANO` y `paraRepartir`.
- `gastos-g2.js` (`AREAS` = `areas.GASTO`) y `app.js` (`AREAS_GASTO` desde areas.js, "Agregar área" sin REVENTA, la nota del editor de ítems, TXT_AREAS_GASTO y TXT_REVENTA).
- `finanzas-ventas.js` (`AREAS` = las de margen, `AREAS_PRODUCCION`, `areaMargenDe`, `areaVinculo`, `reventaFueraDeArea`) y `finanzas-margenes.js`.
- `finanzas-resultados.js` (REVENTA área propia por defecto) y `finanzas-eerr.js` (columna REVENTA, `colConDatos`, `colsVisibles`, `AREAS_REPARTO` para el reparto por causa).
- `finanzas.js` (`pasarReventaArea`); `vista-finanzas.js`, `vista-finanzas-eerr.js` y `vista-finanzas-resultados.js` (pantallas y textos). Los demás: solo la versión. `cocina/` y `fermentacion.js` no cambian.


## Novedades de la v0.69.0: Reglas de conciliación (las manejas tú) y un puntaje explicado en cada propuesta
**Dónde:** Conciliación → Cartola (botón **Reglas** arriba de la bandeja, en Cargos y en Abonos) y Configuración → Reglas de conciliación.

### El caso
Lo aprendido se acumulaba solo, glosa por glosa, y no había cómo decir "todo lo que diga COMISION es una comisión bancaria". Tampoco se veía cuán segura era cada propuesta ni por qué.

### Qué cambia en cómo trabajas
1. **Reglas de conciliación** (una pantalla nueva, con pestañas Cargos y Abonos). Cada regla se lee como una frase:
   "Si la glosa contiene COMISION y el monto está entre $1.000 y $20.000 → Gasto nuevo: COMISIONES BANCARIAS · ADMIN".
   - **Condición:** la glosa contiene una o más palabras (todas deben aparecer, sin importar tildes ni mayúsculas), "y no contiene", monto desde/hasta, cuenta y RUT (en la glosa o en la transferencia). Las aprendidas son "la glosa es…" (exacta).
   - **Resultado:** lo mismo de siempre. Cargos: gasto nuevo (ítem y área o reparto), no es gasto, pago de tarjeta, traspaso, abono de sueldo a una persona o paga un vencimiento. Abonos: asignar al cliente, No es de B2B o Ya estaba registrado.
   - **Nivel:** "Solo proponer" (queda en Revisar) o "Pasar a Listos para confirmar". **Nunca se confirma nada sin tu clic.**
   - Cada regla muestra su estado (activa, pausada, archivada), su origen (creada por ti, propuesta y aceptada, migrada de Lo aprendido, aprendida al confirmar), cuántas veces se usó, la última vez, quién y cuándo, y su **historial**. Editar, pausar y archivar quedan anotados. Nada se borra.
   - Al escribir una regla ves su frase y **con cuántos movimientos pendientes calza ahora**.
2. **Lo aprendido pasó a reglas** (una sola vez, solo):
   - Cargos: cada glosa aprendida es una regla "la glosa es…" (migrada de Lo aprendido).
   - Abonos: las glosas y RUT aprendidos de cada cliente y los textos a ignorar (TRANSBANK…).
   - Se comportan igual que antes. El bloque "Lo aprendido" ahora lleva a la pantalla de reglas. Lo de antes sigue guardado (no se borró).
   - Lo que confirmes desde ahora crea o pone al día la regla "la glosa es…" de esa glosa ("Solo proponer"), como antes se aprendía.
3. **Reglas sugeridas:** cuando 3 o más movimientos de los últimos 120 días se resolvieron igual y su glosa comparte una palabra (o un par) que dice algo, y ninguno con esas palabras se resolvió distinto, aparece un aviso discreto en la bandeja: "Hay N reglas sugeridas", con **Aceptar**, **Editar** o **Descartar** (lo descartado no se vuelve a sugerir).
4. **Choques:** si dos reglas dicen cosas distintas, o una regla choca con una factura, un vencimiento o un folio del mismo monto con un dato que dice quién es, el movimiento queda en **Revisar** con las dos opciones y "Usar esta". El documento manda como propuesta; nunca se elige solo.
5. **El puntaje (0 a 100)** en cada fila ("Listo · 92") y, en el detalle, en "Qué propongo" con sus razones: "+ mismo RUT · + monto exacto · + a 28 días de la factura (lo normal: 28 ± 1) · − hay otra opción parecida".
   - **85 o más y sin choque:** Listo (verde). **50 a 84:** Revisar (amarillo). **Menos de 50 o nada:** Sin coincidencia (rojo).
   - Lo que nunca se confirma solo (probable, una regla que solo propone, Previred, abonos de sueldo) llega a 84 como máximo.
   - **Ritmo de pago:** cuántos días pasan entre la factura y el pago de cada proveedor (y de cada cliente de B2B), en 12 meses: "a este proveedor le pagas en promedio a los 28 días de la factura (±1)".
   - Las listas del detalle ("Buscar en Gastos", otras coincidencias) van ordenadas por puntaje.
   - Al confirmar queda guardado el puntaje que viste (para afinar los pesos más adelante).

### Lecturas y escrituras (Spark)
- **Seleccionar, moverse, puntuar y elegir otra opción: 0 lecturas** (medido en Cargos y Abonos).
- Reglas de Cargos (fen-gastos, colección `conc_reglas`): se leen una vez por sesión con la memoria de siempre (después, 1 lectura cada 2 minutos si cambió algo). Crear, editar, pausar, archivar, aceptar o descartar: 1 lectura y 1 escritura.
- Reglas de Abonos (fen-b2b, `config/conciliacion.reglasConc`): llegan con la escucha que la conciliación ya tenía: **0 lecturas nuevas**. Cada cambio: 1 lectura y 1 escritura.
- Confirmar: la regla (lo aprendido y el contador de uso) va **en la misma transacción** de la confirmación: en Cargos 1 lectura y 1 escritura más (el documento de la regla); en Abonos, la escritura de config/conciliacion que ya se hacía al aprender (o 1 lectura y 1 escritura si solo se cuenta el uso).
- Migración: una vez. Cargos: 1 escritura por regla aprendida + la marca. Abonos: 1 lectura y 1 escritura.
- Reglas sugeridas de Abonos: al abrir Reglas → Abonos se lee **una vez por sesión** lo resuelto de 120 días (1 lectura por abono de esos días). En la bandeja se usa lo que ya está en la memoria.
- El ritmo de pago sale de lo ya leído (gastos en memoria y órdenes pagadas de 6 meses): 0 lecturas.

### Instalación v0.69.0 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.69.0.zip`, con la carpeta `cocina/` (no cambia). Hay dos archivos nuevos: `reglas-conc.js` y `puntaje.js`.
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script, reglas de Firestore ni Cocina.** Las reglas fen-b2b v1.6.0 ya dejan que administración escriba `config/*`, y las de fen-gastos v0.1.0 dejan escribir cualquier colección a administración.

### Lista de verificación v0.69.0
- [ ] Abajo a la izquierda dice **v0.69.0**.
- [ ] Conciliación → Cargos: cada fila dice "Listo · 9x", "Revisar · 6x" o "Sin coincidencia".
- [ ] Lo que antes iba a Listos para confirmar sigue ahí (lo aprendido no cambió).
- [ ] Abre un cargo: en "Qué propongo" está el puntaje con sus razones.
- [ ] Botón **Reglas**: están las migradas de Lo aprendido ("la glosa es…").
- [ ] Crea una regla de prueba "Solo proponer" y mira que el cargo queda en Revisar; después archívala (queda en Archivadas con su historial).
- [ ] Abonos → Reglas: están las glosas aprendidas y TRANSBANK.
- [ ] Si aparece "Hay N reglas sugeridas", revisa una y acéptala o descártala.

### Si algo sale mal
Sube de nuevo la v0.68.0. Lo aprendido de antes se siguió poniendo al día (cartola_reglas y equivalencias), así que la v0.68.0 funciona igual. Las reglas nuevas quedan guardadas y se vuelven a usar al subir otra vez la v0.69.0. Nada se borra.

**Por dentro:**
- `reglas-conc.js` (nuevo, puro): la regla, la frase, calzar, la migración, lo aprendido, las sugeridas, las propuestas de una regla y juntar con la propuesta de siempre (`combinarCargo`).
- `puntaje.js` (nuevo, puro): `PESOS` (todos los pesos en un lugar), `ritmos`, `cargo`, `abono`, `clase`, `factoresTxt`.
- `gastos-cartola-fs.js`: `conc_reglas` (lectura, migración con la marca `conc_reglas/migracion-v0690`, `guardarReglaConc`), lo aprendido y el uso dentro de la transacción de confirmar, el puntaje en el cargo (`puntaje`, `reglaConc`), el ritmo de cada proveedor.
- `b2b.js`: las reglas de Abonos en `config/conciliacion.reglasConc` (migración con `reglasConcMigrado`, `guardarReglaB2b`), la regla que dice el cliente en `proponer`, lo aprendido y el uso al confirmar, `movimientosRecientes` (120 días, una vez por sesión).
- `app.js`: la pantalla de reglas (`pintarReglasConc`), el puntaje y las opciones en el detalle, el aviso de sugeridas, Configuración.
- `bandeja.js`, `gastos-cartola.js` (fecha de la factura del vencimiento), `cartola.js`, `estilos.css`; los demás: solo la versión.

## Novedades de la v0.68.0: Conciliación como bandeja de entrada (lista y detalle lado a lado)
**Dónde:** Conciliación → Cartola → Cargos (Gastos) y Abonos (B2B).

### El caso
Al conciliar cargos había que ir a Gastos para ver si algo estaba registrado de verdad, y se perdía el hilo. En Abonos no se veía de un vistazo qué estaba pagado y qué no.

### Qué cambia en cómo trabajas
1. **Una fila por movimiento**, con:
   - una etiqueta escrita y un borde de color;
   - la fecha, el monto, la glosa corta y la propuesta en una línea (por ejemplo "Paga MOLINOS FICTICIOS SPA F.5501" o "Gasto nuevo: COMISIONES BANCARIAS · ADMIN").
   Las etiquetas son:
   - **Listo** (verde): son los mismos de "Listos para confirmar".
   - **Revisar** (amarillo): la propuesta es probable o tiene dudas, parece repetido o lo aprendido no calza exacto.
   - **Sin coincidencia** (rojo): nada calza.
   - En lo ya revisado: **Conciliado** (verde) o gris (Repetido, No es gasto, Pago de tarjeta, Traspaso, No es de B2B).
2. **Arriba de la lista:**
   - los contadores por estado, que también filtran;
   - el buscador (monto con o sin $, glosa, proveedor o cliente);
   - el botón para confirmar varios.
   Debajo, la línea "Listo: …" con **Deshacer** del último que resolviste.
3. **En el PC (desde 1024 px), dos columnas:** la lista a la izquierda y el detalle del movimiento a la derecha, cada una con su propio scroll. Con el teclado:
   - ↑ y ↓ para moverte;
   - Enter para abrir;
   - Esc (o la X) para cerrar.
4. **El detalle dice todo en un lugar:**
   - el movimiento completo (cuenta, cartola, N° de operación, quién lo subió);
   - **Qué es** y **Qué propongo y por qué** (por ejemplo "mismo RUT del proveedor y monto exacto, 2 días después de la factura");
   - el botón principal;
   - abajo, las acciones de siempre.
5. **Cargos:**
   - **En Gastos** muestra el estado real de lo propuesto: si está registrado, su fecha, ítem, área y monto, si ya está pagado y con qué cargo (o en efectivo o con tarjeta), o si espera su cargo. Si algo del mismo monto ya está pagado en esos días, te avisa, con "Ver el registro".
   - **Buscar en Gastos**: sin salir, busca gastos, vencimientos y facturas por clasificar por monto, proveedor, folio o ítem. Lo que espera su pago se elige ahí mismo ("Es este gasto", "Pagar con este cargo", "Clasificar y conciliar").
6. **Abonos:**
   - las facturas del cliente divididas en **Abiertas** (fecha de factura, total, saldo y "en este abono" en las que cubre la propuesta) y **Pagadas recientes** (cuándo y con qué abono se pagaron);
   - **Buscar facturas** por folio, cliente o monto: una abierta se asigna con "Asignar a este abono".
7. **Después de confirmar o resolver:**
   - en el PC se abre solo el siguiente pendiente;
   - en el celular queda abajo un botón **Siguiente**.
8. **Ya revisados / Ya conciliados** están en la misma lista: al tocar uno se ve cómo se resolvió, su registro y **Deshacer**.
9. **Arriba, plegable ("Cartola y cobertura"):** cargar la cartola, días de conciliar y "Qué está cubierto". Si la pliegas, queda plegada.
10. **En el celular y la tablet:** las mismas etiquetas y la propuesta en cada tarjeta. Al abrirla, el mismo detalle aparece debajo.

### Lecturas (Spark)
- Seleccionar, moverse, filtrar, buscar en la lista, "Buscar en Gastos", "Buscar facturas", abrir lo ya revisado y "Ver el registro": **0 lecturas** (medido).
- "Buscar en Gastos" usa lo que la lista de Gastos ya leía (gastos de 150 días y vencimientos): 0 lecturas nuevas.
- Confirmar y deshacer gastan lo mismo que antes.

### Instalación v0.68.0 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.68.0.zip`, con la carpeta `cocina/` (no cambia). Hay un archivo nuevo: `bandeja.js`.
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script, reglas ni Cocina.**

### Lista de verificación v0.68.0
- [ ] Abajo a la izquierda dice **v0.68.0**.
- [ ] Conciliación → Cargos en el PC: la lista a la izquierda con etiquetas Listo, Revisar o Sin coincidencia, y al tocar un cargo el detalle aparece a la derecha.
- [ ] En el detalle de un cargo, "En Gastos" dice si el gasto o la factura está registrado y si ya está pagado.
- [ ] "Buscar en Gastos" con un monto conocido muestra el gasto y, si ya está conciliado, con qué cargo.
- [ ] Confirma uno: se abre solo el siguiente y arriba aparece "Listo: …" con Deshacer.
- [ ] Toca "Sin coincidencia" arriba: quedan solo esos. Tócalo otra vez: vuelven todos.
- [ ] ↑ ↓ y Enter funcionan en la lista; Esc cierra el detalle.
- [ ] Abonos: al abrir uno se ven las facturas abiertas y pagadas recientes del cliente.
- [ ] En el celular: tarjetas con etiqueta; después de confirmar aparece "Siguiente" abajo.

### Si algo sale mal
Sube de nuevo la v0.67.7. No cambió nada en la base ni en las reglas: todo lo conciliado sigue igual. Nada se borra.

**Por dentro:**
- `bandeja.js` (nuevo, puro):
  - el estado de cada movimiento (`claseCargo`, `claseAbono`);
  - la propuesta en una línea, qué es y por qué (`resumenCargo`, `queEsCargo`, `porQueCargo`, `resumenAbono`, `queEsAbono`, `porQueAbono`);
  - lo registrado con su estado (`registradosGastos`, `estadoTxt`);
  - las búsquedas (`buscarGastos`, `buscarFacturas`, `parseQ`, `coincide`);
  - las facturas del cliente (`facturasCliente`) y `siguiente`.
- `gastos-cartola-fs.js`: la lista entrega `registrados`, de lo que ya leía.
- `app.js`:
  - la bandeja (`barraBjHtml`, `conectarBandeja`, `arribaConcHtml`);
  - el detalle de cargos (`detCargoHtml`, `candCargoHtml`, `buscarGastosHtml`) y de abonos (`detAbonoHtml`, `pagadasAbHtml`, `buscarFactHtml`);
  - lo ya revisado (`detHechoCcHtml`, `detHechoAbHtml`);
  - avanzar al siguiente y Deshacer desde la línea de confirmación.
  - Los mismos `data-*` de antes.
- `estilos.css`: la bandeja (en el PC, el detalle se ubica a la derecha con CSS: es el mismo detalle de la fila).
- `config.js`, `index.html` y los demás: solo la versión.

## Novedades de la v0.67.7: el mismo abono de B2B en la cartola en línea y en la histórica ya no pasa dos veces, y "Ver el registro" muestra el otro movimiento ahí mismo
**Dónde:** Conciliación → Abonos (B2B): al subir la cartola, Para revisar y Ya conciliados · Conciliación → Cargos (Gastos): la propuesta "Parece el mismo movimiento", el aviso "Ojo" y Ya revisados.

### El caso (real)
Conciliaste abonos de la **cartola en línea**. Después subiste la **histórica** y algunos de esos mismos abonos volvieron a aparecer por conciliar. Y cuando la pantalla avisaba que había un registro parecido ("Parece el mismo movimiento", "Ojo: hay otro…", "Ya estaba registrado"), no decía **cuál**: había que ir a buscarlo.

**Por qué pasaba:** cada abono se identifica por su "huella": fecha, **saldo**, monto y glosa. La histórica puede traer el movimiento con la fecha contable (un día después), con otro saldo o con otra glosa: basta una diferencia para que entre como abono nuevo. La v0.67.6 arregló esto para los cargos, pero no para los abonos: de B2B solo están en la memoria los abonos **pendientes**; los ya conciliados no, así que no había con qué compararlos sin leerlos de nuevo.

### Qué cambia en cómo trabajas
1. **Al subir una cartola**, cada abono se compara con los que llegaron en **otra** cartola de la misma cuenta (ya conciliados, ya registrados, "No es de B2B" o todavía pendientes). Es el mismo movimiento si tiene el mismo monto, la fecha a ±1 día y además:
   - el mismo N° de operación (si los dos lo traen), o
   - la misma glosa (sin tildes, mayúsculas ni signos), o
   - el mismo RUT en la glosa.
   Si los dos traen N° de operación y son distintos, son dos pagos: nunca se marca solo.
2. **Si el par es claro**, el nuevo queda **"Repetido"**: no aparece por conciliar, no registra ningún pago ni abono y no cambia ningún folio. En **Ya conciliados** lleva el chip **"Repetido de la cartola en línea del 13-10-2026"** (o "…de la cartola histórica N°53").
3. **Si no es claro** (solo coinciden la fecha y el monto, o hay dos posibles), el abono queda **arriba** en Para revisar con "Parece el mismo movimiento que <el otro> (ya conciliado: <cliente> · folio <N°>)" y el botón **"Marcar como repetido"** (un clic). Con dos posibles dice "Hay 2 posibles: ábrelo para elegir". Estos abonos nunca van a "Listos para confirmar".
4. **También con lo ya subido:** al abrir Abonos, lo pendiente se compara con lo ya resuelto de esos mismos días. Los pares claros quedan "Repetido" (una sola vez, y te avisa arriba); lo dudoso trae la propuesta.
5. **Dos abonos iguales en la MISMA cartola nunca son repetidos:** son pagos distintos.
6. **Deshacer** (en Ya conciliados) devuelve el repetido a Para revisar como un abono normal y deja anotado que **no** es repetido de ese movimiento: no se vuelve a marcar ni a proponer con ese.
7. El mensaje al subir dice cuántos abonos quedaron repetidos y cuántos parecen repetidos.

### "Ver el registro": el otro movimiento, ahí mismo
Donde la pantalla dice que hay otro movimiento igual o parecido, ahora hay un bloque **"Ver el registro"** que se abre sin salir de la pantalla:
- **En Abonos (B2B):** en "Parece el mismo movimiento que…" (en la fila y al abrir el abono), en el chip "Repetido de…" de Ya conciliados, en el aviso "Ojo: el folio … ya se registró pagado…" y dentro de "Ya estaba registrado".
- **En Cargos (Gastos):** en "Parece el mismo movimiento que…", en "Ojo: hay otro cargo del mismo día y monto" y en el chip "Repetido de…" de Ya revisados.

Qué muestra:
- **El movimiento:** fecha, monto, glosa, cuenta, N° de operación, de qué cartola vino ("cartola en línea del …" o "cartola histórica N°…"), cuándo se subió y quién lo subió.
- **Cómo se resolvió:**
  - B2B: el cliente, cada folio (fecha de factura, monto de este abono, total, saldo que queda, órdenes), si fue un **pago parcial**, el saldo a favor si lo hubo, y quién lo concilió y cuándo.
  - Gastos: la acción (pagó vencimientos, ya estaba en Gastos, gasto nuevo, Previred, abono de sueldo, no es gasto, pago de tarjeta…), cada gasto o vencimiento (fecha, ítem, área y monto) y quién lo revisó y cuándo.
- **La fecha de pago** registrada en la factura o el gasto.
- Todo sale de lo que la pantalla ya tiene leído: **abrirlo no gasta lecturas**. El botón (i) del bloque lo explica.

### Dónde se guarda (fen-b2b; las reglas v1.6.0 ya lo cubren)
- `movimientos/{id}` del repetido:
  - `estado: "repetido"`, `repetidoDe: <id del original>`;
  - `repetido`: `{ repetidoDe, por: operacion|glosa|rut|fecha_monto, como: carga|lista|mano, original: { fecha, monto, descripcion, cuenta, nOperacion, cartola, fuente, estado, cliente, folios, resueltoPor, resueltoEn, subidaPor, subidaEl } }` (la copia del original, para mostrar el chip y el registro aunque el original no esté en la memoria);
  - `resuelto: { por, en }` ("Sistema Fën (repetido)" o quien lo marcó) y `planillaPendiente: false`.
- Desde ahora cada abono subido guarda también `nOperacion`, `tipoCartola` y `nCartola` (para reconocer el mismo movimiento y mostrar de dónde vino).
- Al deshacer: vuelve a `pendiente` con `deshechos` + 1 (lo que pide la regla v1.5.0), `ultimoDeshecho`, `deshechosAntes` y `noRepetidoDe: [<id del original>]`.
- `config/conciliacion.cartolas[].repetidos`: cuántos quedaron repetidos en esa subida.
- **La planilla de B2B no cambia:** un repetido no registró nada, así que no pasa a "ConciliacionBancaria_Historial" (el script v2.8.2 ni lo ve).
- **Nada se borra.**

### Lecturas y escrituras (Spark)
- **Al subir (B2B):** una sola consulta por rango de fechas, [primera fecha − 1 día, última + 1 día] del archivo, de todas las cuentas (se filtra en el navegador; así no hace falta un índice nuevo). Sirve para dos cosas: ver qué ya estaba (la misma huella) y reconocer el mismo movimiento de otra cartola. Lo que no aparece en el rango se pregunta uno por uno, como antes.
  - Lecturas = abonos ya guardados en esos días + abonos del archivo que no estaban en el rango. Antes: 1 por abono del archivo.
  - Medido con la N°53 de prueba (6 abonos, 6 ya guardados en esos días): **12 lecturas** (antes habrían sido 6) y **7 escrituras** (6 abonos + el registro de la cartola), igual que antes. Un repetido no agrega escrituras.
- **Lo ya subido (al abrir Abonos):** la misma consulta, solo para los días de los pendientes (±1), en tramos (como máximo 6 consultas) y **una vez por sesión**: queda en la memoria (lo ya leído al subir o al abrir "Ya conciliados" también sirve).
  - Medido: 1 consulta y 2 lecturas. Marcar cada par claro: 1 lectura y 1 escritura, una sola vez.
  - Volver a pintar la lista o revisar otra vez: 0 lecturas.
- **Marcar como repetido (la propuesta):** 3 lecturas (el abono y el original, y el abono otra vez dentro de la transacción) y 1 escritura.
- **Deshacer un repetido:** 2 lecturas y 1 escritura (no llama al script de B2B).
- **Ver el registro (B2B y Gastos):** 0 lecturas.
- **Cargos (Gastos):** la lista ya traía los gastos de 150 días; ahora entrega también lo ligado a cada cargo (de la misma memoria): 0 lecturas nuevas.

### Instalación v0.67.7 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.67.7.zip`, con la carpeta `cocina/` (no cambia). Hay un archivo nuevo: `registro-detalle.js`.
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script, reglas ni Cocina.**

### Lista de verificación v0.67.7
- [ ] Abajo a la izquierda dice **v0.67.7**.
- [ ] Abre Conciliación → Abonos. Si había abonos de la histórica que ya habías conciliado desde la en línea, arriba dice "… quedó como repetido …" y ya no están por conciliar.
- [ ] En **Ya conciliados**, ese abono tiene el chip **"Repetido de la cartola en línea del …"**. Toca **"Ver el registro"**: aparecen el cliente, el folio con su fecha de factura y saldo, de qué cartola vino y quién lo concilió.
- [ ] Si algún abono tiene arriba "Parece el mismo movimiento que…", toca **"Ver el registro"** y, si es el mismo, **"Marcar como repetido"**.
- [ ] La próxima histórica: el mensaje dice "N repetidos de otra cartola" en los abonos y esos no aparecen por conciliar.
- [ ] En Cargos, un "Ojo: hay otro cargo del mismo día y monto" trae "Ver el registro" con el gasto (fecha, ítem, monto) y quién lo revisó.
- [ ] En el celular el registro queda en una columna y nada se sale de lado.

### Si algo sale mal
Sube de nuevo la v0.67.6. Los abonos marcados "repetido" siguen sin aparecer por conciliar (no están pendientes) y en Ya conciliados salen con el estado "repetido" sin el registro; su Deshacer funciona igual (con la v0.67.6 pide el script de B2B, como siempre). Los cargos no cambian. Nada se borra.

**Por dentro:**
- `b2b.js`:
  - `cargarCartola`: una consulta por rango (`leerRango`) para lo ya visto y el mismo movimiento; el par claro nace `repetido`; cuenta `repetidos` y `parecidos`; guarda `nOperacion`, `tipoCartola` y `nCartola`;
  - `revisarRepetidosB2b` (lo ya subido, una vez por sesión: `tramosFaltantes`), `marcarRepetidoB2b`, `deshacerRepetidoB2b` (dentro de `deshacerMovimiento`), `fuenteMov`, `textoFuenteMov`, `textoRepetidoMov`, `detalleRepetidoMov`, `vistaRepMov`;
  - la memoria de los abonos leídos (`movConocido`, `movsConocidos`, `usoRepetidosB2b`) se pone al día al conciliar, marcar o deshacer, y con lo que lee "Ya conciliados".
  - Usa las mismas reglas que los cargos (`gastos-cartola.js`: `mismoMovimiento`, `buscarRepetidos`).
- `registro-detalle.js` (nuevo): el bloque "Ver el registro", igual para B2B y Gastos (`htmlRegistro`, `registroAbono`, `registroFolioPagado`, `registroCargo`).
- `gastos-cartola-fs.js`: la lista entrega `ligados` (los gastos de cada cargo) y los posibles con de qué cartola, cuándo y quién.
- `app.js`: la propuesta, "Marcar como repetido", el registro y el chip en Abonos; el registro en Cargos (propuesta, "Ojo" y Ya revisados); el mensaje al subir. `estilos.css`: el bloque del registro.
- `config.js`, `index.html` y los demás: solo la versión.

## Novedades de la v0.67.6: el mismo movimiento en la cartola en línea y en la histórica ya no aparece dos veces, y Previred avisa si el cargo es de otro mes
**Dónde:** Conciliación → Cartola → Cargos (al subir la cartola y en la lista) · el cargo de Previred ("Pago de Previred"). Solo con Gastos en la base nueva.

### El caso (real)
Conciliaste un cargo de la cartola en línea. Después subiste la histórica (N°53) y el mismo movimiento volvió a aparecer como cargo nuevo en "Para revisar": "$1.500.000 · TEF A RUT … · 13 oct · Chequera". "Ya está en Gastos" no ofrecía nada, porque el gasto ya estaba unido al cargo de la en línea.

**Por qué pasaba:** cada cargo se identifica por su "huella": cuenta, fecha, **saldo**, monto y glosa. Si dos archivos traen la misma huella, es el mismo cargo; también si traen el mismo N° de operación **con la misma fecha y monto**. La histórica puede traer el movimiento con la fecha contable (un día después), con otro saldo o con otra glosa que la en línea: basta una diferencia para que la huella sea otra. Y el N° de operación solo se comparaba con la misma fecha (y la en línea a veces no lo trae). Así entraba como cargo nuevo.

### Qué cambia en cómo trabajas
1. **Al subir una cartola**, cada cargo se compara con lo que llegó en **otra** cartola de la misma cuenta. Es el mismo movimiento si tiene el mismo monto, la fecha a ±1 día y además:
   - la misma glosa (sin tildes, mayúsculas ni signos), o
   - el mismo RUT en la glosa, o
   - el mismo N° de operación, si los dos lo traen.
2. **Si el par es claro y el otro ya está revisado** (de cualquier forma), el nuevo queda **"Repetido"**: no aparece en "Para revisar", no crea nada en Gastos y no cuenta en ningún total. En "Ya revisados" lleva el chip **"Repetido de la cartola en línea del 13-10-2026"** (o "…de la cartola N°53").
3. **Si el par es claro y el otro sigue por revisar**, el nuevo queda detrás del otro: revisas uno solo. Ese cargo muestra de dónde llegó ("Cartola en línea del … · Cartola histórica N°53") y, si la histórica trae el RUT, se usa para reconocer al proveedor.
4. **Si no es claro** (solo coinciden la fecha y el monto, o hay dos posibles), el cargo queda en "Para revisar", **arriba**, con la propuesta: "Parece el mismo movimiento que <el otro> (ya revisado: <qué se hizo>). **Marcar como repetido**". Un clic. Con dos posibles, al abrirlo eliges cuál.
5. **También con lo ya subido:** al abrir la lista, lo que ya está por revisar y es el mismo de otro ya revisado (como tu $1.500.000) se marca solo una vez, con su registro. Lo dudoso trae la propuesta.
6. **Dos cargos iguales del mismo día en la MISMA cartola nunca son repetidos:** son pagos distintos. Sigue el aviso "Ojo: hay otro cargo del mismo día y monto".
7. **Deshacer** (Ya revisados) lo devuelve a "Para revisar" como cargo normal, y queda anotado que **no** es repetido de ese movimiento: no se vuelve a marcar solo.
8. **No cuentan nunca:** el número de la pestaña, "Para revisar" y su total, las cartolas subidas en "Qué está cubierto" ("6 nuevos de 8 · 2 repetidos"), los por revisar del cierre de mes y el flujo de caja (pagos de tarjeta y de Previred) no incluyen los repetidos.
9. El mensaje al subir dice cuántos quedaron repetidos y cuántos parecen repetidos.

### Previred: el cargo lejos de la fecha de pago
- Al unir un cargo a una planilla (o pagar un vencimiento de Cotizaciones) cuya **fecha de pago** (del certificado, del comprobante o del CSV) está a **más de 10 días** del cargo, pregunta: "¿Seguro? Este cargo es del 12 oct 2026 y agosto 2026 se pagó el 12 sep 2026. Puede ser de otro mes."
  - **Unir igual** (o "Pagar igual") sigue como siempre.
  - **Elegir otra planilla** no une nada y te deja elegir en la lista.
- Si la planilla **no tiene fecha de pago**, se compara con su vencimiento (13 del mes siguiente o el hábil que sigue), con **±15 días**.
- **La planilla propuesta:** ya era la de fecha de pago más cercana a ±5 días. Ahora, fuera de esos 5 días, también es la más cercana (por fecha de pago o, si no tiene, por su vencimiento). Antes quedaba la del mes más reciente.

### Dónde se guarda (fen-gastos; las reglas v0.1.0 ya lo cubren)
- `cartola_cargos/{id}` del repetido:
  - `estado: "REPETIDO"`, `accion: "repetido"`, `repetidoDe: <id del original>`;
  - `detalle` (texto JSON): `{ repetidoDe, por: operacion|glosa|rut|fecha_monto, como: carga|lista|mano, original: { fecha, descripcion, cartola, nCartola, fuente, estado, accion } }`;
  - `resueltoEl`, `resueltoPor` ("Sistema Fën (repetido)" o quien lo marcó) y su entrada en `registro`.
- Al deshacer: vuelve a `POR_REVISAR`, con `noRepetidoDe: [<id del original>]` y el "Deshecho …" en `historial`.
- `cartolas/{id}.repetidos`: cuántos quedaron repetidos en esa subida.
- Nada se borra. La hoja "Cartola Cargos" recibe el estado "REPETIDO" en la columna Estado y el detalle en Detalle (columnas que ya existen).

### Lecturas y escrituras
- **Reconocer repetidos (al subir y al listar):** 0 lecturas nuevas. Los cargos ya están en la memoria.
- **Al subir:** un repetido se guarda como cualquier cargo nuevo (1 escritura, la misma de antes): 0 escrituras extra.
  - Medido con la N°53 de prueba (8 cargos, 2 repetidos): 19 lecturas y 10 escrituras.
- **Al listar, lo ya subido:** 1 lectura y 1 escritura por cada cargo que se marca, **una sola vez**, más el contador.
  - Volver a listar: medido 1 lectura y 0 escrituras.
- **Marcar como repetido (la propuesta):** medido 4 lecturas y 2 escrituras (el cargo y el contador).
- **Deshacer un repetido:** medido 4 lecturas y 2 escrituras.
- **Aviso de Previred:** 0 lecturas (sale de lo que ya está en la pantalla).

### Instalación v0.67.6 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.67.6.zip`, con la carpeta `cocina/` (no cambia).
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script, reglas ni Cocina.**

### Lista de verificación v0.67.6
- [ ] Abajo a la izquierda dice **v0.67.6**.
- [ ] Abre Conciliación → Cartola → Cargos. El $1.500.000 de la N°53 ya no está en "Para revisar".
- [ ] En "Ya revisados" ese cargo tiene el chip **"Repetido de la cartola en línea del …"**.
- [ ] El número de la pestaña Cargos bajó en los repetidos.
- [ ] Si algún cargo tiene arriba "Parece el mismo movimiento que…", revisa la glosa y toca **"Marcar como repetido"** si es el mismo.
- [ ] La próxima histórica: el mensaje dice "N repetidos de otra cartola" y esos no aparecen para revisar.
- [ ] En un cargo de Previred, elige una planilla de otro mes: aparece "¿Seguro? …". "Elegir otra planilla" no une nada.
- [ ] En el celular nada se sale de lado: la propuesta queda debajo del cargo, con el botón a lo ancho.

### Si algo sale mal
Sube de nuevo la v0.67.5. Los cargos marcados "Repetido" siguen sin aparecer en "Para revisar" (no están por revisar) y salen en "Ya revisados" con un texto que no corresponde ("Conciliado"); su Deshacer funciona igual. Nada se borra.

**Abonos de B2B:** los abonos viven en fen-b2b y se identifican de la misma forma (fecha, saldo, monto y glosa), así que pueden repetirse igual entre la en línea y la histórica. **No se cambió aquí.** Si pasa, en Conciliación → Abonos usa "Ya estaba registrado" (no registra ningún pago). Más detalle en la nota del proyecto.

**Por dentro:**
- `gastos-cartola.js`:
  - `ESTADOS.repetido`, `REPETIDO`, `mismoMovimiento`, `buscarRepetidos` (fuertes, uno a uno, débiles y ambiguos), `repetidosAlListar`, `detalleRepetido`, `textoRepetido`, `textoCriterio`;
  - `planCarga` deja los pares claros como "Repetido" y cuenta `repetidos` y `parecidos`; `vistaCargo` trae `repetidoDe` y `noRepetidoDe`;
  - Previred: `fechaRefPrevired`, `lejosDePrevired` y `opcionPropuesta` (la más cercana fuera de ±5 días).
- `gastos-cartola-fs.js`: `lista` marca lo ya subido (`marcarRepetidos`) y deja la propuesta; `resolver` con `accion: "repetido"`; `deshacer` de un repetido; Proveedores no cuenta repetidos.
- `cartola.js` (cuenta `repetidos` y `parecidos`), `finanzas.js` (`cargosCartola` sin repetidos).
- `app.js`: la propuesta en la fila y al abrir el cargo, el chip y el texto en Ya revisados, Deshacer, el mensaje al subir, "Qué está cubierto" y el aviso de Previred. `estilos.css`: la propuesta y el chip.
- `config.js`, `index.html` y los demás: solo la versión.

## Novedades de la v0.67.5: reparto en % por trabajador en Previred (por ejemplo PAN 40 % y B2B 60 %), un solo reparto por persona con los abonos de sueldo y "Cambiar reparto" en los meses ya cargados
**Dónde:** Conciliación → Previred (vista previa y Meses cargados) · el abono de sueldo (Agenda, Pagar o la cartola). Solo con Gastos en la base nueva.

### El caso (real)
Una trabajadora reparte su tiempo: 40 % en PAN y 60 % en Ventas B2B. Previred guardaba **una sola área** por RUT, así que todo su costo previsional quedaba en un área. Los abonos de sueldo ya se podían repartir en %, pero Previred no lo sabía (y al revés).

### Qué cambia en cómo trabajas
1. **"Repartir en %" en cada trabajador de la vista previa** (certificado, comprobante de pago o CSV). Es la misma caja del abono de sueldo: una área, o varias áreas con su % (suman 100). Debajo de cada parte se ve el monto.
   - El gasto del trabajador queda en **una línea por área**. Los montos suman exacto su total; el peso que sobra de redondear va al **% más grande**.
   - Cada línea lleva la misma observación y la misma marca de Previred (mes y RUT): lo que busca por RUT o por mes (repetidos, totales de la conciliación, Meses cargados, comparación del comprobante o del CSV) sigue igual.
   - El botón dice cuántos gastos se crean (por ejemplo "Registrar 5 gastos" con 3 trabajadores, dos de ellos repartidos).
2. **Se recuerda por RUT** para el mes siguiente: aparece "Propuesta: reparto recordado en Previred".
3. **Un solo reparto por persona, con los abonos de sueldo:**
   - Si la persona del abono es un trabajador de Previred (por RUT o por su nombre), el abono propone su reparto de Previred.
   - Si en Previred no hay nada, o lo del abono es más nuevo, la vista previa propone el del abono: "Propuesta: del abono de sueldo (<nombre>), el más reciente".
   - Cada lado guarda en lo suyo. El otro lado lee **el más nuevo por fecha**.
4. **"Cambiar reparto" en Meses cargados**, en cada trabajador de cada mes. Abre la misma caja, con el reparto actual.
   - Corrige los gastos de ese mes por el camino de siempre: historial (quién, cuándo, antes y después, y el **motivo**) y revisión de versión.
   - Si el reparto nuevo tiene más áreas, se crean las líneas que faltan. Si tiene menos, las que sobran se **anulan**. **Nada se borra.**
   - El total del mes no cambia, ni las cotizaciones, ni la planilla del mes.
   - **"Aplicar también a los otros meses cargados de este trabajador"**: casilla aparte, **sin marcar**.
   - **Mes cerrado en Finanzas:** no se cambia nada. El aviso dice qué mes y qué hacer: reabrirlo en Finanzas → Resultados → Cierre de mes (con el motivo), cambiar el reparto y volver a cerrarlo, o desmarcar "Aplicar también…" si el cerrado es otro mes.
   - Si el mes todavía no tiene gastos (el vencimiento de Cotizaciones sigue por pagar), cambia su plan: los gastos nacen con el reparto nuevo al pagarlo.
5. **Vencimiento de Cotizaciones:** el plan guardado en el vencimiento lleva el reparto. Al pagarlo (Pagar o la cartola), los gastos nacen partidos.
6. En Meses cargados, cada trabajador muestra su reparto del mes (por ejemplo "B2B 60% · PAN 40%"), sacado de sus gastos.

### Dónde se guarda (fen-gastos; las reglas v0.1.0 ya lo cubren)
- `cotiz_trabajadores/{rut}`:
  - `areas: [{ area, pct }]`;
  - `area`: sigue, y es la principal (la de mayor %);
  - `repartoEn`: cuándo se eligió (solo cambia si el reparto cambia);
  - `repartoMarca`: el último "Cambiar reparto".
- `abono_destinatarios/{id}.repartoEn`: lo mismo, del lado de los abonos.
- `vencimientos/{id}.documento.previred.trabajadores[].areas`: el plan del vencimiento, cuando el trabajador tiene dos áreas o más.
- `gastos/*`: una línea por área, con `previred { periodo, rut }`.
  - Las líneas creadas por "Cambiar reparto" llevan `origenDetalle { tipo: 'previred', reparto: true, desde, motivo, marca, periodo, por, en }`, con su historial.
  - Las anuladas quedan con `anulado.motivo = "Reparto de Previred cambiado: <motivo>"`.
- Nada nuevo en la planilla de Google: la hoja "Cotizaciones Trabajadores" tiene columnas fijas y no copia `areas`. Los gastos nuevos, corregidos o anulados pasan a "Registro Gasto" como siempre.

### Lecturas y escrituras
- **Vista previa:** 0 lecturas nuevas. Lo recordado en los abonos sale del paquete de `abono_destinatarios`, ya en memoria.
- **Registrar:** como siempre, más **1 escritura por cada línea extra** de un trabajador repartido.
  - Medido con el CSV de 3 trabajadores (2 repartidos, 5 gastos): 45 lecturas, contando la lista que se refresca, y 27 escrituras.
- **Meses cargados:** 0 lecturas nuevas. El reparto sale de los gastos, ya en memoria.
- **Cambiar reparto, un mes:** lee, dentro de la transacción, el cierre del mes en Finanzas, cada línea, cada id nuevo y el trabajador. Escribe cada línea que cambia, se crea o se anula, el trabajador y el contador.
  - Medido (1 línea corregida y 1 nueva): 12 lecturas, contando la lista que se refresca, y 4 escrituras.
- **Cambiar reparto en 3 meses:** medido 16 a 22 lecturas y 8 escrituras.

### Instalación v0.67.5 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.67.5.zip`, con la carpeta `cocina/` (no cambia).
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script, reglas ni Cocina.**

### Lista de verificación v0.67.5
- [ ] Abajo a la izquierda dice **v0.67.5**.
- [ ] Sube el Previred del mes. En la trabajadora que reparte, toca **"Repartir en %"**: elige PAN 40 y B2B 60. Debajo se ven los dos montos y "Suma 100%".
- [ ] El botón dice un gasto más que trabajadores. Al guardar, en Gastos → Registrados ella tiene dos líneas (PAN y B2B) que suman su total.
- [ ] En Meses cargados su fila dice "B2B 60% · PAN 40%".
- [ ] El mes siguiente, la vista previa ya trae "Propuesta: reparto recordado en Previred" con PAN 40 y B2B 60.
- [ ] En un abono de sueldo para ella (por su nombre o RUT), el área propuesta es "Reparto de Previred" con PAN 40 y B2B 60.
- [ ] En un mes ya cargado, **"Cambiar reparto"**: la casilla "Aplicar también…" viene sin marcar. Pide el motivo. Después, el total del mes es el mismo y el gasto tiene el cambio en su historial.
- [ ] En un mes cerrado en Finanzas, "Cambiar reparto" no cambia nada y dice cómo reabrirlo.
- [ ] En el celular nada se sale de lado: la caja del reparto queda debajo de cada trabajador.

### Si algo sale mal
Sube de nuevo la v0.67.4. Los gastos ya partidos siguen siendo gastos normales (uno por área) y la v0.67.4 los muestra igual. `cotiz_trabajadores` sigue teniendo `area` (la principal), así que la v0.67.4 propone esa sola área. Nada se borra.

**Por dentro:**
- `gastos-abono.js`, la única regla del reparto:
  - `montosPorAreas` (suma exacta; el resto al % más grande), que también usa `vistaConAreas`;
  - `repartoTrabajador`, `principal`, `elegirReparto` (lo más nuevo por fecha) y `destinatarioDeTrabajador`;
  - `areasPorDefecto` elige entre lo recordado y Previred por fecha.
- `gastos-g3d.js`:
  - `revisarRegistro` acepta `areas`; `docTrabajador`, `repartoCambio`, `planTrabajadores`, `partesTrabajador` y `lineasPrevired` (una línea por área);
  - para "Cambiar reparto": `gastosPorTrabajador`, `repartoDeLineas`, `planCambioReparto`, `lineaReparto` y `mesCerrado`.
- `gastos-g3d-fs.js`:
  - `cotEstado` trae los destinatarios de abonos;
  - `cotRegistrar` guarda `repartoEn` solo si el reparto cambió y cuenta las escrituras por línea;
  - `cotLista` trae el reparto por trabajador y mes;
  - `cotCambiarReparto` (nuevo, `cot_reparto`);
  - `cotComprobante`: corrige la fecha de pago de hasta 320 líneas (antes 80).
- `gastos-fs.js` (`agregarAbono` guarda `repartoEn`; `datosAbono` trae `areas` y las fechas), `gastos.js` (`cot_reparto`) y `previred.js` (`cambiarReparto`).
- `app.js`:
  - la caja "Área de este abono" sirve también para Previred (etiqueta, texto (i), `data-area` con una sola área, `alCambiar`);
  - vista previa del certificado, del comprobante y del CSV;
  - Meses cargados con "Cambiar reparto".
- `estilos.css`, `config.js`, `index.html` y los demás: solo la versión. La carpeta `cocina/` no cambia.

**Pruebas:**
- Nueva `pruebas/sistemafen/previred-reparto-v0675.test.js` (12, solo con datos ficticios). Cubre:
  - 40/60 en dos líneas que suman exacto;
  - el resto al % más grande;
  - recordado por RUT el mes siguiente;
  - el abono propone el reparto de Previred, y al revés;
  - "Cambiar reparto" con historial, versión y anulación;
  - "Aplicar también a los otros meses";
  - el bloqueo por mes cerrado;
  - el camino del vencimiento (plan, cambio antes de pagar y pago);
  - la comparación del CSV por RUT con líneas partidas;
  - los totales de la conciliación sin cambio;
  - un envío repetido o viejo;
  - las 4 anchuras.
- Siguen pasando: e2e, sii-v066, sii-reclasificar-v0672, conciliacion-v064, conciliacion-v0652, conciliacion-notas-sii-v0671, conciliacion-combinaciones-v0674, previred-v0651, previred-comprobante-v067, previred-formatos-v0673, cuota-v0632, cuota-v0633, sf-pantallas, finanzas-f1b/f3a/f3b, gastos-g3a/b/c/d/e y gastos-v0631.
- Capturas en `pruebas/capturas/v0675/`.

## Novedades de la v0.67.4: "Ya está en Gastos" con combinaciones (factura menos nota de crédito, varias facturas en una transferencia), elegir varios y "De este proveedor"
**Dónde:** Conciliación → Cartola (Cargos) → "Ya está en Gastos". Solo con Gastos en la base nueva.

### El caso (real)
- Una transferencia pagó una factura **menos su nota de crédito**: un producto no llegó y el proveedor emitió la nota.
- La factura y la nota ya estaban en Gastos (la nota como gasto negativo), pero ningún gasto era del monto del cargo.
- "Ya está en Gastos" dejaba elegir uno solo y no mostraba las notas de crédito.
- La glosa del banco venía cortada ("TEF A <nombre del proveedor a medias>").

No se podía conciliar.

### Qué cambia en cómo trabajas
1. **Combinaciones.** Cuando varios gastos del MISMO proveedor suman el cargo (±$1), aparecen como una sola opción, por ejemplo "F.5501 $96.390 − NC 880 $4.760 = $91.630".
   - Sirve para una factura menos su nota de crédito y para varias facturas pagadas juntas.
   - **Seguro** si el RUT está confirmado (transferencia enviada o RUT en la glosa); si no, **Probable**.
   - Al confirmar ("Son estos N gastos"), **todos** quedan con el cargo. **Deshacer** los suelta todos.
   - Si el proveedor se reconoce, la combinación aparece también en la fila del cargo ("Ya en Gastos, combinación: …").
   - **Nunca se confirma sola:** no entra en "Listos para confirmar" ni en la confirmación en lote.
2. **Las fechas son las de siempre:**
   - facturas del SII: de 5 días antes a 45 después del cargo;
   - cada nota de crédito: después de su factura, hasta 45 días.

   Si la nota de crédito dice qué factura corrige (su referencia en el XML), esa pareja va primero. Después va la combinación más chica y luego las fechas más cercanas.
3. **"Elegir varios y sumarlos".** Cambia los radios por casillas, también para notas de crédito, que restan. Abajo se ve en vivo:
   - "Suma $X · cuadra con el cargo";
   - "faltan $Y" o "sobran $Y".

   Solo se confirma si cuadra (±$1). En el celular, la suma queda a la vista mientras marcas. "Elegir uno solo" vuelve a lo de siempre: un clic elige un gasto exacto.
4. **Una nota de crédito nunca va sola.** En "De este proveedor" se ve sin botón propio ("Resta: solo se concilia junto con su factura"). Marcada sola en "Elegir varios", no deja confirmar.
5. **El proveedor del cargo.** Arriba dice "Proveedor: <nombre> · reconocido por <RUT / glosa aprendida / nombre en la glosa>". Se reconoce por:
   - el RUT (de la transferencia enviada o de la glosa);
   - la glosa aprendida;
   - el nombre de la glosa: sin "TEF A", "TRANSF A", "TRASPASO A", tildes ni sufijos (LTDA, SPA, S.A.), sus palabras deben ser el comienzo de la razón social de un solo proveedor (al menos 10 letras o 2 palabras; la última puede venir cortada).

   Si la glosa calza con varios proveedores, lo dice y no reconoce ninguno.
6. **"De este proveedor (N)".** Muestra todos sus gastos sin cargo (facturas y notas de crédito), de cualquier monto, el más nuevo primero. El resto sigue plegado en "Ver parecidos".
7. **Factura y nota de crédito por clasificar** (sin gasto todavía) que suman el cargo: el cargo avisa "clasifica primero la factura y la nota de crédito en Cargas del SII", con un enlace a Por clasificar. Después aparecen como combinación.
8. **"Factura por clasificar" (v0.66) y "Paga la compra a crédito" (v0.67.1) siguen mandando** sobre una combinación.

### Dónde se guarda (fen-gastos; las reglas v0.1.0 ya lo cubren)
- Cada gasto de la combinación queda con `cartola` y `cartolaCargo`, como un gasto solo. El historial dice "conciliado con la cartola (junto con N líneas más)".
- `cartola_cargos/{id}.detalle` agrega `combinacion: true`, `documentos` (por ejemplo ["F.5501", "NC 880"]), `notasCredito` y `rut`. En "Ya revisados" dice "Ya estaba en Gastos, combinación: F.5501 · NC 880 (2 líneas, con nota de crédito)".
- `sii_docs/{id}.porClasificar.referencias = [{ tipo, folio, fecha }]`: la referencia del XML, solo en los documentos subidos desde ahora.

### Lecturas y escrituras
- **Listar la cartola:** 0 lecturas nuevas.
  - Las notas de crédito salen de la misma consulta de gastos.
  - Las referencias salen de `sii_docs`, que ya está en memoria.
  - Las combinaciones y el proveedor se calculan en tu equipo.
- **Confirmar una combinación de N gastos:** lee 2N + 2 y escribe N + 1 (más el contador de siempre).
  - Medido con 2 gastos: 10 lecturas, contando la lista que se refresca, y 4 escrituras.
  - Más 1 escritura si se aprende la glosa en la ficha del proveedor.
- **Deshacer:** como siempre. Medido con 2 gastos: 8 lecturas y 4 escrituras.

### Instalación v0.67.4 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.67.4.zip`, con la carpeta `cocina/` (no cambia).
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script, reglas ni Cocina.**

### Lista de verificación v0.67.4
- [ ] Abajo a la izquierda dice **v0.67.4**.
- [ ] El cargo de la factura menos la nota de crédito (glosa cortada) dice en su fila "Ya en Gastos, combinación: F.… − NC … = $…" con **Probable**.
- [ ] Al abrirlo: arriba "Proveedor: … · reconocido por nombre en la glosa"; la combinación viene elegida y el botón dice **"Son estos 2 gastos"**.
- [ ] "De este proveedor" muestra sus facturas y la nota de crédito, que no tiene botón propio.
- [ ] Al confirmar, en Gastos → Registrados la factura y la nota de crédito quedan con la cartola. En "Ya revisados" dice "Ya estaba en Gastos, combinación: …".
- [ ] **Deshacer** ese cargo: los dos gastos quedan sin cartola, nada se anula, y la combinación se vuelve a proponer.
- [ ] En otro cargo, **"Elegir varios y sumarlos"**: la suma dice "faltan" o "sobran" hasta que cuadra, y solo entonces deja confirmar.
- [ ] En el celular nada se sale de lado y la suma queda a la vista mientras marcas.

### Si algo sale mal
Sube de nuevo la v0.67.3. Los gastos ya unidos siguen con su cartola, y Deshacer funciona igual en la v0.67.3, porque busca los gastos por el cargo. Nada se borra.

**Por dentro:**
- `gastos-banco.js`:
  - `candidatosGastos(…, { conNC })` y `rankear` sin montos negativos;
  - `nombreBase`, `nombreGlosa`, `proveedorDelCargo` y `esDelProveedor`;
  - `combinacionesCargo` (acotada: `COMB`) y `combinacionPorClasificar`;
  - `analisisCargo` (con memoria por lista), `propuestaCombinacion`, `revisarSeleccion` y `textoCombinacion`.
- `gastos-cartola.js`: `proponer` paso 6b (combinación, solo con la base nueva).
- `gastos-cartola-fs.js`:
  - `lista` con `notasCredito` y sus referencias (`refsNC`);
  - `resolverGasto` con `combinacion` (±$1, hasta 120 líneas, nunca solo notas de crédito, `documentos` y `rut` en el detalle).
- `sii.js` (`Referencia` del XML) y `sii-pendientes.js` (`referencias` en `datosPendiente`).
- `app.js`:
  - `editorYaEnGastos`, `filaCandCc` y `filaCombCc`;
  - Elegir varios y "De este proveedor";
  - prioridad de "Factura por clasificar" y "Paga la compra a crédito";
  - "Ya revisados" y Deshacer.
- `estilos.css`, `config.js`, `index.html` y los demás (solo la versión). La carpeta `cocina/` no cambia.

**Pruebas:**
- Nueva `pruebas/sistemafen/conciliacion-combinaciones-v0674.test.js` (15, solo con datos ficticios). Cubre:
  - el proveedor por RUT, por la transferencia, por la glosa aprendida, por el nombre cortado, corto y ambiguo;
  - factura − nota de crédito (±$1, fechas, referencia);
  - dos facturas, con las fechas más cercanas primero;
  - una nota de crédito sola nunca;
  - Elegir varios: cuadra, no cuadra y nota sola;
  - Deshacer suelta todos;
  - "De este proveedor";
  - "Factura por clasificar" manda;
  - el aviso de por clasificar;
  - la búsqueda acotada con 40 documentos;
  - las 4 anchuras.
- Siguen pasando: e2e, sii-v066, sii-reclasificar-v0672, conciliacion-v064, conciliacion-v0652, conciliacion-notas-sii-v0671, previred-v0651, previred-comprobante-v067, previred-formatos-v0673, cuota-v0632, cuota-v0633, sf-pantallas, finanzas-f1b/f3a/f3b y gastos-g3a/b/c/d/e.
- Capturas en `pruebas/capturas/v0674/`.

## Novedades de la v0.67.3: Previred lee todos los formatos del comprobante, el CSV de la nómina, la diferencia del banco como multas e instrucciones dentro de Previred
**Dónde:** Conciliación → Previred · Conciliación → Subir archivo · Conciliación → Cartola (Cargos) → "Pago de Previred" · Hoy. Solo con Gastos en la base nueva.

### El caso (real)
El comprobante de agosto (pagado atrasado) se leía bien. El de septiembre (pagado en plazo, con licencias y un trabajador nuevo) no se leía: trae primero las AFP, con otro título ("…Y DEPOSITOS DE AHORRO VOLUNTARIO FONDO DE PENSIONES…"), columnas de movimiento de personal con fechas, y deja fuera las líneas en 0 (el ISL solo trae "TOTAL A PAGAR A LA MUTUAL").

### Qué cambia en cómo trabajas
1. **Un solo lector para todos los comprobantes.** Reconoce cada sección por su título, en cualquier orden. Lo que puede faltar vale 0: intereses, reajustes, multas, recargos y costas, las columnas de movimiento de personal y sus fechas. Los cruces siguen estrictos: en cada institución, las filas de los trabajadores suman la cotización, y cotización + intereses + multas = total. Si algo no calza, el aviso dice **la sección y el cruce que falló** (por ejemplo, "AFP Modelo · fondo de pensiones: … no da el total … (cruce: cotización + intereses + multas = total)").
2. **Isapre u otra sección desconocida: bloquea.** Si el PDF trae una sección que todavía no se lee, dice: "Este PDF trae una sección que Sistema Fën todavía no lee (<nombre>): carga el mes con el archivo CSV de la nómina." **No se adivinan montos.**
3. **El CSV de la nómina se puede subir** aquí o con "Subir archivo", que lo reconoce: filas con ";", unos 105 campos, RUT y período. Crea un gasto por trabajador, igual que el certificado y el comprobante: AFP, SIS, salud, seguro social, accidentes y AFC.
   - **La AFP** sale del último mes cargado de ese RUT, porque el CSV casi nunca la dice. Para un trabajador nuevo se pregunta **una vez** y queda recordada.
   - **La fecha de pago** se escribe en la vista previa.
   - **Subir el mismo CSV otra vez no repite nada.**
4. **CSV y comprobante del mismo mes, sin duplicar:**
   - **Comprobante primero:** el CSV solo se compara por trabajador y no crea nada.
   - **CSV primero:** el comprobante agrega las multas e intereses, la fecha de pago (corrige la de la planilla y la de los gastos por trabajador) y los folios. También muestra la diferencia por trabajador, si la hay.
5. **"Registrar la diferencia como multas e intereses ($X)".** Al unir los cargos del banco a una planilla **sin comprobante**, si suman más que las cotizaciones (más de $10), aparece este botón. Crea el mismo gasto "Multas e intereses Previred <mes>":
   - con el ítem financiero, área ADMIN, sin IVA y la fecha del último cargo unido;
   - deja la planilla "pagada y conciliada" con el total del banco;
   - se quita en Previred → Meses cargados → **Quitar la diferencia**, o deshaciendo el cargo (el gasto se anula, no se borra).

   No aparece si el mes tiene comprobante: ahí las multas salen del comprobante. Si después subes el comprobante, la diferencia se anula y manda el comprobante.
6. **"Cómo cargar Previred cada mes"**, arriba de Previred (plegable): 7 pasos y la tabla "Qué documento usar".

### Dónde se guarda (fen-gastos; las reglas v0.1.0 ya lo cubren)
- `cotizaciones/*.deCsv = true` en las líneas del CSV. El folio es sintético (período + concepto + RUT) y no cambia entre subidas.
- `cotiz_trabajadores/{rut}.afp`: la AFP elegida.
- `previred_planillas/{AAAA-MM}`:
  - `difMultas = { monto, gastoId, fecha, item, area, cotizaciones, banco, cargos, por, en }`;
  - al quitarla, `difMultas: null` y `difMultasQuitadas: [ … con quitado { por, en, motivo } ]`.
- El gasto de la diferencia lleva `previred: { periodo, recargos: true, diferenciaBanco: true }`.
- **Script de Gastos: sin cambios (v2.18.0). Reglas de fen-gastos: sin cambios (v0.1.0).** El CSV va a Drive, a la carpeta de Previred, con su nombre. El script v2.18.0 solo acepta PDF o imagen para Previred, así que Drive lo marca como imagen, pero el archivo llega completo y se descarga igual.

### Lecturas y escrituras
- **Leer el PDF o el CSV:** en tu equipo, 0 lecturas. La vista previa (AFP del historial, área por RUT, ítems financieros, el mes) sale de la memoria de fs-gastos: **0 lecturas nuevas**. Lo mismo al cambiar la fecha de pago.
- **Registrar un mes con el CSV:** lo mismo que el certificado. En la transacción se lee cada línea y cada trabajador (L + N) y se escribe L + 2N; con 7 trabajadores y unas 35 líneas, unas 42 lecturas y 49 escrituras.
- **CSV de un mes ya cargado:** 0 escrituras.
- **Comprobante después del CSV:**
  - lo de la v0.67.0: 2 escrituras y 2 o 3 lecturas;
  - si la fecha de pago cambia: más N lecturas y N escrituras (una por gasto de trabajador);
  - si había una diferencia registrada: más 1 lectura y 1 escritura.
- **Diferencia como multas:** lo mismo que unir los cargos, más 1 lectura y 1 escritura (el gasto).
- **Quitar la diferencia:** 2 lecturas y 2 escrituras.
- **Aviso de Hoy:** sin lecturas nuevas.

### Instalación v0.67.3 (unos 2 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files**.
2. Sube todos los archivos del zip `sistema-fen-v0.67.3.zip`, con la carpeta `cocina/` (no cambia).
3. **Commit changes**.
4. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).

**Nada en Apps Script, reglas ni Cocina.**

### Lista de verificación v0.67.3
- [ ] Abajo a la izquierda dice **v0.67.3**.
- [ ] Conciliación → Previred: arriba está **"Cómo cargar Previred cada mes"** con 7 pasos y la tabla "Qué documento usar". Se pliega y queda plegado.
- [ ] Subo el comprobante de **septiembre** (en plazo, con licencias y un trabajador nuevo): se lee sin avisos, y cada institución y el total calzan con el PDF.
- [ ] Subo el comprobante de **agosto**: se sigue leyendo igual que en la v0.67.2.
- [ ] Subo el CSV de la nómina con **Subir archivo**: dice "CSV de la nómina de Previred" y abre Previred. Si el mes ya tiene comprobante, dice que **solo se compara** y que los totales por trabajador calzan.
- [ ] En un mes sin comprobante, si los cargos del banco suman más: aparece **"Registrar la diferencia como multas e intereses ($X)"**. Al tocarlo, la planilla queda "pagada y conciliada" y en Gastos aparece el gasto en ADMIN.
- [ ] En Previred → Meses cargados, **Quitar la diferencia** lo anula y la planilla vuelve a sus cotizaciones.
- [ ] Hoy deja de decir "Previred de <mes> vence…" cuando el mes se carga con el CSV o con el comprobante.
- [ ] En el celular nada se sale de lado.

### Si algo sale mal
Sube de nuevo la v0.67.2. Lo guardado (`deCsv`, `afp`, `difMultas`, `difMultasQuitadas`) queda en fen-gastos sin estorbar. Nada se borra.

**Por dentro:**
- `previred.js`: un solo `leerComprobante` (títulos en cualquier orden, cifras opcionales, cruces con la sección, `AVISO_SECCION_NUEVA`), más `leerCsv`, `esCsvNomina`, `lineasCsv`, `conAfps`, `folioCsv`, `textoDeArchivo` y `quitarDifMultas`.
- `gastos-g3d.js`: `afpsPorRut`, `afpDeInstitucion`, `difVigente`, `recDiferencia`, y `afp` por trabajador.
- `gastos-g3d-fs.js`: `cotRegistrar` con `csv`, `cotComprobante` que corrige la fecha y reemplaza la diferencia, `cotLista` con `difMultas`, y `cotQuitarDifMultas`.
- `gastos-cartola.js`: `difComoMultas`, y `planillasPrevired` con la diferencia.
- `gastos-cartola-fs.js`: `unirPlanilla` con `difMultas`; deshacer el cargo anula la diferencia.
- `gastos.js` (`cot_quitar_dif`), `app.js` (instrucciones, vista previa del CSV, botón de la diferencia, Meses cargados, Subir archivo), `estilos.css`, `config.js`, `index.html` y los demás (solo versión). La carpeta `cocina/` no cambia.

**Pruebas:**
- Nueva `pruebas/sistemafen/previred-formatos-v0673.test.js` (16, solo con datos ficticios). Cubre:
  - la matriz del lector: normal, atrasado, licencias, contratación, término, atrasado + licencias, otro orden, título viejo, isapre y cruce roto;
  - el CSV: totales, AFP del historial, AFP preguntada, latin-1 y subir dos veces;
  - los casos combinados: CSV y después comprobante, comprobante y después CSV;
  - la diferencia: crear, repetir, oculta con comprobante y quitar;
  - el aviso de Hoy;
  - las instrucciones en 4 anchos.
- Siguen pasando: e2e, sii-v066, sii-reclasificar-v0672, conciliacion-v064, conciliacion-v0652, conciliacion-notas-sii-v0671, previred-v0651, previred-comprobante-v067, cuota-v0632, cuota-v0633, sf-pantallas, finanzas-f1b/f3a/f3b y gastos-g3a/b/c/d/e.
- Capturas en `pruebas/capturas/v0673/`.

## Novedades de la v0.67.2: una factura del SII con todos sus gastos anulados vuelve a "Por clasificar", y "Volver a clasificar"
**Dónde:** Conciliación → Cargas del SII → Documentos del SII (Por clasificar · Revisar automáticas) y la carga abierta · Conciliación → Cartola (Cargos) · Gastos → Registrados. Solo con Gastos en la base nueva.

### El caso (real)
Una factura del SII ya estaba en Gastos (importada antes de la v0.66 o registrada a mano). Su cargo del banco no ofrecía conciliarla, así que anulaste su gasto para subir el XML otra vez. No servía: la factura seguía contando como importada por sus líneas de Detalle Compras y por las marcas "importado" y "registrado", aunque sus gastos estuvieran anulados.

### Qué cambia en cómo trabajas
1. **Si todos los gastos de una factura están anulados, la factura vuelve sola a "Por clasificar".** También lo de antes (como tu factura): se revisa al listar y se guarda una vez, con su historial ("sus gastos fueron anulados: vuelve a por clasificar"). Lleva el chip **"Sus gastos se anularon"**. Si queda un gasto vigente, sigue importada.
2. **Sus productos de antes dejan de contar** (Compras del SII, precios y lo aprendido del proveedor). No se borran: quedan en el documento como líneas anuladas. Al clasificarla de nuevo entran una sola vez, en las mismas filas de Detalle Compras de la planilla.
3. **Volver a subir el XML** encuentra el mismo documento: no lo repite, no dice "ya importado" y no se clasifica solo aunque el proveedor sea conocido. Si era una factura de antes de la v0.66 (sin lo del archivo guardado), queda con los montos y productos del XML.
4. **El cargo del banco vuelve a ofrecer "Factura por clasificar"**, con la clasificación por línea. También en Cargas del SII → Por clasificar y en Pagos sin banco.
5. **"Volver a clasificar"** (en Revisar automáticas, en la carga abierta y en Gastos → Registrados, junto a Anular): pide un motivo, anula todos los gastos de la factura en una sola operación y la deja en "Por clasificar". **No se puede** si un gasto ya está conciliado con un cargo, tiene un pago (efectivo o tarjeta en Pagos sin banco, o es el pago de un vencimiento) o tiene un vencimiento que no está anulado. En ese caso te dice qué deshacer primero, por ejemplo: "Primero deshaz la conciliación del cargo del 30 sep ($23.800): Conciliación → Cartola → Ya revisados → Deshacer".
6. **Anular** en Registrados ya no dice "el documento sigue contando como importado". Ahora dice: si anulas todos los gastos de una factura del SII, la factura vuelve a "Por clasificar". Al anular el último, arriba aparece "… volvió a Por clasificar".

### Cómo se encuentran los gastos de una factura
- `registrado.gastos` (unida en la v0.67.1), si no está quitado.
- `importado.gastos` (clasificada en la v0.66, o importada antes en la base nueva).
- El gasto con `siiDoc.id` = el documento.
- RUT (con o sin puntos) + folio: el folio del gasto, el de su `siiDoc` o "F.<folio>" en la observación (la planilla antigua y lo importado por el script).
- Las líneas de Detalle Compras no dicen cuáles son sus gastos. Una factura que solo tiene líneas se decide por los gastos que se encuentren con lo anterior. **Si no se encuentra ningún gasto, queda como estaba.** Las notas de crédito y las facturas que fueron al vencimiento de su obligación ("según documento") no cambian.

### Dónde se guarda (fen-gastos; las reglas v0.1.0 ya lo cubren)
- `sii_docs/{id}.vueltaPorClasificar = { en, por, motivo, gastos, via }`.
- `importado: null` y `importadosAnulados: [ … lo importado + anulado { en, por, motivo } ]`.
- `registrado.quitado = { en, por, motivo }`.
- `lineas: []` y `lineasAnuladas: [ … cada línea con anulada { en, por, motivo, k } ]`. Al reimportar, la línea nueva k toma la fila de la planilla de la anulada k.
- Si no tenía `porClasificar`, se arma uno con `reconstruido: true` a partir de lo importado y sus gastos; el XML lo reemplaza.
- La ficha del proveedor (`proveedores/{rut}`) queda sin las filas de los gastos anulados ni los productos de ese documento.
- "Volver a clasificar": los gastos quedan `estado: 'anulado'` con `anulado.motivo = "Volver a clasificar: …"`.
- **Script de Gastos: sin cambios (v2.18.0). Reglas de fen-gastos: sin cambios (v0.1.0).** En la planilla, Detalle Compras conserva las filas de antes hasta que la factura se clasifica de nuevo; entonces se escriben en esas mismas filas. Los gastos anulados pasan a "Gastos anulados", como siempre.

### Lecturas y escrituras
- **Revisar al listar:** desde la memoria de fs-gastos.js (`sii_docs`, `gastos`, `vencimientos` y `proveedores` en los paquetes), **0 lecturas**.
- **Guardar la vuelta:** una sola vez, 1 escritura por factura, más 1 si la ficha del proveedor tenía lo anulado.
- **Volver a clasificar:** lee en la transacción la factura y sus n gastos (n + 1 lecturas, más el refresco de lo que cambió) y escribe n + 1 (+1 la ficha).
- **Volver a subir el XML:** 1 escritura si la factura se había reconstruido; si no, 0.
- `cuota-v0632` y `cuota-v0633` pasan con los mismos presupuestos.

### Instalación v0.67.2 (unos 2 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.67.2.zip` (con la carpeta `cocina/`, que no cambia) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC). **Nada en Apps Script, reglas ni Cocina.**

### Lista de verificación v0.67.2
- [ ] Abajo a la izquierda dice **v0.67.2**.
- [ ] Conciliación → Cargas del SII → Por clasificar: tu factura con el gasto anulado aparece con **"Sus gastos se anularon"**.
- [ ] Subo otra vez su XML: dice "queda por clasificar". No dice "ya importado" y no aparece una factura repetida.
- [ ] Su cargo en Conciliación → Cartola dice **"Factura por clasificar: … F.…"**. Al abrirlo, cada línea tiene su ítem y su área. Al confirmar, quedan sus gastos con la fecha de la factura y el cargo conciliado.
- [ ] Gastos → Registrados → **Volver a clasificar** en un gasto de factura del SII sin conciliar: pide el motivo y la factura aparece en Por clasificar.
- [ ] En un gasto ya conciliado: dice **"Primero deshaz la conciliación del cargo del …"** y no cambia nada.
- [ ] Anular en Registrados dice que la factura vuelve a "Por clasificar" si anulas todos sus gastos.
- [ ] En el celular nada se sale de lado.

### Si algo sale mal
Sube de nuevo la v0.67.1. Lo guardado (`vueltaPorClasificar`, `importadosAnulados`, `lineasAnuladas`, `registrado.quitado`) queda en fen-gastos sin estorbar: con la v0.67.1 esas facturas se ven "por clasificar" (no tienen `importado` ni líneas vigentes). Nada se borra.

Por dentro: `sii-pendientes.js` (`indiceGastos`, `gastosDelDoc`, `revisarVuelta`, `camposVuelta`, `porClasificarReconstruido`, `fichaSinDoc`, `bloqueosVolver`; la vista lleva `vuelta`), `sii-pendientes-fs.js` (`contexto` revisa y guarda la vuelta una vez; `registrosAlSubir` no clasifica solo lo devuelto; `guardarPendientes` reemplaza lo reconstruido por el XML; `docDeGasto`, `estadoDoc`, `infoVolver`, `volverAClasificar`), `gastos-sii.js` (`devueltos`: lo devuelto no cuenta como importado; `docSiiImportado` sin duplicar líneas y con su fila), `gastos-g2.js` (`siiDocId` en la vista del gasto), `app.js` ("Volver a clasificar", texto de Anular, chip y aviso), `estilos.css`, `config.js`, `index.html` y los demás (solo versión). La carpeta `cocina/` no cambia.

Pruebas: nueva `pruebas/sistemafen/sii-reclasificar-v0672.test.js` (13, con datos ficticios). Cubre: los vínculos y el parcial; lo que se escribe; bloqueos; retroactivo de la importación antigua, la clasificación de la v0.66 y lo unido en la v0.67.1, una sola vez; subir el XML otra vez sin repetir ni clasificar solo; clasificar por línea sin duplicar Detalle Compras; el cargo que vuelve a ofrecerla; Volver a clasificar desde Registrados y desde Revisar automáticas; bloqueado por conciliación; texto de Anular; costo; pantallas en 390, 768, 1024 y 1280. Siguen pasando `e2e`, `sii-v066`, `conciliacion-v064`, `conciliacion-v0652`, `conciliacion-notas-sii-v0671`, `previred-v0651`, `previred-comprobante-v067`, `cuota-v0632`, `cuota-v0633`, `sf-pantallas`, `finanzas-f1b/f3a/f3b`, `gastos-g3a/b/c/d/e`. Capturas en `pruebas/capturas/v0672/`.

## Novedades de la v0.67.1: notas en los cargos, facturas ya registradas que no vuelven a "por clasificar", clasificar por línea al conciliar y una sola regla de "financiero"
**Dónde:** Conciliación → Cartola (Cargos) · Conciliación → Cargas del SII → Documentos del SII · Pagos sin banco · Previred (multas e intereses) · Finanzas → Resultados → Clasificación y Estado de resultados. Solo con Gastos en la base nueva.

### Qué cambia en cómo trabajas
1. **Notas en los cargos de la cartola.** Cada cargo (Para revisar, Listos para confirmar y Ya revisados) tiene **"Agregar nota" / "Editar nota"**. La nota (hasta 300 letras) se ve en la tarjeta, plegada, con su ícono; se guarda **sin clasificar ni conciliar** el cargo. Ejemplo: "Compra del 30 sep, aún sin factura: pedirla el 17-oct". Si la cambias o la vacías (quitar), la anterior queda guardada. Arriba aparece el filtro **"Con nota · N"**. Los abonos de B2B tienen su propia pantalla y base (fen-b2b): no llevan nota todavía.
2. **Una factura del SII que ya está en Gastos ya no queda "por clasificar".** Al subir el SII, y también con lo que ya estaba por clasificar (por ejemplo, lo que dejó la migración de la v0.66), se busca su gasto:
   - **Se une sola** si el RUT (escrito con o sin puntos) y el folio calzan, o si el RUT, el total (±$10) y la fecha (±3 días) calzan con **una sola** compra (o, sin RUT, el folio en la observación y el total). Queda **"Ya registrada · unida a su gasto"**: sale de Por clasificar, del cierre y de Hoy, y nunca se ofrece como "Factura por clasificar". **No se crea ningún gasto.**
   - Si hay dudas (dos compras que calzan, o un gasto a mano sin RUT del mismo monto) queda por clasificar con el aviso **"Puede estar ya registrado"** y el botón **"Unir a un gasto ya registrado"**: eliges tú la compra (también en el cargo de la cartola).
   - Un proveedor conocido ya no se clasifica solo si su factura ya estaba registrada (así no se duplica).
3. **El cargo de una factura ya registrada propone su pago.** Si era a crédito con su vencimiento por pagar: **"Paga la compra a crédito F.<folio> (vencía el 18 sep)"**, igual que "Paga vencimientos" (con la fecha del banco; el gasto sigue con la fecha de la factura). Si era al contado: **"Ya está en Gastos"** con ese gasto elegido.
4. **Clasificar por línea al conciliar.** "Factura por clasificar" en el cargo (y también Documentos del SII → Por clasificar y Pagos sin banco) usa **el mismo clasificador de Cargas del SII**: cada línea de la factura con su ítem y su área, sobre su neto; el IVA y los otros impuestos (harina 12 %) se reparten en la misma proporción y las líneas con el mismo ítem y área quedan en un solo gasto. Sigue la sugerencia de lo aprendido y el gasto con la fecha de la factura. Si la factura no trae detalle (Registro de Compras .csv), queda el reparto del total de antes, ahora sin la fila vacía "Ítem 2 · Monto 0" y con las columnas juntas en el PC.
5. **"Financiero" es uno solo.** Un ítem con **subtipo FINANCIERO** en Gastos → Ítems (sin importar tildes o mayúsculas) ya cuenta como financiero en Previred (multas e intereses) y en el estado de resultados, mientras no lo clasifiques distinto en Finanzas → Resultados → Clasificación (**eso manda**). Si su nombre dice crédito, cuota o préstamo no cuenta solo (es capital): se clasifica a mano. En Clasificación ese ítem viene propuesto "Financiero" y dice "ya cuenta como Financiero". El aviso de Previred dice dónde arreglarlo (las dos partes). INVERSIÓN y PASIVO siguen solo como propuesta (Inversión, Impuestos): no cambian el resultado sin que lo apliques.

### Dónde se guarda (fen-gastos; las reglas v0.1.0 ya lo cubren)
- `cartola_cargos/{id}.nota = { texto, por, en }` y `notaHistorial: [ … versiones anteriores ]` (máximo 50). No pasa a la planilla de Google.
- `sii_docs/{id}.registrado = { gastos: [ids], por (rut_folio | rut_total_fecha | folio_total | manual), clave, total, fecha, credito, vencimiento, motivo, en, quien }`. El documento conserva `porClasificar` (lo que vino del archivo) y su historial. Cuenta como "ya en Gastos" al volver a subir el archivo.
- Lo clasificado por línea: los productos quedan con su ítem y área en Detalle Compras, como en Cargas del SII.
- **Script de Gastos: sin cambios (v2.18.0). Reglas de fen-gastos: sin cambios (v0.1.0).**

### Lecturas y escrituras
Todo desde la memoria de fs-gastos.js (`sii_docs`, `gastos`, `vencimientos`, `cartola_cargos` en los paquetes): **0 lecturas nuevas**. Nota de un cargo: **1 escritura**, 0 lecturas (la lista se refresca por `_m`). Unir una factura ya registrada: **1 escritura por documento, una sola vez** (al subir va en la misma escritura que guarda el documento). Clasificar por línea: lo mismo que antes. `cuota-v0632` y `cuota-v0633` pasan con los mismos presupuestos.

### Instalación v0.67.1 (unos 2 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.67.1.zip` (con la carpeta `cocina/`, que no cambia) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC). **Nada en Apps Script, reglas ni Cocina.**

### Lista de verificación v0.67.1
- [ ] Abajo a la izquierda dice **v0.67.1**.
- [ ] Conciliación → Cartola: en un cargo "Para revisar" toco **Agregar nota**, escribo y guardo: la nota se ve en la tarjeta con su ícono y el cargo sigue en Para revisar.
- [ ] **Editar nota** la cambia; aparece **"Con nota · N"** y filtra.
- [ ] Conciliación → Cargas del SII: la factura que ya estaba registrada (por ejemplo, la F.803170) ya no está en Por clasificar (Hoy y el cierre del mes la dejan de contar).
- [ ] Su cargo del banco dice **"Paga la compra a crédito F.… (vencía el …)"** o **"Ya está en Gastos"**, nunca "Factura por clasificar". Al confirmar no aparece un gasto nuevo.
- [ ] Una factura con aviso "Puede estar ya registrado": **Unir a un gasto ya registrado** → elijo la compra → sale de Por clasificar.
- [ ] "Factura por clasificar" en un cargo muestra **cada línea** de la factura con ítem y área (como Cargas del SII) y cuadra con el total.
- [ ] Previred → comprobante: el ítem con subtipo FINANCIERO ya no dice "no es de tipo financiero".
- [ ] En el celular nada se sale de lado.

### Si algo sale mal
Sube de nuevo la v0.67.0. Lo guardado (`nota`, `notaHistorial`, `registrado`) queda en fen-gastos sin estorbar: con la v0.67.0 las facturas unidas vuelven a verse "por clasificar" (no se clasifican solas) y las notas no se muestran.

Por dentro: `gastos-cartola.js` (`textoNota`, `conNota`, `vistaNota`), `gastos-cartola-fs.js` (`notaCargo`; la lista trae lo registrado), `cartola.js`, `sii-pendientes.js` (`comprasDe`, `registroDe`, `vencimientoDeCompras`, `datosRegistrado`, `propuestaRegistrado`, `conDetalleClasificado`), `sii-pendientes-fs.js` (`pendientes` une lo registrado una vez, `registrosAlSubir`, `paraUnir`, `unir`, `registrados`; `clasificar` con el detalle por línea), `gastos-sii.js` (lo unido cuenta como importado; RUT con o sin puntos), `finanzas-resultados.js` (`tipoResultado`, `esFinanciero`, `avisoNoFinanciero`; FINANCIERO propone financiero), `finanzas-eerr.js`, `gastos-g3d.js` y `gastos-g3d-fs.js` (Previred con la misma regla), `finanzas.js`, `vista-finanzas-eerr.js`, `vista-finanzas-resultados.js`, `app.js` (notas, clasificador por línea compartido con Cargas del SII, "Unir", propuestas), `estilos.css`, `config.js`, `index.html` y los demás (solo versión). La carpeta `cocina/` no cambia.

Pruebas: nueva `pruebas/sistemafen/conciliacion-notas-sii-v0671.test.js` (14, con datos ficticios: unión fuerte, débil y única, ambigua y posible; propuesta del cargo; notas; financiero; retroactivo de lo migrado en la v0.66; subir sin gasto repetido; unir a mano; por línea en Documentos del SII y en el cargo con harina 12 %; pagar la compra a crédito; notas con historial y filtro; 390/768/1024/1280). Ajustadas a lo nuevo: `sii-v066` (el cargo y Pagos sin banco se clasifican por línea), `finanzas-f3a` (FINANCIERO propone financiero) y `gastos-g3d` (la prueba 4 ya no depende del día). Siguen pasando `e2e`, `sii-v066`, `conciliacion-v064`, `conciliacion-v0652`, `previred-v0651`, `previred-comprobante-v067`, `cuota-v0632`, `cuota-v0633`, `sf-pantallas`, `finanzas-f1b/f3a/f3b`, `gastos-g3a/b/c/d/e`. Capturas en `pruebas/capturas/v0671/`.

## Novedades de la v0.67.0: el comprobante de pago de Previred (con multas e intereses) y el aviso de vencimiento
**Dónde:** Conciliación → Subir archivo (PDF de Previred) · Conciliación → Previred · Conciliación → Cartola ("Pago de Previred") · Hoy · Agenda · Finanzas → Estado de resultados. Solo con Gastos en la base nueva.

### Por qué
El "Certificado de Pagos de Cotizaciones Previsionales" es la mirada del trabajador: no trae las multas ni los intereses por pagar atrasado. El "Comprobante de pago" que descargas al pagar en Previred es la mirada de la empresa: todo lo que pagaste, institución por institución (ISL, FONASA, cada AFP con su fondo de pensiones y su seguro de cesantía, Seguro Social), con reajustes, intereses, recargos, costas y multas, y dice si se pagó fuera de plazo. Con el certificado, la planilla del mes nunca calzaba con los cargos del banco cuando había multas.

### Qué cambia en cómo trabajas
1. **Sube el comprobante** (recomendado) en Conciliación → Subir archivo o en Previred. Se reconoce solo (certificado o comprobante). Las páginas apaisadas se leen bien.
2. **Vista previa:** una tabla por institución (cotización · intereses · multas · total) con su fila de totales, la marca **"Pagado fuera de plazo"**, los trabajadores con su área y el **ítem de las multas e intereses** (viene elegido un ítem de tipo financiero que diga multa o interés; si no hay ninguno financiero, te avisa y eliges cualquiera; no se crea ningún ítem solo). Si el PDF no cuadra (el detalle por trabajador no suma la cotización, cotización + intereses + multas no da el total, más de un período, una fila que no se lee), **no se puede guardar** y dice por qué.
3. **Mes sin cotizaciones:** se registra como el certificado (un gasto por trabajador con su área e ítem recordados, al vencimiento de Cotizaciones si existe) **y un gasto "Multas e intereses Previred <mes>"**: sin IVA, al contado, con la **fecha de pago** (la multa nace al pagar), área ADMIN y el comprobante como archivo. Si va al vencimiento de Cotizaciones, el monto a pagar incluye las multas e intereses y los dos gastos se crean al pagarlo.
4. **Mes que ya tiene el certificado:** dice **"Este mes ya tiene el certificado cargado: solo se agregan multas e intereses ($Y)"**. No se repite ningún trabajador; muestra la diferencia por trabajador entre el comprobante y lo cargado (si la hay) y agrega solo el gasto de multas e intereses.
5. **Subir el mismo comprobante otra vez** no repite nada (clave: período + folios).
6. **La planilla del mes** pasa a tener como total **lo pagado**: Previred → Meses cargados dice **"Cotizaciones $X + multas e intereses $Y = pagado $Z"** (y "Pagado fuera de plazo"). En la cartola, "Pago de Previred" une los cargos del banco hasta ese total → **"pagada y conciliada"** (sin crear gastos, como en la v0.65.1).
7. **Quitar comprobante** (Meses cargados, con motivo): queda anotado en la planilla y el gasto de multas e intereses pasa a "Gastos anulados". No se borra nada; los trabajadores y los cargos unidos no cambian. También puedes anular solo el gasto en Gastos registrados.
8. **Aviso de vencimiento:** Previred del mes M vence el **13 del mes siguiente** (si cae sábado, domingo o feriado, el hábil que sigue). Desde el día 10 y hasta que el mes queda registrado, Hoy y la Agenda dicen **"Previred de <mes> vence el <día>"**; el día del vencimiento en rojo, y después **"atrasado, se cobran multas"**.
9. **Finanzas:** la fila del estado de resultados se llama **"Financieros (intereses, multas y banco)"**. El gasto de multas e intereses entra ahí por el tipo de su ítem (Finanzas → Resultados → Clasificación: financiero). Los cargos del banco unidos a la planilla no son gasto (no hay doble conteo).
10. **El líquido no sale de Previred:** el sueldo líquido se paga aparte (abonos de sueldo).

### Dónde se guarda (fen-gastos; las reglas v0.1.0 ya lo cubren)
- `previred_planillas/{AAAA-MM}.comprobante = { clave, instituciones [{ nombre, tipo, folio, cotizacion, intereses, multas, compensacion, total }], totalCotizaciones, totalRecargos, totalPagado, fueraDePlazo, fechaPago, horaPago, vence, folios, archivo, nombreArchivo, cargadoEl, cargadoPor, gastoRecargosId, recargosEnVencimiento? }`; el `total` de la planilla pasa a ser `totalPagado`. Al quitarlo: `comprobante: null` y `comprobantesQuitados: [… + quitado { por, en, motivo }]`. No pasa a la planilla de Google.
- Gasto de multas e intereses: un gasto normal con `previred: { periodo, recargos: true, clave }` y `origenDetalle.tipo = 'previred'` (pasa a la planilla de Google como todo gasto).
- Líneas de `cotizaciones` registradas con el comprobante: `deComprobante: <clave>` (así un certificado de ese mes no duplica a los trabajadores).
- Vencimiento de Cotizaciones con el comprobante: `documento.previred.recargos` y `montoDocumento` con las multas e intereses.
- **Script de Gastos: sin cambios (v2.18.0). Reglas de fen-gastos: sin cambios (v0.1.0):** la regla general (`/{coleccion}/{id}` para administración) ya permite los campos nuevos.

### Lecturas y escrituras
Todo desde la memoria de fs-gastos.js: `cotizaciones`, `cotiz_trabajadores`, `items`, `fin_items`, `obligaciones` y `vencimientos` van en los paquetes; `previred_planillas` es un documento por mes (≈12 al año: se lee una vez por sesión y después solo lo que cambia). El aviso de Hoy y Agenda no agrega lecturas por mes. Guardar un mes nuevo: lo de siempre + 2 escrituras (planilla y gasto de multas). Mes ya cargado: 2 escrituras (planilla + gasto, o planilla + vencimiento) y 2 o 3 lecturas en la transacción. Quitar: 2 o 3 escrituras. Unir cargos: igual que en la v0.65.1.

### Instalación v0.67.0 (unos 2 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.67.0.zip` (con la carpeta `cocina/`, que no cambia) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC). **Nada en Apps Script, reglas ni Cocina.**

### Lista de verificación v0.67.0
- [ ] Abajo a la izquierda dice **v0.67.0**.
- [ ] Conciliación → Subir archivo → el comprobante de pago de un mes (CtrlPdf): abre Previred con la tabla por institución, sus totales (cotizaciones + multas e intereses = pagado, iguales a los del PDF) y, si corresponde, **"Pagado fuera de plazo"**.
- [ ] Con un mes que ya tenía el certificado: dice **"Este mes ya tiene el certificado cargado: solo se agregan multas e intereses ($…)"** y muestra la diferencia por trabajador con lo cargado (si la hay).
- [ ] El ítem de multas e intereses viene elegido (uno financiero) o avisa que no hay; elijo el ítem y el área (ADMIN) → **Agregar multas e intereses**. En Gastos aparece un solo gasto nuevo "Multas e intereses Previred <mes>" con la fecha de pago del comprobante.
- [ ] Subo el mismo PDF otra vez: "Este comprobante ya estaba guardado", sin nada nuevo.
- [ ] Previred → Meses cargados → ese mes: "Cotizaciones $X + multas e intereses $Y = pagado $Z" y "Pagos del banco unidos: … de $Z".
- [ ] Conciliación → Cartola: los cargos de Previred de ese pago se unen a la planilla del mes hasta **"pagada y conciliada"**, sin gastos nuevos.
- [ ] Finanzas → Estado de resultados del mes de pago: el gasto está en **"Financieros (intereses, multas y banco)"** (si su ítem es financiero en Clasificación).
- [ ] Hoy (desde el día 10): "Previred de septiembre vence el …" o "atrasado: se cobran multas" hasta que lo registre; también en la Agenda.
- [ ] En el celular nada se sale de lado.

### Si algo sale mal
Sube de nuevo la v0.66.0. Lo guardado (`comprobante` en la planilla del mes, el gasto de multas e intereses, `deComprobante`) queda en fen-gastos sin estorbar: con la v0.66.0 el total de la planilla vuelve a ser el del certificado y el gasto de multas sigue siendo un gasto normal (se anula en Gastos registrados si hace falta).

Por dentro: `previred.js` (lector del comprobante `leerComprobante`, `leerPdf`, `claveComprobante`; `lineasDelPdf` lee las páginas giradas), `gastos-g3d.js` (total del plan con multas, gasto de multas e intereses, revisión del comprobante, planilla con comprobante, ítems para las multas, comparación por RUT, vencimiento y avisos de Previred), `gastos-g3d-fs.js` (cot_estado con lo del mes, cot_registrar con el comprobante, `cotComprobante`, `cotQuitarComprobante`, `avisosPreviredHoy`), `gastos.js`, `gastos-cartola.js` y `gastos-cartola-fs.js` (total de la planilla = lo pagado; pago con el vencimiento incluye las multas), `app.js` (Previred, Subir archivo, Pago de Previred, Hoy, Agenda), `finanzas-eerr.js` y `finanzas-resultados.js` (nombre de la fila; "multa" propone financiero), `vista-finanzas-resultados.js`, `estilos.css`, `config.js`, `index.html` y los demás (solo versión). La carpeta `cocina/` no cambia.

Pruebas: nueva `pruebas/sistemafen/previred-comprobante-v067.test.js` (14, con datos ficticios: lector y totales, cruces que bloquean, páginas giradas, el certificado igual que antes; mes nuevo con trabajadores + multas; mes con el certificado solo multas y sin duplicar; subir dos veces; envío repetido; Meses cargados; unión hasta "pagada y conciliada"; quitar comprobante; certificado después del comprobante; Financieros; vencimiento con fin de semana y feriado; Hoy y Agenda; 390/768/1024/1280). Siguen pasando `e2e`, `sii-v066`, `conciliacion-v064`, `conciliacion-v0652`, `previred-v0651`, `cuota-v0632`, `cuota-v0633`, `sf-pantallas`, `gastos-g3a/b/c/e`, `gastos-v063`, `finanzas-f1b/f3a/f3b`, `hoy-v055`, `feriados-v0634`. Capturas en `pruebas/capturas/previred-v067/`.

## Novedades de la v0.66.0: el SII se sube, se clasifica al conciliar y el gasto es del mes de la factura; Pagos sin banco
**Dónde:** Conciliación → Subir archivo (SII) · Cargas del SII → **Documentos del SII** (Por clasificar · Revisar automáticas) · Cartola → Cargos · **Pagos sin banco** (pestaña nueva) · Hoy · Finanzas → Cierre de mes y Cómo trabajamos. Solo con Gastos en la base nueva.

### Qué cambia en cómo trabajas
1. **Subir el SII ya no es clasificar.** Al subir el archivo se guardan los documentos como **"Por clasificar"** (sin gasto todavía). La excepción: los proveedores **conocidos** — los que clasificaste **con el mismo ítem y área al menos 2 veces, sin repartir** (y sin otra forma que compita) — se clasifican e importan solos: el gasto nace con la **fecha de la factura**, con el chip **"clasificación automática"**. La ficha a mano del proveedor ya no clasifica sola: solo propone. Las facturas de una obligación "según documento" (internet, gas) van a su vencimiento como siempre.
2. **Revisa las automáticas** en Conciliación → Cargas del SII → **Revisar automáticas**: "Está bien", cambia el ítem o el área (queda en su historial) o **Anular** (con motivo).
3. **Clasifica donde te acomode:**
   - **En la cartola** (Conciliación → Cartola → Cargos): un cargo que calza **exacto** (±$1, de 5 días antes a 45 después de la factura) con una factura por clasificar dice **"Factura por clasificar: Proveedor F.55"** (**Seguro** si el RUT calza —glosa, transferencia enviada o ficha—; si no, **Probable**; nunca se confirma solo). Al abrirlo eliges ítem y área ahí mismo (viene propuesto con lo que se sepa del proveedor; "Repartir en otra línea" si son varios) → **Clasificar y conciliar**: el gasto queda con la **fecha de la factura** (su mes: una factura de septiembre pagada en octubre está en el estado de resultados de septiembre) y el pago con la **fecha del banco**. Si el cargo es menor y del mismo proveedor, es un **abono**: el gasto es la factura completa y queda el saldo.
   - **En Cargas del SII** → **Por clasificar** (filtra por mes): ítem y área → **Importar compra**. O abriendo la carga, como antes (Importar compra / Importar todas las clasificadas).
4. **Pagos sin banco** (Conciliación, con su número en la pestaña): las facturas del SII (clasificadas o no) **sin pago del banco** después de **10 días** de la factura (lo cambias ahí mismo) o **pasado su vencimiento**; las a crédito que todavía no vencen no aparecen. Lo primero es pagar desde el banco: esto es para las excepciones (su (i) lo explica). Cada una:
   - **Pagada en efectivo**: fecha y **de dónde salió el efectivo** — por defecto **"Efectivo de cobros B2B"** (lo que pagan en efectivo los clientes B2B, que nunca pasa por el banco) u **"Otro"** con una nota. Si está por clasificar, eliges ítem y área primero. Gasto con la fecha de la factura + un pago guardado (medio efectivo y su origen) para el flujo de caja.
   - **Pagada con tarjeta de crédito**: fecha → pago medio tarjeta.
   - **Todavía por pagar**: queda **a crédito** con la fecha en que esperas pagarla (Vencimientos, Agenda y Hoy); se reagenda en la misma pestaña.
   - **Efectivo en mano estimado** (por mes): cobrado en efectivo a B2B menos lo pagado con ese efectivo. Lo de "Otro" no descuenta.
5. **Cierre de mes:** revisión nueva **"Documentos del SII de <mes> sin clasificar: N"** (debe ser 0; **Revisar** abre Cargas del SII filtrado en ese mes). El estado de resultados sigue usando la fecha de la factura y avisa cuántos faltan.
6. **Hoy:** "Facturas por clasificar: N" (solo si hay), enlace a Cargas del SII.
7. **Lo de antes:** lo ya importado queda igual. Lo que quedó **sin importar** en cargas anteriores pasa a "Por clasificar" **una sola vez**, solo, la primera vez que abres Cargas del SII (sin clasificarse solo). Gastos y Previred no cambian.

### Dónde se guarda (fen-gastos; las reglas v0.1.0 ya lo cubren)
- `sii_docs/{RUT_folio}.porClasificar`: el documento tal como vino (montos, fechas, forma de pago, productos, carga y archivo). Al clasificarse se importa como siempre (`importado`, con `automatico: true` si fue solo).
- Gastos: `clasificacionAutomatica`, `autoRevisada`, `esperaPago`, `medioPago` (banco | efectivo | tarjeta), `pagoSinBanco { medio, fecha, origen (cobros_b2b | otro), origenTexto }`. Al unir un cargo, `fechaPago` = fecha del banco.
- `sii_pagos/sp-{doc}`: `{ docId, rut, folio, razonSocial, monto, fecha, mes, medio, origen, origenTexto, gastos, fechaFactura, por, en, historial }` para el flujo de caja (F4). No pasa a la planilla.
- Vencimientos de "todavía por pagar": `porPagarSinBanco: true`. `config/sii_pagos = { dias, migrado }`.
- **Script de Gastos: sin cambios (v2.18.0)**: la planilla no necesita columnas nuevas (gastos y vencimientos pasan como siempre; forma y fecha de pago en sus columnas).

### Lecturas
Todo desde la memoria de fs-gastos.js (`sii_docs`, `gastos`, `proveedores` en los paquetes): ninguna lectura por documento ni por cargo. Subir un XML de N documentos = N escrituras. La migración única lee de Drive (con el script) solo las cargas que tienen documentos sin importar. Prueba `cuota-v0632` y `cuota-v0633` siguen pasando.

### Instalación v0.66.0 (unos 3 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.66.0.zip` (con la carpeta `cocina/`, que no cambia; `sii-pendientes.js` y `sii-pendientes-fs.js` son nuevos) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC). Nada en Apps Script, reglas ni Cocina.

### Lista de verificación v0.66.0
- [ ] Abajo a la izquierda dice **v0.66.0**.
- [ ] Abro Conciliación → Cargas del SII: lo que quedó sin importar de cargas anteriores aparece en **Por clasificar** (una vez).
- [ ] Subo el XML del SII: dice cuántos se clasificaron solos y cuántos quedan por clasificar; los automáticos están en **Revisar automáticas** con la fecha de la factura.
- [ ] En Revisar automáticas cambio el ítem de uno → queda en su historial y sale de la lista.
- [ ] Un proveedor nuevo queda "Por clasificar" y no tiene gasto.
- [ ] Subo la cartola: el cargo de esa factura dice **"Factura por clasificar: …"**; elijo ítem y área → **Clasificar y conciliar** → el gasto es del mes de la factura y la fecha de pago es la del banco.
- [ ] **Pagos sin banco** muestra su número; marco una "Pagada en efectivo" (Efectivo de cobros B2B) → baja el **Efectivo en mano estimado**.
- [ ] "Todavía por pagar" con una fecha → sale en Vencimientos, Agenda y Hoy; **Reagendar** la cambia.
- [ ] Hoy muestra "Facturas por clasificar: N" (solo si hay).
- [ ] Cierre de un mes con una factura por clasificar: "Documentos del SII de … sin clasificar: 1" en rojo; **Revisar** me lleva a esa lista.
- [ ] En el celular nada se sale de lado.

### Si algo sale mal
Sube de nuevo la v0.65.3. Lo guardado (`porClasificar`, `sii_pagos`, `esperaPago`) queda en fen-gastos sin estorbar: con la v0.65.3 los documentos por clasificar se ven en Cargas del SII como pendientes (al abrir su carga) y se importan como antes.

Por dentro: nuevos `sii-pendientes.js` (reglas: clasificar solo, propuesta, líneas, factura clasificada, candidatos del cargo, pagos sin banco, origen del efectivo, efectivo B2B, automáticas por revisar, pendientes del mes) y `sii-pendientes-fs.js` (guardar, clasificar, efectivo/tarjeta, todavía por pagar, reagendar, revisar automáticas, conteos, migración única); cambian `gastos-sii.js`, `gastos-cartola-fs.js`, `gastos.js` (Hoy), `b2b.js`, `finanzas.js`, `finanzas-eerr.js`, `vista-finanzas-eerr.js`, `vista-finanzas.js`, `app.js`, `estilos.css`, `config.js`, `index.html` y los demás (solo versión). La carpeta `cocina/` no cambia.

Pruebas: nueva `pruebas/sistemafen/sii-v066.test.js` (13: 4 unitarias —umbral de la clasificación automática (2 veces, sin repartir, sin otra forma), ventana y Seguro/Probable, gasto con la fecha de la factura aunque se pague al mes siguiente, selección de pagos sin banco (días, vencimiento, crédito que no vence) y origen del efectivo, revisión del cierre— y de punta a punta con datos ficticios: XML de 3 facturas (1 conocida → automática; 2 nuevas → por clasificar) y Hoy; revisar automáticas (cambio con historial); cargo exacto → "Factura por clasificar" → clasificar en línea → gasto de septiembre en el estado de resultados de septiembre pagado en octubre; el cierre lo bloquea y su enlace filtra; pagos sin banco → efectivo de cobros B2B → gasto + pago medio efectivo y el cierre queda listo; todavía por pagar → Agenda y reagendar; 390/768/1280). `sf-pantallas` suma Pagos sin banco y Documentos del SII. Siguen pasando `conciliacion-v064`, `conciliacion-v0652`, `previred-v0651`, `gastos-g3a…g3e`, `gastos-v063`, `finanzas-f1b/f3b`, `e2e`, `cuota-v0632/v0633`. Capturas en `pruebas/capturas/sii-v066/`.

## Novedades de la v0.65.3: fermentación en bloque (Panadería)
**Dónde:** Producción → Configuración de Producción → **Fermentación en bloque · Panadería** (debajo de la configuración de Panadería), con su (i): *"Tiempo a temperatura ambiente después de terminar la masa. Ajústalo según la temporada: en invierno más, en verano menos."*

- La lista son las recetas que aparecen en **Recetas del día** en Cocina: las **recetas aprobadas** de Panadería y las **masas** (sub recetas) que las jefas eligieron en "Ordenar Hoy" (si no se puede leer, las "Masa …", sin masa madre, poolish ni pie). Las masas van primero.
- Cada una con una casilla **h:mm** (2:00, 1:30; "2" = 2 horas). **Vacío = sin f.b.** Si algo no es una hora válida (máximo 48:00), avisa cuál y no guarda nada.
- Con más de 8 recetas aparece **"Buscar receta"** (sin tildes ni mayúsculas, varias palabras; Escape la limpia).
- **Guardar fermentación en bloque** → `config/PAN.fermentacionBloque = { recetaId | SR…: minutos }` con la marca **editado** (como el resto de la configuración): **la copia desde la planilla no lo pisa**. Las tablets lo ven al instante.
- En Cocina v0.17.1, al marcar terminada: **"✓ Hecho · Camila 11:00 · f.b. hasta 13:00"**, y al llegar la hora **"f.b. lista desde las 13:00"** destacada.

### Lecturas
La lista se lee **solo con "Configuración de Producción" abierta**: las recetas (las mismas de siempre, con su marca: normalmente ya están en memoria) y **un documento** (`ajustes/PAN__hoy`), guardado 10 minutos en este navegador. Abrir Producción con la sección cerrada no lee nada nuevo. `cuota-v0632` y `cuota-v0633` pasan con los mismos presupuestos.

### Instalación v0.65.3 (unos 3 minutos)
1. GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.65.3.zip` (con la carpeta `cocina/`, que no cambia; `fermentacion.js` es nuevo) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC).
2. **Cocina v0.17.1** (`fen-cocina-v0.17.1.zip`, repo `fen-cocina`) y recargar las tablets.
Nada en Apps Script ni en las reglas (las de fen-produccion v1.8.0 ya dejan a la administración escribir `config/PAN` y a las tablets leerlo).

### Lista de verificación v0.65.3
- [ ] Abajo a la izquierda dice **v0.65.3**.
- [ ] Producción → Configuración de Producción: aparece **Fermentación en bloque · Panadería** con su (i) y la lista (Masa ciabatta, Masa baguette primero; sin masa madre ni poolish).
- [ ] Escribo 2:00 en Masa ciabatta → Guardar → dice "Guardado"; al recargar sigue 2:00 y Panadería dice "editada aquí".
- [ ] Escribo "2:75" → avisa y no guarda.
- [ ] Copio desde la planilla de nuevo → la f.b. sigue.
- [ ] En la tablet: marcar terminada la Masa ciabatta → "f.b. hasta" 2 horas después.
- [ ] Celular, tablet y PC: la lista se lee bien (en el celular, una receta por línea).

**Si algo sale mal:** vuelve a subir la v0.65.2 (la f.b. guardada queda en la configuración y no molesta).

**Pruebas:** `pruebas/sistemafen/fb-v0171.test.js` y `pruebas/cocina/fermentacion.test.mjs`; capturas en `pruebas/capturas/fb-v0171/`.

## Novedades de la v0.65.2: con la cartola en línea, solo montos exactos (adiós a las "cabezas de pescado")
**Dónde:** Conciliación → Cartola (Abonos (B2B) y Cargos (Gastos)).

### El problema
La cartola en línea corta la glosa ("TEF DE", "TEF A"). Con eso los abonos se iban a clientes al azar y "Ya está en Gastos" listaba más de 100 gastos de la planilla antigua de monto "parecido".

### Abonos (B2B)
- **Seguro:** se sabe quién pagó: el RUT de las **transferencias recibidas** (o de la glosa), lo **aprendido**, el **nombre completo** en la glosa o lo **elegiste tú** (como hasta ahora). Si además calza exacto y de una sola forma, va a **Listos para confirmar**.
- **Probable:** nada dice quién pagó, pero el monto calza **exacto (±$1)** con: el saldo de un folio, la suma de **2 a 4 folios del mismo cliente** (los más antiguos primero), **una orden** dentro de un folio de varias órdenes, o **todo lo que debe** el cliente. Si hay varios, primero el que **vence más cerca** de la fecha del pago (y abajo "Otras coincidencias exactas" para elegir). Va a **Para revisar** con el chip **Probable**: **nunca se confirma solo**.
- **Sin exacto:** no se propone ningún cliente. Dice **"Sin coincidencias exactas"** y que busques el monto con **"$"** en Ventas B2B (Cobranza u Órdenes). **"Ver parecidos"** (plegado) muestra folios, órdenes y totales a ±2 % (primero el cliente cuya glosa se parece), con **Elegir**.
- Confirmar un Probable aprende la glosa solo si dice algo de quién paga ("TEF DE 0001234" o "TRANSFERENCIA DE TERCEROS" no se aprenden; el RUT de la transferencia, sí).

### Cargos (Gastos) — "Ya está en Gastos"
- Por defecto, **solo los del mismo monto (±$1) y de fechas que calzan**: facturas del SII **de 5 días antes a 45 después**; a mano, vencimientos y lo que espera su cargo **±10 días**; **planilla antigua ±5 días**. Cada uno con **Seguro** (mismo RUT o proveedor: transferencia enviada, RUT de la glosa o glosa aprendida) o **Probable** (monto y fecha).
- Si no hay: **"Sin coincidencias exactas"**. **"Ver parecidos"** (plegado) es la lista de antes: el monto más parecido, filtros por origen y los días en amarillo (10+) y rojo (20+).
- La propuesta del cargo ("Ya en Gastos: …") usa las mismas ventanas y dice Seguro o Probable. **Previred no cambia** (el grupo "Planillas de Previred" sigue primero).

### Aviso de la cartola en línea
Después de subir una cartola en línea (o si lo que queda abierto viene casi todo de ella), arriba en Conciliación → Cartola: *"La cartola en línea trae poca información. Sube también las transferencias recibidas y enviadas del mismo día (BancoEstado → Consulta de transferencias) para reconocer quién pagó y a quién pagaste."* **Entendido** lo cierra hasta la próxima subida en línea (se recuerda en este navegador).

### Lecturas
Ninguna nueva: todo se calcula en memoria con lo que ya se leía. `cuota-v0632` y `cuota-v0633` pasan con los mismos presupuestos.

### Instalación v0.65.2 (unos 2 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.65.2.zip` (con la carpeta `cocina/`, que no cambia) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC). Nada en Apps Script, reglas ni Cocina.

### Lista de verificación v0.65.2
- [ ] Abajo a la izquierda dice **v0.65.2**.
- [ ] Subo una cartola en línea: arriba aparece el aviso de las transferencias; **Entendido** lo cierra y al recargar no vuelve.
- [ ] Un abono igual al saldo de un folio, sin RUT: en "Para revisar" con **Probable** y ese cliente; no está en "Listos para confirmar".
- [ ] Un abono igual a dos folios del mismo cliente: propone los dos folios.
- [ ] Un abono que no calza con nadie: en "Sin cliente", sin cliente elegido, "Sin coincidencias exactas" y "Ver parecidos" plegado.
- [ ] Subo las transferencias recibidas: el abono de ese RUT pasa a **Seguro** en "Listos para confirmar".
- [ ] Un cargo "TEF A" con solo gastos parecidos de la planilla antigua: "Ya está en Gastos" dice "Sin coincidencias exactas"; "Ver parecidos" muestra la lista con los días en amarillo y rojo.
- [ ] Un cargo de Previred sigue mostrando "Planillas de Previred" primero.
- [ ] En el celular nada se sale de lado.

### Si algo sale mal
Sube de nuevo los archivos de la v0.65.1. No se guardó nada nuevo en las bases (solo el "Entendido" del aviso, en este navegador).

Por dentro: `b2b.js` (`esExacto`, `sumasDeFolios`, `calcesExactos`, `confianzaAbono`, `probablesAbono`, `parecidosAbono`, `glosaInformativa`; `proponer` con Seguro primero y Probables solo exactos), `gastos-banco.js` (`VENTANAS_EXACTAS`, `ventanaExacta`, `enVentanaExacta`, `proveedorCalza`, `confianzaCargo`, `exactosCargo`, `candidatosCargo`; `propuestaGasto` con las ventanas), `app.js` (chips Seguro/Probable, Sin coincidencias exactas, Ver parecidos, aviso de la cartola en línea), `estilos.css`, `config.js`, `index.html` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia.

Pruebas: nueva `pruebas/sistemafen/conciliacion-v0652.test.js` (9: 3 unitarias —subconjuntos de 2 a 4 folios con tope, calces, confianza, parecidos, glosa que se aprende, proponer, ventanas de los cargos, Seguro por RUT/proveedor— y de punta a punta con datos ficticios: abono = saldo de un folio → Probable; = dos folios → propuesto; sin exacto → sin cliente y Ver parecidos; RUT → Seguro; cargo con solo planilla antigua aproximada → ninguno, Ver parecidos los muestra; aviso en línea por subida; 390 px). Ajustadas al cambio: `b2b-v014` (el abono de $15.000 sin cliente calza exacto con un folio → Probable) y `conciliacion-v064` (los filtros de "Ya está en Gastos" están dentro de "Ver parecidos"). Siguen pasando `b2b-v012…v0635`, `conciliacion-v064`, `previred-v0651`, `gastos-v063`, `e2e`, `cuota-v0632`, `cuota-v0633` y `sf-pantallas`. Capturas en `pruebas/capturas/conciliacion-v0652/`.

## Novedades de la v0.65.1: Previred ya registrado se une con sus cargos del banco (sin gastos)
**Dónde:** Conciliación → Cartola (un cargo de AFP, IPS, Fonasa, isapre, caja o mutual) y Conciliación → Previred. Solo con Gastos en la base nueva.

### El caso (real)
El certificado de agosto 2026 se subió antes (pagado el 15-09: sus gastos por trabajador ya existen y no queda vencimiento abierto). En la cartola del 16-09 llegan "PAGO DE CUENTAS AFP … CESANTIA" $9.510, "PAGO DE CUENTAS INSTITUTO DE SEGUR" $188.354, "PAGO DE CUENTAS FONASA" $332.622… "Pago de Previred" no encontraba nada (buscaba solo vencimientos abiertos) y "Ya está en Gastos" mostraba más de 100 gastos sueltos de la planilla antigua.

### Qué cambia en cómo trabajas
- Abres uno de esos cargos y viene **"Pago de Previred (cotizaciones)" sugerido** (resaltado). Ahora lista también las **planillas ya registradas** (los meses cargados): las con vencimiento abierto se **pagan** como siempre; las ya pagadas se **unen** ("ya registrada · solo unir").
- **Propuesta:** la planilla cuya fecha de pago (del certificado) está a 5 días o menos del cargo; si no hay, la más reciente que no esté conciliada completa ("Por la fecha del cargo").
- **Vienen marcados** los cargos de Previred (AFP, FONASA, ISAPRE, INSTITUTO DE SEGUR, IPS, CAJA, MUTUAL, PREVIRED) de ±3 días hábiles. Ves **"Unidos $X de $total · faltan $Y"** y el botón **"Unir N cargos a la planilla (sin gastos)"**.
- **No se crea ningún gasto:** los gastos son los del certificado (uno por trabajador). Cuando lo unido iguala el total (±$10) la planilla queda **"pagada y conciliada"**, con su fecha de pago del certificado (las del banco son informativas). No deja pasarse del total.
- **Otro día u otra cuenta:** abre ese cargo y únelo a la misma planilla (dice lo ya unido).
- **Deshacer** (Ya revisados, o en Previred junto a cada cargo): quita **solo ese cargo** (queda anotado en la planilla) y vuelve a "Para revisar"; los demás siguen unidos.
- **"Ya está en Gastos"** de un cargo de Previred: arriba va el grupo **"Planillas de Previred"** (con "Unir a esta planilla"), antes de los gastos sueltos.
- **Conciliación → Previred:** cada mes cargado dice **"Pagos del banco unidos: $X de $total"** con sus cargos (también los pagados con la cartola desde su vencimiento, v0.64.0).

### Dónde se guarda (fen-gastos; las reglas v0.1.0 ya lo cubren)
- Nueva colección `previred_planillas/{AAAA-MM}` (una por mes, solo la crean los cargos unidos): `{ periodo, total, fechaPago (la del certificado), trabajadores, pagos: [{ cargoId, monto, fecha, descripcion, cuenta, cuentaN, por, en, marca }], pagosQuitados: [… + quitado { por, en, motivo }], unido, falta, estado: parcial | pagada_conciliada | sin_pagos, conciliadaEl, conciliadaPor, historial }`. **No pasa a la planilla de Google.** Los meses cargados (`cotizaciones`) no cambian.
- Cargos: acción `previred_planilla`, estado CONCILIADO, detalle `previredPlanilla { planillaId, nombre, total, fechaPago, cargos, suma, unido, falta, completa }`. No se aprende regla nueva (la glosa basta).
- **Finanzas:** estos cargos **no son gasto** (contarlos sería doble: el gasto es el del certificado). No entran al estado de resultados ni a la cuadratura y salen de "por revisar" del cierre. Para el flujo de caja (F4): `cargosCartola().pagosPrevired` y `previred_planillas/{mes}.pagos [{ cargoId, monto, fecha }]`.
- Script de Gastos: sin cambios (v2.18.0). Reglas: sin cambios.

### Lecturas (cuota de fen-gastos; `cuota-v0632.test.js`, volumen de un año)
Lista de cargos con planillas ×20 = 8 lecturas (todo en memoria: `cotizaciones` ya está en los resúmenes y `previred_planillas` son pocos documentos); unir 3 cargos = 6 lecturas y 5 escrituras; deshacer uno = 4 y 3. Conciliar 100 cargos sigue en 715. Día pesado: 4.880 lecturas (bajo 20.000).

### Instalación v0.65.1 (unos 2 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.65.1.zip` (con la carpeta `cocina/`, que no cambia) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R en el PC). Nada en Apps Script, reglas ni Cocina.

### Lista de verificación v0.65.1
- [ ] Abajo a la izquierda dice **v0.65.1**.
- [ ] Conciliación → Cartola: el cargo de Fonasa del 16-09 dice "Pago de Previred: Planilla de agosto 2026 (Unidos $0 de $868.818 · faltan $868.818)".
- [ ] Al abrirlo, "Pago de Previred" viene resaltado ("Sugerido"), la planilla de agosto marcada "Por la fecha del cargo" y los cargos de Previred de esos días marcados.
- [ ] **Unir** → "Unidos $X de $868.818 · faltan $Y"; en Gastos no aparece ningún gasto nuevo.
- [ ] Un cargo de otro día se une a la misma planilla; al completar: **"pagada y conciliada"**.
- [ ] Conciliación → Previred → agosto: "Pagos del banco unidos: $868.818 de $868.818" con los cargos; **Deshacer** uno → vuelve a "faltan" y el cargo a "Para revisar".
- [ ] "Ya está en Gastos" de un cargo de AFP: arriba "Planillas de Previred", después los gastos.
- [ ] Un vencimiento de Cotizaciones abierto con su certificado se sigue pagando como en la v0.64.0.
- [ ] En el celular nada se sale de lado.

### Si algo sale mal
Sube de nuevo los archivos de la v0.65.0. Los cargos ya unidos quedan conciliados (acción `previred_planilla`) y `previred_planillas` queda en fen-gastos sin estorbar; con la v0.65.0 no se pueden deshacer desde la app (avísame si hace falta).

Por dentro: `gastos-cartola.js` (planillas, opciones, propuesta por la fecha del certificado, ±3 días hábiles, avance y tope; `proponer` también con planillas), `gastos-cartola-fs.js` (planillas en la lista, `previred_planilla` y su deshacer por cargo), `gastos-g3d-fs.js` (Previred: pagos unidos por mes), `app.js` (Pago de Previred con planillas, sugerido, grupo en Ya está en Gastos, Previred), `finanzas.js` (`pagosPrevired`), `estilos.css`, `config.js`, `index.html` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia.

Pruebas: nueva `pruebas/sistemafen/previred-v0651.test.js` (10: 1 unitaria —avance, propuesta −5..+5 o la más reciente sin conciliar, ±3 hábiles, tope, la propuesta del cargo— y de punta a punta con datos ficticios: planilla de $868.818, tres cargos del mismo día → faltan; cuarto otro día → pagada y conciliada; deshacer uno; ningún gasto; "Planillas de Previred" primero; Finanzas; 390 px). `cuota-v0632.test.js`: caso nuevo (lista ×20, unir, deshacer). Siguen pasando `conciliacion-v064`, `gastos-g3a…g3e`, `gastos-v063`, `e2e`, `cuota-v0632`, `cuota-v0633`, `sf-pantallas` y `finanzas-f3b`. Capturas en `pruebas/capturas/previred-v0651/`.

## Novedades de la v0.65.0: bodegas por área responsable (Panadería, Bollería, Pastelería, Cafetería)
**Dónde:** Producción → Bodega (y Hoy). Va con **Cocina v0.17.0**, el **script de Producción v2.11.0** y las **reglas v1.8.0** de fen-produccion.

### La decisión (14-oct)
- Cuatro bodegas: **Panadería, Bollería, Pastelería y Cafetería**. Panadería y Bollería comparten el espacio, pero Bollería necesita cuidar más su consumo y tiene más materias primas; Pastelería tiene la suya.
- Cada materia prima crítica tiene **UNA bodega responsable** (las harinas → Panadería). Su stock es uno solo y **baja con lo que consume cualquier área**: la harina que usan Bollería y Pastelería baja la de Panadería. Puede además ser crítica en Cafetería (otro stock físico, como ahora).
- Ruta del consumo: lo de Cafetería → Cafetería; lo de Panadería, Bollería y Pastelería → la bodega de producción donde esa materia prima es crítica. Si es crítica en dos de producción (no debería), se avisa aquí: va a la del área que consume si la tiene; si no, a la responsable.
- Cada área ve, cuenta y recibe en Cocina **solo lo suyo**. Hoy (aquí) muestra **todo**. El correo de bajo el mínimo va a ti y **solo a las jefas del área responsable**: Cafetería nunca recibe la harina; Bollería no recibe lo de Panadería.

### Qué cambia en cómo trabajas
1. **Asignar responsables (una vez).** Producción → Bodega → Calcular: arriba aparece **"Asignar responsables"** con cada crítica de Producción, el **uso por área** (% de Panadería, Bollería y Pastelería: lo consumido en los últimos 120 días o, si no hay, sus recetas) y la **propuesta**: harinas → Panadería; lo demás, el área que más la usa. Cambia lo que quieras y **Confirmar responsables**. Hasta confirmar, todo sigue como hoy (Producción compartida). (i) explica.
2. **Pestañas Panadería · Bollería · Pastelería · Cafetería.** Cada una dice quién es la responsable. En cada fila hay **Responsable** (lista): cambiarla pasa la materia prima a otra área **sin mover el stock** (mismo documento, mismos conteos y llegadas) y queda en la historia.
3. **Agregar crítica** en una pestaña de producción deja a esa área como responsable (si ya era de otra, pregunta).
4. **Avisos:** "Críticas en más de una bodega de producción" (si pasa, con Quitar en su pestaña) y "Sin responsable elegida (van a Panadería)".
5. **Hoy:** "Bajo el mínimo: Harina de fuerza (Panadería)" — una línea por materia prima y bodega, como antes.

### Cómo queda guardado (fen-produccion; backward compatible, nada se copia ni se borra)
- `config/bodegas` = `{ modo: 'responsable', areas: { PAN: 'PAN', BOL: 'BOL', PAS: 'PAS', CAF: 'CAF' }, nombres, responsables: { mpId: 'PAN' | 'BOL' | 'PAS' }, confirmado: { por, en (ISO) }, historial: [{ en, por, cambios: { mpId: [antes, ahora] }, confirmado? }] (últimos 200), antes: { areas, nombres } }`.
- **Stock de producción:** sigue en `stockmp/{mpId}` y `conteosmp/{mpId}` (los de siempre); su bodega es la responsable. Cambiar la responsable solo cambia `responsables[mpId]`: continuidad total del stock y del historial de conteos. Una crítica en **otra** bodega de producción iría en `stockmp/{BODEGA}__{mpId}` (como `CAF__`).
- **Llegadas y conteos:** los de antes (`bodega: 'PROD'` o sin campo) cuentan para la responsable de hoy (un conteo de harina hecho por Bollería con la v0.16 sigue siendo el último conteo de la harina de Panadería). Los nuevos llevan `'PAN'`, `'BOL'`… Después de confirmar, una anotación de un área sobre algo que no es suyo no se cuenta (y las reglas v1.8.0 no la dejan escribir).
- El cálculo es `cocina/consumo.js` v0.17.0 (copia exacta de Cocina). Las llegadas de Administración siguen en `dias/ADM_{fecha}` con la bodega elegida.

### Lecturas (cuota de fen-produccion)
Ninguna lectura nueva: `config/bodegas` ya venía con la configuración (en memoria), la propuesta sale del cálculo de la bodega que ya se hace (120 días) y confirmar o cambiar una responsable = 1 lectura + 1 escritura de `config/bodegas`. Medido con `cuota-v0633.test.js` normal y con `BODEGAS_RESP=1` (bodegas confirmadas): mismos presupuestos. Cocina: las mismas escuchas que la v0.16.4 (`config/bodegas`, `stockmp`, `conteosmp`), cero lecturas nuevas.

### Instalación v0.65.0 (orden: reglas → script → Sistema Fën → Cocina)
1. **Reglas v1.8.0** de fen-produccion (`reglas-produccion-v1.8.0.zip` o `fen-cocina-v0.17.0.zip` → `firestore-produccion.rules`): consola de Firebase → **fen-produccion** → Firestore Database → Reglas → pegar todo → **Publicar**.
2. **Script de Producción v2.11.0** (`produccion-script-v2.11.0.zip`): reemplaza **Seguridad** y **SistemaFen** → Implementar → Gestionar implementaciones → ✏️ → **Nueva versión**. Ping: `"version":"2.11.0"`.
3. **Sistema Fën v0.65.0**: GitHub, repo **sistema-fen**, raíz → sube **todos** los archivos del zip (con la carpeta `cocina/`: cambia `cocina/consumo.js`) → Commit. Recarga (Ctrl+Shift+R).
4. **Cocina v0.17.0** (`fen-cocina-v0.17.0.zip`) y **recarga todas las tablets**.
5. Producción → Bodega → Calcular → **Asignar responsables** → Confirmar.

### Lista de verificación v0.65.0
- [ ] Abajo a la izquierda dice **v0.65.0**; Configuración → Conexiones: el script de Producción en **v2.11.0**.
- [ ] Producción → Bodega → Calcular: aparece "Asignar responsables" con el % de uso por área y la propuesta (harinas → Panadería). El (i) explica.
- [ ] Cambio una propuesta y **Confirmar responsables** → pestañas **Panadería · Bollería · Pastelería · Cafetería**; el stock de cada una es el mismo de antes.
- [ ] En la pestaña Bollería, cambio la responsable de una materia prima a Pastelería → aparece en Pastelería con el mismo stock.
- [ ] Bollería marca masas hechas en Cocina → Calcular: baja la harina de **Panadería**.
- [ ] Algo bajo el mínimo: Hoy dice "Bajo el mínimo: … (Panadería)" y llega un correo a ti y a las jefas de esa área (no a las demás).
- [ ] Celular, tablet y PC: nada se sale de lado (también la tabla de Asignar responsables).

### Si algo sale mal
Sube de nuevo la v0.64.0. Si ya confirmaste, en la consola de Firebase, documento `config/bodegas`: `modo` = `compartida` y `areas` = `{ PAN: 'PROD', BOL: 'PROD', PAS: 'PROD', CAF: 'CAF' }` (lo que quedó en `antes`), o avísame y lo hago: todo vuelve a la bodega común sin perder nada (los responsables y la historia quedan guardados para volver a confirmar). Las reglas v1.8.0 y el script v2.11.0 pueden quedar.

Pruebas: `pruebas/cocina/responsables.test.mjs` (9 unitarias: mapa, ids compatibles, lo que ve cada área, ruta del consumo y stock único, repetidas, llegadas y conteos antes/después de confirmar, continuidad al cambiar la responsable, a quién avisar, propuesta por uso), `pruebas/sistemafen/reglas-v180.test.mjs` (4, simulador de reglas), `pruebas/produccion2110` (40, 3 nuevas: destinatarios exactos y la tablet solo avisa de lo suyo), `cocina-p1.test.js` (5 de punta a punta nuevas: Asignar responsables en 390/768/1024/1280, la harina de Panadería baja con lo de Bollería, cada área ve solo lo suyo y las reglas, aviso y correo exacto, cambiar responsable sin mover el stock). Capturas en `pruebas/capturas/bodegas-v017/`.

Archivos: cambian `produccion.js`, `vista-produccion.js`, `cocina/consumo.js` (v0.17.0, copia exacta de Cocina), `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). Abajo a la izquierda: **v0.65.0**.

## Novedades de la v0.64.0: Conciliación, el centro de todos los archivos
**Dónde:** Conciliación (menú). Solo con Gastos en la base nueva (lo de B2B, igual que antes).

### Qué cambia en cómo trabajas
- **Todos los archivos se suben en un solo lugar:** Conciliación → botón **Subir archivo** (arriba, con su (i)). Reconoce solo la cartola (histórica o en línea), las transferencias recibidas, las **transferencias enviadas** (nuevo), el archivo del SII (XML, XLS o CSV) y el certificado de Previred (PDF), y te lleva a su pestaña.
- **Cargas del SII y Previred salieron de Gastos:** ahora están en Conciliación (pestañas **Cartola · Cargas del SII · Previred · Proveedores**). Los enlaces viejos (`#gastos/sii`, `#gastos/previred`) llevan solos al lugar nuevo.
- **Baja también la "consulta de transferencias enviadas"** de BancoEstado cuando bajes la cartola (sobre todo la en línea): con ella cada cargo dice a quién pagaste y se reconoce el proveedor.
- **Previred se concilia de una vez:** abre uno de los cargos (AFP, IPS, Fonasa, isapre, caja, mutual) → **Pago de Previred (cotizaciones)**: los del mismo día ya vienen marcados; si suman el certificado, un toque paga el vencimiento.
- **Pagos en partes:** si un cargo es menos que la factura o el vencimiento, queda como **abono** ("Con abonos · saldo $X"); el último lo deja pagado. **Reagendar saldo** si quedaste en pagar el resto otro día.
- **Sueldos:** al hacer un abono eliges el **mes**; un cargo de los primeros 15 días propone el mes anterior.
- **Proveedores sin factura** (el maestro, los huevos): créales una **ficha a mano** en Conciliación → Proveedores (cómo aparecen en la cartola, ítem y área): sus cargos se reconocen solos.
- **Reventa:** lo que compras para vender tal cual va al ítem **PRODUCTOS DE REVENTA** con el área donde se vende (explicado en Finanzas → Cómo trabajamos y en el (i) de Gastos).

### Lo nuevo, punto por punto
1. **Reventa.** Finanzas → Resultados → Clasificación propone "Compras de productos de reventa" cuando el ítem dice REVENTA, CHOCOLATE(S), INFUSION(ES), TE/TES o MAGIA (además de bebidas y jugos). Cómo trabajamos tiene "Productos de reventa" (ítem PRODUCTOS DE REVENTA con el área donde se vende; el costo de lo vendido = costo de compra neto del producto en Márgenes → Asociar productos × unidades; la compra no es línea de gasto). El mismo texto en un (i) de Gastos → Registrar e Ítems. **Pendiente:** que el costo de compra de la reventa se actualice solo con cada factura del SII (hoy se escribe a mano).
2. **Conciliación = centro de archivos.** Pestañas Cartola (con Abonos (B2B) y Cargos (Gastos) dentro), Cargas del SII (la misma pantalla reorganizada en la v0.63.7), Previred y Proveedores. **Subir archivo** reconoce: transferencias enviadas (por los encabezados), transferencias recibidas y cartola (.xlsx), SII (XML/XLS/CSV; un .xls que no es cartola va al SII) y Previred (PDF). Gastos ya no tiene esas pestañas.
3. **Abono de sueldo: elegir el mes.** Aparecen todos los vencimientos libres abiertos (de cualquier mes), el más nuevo primero, con su período ("octubre 2026"). La propuesta ("Por la fecha del cargo"): los sueldos del mes M se pagan a inicios de M+1, así que si el cargo es del día 15 o antes se propone el del mes anterior (si sigue abierto); si no, el del mes del cargo. Lo aprendido también usa esta regla. Puedes elegir otro.
4. **"Ya está en Gastos": filtros y factura que llega después.** Chips **Todos · SII con detalle · Registro de compras (RCV) · A mano · Vencimientos · Planilla antigua** (con cuántos hay). Si ninguna carga del SII cubre el mes del cargo (la misma cobertura de "Qué está cubierto"): "El SII de octubre no está cargado: esta compra podría tener factura que llega después." Un **Gasto nuevo** en ese caso queda `esperaFactura: true` (salvo "No lleva factura"). Al cargar el SII, una factura del mismo monto (±$1) de 5 días antes hasta 30 días después del cargo aparece en esa carga como **"Ya está en Gastos (desde la cartola)"** para vincularla en vez de crear otro gasto. Nunca se vincula ni duplica solo.
5. **Pago de Previred desde la cartola.** Opción nueva en el cargo. Se marcan los cargos del mismo día (±1) que parecen de Previred (por la glosa o lo aprendido); se suman contra el total del certificado del vencimiento de Cotizaciones. Iguales (±$10) → paga el vencimiento como siempre (un gasto por trabajador con su área e ítem: lo del certificado) y todos los cargos quedan conciliados juntos. Distintos → muestra la diferencia; se confirma escribiendo el motivo (queda en el vencimiento) o se cancela. Se aprende. **Deshacer uno deshace el pago completo** (todos sus cargos vuelven a revisar, el vencimiento queda por pagar, los gastos anulados). Un solo cargo por el total se sigue proponiendo como antes ("Paga vencimientos").
6. **Proveedores.** De la glosa del cargo se lee "TEF A RUT …" (con dígito verificador), "TEF A <NOMBRE>" o "TRANSF A <NOMBRE>"; con la transferencia enviada, su RUT y nombre completo. Se busca la ficha `proveedores/{rut}` (o lo aprendido de esa glosa, o el nombre) y el cargo muestra **"Proveedor: …"** y, al abrirlo, "… · le compras: harina t80 25 kg, levadura … · últimas facturas: F.777 (01-10) $238.000" con **Ver ficha**; sus facturas por pagar salen primero ("de este proveedor"). Pestaña **Proveedores**: lista, búsqueda (nombre, RUT, producto, glosa), detalle (lo que le compras —productos del detalle del SII e ítems de siempre—, facturas por pagar y últimas, pagos vinculados, cómo aparece en la cartola) y **fichas a mano** (nombre, RUT opcional, glosas, ítem y área usuales: "Gasto nuevo" viene con ese ítem). Al confirmar un cargo de un proveedor conocido, su glosa queda aprendida en la ficha. "Armar fichas" (Base nueva) no borra lo puesto a mano. Todo desde la memoria: ninguna lectura por cargo.
7. **Días entre la compra y el cargo** (Ya está en Gastos): "cargo N días después" en **amarillo** desde 10 días y en **rojo** desde 20, con "puede no ser la compra de este cargo".
8. **Pagos parciales (abonos) a vencimientos que no son libres y a facturas.** En Paga vencimientos, con un solo vencimiento elegido y el cargo menor a lo que falta: "se registra como abono y queda saldo $X" → **Registrar abono**. A mano (efectivo): Gastos → Vencimientos → **Abono** (o en el menú de los tres puntos de los de banco, "Registrar abono (pago parcial)"). Estado **"Con abonos · saldo $X"**, con los abonos y "de $total". **Reagendar saldo**: fecha nueva para lo que falta (Agenda, Hoy y atrasos usan esa fecha). El último abono lo deja pagado. Un cargo igual al saldo se propone solo ("Abono al saldo de …").
   **Decisión (lo devengado):** el gasto es el **documento completo**, nunca el abono. Factura del SII o compra a crédito: su gasto ya existe (se creó al importar); los abonos no crean gastos y el **último le pone la fecha de pago**. Obligación fija o según documento (o vencimiento suelto), cuyos gastos nacen al pagar: el **gasto completo se crea con el primer abono** (total del documento o lo estimado, con su ítem y áreas) y queda con el cargo de ese abono. Cada abono guarda `{ fecha, monto, origen: cartola | mano, cargoId, parcial: true }` para el flujo de caja (F4). Previred y las obligaciones libres no usan esto (tienen lo suyo). Deshacer: el abono sale (queda en `abonosQuitados`); si era el primero, su gasto completo queda anulado (si hay abonos después, primero hay que deshacer esos).
9. **Origen del cargo.** Cada cargo dice de qué archivo salió: "Cartola histórica N°060 (14-10)" (N° y día en que se subió), "Cartola en línea del 13-10-2026", "Transferencias enviadas del 14-10-2026". Se guarda al subir (`fuentes: [{ tipo, numero, generada, subida }]`); si el mismo cargo llega después en otro archivo (la histórica después de la en línea) se le suma la fuente. Lo de antes se deduce de la cartola. Si viene solo de la en línea y la glosa trae poca información: "Viene de la cartola en línea, que trae poca información: sube la consulta de transferencias enviadas o la cartola histórica." (con su (i): la histórica llega cada 36 movimientos).
10. **Transferencias ENVIADAS** (BancoEstado "TefSimpleConsultaEnviadas_<rut>_<fecha>.xlsx"): hoja Encabezado (Cuenta Origen "número | tipo", Fecha Desde/Hasta, Estado) y hoja Transferencias (N° de Operación, Fecha de Ejecución "dd/mm/aaaa hh:mm", Rut Destino, Nombre Destino, Cuenta Destino, Banco Destino, Concepto, Monto). Se reconoce por los encabezados. Se guardan en fen-gastos `tef_enviadas/{cuenta}_{operación}` (solo los últimos 180 días; subir el mismo archivo no repite). Cruce con los **cargos**: misma cuenta (tipo y últimos 4 dígitos), monto exacto y la ventana de la v0.63.4 (1 día antes a 3 días hábiles después, `feriados-cl.js`); una transferencia nunca en dos cargos. El cargo muestra **"Pagaste a: NOMBRE · RUT · Banco · hora · «concepto»"**; su RUT sirve para el proveedor y para el abono de sueldo (la clave del destinatario de la v0.63.1 usa el RUT; "Para quién" viene con el nombre).

### Lecturas (cuota de fen-gastos)
Medido en `cuota-v0632.test.js` (volumen de un año): subir 300 transferencias enviadas = 300 escrituras y 0 lecturas; la primera lista de cargos después lee esas 300 una vez; después, 20 listas con 120 cargos por revisar (cada uno con su transferencia y su proveedor) = **0 lecturas**; Proveedores ×5 = 0; pago de Previred con 3 cargos = 10 lecturas y 10 escrituras. Conciliar 100 cargos sigue en 715 lecturas. Día pesado: ≈ 4.800 lecturas (bajo 20.000).

### Dónde se guarda (fen-gastos; las reglas v0.1.0 ya lo cubren)
- `tef_enviadas/{cuenta}_{operación}`: `{ op, fecha, hora, rut, rutTxt, nombre, cuentaDest, banco, concepto, monto, cuentaNum, cuentaTipo, cuentaFin, archivo, subida, por }`. **No pasa a la planilla.**
- `proveedores/{rut}` o `proveedores/pm-<nombre>` (a mano): suma `nombre, glosas, item, area, manual, historial`. No pasa a la planilla (como siempre).
- Cargos: `fuentes`; acción `previred` (detalle `previred { vencimientoId, total, suma, diferencia, motivo, cargos, gastos }`) y `abono_parcial` (detalle `abonoParcial { vencimientoId, n, monto, total, saldo, final, gastos }`). Lo aprendido: acción `previred`.
- Vencimientos: abonos con `parcial: true`, `fechaSaldo`, y en Previred `pago { cargos, diferencia, motivo }`. Gastos: `esperaFactura`, `origenDetalle.abonoParcial`.
- **Script de Gastos: sin cambios (v2.18.0).** La planilla no necesita columnas nuevas: los abonos parciales van en la columna Abonos (texto, como los de sueldo) y el estado sigue PENDIENTE/PAGADO; `fechaSaldo`, `esperaFactura` y `fuentes` quedan solo en la base. **Reglas: sin cambios.**

Por dentro: nuevos `tef-enviadas.js` (leer, id, cruce, texto) y `proveedores.js` (glosa, búsqueda, lo que le compras, fichas a mano); `gastos-cartola.js` (período del abono, Previred, saldo, fuentes del cargo), `gastos-cartola-fs.js` (lista con enviadas y proveedores, `abono_parcial`, `previred` y su deshacer, `guardarEnviadas`, `proveedoresLista`, `guardarFicha`, glosa aprendida), `gastos-fs.js` (`abonoParcial`, `reagendarSaldo`), `gastos-g3.js` (`abonoParcial`, `quitarAbonoParcial`, `totalVenc`, `saldoVenc`, `fechaReal` con el saldo reagendado), `gastos-banco.js` (filtros por origen, color de los días), `gastos-sii.js`/`gastos-sii-fs.js` (desde la cartola, ±$1; "Armar fichas" conserva lo puesto a mano), `finanzas-resultados.js` (reventa), `vista-finanzas.js` (Cómo trabajamos), `fs-gastos.js` (`tef_enviadas` en los resúmenes), `cartola.js`, `gastos.js`, `gastos-g2.js`, `app.js`, `estilos.css` (también: el menú de tres puntos del vencimiento se abre dentro de la fila).

Pruebas: nueva `pruebas/sistemafen/conciliacion-v064.test.js` (25: 10 unitarias y 15 de punta a punta con datos ficticios: pestañas y rutas viejas; Subir archivo con enviadas (sin repetir) y cartola; origen, "Pagaste a" y proveedor; abono parcial a la factura y al arriendo (gasto completo), Reagendar saldo; Previred con 3 cargos, deshacer y con diferencia y motivo; sueldo por mes y RUT; filtros y días; esperando factura → XML → "desde la cartola"; en línea: el saldo cierra la factura y aviso de glosa pobre; Proveedores y ficha a mano; reventa; planilla; 390). Fixture ficticio `pruebas/sistemafen/datos/tef-enviadas-prueba.xlsx`. `cuota-v0632.test.js`: caso nuevo (enviadas, proveedores, Previred, sin lecturas por cargo). `sf-pantallas.test.js`: Cargas del SII y Previred en Conciliación, Proveedores, ficha nueva, Previred y Ya está en Gastos en el cargo, Abono, en 390/768/1280. Ajustadas a las rutas nuevas: `b2b-v018`, `gastos-g3e`, `gastos-g3c` (el período en la propuesta del abono) y `gastos-g2` (la nota de Drive de Consulta de cargas va en su (i), desde la v0.63.7). Capturas en `pruebas/capturas/conciliacion-v064/`.

Archivos: nuevos `tef-enviadas.js` y `proveedores.js`; cambian los de arriba, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.64.0**.

### Instalación v0.64.0 (unos 3 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.64.0.zip` (con la carpeta `cocina/`, que no cambia) → **Commit changes**. Espera 1 o 2 minutos y recarga Sistema Fën en todos los equipos (Ctrl+Shift+R en el PC). Nada en Apps Script, reglas ni Cocina.

### Lista de verificación v0.64.0
- [ ] Abajo a la izquierda dice **v0.64.0**.
- [ ] Gastos ya no tiene "Cargas del SII" ni "Previred"; Conciliación tiene **Cartola · Cargas del SII · Previred · Proveedores** y el botón **Subir archivo**.
- [ ] Un marcador viejo a `#gastos/sii` abre Conciliación → Cargas del SII.
- [ ] **Subir archivo** con la consulta de transferencias enviadas: dice cuántas trae y cuántas son nuevas; subirla de nuevo: 0 nuevas.
- [ ] **Subir archivo** con la cartola: va a Cargos; un cargo por transferencia dice "Pagaste a: …" y su origen ("Cartola histórica N°… (dd-mm)").
- [ ] Un cargo a un proveedor con facturas: "Proveedor: …"; al abrirlo, "le compras: …" y su factura por pagar primero.
- [ ] Un cargo menor que su factura: "Registrar abono" → la factura queda "Con abonos · saldo $X"; el cargo del saldo se propone y la deja pagada.
- [ ] Gastos → Vencimientos: "Abono" / "Reagendar saldo" en uno con monto.
- [ ] Previred: abre el cargo de la AFP → "Pago de Previred": los del día vienen marcados y calzan con el certificado → Pagar.
- [ ] Abono de sueldo a inicios de mes: propone el mes anterior ("Por la fecha del cargo").
- [ ] Ya está en Gastos: filtros por origen; un gasto de hace más de 20 días sale en rojo.
- [ ] Gasto nuevo de un mes sin SII: avisa; al cargar el SII de ese mes, la factura dice "Ya está en Gastos (desde la cartola)".
- [ ] Proveedores: crea una ficha a mano para uno sin factura (con cómo aparece en la cartola).
- [ ] Finanzas → Cómo trabajamos: "Productos de reventa".
- [ ] En el celular nada se sale de lado.

### Si algo sale mal
Sube de nuevo los archivos de la v0.63.7: Cargas del SII y Previred vuelven a Gastos y todo funciona como antes. Lo guardado (`tef_enviadas`, fichas a mano, `fuentes`, abonos parciales, `fechaSaldo`, `esperaFactura`) queda en fen-gastos sin estorbar; con la v0.63.7, un vencimiento con abonos parciales se ve "Con abonos" pero no se puede seguir abonando: termina de pagarlo cuando vuelvas a la v0.64.0.

## Novedades de la v0.63.7: Cargas del SII — la carga abierta debajo de la lista e "Importar compra" una por una
**Dónde:** Gastos → Cargas del SII.

**El orden de las tarjetas:**
1. **Subir un archivo del SII** (igual, arriba).
2. **Consulta de cargas** (antes "Cargas anteriores"), con su (i): "Las cargas que subiste. Ábrela para seguir trabajando lo que quedó pendiente." Cada carga muestra la fecha (período y día en que se subió), el archivo, los documentos, cuántos **importados** y cuántos **pendientes**.
3. **La carga abierta**, siempre **debajo** de Consulta de cargas (antes quedaba entre el botón de subir y la lista). Se abre así al tocar "Abrir carga" (o "Revisar carga") y también al subir un archivo nuevo; la pantalla baja sola hasta ella.

**Abierta y Cerrar:** la carga abierta queda marcada en la lista ("Abierta abajo", borde verde) y tiene un botón **Cerrar** (en su tarjeta y en la lista) que la pliega. Si hay compras clasificadas sin importar, pregunta antes (esa clasificación se pierde; la carga sigue en la lista para abrirla de nuevo).

**Importar compra:** cada documento tiene su botón **"Importar compra"**. Se activa cuando la compra está lista (con ítem y lo demás que pide el botón de todas: áreas, pagada/pendiente, fecha); si no, dice qué falta. Hace la misma revisión y la misma importación que el botón de todas, solo con esa compra. El resultado queda en la misma tarjeta, que pasa a **"Importada · ya en Gastos"**, y la lista de cargas se pone al día sin volver a leer la base.

**Importar todas las clasificadas (N):** el botón de arriba ahora dice cuántas importa (clasificadas y no importadas todavía). Las que no tienen ítem quedan pendientes; debajo dice "Quedan M por clasificar".

**Sin duplicados:** lo importado una a una no se vuelve a enviar con el botón de todas; si una compra ya estaba en Gastos (por ejemplo, importada desde otro equipo), dice "Ya estaba en Gastos: no se guardó de nuevo." y queda como importada. Los reintentos tras un corte usan la misma clave (no duplican), como antes.

**Finanzas:** al importar una sola compra también se revisan los precios de las materias primas (v0.57), y el aviso ("Finanzas: … precios actualizados · … por confirmar") queda en su tarjeta.

Archivos: cambian `app.js` (Cargas del SII), `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). La carpeta `cocina/` no cambia. No cambian las reglas ni los scripts. Pruebas: `e2e.test.js` (nueva: abrir debajo de la lista y cerrar, importar una, todas importa solo el resto, sin duplicados), `sf-pantallas.test.js` (carga abierta en 390/768/1280; capturas en `pruebas/capturas/sii-v0637/`), `finanzas-f1b.test.js` (la revisión de precios con "Importar compra") y `gastos-g3a.test.js`. Abajo a la izquierda: **v0.63.7**.

**Dónde va:** GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.63.7.zip` (con la carpeta `cocina/`, que no cambia) → **Commit changes**. Espera 1 o 2 minutos y recarga Sistema Fën en todos los equipos (Ctrl+Shift+R en el PC). Nada en Apps Script, reglas ni Cocina.

### Lista de verificación v0.63.7
- [ ] Abajo a la izquierda dice **v0.63.7**.
- [ ] Gastos → Cargas del SII: arriba "Subir un archivo del SII", después "Consulta de cargas" con su (i).
- [ ] Cada carga de la lista muestra: subida el …, documentos, importados y pendientes.
- [ ] "Abrir carga": la carga aparece **debajo** de la lista, la pantalla baja hasta ella y en la lista queda marcada "Abierta abajo".
- [ ] Subir un archivo nuevo: se abre igual, debajo de la lista.
- [ ] "Cerrar" (arriba de la carga o en la lista) la pliega y la lista deja de marcarla.
- [ ] Una compra sin ítem: "Importar compra" está gris y dice qué falta.
- [ ] Clasificar una compra y tocar "Importar compra": queda "Importada · ya en Gastos" con su resultado; el botón de arriba y "Quedan … por clasificar" bajan; la lista suma un importado.
- [ ] "Importar todas las clasificadas (N)" importa solo las que faltaban (no repite la importada una a una) y dice "Quedan M por clasificar" si quedan.
- [ ] Una compra con materias primas asociadas en Finanzas: al importarla sola aparece el aviso de Finanzas en su tarjeta.
- [ ] En el celular nada se sale de lado.

## Novedades de la v0.63.6: al aprobar una receta, lo primero es el costo del lote (o de la unidad), no el del gramo
**El problema:** en Producción → Desde Cocina → Recetas por aprobar, un espresso que pasaba de 14 g de café (rinde 28 g) a 17 g de café + 23 g de agua (rinde 40 g) mostraba "−14,6 %" por gramo. El gramo bajaba solo porque había más agua: cada taza subía de $353 a $431 (+22 %).

**Ahora:**
- **Arriba, el cambio que importa:** "+22 % el costo del lote (neto)", o "el costo por unidad" si la receta rinde unidades. Su (i) explica por qué el gramo no sirve para comparar.
- **Los dos lotes siempre:** "Lote vigente $353 · 28 g" y "Lote propuesto $431 · 40 g · +22 %". Si la receta rinde unidades, también **Vigente · por unidad** y **Propuesta · por unidad** con su %.
- **Por gramo, abajo y más chico** (vigente y propuesta, con su %), como dato secundario.
- **Aviso** si la receta rinde gramos pero se vende por unidad (es de Cafetería, o está vinculada a un producto de la caja o de B2B en Finanzas → Ventas por producto): "Esta receta rinde en gramos pero se vende por unidad: compara el costo del lote. Conviene que rinda unidades (ej. 1 espresso)." con su (i).
- **Costo neto por ingrediente** en la tabla, en la columna vigente y en la propuesta (café 14 g $353 → 17 g $429): se ve qué ingrediente mueve el costo.
- **De dónde sale el costo:** primero el costo neto de Finanzas (motor de costeo, precio de la última compra). Si Finanzas no está conectada o le falta el precio de algún ingrediente, el del script con los precios de la planilla, como antes (los costos por ingrediente que Finanzas sí tenga se siguen mostrando).
- Las jefas no ven nada de esto: la pantalla es solo de Sistema Fën. Nada de costos va a Cocina.

Archivos: cambian `vista-produccion.js` (detalle de la propuesta), `produccion.js` (`costear`: Finanzas primero), `finanzas.js` (`costosPropuesta`), `finanzas-motor.js` (`compararPropuesta`, `vendePorUnidad`, `resumenPropuesta`), `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). La carpeta `cocina/` no cambia. No cambian las reglas ni los scripts. Pruebas: `pruebas/sistemafen/sf-pantallas.test.js` (espresso ficticio, PC y celular; capturas en `pruebas/capturas/aprobacion-v0636/`) y `finanzas-f1c.test.js`. Abajo a la izquierda: **v0.63.6**.

### Lista de verificación v0.63.6
- [ ] Abajo a la izquierda dice **v0.63.6**.
- [ ] Producción → Desde Cocina → Revisar una receta que rinde gramos (ej. un espresso): arriba dice "+… % el costo del lote (neto)", con su (i).
- [ ] Se ven "Lote vigente" y "Lote propuesto" con sus gramos y el % del lote; el costo por gramo queda abajo, más chico.
- [ ] Si es de Cafetería (o está vinculada a un producto en Finanzas): aparece el aviso amarillo "Esta receta rinde en gramos pero se vende por unidad…" con su (i).
- [ ] La tabla de ingredientes muestra el costo neto de cada uno, vigente y propuesta; el que más cambia salta a la vista.
- [ ] Una receta que rinde unidades (ej. Hogaza): "Vigente · por unidad" y "Propuesta · por unidad" con su %, y arriba "el costo por unidad"; sin aviso.
- [ ] En el celular nada se sale de lado.

## Novedades de la v0.63.5: buscar por monto en Ventas B2B
**Para qué:** encontrar una orden, un folio o un abono sabiendo solo cuánto era (por ejemplo, la transferencia de $35.700 que llegó sin nombre).

**Cómo:** en las cajas de búsqueda de Ventas B2B, escribe **"$" al inicio** y el monto:
- **Exacto:** `$12.500`, `$12500`, `$ 12.500`. Los decimales no cuentan: `$12.500,5` = $12.500.
- **Rango (incluye ambos):** `$12.000-15.000` o `$12000 - 15000`.
- Sin "$" todo sigue igual que antes. Con "$" pero sin un monto claro (`$abc`, `$12.5`) avisa cómo escribirlo.
- Bajo la caja dice cuántos resultados hay, o "Sin resultados para $12.500.".

**Dónde y qué monto compara** (el mismo que muestra esa lista; solo totales, no las líneas de productos):
- **Órdenes → lupa de Facturación diaria / semanal / mensual:** el total de cada orden y el total del cliente (lo que suma sin folio). Si calza una orden, se ve su cliente solo con esa orden.
- **Cobranza:** el saldo y el total de cada folio, y lo que debe el cliente (en cobranza o en total).
- **Buscar:** el total de la orden. Busca en las órdenes **ya leídas** (por facturar, por cobrar, de los últimos 7 días y las que ya se mostraron en Buscar); no gasta lecturas. Para una más antigua: búscala primero por cliente o mes y después el monto. Explicado en su (i).
- **Conciliación → Ya conciliados:** el monto del abono, lo asignado a cada folio y lo que quedó a favor.
- Estado de cuenta no tiene caja de búsqueda: no cambia.

No hay lecturas nuevas: todo se filtra en memoria. Archivos: cambian `b2b.js` (`parseBusquedaMonto`, `calzaMonto`, `ordenesPorMonto`), `app.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). La carpeta `cocina/` no cambia. No cambian las reglas ni los scripts. Prueba nueva: `pruebas/sistemafen/b2b-v0635.test.js`. Abajo a la izquierda: **v0.63.5**.

### Lista de verificación v0.63.5
- [ ] Abajo a la izquierda dice **v0.63.5**.
- [ ] Ventas B2B → Órdenes → lupa de una tarjeta → `$` y el total de una orden: queda ese cliente con esa orden y dice "1 resultado de $…".
- [ ] Con un rango (`$10.000-20.000`) aparecen todas las órdenes entre esos montos, ambos incluidos.
- [ ] Un monto que no está: "Sin resultados para $…". Al borrar o escribir un nombre, la lista vuelve a como era.
- [ ] Cobranza → `$` y el saldo de un folio: queda ese folio.
- [ ] Buscar → `$` y el total de una orden reciente → aparece; la (i) explica en qué órdenes busca.
- [ ] Conciliación → Ya conciliados → `$` y el monto de una transferencia: queda ese abono.

## Novedades de la v0.63.4: la transferencia del sábado calza con el abono del lunes
**El problema:** una transferencia hecha el sábado 3 de octubre aparece en la cartola en línea el lunes 5. El cruce con el archivo de transferencias recibidas solo aceptaba el mismo día o ±1, así que ese abono quedaba sin "Transfirió: …" y sin reconocer al cliente por el RUT.

**Ahora:**
- El abono de la cartola puede tener fecha **desde 1 día antes** de la transferencia (la hora del banco puede caer en otro día) **hasta 3 días hábiles después**. No cuentan sábados, domingos ni feriados de Chile.
- Si hay varias posibles, gana la de **fecha más cercana**. Si empatan, la que calza con el nombre, como antes. Si sigue el empate, el abono queda sin transferencia y se revisa a mano.
- **Una transferencia nunca queda en dos abonos.** Se asigna primero el par más cercano de todos: el abono del lunes no le quita al del martes su transferencia del martes.
- **El archivo se reconoce por los encabezados de la tabla** (RUT Origen, Monto, Fecha…), en cualquier hoja y fila. Ya no depende del título ni del nombre de la hoja. Sirve igual para "Consulta transferencias recibidas" y para "Consulta Transferencia Electrónica". También acepta la fecha y la hora en columnas separadas.
- Los feriados están en `feriados-cl.js`: los de 2026 y 2027 más el 31 de diciembre (feriado bancario). Asistencia guarda sus feriados en su planilla, por eso van aparte. **Hay que agregar 2028 antes de que termine 2027.** Si falta un año, solo se saltan sábados y domingos.
- No hay lecturas nuevas: las transferencias siguen en fen-b2b (config/conciliacion) y se leen una vez con la conciliación, no por abono.
- Arreglo de paso: después de "Ya lo revisé" en un cliente que dejó de comprar, **Hoy** ya no muestra el aviso guardado de antes.

Archivos: nuevo `feriados-cl.js`; cambian `b2b.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). La carpeta `cocina/` no cambia. No cambian las reglas ni los scripts. Abajo a la izquierda: **v0.63.4**.

### Lista de verificación v0.63.4
- [ ] Abajo a la izquierda dice **v0.63.4**.
- [ ] Sube el archivo de transferencias recibidas del 1 al 9 de octubre: el mensaje dice cuántas trae y cuántas son nuevas.
- [ ] En Conciliación, el abono del lunes 5 de la transferencia del sábado 3 muestra "Transfirió: … · RUT …" (y el cliente, si su RUT está en Clientes).
- [ ] Si BancoEstado entrega el archivo con otro título ("Consulta Transferencia Electrónica"), igual se reconoce como transferencias (no como cartola).
- [ ] Dos abonos del mismo monto en días distintos no muestran la misma transferencia.

## Novedades de la v0.63.3: Sistema Fën ya no gasta la cuota de Cocina
**El problema:** fen-produccion es la base de las **tablets de Cocina** (su propia cuota gratis: 50.000 lecturas al día, sumando las tablets y Sistema Fën). Sistema Fën leía colecciones enteras cada vez: cada apertura de **Hoy** ≈ 196 lecturas (avisos de bodega: todo el stock, las 160 MP y la configuración; lo que espera de Cocina), cada vez que se abría **Producción** ≈ 463, **Calcular** la bodega ≈ 880 (120 días de Cocina, recetas, MP…), cada **Merma** ≈ 286 y **Costos** ≈ 277. Un día pesado de administración: **≈ 10.700 lecturas** de la cuota de Cocina. Ahora: **≈ 2.300**.

### Antes y después (lecturas en fen-produccion; prueba `cuota-v0633.test.js`, volumen de un año)
| Acción | v0.63.2 | v0.63.3 |
|---|---:|---:|
| Abrir la app en Hoy, 1ª vez (nada guardado; calcula la bodega) | 1.076 | **1.080** (una vez; después queda guardado) |
| Abrir la app en Hoy otra vez (dentro de 10 minutos) | 196 | **1** |
| Abrir Hoy pasados 10 minutos | 196 | **8** |
| Hoy → **Actualizar** (vuelve a leer; de los días de Cocina, solo lo que cambió) | 196 | **197** |
| Hoy cada 30 minutos durante el día, con Cocina anotando (máximo) | 196 | **33** |
| Volver a Hoy 10 veces en la misma apertura | 1.960 | **0** |
| Producción: 1ª vez / 5 veces | 463 / 2.315 | **90 / 110** |
| Producción → Bodega → **Calcular** (lo pides tú: vuelve a leer, salvo los días que no cambiaron) | 880 | **383** |
| Producción → Merma → Ver | 286 | **1** |
| Finanzas → Costos (1ª vez / 5 veces) | 277 / 281 | **0 / 0** (ya en memoria) |
| Finanzas → Resultados ×3 (merma del mes y conteos) | 127 | **0** |
| **Día pesado** (Hoy cada 30 min de 8:00 a 17:30, Producción ×5, Calcular ×2, Merma ×4, Costos ×5, Resultados ×3) | **10.652** | **2.300** (78 escrituras) |

La prueba falla si Hoy pasa de 40 lecturas por apertura (después de la primera) o si el día pesado pasa de 3.000.

### Qué cambió
- **Una sola memoria para Hoy, Producción y Finanzas** (`fs-memoria.js`): lo que leyó una pantalla no lo vuelve a leer otra. Lo que no es chico queda solo mientras la app está abierta; lo chico, también en este navegador.
- **Recetas, materias primas, configuración y stock de la bodega con "marca de cambio":** esas colecciones solo las escribe Sistema Fën (las reglas no dejan que Cocina las cambie). Cada vez que Sistema Fën guarda en una de ellas sube su marca en el documento `migracion/sf_cambios`. Los otros equipos leen esa marca (1 lectura cada 10 minutos) y vuelven a leer la colección **solo si cambió**. Igual se releen una vez al día, por si acaso.
- **Días de Cocina, solo lo que cambió:** cada guardado de Cocina lleva `actualizado.en` (hora del servidor; así lo hace Cocina desde siempre). Se leen una vez los 120 días de la bodega y después se pregunta solo `actualizado.en ≥ lo último visto` (una condición sobre un solo campo: **no hace falta crear índices**). Las llegadas anotadas en Sistema Fën (`dias/ADM_…`) ahora también llevan `actualizado.en`. Merma, conteos del cierre y Finanzas usan esos mismos días.
- **Hoy:** recetas y MP por aprobar con `limit` + `count()` (cuántas y las 3 primeras); avisos de bodega 10 minutos en memoria; la conexión ("eres administración") 10 minutos.
- **Calcular la bodega:** cuando lo pide Hoy (el último cálculo tiene más de 6 horas) usa lo guardado con su marca y los días que cambiaron (≈ 30 lecturas); cuando lo pides tú (Calcular) vuelve a leer recetas, MP, configuración y stock por si acaso, pero de los 120 días de Cocina solo los que cambiaron (≈ 380 en vez de ≈ 880).
- **Actualizar** (Hoy y Producción, con su (i)): vuelve a leer todo lo de Producción (por si algo cambió por fuera de Sistema Fën), salvo los días de Cocina, de los que pregunta solo lo que cambió.
- **Cuota agotada en fen-produccion:** el mismo letrero de la v0.63.2, con su (i): *"Se acabó la cuota diaria gratuita de la base de Producción/Cocina. No se perdió nada: lo guardado quedó guardado y lo que no, no entró. Vuelve a funcionar cerca de las 4:00 (hora de Chile). Las tablets de Cocina también quedan en pausa hasta esa hora (lo que anoten se guarda solo cuando vuelva). Gastos, Caja y B2B siguen funcionando."* Mientras tanto, los botones de Producción quedan desactivados. `fs-cuota.js` ahora sirve para cualquier base (`crearCuota`).
- **Configuración → Uso de la base hoy:** nueva línea con lo leído y escrito en fen-produccion desde este navegador.
- **Sin escuchas en vivo** sobre fen-produccion (no había ni hay).

**Cocina (fen-cocina) no cambia (sigue la v0.16.2).** Estimado de un día normal: ≈ 2.400–2.600 lecturas por tablet (abrir 1 vez + ≈ 2 reconexiones de más de 30 minutos ≈ 730 cada una: recetas 110, MP 160, stock, conteos, personas y **todos los días del área ≈ 365**; más ≈ 2 lecturas por cada cosa que se anota y 25 por cada cálculo de la bodega); con 5 equipos **≈ 12.000 al día**, más ≈ 2.300 de Sistema Fën en un día pesado: muy por debajo de 50.000. A vigilar: el escuchador de los días del área crece 1 documento por día (en 2 años ≈ 17.000 al día); si una tablet se reconecta muchas veces (se duerme o pierde el wifi a cada rato), cada reconexión de más de 30 minutos vuelve a leer todo.

**Dónde se guarda (fen-produccion; las reglas v1.7.0 ya lo cubren):** `migracion/sf_cambios` = `{ recetas, mps, config, stockmp (texto que cambia), en }` (solo administración); `actualizado: { por, en }` en `dias/ADM_{fecha}`. Cocina no lee ninguno de los dos y sigue leyendo todo igual. **Reglas, scripts y Cocina: no cambian.**

Por dentro: `produccion.js` (todo pedido a fen-produccion pasa por un envoltorio que cuenta, detecta la cuota y sube la marca; memoria con marca; días incrementales; `olvidarTodo` al entrar, salir o copiar la planilla), `fs-cuota.js` (`crearCuota(base)`; `produccion`), `fs-memoria.js` (nuevo), `firebase-produccion.js` (exporta `Timestamp`), `app.js` (letrero de Producción/Cocina, Actualizar, Uso de la base hoy), `b2b.js` (conexión y config en memoria), `finanzas.js` (usa la memoria compartida), `vista-produccion.js` (Actualizar), `estilos.css`. Archivos: todos los `.js` cambian al menos la versión; la carpeta `cocina/` no cambia.

Pruebas: nueva `pruebas/sistemafen/cuota-v0633.test.js` (7: Hoy ×20, Hoy ×10 en la misma apertura, Producción ×5 con Calcular y Merma, Finanzas, Actualizar + 10 minutos + llegada que borra la alerta + celular sin scroll lateral, **día pesado ≤ 3.000** con Hoy ≤ 40, sin escuchas en vivo). El Firestore simulado de fen-produccion compara horas por su valor y exporta `Timestamp`. `SF_DIR=<carpeta>` mide otra versión sin presupuestos. Capturas en `pruebas/capturas/cuota-v0633/`.

### Instalación v0.63.3 (unos 3 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.63.3.zip` (con la carpeta `cocina/`, que no cambia) → **Commit changes**. Espera 1 o 2 minutos y **recarga Sistema Fën en todos los equipos** (Ctrl+Shift+R en el PC). Nada en Apps Script, reglas ni Cocina.

### Lista de verificación v0.63.3
- [ ] Abajo a la izquierda dice **v0.63.3**.
- [ ] **Hoy** muestra lo mismo que antes (avisos de bodega, recetas y MP por aprobar de Cocina).
- [ ] **Configuración → Uso de la base hoy**: aparece la línea de **Producción/Cocina**. Abre Hoy, Producción y Finanzas → Costos varias veces: las lecturas de Producción/Cocina casi no suben.
- [ ] **Producción → Bodega → Calcular**: el cálculo se ve igual que antes.
- [ ] Anota una llegada en Producción → Bodega: el aviso de Hoy se actualiza al tiro.
- [ ] Aprueba (o cambia) una receta desde Sistema Fën en el PC: en el celular se ve a más tardar en 10 minutos (o con **Actualizar**).
- [ ] Cocina en las tablets funciona igual (no se instaló nada ahí).
- [ ] Mañana, en la consola de Firebase (fen-produccion → Firestore → Uso), las lecturas del día quedan muy por debajo de 50.000.

### Si algo sale mal
Si algo no calza (un aviso viejo, una receta que no aparece): **Actualizar** en Hoy o Producción; si sigue, cierra sesión de la base de Producción y vuelve a entrar (borra todo lo guardado). Para volver atrás, sube los archivos de la v0.63.2: todo funciona como antes; `migracion/sf_cambios` y `actualizado` en los días de Administración quedan sin estorbar.

## Novedades de la v0.63.2: la base de Gastos y Finanzas ya no se queda sin cuota
**El problema:** hoy fen-gastos dio **"Quota exceeded"**. El plan gratis de Firestore (Spark) da **50.000 lecturas y 20.000 escrituras al día** por proyecto, y cada pantalla de Gastos, Conciliación y Finanzas volvía a leer colecciones **enteras** cada vez que se abría: los 3.000 gastos, los 1.500 cargos de la cartola, los 500 vencimientos… Lo peor: **conciliar un cargo releía todo de nuevo** (≈ 4.900 lecturas por cargo) y **cada carga del SII** leía todos los gastos y documentos varias veces. Medido con el volumen de un año (3.000 gastos, 160 MP, 110 recetas, 400 documentos del SII, 40 obligaciones, 500 vencimientos, 1.500 cargos), un día pesado gastaba **≈ 598.000 lecturas** (12 veces la cuota). Ahora: **≈ 4.500 lecturas y 934 escrituras**.

**No se perdió nada:** cuando Firestore dice "cuota agotada" no guarda nada a medias (lo guardado quedó guardado y lo que no, no entró).

### Antes y después (lecturas en fen-gastos; prueba `cuota-v0632.test.js`)
| Acción | v0.63.1 | v0.63.2 |
|---|---:|---:|
| Abrir la app en Hoy (cada apertura) | 735 | **41** |
| Abrir la app en Hoy 20 veces | 14.700 | **820** |
| Gastos → Registrados | 4.082 | **11** |
| Ir y volver Registrados ↔ Hoy (5 veces) | 3.650 | **10** |
| Abrir Conciliación → Cargos | 8.588 | **54** (la 1ª vez con la v0.63.2: 1.939) |
| **Conciliar 100 cargos** (la lista se vuelve a armar después de cada uno) | **488.566** | **715** |
| Gastos → Cargas del SII | 4.085 | **15** |
| **Importar 2 cargas del SII** (40 facturas c/u) | **29.973** | **412** |
| Finanzas → Costos (abrir) | 615 | **9** (sin cambios de precios: no recalcula ni escribe) |
| Finanzas → Costos → Compras del SII | 1.143 | **12** |
| Finanzas → Márgenes | 338 | **5** |
| Finanzas → Resultados (estado de resultados) | 5.446 | **43** |
| Volver a abrir todas las pestañas de Finanzas (3 vueltas, 24 aperturas) | 22.041 | **27** |
| Abrir la app directo en Finanzas → Resultados | 5.447 | **55** |
| **Día pesado completo** | **≈ 598.000** | **≈ 4.500** (y 934 escrituras) |

Una sola vez (al abrir por primera vez la v0.63.2, y después cada 7 días): **≈ 3.700 lecturas** para armar los resúmenes (más ≈ 1.900 la primera vez que se abre Conciliación). Escrituras: conciliar 100 cargos son 430 (≈ 4 por cargo: el cargo, el gasto, lo aprendido y la marca para la planilla), como antes; lecturas, ≈ 7 por cargo (el cargo, lo aprendido y lo que se acaba de guardar). La prueba falla si una acción se pasa de su presupuesto o si el día pesado llega a 20.000 lecturas o 5.000 escrituras.

### Qué cambió
- **Todo fen-gastos pasa por `fs-gastos.js`** (antes cada módulo iba directo a `firebase-gastos.js`): Gastos, Conciliación de cargos, Finanzas, Previred, la copia a la planilla.
- **Memoria de la sesión:** una colección leída queda en memoria mientras la app está abierta y las consultas (`where ==`, `>=`, `<=`, `in`, `limit`) se responden desde ahí. Cambiar de pestaña no vuelve a leer. Cada 2 minutos como máximo (o justo después de guardar algo) se pregunta **solo lo que cambió**.
- **`_m` en cada escritura:** todo lo que se guarda desde Sistema Fën lleva `_m` (hora del servidor). "Lo que cambió" es `where('_m', '>', marca)` (la marca exacta, con nanosegundos, de lo último visto): **una condición sobre un solo campo**, usa el índice simple que Firestore crea solo. **No hace falta crear ningún índice compuesto.**
- **Resúmenes guardados (para abrir la app barato):** las colecciones grandes también quedan guardadas en pocos documentos: los gastos, **uno por mes** en `fin_gastos_mes/{AAAA-MM}` (con sus **totales del mes por ítem y por área**: n, neto y final), y el resto en `cache_paquetes/{colección}~todo~k` (índice en `cache_paquetes/{colección}`). Al abrir la app se leen esos pocos documentos + lo que cambió desde que se armaron + un **conteo** (si el conteo no calza —algo entró sin `_m`—, se lee todo y se arman de nuevo). Se rearman solos cada 7 días o con **Configuración → Uso de la base hoy → Releer todo de la base**. Los meses cerrados quedan en un solo documento cada uno.
- **Conciliación:** los candidatos ("Ya está en Gastos", facturas del SII, vencimientos) se buscan **en la memoria** (los gastos ya están ahí): conciliar un cargo ya no lee nada de nuevo, salvo lo que cambió. Es mejor que consultar por monto y fecha (eso costaría lecturas por cada cargo) y no pide índices.
- **Hoy:** lee los resúmenes (≈ 41 lecturas por apertura en vez de 735).
- **Costos:** el costo de los productos se recalcula **solo si cambió algo** (precios, recetas o configuración: se compara una huella) y escribe solo lo que cambió. Las recetas y MP de fen-produccion quedan 10 minutos en memoria (se vuelven a leer al aprobar o cambiar una receta desde Sistema Fën).
- **Conexión con fen-gastos:** el "estás conectado y eres administración" queda 10 minutos en memoria (antes, 2 lecturas más por cada pantalla y acción, una de ellas en la base de la caja).
- **Copia a la planilla:** se juntan los cambios de 20 segundos en una sola pasada (antes 5) y, si algo queda pegado, se reintenta cada vez más espaciado (1, 2, 4… hasta 30 minutos) en vez de cada minuto todo el día (eso solo podía gastar ≈ 2.000 lecturas por hora). El conteo de pendientes (11 consultas) se hace solo si el script no dijo que terminó.
- **Sin escuchas en vivo** (`onSnapshot`) sobre colecciones de fen-gastos (ya no había; las de B2B son de fen-b2b, que tiene su propia cuota).
- **Cuota agotada:** si Firestore responde `resource-exhausted` (en cualquier lectura o escritura), aparece arriba de cada pantalla el letrero (con su (i)): *"Se acabó la cuota diaria gratuita de la base de Gastos y Finanzas. No se perdió nada: lo guardado quedó guardado y lo que no, no entró. Vuelve a funcionar cerca de las 4:00 (hora de Chile). Caja, B2B y Cocina siguen funcionando."* La hora se calcula: medianoche de California pasada a hora de Chile (04:00 en octubre; 05:00 en enero; 03:00 en julio). Mientras tanto, los **botones de guardar de Gastos, Conciliación de cargos y Finanzas quedan desactivados** y nada intenta escribir. Se va solo al pasar la hora (o con la primera lectura que funcione).
- **Configuración → Uso de la base hoy** (con su (i)): lecturas y escrituras **hechas desde este navegador** desde el último reinicio de la cuota (con barra contra 50.000 / 20.000), lo que más usó, lo que está en memoria y **Releer todo de la base** (≈ 7.000 lecturas: solo si algo no calza). La cifra real de todos los equipos está en la consola de Firebase (Uso y facturación).

**Lo que lee Finanzas de las otras bases** (cada una con su propia cuota): fen-produccion ≈ 274 lecturas la primera vez (recetas, MP y configuración; después 10 minutos en memoria; antes ≈ 270 cada vez que se abría Costos o Márgenes: 1.656 en 3 vueltas, ahora 30); fen-b2b ≈ 4 (catálogo, una vez); fen-ventas (caja), los resúmenes del mes (los meses pasados quedan guardados en `fin_ventas_mes`). **Pendiente (otra entrega):** Hoy lee ≈ 445 documentos de fen-produccion en cada apertura (avisos de bodega y de Cocina): 20 aperturas son ≈ 8.900 lecturas de la cuota de Cocina. No es urgente (Cocina tiene su propia cuota de 50.000), pero conviene llevarlo al mismo esquema.

**Dónde se guarda (fen-gastos, solo administración; las reglas v0.1.0 ya lo cubren):** campo `_m` en cada documento que se guarda desde ahora; `fin_gastos_mes/{AAAA-MM}` (y `{AAAA-MM}~k` si un mes no cabe en uno): `{ col, grupo, parte, de, v, filas (texto), n, hasta, mes, totales { n, vigentes, neto, final, porItem, porArea } }`; `cache_paquetes/{colección}` (índice: `{ v, col, construido, total, partes, hasta }`) y `cache_paquetes/{colección}~todo~k`. Son copias: **no pasan a la planilla** y se pueden rearmar en cualquier momento. **Reglas de Firestore y scripts: no cambian.** (Opcional, no hace falta: en la consola se puede excluir del índice el campo `filas` de `fin_gastos_mes` y `cache_paquetes`.)

Por dentro: nuevos **`fs-gastos.js`** (memoria, `_m`, resúmenes, consultas en memoria, cuota y conteo de uso) y **`fs-cuota.js`** (puro: día de la cuota, hora de reinicio, texto del letrero, uso de hoy y estado "agotada"; lo usa la pantalla sin cargar Firebase); `firebase-gastos.js` (exporta `Timestamp`); `gastos-base.js` (conexión en memoria 10 min); `gastos-planilla.js` (juntar 20 s y esperar cada vez más); `finanzas.js` (huella del costeo, fen-produccion 10 min en memoria); `produccion.js` (`versionDatos`); `app.js` (letrero, botones desactivados, Uso de la base hoy); `estilos.css`; `finanzas.js`, `gastos-base.js`, `gastos-fs.js`, `gastos-cartola-fs.js`, `gastos-sii-fs.js`, `gastos-g3d-fs.js` y `gastos-planilla.js` importan `fs-gastos.js`.

Pruebas: nueva `pruebas/sistemafen/cuota-v0632.test.js` (9: hora de reinicio y texto; el día pesado paso a paso con presupuesto por acción —Hoy ×20, Registrados, Conciliación, conciliar 100 cargos, 2 cargas del SII, cada pestaña de Finanzas varias veces— y el total bajo 20.000 / 5.000; letrero de cuota agotada con botones desactivados en PC y celular; Uso de la base hoy). `CUOTA_INFORME=1` imprime la tabla; `SF_DIR=<carpeta>` mide otra versión sin presupuestos (así se midió la v0.63.1). El Firestore simulado de fen-gastos pone la hora del servidor al confirmar (como Firestore), compara horas, acepta `>`/`<`/`in`, exporta `Timestamp` y simula la cuota agotada; en `finanzas-f3b` corregir un gasto "a mano" lleva `_m` como lo deja la app. Capturas en `pruebas/capturas/cuota-v0632/`.

Archivos: nuevos `fs-gastos.js` y `fs-cuota.js`; cambian `app.js`, `firebase-gastos.js`, `gastos-base.js`, `gastos-planilla.js`, `gastos-fs.js`, `gastos-cartola-fs.js`, `gastos-sii-fs.js`, `gastos-g3d-fs.js`, `finanzas.js`, `produccion.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.63.2**.

### Instalación v0.63.2 (unos 3 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.63.2.zip` (con la carpeta `cocina/`, que no cambia) → **Commit changes**. Espera 1 o 2 minutos. **Recarga Sistema Fën en todos los equipos donde esté abierto** (PC y celular; Ctrl+Shift+R en el PC): un equipo con la versión anterior abierta guarda sin `_m` y los otros no ven ese cambio hasta el rearmado semanal (o "Releer todo"). Nada en Apps Script ni en las reglas.

Si hoy la cuota ya está agotada, la app muestra el letrero hasta cerca de las 4:00; la primera apertura después de esa hora arma los resúmenes (≈ 3.700 lecturas, una vez).

### Lista de verificación v0.63.2
- [ ] Abajo a la izquierda dice **v0.63.2**.
- [ ] **Hoy** abre como siempre (la primera vez tarda un poco más: arma los resúmenes).
- [ ] **Configuración → Uso de la base hoy**: aparecen las lecturas y escrituras de este navegador. Abre Gastos → Registrados, vuelve a Hoy y otra vez a Registrados: las lecturas casi no suben.
- [ ] **Conciliación → Cargos**: concilia un cargo; la lista se actualiza y en Uso de la base hoy suben unas pocas lecturas (no miles).
- [ ] **Gastos → Registrados**: el gasto recién conciliado aparece.
- [ ] **Finanzas → Costos, Márgenes y Resultados**: se ven igual que antes; volver a abrirlas no lee de nuevo.
- [ ] En el PC y en el celular, la tarjeta de Uso de la base hoy se ve bien.
- [ ] Mañana, en la consola de Firebase (fen-gastos → Firestore → Uso), las lecturas del día quedan muy por debajo de 50.000.

### Si algo sale mal
Si algo no calza (un gasto que no aparece): **Configuración → Uso de la base hoy → Releer todo de la base**. Si hay que volver atrás, sube de nuevo los archivos de la v0.63.1: todo sigue funcionando como antes (con el consumo de antes); `_m`, `fin_gastos_mes` y `cache_paquetes` quedan en fen-gastos sin estorbar.

## Novedades de la v0.63.1: cada abono de sueldo va al área de esa persona
**El problema:** una transferencia de sueldo a una persona (por ejemplo, a una trabajadora de Panadería) agregada como abono a la obligación libre "REMUNERACION LIQUIDO" tomaba el área (o el reparto) de la obligación: el sueldo de una sola persona quedaba repartido entre áreas. Solo con Gastos en la base nueva.

- **"Área de este abono"** (con su (i)) al agregar un abono a cualquier obligación libre, en **Conciliación → Cargos → Abono (sueldo)** y en **Vencimientos → ⋮ → Agregar abono a mano**: **una área** o **"Repartir en %"** (hasta 4 áreas, % enteros que suman 100; muestra el monto de cada parte). Un reparto crea **una línea de gasto por área** (por ejemplo, PAN 60 % y B2B 40 % de $650.000 → $390.000 y $260.000; los montos suman exacto).
- **La propuesta**, en este orden: **(a)** lo elegido la última vez para ese destinatario; **(b)** el área de **Previred** del trabajador, si el RUT o el nombre calza con uno de Cotizaciones Trabajadores (al menos 2 palabras del nombre, en cualquier orden, y un solo trabajador); **(c)** el área o el reparto de la obligación (como antes). Dice de dónde salió ("Propuesta: Recordado para este destinatario (…)", "Área de Previred: …", "Área de la obligación" o "Elegido por ti").
- **Destinatario:** con la cartola, el **RUT** o la **glosa** del cargo (la misma clave que lo aprendido: mayúsculas, sin tildes, números largos fuera); a mano, el campo nuevo **"Para quién"** (opcional, con sugerencias). Si no hay nada recordado con esa clave, se busca por el mismo nombre (lo de la cartola sirve a mano y al revés).
- **Queda recordado** al confirmar (si no tocaste el área de la obligación, no se recuerda). La próxima transferencia al mismo destinatario viene con el área ya puesta, pero el abono **sigue sin marcarse seguro**: igual lo confirmas tú (queda en "Para revisar").
- **Área B2B** (nueva en la lista de áreas: ítems, gastos, Registrar, cartola), con su (i) en Ítems → Área: *costos del canal B2B: atención de clientes, órdenes y despacho*. Las áreas siguen siendo una lista fija de la app (no hay una configuración aparte): BOL, PAN, CAF, PAS, ADMIN, VENTAS y B2B. Con la planilla (sin la base nueva), el script no acepta B2B.
- **Finanzas → Resultados → Clasificación (áreas):** B2B dice "Canal B2B (costo de canal): por ahora a Común" (con su (i)) y en el selector aparece "Canal B2B (costo de canal) · llega con F3" (gris). **Pendiente para F3:** el estado de resultados todavía no tiene la fila de costo de canal; mientras tanto B2B va a **Común**.
- **Registrados → Corregir** ya cambiaba el área; funciona igual con las líneas de un abono (cada línea por su lado, con su historial).

**Dónde se guarda (fen-gastos):** colección nueva **`abono_destinatarios/{id}`** (id `ad-rut-…`, `ad-txt-…` o `ad-nom-…`): `clave, nombre, areas [{ area, pct }], fuente, veces, ultimo { vencimientoId, obligacion, monto, fecha, origen, cargoId, por, en }, creado, version, historial`. **No pasa a la planilla** (es solo la memoria de la propuesta; los gastos sí, con su área). Cada abono del vencimiento suma `areas`, `fuenteArea` (recordado | previred | obligacion | elegido) y `destinatario { clave, nombre }`; sus gastos, `origenDetalle.destinatario` y `origenDetalle.areasAbono` ("PAN 60% · B2B 40%"), y la observación "Abono N · obligación · nombre". Deshacer el cargo no borra lo recordado (es solo una propuesta). **Reglas de Firestore y script: no cambian.**

Por dentro: nuevo **`gastos-abono.js`** (puro: `claveDestinatario`, `idDestinatario`, `recordadoDe`, `trabajadorDe`, `areasDeObligacion`, `areasPorDefecto`, `validarAreas`, `vistaConAreas`, `textoAreas`); `gastos-fs.js` (`agregarAbono` con `areas`/`destinatario`: sin áreas usa la propuesta; recuerda en la misma transacción; `datosAbono`); `gastos-g3.js` (el abono guarda su área); `gastos-cartola-fs.js` (el abono de la cartola pasa áreas, glosa y RUT; `lista` trae lo recordado y los trabajadores); `gastos-cartola.js` (área de los vencimientos abiertos); `gastos-g2.js` y `app.js` (B2B, "Área de este abono", "Para quién"); `finanzas-resultados.js`/`vista-finanzas-resultados.js` (B2B a Común, pendiente F3); `estilos.css`.

Pruebas: nueva `pruebas/sistemafen/gastos-v0631.test.js` (13: 4 unitarias —clave y normalización, Previred por nombre/RUT, orden de la propuesta, reparto exacto, B2B— y 9 de punta a punta: cartola → abono a "Lucía Vergara" (ficticia) con PAN 60 / B2B 40 → dos líneas y queda recordado; la siguiente cartola lo trae puesto y sin marcar seguro; "Martín Rojas" toma BOL de Previred; abono a mano con "Para quién" (lo recordado por el nombre → CAF); sin "Para quién" queda como antes; Registrados corrige la línea B2B; ítem nuevo con área B2B; la planilla con las áreas; 390). `sf-pantallas`: 2 pantallas nuevas (abono a mano con reparto y área del abono en la cartola) en los 3 tamaños. Capturas en `pruebas/capturas/gastos-v0631/`.

Archivos: nuevo `gastos-abono.js`; cambian `app.js`, `gastos.js`, `gastos-fs.js`, `gastos-g2.js`, `gastos-g3.js`, `gastos-cartola.js`, `gastos-cartola-fs.js`, `finanzas-resultados.js`, `vista-finanzas-resultados.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.63.1**.

### Instalación v0.63.1 (unos 3 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.63.1.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R). El script de Gastos sigue en v2.18.0.

### Lista de verificación v0.63.1
- [ ] Abajo a la izquierda dice **v0.63.1**.
- [ ] **Conciliación → Cargos**: en una transferencia de sueldo, **Abono (sueldo)** → elige REMUNERACION LIQUIDO → aparece **"Área de este abono"** con la propuesta. Pon el área de esa persona (o **Repartir en %**), escribe "Para quién" y agrega el abono.
- [ ] **Gastos → Registrados**: ese abono quedó en una línea por área (no repartido como la obligación).
- [ ] Con la próxima cartola, la transferencia a la misma persona trae el área ya puesta ("Recordado para este destinatario") y sigue en "Para revisar".
- [ ] Un trabajador que está en Previred y nunca se abonó: propone su área de Previred.
- [ ] **Vencimientos → ⋮ → Agregar abono a mano**: "Para quién" y "Área de este abono".
- [ ] (Si quieres usar B2B) **Gastos → Ítems → Nuevo ítem**: el área B2B está en la lista (y su (i)).
- [ ] **Finanzas → Resultados → Clasificación**: cuando haya gastos B2B, dice "Canal B2B (costo de canal): por ahora a Común".
- [ ] En el celular se ve bien (el reparto cabe en la pantalla).

### Si algo sale mal
Sube de nuevo los archivos de la v0.63.0: los abonos vuelven a tomar el área de la obligación. Lo guardado (`abono_destinatarios`, `areas`/`destinatario` en los abonos) queda en fen-gastos sin estorbar, y los gastos ya creados conservan su área. Un gasto con área B2B sigue válido en la base (con la v0.63.0, B2B no aparece para elegirlo en gastos nuevos).

## Novedades de la v0.63.0: lo que se paga por banco llega con la cartola
La forma de trabajar acordada: **todo lo que se paga por banco se registra desde la cartola; a mano solo el efectivo.** Los vencimientos dicen qué hay que **pagar**; la cartola lo **registra**. Si pagas y registras a mano igual, la cartola solo lo **confirma** ("Ya está en Gastos"). Solo con Gastos en la base nueva.

- **"Se paga por"** en cada obligación (Obligaciones → Editar, con su (i)): **Banco (cartola)**, **Efectivo** o **Tarjeta de crédito**. Las de antes, sin el dato, cuentan como banco (dice "Sin elegir todavía"). En la lista, un chip "Por banco" / "Efectivo" / "Tarjeta de crédito". También en **Clasificar obligaciones**, con su **propuesta** desde los últimos pagos: pagados con la cartola → banco; gastos en efectivo → efectivo; con tarjeta → tarjeta; sin historial → banco.
- **Vencimientos de banco:** en vez de "Pagar", el chip **"Se paga desde la cartola"** (con su (i)). En el menú del vencimiento (los tres puntos): **"Registrar pago a mano"** (o "Agregar abono a mano" en un sueldo) con el aviso: *el cargo va a llegar con la cartola; elige "Ya está en Gastos" para no duplicarlo*, y **Anular**. Los de efectivo y tarjeta (y las compras a crédito y facturas sin obligación) siguen con **Pagar**.
- **Espera su cargo (`esperaCargo`)**: los gastos del pago a mano de un vencimiento de banco y lo registrado a mano con "Transferencia o banco" quedan esperando su cargo; se apaga al vincularlos con su cargo (y deshacer lo vuelve a encender). En Registrados aparecen con el chip **"Espera cartola"**.
- **Hoy → "Esperan cartola: N"**: vencimientos de banco con más de **2 días** de atraso sin cargo, y gastos que esperan su cargo hace más de **5 días** (por la fecha de pago). Cada línea dice cuál y cuántos días; enlaces a **Vencimientos** y **Conciliación**, y la pregunta "¿Subiste la cartola o falta pagarlo?". Esos vencimientos ya no se repiten en "Pagos atrasados".
- **Registrar:** la forma de pago parte en **Efectivo**. Con **Transferencia o banco** aparece el aviso "Lo que pagas por banco llega con la cartola; regístralo desde Conciliación para no duplicarlo" (con enlace); si guardas igual, queda esperando su cargo.
- **Conciliación → Cargos:**
  - **Traspaso entre cuentas propias** (chequera ↔ cuenta corriente): no crea gasto; queda en el cargo como flujo (acción `traspaso`, detalle `{ movimiento: 'flujo', tipo: 'traspaso', nota }`), se aprende y se deshace como "Pago de tarjeta". En "No es gasto" ya no aparece "Traspaso entre mis cuentas".
  - **Ya está en Gastos**: además de lo al contado sin cartola, ofrece lo **pagado por banco a mano**, las **facturas del SII ya cargadas** sin cargo (desde 5 días antes de la factura hasta 60 después; también las a crédito sin vencimiento por pagar) y los **pagos de vencimientos** sin cargo. Orden: **monto exacto primero** (lo de efectivo al final), después el **más parecido** y la **fecha más cercana**. Cada uno con el **chip de su origen** y cuánto difiere ("Monto exacto · cargo 20 días después"). La propuesta automática usa lo mismo (segura si espera ese cargo y es el único del monto, o por el RUT).
  - **Ver detalle** del gasto propuesto: fecha (y fecha de pago), ítem, áreas y reparto, neto · IVA · total, tipo de monto, forma de pago, observación, archivos, cartola y **Origen**: "Registro a mano" (quién, cuándo), "Pago del vencimiento <obligación> <mes>" (a mano o con la cartola), "Carga del SII · XML con detalle (N líneas: …)" o "· Registro de compras sin detalle" (carga, fecha de carga, archivo, proveedor y RUT, folio), "Previred (certificado)", "Copiado desde la planilla antigua" (hoja, fila e ID) o "Cartola" (el cargo). Desde ahí, **Es este gasto**.
  - Al vincular: el gasto deja de esperar; una factura a crédito sin fecha de pago queda con la del cargo; el vencimiento pagado a mano queda con la cartola. Deshacer lo devuelve todo como estaba.
- **Registrados → Ver origen**: el mismo detalle para cualquier gasto (las líneas de la misma compra o del mismo pago van juntas).
- **Cómo trabajamos** (Finanzas): nueva parte **"Cómo se registran los pagos"** con las cuatro reglas.

**Agregados (pequeños, para que el flujo cierre):** chip "Espera cartola" en Registrados; "Fecha de pago" en el detalle; la carga del SII queda en cada gasto importado (también al reabrir una carga del historial); "Agregar abono a mano" para sueldos de banco; Agenda → un pago de banco abre "Registrar pago a mano" con su aviso; el menú del vencimiento se abre hacia abajo en el celular (no se sale de la pantalla); Clasificar dice cuántas obligaciones no tienen "Se paga por" guardado.

**Dónde se guarda (fen-gastos):** obligaciones `sePagaPor`; gastos `medioPago` (efectivo | banco), `esperaCargo` (true/false) y **`origenDetalle`** `{ tipo: mano | vencimiento | sii | cartola, por, en, … }` (vencimiento: `vencimientoId, obligacion, periodo, aMano | cartola, cargoId, abono`; SII: `formato, archivo, cargaId, docId, lineasDetalle`; cartola: `cargoId, descripcion, fecha, cuenta`). `origen` sigue siendo el texto de siempre (el script lo usa). Lo de antes, sin `origenDetalle`, se reconoce por sus campos (`origen`, `siiDoc`, `vencimientoId`, `previred`, `hoja`/`fila`, `creado`, el id). Cargo "Ya está en Gastos": `detalle.esperaban`, `conFechaPago`, `vencimientosLigados` (para deshacer). **Reglas de Firestore: no cambian.**

Por dentro: nuevo **`gastos-banco.js`** (puro: `sePagaPor`, `mapaSePaga`, `sePagaVenc`, `propuestaSePagaPor`, `esperanCartola`, `lineasEsperan`, `claseCandidato`, `candidatosGastos`, `rankear`, `propuestaGasto`, `resolverOrigen`, `resumenLineas`); `gastos-fs.js`: `sePagaPor` en los vencimientos, "Esperan cartola" en Hoy, `medioPago`/`esperaCargo`/`origenDetalle` al registrar, pagar y abonar, `detalleGasto(ids)`; `gastos-cartola.js`: `TRASPASO` y la propuesta con los candidatos nuevos; `gastos-cartola-fs.js`: traspaso, candidatos, vincular/deshacer con esperaCargo, fecha de pago y vencimiento; `gastos-g3.js` (`clasificacionDesdeForm` con `sePagaPor`), `gastos-g3d.js`/`gastos-g3d-fs.js` (Clasificar), `gastos-g2.js` (vistas), `gastos-sii-fs.js`/`sii.js` (origen de la carga), `vista-gastos-clasificar.js`, `vista-finanzas.js`, `app.js`, `estilos.css`.

Pruebas: nueva `pruebas/sistemafen/gastos-v063.test.js` (20: 6 unitarias y 14 de punta a punta: obligación de banco → chip; pago a mano con aviso → esperaCargo → Hoy "Esperan cartola" → la cartola lo propone primero con su origen → el detalle dice "Pago del vencimiento…" → confirmar apaga esperaCargo (y deshacer lo vuelve); factura XML pagada 20 días después → "Carga del SII · XML con detalle (2 líneas)"; CSV → "Registro de compras sin detalle"; traspaso sin gasto y aprendido; Registrar parte en Efectivo y avisa con banco; Ver origen; Cómo trabajamos; copia a la planilla con el script v2.18.0; 390 y PC). `sf-pantallas` revisa 7 pantallas nuevas (menú del vencimiento, pago a mano, Registrar por banco, Ver origen, Ya está en Gastos, su detalle y Traspaso) en los 3 tamaños. g2b, g2c, g3b y g3e: sus obligaciones que se pagan con "Pagar" ahora dicen `sePagaPor: 'efectivo'` (con la regla nueva, las de banco no tienen Pagar). Capturas en `pruebas/capturas/gastos-v063/` (PC y 390).

Archivos: nuevo `gastos-banco.js`; cambian `app.js`, `gastos.js`, `gastos-fs.js`, `gastos-g2.js`, `gastos-g3.js`, `gastos-g3d.js`, `gastos-g3d-fs.js`, `gastos-cartola.js`, `gastos-cartola-fs.js`, `gastos-sii-fs.js`, `sii.js`, `vista-gastos-clasificar.js`, `vista-finanzas.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.63.0**.

### Instalación v0.63.0 (unos 5 minutos)
**A. Sistema Fën v0.63.0** → GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.63.0.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).

**B. Script de Gastos v2.18.0 (opcional, recomendado)** → Apps Script de Gastos: reemplaza `BaseNueva.gs` y `Seguridad.gs` con los del zip `gastos-script-v2.18.0.zip` → Guardar → Implementar → Administrar implementaciones → lápiz → **Nueva versión**. El ping debe decir **2.18.0**. Con la v2.17.0 todo funciona igual; solo no aparecen en la planilla las columnas nuevas (SePagaPor, MedioPago, EsperaCargo).

### Lista de verificación v0.63.0
- [ ] Abajo a la izquierda dice **v0.63.0**; el ping del script de Gastos dice **2.18.0**.
- [ ] **Gastos → Obligaciones → Revisar y clasificar**: revisa "Se paga por" de cada una (la propuesta sale de sus pagos). Marca **Efectivo** las que pagas con plata en mano y **Tarjeta** las de tarjeta; Guardar o Aplicar propuestas.
- [ ] **Vencimientos**: los de banco dicen "Se paga desde la cartola"; los de efectivo, "Pagar". El menú (tres puntos) tiene "Registrar pago a mano" con su aviso.
- [ ] **Registrar**: parte en Efectivo; al elegir "Transferencia o banco" aparece el aviso.
- [ ] Sube la cartola: en un cargo que ya registraste a mano, "Ya está en Gastos" lo muestra primero con su chip; **Ver detalle** dice de dónde salió. Confírmalo.
- [ ] Un traspaso entre la chequera y la cuenta corriente: **Traspaso entre cuentas propias** (no crea gasto).
- [ ] **Hoy**: si algo de banco no tiene su cargo, aparece "Esperan cartola" con los días.
- [ ] **Registrados → Ver origen** en 2 o 3 gastos (uno a mano, uno del SII, uno de un vencimiento).
- [ ] En la planilla: **Obligaciones** tiene la columna SePagaPor y **Registro Gasto** MedioPago y EsperaCargo (al final), en lo nuevo.
- [ ] En el celular se ve bien (el menú del vencimiento se abre hacia abajo, sin salirse).

### Si algo sale mal
Sube de nuevo los archivos de la v0.62.0: vuelven "Pagar" en todos los vencimientos y desaparecen el traspaso, "Esperan cartola" y Ver origen. Lo guardado (`sePagaPor`, `medioPago`, `esperaCargo`, `origenDetalle`, cargos con `traspaso`) queda en fen-gastos sin estorbar (un cargo marcado "Traspaso" se ve como conciliado). El script: Implementar → versión anterior (v2.17.0); las columnas nuevas quedan en la planilla, sin estorbar.

## Novedades de la v0.62.0: Finanzas (F3 · paso 2): estado de resultados por segmentos y cierre de mes
Plan acordado (`finanzas-plan.md`, sección 1 y F3): el estado de resultados mensual **por área y total, en tres pisos**, el **cierre de mes** con su checklist y el mes **congelado**. Todo en neto. **No cambia ningún gasto.**

**Finanzas → Resultados → Estado de resultados** (ahora la primera parte; Clasificación pasa a `#finanzas/resultados/clasificacion`)
- **Mes** (meses de 2026; por defecto el anterior) y **Comparar con el mes anterior** (columnas del mes anterior y la variación). "Contra presupuesto" aparece gris: llega con Metas (F5).
- Columnas **Panadería, Bollería, Pastelería, Cafetería, Común y Total**. Filas:
  1. **Ventas netas** (por área que produce; ▼ abre por canal: Caja Barros Arana, Caja Ainavillo, B2B) − **costo directo de lo vendido** (receta × unidades al **costo del mes**; reventa a su costo de compra) − **costos de venta** (comisión de tarjeta, despacho) − **merma valorizada** (Producción → Merma, neto; el café de calibración va a Cafetería) = **Margen de contribución** ($ y % de ventas). Las ventas **sin asociar** van a Común sin costo directo (aviso).
  2. − **remuneraciones propias** del área − **otros fijos propios** − **depreciación** del área = **Margen del área**.
  3. Común: **remuneraciones comunes** (incluye el sueldo empresarial), **fijos comunes**, **depreciación común** → **Resultado operacional** (Total) − **financieros** (interés de las cuotas pagadas en el mes según la tabla de cada crédito + gastos tipo financiero) = **Resultado del mes**.
- **Cada cifra se toca** y muestra de dónde sale (gastos con **Ver en Gastos**, que abre Registrados con el mes y el ítem; productos vendidos; merma; interés del crédito; depreciación).
- **Fuera del resultado** (informativo): compras de MP y reventa, lo que ya está en el margen, capital de créditos (cuotas − interés), impuestos, inversiones, retiros, otros y **pagos de tarjeta** de la cartola.
- **Cuadratura con Gastos:** total de gastos del mes en Gastos = en el resultado + interés dentro de las cuotas + compras + en el margen + fuera + sin clasificar. Muestra la **diferencia** (debe ser $0) y los ítems **sin clasificar** con el enlace a Clasificación.
- **Comunes repartidos por causa** (vista secundaria, rotulada "solo para conversar"): **Claves de reparto** con bases por área (**m²**, **maquinaria kWh**, **horas**) o **% a mano** (suma 100), por tipo de común (remuneraciones, fijos, depreciación) y, si quieres, por ítem. Por defecto **sin repartir**. El total siempre es el mismo resultado operacional.

**Resultados → Cierre de mes**
- Revisiones automáticas del mes: **SII cargado** (alguna carga cubre hasta el último día), **ventas completas** (sin cajas abiertas ni cierres sin resumen), **Ainavillo registrando** (cuántos productos y cuánto; en 0 es solo **aviso**), **cartola conciliada** (sin cargos del mes por revisar), **conteo de bodega** en cada bodega (Producción y Cafetería) entre los **últimos 3 días del mes y los primeros 3 del siguiente**, **gastos clasificados** (0 sin tipo) y **productos vendidos sin asociar < 10 %**. Cada una con su (i) y "Revisar".
- **Cerrar mes** (desde el mes siguiente): si algo falta, solo con **"Cerrar igual" + motivo**. Guarda el **snapshot** `fin_cierres/{AAAA-MM}` con el estado de resultados completo, los **costos usados**, las revisiones, el motivo, quién y cuándo. Desde ahí el mes se ve **congelado**.
- Lo que cambie después en un mes cerrado (un gasto corregido, una factura atrasada) **no lo toca**: aparece como **"Ajustes de meses cerrados"** en el primer mes abierto siguiente (cálculo de hoy − snapshot − lo ya informado), con el detalle por fila y por gasto, y "Resultado del mes con ajustes". Al cerrar ese mes, el ajuste queda dentro de su snapshot y no se repite.
- **Reabrir**: se puede, pero no se recomienda (se explica); pide **motivo** y queda en `fin_cierres_hist` con el snapshot anterior.

**Agregados**
- **Conciliación → Cargos (base nueva): "Pago de tarjeta"**. El cargo **no crea gasto**: queda en el mismo cargo como movimiento de flujo (estado Conciliado, acción `pago_tarjeta`, detalle `{ movimiento: 'flujo', tipo: 'pago_tarjeta', tarjeta }`), igual que "No es gasto" vive en el cargo; se **aprende** (la próxima vez se propone y viene marcado) y se deshace como lo demás. Para el flujo de caja (F4).
- **Créditos → "Calcular la tasa desde la cuota"**: con monto, n° de cuotas y valor de la cuota (y la primera fecha) busca la **tasa mensual** del sistema francés (bisección + Newton, siempre converge), muestra la **anual equivalente** ((1 + i)^12 − 1) y arma la tabla.
- **Política de la tarjeta de crédito** (en Cómo trabajamos → Cómo se calcula): **compras con tarjeta = gasto al comprar** (por el SII); **pago de la tarjeta = fuera del resultado** (flujo); **mantención e intereses de la tarjeta = financiero** (se registran a mano en Gastos).

**Dónde se guarda (fen-gastos, solo administración):** `fin_cierres/{AAAA-MM}` `{ mes, estado cerrado|reabierto, filas, canal, info, cuadratura, detalle, avisos, costosUsados, checks, override, ajustes, cerradoPor, cerradoEn, version }`; `fin_cierres_hist` (solo agregar); `fin_config/claves` `{ bases { m2, kwh, horas }, porTipo, porItem, historial }`. Lee (solo lectura) ventas, costos, vínculos, merma y conteos de fen-produccion (`dias`), gastos, créditos, inversiones, cargas del SII y cargos de la cartola. **Reglas y scripts: no cambian.** Nada va a Cocina ni a Hoy.

Por dentro: nuevo `finanzas-eerr.js` (puro: `lineasGastosMes`, `creditosDelMes`, `depreciacionDelMes`, `armarEERR`, `cuadratura`, `pctDe`, `validarClaves`, `repartirComunes`, `ventanaConteo`, `checksCierre`, `fallas`, `armarSnapshot`, `yaInformado`, `ajusteDe`, `mesDeAjuste`, `juntarAjustes`, `mesesDelAnio`); nuevo `vista-finanzas-eerr.js` (Estado de resultados y Cierre de mes); `finanzas-resultados.js`: `tasaDesdeCuota`; `finanzas.js`: `leerCierres`, `cargosCartola`, `cargasSii`, `datosMes`, `conteosMes`, `cerrarMes`, `reabrirMes`, `historialCierres`, `guardarClaves`; `produccion.js`: `conteosEntre`; `gastos-cartola.js` / `gastos-cartola-fs.js`: `pago_tarjeta`; `app.js`: la opción en la cartola y `verGastos` para Finanzas.

Pruebas: nueva `pruebas/sistemafen/finanzas-f3b.test.js` (12: 6 unitarias —estado de resultados por piso y columna con info y cuadratura; reparto por causa que suma lo mismo; revisiones del cierre; snapshot y ajustes sin repetir; tasa desde la cuota ida y vuelta; pago de tarjeta en las reglas— y 6 de punta a punta con un septiembre ficticio: cifras exactas por piso y columna (resultado −$1.031.666), por canal, detalle, Ver en Gastos, comparar; pago de tarjeta sin gasto y aprendido; cierre con una revisión pendiente → cerrar igual con motivo → snapshot; luz corregida → septiembre congelado y ajuste −$10.000 en octubre; reparto con claves; tasa desde la cuota; reabrir; 390 y 768). `sf-pantallas` revisa 5 pantallas nuevas (estado de resultados por canal, detalle, comparar, repartido con claves, cierre) en los 3 tamaños; `finanzas-f1a` y `finanzas-f3a` cambian "Próximamente" y la ruta de Clasificación. Siguen pasando e2e (54), f1a/b/c, f2a/b, f3a, g3c/g3d/g3e, b2b-v018, hoy-v055 y sf-pantallas. Capturas en `pruebas/capturas/finanzas-f3b/` (PC y 390).

Archivos: nuevos `finanzas-eerr.js` y `vista-finanzas-eerr.js`; cambian `finanzas.js`, `finanzas-resultados.js`, `vista-finanzas-resultados.js`, `vista-finanzas.js`, `gastos-cartola.js`, `gastos-cartola-fs.js`, `produccion.js`, `app.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.62.0**.

### Instalación v0.62.0 (unos 2 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.62.0.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).

### Lista de verificación v0.62.0
- [ ] Abajo a la izquierda dice **v0.62.0**; Resultados abre en **Estado de resultados** y tiene **Cierre de mes**.
- [ ] Septiembre: la **cuadratura** da diferencia **$0**; el total de gastos = el de Gastos → Análisis (neto, septiembre).
- [ ] Toca 2 o 3 cifras (un fijo, la venta de Panadería): el detalle tiene sentido; "Ver en Gastos" abre Registrados filtrado.
- [ ] Ventas netas por área ≈ Márgenes → Margen por producto (mismo mes, costo del mes); ▼ por canal ≈ Reportes de caja y Análisis B2B.
- [ ] Intereses del mes = Créditos → Cuotas pagadas por mes.
- [ ] Conciliación → Cargos: marca un pago de tarjeta como **Pago de tarjeta** → no aparece gasto nuevo; sale en "Fuera del resultado".
- [ ] Créditos: prueba **Calcular la tasa desde la cuota** con un crédito que conozcas.
- [ ] Cierre de mes de septiembre: revisa las 7 revisiones; cuando estén, **Cerrar septiembre 2026**. Luego el estado de resultados de septiembre dice "Mes cerrado".
- [ ] Si quieres, Claves de reparto (vista secundaria) con tus m², kWh y horas.
- [ ] En el celular se ve bien (la tabla se desliza dentro de su caja, con el concepto fijo a la izquierda).

### Si algo sale mal
Sube de nuevo los archivos de la v0.61.0: Estado de resultados y Cierre de mes desaparecen. Lo guardado (`fin_cierres`, `fin_cierres_hist`, `fin_config/claves`, cargos con `pago_tarjeta`) queda en fen-gastos sin estorbar (un cargo marcado "Pago de tarjeta" se ve como conciliado).

## Novedades de la v0.61.0: Finanzas (F3 · paso 1): clasificar para el estado de resultados
Plan acordado (`finanzas-plan.md`, F3 pasos 1–3): antes de armar el estado de resultados hay que decir **qué es cada gasto**. Pestaña nueva **Finanzas → Resultados** con tres partes. **No cambia ningún gasto**: es una capa de Finanzas en fen-gastos. Todo en neto.

**Clasificación**
- **Paso 0 · Áreas de los gastos:** los códigos de área de tus gastos de 2026 (PAN, BOL, PAS, CAF, ADMIN, VENTAS…) con cuántas líneas y cuánto neto, y a dónde va cada uno: **área propia** (Panadería, Bollería, Pastelería, Cafetería) o **común** (sin repartir). Por defecto: las cuatro de producción propias, el resto común. Los prorrateados ya se guardan una línea por área (cada parte a su área); una línea antigua "PRORRATEADO" con PArea/PPct se reparte con esos % (dice "N de prorrateo").
- **Paso 1 · Tipo para resultados de cada ítem:** cada ítem con su **total neto 2026**, cuántos gastos y a qué áreas fue; la **propuesta** con su porqué y una lista para elegir. Tipos: compras de materias primas, compras de reventa (no son línea de gasto: van a la desviación), remuneraciones y gasto fijo (propio o común según el área), ya en el margen (comisión de tarjeta, despacho B2B), financiero (intereses, banco), cuota de crédito, impuestos (F29/IVA/PPM), inversión, retiro y otro fuera del resultado (**pide motivo**). Arriba: **"N de M ítems clasificados (X % del gasto 2026)"**. Marca las propuestas y **Aplicar propuestas**, o cambia una con la lista (se guarda al elegir). Filtros: sin clasificar, clasificados, distinto a la propuesta; buscador; **Historial** por ítem.
- **Propuestas:** por palabras del nombre (MATERIA PRIMA/INSUMO/HARINA/LECHE… → compras MP; REMUNERACION/SUELDO/COTIZACION/PREVIRED → remuneraciones; ARRIENDO/LUZ/AGUA/GAS/INTERNET/TELEFONO/CONTABILIDAD → fijo; COMISION TRANSBANK/TARJETA → en el margen; INTERES/COMISION BANCARIA/MANTENCION → financiero; PRESTAMO/CREDITO/CUOTA/FONDO ESPERANZA → cuota de crédito; IVA/F29/PPM/IMPUESTO → impuestos; INVERSION/EQUIPO/MAQUINARIA → inversión; RETIRO → retiro). **Lo que ya marcaste como subtipo INVERSIÓN en Gastos manda** (→ inversión); si el nombre no dice nada: subtipo FINANCIERO → cuota de crédito, PASIVO → impuestos, categoría FIJO → fijo. "Mantención/reparación" de un equipo o del local → fijo. Nada se guarda solo.
- Un ítem que mezcla cosas (por ejemplo "Mantención") se podrá cambiar **por gasto** más adelante; por ahora el tipo es por ítem.

**Créditos:** cada crédito con su **obligación de Gastos** (las que parecen crédito aparecen con "Anotar…"). **Calcular** (monto, tasa mensual %, n° de cuotas, primera cuota y, si quieres, la cuota del banco): sistema francés, interés = saldo × tasa al peso, capital = cuota − interés, **la última cuota ajusta**. O **Pegar la tabla del banco** (N°, fecha, cuota, interés, capital, saldo; tabulador o punto y coma; montos chilenos; avisa si algo no cuadra). La tabla marca **cada cuota pagada** con el vencimiento pagado de su obligación (el del mismo mes; si no, en orden): **interés → financiero, capital → fuera**. Lista con pagadas, interés, capital y saldo; **Cuotas pagadas por mes**; Editar, Archivar e Historial.

**Inversiones:** los gastos cuyo ítem es **Inversión** (todos los años de la base), con **vida útil** por defecto según el nombre (computación 36 meses, equipos 60, muebles 84, remodelación 120; se cambia y se guarda), desde el mes de la compra; **depreciación mensual = valor neto ÷ meses**. Tabla **por mes y área** (Panadería, Bollería, Pastelería, Cafetería, Común) del año elegido, con el área del gasto según el mapa.

**Dónde se guarda (fen-gastos, solo administración):** `fin_items/{ítem}` `{ item, clave, tipo, motivo, origen propuesta|manual, propuesta, fecha, por, version }` + `fin_items_hist` (solo agregar); `fin_config/resultados` `{ areasGasto { código: PAN|BOL|PAS|CAF|comun }, historialAreas }`; `fin_creditos/{id}` `{ nombre, obligacionId, obligacionNombre, modo frances|manual, monto, tasa, n, fechaPrimera, cuota, cuotaManual, tabla [...], nota, estado, version }` + `fin_creditos_hist`; `fin_inversiones/{gastoId}` `{ vidaUtilMeses, fechaInicio, nota, item, valorNeto, historial }`. Lee gastos, ítems, obligaciones y vencimientos (una vez al entrar; "Volver a leer"). **Reglas y scripts: no cambian** (fen-gastos v0.1.0 cubre colecciones nuevas solo para `admins`). Nada va a Cocina ni a Hoy.

Por dentro: nuevo `finanzas-resultados.js` (puro: `proponer`, `lineasArea`, `areasDeGastos`, `destinoArea`, `validarMapa`, `resumenItems`, `avance`, `armarClasificacion`, `cuotaFrancesa`, `tablaFrancesa`, `sumarMeses`, `numeroCL`, `fechaCL`, `parsearTabla`, `validarCredito`, `pagosDeObligacion`, `marcarPagos`, `creditoPorMes`, `vidaDefecto`, `inversiones`, `depreciacionPorMes`, `validarInversion`); nuevo `vista-finanzas-resultados.js` (las tres partes); `finanzas.js`: `leerResultados`, `guardarTipos`, `historialTipo`, `guardarAreasGasto`, `guardarCredito`, `archivarCredito`, `historialCredito`, `guardarInversion`; `vista-finanzas.js`: pestaña Resultados.

Pruebas: nueva `pruebas/sistemafen/finanzas-f3a.test.js` (11: 7 unitarias —propuestas; áreas con prorrateo; resumen y avance; francés con la última cuota que ajusta; tabla pegada; cuotas pagadas; depreciación— y 4 de punta a punta con gastos ficticios: 0 → 10 → 11 de 11 (100 %), otro fuera con motivo, cambio a mano e historial, mapa de áreas; crédito desde la obligación con 2 cuotas pagadas (interés $28.850, capital $154.510) y tabla manual; inversiones 60 → 120 meses y tabla por área; celular 390 y tablet 768). `sf-pantallas` revisa además las 5 pantallas nuevas (con el diálogo) en los 3 tamaños; `finanzas-f1a` cambia el texto de "Próximamente". Siguen pasando e2e (54), f1a/b/c, f2a/b, g3d/g3e, b2b-v018 y hoy-v055. Capturas en `pruebas/capturas/finanzas-f3a/` (PC y 390).

Archivos: nuevos `finanzas-resultados.js` y `vista-finanzas-resultados.js`; cambian `finanzas.js`, `vista-finanzas.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.61.0**.

### Instalación v0.61.0 (unos 2 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.61.0.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).

### Lista de verificación v0.61.0
- [ ] Abajo a la izquierda dice **v0.61.0**; Finanzas tiene la pestaña **Resultados**.
- [ ] **Paso 0:** aparecen tus códigos de área de 2026; revisa que ADMIN y VENTAS digan Común y las de producción su área → **Guardar áreas**.
- [ ] **Paso 1:** revisa las propuestas (sobre todo las de Inversión, Cuota de crédito y las "Sin propuesta"), corrige las que no calcen, marca y **Aplicar propuestas**. Meta: **100 % del gasto 2026**.
- [ ] El total neto de un ítem que conozcas = el de Gastos → Análisis (neto, 2026).
- [ ] **Créditos:** anota CREDITO PAC BANCO ESTADO y FONDO ESPERANZA (mejor con la tabla del banco pegada); las cuotas ya pagadas aparecen como "Pagada" con su interés y capital.
- [ ] **Inversiones:** están las compras que clasificaste como inversión; ajusta la vida útil de cada una y Guardar.
- [ ] En el celular se ve bien (sin moverse de lado).

### Si algo sale mal
Sube de nuevo los archivos de la v0.60.1: la pestaña Resultados desaparece. Lo guardado (`fin_items`, `fin_config`, `fin_creditos`, `fin_inversiones`) queda en fen-gastos sin estorbar.

## Novedades de la v0.60.1: todas las pantallas bien en celular, tablet y PC
Regla de Emmanuel: cada pantalla se ve bien en **celular (390 × 844)**, **tablet (768 × 1024)** y **PC (1280 × 900)**: sin moverse de lado, sin textos cortados ni botones encimados, tablas en tarjetas o con scroll propio y aviso, diálogos que caben y menús que bajan de línea. Se revisaron **todas las vistas, pestañas y los diálogos principales** con una prueba nueva y sus capturas. **Solo cambia cómo se ve** (CSS y algo de marcado): nada de lo que hace la app cambia.

**Lo que se arregló**
- **Producción → Bodega se movía de lado en el celular** (la página medía ~600 px): (1) las listas de materias primas con nombres largos ensanchaban sus filas ("Agregar crítica", "Llegó mercadería", "El café de la bitácora…"); ahora esas filas se acomodan (en el celular, un campo por línea y el botón a lo ancho) y una lista nunca es más ancha que su caja; (2) el texto oculto para lectores de pantalla de la columna "Quitar" se salía de la tabla. Pasa en las dos bodegas (Producción y Cafetería).
- **Ventas B2B → Estado de cuenta y Análisis** se movían de lado en el celular con un cliente de nombre largo en la lista "Cliente".
- **Tablet (768 px): el contenido caía debajo del menú lateral** (entre 761 y 819 px de ancho). Ahora el menú es más angosto y el contenido va a su lado; **Seguridad** muestra los equipos como en el celular (la tabla necesita 640 px).
- **Barras de pestañas** (Gastos, Ventas B2B, Ventas de caja, Producción → Bodega): bajan de línea en vez de esconder pestañas a la derecha (en el celular, la pestaña elegida —por ejemplo Registrar— quedaba fuera de la vista).
- **Filtros en pastillas** (Bruto/Neto/Sin IVA, forma de pago, períodos de Análisis y Reportes, áreas de Finanzas, "Mostrar" de la Agenda): en el celular bajan de línea; antes se cortaban a la derecha sin aviso.
- **Finanzas → Costos y Márgenes**: en el celular las partes van en dos columnas parejas (antes una por fila y de anchos distintos).
- **Gastos → Registrados**: el buscador se veía como un cuadro gigante en el celular.
- **Tablas con scroll propio**: sombra en el borde cuando hay más columnas a la derecha (o a la izquierda), primera columna fija en el celular, y cifras y campos con su unidad sin partirse ("20 kg", "6,5 kg"). **Ventas B2B → Productos** pasa a tarjetas en el celular (nombre, precio base, categoría y receta con su rótulo, y Editar/Archivar abajo).
- **Títulos con botón** ("Nueva obligación", "Nuevo ítem"…): el botón ya no se aprieta en dos líneas; si no cabe, baja.
- **Botones que son enlaces** ("Volver a Obligaciones", "Revisar y clasificar"): se ven como botón, sin subrayado.
- **Clasificar obligaciones**: la lista de tipo y el N° de cliente con el mismo estilo de los demás campos.
- **Configuración** (motivos de merma, tipos de leche…): en el celular cada nombre va con sus botones ↑ ↓ Quitar en la misma fila (antes quedaban sueltos debajo, pegados al siguiente).
- **Cifras en el celular**: si queda una sola en la última fila (Gastos: "Resto del mes"), ocupa el ancho en vez de dejar un hueco.

**Prueba nueva:** `pruebas/sistemafen/sf-pantallas.test.js` (4: celular, tablet, PC y sin errores de la página). Visita Hoy (y Agregar a la agenda), Agenda (mes, nuevo evento, etiquetas), Gastos (todas las pestañas con la base nueva, Pagar, Nueva obligación, Nuevo ítem, Clasificar, Base nueva), Conciliación (abonos y cargos), Ventas B2B (todas las pestañas, Por facturar abierto), Producción (Desde Cocina con una receta y dos materias primas por revisar, Bodega calculada en las dos bodegas, Merma, Configuración), Ventas de caja (cierres, anulaciones, reportes, merma y stock), Finanzas (todas las pestañas y partes), Configuración, Seguridad y Menú, en los 3 tamaños. Revisa: sin scroll de lado de la página, nada fuera de la pantalla (salvo dentro de una caja con scroll propio), contenido cortado, botones encimados, diálogos dentro de la pantalla y con scroll, y el contenido al lado del menú lateral. Capturas: `pruebas/capturas/sf-pantallas/<sección>-<celular|tablet|pc>.png` (147). Para una sola: `SF_VISTA=celular SF_SOLO=produccion`.

Archivos: cambian `estilos.css`, `vista-produccion.js` (clases de las filas de Bodega), `app.js` (tabla de Productos de B2B con rótulos), `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.60.1**. No cambian reglas ni scripts.

### Instalación v0.60.1 (unos 2 minutos)
GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.60.1.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R; en el celular, cierra y vuelve a abrir la pestaña).

### Lista de verificación v0.60.1
- [ ] Abajo a la izquierda dice **v0.60.1**.
- [ ] Celular: **Producción → Bodega** (Producción y Cafetería) ya no se mueve de lado; las tablas muestran una sombra a la derecha y se deslizan dentro de su caja.
- [ ] Celular: en **Gastos → Registrar** se ven todas las pestañas (en dos o tres líneas) y la elegida está marcada.
- [ ] Celular: "Bruto (con IVA) · Neto (+IVA) · Sin IVA" y la forma de pago se ven completos.
- [ ] Celular: **Gastos → Registrados**, el buscador es de una línea.
- [ ] Celular: **Ventas B2B → Productos** en tarjetas; Estado de cuenta y Análisis sin moverse de lado.
- [ ] Tablet (o la ventana del PC angosta, ~800 px): el contenido va al lado del menú, no debajo.
- [ ] PC: todo igual que antes.

### Si algo sale mal
Sube de nuevo los archivos de la v0.60.0: vuelve como estaba (no hay datos nuevos).

## Novedades de la v0.60.0: Finanzas (F2 · paso 2): margen de contribución, matriz volumen × margen y precio sugerido
Modelo acordado (`finanzas-plan.md`, sección 1): **margen sobre el precio NETO**; precio = costo directo + **margen de contribución objetivo del área**; lo indirecto entra a nivel de área, **nunca repartido por unidad**.

**Finanzas → Márgenes**, pestañas nuevas (las de la v0.59.0 siguen igual):
- **Margen por producto:** tarjetas **por canal** (total, Caja Barros Arana, Caja Ainavillo, B2B) y **por área**, cada una con venta neta, costo directo, costos de venta, **margen de contribución (MC $)** y **MC %**. Tabla por producto: unidades, precio neto prom., costo unit., MC unit., MC %, MC total y % del MC total; filtros por área y canal y orden (mayor MC, mayor/menor MC %, unidades, venta, nombre). **Sin costo o incompleto** (sin asociar, receta sin costo o con costo incompleto, reventa sin costo de compra) va **aparte**, no entra en totales ni %, y arriba dice la cobertura ("Con costo: 94,8 % de la venta neta"). Selector **Costo del mes / Costo de hoy** que dice qué costo se usó.
- **Volumen × margen:** por área, los productos con costo en cuatro grupos —**Estrellas**, **De volumen**, **Con potencial**, **Revisar**— con qué hacer en cada uno. Las **listas son lo principal**; al lado (en el celular, arriba) un gráfico de puntos numerados con los mismos productos.
- **Precio sugerido:** por área con margen objetivo, cada producto con costo: costo directo de hoy, **Caja** (sugerido con IVA redondeado, su neto; actual = neto promedio del período y precio de lista del catálogo, con diferencia % y **Bajo / OK / Sobre**) y **B2B** (sugerido neto contra el neto promedio). Muestra el **recargo equivalente** del margen.
- **Ajustes** (Ajustes de Finanzas: márgenes): **comisión de tarjeta** % por medio de pago (débito, crédito, otros) —vacía = **"Falta configurar"** (chip en la pestaña y aviso en Márgenes; en Hoy no aparece) y se usa 0 %—; **mezcla de medios de la caja** (solo si un mes no trae el dato); **despacho B2B** (% de la venta neta o $ por orden; 0 por defecto); **margen objetivo por área** (vacío por defecto; con su recargo); **redondeo** del precio con IVA de la caja ($10, $50 o $100). Historial de cambios.
- **Asociar productos → diálogo:** campo nuevo **Costo extra por venta, neto** (envases que no están en la receta: caja, bolsa, vaso), por cada venta del producto.

**Cómo se calcula** (todo neto; reglas puras en `finanzas-margenes.js`):
- **MC = venta neta − costo directo − costos de venta. MC % = MC ÷ venta neta.**
- **Costo directo:** receta → costo por unidad (Costos → Productos) × unidades (vendido × unidades por venta); reventa → costo de compra neto × unidades; + costo extra por venta × ventas. Recetas que rinden gramos se leen por kg.
- **Costo del mes** (por defecto): para cada mes del período, el último costo del historial (`costos_recetas_hist`) hasta el último día del mes; el mes en curso usa el de hoy; sin historial de ese mes, el de hoy (y se dice). El historial guarda cambios > 0,5 %. **Costo de hoy:** el último cálculo para todo el período. Márgenes usa el **último cálculo guardado** (abre Costos para recalcular).
- **Comisión de tarjeta (caja):** la empresa de pagos cobra sobre lo **pagado, con IVA**: comisión = venta neta × 1,19 × Σ(parte pagada con el medio × su comisión). La parte de cada medio sale de los **resúmenes de cierre** (`resumenes_caja.porMedio`, ya existía; efectivo = 0 %, transferencia y otros = "Otros"), por mes y sucursal; si un mes no lo trae (meses guardados antes de esta versión), la mezcla configurada; si tampoco, 0.
- **Despacho B2B:** % × venta neta, o $ por orden × órdenes válidas del mes repartido según la venta neta de cada producto B2B.
- **Matriz:** ejes = unidades vendidas y **MC unitario en $** (el eje clásico de la ingeniería de menú: lo que deja cada venta); cortes = promedio simple de unidades del área y MC unitario ponderado del área (MC total ÷ unidades). Igual o sobre el promedio cuenta como "alto".
- **Precio sugerido:** neto = costo directo de hoy ÷ (1 − margen objetivo − costos de venta %), así el MC % queda **justo** en el objetivo después de la comisión o el despacho (dividir por (1 − m) y además por (1 − comisión) deja el MC un poco bajo el objetivo). Costos de venta %: caja = comisión del período ÷ venta neta de la caja; B2B = el % de despacho (o despacho ÷ venta B2B si es por orden). Con IVA = neto × 1,19 **redondeado hacia arriba** al múltiplo elegido. Diferencia = (actual − sugerido) ÷ sugerido; **OK** dentro de ±5 %. Recargo = m ÷ (1 − m); margen = r ÷ (1 + r).

**Dónde se guarda (fen-gastos):** `costos_config/finanzas.margenes` `{ comision {debito, credito, otros}, mixCaja {…}, despacho {modo, valor}, margenObjetivo {PAN, BOL, PAS, CAF}, redondeo }` + `historialMargenes`. `fin_productos.costoExtraNeto`. `fin_ventas_mes` de la caja guarda además `porMedio` y el de B2B `ordenesValidas` (los meses ya guardados siguen sirviendo; "Volver a leer" les agrega el medio de pago). **Reglas y scripts: no cambian.** Nada va a Cocina.

Por dentro: nuevo `finanzas-margenes.js` (puro: `configMargenes`, `validarConfig`, `mediosDeResumenes`, `tasaComision`, `comisionDe`, `costoReceta`, `calcularMargenes`, `totalesMargen`, `ordenarMargen`, `cuadrante`, `matriz`, `precioSugerido`, `margenARecargo`, `recargoAMargen`, `comparar`, `tablaPrecios`, `conListas`, `costosVentaPeriodo`). `finanzas.js`: `ventasPeriodo` devuelve `porMes` (líneas, medios de pago, órdenes) y el catálogo; `guardarAjustesMargenes`. `finanzas-ventas.js`: `costoExtraNeto` en el vínculo. `vista-finanzas.js`: las cuatro pestañas.

Pruebas: nueva `pruebas/sistemafen/finanzas-f2b.test.js` (12: 6 unitarias —MC con unidades por venta, envase, reventa y sin costo aparte; comisión por medio de pago y despacho %/por orden; costo del mes desde el historial; cuadrantes; precio sugerido con IVA y redondeo, margen ↔ recargo; ajustes— y 6 de punta a punta con los datos de la f2a y costos ficticios: totales del margen, filtros y orden, Hoy sin el aviso; matriz por área; Ajustes → el aviso se va, el MC baja a $178.441 y aparece el precio sugerido; costo del mes vs de hoy; envase desde Asociar; celular 390). Todas las pantallas nuevas comprueban **sin moverse de lado** en PC y 390. Siguen pasando f1a/b/c, f2a, e2e (54) y hoy-v055. Capturas en `pruebas/capturas/finanzas-f2b/` (PC y celular 390).

Archivos: nuevo `finanzas-margenes.js`; cambian `finanzas.js`, `finanzas-ventas.js`, `vista-finanzas.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.60.0**.

### Instalación v0.60.0 (unos 2 minutos; incluye la v0.56.0–v0.59.0: si no tienes la v0.56.0, primero su paso 1, script de Producción v2.10.0)
1. **Sistema Fën v0.60.0**: GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.60.0.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).
2. Abre **Finanzas → Costos** una vez (recalcula el costo de los productos).
3. **Finanzas → Márgenes → Ajustes:** escribe la **comisión de débito, crédito y otros** (de la liquidación de tu empresa de pagos, sin IVA), el **despacho B2B** si lo quieres contar, el **margen objetivo** de cada área que ya tengas pensado y el **redondeo**. Guardar.
4. En **Ventas por producto**, mes anterior → **Volver a leer** (así ese mes guardado trae también el medio de pago).

### Lista de verificación v0.60.0
- [ ] Abajo a la izquierda dice **v0.60.0**.
- [ ] Márgenes muestra **Margen por producto**, **Volumen × margen**, **Precio sugerido** y **Ajustes** (con "Falta configurar" hasta poner la comisión).
- [ ] Margen por producto: la venta neta con costo + "sin costo o incompleto" = la venta neta de Ventas por producto.
- [ ] Revisa 3 productos que conozcas: costo unit. = el de Costos → Productos (× unidades por venta en cajas o packs).
- [ ] Pon la comisión en Ajustes: el aviso se va y los costos de venta de la caja dejan de ser $0.
- [ ] Mes anterior con "Costo del mes": dice cuántas líneas usaron el costo de ese mes.
- [ ] Volumen × margen: los grupos de cada área tienen sentido (las estrellas: las que más venden y mejor dejan).
- [ ] Con margen objetivo en un área, Precio sugerido muestra el precio con IVA redondeado y Bajo/OK/Sobre contra tu precio de lista.
- [ ] En **Hoy** no aparece nada nuevo; en la tablet de Cocina tampoco.
- [ ] En el celular se ve bien (sin moverse de lado; el gráfico arriba y las listas abajo).

### Si algo sale mal
Sube de nuevo los archivos de la v0.59.0: las pestañas nuevas desaparecen. Lo guardado (`costos_config/finanzas.margenes`, `costoExtraNeto`, `porMedio`) queda en fen-gastos sin estorbar.

## Novedades de la v0.59.0: Finanzas (F2 · paso 1): ventas por producto, área y canal
Plan acordado (`finanzas-plan.md`, F2): dos ejes, el **área que produce** (Panadería, Bollería, Pastelería, Cafetería: la de la receta del producto) y el **canal donde se vende** (caja Barros Arana, caja Ainavillo, B2B). Todo en **neto**. Este paso trae solo la venta; el margen (precio neto − costo directo) llega en el paso 2.

**Finanzas → Márgenes** (pestaña nueva):
- **Ventas por producto:** período **Este mes**, **Mes anterior** o **Elegir meses** (hasta 12). Arriba, la línea **"Asociado: 92 % de la venta neta del período"** con su barra y (i), y tarjetas **por canal** (venta neta total, Barros, Ainavillo, B2B, con su %) y **por área** (más "Sin asociar"). Tabla: producto, área, venta neta y cantidad en **Caja Barros**, **Caja Ainavillo** y **B2B**, **unidades**, **venta neta** y **precio neto promedio** (venta ÷ unidades; si una venta trae varias unidades, también "por venta"). La caja y B2B de la **misma receta van en una sola fila** (debajo dice de qué productos sale). Filtros por área (y "Sin asociar"), por canal y buscador; fila de total. En el celular, cada producto es una tarjeta.
- **Asociar productos:** los productos vendidos en el período **sin asociar, de mayor a menor venta** (para partir por los grandes), con su venta por sucursal y una **sugerencia**: primero el ID de receta que ya tienen en el catálogo de la caja (`idRecetaFen`) o en Productos de B2B (`idReceta`), si esa receta existe en Producción; si no, la receta de **nombre parecido**. **Confirmar** (la sugerencia), **Asociar…** (diálogo) o, de una vez, **"Confirmar los N del catálogo"**. Nada se asocia solo.
- **Diálogo:** "Se hace con una receta" (lista con **escribir para buscar**; primero la del catálogo y las parecidas), "Es reventa" (área y **costo de compra neto** a mano, con casilla "lo escribo con IVA") o "No es un producto" (propinas, cargos, ajustes: no suman). **Unidades por venta** (1; una "caja de 6" = 6 unidades de la receta). Nota opcional e **historial** de cada cambio. "Ya asociados" se pueden **Cambiar**.
- Avisos: **cajas abiertas** (no cuentan hasta cerrarse), **cierres sin resumen** (botón **Generar los que faltan**, igual que en Ventas de caja → Reportes) y B2B no conectada.

**De dónde salen las ventas y cuánto cuesta leerlas** (debajo del período: qué se leyó, "unas N lecturas", (i) y **Volver a leer**):
- **Caja:** el **resumen de cada cierre** (`resumenes_caja`, que ya trae cada producto con cantidad, bruto y neto, sin anuladas), no las ventas una por una; más las **cajas del mes** para saber si falta algún resumen o hay abiertas. Un mes ≈ 60 resúmenes + 60 cajas ≈ **120 lecturas**. Sucursal: "ainavillo" → Ainavillo; lo demás → Barros Arana.
- **B2B:** las **órdenes del mes** sin anuladas (una lectura por orden). Los precios de B2B ya son **netos** (neto de la línea; si falta, cantidad × precio neto).
- **Mes cerrado guardado:** desde el **día 8 del mes siguiente** (entonces el cierre de mes era del día 5 al 8; desde la v0.69.5 se cierra después de cargar el Previred del mes, a más tardar el 13), sin cajas abiertas ni cierres sin resumen, el mes se guarda en `fin_ventas_mes/{AAAA-MM}_{caja|b2b}`: la próxima vez cuesta **1 lectura por canal**. El mes en curso nunca se guarda. **Volver a leer** lo rehace (por ejemplo, si se corrigió una orden de un mes pasado).
- Además, una vez por sesión: el catálogo de la caja, el de B2B y la lista de recetas de Producción.

**Cómo se calcula:** venta neta de la caja = la del resumen (bruto ÷ 1,19 de cada línea, después del descuento); unidades = cantidad vendida × unidades por venta; área = la de la receta (en reventa, la elegida); "no es un producto" sale de la venta y de la tabla (se muestra aparte); **cobertura** = venta neta con vínculo (receta, reventa o "no es un producto") ÷ toda la venta neta del período. Los vínculos valen para todos los períodos.

**Dónde se guarda (fen-gastos, solo administración):** `fin_productos/{caja|b2b}_{productoId}`: `canal, productoId, nombre, tipo (receta|reventa|ignorar), receta, recetaNombre, reventa, costoReventaNeto, ignorar, unidadesPorVenta, area, origen (catalogo|nombre|manual), nota, fecha, por`. `fin_productos_hist/{autoId}` (solo agregar): `clave, accion, antes, despues, origen, nota, fecha, por`. `fin_ventas_mes/{AAAA-MM}_{canal}`: `mes, canal, lineas [{suc, productoId, nombre, cantidad, neto, recetaCatalogo, areaCatalogo}], neto, cierres|ordenes, creado, por`. Nada se escribe en la caja, en B2B ni en Producción (salvo "Generar los que faltan", que crea el resumen del cierre en fen-ventas como siempre). Nada va a Cocina. **Reglas y scripts: no cambian** (la lectura de fen-ventas y fen-b2b ya la usaba Sistema Fën; fen-gastos v0.1.0 cubre colecciones nuevas solo para `admins`).

Por dentro: nuevo `finanzas-ventas.js` (puro: `lineasDeResumenes`, `lineasDeOrdenes`, `juntar`, `conCatalogo`, `productosVendidos`, `tablaVentas`, `totales`, `cobertura`, `sugerirRecetas`, `proponer`, `armarVinculo`, `periodo`, `mesCerrado`, `guardable`, `docMes`). `finanzas.js`: `ventasPeriodo`, `recetasVenta`, `leerVinculos`, `guardarVinculo`, `confirmarCatalogo`, `historialVinculo`, `generarResumenesFaltantes`. `vista-finanzas.js`: pestaña Márgenes.

Pruebas: nueva `pruebas/sistemafen/finanzas-f2a.test.js` (10: 5 unitarias —líneas desde resúmenes y órdenes con neto desde bruto y anuladas fuera; agregación con unidades por venta, reventa, "no es un producto" y cobertura; sugerencias; vínculos; períodos y mes cerrado— y 5 de punta a punta con caja y B2B simulados: cierres en Barros y Ainavillo + órdenes B2B con una anulada → totales; confirmar los del catálogo y asociar a mano → cobertura 0 → 86,5 → 94,7 %; generar el resumen que faltaba; septiembre guardado y leído de ahí, "Volver a leer"; celular). `finanzas-f1a` cambia el texto de "Próximamente". Capturas en `pruebas/capturas/finanzas-f2a/` (PC y celular 390).

Archivos: nuevo `finanzas-ventas.js`; cambian `finanzas.js`, `vista-finanzas.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.59.0**.

### Instalación v0.59.0 (unos 2 minutos; si no tienes la v0.56.0, primero su paso 1: script de Producción v2.10.0)
1. **Sistema Fën v0.59.0**: GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.59.0.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).
2. Abre **Finanzas → Márgenes → Asociar productos** y toca **Confirmar los N del catálogo**; después asocia a mano los más grandes que queden (cajas o packs: unidades por venta; bebidas y otros comprados hechos: reventa; propinas y cargos: no es un producto).

### Lista de verificación v0.59.0
- [ ] Abajo a la izquierda dice **v0.59.0**.
- [ ] Finanzas muestra la pestaña **Márgenes**; "Este mes" lee las ventas (dice cuántos cierres, órdenes y lecturas).
- [ ] La venta neta de la caja del mes anterior calza con **Ventas de caja → Reportes** (neto, las dos sucursales) y la de B2B con **Ventas B2B → Análisis** (neto del período).
- [ ] **Confirmar los del catálogo** asocia los que ya tenían receta; la cobertura sube.
- [ ] Asocia a mano 3 o 4 de los grandes; revisa que una caja/pack use sus **unidades por venta**.
- [ ] La cobertura llega a más de 90 %.
- [ ] Mes anterior, la primera vez: abajo dice "Guardado en Finanzas (mes cerrado)"; la segunda vez dice "caja guardada · B2B guardado" y pocas lecturas.
- [ ] En la tablet de Cocina no aparece nada nuevo.
- [ ] En el celular se ve bien (sin moverse de lado).

### Si algo sale mal
Sube de nuevo los archivos de la v0.58.0: la pestaña Márgenes desaparece. Lo guardado en fen-gastos (`fin_productos…`, `fin_ventas_mes`) queda ahí sin estorbar.

## Novedades de la v0.58.0: Finanzas (F1 · paso 3): el costo directo de cada producto
Plan acordado (`finanzas-plan.md`): costo directo = materias primas al precio neto de la última compra + sub recetas encadenadas + insumos y envases + merma de proceso, que se actualiza solo y muestra flecha y %. Todo en **fen-gastos** (solo administración): nada va a fen-produccion ni a Cocina, y las jefas no ven costos.

**Finanzas → Costos → Productos** (pestaña nueva, la primera; el botón "Costos" abre aquí):
- Tabla de las **recetas aprobadas** de las cuatro áreas (sin sub recetas ni borradores): producto, **costo directo por unidad** (o por kg si la receta rinde gramos), flecha y % **contra el mes anterior** y **contra el último cambio**, fecha del último cambio y la marca **Incompleto** con su motivo. Buscador, filtros por área (Panadería · Bollería · Pastelería · Cafetería) y orden por nombre, costo o **mayor alza**.
- **Tocar un producto** abre su detalle: costo por unidad, costo del lote y lo que rinde, % contra el mes anterior y el último cambio; **desglose por ingrediente** (cantidad del lote, precio base por kg/l/un con su origen —SII con proveedor y folio, a mano o planilla— y fecha, costo con su cuenta, % del total); **sub recetas** con "Ver qué lleva" (sus ingredientes en la proporción que usa el producto, también anidadas); **insumos**; **merma de laminado**; e **historial** de cambios con su causa. Cada cifra tiene su (i).
- **Subió el costo de N productos** (arriba de la tabla): los que subieron más del % de aviso contra el mes anterior, uno por línea, con la causa y **Visto**.
- **Ajustes de Finanzas**: el % de aviso (por defecto **5 %**); cada cambio queda guardado.

**Cómo se calcula** (todo neto; motor nuevo `finanzas-motor.js`, que usa los cálculos de Cocina de la carpeta `cocina/` sin cambiarlos):
- **Materia prima en gramos:** gramos × precio por g. **Decisión g/ml:** si se compra por volumen (leche en litros) y la receta la pide en gramos, se usa **1 g = 1 ml** y el detalle lo marca "supuesto g = ml". Si se compra por unidad (huevos): gramos ÷ peso por unidad × precio por unidad (sin peso por unidad queda incompleto).
- **Materia prima en unidades:** unidades × precio por unidad; si se compra por peso y tiene **peso por unidad**, unidades × peso × precio por g.
- **Sub recetas** (la que tiene el ID de materia prima del ingrediente): costo de su lote ÷ peso de su lote, por gramo; en unidades, costo del lote ÷ porciones si rinde unidades (como baja Cocina: Croissant → 1 un de Masa), o costo por g × peso por unidad si rinde gramos. Encadenadas sin límite práctico; si una sub receta se usa a sí misma (ciclo) se marca incompleta con el ciclo. Masa madre o poolish sin receta: por sus componentes de la configuración de Panadería. El **pie de masa madre no suma** (se repone con la misma masa madre; Cocina tampoco lo descuenta).
- **Insumos:** por unidad si la receta rinde unidades (× lo que rinde = el lote); por lote si rinde gramos (igual que la bodega).
- **Merma de laminado** (productos de Bollería que llevan masa base): **(costo de la masa + costo del empaste) × merma % ÷ 100**, con la merma de Configuración de Producción → Bollería (`merma_laminado_pct`), la misma que usa la planificación para pedir más masas (masas = exactas × (1 + merma ÷ 100)); sin redondear a masas enteras, que es de la planificación y no del costo de una pieza.
- **Costo por unidad** = costo del lote ÷ porciones. Sin porciones: se usa 1 y queda incompleto.
- **Incompleto:** un ingrediente sin precio, sin contenido, que no está en el maestro, una unidad que no calza o una sub receta incompleta. El costo mostrado es solo lo que sí tiene costo.
- **Cuándo se calcula:** al abrir Finanzas → Costos ("Calculando…"; como máximo cada 2 minutos en el mismo equipo) y justo después de cada cambio de precio (a mano, compra del SII aplicada o confirmada). Se calcula en el navegador.
- **Historial:** cuando el costo por unidad cambia **más de 0,5 %** contra el último registrado (y el primer cálculo), con la causa: las materias primas que cambiaron de precio (con su %) o "cambió la receta". Nunca se borra.
- **Mes anterior:** el último valor del historial **antes del día 1** del mes actual (si el producto es nuevo este mes, su primer valor del mes).

**Hoy:** "Subió el costo de N productos" (origen Finanzas) cuando un producto completo subió más del % de aviso contra el mes anterior; abre Productos ordenado por mayor alza. "Visto" lo saca mientras el costo siga igual; si vuelve a subir, avisa de nuevo. Usa el último cálculo guardado.

**Producción → Merma:** se valoriza con este motor: recetas y sub recetas con su costo por unidad o por gramo, materias primas con su precio por g/ml/un. La planilla (op `costos_merma`) queda solo para lo que el motor no puede costear o está incompleto, y ahí dice **"costo de la planilla"**. El **café de la bitácora de turno** (calibración extra, botado, pruebas) y la calibración diaria se valorizan con el precio de la materia prima café de Cafetería.

**Revisión de datos:** grupo nuevo **Productos con costo incompleto** ("Ver costo" abre el detalle). Se marca revisado igual que lo demás.

**Dónde se guarda (fen-gastos):** `costos_recetas/{recetaId}`: `area, nombre, tipo, aprobada, costoUnit, costoTotal, unidad (un|g), porciones, incompleto, sinCosto, precios {mpId: precio por base}, preciosUsados (hash), recetaHash, ultimoHist, preciosHist, calculadoEn, fecha`. `costos_recetas_hist/{autoId}` (solo agregar): `receta, anterior, nuevo, pct, causa [{mp, nombre, antes, despues, pct}], recetaCambio, primero, incompleto, fecha`. `costos_config/finanzas`: `alzaAviso` e historial. `costos_alzas_vistas/{recetaId}`: el "Visto" con su costo e historial. **Reglas de fen-gastos: no cambian** (la v0.1.0 ya cubre colecciones nuevas solo para `admins`). **Scripts: no cambian** (la op `costos_merma` sigue, solo como respaldo).

Por dentro: nuevo `finanzas-motor.js` (puro: `crearMotor`, `costearTodo`, `costoMp`, `costoUnitario`, `planGuardar`, `referenciaMensual`, `ultimoCambio`, `filasProductos`, `alzas`). `finanzas.js`: `recalcularRecetas`, `recalcularTrasPrecio`, `leerProductos`, `guardarAjustes`, `marcarAlzaVista`, `alzasParaHoy`, `costosMerma`. `vista-finanzas.js`: Productos, detalle, alzas, ajustes y el grupo de Revisión. `produccion.js`/`vista-produccion.js`: merma con el motor y respaldo de la planilla. `app.js`: el aviso en Hoy.

Pruebas: nueva `pruebas/sistemafen/finanzas-f1c.test.js` (12: 5 unitarias —receta simple, g = ml e insumo por unidad; sub receta en gramos y en unidades, anidadas, peso por unidad; merma de laminado; incompletos y ciclo; umbral del historial, causa, referencia del mes, alzas y visto— y 7 de punta a punta con recetas ficticias de las cuatro áreas: Productos, detalle, cambiar un precio → flecha e historial con causa, Hoy con el alza de más de 5 % y "Visto", Ajustes, Merma con el motor y la planilla de respaldo, Revisión de datos y celular). `finanzas-f1a` cambia el número de pendientes de Revisión (suma los productos incompletos). Capturas en `pruebas/capturas/finanzas-f1c/` (PC y celular 390).

Archivos: nuevo `finanzas-motor.js`; cambian `finanzas.js`, `vista-finanzas.js`, `produccion.js`, `vista-produccion.js`, `app.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.58.0**.

### Instalación v0.58.0 (unos 2 minutos; primero la v0.57.0 o la v0.56.0 si no están: esta versión las incluye)
1. Si no instalaste la **v0.56.0**: su paso 1 (script de Producción v2.10.0). Nada más de scripts ni reglas.
2. **Sistema Fën v0.58.0**: GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.58.0.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).
3. Abre **Finanzas → Costos**: dice "Calculando…" y aparece **Productos**. El primer cálculo queda como punto de partida del historial (las flechas contra el mes anterior empiezan a tener sentido desde el próximo mes, o con el primer cambio de precio).

### Lista de verificación v0.58.0
- [ ] Abajo a la izquierda dice **v0.58.0**.
- [ ] Finanzas → Costos abre **Productos** con las recetas aprobadas de las cuatro áreas.
- [ ] Revisa 3 o 4 productos que conozcas (una hogaza, un croissant, una torta, un café): el desglose, las cantidades y los precios calzan.
- [ ] En un croissant aparece la **merma de laminado** con el % de la configuración de Bollería.
- [ ] Un producto con sub receta (masa madre, crema pastelera): "Ver qué lleva" muestra sus ingredientes.
- [ ] Los que dicen **Incompleto** salen también en Revisión de datos → Productos con costo incompleto; corrige lo que falte (precio, contenido, peso por unidad).
- [ ] Cambia un precio a mano (por ejemplo la harina): en Productos el costo sube, con flecha y %, y el detalle muestra en el historial "Harina … +X %". Si sube más de 5 %, aparece en **Hoy**; "Visto" lo saca.
- [ ] Producción → Merma: los costos salen del motor; lo que no, dice "costo de la planilla". El café de la bitácora aparece valorizado.
- [ ] En la tablet de Cocina no aparece nada nuevo (sin precios).
- [ ] En el celular se ve bien (sin moverse de lado).

### Si algo sale mal
Sube de nuevo los archivos de la v0.57.0: Productos desaparece, la merma vuelve a valorizarse solo con la planilla. Lo guardado en fen-gastos (`costos_recetas…`, `costos_config`, `costos_alzas_vistas`) queda ahí sin estorbar.

## Novedades de la v0.57.0: Finanzas (F1 · paso 2): el precio desde la última compra del SII
Regla acordada: el costo de cada materia prima o insumo usa el **precio neto de su última compra (SII)**, y se puede corregir a mano. Todo en **fen-gastos** (solo administración); nada va a fen-produccion ni a Cocina.

**Finanzas → Costos → Compras del SII** (pestaña nueva, con el número de precios por confirmar):
- Los productos de las facturas del SII (tipo **33 y 34**) de los **últimos 90 días**, agrupados por **proveedor + producto**: último precio neto por unidad facturada, fecha, folio, cuántas compras y su estado (**asociado a X** / **sin asociar** / **no es materia prima**). Las **notas de crédito** se muestran ("1 nota de crédito, no cambian el precio") pero no cambian precios. Buscador y filtros (Sin asociar · Asociadas · No son materia prima · Todas).
- **Asociar** (se hace una vez por proveedor y producto; se aprende para todas las facturas que vengan): la materia prima se elige con el selector que se escribe para buscar, con las de **nombre parecido primero**; **"Una unidad de la factura trae"** viene llenado leyendo la unidad o el nombre, y se confirma. Muestra en vivo el precio por kg/l/un y en cuánto queda la materia prima (y el % contra ahora). O **"No es materia prima"** (gas, servicios, despacho…). **Cambiar** una asociación se puede: queda su historial.
- **Precios por confirmar**: cuando la compra cambia el precio **más de ±40 %**, no se aplica solo. Muestra el precio actual y el de la factura, el % y la factura; **Confirmar** (nota opcional) o **Descartar** (motivo obligatorio). Nada se borra: queda confirmada o descartada, con quién y por qué.
- **Facturas sin detalle** (cargadas con el CSV del Registro de Compras): "Esta carga no trae el detalle de productos (sube el XML para actualizar precios)", con la lista.
- Botón **Revisar compras de los últimos 90 días**: revisa todo de nuevo. No repite nada (cada línea revisada queda anotada; solo se vuelve a mirar si cambia su asociación).

**Cuándo se revisa solo:** justo después de **importar** un archivo del SII en Gastos (base nueva), sin frenar la importación; abajo del "Importado: …" aparece "Finanzas: N precios actualizados · M por confirmar · K productos sin asociar". Si falla, solo avisa (la importación ya quedó) y se puede repetir con el botón.

**Cómo se calcula** (todo neto):
- **Contenido de una unidad facturada:** si la factura cobra por **KG, G, LT o ML**, una unidad trae 1 de eso (manda la unidad de la factura, no el nombre). Si no (UN, SACO, CJ, vacío), se lee el nombre: "HARINA SACO 25 KG" → 25 kg; "MANTEQUILLA" en KG → 1 kg; **"LECHE 1 LT X12" → una caja de 12 × 1 l = 12 l** (decisión: "X12" es un paquete de 12; si la factura cobra cada litro, corrígelo a 1 l al asociar); "250G X 40" → 10 kg; "VASOS X50" → 50 un. "30 UN" queda como dudoso (¿cobra el paquete o una?).
- **Precio de una unidad facturada:** PrcItem menos el descuento de la línea (DescuentoMonto ÷ cantidad); si no viene PrcItem, MontoItem ÷ cantidad. **Precio por g/ml/un** = eso ÷ contenido. **Precio neto de la materia prima** = precio por g/ml/un × el contenido de **su** unidad de compra (la materia prima conserva su unidad de compra; si no tenía contenido, toma el de la factura).
- **Cuándo se aplica:** el precio de la **planilla** es solo de partida (cualquier compra lo reemplaza). Uno **a mano** se respeta si es del mismo día o más nuevo que la factura. Uno del **SII** solo lo cambia una compra más nueva (mismo día: folio mayor). Si varias facturas actualizan la misma materia prima, **gana la más nueva** (empate: folio mayor). Si la factura viene en otra unidad (por ejemplo en kg y la materia prima se compra por unidades) no se aplica y se dice por qué. Si hay un "por confirmar" más nuevo, una compra más vieja no lo pasa por encima; una más nueva lo reemplaza (queda "reemplazada").
- Al aplicarse: origen **SII** con proveedor, folio y fecha (la fecha del precio es la de la factura) y una entrada en el historial ("Compra del SII: Proveedor F.123 (producto)").

**Materias primas:** el origen dice **"SII · Proveedor · F.folio"** y la fecha; la flecha con % contra el precio anterior funciona igual con los cambios del SII. Al cambiar un precio a mano, deja de decir SII.

**Hoy:** si hay precios por confirmar → pendiente **"Precios por confirmar (N)"** (origen Finanzas) que abre Compras del SII.

**Dónde se guarda (fen-gastos):** `costos_asoc/{rut__nombre[__c-código]}` (clave = RUT del proveedor + nombre normalizado + código si el XML trae CdgItem): `rut, proveedor, nombreItem, codigo, mp | ignorar, contenidoPorUnidad {cantidad, unidad g|ml|un}, creada {por, fecha}, actualizada, version`. `costos_asoc_hist/{autoId}`: cada cambio de una asociación (antes, después, quién, nota). `costos_sii_procesadas/{línea}`: cada línea de factura ya revisada (resultado y motivo). `costos_por_confirmar/{autoId}`: los cambios de más de ±40 % con su estado (pendiente, confirmada, descartada, reemplazada). `costos_sii_revisiones/{autoId}`: cada revisión. `costos_mp` suma el campo `sii {rut, proveedor, folio, fecha, linea, nombreItem}`. **Reglas de fen-gastos: no cambian** (la regla v0.1.0 `/{coleccion}/{id}` ya deja leer y escribir cualquier colección nueva solo a una cuenta en `admins`). **Scripts: no cambian.**

Por dentro: nuevo `finanzas-sii.js` (reglas puras: `normalizarItem`, `claveAsoc`, `contenidoDeLinea`, `precioUnitarioNeto`, `precioPorBaseLinea`, `lineasCompras`, `agrupar`, `sugerirMp`, `armarAsociacion`, `decidir`, `planPrecios`, `docAplicar`). `finanzas.js`: `leerCompras`, `preciosDesdeSii`, `preciosTrasImportar`, `guardarAsociacion`, `historialAsoc`, `resolverPorConfirmar`, `porConfirmarParaHoy`. `vista-finanzas.js`: pestaña Compras del SII. `sii.js`: después de importar con la base nueva, revisa los precios (sin esperar). `app.js`: aviso en Cargas del SII y el pendiente en Hoy. `finanzas-costos.js`: editar a mano deja `sii: null`.

Pruebas: nueva `pruebas/sistemafen/finanzas-f1b.test.js` (16: 5 unitarias —nombre y clave, contenido "SACO 25 KG", "1 LT X12", KG…; precio con descuento; sugerencias y asociación con historial; reglas de fecha, a mano, ±40 %, empate por folio, idempotencia; líneas de 90 días, notas de crédito y facturas sin detalle— y 11 de punta a punta con Gastos en la base nueva y el script de Gastos v2.17.0 de verdad: importar un XML ficticio con 3 productos y una nota de crédito → asociar 2, ignorar 1 → precios SII con historial; revisar otra vez no repite; precio a mano más nuevo no se pisa; segunda factura +68 % → por confirmar → Hoy → confirmar; descartar con motivo; celular). Siguen pasando finanzas-f1a (10), e2e (54), gastos g3a (8), g3c (12), g3d (12) y g3e (11), hoy-v055 (4) y b2b-v052 (5). Capturas en `pruebas/capturas/finanzas-f1b/` (PC y celular 390).

Archivos: nuevo `finanzas-sii.js`; cambian `finanzas.js`, `vista-finanzas.js`, `finanzas-costos.js`, `sii.js`, `app.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.57.0**.

### Instalación v0.57.0 (unos 3 minutos; primero la v0.56.0 si no está instalada)
1. Si todavía no instalaste la **v0.56.0**: haz primero su paso 1 (script de Producción v2.10.0). Esta versión la incluye: no hace falta subir la v0.56.0 por separado.
2. **Sistema Fën v0.57.0**: GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.57.0.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).
3. Finanzas → Costos → **Traer precios desde la planilla** (si no lo hiciste con la v0.56.0). Después, **Compras del SII**: asocia los productos que aparezcan (una vez cada uno). Si las facturas de los últimos 90 días se cargaron con el CSV, sube sus **XML** en Gastos → Cargas del SII para tener el detalle.

### Lista de verificación v0.57.0
- [ ] Abajo a la izquierda dice **v0.57.0**.
- [ ] Finanzas → Costos muestra la pestaña **Compras del SII** con los productos de las facturas de los últimos 90 días.
- [ ] Asocia la harina: la sugerida es la harina, el contenido dice 25 kg y el precio por kg calza con la factura. Al guardar, en **Materias primas** dice "SII · proveedor · F.folio".
- [ ] Marca un producto que no es materia prima (gas, flete): sale de "Sin asociar".
- [ ] Revisa 3 o 4 precios que conozcas contra su factura (neto, con descuento).
- [ ] Cambia un precio a mano y vuelve a presionar **Revisar compras**: ese precio **no** cambia (si la factura es de antes).
- [ ] Importa un archivo del SII en Gastos: abajo aparece "Finanzas: … precios actualizados".
- [ ] Si algo queda **por confirmar**, aparece en **Hoy** y se confirma o descarta en Compras del SII.
- [ ] En la tablet de Cocina no aparece nada nuevo (sin precios).
- [ ] En el celular se ve bien (sin moverse de lado).

### Si algo sale mal
Sube de nuevo los archivos de la v0.56.0: Compras del SII desaparece y los precios quedan como estaban (con origen SII si alguno se aplicó). Lo guardado en fen-gastos (`costos_asoc…`, `costos_sii_…`, `costos_por_confirmar`) queda ahí sin estorbar. La importación del SII en Gastos no depende de esto.

## Novedades de la v0.56.0: Finanzas (F1 · paso 1): Cómo trabajamos y el maestro de materias primas con costos
Sección nueva **Finanzas** en el menú (después de Ventas de caja). Título "Finanzas", "Análisis financiero de Fën". Pestañas **Cómo trabajamos** y **Costos** (abajo: "Próximamente: Márgenes, Resultados, Flujo de caja, Metas"). Sigue el plan acordado el 12-oct (`finanzas-plan.md`). **Las jefas no ven nada de esto:** todo se guarda en **fen-gastos** (solo administración); nada va a fen-produccion ni a Cocina.

**Cómo trabajamos** (fijo): los dos ejes (área y canal); los 5 pasos (todos los días · cierre del mes, día 5 a 8, con sus 4 condiciones: SII cargado, ventas de las dos sucursales, gastos conciliados, conteo de bodega → mes congelado · informes · decisiones · presupuesto del mes siguiente); reglas fijas (todo en neto, una sola fuente por dato, mes cerrado no se toca) y "Cómo se calcula": costo directo, margen de contribución (y su recargo equivalente), margen objetivo y del área, fijos propios y comunes, resultado en tres pisos, punto de equilibrio y qué queda fuera del resultado (capital de créditos, F29, inversiones → depreciación, retiros).

**Costos → Materias primas:**
- **Traer precios desde la planilla**: lee MP_maestro **con precios** (script de Producción v2.10.0, op nueva `mp_costos`, solo administración y solo lectura) y la lista de fen-produccion (nombres, tipo, estado). Primero muestra una **vista previa** (nuevas, cambian de precio, se respetan, con problemas, y el detalle) y no guarda nada hasta **Guardar N cambios**. Al volver a traer: solo cambia lo que vino de la planilla; lo que tiene precio **a mano** (o del SII, más adelante) **no se pisa** (sale en "Se respetan" con lo que dice la planilla).
- **Contenido** de una unidad de compra: "25kg", "saco 25 kg", "1 kg", "1lt", "1000ml", "6x1lt", "un", "kg"… → g, ml o unidades. "10un" es dudoso (¿el precio es por 10 o por 1?): se confirma solo si el `costo_por_gramo` de la planilla calza; si no, queda **sin contenido** y se avisa. "frasco", "saco" sin peso, "1/2 kg" o dos cantidades: sin contenido y aviso.
- **Lista** con buscador (sin tildes), filtros (Todas · Con problemas · Insumos · Sub recetas · Archivadas) y columnas: nombre, unidad de compra, contenido, precio neto, **precio por kg, l o un**, origen y fecha, y **flecha con %** contra el precio anterior (rojo si sube, verde si baja). En el celular, cada materia prima es una ficha.
- **Tocar una fila**: cambiar precio neto (o escribirlo **con IVA**: guarda precio ÷ 1,19), contenido (cantidad + kg/g/l/ml/unidades), peso por unidad (si se compra por unidad) y **motivo (obligatorio)**. Muestra el precio por kg nuevo y el % contra ahora, y el **historial** (fecha, precio, origen, motivo, quién).
- **Sub recetas**: aparecen con "se calcula de su receta" y no se editan (su costo llega con el motor de costeo, paso 3).
- **Impuesto adicional** (harina): se guarda, pero **no** se suma al costo (en la harina es IVA anticipado y se recupera).

**Costos → Revisión de datos** (con el número de pendientes en la pestaña): sin precio o precio 0 · contenido no reconocido · precio por kg/l/un de $0 o más de $100.000 · recetas **aprobadas** con ingredientes sin costo (no están en el maestro, archivados o sin precio) · unidades que no calzan (en unidades algo que se compra por peso; en gramos algo que se compra por unidad sin peso por unidad) · recetas sin porciones · sub recetas que se usan en otra unidad que la que rinden sin peso por unidad. **Corregir** abre el precio de esa materia prima; lo de recetas lleva a Producción. **Marcar revisado** la saca de la lista y vuelve sola si ese dato cambia; "Ver revisados" las muestra con quién y cuándo (y "Volver a la lista").

**Dónde se guarda (fen-gastos):** `costos_mp/{mpId}` (mismo id que MP_maestro / fen-produccion `mps`): `nombre, tipo (mp|insumo|sub_receta), unidadCompra, contenido {cantidad, unidad g|ml|un}, precioNeto, impAdicionalPct, ivaPct, precioPorBase, pesoPorUnidad, origen (planilla|manual|sii), fecha, por, estado (activa|archivada), anterior, contenidoProblema, updatedAt`. `costos_mp_hist/{autoId}`: cada cambio `{mp, precioNeto, contenido, precioPorBase, origen, motivo, fecha, por, anterior, en}` (nunca se edita ni se borra). `costos_revision/{id}`: `{clave, huella, revisado {por, fecha}, historial}`. `costos_cargas/{autoId}`: cada carga desde la planilla. **Reglas de fen-gastos: no cambian** (la regla v0.1.0 `/{coleccion}/{id}` ya deja leer y escribir cualquier colección nueva solo a una cuenta en `admins`).

Por dentro: nuevos `finanzas-costos.js` (reglas puras: `parsearContenido`, `resolverContenido`, `precioPorBase`, `porLectura`, `variacion`, `prepararCarga`, `edicion`, `revisarDatos`, `pendiente`), `finanzas.js` (datos en fen-gastos) y `vista-finanzas.js` (pantalla). `produccion.js`: `mpCostos()` (op `mp_costos`, pide script v2.10.0) y `mpsYRecetas()`. `app.js`: menú, vista `#finanzas`, `#finanzas/costos`, `#finanzas/costos/revision`.

Pruebas: nueva `pruebas/sistemafen/finanzas-f1a.test.js` (10: 4 unitarias —contenido, precio por base y variación, carga que respeta lo manual, revisión de datos— y 6 de punta a punta con el script v2.10.0 de verdad y una MP_maestro ficticia). Script: `pruebas/produccion2100` (37, 1 nueva). Siguen pasando e2e (54), hoy-v055 (4), gastos g3d (12) y g3e (11), b2b-v052 (5) y cocina-p1 (32). Capturas en `pruebas/capturas/finanzas-f1a/` (PC y celular 390).

Archivos: nuevos `finanzas-costos.js`, `finanzas.js`, `vista-finanzas.js`; cambian `app.js`, `produccion.js`, `index.html`, `estilos.css`, `config.js`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.56.0**.

### Instalación v0.56.0 (orden: script → Sistema Fën; unos 5 minutos)
1. **Script de Producción v2.10.0** (`produccion-script-v2.10.0.zip`): en el editor de Apps Script de Producción reemplaza **Seguridad** y **SistemaFen** → **Implementar → Gestionar implementaciones → editar → Nueva versión** (la dirección no cambia).
2. **Sistema Fën v0.56.0**: GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.56.0.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).
3. Finanzas → Costos → **Traer precios desde la planilla** → revisa la vista previa → **Guardar**. Después, **Revisión de datos**: es la revisión única de las materias primas y recetas.

### Lista de verificación v0.56.0
- [ ] Abajo a la izquierda dice **v0.56.0**. Configuración → Conexiones → Producción → "Probar": v2.10.0.
- [ ] En el menú aparece **Finanzas** entre Ventas de caja y Configuración (también en Menú del celular).
- [ ] **Cómo trabajamos** se lee bien (pasos, cierre con sus 4 condiciones, reglas fijas y Cómo se calcula).
- [ ] Costos → **Traer precios desde la planilla**: la vista previa muestra cuántas nuevas y con problemas; al guardar aparece la lista.
- [ ] La harina (saco 25 kg) muestra un precio por kg razonable. Revisa 3 o 4 que conozcas.
- [ ] Cambia un precio con su motivo: aparece "A mano", la flecha con % y el historial. Vuelve a traer desde la planilla: ese precio **no** cambia.
- [ ] **Revisión de datos**: revisa la lista; marca uno como revisado y comprueba que sale.
- [ ] En la tablet de Cocina no aparece nada nuevo (sin precios).
- [ ] En el celular se ve bien (sin moverse de lado).

### Si algo sale mal
Sube de nuevo los archivos de la v0.55.0: Finanzas desaparece del menú; lo guardado en fen-gastos (`costos_…`) queda ahí sin estorbar. El script v2.10.0 puede quedarse (solo suma una lectura).

## Novedades de la v0.55.0: Hoy, "Ventas de hoy en caja"
En **Hoy**, la tarjeta de **Ventas de ayer en caja** ahora tiene al lado **Ventas de hoy en caja**: lo vendido hoy hasta ahora, **bruto con IVA**, **sin las anuladas**, las **dos sucursales sumadas**.

- Si las dos sucursales vendieron hoy, abajo sale una línea chica: **"Barros $x · Ainavillo $y"**.
- Mientras calcula dice **"…"**; si todavía no hay ventas: **$0** y **"Sin ventas aún"**.
- Se calcula **al abrir Hoy** (no se actualiza solo): para ver lo último, vuelve a abrir Hoy.
- Hoy no tiene "Ver reporte": el reporte de Ventas de caja lee los cierres, y hoy aparece ahí recién cuando la caja se cierra. Ayer sigue llevando a su reporte.
- En PC: ayer y hoy lado a lado en la misma tarjeta, "Cajas abiertas ahora" al lado. En el celular: la tarjeta de ventas ocupa el ancho (ayer | hoy) y "Cajas abiertas ahora" va debajo.

**Cómo se calcula (y cuánto lee):** se usan las cajas que Hoy ya leía (no hay consultas de cajas nuevas). Por cada caja con fecha de hoy:
- **Cerrada y con resumen**: se usa su resumen del cierre (ya descuenta anuladas). La consulta de resúmenes de ayer ahora trae también los de hoy (`fecha in [ayer, hoy]`).
- **Abierta (o cerrada sin resumen)**: dos **consultas de agregación** de Firestore sobre `ventas` con `cajaId` de esa caja: `sum(total)` + `count()` de todas, y lo mismo solo de las `anulada == true`; se restan. Cada agregación cuesta **1 lectura por cada 1.000 ventas** (mínimo 1). Un día normal con una caja por sucursal: **4 lecturas**, no una por venta.
- Si la agregación fallara (por ejemplo, Firebase pide un índice), esa caja se suma leyendo sus ventas una vez (como el resumen), y Hoy sigue funcionando.

Por dentro: `Caja.ventasDeHoy(cajasHoy, resumenes)` en `caja.js`; `firebase.js` exporta `getAggregateFromServer`, `sum` y `count` (SDK 10.12.0, el mismo); `pintarVentasHoy` en `app.js` (no frena el resto de Hoy). Las reglas v1.3.0 ya permiten leer `ventas` con sesión: no cambian.

Pruebas: nuevas `pruebas/sistemafen/hoy-v055.test.js` (4: dos sucursales con una anulada y una caja cerrada con resumen → $18.500 y "Barros $7.500 · Ainavillo $11.000", 4 agregaciones; celular 390 sin moverse de lado; sin ventas → $0 · Sin ventas aún; una sola sucursal sin línea). El simulador de Firebase suma `getAggregateFromServer`. Siguen pasando `e2e` (54) y `b2b-v052`. Capturas en `pruebas/capturas/hoy-v055/`.

Archivos: cambian `app.js`, `caja.js`, `firebase.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.55.0**. No cambian reglas ni scripts.

### Instalación v0.55.0 (unos 3 minutos)
En GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.55.0.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).

### Lista de verificación v0.55.0
- [ ] Abajo a la izquierda dice **v0.55.0**.
- [ ] En **Hoy**, la tarjeta de ventas muestra **Ventas de ayer en caja** y **Ventas de hoy en caja** juntas.
- [ ] Con una caja abierta y alguna venta hoy: el monto de hoy coincide con el "Total ventas" de esa caja (bruto).
- [ ] Si se anula una venta y vuelves a abrir Hoy: el monto baja.
- [ ] Con las dos sucursales vendiendo: aparece "Barros $… · Ainavillo $…".
- [ ] Antes de la primera venta del día: "$0" y "Sin ventas aún".
- [ ] "Ver reporte" de ayer sigue abriendo el reporte de ayer.
- [ ] En el celular se ve bien (sin moverse de lado).
- [ ] Si Hoy dice "—" en ventas de hoy: abre la consola (F12) y avísame el mensaje (puede ser un índice que pida Firebase).

### Si algo sale mal
Sube de nuevo los archivos de la v0.54.1: Hoy vuelve a mostrar solo las ventas de ayer.

## Novedades de la v0.54.1: escribir para buscar en las listas de materias primas
Pedido de Emmanuel: donde eliges una materia prima o insumo de una lista, ahora también puedes **escribir el nombre**.

- Arriba de la lista hay un campo **"Escribe para buscar…"** (con una lupa). Al escribir, la lista queda solo con lo que coincide y se elige la primera.
- No importan las **tildes** ni las **mayúsculas** ("cafe" encuentra "Café en grano"), busca en **cualquier parte** del nombre y con **varias palabras en cualquier orden** ("t80 harina").
- Si no hay nada: dice **"Sin resultados"**, la lista queda completa y vuelve a lo que estaba elegido antes de escribir.
- **Escape** o borrar lo escrito: vuelve la lista completa (lo elegido se queda).
- Las opciones como "Elige una materia prima…" o "(no descuenta)" se quedan siempre.

**Dónde está (Producción → Bodega):** "El café de la bitácora de turno sale de", **Agregar crítica** (en las dos pestañas) y **Llegó mercadería** (en las dos pestañas). "Pasar a Cafetería" son casillas, no lista: no cambia. En Sistema Fën no hay otras listas de materias primas (las solicitudes de Cocina se aprueban con botones).

Por dentro: `buscador.js` nuevo (`conBuscador(select)`, `normalizar`, `coincide`, `filtrar`; copia exacta en Cocina v0.16.1). La lista (`<select>`) sigue mandando: lo que lee `select.value` no cambia. Se engancha cada vez que se pinta la Bodega (`conectarBodega`); no se duplica (`data-buscador`).

Pruebas: unitaria `pruebas/cocina/buscador.test.mjs` (4); punta a punta en `cocina-p1` (2 nuevas: Bodega de Sistema Fën y "Falta una materia prima" de Cocina, con y sin tildes, sin resultados, Escape, celular). Capturas en `pruebas/capturas/buscador-v054/`.

Archivos: nuevo `buscador.js`; cambian `vista-produccion.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.54.1**. No cambian reglas ni scripts.

### Instalación v0.54.1 (unos 3 minutos)
En GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.54.1.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R). Si no instalaste la v0.54.0, haz antes sus pasos (abajo).

### Lista de verificación v0.54.1
- [ ] Abajo a la izquierda dice **v0.54.1**.
- [ ] Producción → Bodega → Calcular: arriba de "El café de la bitácora de turno sale de" está "Escribe para buscar…".
- [ ] Escribe "cafe" (sin tilde): queda elegido el café.
- [ ] Escribe algo que no existe: dice "Sin resultados". Escape: vuelve la lista completa.
- [ ] En **Agregar crítica** y **Llegó mercadería** (pestañas Producción y Cafetería) también se puede escribir.
- [ ] En el celular se ve bien (sin moverse de lado).

### Si algo sale mal
Sube de nuevo los archivos de la v0.54.0 (el `buscador.js` que queda no se usa).

## Novedades de la v0.54.0: bodegas separadas (Producción y Cafetería) y avisos de bajo el mínimo
Va con **Cocina v0.16.0** (que incluye la v0.15.0), el **script de Producción v2.9.0** y las **reglas v1.7.0** de fen-produccion.

**La decisión:** el stock va por **bodega** (lugar físico), no por área. Hoy son dos:
- **Producción**: Panadería, Bollería y Pastelería (como hasta ahora: lo que cuenta un área vale para las tres).
- **Cafetería**: solo Cafetería.
- Más adelante se pueden sumar (por ejemplo, una por área con las harinas compartidas) cambiando solo el mapa área → bodega (`config/bodegas`), sin rehacer nada.

**Producción → Bodega:**
- Dos **pestañas**: **Producción** y **Cafetería** (con un número rojo si hay algo bajo el mínimo). Cada una con sus críticas, mínimo, envase, stock, "alcanza", último conteo, **Agregar crítica** y **Llegó mercadería**.
- Una materia prima puede ser crítica en **una o en las dos**, con su propio mínimo, llegadas, conteos y stock (la leche puede tener mínimo 10 l en Producción y 5 l en Cafetería).
- **El consumo va a la bodega de quien consume:** lo de Cafetería (ventas de la caja, calibración diaria y extra, café botado, pruebas, derramado, merma) baja **Cafetería**; lo de Panadería, Bollería y Pastelería baja **Producción**. Si una materia prima no es crítica en esa bodega, no se sigue ahí.
- **"Pasar a Cafetería"** (en la pestaña Producción, una vez): todo lo que existía quedó en Producción. Si algo era crítico solo por Cafetería (leche, café, vasos), márcalo y pásalo: se copia la crítica, el mínimo y el envase a Cafetería. Opcional: "Dejar de seguirlas en Producción". **Nada se borra**: los conteos y llegadas de antes quedan en Producción; en Cafetería parte con su primer conteo.
- Las llegadas que anotas aquí van a la bodega de la pestaña.

**Bajo el mínimo (cuando lo que hay es menor que el mínimo):**
- **Hoy:** un pendiente por materia prima: "**Bajo el mínimo: Leche (Cafetería)** — hay 3 l, mínimo 5 l". Lo que va a quedar bajo el mínimo en la semana (proyección) sigue en una línea aparte.
- **Cocina:** aviso arriba de la Bodega del área (solo su bodega) y una línea en Hoy / Bitácora de turno. Sin precios.
- **Correo** a ti y a las jefas de esa bodega, **uno por día por materia prima** (lo manda el script v2.9.0; si Cocina y Sistema Fën lo detectan los dos, llega uno).
- **Límite:** se revisa cuando se abre Sistema Fën (Hoy o Bodega) o Cocina, o se hace un conteo. No hay revisión automática de noche.

**Cafetería (lo que quedó pendiente de Cocina v0.15.0):**
- **Configuración → Cafetería:** "**Shots de la calibración diaria**" (vacío = 6) y "**Calibración automática desde**" (opcional), con su (i).
- La calibración diaria automática usa los **días con venta de Cafetería** en la caja (también de productos sin receta vinculada).
- **Merma:** lo derramado se ve con la etiqueta **Derramado**. El **Café de Cafetería** muestra la **calibración diaria** (shots y gramos, cuántos días editados, y por día: automática o editada) valorizada como **gasto de calibración** con el costo neto del café. El total de café la incluye.

**Por dentro (para el que venga):** `cocina/consumo.js` v0.16.0 (copia exacta de Cocina): `mapaBodegas`, `bodegaDe`, `idStock` / `deIdStock`, `controlEn` (la planilla solo vale para Producción), `movimientos(dias, mapa)` y `stock(mp, movs, eventos, bodega)` por bodega, `proyeccion(…, bodega)`, `stockAhora`, `bajoMinimo`, `claveAlerta`. Firestore: `stockmp/{mpId}` = Producción (sin migrar), `stockmp/CAF__{mpId}` = Cafetería (`{ bodega, mp, critica, seguridad, envase, estado }`); igual `conteosmp`. `produccion.js`: `calcularBodega` → `porBodega`, `pasarABodega`, `guardarControl(mp, x, bodega)`, `registrarLlegada(…, bodega)`, `alertasBodega` (con bodega, hay y mínimo) y `avisarBajos` (script `stock_alerta`, recuerda en el equipo lo pedido hoy).

Pruebas: unitarias nuevas `pruebas/cocina/bodegas.test.mjs` (8: ruta del consumo por bodega, stock por bodega, alerta, clave del correo, lo existente = Producción, ids); script `pruebas/produccion290` (36, 4 nuevas: permisos de la tablet por bodega, uno por día, destinatarios, calibración a CAF_registros); punta a punta en `cocina-p1` (4 nuevas: dos pestañas, Cafetería solo ve y cuenta Cafetería, Panadería solo Producción, venta en la caja → aviso en Cocina + Hoy + un correo; Merma y configuración). Capturas en `pruebas/capturas/bodegas-v016/` (PC y celular).

Archivos: cambian `produccion.js`, `vista-produccion.js`, `app.js`, `cocina/consumo.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). Abajo a la izquierda: **v0.54.0**.

### Instalación v0.54.0 (orden: reglas → script → Sistema Fën → Cocina)
1. **Reglas de fen-produccion v1.7.0** (archivo `firestore-produccion.rules` del zip de Cocina v0.16.0): consola de Firebase → **fen-produccion** → Firestore Database → **Reglas** → pegar → **Publicar**.
2. **Script de Producción v2.9.0** (`produccion-script-v2.9.0.zip`): Seguridad y SistemaFen → **Nueva versión** de la implementación (la dirección no cambia). Ejecuta `probarSistemaFenProduccion` una vez y acepta el permiso de correo. Opcional: propiedad **`ALERTAS_ADMIN`** con tu correo.
3. **Sistema Fën v0.54.0**: GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → todos los archivos del zip `sistema-fen-v0.54.0.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).
4. **Cocina v0.16.0** (`fen-cocina-v0.16.0.zip`, repo `fen-cocina`). Recarga las tablets.
5. En Sistema Fën → Producción → Bodega → pestaña **Cafetería**: marca sus críticas con su mínimo (o "Pasar a Cafetería" desde la pestaña Producción). Después, el primer **conteo** en la tablet de Cafetería.

### Lista de verificación v0.54.0
- [ ] Abajo a la izquierda dice **v0.54.0**. Configuración → Conexiones → Producción → "Probar": v2.9.0.
- [ ] Producción → Bodega → Calcular: pestañas **Producción** y **Cafetería**. En Producción están las críticas de siempre.
- [ ] Pestaña Cafetería: agrega la leche con su mínimo. Aparece "Falta conteo".
- [ ] Tablet de Cafetería → Bodega: solo aparece lo de Cafetería; cuenta la leche.
- [ ] Con algo bajo el mínimo: aparece en **Hoy** ("Bajo el mínimo: … (Cafetería) — hay …, mínimo …"), en Cocina arriba de la Bodega, y llega **un** correo.
- [ ] Configuración → Cafetería: "Shots de la calibración diaria" con su (i).
- [ ] Merma → Ver: lo derramado dice **Derramado**; el Café de Cafetería muestra la calibración diaria con su costo.

### Si algo sale mal
Sube de nuevo los archivos de la v0.53.0: lo nuevo (`stockmp/CAF__…`, `config/bodegas`) se ignora y todo vuelve a contar como una bodega común.

## Novedades de la v0.53.0: Gastos, el neto exacto de la factura del SII y el aviso "SII sin cargar"
Solo con Gastos en la base nueva (con la planilla nada cambia).

- **El neto de la factura, exacto.** Cuando una factura del SII completa el vencimiento de una obligación **según documento** (internet, gas, teléfono), el vencimiento guarda además sus montos: **neto, IVA, exento, otros impuestos** (impuesto adicional, harina), **total** y tipo de documento. Al pagarlo (con **Pagar** o confirmando el cargo en la **cartola**), el gasto queda con el **neto de la factura** (no el total / 1,19) y monto final = lo pagado. Igual que al importar una factura normal del SII: el neto es el "Monto neto" de la factura (el exento no se suma al neto).
  - **Si pagas otro monto** (parcial o distinto del total): el neto se calcula en la misma proporción (redondeado) y la observación del gasto dice "Neto proporcional a la F.… (pagado $… de $…)".
  - **En Pagar**: arriba dice "Neto $… · IVA $… · Exento $… · Total $… — de la factura N° …" (con su (i)) y **no aparecen los chips de Tipo de monto** (no hace falta elegir). El desglose de abajo sigue al monto que escribas.
  - Una factura que va a **Documentos sin obligación** guarda sus montos y los lleva al vencimiento al asignarla.
  - **Vencimientos antiguos** (completados antes de esta versión, sin esos montos), boletas y Previred: igual que antes. Las **notas de crédito** no completan vencimientos (siguen como gasto negativo al importar): no cambian.
- **Aviso "SII sin cargar"**, en **Hoy** (Pendientes de Gastos) y arriba de **Gastos → Cargas del SII** (con su (i)); los dos llevan a Cargas del SII:
  - si la última carga del SII (por fecha de carga, sin contar las quitadas) es de hace **más de 7 días**: "Cargas del SII: la última fue hace N días (dd-mm). Sube las compras del SII.";
  - desde el **día 5** del mes, si ninguna carga tiene documentos del **mes anterior** (su período de documentos toca ese mes): "Falta cargar el SII de <mes>" (en enero, "diciembre <año>").
  - Si no pasa ninguna de las dos, no hay aviso. Se va solo al subir el archivo que falta.

Por dentro: `gastos-g3.js`: `montosSii` (lo que `completarDocumento` guarda en `documento` de tipo sii: `neto`, `iva`, `exento`, `otroImpuesto`, `total`, `tipoDoc`, `esHarina`), `netoFactura(doc, montoPagado)` y `conNetoSii(lineas, doc, monto)` (reparte el neto entre las líneas por área según su monto; la suma es exacta). `gastos-g3d.js → lineasDelPago` (que usan Pagar y la cartola) los aplica cuando el documento trae esos montos, siempre como bruto. `sii.js` envía exento, otros impuestos y harina de las facturas que van a un vencimiento; `gastos-sii-fs.js` los guarda (también en la bandeja: `montosSii`). Regla del aviso: `avisosSii(cargas, hoy)` en `gastos-sii.js` (pura, con pruebas); `gastos-sii-fs.js → avisoCargas()` lee solo `sii_cargas`; `gastos.js → pendientesBase()` agrega `{ clave: 'sii_sin_cargar', avisos }`.

Pruebas: nueva `gastos-g3e` (11: 4 unitarias —neto igual al total, distinto, sin documento, reparto por área; aviso con bordes de mes, febrero y año nuevo— y 7 de punta a punta: factura con exento → vencimiento, pago con la cartola y con Pagar, aviso en Hoy y en Cargas del SII que se va al subir). Vuelven a pasar gastos g1, g2, g2b, g2c, g3a, g3b, g3c, g3d, e2e (54) y b2b-v052. Capturas en `pruebas/capturas/gastos-v053/`.

Archivos: cambian `app.js`, `gastos.js`, `gastos-fs.js`, `gastos-g3.js`, `gastos-g3d.js`, `gastos-sii.js`, `gastos-sii-fs.js`, `sii.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.53.0**. **No cambian** reglas de Firestore ni scripts (el de Gastos sigue en v2.17.0).

### Instalación v0.53.0 (unos 3 minutos)
En GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → arrastra todos los archivos del zip `sistema-fen-v0.53.0.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).

### Lista de verificación v0.53.0
- [ ] Abajo a la izquierda dice **v0.53.0**.
- [ ] **Hoy**: si tu última carga del SII es de hace más de 7 días, aparece "Cargas del SII: la última fue hace N días…"; desde el día 5, si falta el mes pasado, "Falta cargar el SII de <mes>". Tocarlo abre Cargas del SII, con el mismo aviso arriba.
- [ ] Sube las compras del SII: el aviso se va (recarga Hoy).
- [ ] Una factura de internet/gas/teléfono que **va al vencimiento**: en **Pagar** ves "Neto · IVA · Total — de la factura N° …" y no ves los chips de Tipo de monto.
- [ ] Págala (con Pagar o con la cartola) y revisa en **Registrados** que el gasto tenga el neto de la factura.
- [ ] Un vencimiento que ya tenía su factura antes de esta versión se paga igual que antes (con los chips).

### Si algo sale mal
Sube de nuevo los archivos de la v0.52.0: no hay datos nuevos que estorben (los montos extra del documento se ignoran).

## Novedades de la v0.52.0: Por facturar en tres tarjetas y cuánto te atrasaste con cada cliente
En **Ventas B2B → Órdenes**, lo que antes era una sola tarjeta **Por facturar** ahora son tres, en este orden: **Facturación diaria**, **Facturación semanal** y **Facturación mensual** (según la modalidad de cada cliente en Clientes; sin modalidad cuenta como diaria). Una tarjeta sin órdenes no aparece.

- **Cada tarjeta funciona como la de antes:** clientes agrupados, su lupa (busca por cliente o N° de orden, solo en esa tarjeta), se pliega y recuerda si la dejaste abierta (la primera vez parte como tenías Por facturar), y en el resumen: clientes · órdenes · $. Marcar las que tocan, Marcar todas, PDF, Preparar para el SII, mensaje, WhatsApp y Asignar folio siguen igual.
- **Etiqueta junto a cada cliente** (con su (i) en cada tarjeta): cuántos períodos ya tocaba facturar y siguen con órdenes sin folio. **Diaria:** se factura el mismo día; cuenta los días distintos (hoy incluido). **Semanal:** semana de lunes a domingo, se factura el sábado de su semana (la orden del domingo, ese mismo domingo); cuenta las semanas distintas. **Mensual:** se factura el último día del mes; cuenta los meses distintos.
  - **Al día** (verde): tiene órdenes sin folio, pero todavía no llega su día de facturar.
  - **1 pendiente** (amarillo) · **2 pendientes** o más (rojo, más marcado): te estás atrasando.
- **Orden dentro de cada tarjeta:** primero los clientes con más pendientes; si empatan, por nombre.

Por dentro: en `b2b.js`, nuevas `modoFacturacion` (normaliza "semanal", "Mensual ", vacío → diaria; también la usa la agenda), `periodoFacturacion` (día / lunes de su semana / mes) y `periodosPendientes(facturacion, fechas, hoy)`, que usa `correspondeFacturar` (la misma regla del 8-oct). Las tarjetas se guardan plegadas como `fact-diaria`, `fact-semanal` y `fact-mensual` (antes `fact`).

Archivos: cambian `app.js`, `b2b.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.52.0**. No cambian reglas de Firestore ni scripts.

### Instalación v0.52.0 (unos 3 minutos)
En GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → arrastra todos los archivos del zip `sistema-fen-v0.52.0.zip` (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R).

### Lista de verificación v0.52.0
- [ ] Abajo a la izquierda dice **v0.52.0**.
- [ ] **Ventas B2B → Órdenes**: en vez de Por facturar ves **Facturación diaria**, **semanal** y **mensual** (solo las que tienen órdenes), cada una con clientes · órdenes · $.
- [ ] Cada cliente tiene su etiqueta (**Al día**, **1 pendiente**, **n pendientes**) y los más atrasados van primero. Revisa uno que conozcas: un semanal con órdenes solo de esta semana dice **Al día** hasta el sábado.
- [ ] La lupa de una tarjeta busca solo en esa tarjeta; plegar y abrir se recuerda al recargar.
- [ ] Asigna un folio como siempre: la orden sale de la tarjeta y la etiqueta del cliente baja.
- [ ] En el celular se ve bien (sin moverse hacia el lado).

### Si algo sale mal
Sube de nuevo los archivos de la v0.51.0: no se guardó nada nuevo en la base.

## Novedades de la v0.51.0: Gastos, base nueva (etapa G3 completa): Previred con la base y el cambio habilitado
**Hasta que presiones el botón, no cambia nada:** Gastos sigue con la planilla igual que en la v0.50.0. Lo nuevo es que el botón **Pasar Gastos a la base nueva** ya no está gris: G2 y G3 están completos. Los pasos del fin de semana están en la **Guía del cambio** (más abajo y en `guia-cambio-gastos.md`).

- **Previred con la base nueva.** Se sube igual (Gastos → Previred): se lee el PDF en el equipo, se recuerdan el área y el ítem de cada trabajador y el mismo mes no se carga dos veces. El PDF va a Drive (**Fën · Gastos / Previred / año**, privado) y el detalle a la base (pasa solo a la hoja **Cotizaciones**). **La regla acordada:** si existe la obligación **Cotizaciones** (según documento, con identificador **Previred**), el certificado dice **"Va al vencimiento de Cotizaciones … (fecha)"** (con su (i)) y al guardar **completa ese vencimiento** (monto = total del certificado; el PDF queda como su documento). **Los gastos por trabajador se crean al pagarlo** (con la cartola, que lo propone por el monto exacto, o con Pagar): uno por trabajador, sin IVA, con su área e ítem. Si no existe esa obligación o su vencimiento, funciona como hoy (los gastos al guardar) y una nota sugiere crear la obligación.
- **"Es Previred"** (Obligaciones → Editar, tipo según documento, con su (i)): marca la obligación de las cotizaciones.
- **Clasificar obligaciones** (Gastos → Obligaciones → **Revisar y clasificar**, y desde Base nueva): cada obligación activa con su ítem, su monto, sus últimos pagos y una **propuesta** de tipo: **monto fijo** si los últimos 3 pagos fueron iguales; **según documento** si es luz, agua, gas, internet o teléfono, o si el SII tiene facturas de un proveedor con ese nombre; **libre** si es un sueldo o los montos cambian mucho. Y de **identificador**: el número del nombre ("LUZ AINAVILLO 1112223 / 9990001" → 1112223; con varios eliges tú), el RUT del proveedor del SII o Previred. Nada se guarda solo: **Guardar** en cada una o marca varias y **Aplicar propuestas** (sus vencimientos abiertos toman el tipo nuevo, como en Editar).
- **Arreglo "sin IVA"** (opcional, una vez, en Base nueva después del cambio): los gastos de 2026 nacidos de pagar una obligación **Sin IVA** que la app antigua guardó como bruto (neto = monto / 1,19) quedan con neto = monto final. Primero muestra la lista y la diferencia total; solo se aplica si confirmas. Cada gasto guarda "ajuste siniva" en su historial y pasa a la planilla.
- **El cambio**: además de la copia final y el control de totales, al terminar muestra **lo que queda justo después** (clasificar, identificadores, arreglo sin IVA, fichas de proveedores, dejar privados los archivos, revisar la planilla y Looker). **Volver a la planilla** sigue igual: solo si todavía no se hizo nada en la base nueva.
- **Copia a la planilla** (script v2.17.0): **Cotizaciones** y **Cotizaciones Trabajadores** con su "ID base" (lo copiado en G1 se reconoce por su Clave / RUT; nunca se borran filas). Con la base nueva, el script rechaza `cot_registrar` (la app antigua y versiones anteriores no escriben Previred en la planilla).

Por dentro: reglas nuevas en `gastos-g3d.js` (Previred: estado, registro, lista y a qué vencimiento va; `lineasDelPago`, que usan Pagar y la cartola; propuestas para clasificar; vista previa del arreglo sin IVA). `gastos-g3d-fs.js` hace cot_estado, cot_registrar y cot_lista en `cotizaciones` (id `c-<huella de la Clave>`, como la copia G1) y `cotiz_trabajadores`, clasificar y el arreglo. El vencimiento completado guarda `documento { tipo: 'previred', url, previred: { periodo, fecha, trabajadores } }`. Gastos de Previred al subir (sin obligación): `gq-…`; al pagar: `gp-…` con `previred { periodo, rut }`. `config.js`: **`CAMBIO_HABILITADO: true`** (antes `G2_COMPLETO`). Con la planilla, Previred llama al script como siempre.

Archivos: **nuevos** `gastos-g3d.js`, `gastos-g3d-fs.js` y `vista-gastos-clasificar.js`. Cambian `previred.js`, `gastos.js`, `gastos-fs.js`, `gastos-g3.js`, `gastos-cartola-fs.js`, `gastos-base.js`, `vista-gastos-base.js`, `app.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.51.0**.

### Instalación v0.51.0 (unos 8 minutos)
**A. Script de Gastos v2.17.0** → ver el README de `gastos-script-v2.17.0.zip` (zip completo: reemplaza todos los `.gs`; nueva versión de la implementación). El ping debe decir **2.17.0**.

**B. Sistema Fën v0.51.0** → en GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → arrastra todos los archivos del zip (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R). Abajo a la izquierda debe decir **v0.51.0**.

Las reglas de fen-gastos no cambian (v0.1.0: la cuenta en `admins` lee y escribe todo, también `cotizaciones` y `cotiz_trabajadores`). No hay que crear índices.

**C. El cambio** → cuando quieras, un fin de semana: sigue la Guía del cambio (abajo).

### Lista de verificación v0.51.0 (antes del cambio)
- [ ] Abajo a la izquierda dice **v0.51.0**; el ping del script de Gastos dice **2.17.0**.
- [ ] **Gastos → Base nueva → Cambio a la base nueva**: el botón **Pasar Gastos a la base nueva** está activo (no lo presiones hasta el fin de semana).
- [ ] **Previred**: sube un certificado de prueba ya cargado: dice "Este mes ya estaba cargado completo", igual que antes (con la planilla).
- [ ] Todo lo demás de Gastos y Conciliación funciona igual que en la v0.50.0.

### Si algo sale mal
- **"Falta actualizarlo a v2.17.0"**: solo puede aparecer con Gastos en la base nueva (al guardar el PDF de Previred o en la Copia a la planilla); paso A.
- Para volver atrás antes del cambio: sube los archivos de la v0.50.0 y, si quieres, el script v2.16.0. Antes del cambio esta versión no escribe nada nuevo en fen-gastos.

## Guía del cambio: Gastos a la base nueva (fin de semana)

Para Sistema Fën **v0.51.0** y el script de Gastos **v2.17.0**. Tiempo: unos 45 minutos. Hazlo cuando nadie esté registrando gastos (ni en la app antigua ni en Sistema Fën).

### Antes de empezar
1. Ten a mano: el zip **gastos-script-v2.17.0.zip**, el zip **sistema-fen-v0.51.0.zip** y tu contraseña de Sistema Fën.
2. Si te quedan cargos de la cartola o un SII a medio importar en la app antigua, termínalos antes (o déjalos para después del cambio: la cartola y el SII se vuelven a subir sin duplicar).

### El cambio
1. **Instala el script de Gastos v2.17.0.** En el Apps Script de Gastos, reemplaza **todos** los archivos `.gs` con los del zip (Code, Seguridad, SistemaFen, Calendario, Cartola y BaseNueva). Guarda → Implementar → Administrar implementaciones → lápiz → **Nueva versión** → Implementar. Revisa: `URL/exec?action=ping` responde **2.17.0**.
2. **Instala Sistema Fën v0.51.0.** GitHub, repo **sistema-fen** → Add file → Upload files → arrastra todo el zip (con la carpeta `cocina/`) → Commit. Espera 1 o 2 minutos y recarga con Ctrl+Shift+R. Abajo a la izquierda debe decir **v0.51.0**.
3. **Gastos → Base nueva → Cambio a la base nueva → Pasar Gastos a la base nueva.** Confirma. Cierra la planilla para escribir, hace la copia final y el control de totales. Espera el mensaje **"Listo: Gastos trabaja con la base nueva. Todo cuadra."**
4. **Revisa que todo cuadre.** En **Control de totales** tiene que decir **Todo cuadra** (también mes por mes). Si dice "no cuadra", no se cambió nada: Gastos sigue con la planilla (ver "Si algo falla").
5. **Clasifica las obligaciones.** En "Lo que queda justo después del cambio" → **Clasificar obligaciones** (o Gastos → Obligaciones → Revisar y clasificar). Revisa la propuesta de cada una (monto fijo, según documento o libre), cambia lo que no calce y presiona **Aplicar propuestas** (o **Guardar** en cada una).
6. **Completa los identificadores.** En la misma pantalla: el N° de cliente de cada luz y agua (si el nombre trae dos números, elige el de la boleta), el RUT del proveedor de internet, gas o teléfono, y **Previred** en Cotizaciones (en Editar: marca "Es Previred").
7. **Arreglo "sin IVA" (opcional).** En "Lo que queda…" → **Revisar el arreglo "sin IVA"**. Mira la lista y la diferencia total; si está bien, **Aplicar el arreglo**. El monto final no cambia: solo el neto de los pagos de obligaciones sin IVA que la app antigua guardó como bruto.
8. **Arma las fichas de proveedores** (parte **Proveedores** → Armar fichas de proveedores). Una vez.
9. **Deja privados los archivos** (parte **Archivos en Drive** → Dejar privados los archivos ya subidos), si no lo hiciste antes. Espera **Listo**.

### Revisar la planilla y Looker
1. **Copia a la planilla** dice **Planilla al día**.
2. Registra un gasto de prueba en Sistema Fën: a los pocos segundos aparece arriba en **Registro Gasto**, con la columna **ID base** al final. Anúlalo: pasa a **Gastos anulados**.
3. Abre Looker Studio y actualiza los datos: el mes en curso muestra lo mismo que **Gastos → Análisis**.
4. La app antigua de Gastos ya no registra: dice **"Gastos ya se registra en la base nueva (Sistema Fën)"**. Puede seguir leyendo.

### Si algo falla
- **"No cuadra" o un error durante el cambio**: no se cambió nada y el script vuelve a aceptar escrituras de la planilla. Lee la planilla de nuevo (Copia desde la planilla) y vuelve a presionar **Pasar Gastos a la base nueva**. Si sigue sin cuadrar, anota las diferencias y avísame.
- **"Falta actualizarlo a v2.17.0"**: el paso 1 no quedó (revisa la nueva versión de la implementación).
- **Volver atrás**: **Volver a la planilla** (en Cambio a la base nueva) funciona **solo si todavía no se hizo nada en la base nueva** (ni un gasto, ni un pago, ni una clasificación; abrir Vencimientos u Hoy ya crea los vencimientos del mes). Si ya se hizo algo, dice por qué no se puede: Gastos sigue en la base nueva y lo vemos juntos.
- **Para dejar el botón gris otra vez** (sin volver atrás lo ya hecho): sube la v0.50.0 o pon `CAMBIO_HABILITADO: false` en `config.js`.
- **El script**: Implementar → Administrar implementaciones → lápiz → versión anterior (v2.16.0). Con Gastos en la planilla, Sistema Fën v0.51.0 funciona igual con la v2.16.0 (solo la copia a la planilla y el PDF de Previred con la base nueva piden la v2.17.0).

## Novedades de la v0.50.0: Gastos, base nueva (etapa G3, tercera parte): la cartola con la forma de trabajar acordada
**Para el día a día no cambia nada:** Gastos sigue con la planilla y la Conciliación (Abonos de B2B y Cargos de Gastos) funciona igual que en la v0.49.0. El botón **Pasar Gastos a la base nueva** sigue gris: de G3 falta Previred. Lo nuevo, para cuando se haga el cambio:

- **La cartola con la base nueva.** Se sube igual, por Conciliación (una sola subida: los abonos van a B2B como siempre y los cargos a la base nueva). Subir la misma cartola dos veces no repite nada. El archivo original sigue yendo a Drive (**Fën · Gastos / Cartolas / año**, privado) y no se guarda dos veces. Deshacer, lo aprendido y quitar lo aprendido funcionan igual que hoy. **La cartola nunca crea obligaciones**: paga vencimientos, agrega abonos y lo demás queda como gasto (como hoy).
- **Propuestas según el tipo de la obligación**: **monto fijo**: un cargo del monto exacto del vencimiento (±$0), desde 15 días antes hasta 10 días después de su fecha, se propone seguro ("monto fijo exacto"). **Según documento**: por el monto de su boleta o factura, cuando ya llegó; dos luces con la misma descripción en el banco (Luz Barros y Luz Ainavillo) se distinguen por ese monto. Si los montos chocan o falta el documento, no hay propuesta: dice cuáles son las opciones y eliges tú. **Libre (sueldos líquidos)**: el cargo se agrega como **abono** (botón **Abono (sueldo)** en el cargo); lo aprendido lo sugiere la próxima vez, pero nunca marcado ni cerrado solo (se cierra en Vencimientos). Una obligación **sin clasificar** con el monto exacto se propone, pero sin marcar.
- **Confirmar varios de una vez** (con su (i)): cada cargo con propuesta tiene una casilla; los seguros vienen marcados. **Confirmar seleccionados (N)** muestra el total y de qué tipo son, pide confirmación y muestra el avance ("Confirmando 2 de 5…"). Cada uno va por su lado: si uno falla, los demás siguen y al final dice cuáles no se pudieron. Confirmar dos veces el mismo cargo no lo paga dos veces.
- **Facturas del SII de internet, gas o teléfono**: si el RUT del proveedor es el N° de cliente / RUT de una obligación **según documento**, al cargar del SII esa factura dice **"Va al vencimiento de Internet … oct"** (con su (i)) y no pide ítem. Al importar no crea un gasto: completa el vencimiento de ese período (monto = total de la factura; fecha = su vencimiento, o 30 días después de emitida). El gasto se crea al pagarlo (cartola o Pagar), con el ítem y las áreas de la obligación y el RUT y folio de la factura (cuenta para el IVA). Si hay más de una obligación con ese RUT o no calza con un vencimiento, va a **Documentos sin obligación** (ahí: asignar, crear obligación o descartar).
- **Copia a la planilla** (script v2.16.0): los cargos, las cartolas y lo aprendido pasan a **Cartola Cargos**, **Cartolas** y **Cartola Reglas** (con su "ID base"; lo copiado en G1 se reconoce y no se duplica; nunca se borran filas: una regla quitada queda con Veces 0 y la columna **Quitada**). Los gastos y vencimientos pagados con la cartola llevan la columna **Cartola** como hoy. Con la base nueva, el script rechaza escribir la cartola en la planilla.

Por dentro: reglas nuevas en `gastos-cartola.js` (propuestas, carga, aprender/desaprender, traza "Cartola N°…[cc…]", igual que Cartola.gs); `gastos-cartola-fs.js` hace cc_lista, cc_cargar, cc_resolver, cc_deshacer y cc_quitar_regla en las colecciones `cartolas`, `cartola_cargos` y `cartola_reglas` (forma de la copia G1). Resolver un cargo es **una transacción** (cargo, vencimientos, gastos y lo aprendido): no queda nada "a medias". Ids fijos por cargo (`gp-<cargo>-r<n>v<k>-01`, gasto nuevo `gc-…`): un reintento no duplica y, después de deshacer, la siguiente vez usa otros. Cada gasto y vencimiento tocado guarda `cartola` (la traza) y `cartolaCargo` (el id del cargo). El abono usa `agregarAbono(vencId, { monto, fecha, origen: 'cartola', cargoId })`. Las facturas que van a un vencimiento quedan en `sii_docs` con `importado.aVencimiento` (o `pendienteId`). El historial de cambios de un cargo va en `registro` (la columna Historial sigue siendo el texto de Deshacer). Con la planilla, `cartola.js` y el SII hacen exactamente lo de la v0.49.0.

Archivos: **nuevos** `gastos-cartola.js` y `gastos-cartola-fs.js`. Cambian `cartola.js`, `gastos.js`, `gastos-fs.js`, `gastos-g3.js`, `gastos-sii.js`, `gastos-sii-fs.js`, `gastos-base.js`, `sii.js`, `app.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.50.0**.

### Instalación v0.50.0 (unos 8 minutos)
**A. Script de Gastos v2.16.0** → ver el README de `gastos-script-v2.16.0.zip` (reemplaza `BaseNueva.gs`, `SistemaFen.gs` y `Seguridad.gs`; nueva versión de la implementación). El ping debe decir **2.16.0**.

**B. Sistema Fën v0.50.0** → en GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → arrastra todos los archivos del zip (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R). Abajo a la izquierda debe decir **v0.50.0**.

Las reglas de fen-gastos no cambian (v0.1.0: la cuenta en `admins` lee y escribe todo, también `cartolas`, `cartola_cargos` y `cartola_reglas`). No hay que crear índices (las consultas usan un solo campo).

### Lista de verificación v0.50.0
- [ ] Abajo a la izquierda dice **v0.50.0**; el ping del script de Gastos dice **2.16.0**.
- [ ] **Gastos → Base nueva**: el botón del cambio sigue gris con **El cambio se habilita cuando estén listos G2 y G3**.
- [ ] **Conciliación**: sube una cartola: abonos a B2B y cargos a Gastos igual que antes (con la planilla no aparecen casillas ni "Abono (sueldo)").
- [ ] Confirma y deshaz un cargo de prueba: igual que antes, en la planilla.

### Si algo sale mal
- **"Falta actualizarlo a v2.16.0"**: solo puede aparecer con Gastos en la base nueva (al guardar el archivo de la cartola o en la Copia a la planilla); paso A.
- Para volver atrás: sube los archivos de la v0.49.0 y, si quieres, el script v2.15.0. Antes del cambio esta versión no escribe nada nuevo en fen-gastos.

## Novedades de la v0.49.0: Gastos, base nueva (etapa G3, segunda parte): la forma de trabajar acordada (tipos de obligación, boletas, abonos)
**Para el día a día no cambia nada:** Gastos sigue con la planilla y todo funciona igual que en la v0.48.0 (Vencimientos, Obligaciones y Agenda se ven igual). El botón **Pasar Gastos a la base nueva** sigue gris: de G3 faltan la cartola y Previred. Lo nuevo, para cuando se haga el cambio:

- **Tipo de cada obligación** (Obligaciones → Editar, con su (i)): **Monto fijo** (arriendo, cuotas), **Según documento del mes** (luz, agua: el monto y la fecha real vienen de la boleta; internet, gas o teléfono, de la factura del SII) o **Libre (abonos)** (sueldos líquidos: varias transferencias). Las de tipo documento llevan el **N° de cliente** (o el RUT del proveedor) y cuántos días antes recordar. Las que vienen de la planilla dicen **Sin clasificar** y funcionan como monto fijo hasta que les elijas un tipo. Una nueva parte como monto fijo.
- **Vencimientos con su estado**: *esperando documento* (muestra la **fecha estimada**), *por pagar*, *con abonos*, *pagado* o *anulado*. Los de tipo documento se crean 20 días antes (para esperar la boleta); los demás, 3 días antes, como siempre.
- **Subir boleta** (Vencimientos, botón arriba o en el vencimiento que la espera): el PDF o la foto va a Drive (**Fën · Gastos / Boletas y facturas / año**, privada). Del PDF se leen solos el N° de cliente, el total a pagar y la fecha de vencimiento ($35.000, 35.000, dd-mm-aaaa, dd/mm/aaaa, "Total a pagar", "Vencimiento", "N° Cliente", "Número de cliente", "Servicio N°"); de una foto se escriben a mano. Siempre se pueden corregir antes de guardar. Con el N° de cliente se busca la obligación y se completa su vencimiento del mes (monto y fecha real, o se crea si todavía no estaba). **Pagar** propone el monto de la boleta.
- **Documentos sin obligación** (abajo en Vencimientos, con su (i)): una boleta cuyo N° de cliente no tiene ninguna obligación (o tiene más de una) queda ahí. Se puede **asignar a una obligación** (completa su vencimiento y le guarda el N° de cliente si no lo tenía), **registrar como gasto** (abre Registrar con la boleta ya en Drive), **crear obligación** (formulario ya lleno: según documento, con el N° de cliente) o **descartar** (no se borra: queda con quién y cuándo).
- **Abonos** (tipo libre): **Agregar abono** (monto, fecha y comprobante opcional) crea un gasto por abono con el ítem y las áreas de la obligación. El vencimiento muestra "2 abonos: ab. 1 $250.000 · ab. 2 $180.000 · total $430.000" y **Cerrar** lo deja pagado (con quién y cuándo).
- **Vencimiento suelto** (botón en Vencimientos): un pago de una vez sin obligación (patente, permiso): nombre, ítem, áreas, monto, fecha y tipo de monto. Al pagarlo se registra el gasto como el de una obligación.
- **Agenda**: con la base nueva muestra solo los vencimientos que ya existen (ya no proyecta las obligaciones) y el recordatorio **"Subir boleta de …"** unos días antes de la fecha estimada, mientras el vencimiento espera su boleta (si se atrasa, sigue apareciendo hoy). Los recordatorios propios de la Agenda siguen igual.
- **Copia a la planilla** (script v2.15.0): la columna Estado de Vencimientos recibe lo que entiende la app antigua (esperando documento, por pagar y con abonos → PENDIENTE; pagado → PAGADO; anulado → ANULADO). Lo nuevo va en columnas nuevas al final (TipoObligacion, EstadoBase, FechaEstimada, MontoDocumento, FechaDocumento, Documento, Abonos, Suelto, Cerrado; en Obligaciones: TipoObligacion, Identificador, DiasAviso), solo cuando se usan. Ninguna columna se mueve. La bandeja no pasa a la planilla.

Por dentro: reglas nuevas en `gastos-g3.js` (estados, leer la boleta, abonos, agenda, vencimiento suelto); `gastos-fs.js` suma `subirBoleta`, `documentosPendientes`, `resolverPendiente`, `agregarAbono(vencId, { monto, fecha, origen: 'cartola', cargoId })` (la cartola lo usará en la próxima parte: el mismo cargo no se agrega dos veces), `cerrarVencimiento` y `crearSuelto`. Colección nueva **`documentos_pendientes`** (id `dp-…`); vencimiento suelto `vl-…`; gastos de un abono `gp-…`. El recordatorio "Subir boleta" se calcula (no se guarda): desaparece solo cuando llega la boleta. Lo copiado de la planilla se lee igual que antes (PENDIENTE / VENCIDA / PAGADO / ANULADO). La copia a la planilla pide el script v2.15.0.

Archivos: **nuevo** `gastos-g3.js`. Cambian `gastos.js`, `gastos-fs.js`, `gastos-g2.js`, `gastos-sii-fs.js`, `app.js`, `estilos.css`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.49.0**.

### Instalación v0.49.0 (unos 8 minutos)
**A. Script de Gastos v2.15.0** → ver el README de `gastos-script-v2.15.0.zip` (reemplaza `BaseNueva.gs` y `Seguridad.gs`; nueva versión de la implementación). El ping debe decir **2.15.0**.

**B. Sistema Fën v0.49.0** → en GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → arrastra todos los archivos del zip (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R). Abajo a la izquierda debe decir **v0.49.0**.

Las reglas de fen-gastos no cambian (v0.1.0: la cuenta en `admins` lee y escribe todo, también `documentos_pendientes`). No hay que crear índices.

### Lista de verificación v0.49.0
- [ ] Abajo a la izquierda dice **v0.49.0**; el ping del script de Gastos dice **2.15.0**.
- [ ] **Gastos → Base nueva**: el botón del cambio sigue gris con **El cambio se habilita cuando estén listos G2 y G3**.
- [ ] Vencimientos, Obligaciones y Agenda se ven igual que antes (con la planilla no aparecen "Subir boleta", tipos ni bandeja).
- [ ] Paga un vencimiento de prueba: igual que antes, en la planilla.

### Si algo sale mal
- **"Falta actualizarlo a v2.15.0"**: solo puede aparecer con Gastos en la base nueva (en la Copia a la planilla); paso A.
- Para volver atrás: sube los archivos de la v0.48.0 y, si quieres, el script v2.14.0. Antes del cambio esta versión no escribe nada nuevo en fen-gastos.

## Novedades de la v0.48.0: Gastos, base nueva (etapa G3, primera parte): Cargas del SII con la base
**Para el día a día no cambia nada:** Gastos sigue con la planilla y las Cargas del SII funcionan igual que en la v0.47.0 (mismas llamadas al script). El botón **Pasar Gastos a la base nueva** sigue gris: de G3 faltan la cartola y Previred. Lo nuevo, para cuando se haga el cambio:

- **Cargas del SII con la base nueva.** Subir el archivo (XML, XLS o CSV), ver qué ya está en Gastos, las notas, las coincidencias con gastos a mano, **importar**, **vincular**, el **detalle** de un documento, la **nota de la carga** y **quitar del historial**: todo igual que hoy, con los mismos montos. El archivo del SII sigue yendo a Drive con el script (**Fën · Gastos / Cargas SII / año**, privado) y **Reabrir carga** lo vuelve a leer desde ahí.
- **Importar** crea los gastos como hoy: una línea por ítem y área, el neto en la proporción real del documento (así el IVA y el 12% de la harina cuadran con lo declarado), la nota de crédito en negativo (**NC.folio**), un vencimiento si queda pendiente y los productos en Detalle Compras. Cada gasto queda con su documento (RUT, tipo y folio). Si se corta a medias, presionar Importar de nuevo **no repite** lo que ya quedó.
- **Quitar una carga** no borra nada: queda marcada con la fecha y quién, y sus gastos no se tocan (como hoy). **Borrar una nota** la deja vacía (en la planilla la fila queda, con la nota en blanco).
- **Proveedores** (nuevo, **Gastos → Base nueva → Proveedores**): las sugerencias al cargar del SII (cómo clasificaste antes a cada proveedor y a cada producto, últimos 2 años) quedan guardadas en una ficha por proveedor. Cada importación y cada vínculo la actualiza sola. **Armar fichas de proveedores** las arma desde cero con lo que hay en la base: hacerlo una vez, después del cambio (repetirlo no hace daño). Muestra cuántas hay y cuándo se actualizaron.
- **Copia a la planilla** (script v2.14.0): las cargas pasan a **Cargas SII**, los productos al final de **Detalle Compras** y las notas a **Notas Documentos**, cada fila con su "ID base". Copiar dos veces no duplica y nunca borra filas.

**Ojo:** la copia G1 trae lo de 2026. Con la base nueva, las sugerencias se arman con eso más lo que se importe después (el script miraba 2 años de la planilla): los primeros meses pueden sugerir algo menos para proveedores que solo aparecían en 2025.

Por dentro: `sii.js` manda a `gastos-sii-fs.js` cuando `config/gastos` dice **base**; las reglas están en `gastos-sii.js` (probadas contra el script real con las mismas entradas: importar, repetidos, coincidencias, historial, detalle y la clasificación por proveedor). Colecciones: `sii_cargas` (id `sc-<huella de sus documentos>`; las copiadas en G1 conservan el suyo), `sii_docs` (como los arma G1: líneas y notas) y **`proveedores/{rut}`** (nueva; no pasa a la planilla). Gastos importados: `gs-…`; vencimiento: `vs-…`. Hoy (documentos del SII sin gasto) sigue contándolo el script con la planilla, que ya tiene lo copiado.

Archivos: **nuevos** `gastos-sii.js` y `gastos-sii-fs.js`. Cambian `sii.js`, `gastos.js`, `gastos-fs.js`, `gastos-base.js`, `vista-gastos-base.js`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.48.0**.

### Instalación v0.48.0 (unos 8 minutos)
**A. Script de Gastos v2.14.0** → ver el README de `gastos-script-v2.14.0.zip` (reemplaza `Code.gs`, `SistemaFen.gs`, `BaseNueva.gs` y `Seguridad.gs`; nueva versión de la implementación). El ping debe decir **2.14.0**.

**B. Sistema Fën v0.48.0** → en GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → arrastra todos los archivos del zip (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R). Abajo a la izquierda debe decir **v0.48.0**.

Las reglas de fen-gastos no cambian (v0.1.0: la cuenta en `admins` lee y escribe todo, también `proveedores`). No hay que crear índices en la consola de Firebase.

### Lista de verificación v0.48.0
- [ ] Abajo a la izquierda dice **v0.48.0**; el ping del script de Gastos dice **2.14.0**.
- [ ] **Gastos → Base nueva**: el botón del cambio sigue gris con **El cambio se habilita cuando estén listos G2 y G3**; aparece **Proveedores** (antes del cambio puede decir "Todavía no hay fichas": no se usa hasta el cambio).
- [ ] **Cargas del SII**: sube un archivo, clasifica e importa uno de prueba: igual que antes (en la planilla, con sus sugerencias). Reabre una carga del historial y deja una nota.
- [ ] La app antigua de Gastos sigue cargando del SII igual (con la planilla).

### Si algo sale mal
- **"Falta actualizarlo a v2.14.0"**: solo puede aparecer con Gastos en la base nueva (al subir o reabrir un archivo del SII); paso A.
- Para volver atrás: sube los archivos de la v0.47.0 y, si quieres, el script v2.13.5. Antes del cambio esta versión no escribe nada nuevo en fen-gastos (salvo las fichas, si presionas "Armar fichas de proveedores").

## Novedades de la v0.47.0: Gastos, base nueva (etapa G2 completa): obligaciones, ítems, análisis y agenda con la base
**Para el día a día no cambia nada:** Gastos sigue con la planilla y todo funciona igual que en la v0.46.0. Con esta versión la etapa G2 queda completa, pero el botón **Pasar Gastos a la base nueva** sigue gris: el cambio también necesita la etapa G3 (SII, cartola y Previred con la base nueva), así que ahora dice **"El cambio se habilita cuando estén listos G2 y G3"** (`G2_COMPLETO: false` en `config.js`). Lo nuevo, para cuando se haga el cambio:

- **Obligaciones** con la base nueva: la lista (con la **próxima fecha**), el **historial de pagos**, **crear y editar** (ítem, reparto por % o monto por área, frecuencia, día, monto estimado, tipo de monto y cuotas), **archivar** y **reactivar**. Igual que hoy: al crear una se crea de inmediato su primer vencimiento (una cuponera, todas sus cuotas); **editar no cambia los vencimientos ya creados** (pagados o por pagar siguen con sus datos; los siguientes salen con los datos nuevos); reactivar vuelve a generar. Cada cambio queda en el historial de la obligación (quién, cuándo, antes y después). Nada se borra.
- **Ítems** con la base nueva: crear (queda al final), editar, **subir y bajar**, **archivar** y reactivar (nunca se borran). Un ítem archivado no aparece para registrar. Igual que hoy: **cambiar el nombre no cambia los gastos ya registrados ni las obligaciones que lo usan**.
- **Análisis** con la base nueva: los mismos números, por mes, por fecha de compra o de pago, con los gastos vigentes (los anulados no suman). "Sugerir % según ventas" sigue preguntando las ventas al script.
- **Agenda** con la base nueva: los pagos de Gastos (vencimientos y lo que viene de las obligaciones) salen de la base. La copia a Google Calendar sigue igual (con el script).
- **Copia a la planilla** (script de Gastos v2.13.0): los gastos de un **pago** quedan **al final** de Registro Gasto, como hoy; lo registrado a mano sigue entrando arriba.

Por dentro: `gastos.js` manda a `gastos-fs.js` también obligaciones e ítems cuando `config/gastos` dice **base**; las reglas están en `gastos-g2.js` (probadas contra el script real con las mismas entradas). Las cuentas del Análisis pasaron de `app.js` a `gastos-g2.js` (`resumenAnalisis`), las mismas con la lista del script o la de la base. Obligación nueva: id `P<milisegundos>` (como el script); sus vencimientos `<obligación>_<fecha>`; ítem nuevo: su nombre en minúsculas, como en la copia G1.

**Ojo, algo del script de hoy que conviene saber** (no cambia en esta versión): al generar un vencimiento, el script copia el área y el % del **primer** área del reparto también en la segunda y la tercera (busca las columnas sin mirar el número: PArea1, PArea2 y PArea3 le parecen la misma). Con la base nueva, los vencimientos nuevos guardan el reparto completo; los que ya vienen de la planilla traen lo que escribió el script.

Archivos: cambian `gastos.js`, `gastos-fs.js`, `gastos-g2.js`, `app.js`, `vista-gastos-base.js`, `gastos-base.js`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.47.0**.

### Instalación v0.47.0 (unos 8 minutos)
**A. Script de Gastos v2.13.0** → ver el README de `gastos-script-v2.13.0.zip` (reemplaza `BaseNueva.gs` y `Seguridad.gs`; nueva versión de la implementación). El ping debe decir **2.13.0**.

**B. Sistema Fën v0.47.0** → en GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → arrastra todos los archivos del zip (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R). Abajo a la izquierda debe decir **v0.47.0**.

Las reglas de fen-gastos no cambian (v0.1.0). No hay que crear índices en la consola de Firebase.

### Lista de verificación v0.47.0
- [ ] Abajo a la izquierda dice **v0.47.0**; el ping del script de Gastos dice **2.13.0**.
- [ ] **Gastos → Base nueva → Cambio a la base nueva** sigue diciendo **Gastos trabaja con la planilla** y el botón está gris con **El cambio se habilita cuando estén listos G2 y G3**.
- [ ] Obligaciones: crea una de prueba, edítala, archívala y reactívala: igual que antes (en la planilla).
- [ ] Ítems: crea uno de prueba, súbelo y archívalo: igual que antes; no aparece en Registrar.
- [ ] Análisis y Agenda muestran lo mismo que antes.

### Si algo sale mal
- Para volver atrás: sube los archivos de la v0.46.0 y, si quieres, el script v2.12.0. Antes del cambio esta versión no escribe nada nuevo en fen-gastos.

## Novedades de la v0.46.0: Gastos, base nueva (etapa G2, segunda parte): registrar, registrados y vencimientos con la base
**Para el día a día no cambia nada:** Gastos sigue con la planilla y todo funciona igual que en la v0.45.0 (mismas llamadas al script). El botón **Pasar Gastos a la base nueva** sigue gris (**"Disponible cuando G2 esté completo"**, `G2_COMPLETO: false` en `config.js`): faltan obligaciones, ítems, análisis y agenda con la base. Esta versión deja listo, para cuando se haga el cambio:

- **Registrar** con la base nueva: varias áreas, reparto por % (prorrateado), harina (19% + 12%), bruto / neto / sin IVA y contado o crédito, con los mismos montos que hoy (una línea por ítem y área; a crédito, **un** vencimiento por compra). La foto o PDF de la boleta va igual a Drive (**Fën · Gastos / Boletas y facturas / año**, privado) con el script de Gastos v2.12.0.
- **Registrados** desde la base: misma lista y mismos filtros (desde el 1 de enero del año pasado). **Corregir** revisa que nadie lo haya cambiado mientras lo tenías abierto (otra pestaña u otro equipo): si cambió, dice **"Este gasto cambió en otro lado, vuelve a abrirlo"** y no pisa nada. Cada corrección queda en el **historial** del gasto: quién, cuándo y qué campo cambió (antes → después). **Anular** no borra: queda anulado con quién, cuándo y por qué, y en la planilla pasa a "Gastos anulados" como hoy.
- **Vencimientos** desde la base: **Pagar** (con comprobante a **Comprobantes de pago / año**, privado) marca el vencimiento PAGADO y crea el gasto con el reparto de la obligación, todo junto (si algo falla, no queda nada a medias). **Anular** y **dejar por pagar de nuevo** igual que hoy.
- **Vencimientos de las obligaciones**: con la base nueva el script ya no los crea; los crea Sistema Fën al abrir Gastos u Hoy, 3 días antes, igual que hoy (también "Día 29, 30 o 31" en meses cortos). Cada uno tiene un id fijo (**obligación_fecha**): aunque Gastos esté abierto en dos pestañas o dos equipos, se crea **una sola vez**.
- **Hoy**: con la base nueva, los pagos atrasados y de los próximos 7 días salen de la base; los documentos del SII y los cargos de la cartola siguen saliendo del script (etapa G3).
- Todo lo hecho en la base pasa solo a la planilla unos segundos después (la **Copia a la planilla** de la v0.45.0).

Por dentro: `gastos.js` decide según `config/gastos` (fen-gastos): con **planilla**, el script como siempre; con **base**, `gastos-fs.js`. Las cuentas son las del script, en `gastos-g2.js` (probadas contra el script real con las mismas entradas). Ids nuevos: gastos `g-<marca>-<azar>-01…`, gastos de un pago `gp-…`, vencimiento de compra a crédito `vc-…`. Firestore no necesita índices compuestos (la lista usa una sola condición: fecha desde).

Archivos: **nuevos** `gastos-fs.js` y `gastos-g2.js`. Cambian `gastos.js`, `gastos-base.js`, `app.js`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.46.0**.

### Instalación v0.46.0 (unos 8 minutos)
**A. Script de Gastos v2.12.0** → ver el README de `gastos-script-v2.12.0.zip` (reemplaza `SistemaFen.gs` y `Seguridad.gs`; nueva versión de la implementación). El ping debe decir **2.12.0**.

**B. Sistema Fën v0.46.0** → en GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → arrastra todos los archivos del zip (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R). Abajo a la izquierda debe decir **v0.46.0**.

Las reglas de fen-gastos no cambian (v0.1.0). No hay que crear índices en la consola de Firebase.

### Lista de verificación v0.46.0
- [ ] Abajo a la izquierda dice **v0.46.0**; el ping del script de Gastos dice **2.12.0**.
- [ ] **Gastos → Base nueva → Cambio a la base nueva** sigue diciendo **Gastos trabaja con la planilla** y el botón está gris con **Disponible cuando G2 esté completo**.
- [ ] Registra un gasto de prueba (con foto, a crédito): queda en la planilla con su vencimiento, igual que antes.
- [ ] Corrígelo y anúlalo en Registrados; paga y anula un vencimiento: igual que antes.
- [ ] Hoy muestra los mismos pagos atrasados y de la semana que antes.

### Si algo sale mal
- **"Falta actualizarlo a v2.12.0"**: solo puede aparecer con Gastos en la base nueva (al subir una foto); paso A.
- Para volver atrás: sube los archivos de la v0.45.0. Antes del cambio esta versión no escribe nada nuevo en fen-gastos.

## Novedades de la v0.45.0: Gastos, base nueva (etapa G2, primera parte): copia a la planilla y el cambio
**Para el día a día no cambia nada:** Gastos sigue con la planilla, igual que en la v0.44.0. Esta versión deja listas dos piezas que se usarán cuando toda la etapa G2 esté construida (registrar, pagar, obligaciones, ítems, análisis y agenda con la base nueva). El cambio se hará todo de una vez, un fin de semana.

En **Gastos → Base nueva** hay dos partes nuevas:
- **Copia a la planilla** (i): después del cambio, cada cosa hecha o cambiada en la base nueva pasa sola a la planilla unos segundos después (Looker Studio y el reparto de costos de Producción la siguen leyendo). Dice **Planilla al día**, **Hay N cambios por pasar** o **Planilla pendiente: <motivo>, se reintenta sola** (al minuto y después cada 2 minutos), con el botón **Pasar ahora**. Cada fila queda con una columna nueva al final, **"ID base"**; un gasto anulado pasa a "Gastos anulados" con quién, cuándo y por qué, como hoy. Antes del cambio no hay nada que pasar.
- **Cambio a la base nueva** (i): explica los pasos y tiene el botón **Pasar Gastos a la base nueva**, **desactivado** con el texto **"Disponible cuando G2 esté completo"** (se activa con `G2_COMPLETO: true` en `config.js`, en una versión futura). Cuando se active, hará: (1) cerrar la planilla para escribir (la app antigua y lo que escribía en la planilla responden "Gastos ya se registra en la base nueva (Sistema Fën)"; las lecturas siguen), (2) leer y copiar la planilla y el **Control de totales**, (3) solo con **Todo cuadra**, dejar Gastos en la base nueva (fen-gastos: `config/gastos`). Si no cuadra o algo falla, todo vuelve a como estaba. Después ofrece **Volver a la planilla**, solo si todavía no se hizo nada en la base nueva (si ya se hizo, explica por qué no).
- Con Gastos en la base nueva, "Copia desde la planilla" ya no se ofrece (copiaría de vuelta lo que la base pasó a la planilla).

Por dentro: Sistema Fën lee `config/gastos` una vez al abrir Gastos (la primera vez lo crea con `fuente: planilla`). La copia G1 ignora la columna "ID base". SII, cartola y Previred siguen con la planilla hasta la etapa G3.

Archivos: **nuevo** `gastos-planilla.js`. Cambian `gastos-base.js`, `vista-gastos-base.js`, `gastos.js`, `gastos-modelo.js`, `firebase-gastos.js`, `app.js`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.45.0**.

### Instalación v0.45.0 (unos 8 minutos)
**A. Script de Gastos v2.11.0** → ver el README de `gastos-script-v2.11.0.zip` (archivo nuevo `BaseNueva.gs`; reemplaza `Code.gs`, `SistemaFen.gs` y `Seguridad.gs`; nueva versión de la implementación). El ping debe decir **2.11.0**.

**B. Sistema Fën v0.45.0** → en GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → arrastra todos los archivos del zip (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R). Abajo a la izquierda debe decir **v0.45.0**.

Las reglas de fen-gastos no cambian (v0.1.0: la cuenta en `admins` lee y escribe todo, también `config/gastos`).

### Lista de verificación v0.45.0
- [ ] Abajo a la izquierda dice **v0.45.0**; el ping del script de Gastos dice **2.11.0**.
- [ ] **Gastos → Base nueva**, conectada: **Copia a la planilla** dice **Planilla al día**; **Cambio a la base nueva** dice **Gastos trabaja con la planilla** y el botón está gris con **Disponible cuando G2 esté completo**.
- [ ] En la consola de fen-gastos → Firestore aparece `config/gastos` con `fuente: "planilla"` y `g2Completo: false`.
- [ ] Registrar, pagar, anular, obligaciones, ítems, SII, Previred y Conciliación funcionan igual que antes; la app antigua de Gastos también.
- [ ] La planilla no cambió (sin columna "ID base").

### Si algo sale mal
- **"Falta actualizarlo a v2.11.0"** en Copia a la planilla: paso A (antes del cambio no hay nada que pasar, así que no afecta el uso).
- Para volver atrás: sube los archivos de la v0.44.0 y, si quieres, el script v2.10.0. No hay datos que deshacer: en esta versión no se escribe nada en la planilla y en fen-gastos solo se crea `config/gastos`.

## Novedades de la v0.44.0: archivos de Gastos en Drive, ordenados y privados
Gastos sigue trabajando con la planilla. Cambia solo cómo quedan los archivos en Drive (lo hace el script de Gastos v2.10.0):
- Todo lo que se sube (foto o PDF de la boleta al registrar, comprobante al pagar, archivo del SII, PDF de Previred y cartola) va a la carpeta **"Fën · Gastos"**, con una carpeta por tipo (**Boletas y facturas**, **Comprobantes de pago**, **Cartolas**, **Cargas SII**, **Previred**) y dentro una por **año**. Queda **privado**: antes quedaba abierto a cualquiera con el enlace.
- **La cartola guarda su archivo original.** Al subirla (Conciliación, en Abonos o en Cargos: es la misma subida) primero se cargan los movimientos como siempre y después el archivo va a **Fën · Gastos / Cartolas / año**. El mensaje dice **Archivo: guardado en Drive (privado)**. Si el archivo no se pudo guardar (o pesa más de 10 MB), lo dice, y lo leído de la cartola igual queda. En "Cartolas subidas" aparece **Ver archivo**.
- **Gastos → Base nueva → Archivos en Drive** (i): botón **Dejar privados los archivos ya subidos**. Revisa las carpetas antiguas (Boletas Gastos, Comprobantes Pagos, Cargas SII, Cotizaciones Previred) y la nueva, por partes, y muestra el avance (**"N de M archivos"**) hasta **Listo**. Si se corta, el botón dice **Seguir donde quedó**. Se puede repetir: lo ya privado queda igual. No mueve ni borra nada. Esta parte no necesita la base nueva conectada.
- Los enlaces **Boleta**, **comprobante**, **Archivo en Drive**, **PDF en Drive** y **Ver archivo** se siguen abriendo en otra pestaña; un (i) junto a cada lista explica que se abren solo con la cuenta de Google de Emmanuel.

Archivos: cambian `app.js`, `cartola.js`, `gastos.js`, `vista-gastos-base.js`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). La carpeta `cocina/` no cambia. Abajo a la izquierda: **v0.44.0**.

### Instalación v0.44.0 (unos 8 minutos)
**A. Script de Gastos v2.10.0** → ver el README de `gastos-script-v2.10.0.zip` (reemplaza `Code.gs`, `SistemaFen.gs`, `Cartola.gs` y `Seguridad.gs`; nueva versión de la implementación). El ping debe decir **2.10.0**.

**B. Sistema Fën v0.44.0** → en GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → arrastra todos los archivos del zip (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R). Abajo a la izquierda debe decir **v0.44.0**.

**C. Dejar privado lo antiguo** → antes, piensa si alguien más abre esos enlaces (el contador, imágenes de boletas en Looker Studio): después ya no podrá sin que lo compartas a mano. Luego **Gastos → Base nueva → Archivos en Drive → Dejar privados los archivos ya subidos** y espera **Listo**.

### Lista de verificación v0.44.0
- [ ] Abajo a la izquierda dice **v0.44.0**.
- [ ] Registra un gasto de prueba con foto: en Drive queda en **Fën · Gastos / Boletas y facturas / 2026**, con acceso **Restringido**; "Boleta" en Registrados la abre.
- [ ] Sube una cartola: dice **Archivo: guardado en Drive (privado)** y en "Cartolas subidas" está **Ver archivo**. En la planilla, hoja Cartolas, la última columna es **Archivo**.
- [ ] **Dejar privados** muestra "N de M archivos" y termina en **Listo**. Presionarlo de nuevo dice **Ya estaban todos privados**.
- [ ] Un enlace antiguo abierto en una ventana de incógnito pide permiso.
- [ ] Todo lo demás de Gastos, Conciliación y B2B sigue igual.

### Si algo sale mal
- **"Falta actualizarlo a v2.10.0"** (al guardar el archivo de la cartola o en Dejar privados): paso A. Los cargos de la cartola se cargan igual.
- **"Ya se están revisando los archivos"**: hay otra revisión en curso (otra pestaña); espera unos minutos y vuelve a presionar.
- Para volver atrás: sube los archivos de la v0.43.0 y vuelve el script a la v2.9.0. Los archivos ya guardados quedan donde están y sus enlaces siguen sirviendo.

## Novedades de la v0.43.0: Gastos, base nueva (etapa G1)
Nueva pestaña **Gastos → Base nueva**. Copia lo de **2026** de la planilla de Gastos al proyecto Firebase nuevo **fen-gastos** y revisa que cuadre.

**Para el día a día no cambia nada.** Gastos sigue trabajando con la planilla (Registrar, pagar, SII, cartola, Previred, Agenda). El cambio a la base nueva se hace después, todo de una vez.

En **Base nueva (fen-gastos)** hay tres partes que se abren y cierran (se recuerda en este equipo):
- **Conexión:** la configuración de fen-gastos ya viene escrita: presionas **Conectar** y entras con **tu misma contraseña** de Sistema Fën.
- **Copia desde la planilla (2026):** **Leer la planilla (2026)** muestra, por cada parte, cuántos hay en la planilla y cuántos son nuevos, cambiados, quitados o iguales, más los avisos. **Copiar a la base nueva** escribe solo lo que cambió, en lotes de hasta 400.
- **Control de totales:** compara planilla y base nueva: cuántos documentos hay en cada parte y, en los gastos vigentes, cuántos, el monto neto y el monto final de cada mes. Debe decir **Todo cuadra**.

(i) **Qué se copia:** gastos de 2026 (también los anulados, con quién, cuándo y por qué), ítems, obligaciones, vencimientos (2026, los que siguen por pagar y los que vienen), cargas y documentos del SII con su detalle y notas, cotizaciones y trabajadores de Previred, y la cartola (cargos, cartolas y reglas). Ninguna columna se pierde. Las fotos y PDF de las boletas siguen en Drive.

(i) **Copiar dos veces no duplica.** Cada documento tiene un id fijo. Si un gasto se corrige en la planilla después de copiarlo, en la base nueva entra la versión nueva y la anterior queda marcada "quitada de la planilla" (no se borra y no suma).

Archivos: **nuevos** `gastos-base.js`, `gastos-modelo.js`, `vista-gastos-base.js`, `firebase-gastos.js` y `firestore-gastos.rules` (respaldo de las reglas de fen-gastos: van en la consola). Cambian `app.js`, `gastos.js`, `config.js`, `index.html`, `README.md` y los demás `.js` (solo versión). Abajo a la izquierda: **v0.43.0**.

### Instalación v0.43.0 (unos 10 minutos)
El proyecto **fen-gastos** ya está creado y sus reglas publicadas (solo las cuentas en `admins` leen y escriben). Si falta algo, revisa abajo "Si algo sale mal".

**A. Script de Gastos v2.9.0** → ver el README de `gastos-script-v2.9.0.zip`. El ping debe decir **2.9.0**.

**B. Sistema Fën v0.43.0** → en GitHub, repo **sistema-fen**, raíz → **Add file → Upload files** → arrastra todos los archivos del zip (con la carpeta `cocina/`) → **Commit changes**. Espera 1 o 2 minutos y recarga (Ctrl+Shift+R). Abajo a la izquierda debe decir **v0.43.0**.

**C. Copiar** (en Sistema Fën → **Gastos → Base nueva**)
1. **Conexión → Conectar** (la configuración de fen-gastos ya viene escrita).
2. Escribe tu contraseña de Sistema Fën → **Entrar**. Si dice que falta marcar tu cuenta como administración: consola de fen-gastos → Firestore → colección `admins` → documento con el UID que muestra la pantalla, campo `ok` = true.
3. **Leer la planilla (2026)** (puede tardar un minuto). Revisa la tabla y los avisos.
4. **Copiar a la base nueva** → al terminar, **Control de totales** debe decir **Todo cuadra**.

### Lista de verificación v0.43.0
- [ ] Abajo a la izquierda dice **v0.43.0**; Gastos tiene la pestaña **Base nueva**.
- [ ] Conexión dice **Conectada · fen-gastos** con tu correo.
- [ ] "Leer la planilla (2026)" muestra los gastos vigentes y anulados de 2026 que esperas.
- [ ] Después de copiar: **Todo cuadra**, también mes por mes (compara un mes con el Análisis de Gastos).
- [ ] Lee la planilla de nuevo: **Todo al día: no hay nada que copiar**.
- [ ] Registra un gasto de prueba en Gastos → Registrar, lee y copia: aparece **1 nuevo**; anúlalo, lee y copia: queda anulado (el mismo documento, con el motivo).
- [ ] En la consola de fen-gastos → Firestore → Datos: están `gastos`, `vencimientos`, `items`, etc. En **Uso**, las escrituras del día son las de la copia.
- [ ] Gastos sigue igual: Vencimientos, Registrar, Cargas del SII, Previred, Conciliación y Agenda.

### Si algo sale mal
- **"Falta actualizarlo a v2.9.0"**: paso A.
- **"No dejó leer o guardar"**: revisa que las reglas de fen-gastos estén publicadas (`firestore-gastos.rules`) y tu documento en `admins`.
- **"No hay una cuenta con tu correo y esa contraseña"**: consola de fen-gastos → Authentication → Usuarios: tu mismo correo y la misma contraseña de Sistema Fën.
- **"Firestore todavía no está creado"**: consola de fen-gastos → Firestore Database → Crear base de datos (southamerica-west1).
- Para volver atrás: sube los archivos de la v0.42.0. La base nueva queda como está y la planilla no se tocó.

## Novedades de la v0.42.0
- **Bodega:** el conteo vale como cierre de su día, porque se cuenta después de la producción. Lo hecho ese día ya está en el conteo y se descuenta desde el día siguiente. Las llegadas van por hora.
- La carpeta `cocina/` se actualiza a la copia de Cocina v0.11.0.

## Novedades de la v0.41.1
- El envase se guarda en singular aunque lo escribas en plural ("Sacos" → "saco"), para que Cocina diga bien "1 saco" / "3 sacos".
- La carpeta `cocina/` se actualiza a la copia de Cocina v0.10.1.

## Novedades de la v0.41.0: cada crítica en su formato (sacos, kg…)
En **Producción → Cocina → Bodega**, la tabla de críticas tiene la columna **"Se cuenta en"**:
- **Vacío:** se cuenta y se recibe en kg, litros o unidades, como hasta ahora.
- **Con envase:** nombre y tamaño, por ejemplo "saco" de 25 kg. En Cocina se escriben los sacos más lo suelto, y el stock también se ve en sacos. Si mañana compras centeno en sacos de 20 kg, le pones "saco" y 20.
- Se guarda con **Guardar cambios**, junto con los mínimos.

Archivos: `produccion.js`, `vista-produccion.js`, carpeta `cocina/` (copia de Cocina v0.10.0), `config.js`, `README.md` y los demás `.js` (solo versión). Abajo a la izquierda: **v0.41.0**.

## Novedades de la v0.40.0: qué significa la diferencia del conteo
En **Bodega**, la columna "Último conteo" explica la diferencia:
- **Faltaron:** "uso sin anotar: mesón, pruebas…". Es la harina de mesón y los usos chicos que no se anotan día a día, o algo hecho que no se marcó.
- **Sobraron:** "llegada o hecho sin anotar".

La carpeta `cocina/` se actualiza a la copia de Cocina v0.9.0 (solo cambia la versión).

Archivos: `vista-produccion.js`, carpeta `cocina/`, `config.js`, `README.md` y los demás `.js` (solo versión). Abajo a la izquierda: **v0.40.0**.

## Novedades de la v0.39.0: Producción más ordenada
La pestaña **Producción** queda en tres tarjetas:
- **Desde Cocina:** lo que espera tu aprobación (recetas y materias primas pedidas). Si no hay nada, ocupa una sola línea.
- **Cocina:** Bodega, Merma y Configuración de Producción.
- **Sistema:** Cuentas de las áreas, Copia desde la planilla, Pasar recetas de Bollería a Pastelería y Control de totales.

Cada parte se **abre y cierra** tocando su título, y a la derecha muestra un resumen. Por ejemplo: "4 de 4 áreas con cuenta", "Última: hace 2 h", "3 críticas · 1 bajo el mínimo", "Todo cuadra".
- Lo que dejas abierto o cerrado se recuerda en este equipo.

Archivos: `vista-produccion.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` (solo versión). Abajo a la izquierda: **v0.39.0**.

## Novedades de la v0.38.0: consumo de Cafetería en la bodega
En **Producción → Bodega**, Cafetería ya descuenta:
- **Lo vendido en la caja:** cada producto vinculado a una receta de Cafetería se baja por su receta hasta las materias primas.
  - Los cierres de caja cuentan al final de su día; la caja abierta cuenta venta por venta.
  - Se usa el vínculo producto → receta que ya tiene la caja (Configuración → Conexión con fën-producción).
- **El café de la bitácora de turno** (calibraciones, café botado, pruebas): eliges en "Cafetería" de qué materia prima sale.
- **Aviso** de los productos de Cafetería vendidos **sin receta vinculada**: no descuentan hasta que los vincules en la caja.
- **Proyección:** Cafetería entra a su ritmo de los últimos 14 días.
- **Entrada:** se corrigió que, al entrar con una cuenta que no es de administración, el aviso "Esta cuenta no es de administración" a veces se borraba solo.

Archivos: `produccion.js`, `vista-produccion.js`, `app.js` (entrada), carpeta `cocina/` (copia de Cocina v0.8.0), `config.js`, `README.md` y los demás `.js` (solo versión). Abajo a la izquierda: **v0.38.0**.

## Novedades de la v0.37.0: Bodega (P5)
En **Producción → Bodega → Calcular** (lee 120 días de Cocina):
- **Materias primas críticas:** estado, stock, mínimo, para cuántos días alcanza (con lo planificado de los próximos 7 días) y último conteo. El último conteo muestra si faltó o sobró contra lo que decía la cuenta, que es lo que se pierde sin anotar.
- **Marcar críticas y su mínimo:** "Agregar crítica", cambiar mínimos o quitar. Si no marcas nada aquí, se usa lo de la planilla (es_critica, stock_seguridad).
- **Llegó mercadería** desde aquí. Las jefas también la anotan en Cocina → Bodega, junto con los conteos.
- **Consumo por área** (esta semana, la pasada, este mes o el pasado): todas las materias primas, con lo hecho en Cocina.
- **Hoy:** avisa cuando una crítica está o queda bajo el mínimo en la semana. Usa el último cálculo (hasta 6 horas) o calcula de nuevo.
- **Cómo se calcula:**
  - Stock = último conteo + llegadas − consumo.
  - Consumo = lo marcado como hecho, bajado por las recetas, más la merma de materias primas.
  - El cálculo es el mismo de Cocina: carpeta `cocina/`, copia exacta de `consumo.js`, `modelo.js`, `bolleria.js` y `registros.js` de Cocina v0.7.0.

Archivos: **carpeta nueva `cocina/`** (4 archivos), `produccion.js`, `produccion-modelo.js` (copia el stock de seguridad de la planilla), `vista-produccion.js`, `app.js` (aviso en Hoy), `config.js`, `README.md` y los demás `.js` (solo versión). Abajo a la izquierda: **v0.37.0**.

## Novedades de la v0.36.0: merma valorizada (P4b)
En **Producción → Merma**: eliges el período (esta semana, semana pasada, este mes o mes pasado) y presionas **Ver**.
- **Por área:** lo que anotaron en Cocina como perdido, sumado por ítem, con cantidad, motivo y **costo neto** (sin IVA). Los costos salen de la planilla (Maestro_recetas y MP_maestro), con el script v2.7.0.
- **Totales:** de cada área, del período y **por motivo**. Lo que no tiene costo en la planilla aparece como "sin costo" y no suma.
- **Café de Cafetería:** gramos de calibración, café botado y pruebas, desde la bitácora de turno.
- **Configuración de Producción → Cafetería:** gramos de café por shot. Cocina los usa en las calibraciones.

Archivos: cambian `produccion.js`, `vista-produccion.js`, `config.js`, `README.md` y los demás `.js` (solo versión). Abajo a la izquierda: **v0.36.0**.

## Novedades de la v0.35.0: una tablet en más de un área
En **Producción → Cuentas de las áreas**:
- Cada cuenta tiene un **Área principal** y, si quieres, **También entra a** (otras áreas). Por ejemplo, una tablet compartida entre Pastelería y Bollería.
- Para cambiar una cuenta que ya existe: **Cambiar** en la lista "Cuentas", marca o desmarca y **Guardar**.
- Arriba, en cada área, la cuenta aparece como "(también; principal …)".
- Necesita las reglas **v1.4.0** (vienen con Cocina v0.5.1) y el script de Producción **v2.6.0**. Sin ellos, la tablet no puede leer ni escribir en la segunda área.

Archivos: cambian `produccion.js`, `vista-produccion.js`, `config.js`, `README.md` y los demás `.js` (solo versión). Abajo a la izquierda: **v0.35.0**.

## Novedades de la v0.34.0: pasar recetas de Bollería a Pastelería (P4)
En **Producción**, sección **Pasar recetas de Bollería a Pastelería** → "Ver las recetas de Bollería".
- Vienen **marcadas** las que parecen de Pastelería: sub recetas clasificadas como relleno o con nombre de crema, ganache, glaseado, almíbar, merengue… Un producto como "Croissant relleno" no se marca, porque es de Bollería.
- Revisas, cambias lo que haga falta y "Pasar las marcadas a Pastelería". Se mueven en la planilla (script v2.5.0) y en la base nueva, con el mismo ID.
- Los productos de Bollería que las usan siguen funcionando.

Archivos: cambian `produccion.js`, `vista-produccion.js`, `config.js`, `README.md` y los demás `.js` (solo versión). Abajo a la izquierda: **v0.34.0**.

## Novedades de la v0.33.0: recetas de Cocina por aprobar (P3)
En **Producción**, arriba, una sección nueva: **Desde Cocina**. **Hoy** avisa cuando hay recetas por aprobar o materias primas pedidas.
- **Recetas por aprobar** (las que Panadería y Bollería envían a revisión desde Cocina). "Revisar" muestra:
  - qué cambió: ingredientes vigente → propuesta (los nuevos y los que salen marcados), rinde, pasos, clasificación;
  - el **costo por unidad**, neto y bruto, de la vigente y de la propuesta, con la diferencia en %, y el costo del lote. Lo calcula el script con los precios de la planilla;
  - avisos de ingredientes sin precio.
  - **Aprobar**: la receta queda en la planilla (costeo, catálogo y Looker siguen igual) y en la base nueva. La versión anterior queda guardada. Mientras se aprueba, la jefa no puede cambiarla. Si una propuesta se hizo sobre una versión que ya cambió, no se aprueba: devuélvela.
  - **Devolver** con un comentario: la jefa lo ve en Cocina y la corrige.
  - Si una aprobación se corta (internet), queda "Aprobándose" con **Volver a revisión** para reintentarla sin duplicar nada.
- **Materias primas pedidas**:
  - **nueva**: pones si es materia prima o insumo, la categoría, cómo se compra (kg, 25kg, lt, un, 10un…) y el **costo neto** de esa unidad → se crea en la planilla habilitada para el área y aparece en Cocina. Si ya existe con ese nombre, ofrece habilitarla;
  - **habilitar**: una que existe en otra área.
  - **No crear**: la jefa ve que no se creó.

Archivos: cambian `produccion.js`, `vista-produccion.js`, `produccion-modelo.js`, `app.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` (solo versión). Abajo a la izquierda debe decir **v0.33.0**.

## Novedades de la v0.32.0: Configuración de Producción
En **Producción**, una sección nueva, **Configuración de Producción**. La editas tú y las jefas la usan en Cocina sin poder cambiarla:
- **Panadería:**
  - días del pie de masa madre;
  - reserva (%);
  - masa madre madura (%);
  - agua del pie (%).
- **Bollería:**
  - **amasadora en kg de masa por tanda**: las tandas van en masas enteras; con 8 kg y masas de 1,6 kg son 5 por tanda. Si lo dejas vacío, se usa "masas por tanda" de la app actual;
  - tandas por día (Cocina avisa cuando un día se pasa);
  - merma de laminado (%), que se suma a las masas necesarias. Déjala en 0 si el rendimiento de la receta ya la considera;
  - capacidad de los congeladores, que se usará con la bitácora.

Lo que guardas aquí **no se pisa** al volver a copiar desde la planilla. "Mantequilla por empaste" no pasa: el empaste ya está en las recetas (30 g por croissant XL = 300 g por masa).

Archivos: cambian `produccion.js`, `vista-produccion.js`, `config.js`, `README.md` y los demás `.js` (solo versión). Sube todos a GitHub (`sistema-fen`). Abajo a la izquierda debe decir **v0.32.0**.

**Lista de verificación**
- [ ] Producción → Configuración de Producción → Bollería: pon la amasadora en kg → Guardar. Aparece "editada aquí".
- [ ] "Leer la planilla" → "Copiar": la amasadora sigue con tus kg.

## Novedades de la v0.31.0: Producción, base nueva (etapa P1)
Nueva sección **Producción** en el menú (la app actual sigue en "Abren la app actual"):
- **Conectar** la base nueva **fen-produccion**: pegas su firebaseConfig y entras con tu misma contraseña. Después entra sola al abrir Sistema Fën.
- **Cuentas de las áreas:** el UID de la cuenta de cada área (Panadería, Bollería, Pastelería, Cafetería). Con eso, cada tablet de la app **Cocina** ve y cambia solo lo de su área.
- **Copia desde la planilla:**
  - Copia recetas, materias primas **sin costos**, configuración de masa madre y poolish, planes semanales y quién entra a cada área con su PIN.
  - Se puede repetir las veces que haga falta.
  - Un plan que ya se cambió en Cocina **no se pisa**.
  - Nada se borra.
- **Control de totales:** recetas por área, materias primas, personas y unidades planificadas. Debe decir **Todo cuadra**.
- **Hoy:** aparecen las **recetas por aprobar** (además de las materias primas y las habilitaciones), con el script de Producción v2.3.0.

Archivos: **nuevos** `produccion.js`, `produccion-modelo.js`, `vista-produccion.js`, `firebase-produccion.js`. Cambian `app.js`, `index.html`, `config.js`, `README.md` y los demás `.js` (solo versión). Sube todos a GitHub (`sistema-fen`). Abajo a la izquierda debe decir **v0.31.0**. Incluye la v0.30.3.

Instalación completa de la etapa: ver el README de **fen-cocina v0.1.0** (Firebase, reglas, cuentas) y el del **script de Producción v2.3.0**.

## Novedades de la v0.30.3: la Nota de pedido de la factura, más ordenada
El botón **Llenar factura Fën** ahora pone **una sola** referencia "Nota de pedido" (802):

| Órdenes en la factura | Folio de referencia | Fecha | Razón de referencia |
|---|---|---|---|
| 1 | el N° de la orden (ej. `1201`) | la de la orden | vacía |
| 2 o más | `6 O.V. desde:` | la de la primera orden | `O.V. 1201, 1202, 1203, 1204, 1205, 1206` |
| muchas (no caben en 90 letras) | `23 O.V. desde:` | la de la primera orden | `O.V. N° 2539 a 2869 hasta el 21 oct · detalle en resumen adjunto` |

- Antes, con 2 o 3 órdenes iba una línea por orden. Ahora es siempre una sola línea.
- Si el formulario del SII no dejara escribir letras en el folio, el botón pone el N° de la primera orden y pasa el "6 O.V. desde …" a la razón.
- **Prueba una vez con "Validar y visualizar"** antes de emitir, para confirmar que el SII acepta el folio con letras.

**Importante: vuelve a dejar el botón en favoritos.** El botón guarda su código en el favorito, así que el viejo sigue haciendo lo de antes:
1. Borra el favorito "Llenar factura Fën".
2. En Sistema Fën → B2B → Por facturar → "Preparar para el SII" → "Primera vez: dejar el botón en favoritos", arrástralo de nuevo a la barra.

Archivos: cambian `sii-factura.js`, `app.js` (texto de ayuda), `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.30.3**. Incluye la v0.30.2. No cambian scripts ni reglas.

## Novedades de la v0.30.2: textos de los cargos sin desordenar los botones
- En Conciliación → Cargos, la propuesta de cada cargo ("Ya en Gastos: Factura N° … · clasificación") va **debajo de la descripción**, en su propia línea. El botón Confirmar queda siempre a la derecha, sin que el texto lo empuje ni se monte encima.
- Solo cambia cómo se ve. Gastos no tiene otros cambios (decisión: queda tal cual hasta pasarlo a Firebase).

Archivos: cambian `app.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.30.2**. Incluye la v0.30.1. No cambian los scripts.

## Novedades de la v0.30.1: cómo quedó clasificado el gasto, al cruzarlo con la cartola
- En Conciliación → Cargos, cuando un cargo es un gasto ya registrado ("Ya en Gastos"), la propuesta muestra la factura, el proveedor, la fecha y **cómo quedó clasificado**: cada ítem con su área, o con sus áreas y montos si se repartió.
  > Ya en Gastos: Factura N° 102 · Lácteos del Sur · del 6 oct · LACTEOS: PAN $8.000 · BOL $4.000 | ASEO · ADMIN
- Lo mismo en la lista "Es un gasto ya registrado" al abrir un cargo.
- Al confirmar, ese gasto queda con la huella de la cartola (columna Cartola: cartola, cuenta, operación), es decir: ingresado, clasificado y con su pago confirmado por el banco.
- Para ver las áreas hace falta el **script de Gastos v2.8.2** (incluye la v2.8.1). Sin él se ven solo los ítems.

Archivos: cambian `app.js`, `cartola.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.30.1**. Incluye la v0.30.0.

## Novedades de la v0.30.0: conciliación de cargos con menos trabajo
**Cargos de la cartola contra facturas ya pagadas** (compras al contado: supermercado, lácteos…):
- Si hay varias facturas del mismo monto (la leche o la mantequilla de cada semana), se propone **la de fecha más cercana** al cargo.
- Se confirma sola (en "Listos para confirmar") solo si es un calce claro:
  - el RUT de la transferencia es el del proveedor, **o**
  - la descripción del banco nombra al proveedor ("COMPRA … LACTEOS DEL SUR") y la factura es de hasta 3 días antes o después.

  Si dos facturas quedan igual de cerca, va a "Para revisar".
- La propuesta muestra **el N° de la factura**, el proveedor y la fecha: "Factura N° 102 · Lácteos del Sur · del 6 oct". Así sabes cuál es sin abrir nada. No hace falta poner el folio en el mensaje de la transferencia: la cartola no trae ese mensaje.

**Cargas del SII · proveedores a los que les postergas el pago:**
- Los que dan crédito formal (la factura trae vencimiento posterior) siguen entrando solos como **Pendiente** con su fecha.
- **Nuevo:** si el documento anterior de un proveedor quedó pendiente en Gastos, el nuevo viene **sugerido como Pendiente** ("la vez anterior lo postergaste"). Tú eliges la fecha de pago. Si esta vez lo pagaste, toca "Pagada".
- Nada se marca pagada solo: lo que no es crédito ni postergado lo sigues marcando tú, como hoy.
- Para la sugerencia hace falta el **script de Gastos v2.8.1**. Sin él, todo funciona igual, solo que sin esa sugerencia.

Archivos: cambian `app.js`, `cartola.js`, `sii.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.30.0**. Script de Gastos v2.8.1: ver su README (Apps Script, nueva versión de la implementación). No cambian las reglas.

### Lista de verificación v0.30.0
- [ ] Un cargo de una compra al contado con descripción del proveedor aparece en "Listos para confirmar" con "Factura N° …".
- [ ] Dos compras iguales en días distintos: cada cargo propone la factura de su día.
- [ ] Con el script v2.8.1: al cargar del SII una factura de un proveedor postergado, viene "Pendiente" sugerido. Pon la fecha y se importa como vencimiento.

## Novedades de la v0.29.0: cartola y SII lado a lado en Conciliación → Cargos
- **Nueva tarjeta "Qué está cubierto"** en Conciliación → Cargos, con dos columnas:
  - **Cartola:** hasta dónde está revisada cada cuenta y los días que faltan.
  - **SII:** hasta qué fecha llegan los documentos cargados y cuántos faltan por importar a Gastos. Además, los últimos meses como etiquetas: verde (cargado), amarillo (con documentos por importar), rojo (mes sin carga).
- Si la cartola llega más lejos que las cargas del SII, avisa: los pagos de esos días aún no tienen su factura para cruzar.
- **Botón "Cargar del SII"** en la misma tarjeta. Abre aquí mismo la carga de Gastos → Cargas del SII: subes el archivo, clasificas e importas sin salir de Conciliación. Al terminar, la cobertura se actualiza sola.
- **Cargas del SII sigue en Gastos** como siempre, con su historial. Es la misma carga, no una copia: si la abres en un lugar, se cierra en el otro.

Archivos: cambian `app.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.29.0**. No cambian las reglas ni los scripts. Incluye la v0.28.x.

### Lista de verificación v0.29.0
- [ ] Conciliación → Cargos muestra "Qué está cubierto" con la cartola de cada cuenta y las cargas del SII por mes.
- [ ] "Cargar del SII": sube un archivo del SII, clasifica e importa. Al terminar, la tarjeta muestra los nuevos documentos.
- [ ] Gastos → Cargas del SII sigue igual.

## Novedades de la v0.28.4: menos gracia en la cobranza
La gracia depende de cómo factura el cliente (Clientes → Facturación):
- **Diaria y semanal: 1 día.** Si la factura no está pagada, al **2.º día** ya está en cobranza:
  - factura del lunes → en cobranza el miércoles;
  - factura del sábado → en cobranza el lunes.
- **Mensual: 3 días** (sin cambio).
- **Los que pagan a 30 días:** sin gracia, desde el día 31.
- Un cliente sin facturación anotada se trata como diaria.

La Agenda ("Entran a cobranza si no pagan") y el (i) de Cobranza usan la misma regla.

Archivos: cambian `app.js`, `b2b.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.28.4**. Incluye la v0.28.2.

## Novedades de la v0.28.2: recordatorios de cobranza
- **Tono amable:** igual que antes (folios, fechas y saldos, sin días de atraso).
- **Tono firme:** cada folio con sus días de atraso **en negrita** en WhatsApp: "• Folio N° 3456 del 26 de septiembre: $124.567 · *12 días de atraso*". Los días se cuentan desde el vencimiento (la fecha de la factura, o 30 días después para los clientes que pagan a 30 días).
- **Nueva casilla "Agregar lo que aún está en plazo"** (en la tarjeta del cliente, con cualquiera de los dos tonos): agrega un párrafo aparte con los folios que todavía no vencen, con su vencimiento y su propio total ("Total en plazo").

Archivos: cambian `app.js`, `b2b.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.28.2**. Incluye la v0.28.0.

## Novedades de la v0.28.0: la conciliación ya no fuerza calces
Antes, si un abono no calzaba con nada, se repartía por antigüedad y el folio quedaba "lleno" con lo que alcanzara. Parecía un calce sin serlo, y además no se miraban las fechas.
- **Fechas:** para cruzar un pago solo cuentan los pedidos con fecha **hasta el día siguiente al pago**. Un día de margen, porque el comprobante puede llegar el 28 y la cartola mostrarlo el 29. Se usa la fecha del pedido, no la del folio, porque se puede pagar antes de facturar. Los folios con pedidos posteriores siguen en la lista, al final, más claros y con la nota "pedidos después del pago".
- **Se busca en este orden** (siempre con pedidos anteriores al pago):
  1. un folio completo;
  2. varios folios completos;
  3. folios completos más órdenes del siguiente;
  4. **una sola orden** que calce, la más antigua primero;
  5. si pagó más de lo que debe, todos sus folios y el resto a favor.

  Si hay un calce único, va a "Listos para confirmar".
- **Si no calza con nada, no se propone nada.** La tarjeta dice "No calza con ningún folio ni orden pedida hasta el …" y queda en ti:
  - tocar un folio para dejarlo como abono (cuotas);
  - o marcar "Ya estaba registrado".
- **Pagos ya registrados con el mismo monto:** se avisan **todos** los del cliente desde 15 días antes del pago hasta 3 días después, con su folio y fecha, y con $3 de margen por el redondeo. Si no calza con nada y hay alguno, **"Ya estaba registrado" pasa a ser el botón principal.**

Archivos: cambian `app.js`, `b2b.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.28.0**. No cambian las reglas ni los scripts. Incluye las versiones v0.24 a v0.27.

### Lista de verificación v0.28.0
- [ ] El abono de $140.111 del 10 sep (Café La Oveja) ya no se cruza con el folio 3370, que es de pedidos del 14 y 15 sep. Ese folio aparece al final y más claro.
- [ ] Un abono que calza con una sola orden de un folio de varias se propone con esa orden ("Paga la orden N° … del folio …").
- [ ] Un abono que no calza con nada no llena ningún folio. Si hay pagos ya registrados con ese monto, se listan y "Ya estaba registrado" se ve como botón principal.

## Novedades de la v0.27.0: RUT de quien transfiere (archivo "Transferencias recibidas")
La cartola no trae el RUT de quien transfiere: solo la descripción, que el banco corta ("TEF DE PROSUMER SPA"). El archivo de BancoEstado **"Consulta de transferencias recibidas"** sí lo trae, junto con el nombre completo y el banco.
- **Se sube por el mismo botón** de Conciliación ("Elegir cartola"). Sistema Fën reconoce solo qué archivo es.
- Cada abono de la cartola se cruza con su transferencia por cuenta, monto y día (o ±1 día; desde la v0.63.4: desde 1 día antes hasta 3 días hábiles después). Si hay dos iguales, desempata por el nombre. El abono muestra: "Transfirió: NOMBRE COMPLETO · RUT · Banco · hora".
- **Si el RUT es el de un cliente** (Clientes → RUT), el abono se reconoce solo. El RUT pesa más que lo aprendido por el nombre.
- **Si el RUT no es de ningún cliente** (por ejemplo, paga el dueño con su cuenta personal), al elegir el cliente y confirmar se aprende ese RUT. La próxima vez se reconoce solo.
- Se guardan las transferencias de los últimos 180 días, en la base de B2B (no en GitHub). Subir el mismo archivo otra vez no repite nada.
- Lo práctico: baja el archivo de transferencias con las mismas fechas de la cartola y súbelo **después** de la cartola, o antes: el cruce se hace igual.

Archivos: cambian `app.js`, `b2b.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.27.0**. No cambian las reglas ni los scripts. Incluye la v0.26.0, la v0.25.0 y la v0.24.x.

### Lista de verificación v0.27.0
- [ ] Subir el archivo de transferencias recibidas: el mensaje dice cuántas transferencias trae y cuántas son nuevas.
- [ ] Los abonos de "Sin cliente" muestran "Transfirió: … · RUT …".
- [ ] Un abono de un cliente con RUT en Clientes pasa a "Listos para confirmar" o a "Para revisar" con su nombre.
- [ ] Elegir el cliente de uno con RUT desconocido y confirmar. La próxima vez que aparezca ese RUT, se reconoce solo.

## Novedades de la v0.26.0: pagos por orden dentro de un folio
Para los clientes que pagan por pedido aunque la factura junte varias órdenes.
- **Conciliación → cada folio de más de una orden** tiene un desplegable discreto ("3 órdenes"). Muestra cada orden con su N°, fecha y monto, y las que ya están pagadas.
  - Marca las órdenes que paga el abono: el monto del folio se llena solo.
  - Si marcas todas las que faltan, se usa el saldo de la factura, así que el redondeo queda cuadrado.
- **La conciliación lo propone sola:** prueba los folios más antiguos completos más algunas órdenes del folio siguiente. Ejemplo: $15.494 = folio 3398 completo + orden N° 2535 del folio 3439. Si hay una sola forma de calzar, va a **"Listos para confirmar"**.
- **El abono guarda qué órdenes pagó.** También lo dice en su referencia de la planilla: "orden N° 2535".
- **Cobranza:**
  - El folio muestra "Pagadas: N° 2535 (1 oct) · faltan: N° 2541, 2550".
  - El recordatorio dice "Folio N° 3439: $16.590 (saldo) (órdenes N° 2541 y 2550)".
  - Si el folio solo tiene abonos sueltos, muestra "Abonado $X de $Y".
- **Abonos que no calzan con órdenes** (cuotas, por ejemplo: un cliente a 30 días que divide la factura en 3 o 4 pagos): escribe el monto en el folio como siempre y queda como abono al folio, sin órdenes. Cobranza muestra lo abonado y el saldo. El folio entra a cobranza solo si el día 31 todavía tiene saldo.
- **En la planilla no cambia nada:** todas las órdenes del folio quedan "PARCIAL" hasta completarlo (decisión de Emmanuel). El detalle de qué orden se pagó vive en Sistema Fën.

Archivos: cambian `app.js`, `b2b.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.26.0**. No cambian las reglas ni los scripts. Incluye la v0.25.0 y la v0.24.x.

### Lista de verificación v0.26.0
- [ ] Un abono como el de Café Rivoz (un folio + una orden del siguiente) aparece en "Listos para confirmar" con el motivo "Paga el folio … y la orden N° … del folio …".
- [ ] En un abono por revisar, abrir "N órdenes" y marcar una orden: el monto del folio se llena con esa orden.
- [ ] Después de confirmar, en Cobranza el folio dice "Pagadas: N° … · faltan: …".
- [ ] Un abono de cuota (monto suelto) escrito a mano en el folio queda como abono y Cobranza muestra "Abonado $X de $Y".

## Novedades de la v0.25.0: se cobra el total de la factura (adiós a los ±$1)
**Por qué había descuadres:** cada orden calcula su IVA y lo redondea. La factura del SII suma los netos de todas las órdenes y calcula el IVA **una sola vez**. Con varias órdenes, la factura puede ser $1 a $3 distinta de la suma de las órdenes. El cliente paga la factura, y antes Sistema Fën comparaba ese pago contra la suma de las órdenes: por eso quedaba +$1 a favor o −$1 por cobrar.

**Ahora, lo que se cobra de un folio es el total de la factura:**
- **Si el folio se asignó con el tercer toque del botón**, se usa el **TOTAL que leyó de la página del SII**. Queda guardado en el folio como el monto oficial.
- **Si se asignó a mano, o es un folio anterior**, se calcula igual que el SII:
  - una fila por producto y precio, con cantidad × precio redondeado;
  - el IVA una vez sobre el neto total.
- Por seguridad, si una orden no trae sus líneas, o el cálculo se aleja de la suma de las órdenes más de lo que explica el redondeo, se usa la suma de las órdenes, como antes.
- Si al traer el folio el total del SII **no calza** con el calculado (por ejemplo, cambiaste algo a mano en el SII), te avisa antes de asignar. El mensaje de la factura usa el total del SII.
- Se usa en todo:
  - Cobranza: saldo, recordatorio y estado de cuenta PDF.
  - Conciliación: el pago de la factura calza exacto y queda en "Listos para confirmar".
  - Pagado y Abono.
  - Saldo a favor.
  - Estado de cuenta.
- En Cobranza, cuando hay diferencia, el folio muestra una línea chica: "Factura $8.335 · órdenes $8.334 · ajuste de redondeo del IVA +$1".
- **Las órdenes y la planilla no cambian:** cada orden mantiene su total. Logística no cambia.

**Lo que quedó descuadrado antes:**
- **Folios en "parcial" a los que les faltaba $1 a $3:** aparecen en Cobranza → **"Pagados por el total de la factura"**. Con **Cerrar por redondeo** quedan PAGADO, con la fecha del último abono y la nota "Ajuste de redondeo de la factura". No se crea ningún abono. Si después deshaces ese abono en Conciliación, vuelven a parcial.
- **Saldos a favor de $1 a $3:** en Conciliación → Saldos a favor aparece **"Es redondeo"**. Lo cierra y queda anotado en el historial ("cerrado: era redondeo de la factura"). No se borra.

Archivos: cambian `app.js`, `b2b.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.25.0**. No cambian las reglas ni los scripts. Incluye la v0.24.x (si no instalaste la v0.24.2, reinstala el botón "Llenar factura Fën"; si no publicaste las reglas de fen-b2b v1.6.0, publícalas).

### Lista de verificación v0.25.0
- [ ] Cobranza → "Pagados por el total de la factura": aparecen los folios a los que les faltaba $1. "Cerrar por redondeo" los saca de la lista.
- [ ] Conciliación → Saldos a favor: un saldo de $1 muestra "Es redondeo" y al tocarlo desaparece. En el historial dice "cerrado: era redondeo".
- [ ] La próxima factura de varias órdenes: asígnala con el tercer toque. En Cobranza, el saldo es igual al total de la factura del SII.
- [ ] Cuando el cliente la pague, la conciliación propone el folio exacto, sin saldo a favor ni saldo pendiente.

## Novedades de la v0.24.3: "Ya estaba registrado" también aprende el cliente
- En Conciliación → Abonos, si eliges el cliente de un abono "Sin cliente" y después tocas **Ya estaba registrado**, ahora también queda aprendido quién pagó, igual que al confirmar. La próxima cartola lo reconoce sola. La ventana lo dice: "Queda aprendido que este abono es de …".
- Antes solo se aprendía al confirmar un pago, por eso el mismo pagador volvía a salir "Sin cliente".
- Si algo no se puede guardar en la conciliación, ahora aparece un aviso en pantalla (antes el error quedaba solo arriba, en la tarjeta de la cartola).

Archivos: cambian `app.js`, `b2b.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.24.3**. Incluye la v0.24.0 a v0.24.2 (si no instalaste la v0.24.2, reinstala el botón "Llenar factura Fën").

## Novedades de la v0.24.2: referencias más ordenadas en facturas de más de 3 órdenes
- **De 1 a 3 órdenes:** igual que antes, una Nota de pedido por orden, con su N° y su fecha.
- **Más de 3 órdenes:** **una sola referencia**. La Nota de pedido lleva el N° y la fecha de la primera orden, y en la razón van todas las órdenes. Ejemplo: "Órdenes N° 2539, 2549, 2561, 2575, 2589, 2606 y 2616 (1 al 7 oct)".
- **Si no caben** en los 90 caracteres del SII (una factura mensual, por ejemplo), la razón dice cuántas órdenes son, el período y del N° al N°. Ejemplo: "23 órdenes del 1 al 31 oct · N° 2539 a 2876 · detalle en resumen adjunto". En ese caso, el aviso del botón te recuerda enviar el **PDF resumen** (Por facturar → "PDF de N" → Resumen) junto con la factura.
- Si quedaban líneas de referencia llenas de una vez anterior, el botón las deja vacías.
- **Hay que reinstalar el botón "Llenar factura Fën"** (cambió): borra el favorito antiguo y arrastra el nuevo desde Preparar para el SII → "Primera vez: dejar el botón en favoritos".

Archivos: cambian `sii-factura.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.24.2**. Incluye la v0.24.1 y la v0.24.0 (Cobranza: reglas de fen-b2b v1.6.0).

## Novedades de la v0.24.1: botón del SII sin "Error 501"
- El botón **"Ir a la pestaña del SII"** (en Preparar para el SII) ya no carga el formulario directo. Desde Sistema Fën, el SII no recibe tu sesión y responde "Error 501 · ptr NULL (ptrTkn)", aunque tengas la sesión abierta.
- Si la pestaña del SII que abrió este botón ya está abierta, te lleva a ella **sin recargarla**.
- Si no está abierta, abre la portada del SII. Ahí entras y vas por el menú a Factura electrónica → Emitir factura, **en esa misma pestaña**. Así, al final, el folio vuelve a la pestaña de Sistema Fën.
- El botón "Llenar factura Fën" no cambió: no hay que reinstalarlo.

Archivos: cambian `app.js`, `sii-factura.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.24.1**. Incluye la v0.24.0 (Cobranza): si no la habías instalado, publica también las reglas de fen-b2b v1.6.0 (ver abajo).

## Novedades de la v0.24.0: Cobranza, y la Agenda más rápida
**Ventas B2B → Cobranza** (pestaña nueva, segunda). "Por cobrar" salió de Órdenes y vive aquí. Órdenes queda con Por facturar.
- **Cuándo un folio pasa a cobranza.** Se cuenta desde la **fecha de la factura** (la fecha del folio):
  - Clientes que pagan diario, semanal o mensual: el folio vence ese mismo día. Tienen **3 días de gracia**: si no está pagado, entra a cobranza el **4.º día**. Ejemplo: factura del 26 de septiembre → en cobranza el 30.
  - Clientes que pagan **a 30 días**: vence 30 días después de la factura. **Sin gracia**: entra a cobranza al día siguiente (el día 31).
  - La frecuencia de pago de cada cliente se cambia en Clientes → Frecuencia de pago.
- **Una tarjeta por cliente** con sus folios: N°, fecha de la factura, días de atraso y saldo. Cada folio tiene sus botones **Abono** y **Pagado**. Los folios que todavía no vencen salen aparte, con el día en que entrarían.
- **Recordatorio en 2 tonos.** El **amable** se propone para el primer recordatorio. El **firme** se propone desde el segundo y lleva los datos para transferir, si están guardados. Puedes enviarlo con **Recordatorio por WhatsApp** o **Copiar mensaje**. Ejemplo del tono amable: "Hola Bárbara, según nuestra última revisión de pagos (hasta el 28 de septiembre), no hemos recibido el pago de: • Folio N° 3456 del 26 de septiembre: $124.567 … ¿Nos puedes indicar la fecha de pago?"
- **Antes de enviar, revisa la cartola.** Si toca conciliar, o si hay abonos de la cartola por revisar, te avisa: puede que el cliente ya haya pagado.
- **Estado de cuenta PDF**: el mismo de Estado de cuenta, solo con lo pendiente del cliente.
- **Compromiso de pago:** el cliente sale de la lista hasta esa fecha. Ese día aparece en la Agenda y, si no ha pagado, vuelve a la lista con una nota.
- **Dice que ya pagó:** el cliente sale de la lista hasta que concilies una cartola que llegue a ese día.
  - Si el pago aparece, al conciliar el folio queda pagado y el cliente sale de cobranza.
  - Si el pago no aparece, el cliente vuelve con la nota "la cartola no muestra ese pago".
- **Gestiones:** cada recordatorio, compromiso, nota o "dice que pagó" queda anotado en el cliente (fecha, tono, folios y monto). Nada se borra. Un recordatorio nuevo deja sin efecto el compromiso anterior, que sigue en las gestiones.
- **Hoy** muestra "N clientes en cobranza", sacado de la base nueva. Reemplaza el "Cobros atrasados" de la planilla.
- **La Agenda queda resumida:**
  - Hoy, una línea "Cobranza: N clientes".
  - Los compromisos de pago, en su día.
  - Los días en que un folio entraría a cobranza si no se paga.
  - Ya no hay un "Cobro …" por cada cliente.
- **La Agenda es más rápida.** Muestra al tiro lo tuyo y después agrega lo de Gastos y B2B, que demoran más: arriba dice "Cargando pagos, cobros y facturación…". Si cambias de mes y vuelves, lo de Gastos y B2B queda guardado 2 minutos. Se vuelve a leer al tiro cuando guardas algo en la Agenda, pagas un vencimiento o registras un pago o una gestión de cobranza.

### Instalación v0.24.0 (unos 5 minutos)
1. **Reglas de fen-b2b v1.6.0** (Firebase): en la consola de Firebase, proyecto **fen-b2b** → Firestore Database → Reglas → pega todo `firestore-b2b.rules` → **Publicar**. Sin estas reglas, Cobranza muestra los folios pero no guarda gestiones (lo avisa en rojo).
2. **Sistema Fën** (GitHub, repositorio `sistema-fen`): sube todos los archivos del zip. Cambian `app.js`, `b2b.js`, `estilos.css`, `firestore-b2b.rules`, `config.js`, `README.md`, y los demás `.js` e `index.html` (solo versión). Abajo a la izquierda debe decir **v0.24.0**.
3. El botón "Llenar factura Fën" **no cambió**: no hay que reinstalarlo. Los scripts de Apps Script tampoco cambian.

### Lista de verificación v0.24.0
- [ ] Ventas B2B muestra las pestañas Órdenes · **Cobranza** · Estado de cuenta · Buscar · Solicitudes · Análisis · Clientes · Productos.
- [ ] Órdenes ya no tiene "Por cobrar". En Cobranza están todos los folios sin pagar: en cobranza, esperando o aún no vencen.
- [ ] Un cliente diario con una factura de hace 4 días o más está en cobranza; uno a 30 días entra recién el día 31.
- [ ] "Copiar mensaje" con tono amable: el mensaje trae el nombre del contacto, los folios con fecha y saldo, y el total.
- [ ] Después del primer recordatorio, la tarjeta propone el tono firme.
- [ ] "Compromiso de pago" para pasado mañana: el cliente pasa a Esperando, y ese día sale en la Agenda.
- [ ] "Volver a cobrar" lo devuelve a la lista. En "Gestiones" queda todo.
- [ ] Hoy dice "N clientes en cobranza".
- [ ] La Agenda muestra primero lo tuyo y después agrega pagos, cobros y facturación.

## Novedades de la v0.23.0: menú ordenado según el trabajo
- **Conciliación tiene su propia sección** en el menú (entre Gastos y Ventas B2B), con dos pestañas: **Abonos (B2B)** (pagos de clientes) y **Cargos (Gastos)**. Arriba, en las dos, la misma tarjeta: subir la cartola (una vez, de cualquier cuenta), días de conciliar, cuentas que se revisan y hasta dónde está revisada cada cuenta. Cada pestaña muestra cuántos quedan por revisar. Nada de lo ya conciliado cambia: solo cambió de lugar.
- **Ventas B2B:** Órdenes · Estado de cuenta · Buscar · Solicitudes · Análisis · Clientes · Productos.
- **Gastos:** Vencimientos · Cargas del SII · Previred · Registrar · Registrados · Análisis · Obligaciones · Ítems.
- **Base nueva** pasó a **Configuración** (tarjeta "Ventas B2B · base nueva").
- **Hoy:** las solicitudes de logística suben al primer lugar de Pendientes.
- Los enlaces antiguos (#b2b/conciliacion, #gastos/cartola) llevan solos a la sección nueva. El botón "Llenar factura Fën" no cambió.

Archivos: cambian `app.js`, `b2b.js`, `index.html`, `config.js`, `README.md` y los demás `.js` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.23.0**. Incluye la v0.22.0 y anteriores.

## Novedades de la v0.22.0
- **El folio vuelve a la misma pestaña.** En la ventana de "Preparar para el SII" hay un botón nuevo: **Abrir el formulario del SII**. Si abres el SII con ese botón, en el tercer toque el folio llega a la pestaña de Sistema Fën que ya tenías abierta (aparece ahí la ventana "Folio N° … del SII"); no se abre otra. Si abriste el SII por tu cuenta, funciona como antes (pestaña nueva).
- **WhatsApp directo a WhatsApp Web** en el computador: ya no aparece la página que pregunta "abrir la aplicación o WhatsApp Web". Sistema Fën usa siempre la misma pestaña de WhatsApp Web que abrió. Si ya tenías WhatsApp Web abierto en otra pestaña, la primera vez WhatsApp pregunta "¿Usar aquí?": acepta y cierra la antigua. En el celular sigue abriendo la app.
- **Cobros de la Agenda:** al tocar "Cobro …" se abre Ventas B2B con **Por cobrar abierto y filtrado por ese cliente**, para registrar el pago o el abono ahí mismo.
- **Hay que reinstalar el botón "Llenar factura Fën"** (cambió): borra el favorito antiguo y arrastra el nuevo.

Archivos: cambian `sii-factura.js`, `app.js`, `b2b.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.22.0**. Incluye la v0.21.0 y anteriores.

## Novedades de la v0.21.0: mensaje de la factura más simple, y enviarla después de emitir
- **Mensaje nuevo** (Copiar mensaje, WhatsApp y después de emitir): "Hola Bárbara, te envío la factura N° 3448 por $45.220, de tu pedido del 3 de octubre de 2026 (orden N° 2559)." Con varias órdenes: "…con tus pedidos del 1 al 7 de octubre de 2026 (órdenes N° 2559, 2560 y 2561)." Si el cliente paga a 30 días, agrega "Vence el …".
- **Cierre que cambia cada día:** hay 3 cierres que se turnan (uno distinto cada día). Se cambian en Por facturar → **Editar mensaje**. Vienen: "Cualquier duda, me avisas. ¡Gracias por preferir Fën!", "Si algo no calza, me cuentas. ¡Que tengas un lindo día!" y "Quedo atento a cualquier consulta. ¡Gracias por confiar en Fën!".
- **Datos para transferir, solo en la primera factura** de un cliente (cuando no tiene facturas anteriores). Se escriben en Editar mensaje (se guardan en la base de B2B, no en GitHub). Vacío = nunca se envían.
- **Después de traer el folio del SII** (tercer toque del botón), la ventana ofrece **Enviar por WhatsApp** y **Copiar mensaje**, con el folio y el total ya puestos. Flujo: preparar → llenar en el SII → emitir → traer folio → enviar.
- El botón "Llenar factura Fën" no cambió: no hay que reinstalarlo.

Archivos: cambian `app.js`, `b2b.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.21.0**. Incluye la v0.20.0, v0.19.x y v0.18.x.

## Novedades de la v0.20.0: referencias, forma de pago y traer el folio del SII
El botón **Llenar factura Fën** ahora, en el segundo toque, además de los productos:
- **Referencias:** marca "Referencias" y pone una **Nota de pedido** (código 802) por cada orden, con su N° y su fecha, y la razón "Orden de venta N° …". El SII trae 3 líneas: si la factura junta más de 3 órdenes, la tercera dice "Órdenes de venta N° …, …" con el resto.
- **Forma de pago:** los clientes que **pagan a 30 días** (Clientes → Frecuencia de pago "30dias") van a **Crédito**, con "Info. Pago": vence 30 días después de la fecha de emisión, por el total con IVA, glosa "Pago a 30 días". **Todos los demás, Contado.**
- Más de 10 productos: usa el botón del SII "Agrega línea de Detalle".

**Traer el folio (tercer toque):** en la página del SII que dice "Documento tributario electrónico enviado exitosamente", toca **Llenar factura Fën** otra vez. Lee el N° de folio, la fecha y el total, y abre Sistema Fën (pestaña nueva) con una ventana "Folio N° … del SII" y las órdenes que preparaste ya marcadas. Revisas y tocas **Asignar folio** (si el total del SII no calza con las órdenes marcadas, avisa antes). Si preparaste la factura en otro computador o navegador, aparecen las órdenes sin folio de ese cliente para que marques tú.

**Hay que reinstalar el botón** (cambió otra vez): borra el favorito antiguo y arrastra el nuevo desde Preparar para el SII → "Primera vez: dejar el botón en favoritos".

Archivos: cambian `sii-factura.js`, `app.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.20.0**. Incluye la v0.19.x y la v0.18.x (va con el script de Gastos v2.8.0).

### Lista de verificación v0.20.0
- [ ] Reinstalar el botón.
- [ ] Un cliente a 30 días: el segundo toque deja Referencias (Nota de pedido + N° de orden) y Crédito con Info. Pago a 30 días.
- [ ] Un cliente al contado: Referencias y Contado, sin Info. Pago.
- [ ] Después de emitir, el tercer toque abre Sistema Fën con el folio y las órdenes marcadas; "Asignar folio" las deja en Por cobrar.

## Novedades de la v0.19.1
- **Ciudad del cliente** (Clientes → Editar datos y Nuevo cliente). El botón "Llenar factura Fën" la escribe en el formulario del SII si ese campo viene vacío.
- **Hay que reinstalar el botón** (el favorito cambió): borra el favorito "Llenar factura Fën" antiguo y arrastra el nuevo desde Por facturar → Preparar para el SII → "Primera vez: dejar el botón en favoritos".

Archivos: cambian `app.js`, `b2b.js`, `sii-factura.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.19.1**. La ciudad se guarda en Sistema Fën; a la planilla de B2B no se copia.

## Novedades de la v0.19.0: llenar la factura en el portal gratuito del SII (en prueba)
En Por facturar, en el panel "Para facturar", hay un botón nuevo: **Preparar para el SII**. Copia el RUT del cliente y el detalle (producto, cantidad y precio neto, igual que la tabla del panel).

En el computador, en el formulario de **Factura electrónica** del SII:
1. Toca **Llenar factura Fën** en la barra de favoritos: pone el RUT del cliente y el SII busca sus datos (razón social, dirección, giro).
2. Tócalo otra vez: pone los productos, cantidades y precios netos, y te muestra el neto de Sistema Fën junto al que calcula el SII.
3. Revisa y usa **Validar y visualizar** como siempre. Nada se emite solo.

**Primera vez:** al tocar "Preparar para el SII" se abre una ventana con "Primera vez: dejar el botón en favoritos". Muestra la barra de favoritos (Ctrl + Mayús + B) y arrastra el botón "Llenar factura Fën" hasta ella. El navegador puede pedir permiso para leer lo copiado: acepta, o pega el texto cuando lo pida.

Lo que hay que saber (está en prueba con tu formulario real):
- El formulario del SII trae 10 líneas. Si una factura tiene más productos, el botón intenta agregar líneas; si el SII no las acepta, te dice cuáles faltan.
- Los nombres de producto muy largos se cortan al largo que acepta el SII (te avisa cuáles).
- El botón solo escribe en el formulario abierto: no envía nada a ninguna parte. Solo funciona en el computador.
- Si el SII cambia su formulario, el botón avisa que no encontró los campos y hay que ajustarlo.

Archivos: archivo NUEVO `sii-factura.js`; cambian `app.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.19.0**. Incluye la v0.18.1 y la v0.18.0 (va con el **script de Gastos v2.8.0**).

## Novedades de la v0.18.1
- **Mensaje de la factura con el nombre del contacto** (Por facturar → Copiar mensaje y WhatsApp): "Hola Bárbara, envío factura N° 3448 de la orden de venta N° 2559…". Usa el primer nombre del campo **Contacto** del cliente (Clientes → Editar datos). Si el cliente no tiene contacto, queda "Hola, envío factura…".

Archivos: cambian `app.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.18.1**. Incluye todo lo de la v0.18.0 (si no la subiste, sube directo esta; igual va con el **script de Gastos v2.8.0**).

## Novedades de la v0.18.0: la cartola también para Gastos (cuenta corriente y Chequera)
**Una sola subida de la cartola** (desde B2B → Conciliación o desde Gastos → Cartola): los **abonos** van a B2B como siempre y los **cargos** a Gastos. Lee la cartola de la **cuenta corriente** (histórica y en línea) además de la Chequera Electrónica. Nada se cuenta dos veces aunque subas la histórica y la en línea de los mismos días.

**Gastos → Cartola** (pestaña nueva). Cada cargo se resuelve de una de cuatro formas:
- **Paga vencimientos:** uno o varios (obligaciones, compras a crédito, facturas del SII pendientes), con la **fecha del banco**. Los montos deben sumar el cargo. Una obligación pagada por otro monto (por ejemplo, el arriendo) usa lo del banco.
- **Ya está en Gastos:** un gasto al contado que registraste a mano; solo queda anotado (no se duplica).
- **Gasto nuevo:** ítem y área, sin foto (el respaldo es la cartola). "No lleva factura" para intereses, comisiones o impuestos.
- **No es gasto:** traspaso entre tus cuentas, retiro de socios… una vez o **siempre** (los próximos quedan ignorados solos).

Lo que se reconoce solo va a **Listos para confirmar** (un botón para todos): por **lo aprendido** (cada confirmación enseña), por el **RUT de la transferencia** (las facturas del SII de ese proveedor que suman exacto, las más antiguas primero) o por **un gasto del mismo monto**. El resto, a **Para revisar**, con los vencimientos más cercanos a la fecha primero.

**Trazabilidad:** cada gasto y cada vencimiento queda con una columna **"Cartola"** en la planilla, por ejemplo `Cartola N°012 · Cta. Cte. ···1234 · cargo 07-09-2026 · op. 5550101 · subida 08-10-2026 · SII: carga del 01-09-2026 al 30-09-2026 (archivo) [cc1a2b3c4d5e]`.

**Cruce con el SII:**
- **Pagado sin factura del SII:** gastos nuevos creados desde la cartola que aún no tienen su documento (posible IVA crédito que se pierde). Cuando llegue la factura, en Cargas del SII se vincula por el monto y el aviso se va.
- **Facturas del SII sin pago en la cartola:** facturas por pagar cuyo vencimiento ya está cubierto por las cartolas subidas.
- Si el RUT de una transferencia tiene documentos en una carga del SII **sin importar**, lo avisa para importarlos primero.

**Ya revisados:** buscar y **Deshacer** (pide motivo). Nada se borra: el cargo vuelve a revisar, el vencimiento queda por pagar (con el motivo en su observación) y un gasto creado aquí pasa a "Gastos anulados". **Lo aprendido:** se puede quitar.

**Conciliación (B2B):** cada cuenta tiene su "Revisado del… al…". Si usas las dos cuentas, aparecen los botones **Cuentas que se revisan**: los días de conciliar, cada cuenta marcada debe estar al día (Hoy dice cuál falta). Sin marcar, se revisan las que tienen una cartola de los últimos 60 días.

**Hoy:** "N cargos de la cartola por revisar" (con el script de Gastos v2.8.0).

Queda para más adelante (como acordamos): separar los intereses de las cuotas del crédito (por ahora la cuota entera es un gasto) y la tarjeta de crédito. También importar del SII sin decidir pagada/pendiente (que la cartola lo diga sola).

Archivos: archivo NUEVO `cartola.js`; cambian `b2b.js`, `app.js`, `gastos.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.18.0**. Va con el **script de Gastos v2.8.0** (incluye la v2.7.0 y la v2.6.0). Las reglas y el script de B2B no cambian.

### Lista de verificación v0.18.0
- [ ] Abajo a la izquierda dice v0.18.0 y el ping de Gastos dice 2.8.0.
- [ ] Gastos → Cartola → sube la cartola histórica de la cuenta corriente: dice cuántos cargos nuevos y que los abonos pasaron a B2B.
- [ ] Vuelve a subir la misma: "0 nuevos · N ya vistos".
- [ ] Resuelve un cargo de cada tipo y revisa en la planilla de Gastos la columna "Cartola" (Registro Gasto y Vencimientos).
- [ ] Deshaz uno: vuelve a "Para revisar".
- [ ] B2B → Conciliación: aparecen las dos cuentas con su "Revisado".

## Novedades de la v0.17.0: sugerencias al cargar del SII
Al subir un archivo del SII, cada documento nuevo viene **clasificado como lo hiciste antes** (marcado "Sugerido…", para revisar):
- **Por proveedor:** el ítem y el reparto por área que más usaste con ese RUT en los últimos 2 años, con las proporciones de la vez más reciente (por ejemplo ASEO, PAN 70% · BOL 30%). Dice cuántas veces de cuántas.
- **Por producto** (XML o XLS con detalle): cada producto con el ítem y área que le pusiste antes a ese mismo producto de ese proveedor; si es nuevo, lo más usado con ese proveedor. Llevan la marca "sugerido".
- Si cambias algo, la marca se va. Nada se importa sin que lo veas, y lo que importes queda como ejemplo para la próxima.
- Necesita el **script de Gastos v2.7.0**; sin él, la carga funciona igual pero sin sugerencias (lo avisa).

Archivos: cambian `sii.js`, `app.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.17.0**. Va con el **script de Gastos v2.7.0** (incluye la v2.6.0: si no la instalaste, instala directo esta). Incluye todo lo de la v0.16.x.

## Novedades de la v0.16.3
- **Copiar mensaje** (Por facturar, varias órdenes): cada orden va con la fecha corta: "Orden N° 2536, pedido del 1 oct, 2026" (antes "… del 1 de octubre de 2026.").

Archivos: cambian `app.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.16.3**. Incluye todo lo de la v0.16.2 y anteriores (scripts y reglas, igual que la v0.16.2).

## Novedades de la v0.16.2
- **Semana de lunes a domingo** para los clientes semanales: el sábado se marcan las órdenes de lunes a sábado; el domingo, también la del domingo (antes iba al sábado siguiente). En Hoy (script de B2B **v2.8.2**) quedan atrasadas desde el lunes.
- **Análisis:** cada cifra dice contra qué fechas compara (por ejemplo "1 sep al 8 sep: $1.360.009" en vez de "antes") y tiene su botón (i): Ventas, Órdenes, Ticket promedio, Pendiente de cobro, Caja real y Productos.

Archivos: cambian `b2b.js`, `app.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.16.2**. Va con el **script de B2B v2.8.2** (reemplaza a la v2.8.1: si no la instalaste, instala directo esta). Incluye todo lo de la v0.16.1 y v0.16.0.

## Novedades de la v0.16.1: cuándo se factura y cuándo se cobra
Reglas de Fën (8 de octubre):

| Cliente | Se factura | Se cobra |
| --- | --- | --- |
| Diaria | el mismo día | desde el día de la factura |
| Semanal | semana de **lunes a domingo**: el **sábado** (o el domingo); la orden del domingo, ese mismo domingo | desde el día de la factura |
| Mensual | el **último día del mes** (así el IVA le queda en ese mes) | el mismo día de la factura |
| 30 días (frecuencia de pago) | según cómo factura | 30 días después de la factura (entre medio se registran abonos) |

Esto cambia:
- **"Marcar las que tocan"** (Por facturar): diaria marca también las de hoy; semanal, desde el sábado, las de esa semana; mensual, el último día, todas las del mes.
- **Agenda:** "Facturar" sale de lunes a sábado (diarios), los sábados (semanales) y el último día del mes (mensuales). Los cobros salen el día de la factura (o a los 30 días); lo no pagado queda en rojo suave.
- **Clientes:** "acordado" pasa a "al día" para diaria, semanal y mensual (30 días sigue en 30).
- **Hoy** (necesita el **script de B2B v2.8.1**): una orden sin factura cuenta como atrasada si pasó su día de facturar (la semanal, desde el lunes); en cobros entran solo los folios ya facturados, desde la fecha de la factura (o pasados los 30 días).

Archivos: cambian `b2b.js`, `app.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.16.1**. Junto con esta va el script de B2B v2.8.1 (ahora v2.8.2). Si no instalaste la v0.16.0, haz también su paso del script de Gastos v2.6.0.

## Novedades de la v0.16.0: agenda para planificar el trabajo de oficina
- **Etiquetas con color** (Conciliación, Cargas del SII, Reuniones, Cobranza, Marketing, Habilitación, Revisión de apps, y las que crees). Se crean desde el mismo modal de agregar ("+ Nueva") o con el botón **Etiquetas** (cambiar nombre, color o archivar; no se borran).
- **Desde / Hasta:** algo puede durar varios días (aparece en cada día).
- **Se repite:** cada semana (eliges los días, por ejemplo lunes y jueves) o cada mes (el mismo día, del 1 al 28), con fecha de término opcional. "Hecho" y "Quitar este día" son solo de ese día; "Quitar todos" quita la serie. Al cambiarlo, cambia la serie entera.
- **Aparece solo, cada uno con su color:**
  - **Pagos de Gastos:** los vencimientos (los **vencidos sin pago en rojo suave**) y los **próximos pagos de cada obligación** con borde punteado. Antes, un pago recién aparecía 3 días antes de su fecha (así se generan); por eso el IVA no se veía en el mes. Ahora se ve desde antes. Si una obligación no aparece, revisa que esté activa en Gastos → Obligaciones.
  - **Cobros B2B:** el día que le toca pagar a cada cliente (fecha de la factura + su frecuencia de pago: diaria el mismo día, semanal 7 días, mensual 30 días), agrupado por cliente; los atrasados en rojo suave.
  - **Facturar:** hoy, cuántas órdenes ya toca facturar; hacia adelante, lunes a sábado (clientes de facturación diaria), los lunes los semanales y el 1 los mensuales.
  - **Conciliar:** los días de conciliar que fijaste en Conciliación (los pasados quedan hechos si la cartola ya cubre hasta el día anterior).
  - **Análisis:** cada lunes, revisar el análisis de ventas de la semana pasada.
  - Cobros, facturar y conciliar necesitan la base nueva de B2B conectada en ese equipo.
- **Mostrar:** botones para esconder o mostrar cada tipo y cada etiqueta (se recuerda en ese equipo).
- **Google Calendar:** lo que marques "Copiar a mi Google Calendar" queda en un calendario aparte llamado **"Fën"**, con el **aviso** que elijas (30 minutos antes, 1 día antes… o, si no tiene hora, el día anterior a las 18:00 o a las 9:00). Si lo cambias o lo quitas aquí, allá también. Lo hace el script de Gastos v2.6.0 con tu cuenta de Google. Lo automático (pagos, cobros…) no se copia. Lo agendado antes de esta versión no se copia hasta que lo abras y lo marques.

Archivos: cambian `agenda.js`, `app.js`, `b2b.js`, `gastos.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Las reglas de Firestore no cambian.

### Instalación de la v0.16.0 (unos 10 minutos)
1. **Script de Gastos v2.6.0 (Apps Script de Gastos):** sigue el README del zip `gastos-script-v2.6.0` (archivo nuevo `Calendario.gs`, dar el permiso de Google Calendar una vez, nueva versión de la implementación). El ping debe decir **2.6.0**.
2. **GitHub, repo `sistema-fen`:** sube todos los archivos del zip. Abajo a la izquierda debe decir **v0.17.0**.

### Lista de verificación
- [ ] Agenda: aparecen los pagos de Gastos (vencidos en rojo suave) y los próximos pagos con borde punteado (el IVA, si está como obligación).
- [ ] Con la base nueva de B2B conectada: aparecen cobros, facturar, conciliar (lunes y jueves) y análisis (lunes).
- [ ] Agregar "Revisar conciliaciones", etiqueta nueva, cada semana lunes y jueves, a las 9:00, con aviso de 30 minutos y "Copiar a mi Google Calendar": arriba dice "Google Calendar al día" y en tu Google Calendar aparece el calendario **Fën** con la serie.
- [ ] "Quitar este día" en uno de esos días: desaparece aquí y en Google.
- [ ] Los botones de "Mostrar" esconden y muestran.

## Novedades de la v0.15.2: PDF más limpios y conciliación más rápida
- **PDF nuevos (diseño "compacto")**, pensados para leerse bien en el celular cuando llegan por WhatsApp:
  - **Orden de venta:** el total con IVA grande arriba (con neto, IVA, folio y estado de pago al lado) y los productos en un recuadro con "Neto" sobre los montos, cada uno con "12 × $1.200" debajo. Si la orden se editó, el producto dice "eran 10, se agregaron 2"; uno que se sacó aparece tachado ("eran 5, se devolvieron todos"). Cliente, notas y cambios al final. La anulada sigue con su sello.
  - **Estado de cuenta:** lo pendiente de pago grande arriba; recuadros "Por pagar" (con el saldo y los abonos) y "Pagadas" (con la fecha de pago).
  - **Resumen de varias órdenes:** el total con IVA arriba, primero el **total por producto** (lo que necesitas para facturar) y después el detalle por orden.
  - La letra es Manrope (se carga de Google Fonts la primera vez; sin internet usa una parecida del equipo).
- **Conciliación:** al revisar un abono, **toca el folio** y se le pone su saldo (o lo que queda del abono, si es menos); tócalo otra vez y queda en 0. Ya no hay que escribir el monto a mano (igual se puede).

Archivos: cambian `pdf-orden.js`, `app.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.15.2**. Junto con esta va la **app de logística v1.2.1** (el mismo PDF de la orden). Reglas y script, sin cambios respecto de la v0.15.0 (si no la habías instalado, haz sus pasos 1 y 2).

## Novedades de la v0.15.1: búsquedas
- **Por cobrar · lupa:** no escondía nada (las filas de los folios tapaban el "esconder"). Ahora filtra por cliente, folio o N° de orden.
- **Buscar:** también por **nombre del cliente** (o razón social, sin importar tildes ni mayúsculas); al escribir sugiere los clientes. Se puede juntar con un mes: "Café Uno 2026-09". Si el texto calza con varios clientes, los muestra todos (hasta 5). Un cliente sin mes trae todas sus órdenes (una lectura por orden).

Archivos: cambian `app.js`, `b2b.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos a GitHub (`sistema-fen`); abajo a la izquierda debe decir **v0.15.1**. Si todavía no instalabas la v0.15.0, haz sus pasos 1 y 2 (reglas y script) y sube esta en vez de esa. Reglas y script, sin cambios respecto de la v0.15.0.

## Novedades de la v0.15.0: la conciliación como forma principal de registrar pagos
Las transferencias se registran conciliando la cartola (con la fecha del banco). En Por cobrar quedan los pagos en efectivo u otro medio.

- **Días de conciliar** (Conciliación, bajo "Elegir cartola"): por defecto lunes y jueves; se cambian tocando las letras. Esos días, si la cartola no está revisada hasta el día anterior, **Hoy** avisa "Toca conciliar la cartola" con las fechas a bajar. El aviso se va solo al subir la cartola.
- **Saldo a favor:** si un abono trae más que los folios del cliente (pagó de más, o pagó antes de la factura), lo que sobra puede quedar como saldo a favor. La casilla viene marcada cuando pagó de más; si no se asigna a ningún folio o parece un pago ya registrado, hay que marcarla a mano. Los saldos aparecen en **"Saldos a favor"** con un botón "Usar $…" por cada folio por cobrar de ese cliente: queda como abono con la fecha del banco y, si completa el folio, lo deja pagado. En Por cobrar, el folio de un cliente con saldo muestra "A favor $…".
- **Ya conciliados** (al final de Conciliación): los abonos de la cartola ya resueltos (60 días, con "Ver 60 días más" y búsqueda por cliente, folio, monto o descripción). Muestra a qué folios fue cada uno.
- **Deshacer:** devuelve el abono a "Para revisar". Sus folios vuelven a Por cobrar como estaban, los abonos que se crearon quedan **anulados** (no se borran) y, si se había aprendido el cliente por ese nombre, se olvida. No deja deshacer si después hubo otro pago en el mismo folio (avisa cuál deshacer primero), ni si se usó su saldo a favor (primero se deshace ese uso, con su propio "Deshacer"). Lo conciliado en la app antigua no se deshace aquí. En la planilla, el abono anulado pasa a la hoja "Abonos anulados" y la fila del historial a "ConciliacionBancaria_Deshechos".
- **Por cobrar** dice hasta qué fecha están revisadas las transferencias (lo pagado después aparece al conciliar) y cuántos abonos de la cartola faltan por revisar, con enlace a Conciliación.
- **Pagado y Abono** (Por cobrar) vienen con **Efectivo** por defecto.

Archivos: cambian `app.js`, `b2b.js`, `estilos.css`, `firestore-b2b.rules`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Junto con esta va el **script de B2B v2.8.0** (zip aparte).

### Instalación de la v0.15.0 (en este orden, unos 10 minutos)
1. **Reglas de fen-b2b (consola de Firebase):** proyecto **fen-b2b** → Firestore Database → Reglas → borra todo, pega el contenido de `firestore-b2b.rules` (v1.5.0) → **Publicar**.
2. **Script de B2B v2.8.0 (Apps Script):** sigue el README del zip `b2b-script-v2.8.0` (reemplazar `Seguridad.gs` y `SistemaFen.gs`, nueva versión de la implementación). El ping debe decir **2.8.0**.
3. **GitHub, repo `sistema-fen`:** sube todos los archivos de esta carpeta (reemplazan a los de antes) → Commit. A los minutos, abajo a la izquierda debe decir **v0.16.0** (si no, recarga con Ctrl+Shift+R o cierra y abre en el celular).

### Lista de verificación
- [ ] Abajo a la izquierda dice v0.15.0.
- [ ] Conciliación muestra "Días de conciliar" con L y J marcados, y dice "Toca conciliar" o "Al día".
- [ ] Al abrir "Ya conciliados" aparecen los abonos de los últimos 60 días.
- [ ] (Si hay uno de prueba) Deshacer un abono y volver a confirmarlo: el folio queda igual que antes y en la planilla la fila del historial se actualiza.
- [ ] Por cobrar dice "Transferencias revisadas hasta el …".
- [ ] Si algo dice "el script de B2B debe estar en v2.8.0": falta el paso 2.

### Si algo sale mal
- App: en GitHub, vuelve a subir los archivos del zip v0.14.5.
- Reglas: en la consola de Firebase, Reglas → historial → la versión anterior → Publicar (la v1.4.0 sigue sirviendo para todo lo de antes; solo no deja deshacer).
- Script: Implementar → Gestionar implementaciones → lápiz → versión anterior → Implementar.

## Novedades de la v0.14.5: orden en Por facturar y Por cobrar, medio de pago y seguimiento de cartolas
- **Por facturar:** cada cliente se pliega. Cerrado muestra su nombre, cuántas órdenes, el total, cómo factura y el período de sus pedidos, con sus botones; al abrirlo se ven sus órdenes. Al marcar órdenes queda abierto con el resumen para facturar.
- **Lupa** (discreta, al lado del título) en Por facturar y Por cobrar: busca por cliente, N° de orden o folio.
- **Por cobrar:** cada folio muestra debajo, más chico, la **fecha de la factura** (y hace cuántos días) y el **período de los pedidos**. Ordenados del más antiguo al más nuevo.
- **Pagado y Abono** piden el **medio de pago** (transferencia, efectivo, cheque, tarjeta u otro) y una referencia opcional. Lo que se concilia con la cartola queda como **transferencia**.
- **Conciliación:** queda anotada cada cartola que subes (histórica con su N°, o en línea), con su período y cuántos abonos traía. Arriba dice **qué período ya está revisado**, **desde qué fecha** bajar la próxima cartola y si **falta algún período** entre medio. También se anota el período de lo que se trajo de la app antigua.

Archivos: los de la v0.14.5 van incluidos en la v0.15.0.

## Novedades de la v0.14.4: folio y WhatsApp al facturar
En **"Para facturar"** (Por facturar, con órdenes marcadas):
- **Folio SII:** una casilla al lado de "Copiar mensaje". Escribes ahí el folio de la factura que acabas de hacer en el SII: el mensaje pasa a decir "envío factura N° 5512 …" y al presionar **Asignar folio** la ventana ya trae ese número.
- **WhatsApp:** abre WhatsApp con el mensaje ya escrito.
  - Si el cliente tiene **celular** guardado: se abre su chat directo; solo presionas enviar (y adjuntas la factura).
  - Si tiene **grupo**: el mensaje se copia y se abre el grupo; lo pegas (mantener presionado → Pegar). WhatsApp no deja abrir un grupo con el mensaje ya escrito.
  - Si no tiene ninguno: se abre WhatsApp para que elijas el chat, con el mensaje escrito.
- **Clientes → Editar datos** tiene dos campos nuevos: **WhatsApp (celular)** y **Grupo de WhatsApp (enlace)**. El enlace del grupo se saca en WhatsApp: datos del grupo → Invitar con enlace → Copiar enlace. Si tiene los dos, se usa el grupo. La app de logística también los usa.

Archivos: cambian `app.js`, `b2b.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos. Incluye desde la v0.14.0. Junto con esta va la **app de logística v1.2.0** (enviar la orden por WhatsApp).

## Novedades de la v0.14.3: resumen para facturar
En **Por facturar**, al marcar órdenes de un cliente aparece en pantalla **"Para facturar"**: una fila por producto con la **cantidad total** de las órdenes marcadas (por ejemplo, 5 panes el martes y 6 el miércoles = 11), su precio neto y el total neto; abajo **Neto, IVA (19%) y Total**, listos para hacer la factura en el SII. Si un producto tuvo dos precios distintos en esas órdenes, sale en dos filas (así calza con la factura). El IVA se calcula sobre el neto total, como en la factura; si por redondeo no coincide al peso con la suma de las órdenes, lo avisa.

**Copiar mensaje** copia el texto para mandar con la factura:
- Una orden: "Hola, envío factura de la orden de venta N° 1234, pedido del 3 de octubre de 2026."
- Varias: "Hola, envío factura del período de pedidos del 3 al 6 de octubre de 2026. Las órdenes incluidas son:" y una línea por orden ("Orden N° 1234, pedido del 3 de octubre de 2026.").

Archivos: cambian `app.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos. Incluye la v0.14.0, v0.14.1 y v0.14.2.

## Novedades de la v0.14.2: PDF de varias órdenes
En **Por facturar**, al marcar órdenes de un cliente aparece **PDF de N** junto a "Asignar folio". Eliges:
- **Una hoja por orden:** cada orden igual a su PDF de siempre (con su historial de cambios si lo tiene), todas en un solo archivo. Se llama "Ordenes_<primera>-<última>_<cliente>.pdf".
- **Resumen:** el detalle de cada orden una tras otra (fecha, productos, cantidades, precios), el **total por producto** y el **total a facturar** (neto, IVA y total). Se llama "Resumen_ordenes_<primera>-<última>_<cliente>.pdf".

Archivos: cambian `app.js`, `pdf-orden.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos. Incluye todo lo de la v0.14.1 y v0.14.0: si no las habías instalado, sigue sus pasos (más abajo) y sube esta en vez de esas; abajo a la izquierda debe decir **v0.14.5**.

## Novedades de la v0.14.1: análisis de B2B
Pestaña nueva **Análisis** en Ventas B2B:
- **Período:** hoy, ayer, esta semana, semana pasada, este mes, mes pasado u otras fechas; todos los clientes o uno.
- **Resumen:** ventas en neto, órdenes, ticket promedio y pendiente de cobro, cada uno comparado con el período anterior del mismo largo (este mes se compara con los mismos días del mes pasado). Abajo, total con IVA, facturado y sin factura.
- **Caja real:** lo que efectivamente entró en el período, por fecha de pago (con la conciliación, la del banco): pagos de ventas del período, pagos de ventas anteriores (con de qué meses vienen) y abonos, cada uno en su fecha.
- **Productos:** **Ranking** (unidades, neto, % del total y si subió o bajó), **Por día de la semana** (promedio de unidades de cada día; lo más alto marcado), **Precio real** (neto promedio por unidad frente al precio base) y, con un cliente elegido, **Qué dejó de pedir** frente al período anterior.

También:
- **Ventas B2B lee menos:** las órdenes "recientes" que se escuchan en vivo son las de 7 días (antes 30); lo pendiente llega igual por sus propias consultas. Importa cuando B2B crezca.
- **Base nueva → Planilla** (necesita el script de B2B **v2.7.0**):
  - **Hojas para Producción** (ventas por receta, total de ventas y cobros por mes): desde el cambio del 6 de octubre no se generaban (eran botones de la app antigua). Ahora el script las genera **solo cada noche** y aquí se pueden generar cuando quieras.
  - **Filas repetidas en Detalle Ventas:** "Revisar" cuenta cuántas filas de órdenes ya archivadas siguen repetidas; "Sacar N filas" las saca, solo las idénticas al histórico, y antes guarda una copia completa de la hoja ("Detalle Ventas respaldo …"). Además, esas filas repetidas inflaban las ventas por receta que lee Producción: después de sacarlas, genera las hojas de nuevo.
- En pantalla grande, las pestañas de Ventas B2B pasan a una segunda línea en vez de esconderse.

Archivos: cambian `app.js`, `b2b.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos.

### Instalación de la v0.14.1
Si ya instalaste la v0.14.0: 1) script de B2B **v2.7.0** (su README; incluye ejecutar una vez `instalarTareaNocturna`), 2) GitHub, sube todos los archivos; abajo debe decir **v0.14.5**. Las reglas no cambian.

Si todavía no instalabas la v0.14.0, sigue sus pasos (más abajo) usando el script **v2.7.0** en vez del v2.6.0.

### Lista de verificación
- [ ] Análisis → Este mes: las ventas cuadran con lo que esperas; Caja real muestra lo que entró.
- [ ] Base nueva → Planilla → Generar ahora: "Generadas recién · se generan solas cada noche".
- [ ] Revisar filas repetidas → Sacar → en la planilla aparece la hoja "Detalle Ventas respaldo …" y Detalle Ventas queda más corta. Luego Generar ahora.

## Novedades de la v0.14.0: conciliación bancaria con la cartola
Ventas B2B tiene una pestaña nueva, **Conciliación** (con el número de abonos por revisar):

1. **Cargar cartola:** la de BancoEstado tal como la descargas, **histórica o en línea** (.xlsx). Se pueden subir las dos aunque se repitan días: cada abono se reconoce por su "huella" (fecha, saldo, monto y descripción, la misma de la app antigua) y nunca se cuenta dos veces. Solo se miran los abonos; Transbank y lo que marques "No es de B2B" se ignoran.
2. **Listos para confirmar:** el cliente se reconoció con seguridad (por lo aprendido, por el **RUT** de la descripción o por su nombre completo) y el monto **calza exacto** con un folio, o con una sola combinación de folios. Revisas y confirmas uno por uno o **todos juntos**.
3. **Para revisar:** el monto no calza exacto (un pago de varias facturas, un abono parcial) o hay alguna duda. Viene una propuesta (**los folios más antiguos primero**) que puedes cambiar folio por folio; abajo dice cuánto queda sin asignar. También avisa si ya hay un pago registrado del mismo monto ("¿ya estaba registrado?").
4. **Sin cliente:** eliges el cliente y **se aprende** para la próxima.
5. Para cada abono también: **Ya estaba registrado** (no registra nada; por ejemplo, un pago que anotaste a mano) o **No es de B2B** (con la opción de ignorar siempre los que digan lo mismo).

Al confirmar, el pago queda con **la fecha del banco**: si cubre el saldo del folio queda **PAGADO**; si no, es un **abono** (PARCIAL). Todo junto o nada: no puede quedar a medias, y un abono ya conciliado no se puede aplicar dos veces (ni desde dos equipos). Todo pasa solo a la planilla, incluido el historial de la conciliación. **Hoy** muestra cuántos abonos de la cartola faltan por revisar.

(i) **Antes de la primera cartola**, la pestaña pide **traer lo de la app antigua** (una sola vez): lo ya conciliado, los nombres aprendidos, lo que se ignora y los abonos que quedaron por revisar. Así nada se repite.

(i) **El nombre solo en parte no se confirma solo:** el banco corta la descripción a unas 35 letras. Si el cliente se reconoce solo por el comienzo de su nombre, el abono queda en "Para revisar" para que lo confirmes tú.

(i) **Ya no se guarda una copia de la cartola en Drive** (lo hacía la app antigua): cada abono queda en la base nueva y en la hoja ConciliacionBancaria_Historial de la planilla.

(i) **Lo que todavía queda en la app antigua (solo para mirar):** el análisis (llega en la v0.14.1).

Archivos: cambian `app.js`, `b2b.js`, `estilos.css`, `config.js`, `firestore-b2b.rules` (v1.4.0), `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos.

### Instalación de la v0.14.0 (en este orden, unos 10 minutos)
1. **Script de B2B v2.6.0** (zip `b2b-script-v2.6.0`): sigue su README. El ping debe decir **2.6.0**.
2. **Reglas de fen-b2b v1.4.0**: consola de Firebase → proyecto **fen-b2b** → Firestore Database → **Reglas** → borra todo, pega el contenido de `firestore-b2b.rules` → **Publicar**.
3. **GitHub, repo `sistema-fen`**: sube todos los archivos del zip (reemplazando). Recarga con Ctrl + Shift + R; abajo a la izquierda debe decir **v0.14.5**.
4. En **Ventas B2B → Conciliación** presiona **Traer lo de la app antigua** (una vez).

### Lista de verificación
- [ ] Después de traer lo de la app antigua, sube la última cartola histórica que ya habías conciliado allá: casi todo debe salir como "ya visto antes".
- [ ] Sube la cartola en línea de hoy: los abonos nuevos aparecen en Listos para confirmar, Para revisar o Sin cliente.
- [ ] Confirma uno que calce exacto: el folio pasa a PAGADO con la fecha del banco (Por cobrar y la planilla).
- [ ] Un abono parcial queda como abono (PARCIAL) y el folio sigue en Por cobrar con su saldo.
- [ ] Hoy muestra los abonos que faltan por revisar.

## Novedades de la v0.13.2: cuánto aporta y cómo paga cada cliente
En **Ventas B2B → Clientes**, cada cliente muestra en su línea:
- **Mes ant.** (lo que compró el mes pasado) y **prom. 3 meses** (los 3 meses cerrados), en **neto**. Una flecha ↑ o ↓ si el mes pasado cambió más de un 20%, y su **% del total B2B**.
- **Semáforo de pago** a la derecha: 🟢 hasta 7 días desde el folio · 🟡 de 8 a 30 · 🔴 más de 30. Toma lo peor entre **cómo paga** (sus folios de los últimos 6 meses, pesa más una factura grande) y **lo que debe hoy** (su folio pendiente más antiguo). El texto dice por qué: "Al día · 3 d", "Paga en 18 d" o "Debe hace 43 d". Gris: todavía no hay pagos para medir.
- Al abrir un cliente: cuántos días paga en promedio frente a lo **acordado**, cuánto debe hoy, y cada cuánto pide.
- **Ordenar** por Nombre, Aporte o Pago.
- **Dejó de comprar:** un cliente que pide seguido y lleva más del doble de su intervalo normal sin pedir aparece marcado en Clientes y en **Hoy**. Se quita solo cuando vuelve a comprar, o con **"Ya lo revisé"** (con una nota opcional, por ejemplo "de vacaciones"). Desde Hoy, tocarlo abre ese cliente.

(i) Las órdenes de los últimos 6 meses se leen una vez cada 6 horas en cada equipo ("Actualizar" las vuelve a leer). Son unas pocas centenas de lecturas: muy dentro de lo gratis de Firebase.

(i) **Los días de pago salen de la fecha que se pone al marcar Pagado o Abono.** Usa la fecha real de la transferencia. Las órdenes antiguas sin "Fecha Folio" en la planilla no cuentan para el promedio.

Archivos: cambian `app.js`, `b2b.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos. No cambian el script, las reglas ni la app de logística.

## Novedades de la v0.13.1
- **Órdenes (Ventas B2B):** las tarjetas **Copia en la planilla, Por facturar y Por cobrar se pliegan y despliegan**. Parten cerradas, con su resumen a la vista (por ejemplo "2 clientes · 8 órdenes · $62.475" o "2 folios · saldo $37.485"); este equipo recuerda cuáles dejaste abiertas.
- **Por fecha de la orden:** Por facturar y Por cobrar ordenan las órdenes por su fecha (antes por N°); Buscar y "Últimas 30" muestran la más reciente arriba por fecha. En la **planilla**, una orden editada ya no sube al principio de Detalle Ventas: queda en su lugar (script v2.5.1).
- **Un folio es de un solo cliente:** al asignar un folio que ya tiene órdenes de otro cliente, avisa y no lo asigna (antes solo preguntaba). La base nueva tampoco lo deja aunque se intente por otro lado.

Archivos: cambian `app.js`, `b2b.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos. Si todavía no instalabas la v0.13.0, instala esta directamente con los pasos de abajo (con el script v2.5.1).

## Novedades de la v0.13.0: catálogo y estado de cuenta en Sistema Fën
Ventas B2B tiene tres pestañas nuevas:

| Pestaña | Qué hace |
| --- | --- |
| **Clientes** | Buscar, **+ Nuevo cliente** (se movió aquí desde Solicitudes), **Editar datos** (RUT, razón social, giro, dirección, correo, teléfono, contacto, facturación y frecuencia de pago), **precios especiales** (agregar, cambiar o quitar; cada cambio queda en el historial del cliente) y **Archivar / Reactivar** |
| **Productos** | **+ Nuevo producto**, **Editar** (precio base, categoría, área, ID de receta; el cambio de precio base queda en su historial) y **Archivar / Reactivar** |
| **Estado de cuenta** | El mismo de la app B2B: cliente, desde y hasta, **por orden o por folio**. Muestra comprado, pagado y pendiente, y **Descargar PDF** con el formato de siempre |

También:
- **Por facturar → "Marcar las que tocan (N)"** junto a cada cliente: marca solo las órdenes que ya corresponde facturar según cómo factura ese cliente (diaria: días anteriores; semanal: semanas anteriores; mensual: meses anteriores). Debajo del nombre se ve su modalidad. Aparece solo cuando hay órdenes que todavía no tocan; si tocan todas, basta con "Marcar todas".
- **Hoy** muestra las **solicitudes de logística** sin responder (precio, producto nuevo o anulación), con enlace directo.
- **Todo pasa solo a la planilla**: hojas Clientes, Precios y Productos (necesita el **script de B2B v2.5.0**). En la tarjeta "Copia en la planilla" el contador incluye ahora los cambios del catálogo.

(i) **El nombre de un cliente o producto no se cambia**: las órdenes y la planilla lo ubican por su nombre. Si un nombre quedó mal, crea uno nuevo y archiva el anterior.

(i) **Archivar no borra nada**: deja de aparecer en la app de logística; sus órdenes y su historial quedan igual, y se puede reactivar. En la planilla, la columna nueva **Estado** dice ARCHIVADO.

(i) **Un cliente con una facturación distinta en la planilla** (por ejemplo "Diario") se muestra tal cual al editar y no se cambia, salvo que elijas otra.

(i) **Lo que todavía queda en la app antigua (solo para mirar):** análisis y la conciliación bancaria con cartola (llegan en la v0.14).

Archivos: cambian `app.js`, `b2b.js`, `b2b-modelo.js`, `pdf-orden.js`, `estilos.css`, `config.js`, `firestore-b2b.rules` (v1.3.0), `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos.

### Instalación de la v0.13.0 (en este orden, unos 10 minutos)
1. **Script de B2B v2.5.1** (zip `b2b-script-v2.5.1`): sigue su README. El ping debe decir **2.5.1**.
2. **Reglas de fen-b2b v1.3.0**: consola de Firebase → proyecto **fen-b2b** → Firestore Database → **Reglas** → borra todo, pega el contenido de `firestore-b2b.rules` → **Publicar**. (Permiten que la app de logística, al pasar cambios a la planilla, marque también los del catálogo.)
3. **GitHub, repo `sistema-fen`**: Add file → Upload files → sube todos los archivos del zip (sin la carpeta) → Commit. En 1 o 2 minutos, recarga con Ctrl + Shift + R; abajo a la izquierda debe decir **v0.14.5**.
4. **App de logística v1.1.1** (zip `fen-logistica-v1.1.1`): GitHub, repo `fen-logistica` → sube todos los archivos. Solo cambia el orden de la lista de órdenes.

### Lista de verificación
- [ ] Ventas B2B muestra las pestañas Clientes, Productos y Estado de cuenta.
- [ ] Cambias un precio especial de un cliente → logística lo ve al tiro al hacer una orden para ese cliente → aparece en la hoja Precios.
- [ ] Archivas un producto de prueba → deja de aparecer en logística → en la hoja Productos dice ARCHIVADO → lo reactivas.
- [ ] Estado de cuenta de un cliente: las cifras cuadran con la app antigua; el PDF baja bien.
- [ ] Por facturar: en un cliente semanal o mensual aparece "Marcar las que tocan" y marca las correctas.
- [ ] Hoy muestra una solicitud de logística pendiente (si hay alguna).
- [ ] "Copia en la planilla" queda **Al día**.

## Novedades de la v0.12.3
- **Por facturar:** junto al nombre de cada cliente están **Marcar todas** y, apenas marcas una orden, **Asignar folio a N · $total** (antes el botón estaba al final de la lista). El nombre del cliente queda fijo arriba mientras bajas por sus órdenes.

Archivos: cambian `app.js`, `estilos.css`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos.

## Novedades de la v0.12.2
- **Solicitudes de anulación:** logística puede pedir que se anule una orden. Te llega en Ventas B2B → Solicitudes, con su motivo y **Ver PDF**. Al aprobar, la orden queda anulada (no se borra; en la planilla pasa a "Ordenes anuladas"); al rechazar, sigue igual.
- **PDF de una orden anulada:** dice **ANULADA** en grande, cruzado sobre toda la hoja, y una franja roja con la fecha y el motivo. El archivo se llama "ANULADA_Orden_…".
- **Reglas de fen-b2b v1.2.0** (hay que publicarlas): permiten las solicitudes de anulación y que logística marque "Entendido" en tus respuestas.

Archivos: cambian `app.js`, `b2b.js`, `pdf-orden.js`, `config.js`, `firestore-b2b.rules`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos.

## Novedades de la v0.12.1
- **Ver PDF** en cada orden (Órdenes y Buscar): se abre en otra pestaña, igual al que baja logística, con el historial de ediciones.
- En Buscar, las órdenes hechas en la app de logística dicen quién las creó (antes decía "de , fila").

Archivos: **nuevos** `pdf-orden.js` y `logo-orden.png`; cambian `app.js`, `b2b.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos.

## Novedades de la v0.12.0: Ventas B2B con la base nueva
**Ventas B2B** ahora tiene cuatro pestañas:

| Pestaña | Qué hace |
| --- | --- |
| **Órdenes** | **Copia en la planilla** (al día o cuántos cambios faltan, y "Pasar ahora"). **Por facturar**: las órdenes sin folio, por cliente; marcas varias y **Asignar folio** (con su fecha; avisa si el folio ya se usó). **Por cobrar**: cada folio con sus órdenes, abonado y saldo; **Abono** (monto, fecha, referencia; si completa el total queda pagado, si no PARCIAL) y **Pagado** (fecha). **Anular** una orden (con motivo; no se borra) |
| **Solicitudes** | Lo que pide logística: **precio especial** (al aprobar queda en el cliente) o **producto nuevo** de Producción (al aprobar queda como producto B2B con ese precio base). Puedes cambiar el precio antes de aprobar, o rechazar con motivo. Aquí también: **+ Nuevo cliente** |
| **Buscar** | Buscar órdenes por N°, folio o mes |
| **Base nueva** | La conexión, la copia desde la planilla (solo antes del cambio), el control de totales y **Cambiar a la base nueva / Volver a la app antigua** |

(i) **Cambiar a la base nueva** hace, en este orden: deja la app B2B antigua **solo para mirar**, hace **una última copia** de la planilla, deja el **N° de orden** siguiendo desde el último y **activa la app de logística**. Si algo falla a medio camino, deshace lo hecho y la app antigua sigue como siempre.

(i) **Volver a la app antigua** está siempre disponible: la planilla ya tiene todo lo hecho en las apps nuevas, así que la app antigua sigue desde ahí. Antes de volver revisa que no quede nada sin pasar a la planilla.

(i) **Lo que todavía queda en la app antigua (solo para mirar):** estado de cuenta, análisis y la conciliación bancaria con cartola. La conciliación con cartola y la administración completa de productos y precios llegan en la v0.13; mientras tanto, los pagos y abonos se registran aquí a mano, y los precios y productos nuevos entran por Solicitudes.

(i) **Clientes nuevos** creados aquí aparecen al tiro en la app de logística. Todavía no se copian a la hoja Clientes de la planilla (llega en la v0.13).

Archivos: cambian `b2b.js`, `firebase-b2b.js`, `app.js`, `estilos.css`, `config.js`, `firestore-b2b.rules` (v1.1.0), `README.md` y los demás `.js` e `index.html` (solo versión).

## Novedades de la v0.11.3
- **Control de totales:** Firestore tampoco deja sumar dos campos en la misma consulta sin un índice extra. Ahora pide cada suma por separado (cuesta lo mismo). No hace falta crear índices.

Archivos: cambian `b2b.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos.

## Novedades de la v0.11.2
- **Control de totales:** Firestore no deja sumar con un filtro sin un índice extra. Ahora suma toda la colección y resta los pocos documentos marcados "quitado de la planilla". No hace falta crear índices.
- Si la copia termina bien y algo falla después, el mensaje lo dice claro (antes parecía que la copia había fallado).

Archivos: cambian `b2b.js`, `app.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos.

## Novedades de la v0.11.1
- **Archivado a medias:** en la planilla real, unas 950 órdenes ya archivadas siguen también en "Detalle Ventas" (el archivado las copió al histórico pero no alcanzó a borrarlas). Si las líneas son exactamente las mismas, ahora se copian **una sola vez**, sin marcar la orden para revisar, y queda **un solo aviso** que lo resume. Si las líneas son distintas, la orden sí queda para revisar, con las dos versiones guardadas.
- Los números de la tabla de la copia van con punto de miles.

Archivos: cambian `b2b-modelo.js`, `app.js`, `config.js`, `README.md` y los demás `.js` e `index.html` (solo versión). Sube todos.

## Novedades de la v0.11.0: base nueva de Ventas B2B
Primera etapa de B2B en Sistema Fën. Nueva sección **Ventas B2B** en el menú, con dos pestañas:

| Pestaña | Qué hace |
| --- | --- |
| **Base nueva** | Conecta el proyecto Firebase nuevo **fen-b2b**, **lee la planilla de B2B** y muestra qué cambiaría; al confirmar, **copia** clientes (con sus precios especiales), productos, órdenes con su detalle (también las archivadas), abonos y ediciones. Después, **Control de totales** compara la planilla con la base nueva, y **Uso estimado** calcula cuánto gastaría la app de logística de la cuota gratis |
| **Órdenes en la base nueva** | Para revisar la copia: las últimas 30, o buscar por N° de orden, folio o mes |

**Para el día a día no cambia nada:** la app B2B y la planilla siguen igual y la planilla sigue mandando. La base nueva la usará la app de logística (v0.12).

(i) **Proyecto aparte, misma cuenta de Google.** fen-b2b tiene su propia cuota gratis (50.000 lecturas y 20.000 escrituras al día), así la caja (fen-ventas) nunca se queda sin cuota por B2B.

(i) **La copia se puede repetir cuando quieras.** Solo escribe lo que cambió desde la anterior. Si se corta a medias, lo copiado queda y la siguiente completa el resto. **Nada se borra:** si algo ya no está en la planilla (por ejemplo, una orden eliminada en la app B2B), en la base nueva queda marcado "quitado de la planilla" y deja de sumar.

(i) **Avisos de la planilla:** filas sin nombre, precios de clientes que no existen, órdenes repetidas o con el detalle que no suma lo mismo que el resumen. No frenan la copia: todo se copia tal cual y cada orden con algo raro queda marcada **Revisar**. Conviene corregirlas en la planilla con calma.

(i) **Una sola contraseña.** La base nueva tiene su propia lista de cuentas: creas ahí tu mismo correo con tu misma contraseña. Desde ahí, al entrar a Sistema Fën se entra solo a las dos, y al salir (o si revocas el equipo) se cierran las dos.

Archivos: **nuevos** `b2b.js`, `b2b-modelo.js`, `firebase-b2b.js` y `firestore-b2b.rules` (reglas de fen-b2b; van en la consola, la copia en GitHub es de respaldo). Cambian `index.html`, `estilos.css`, `config.js`, `app.js`, `README.md` y los demás `.js` (solo versión).

Necesita el **script de B2B v2.3.0** (`b2b-script-v2.3.0.zip`). Sin él, "Leer la planilla" dice que falta actualizarlo; nada más cambia.

### Instalación v0.11.0 (unos 25 minutos, una sola vez)

**A. Crear el proyecto fen-b2b** (en [console.firebase.google.com](https://console.firebase.google.com), con la misma cuenta de Google de siempre)
1. **Agregar proyecto** → nombre **fen-b2b**. Si Firebase le agrega letras al ID (ej. `fen-b2b-3a1f2`), da igual. Google Analytics: **no**. Queda en el plan gratis (Spark): **no** agregues facturación.
2. **Firestore Database → Crear base de datos** → ubicación **southamerica-west1 (Santiago)** (no se puede cambiar después) → **modo de producción**.
3. **Firestore → Reglas**: borra todo, pega `firestore-b2b.rules` → **Publicar**.
4. **Authentication → Comenzar → Correo electrónico/contraseña** → habilitar (solo el primero) → Guardar.
5. **Authentication → Usuarios → Agregar usuario**: tu correo de Sistema Fën y **la misma contraseña**. Copia el **UID** que aparece en la lista.
6. **Authentication → Configuración → Acciones del usuario**: desmarca **Habilitar la creación (registro)** → Guardar. Así nadie puede crearse una cuenta solo (igual que en fen-ventas).
7. **Firestore → Datos → Iniciar colección** → ID `admins` → ID del documento: **el UID** del paso 5 → campo `ok`, tipo booleano, `true` → Guardar.
8. **⚙️ Configuración del proyecto → General → Tus apps → `</>` (Web)** → apodo `Sistema Fën` → sin Hosting → Registrar. Copia el bloque **`const firebaseConfig = { … }`** completo.

**B. Script de B2B v2.3.0** → ver el README de `b2b-script-v2.3.0.zip` (ping debe decir **2.3.0**).

**C. Sistema Fën v0.11.0** → sube a GitHub (repo `sistema-fen`, raíz) todos los archivos del zip, reemplazando. Espera 1 o 2 minutos y recarga.

**D. Conectar y copiar** (en Sistema Fën → **Ventas B2B**)
1. Pega el bloque del paso A.8 → **Guardar y conectar**.
2. Escribe tu contraseña → **Entrar**. (Si dice que falta marcar tu cuenta como administración, revisa el paso A.7: el ID del documento debe ser exactamente el UID que muestra la pantalla.)
3. **Leer la planilla** (puede tardar un minuto). Revisa la tabla y los avisos.
4. **Copiar … cambios a la base nueva** → al terminar, **Control de totales** debe decir **Todo cuadra**.

### Lista de verificación v0.11.0
- [ ] Ventas B2B → Base nueva dice **Conectada**, proyecto fen-b2b, con tu correo.
- [ ] "Leer la planilla" muestra la cantidad de órdenes que esperas (actuales + archivadas) y el total.
- [ ] Después de copiar: **Todo cuadra** en todas las filas del control de totales.
- [ ] Órdenes en la base nueva: busca 3 órdenes (una reciente, una con folio, una archivada) y compáralas con la app B2B: cliente, líneas, total, folio y estado de pago.
- [ ] Vuelve a leer la planilla: **Todo al día: no hay nada que copiar**. Crea una orden de prueba en la app B2B, lee de nuevo: aparece **1 nueva** en Órdenes. Bórrala o anúlala como siempre, lee y copia: queda "quitada de la planilla".
- [ ] En la consola de Firebase de fen-b2b → Firestore → **Uso**: las lecturas y escrituras del día son las de la copia (la primera escribe una vez cada orden; las siguientes, solo lo que cambió).
- [ ] La caja y la app B2B siguen igual.

### Si algo sale mal
- **"No dejó leer o guardar"**: revisa que las reglas de fen-b2b estén publicadas (A.3) y el documento en `admins` (A.7).
- **"No hay una cuenta con tu correo y esa contraseña"**: revisa el paso A.5 (mismo correo, misma contraseña).
- **"Firestore todavía no está creado"**: paso A.2.
- Para volver atrás: sube a GitHub los archivos de la v0.10.1. La base nueva queda como está (no molesta) y la planilla no se tocó.

## Novedades de la v0.10.1: Cotizaciones de Previred
Nueva pestaña **Gastos → Previred**. Subes el PDF "Certificado de Pagos de Cotizaciones Previsionales" (el lote con todos o el de un trabajador) y:
- Se lee **en tu equipo**: período, fecha de pago, total y, por trabajador, imponible, AFP, salud, AFC y lo que paga la empresa (SIS, seguros sociales, accidentes).
- Eliges el **área** y el **ítem** de cada trabajador. Se recuerdan para el mes siguiente; por defecto, las áreas de producción van a REMUNERACIONES PRODUCCIÓN y Ventas/Admin a OTRAS REMUNERACIONES.
- **Registrar** crea un gasto por trabajador (sin IVA, pagado al contado en la fecha de Previred, fecha del gasto = último día del mes de las remuneraciones, editable). En la observación queda el detalle: "Previred agosto 2026 · Nombre · AFP $… · Salud $… · AFC $… · Empleador $…".
- Si tienes una obligación de cotizaciones por pagar, la propone y queda **pagada** (sin crear otro gasto).
- El detalle completo queda en la hoja nueva **"Cotizaciones"** de la planilla de Gastos, y el PDF en Drive (carpeta "Cotizaciones Previred", privado).
- **Meses cargados** muestra el costo de cada trabajador por mes.

(i) **No se puede cargar dos veces lo mismo.** Si vuelves a subir un lote que ya cargaste con un trabajador más (o una gratificación nueva), se deja fuera lo ya cargado y se registra solo lo nuevo.

(i) **Si alguna línea del PDF no se puede leer, no deja guardar** (el total quedaría incompleto) y te dice de qué trabajador es.

(i) **Costo real de un sueldo** = el líquido que transfieres + el total de su fila de Previred. AFP y salud se descuentan del sueldo; SIS, seguros sociales y accidentes los paga la empresa; la AFC mezcla las dos partes. Conviene confirmarlo con la contadora.

(i) El lector de PDF (pdf.js) se carga desde cdnjs solo al abrir esta pestaña, y solo lee texto.

(i) Necesita el **script de Gastos v2.5.0** (`gastos-script-v2.5.0.zip`). Sin él, la pestaña dice "falta actualizarlo a v2.5.0"; el resto de Gastos sigue igual.

Archivos: `previred.js` es **nuevo**; cambian `index.html`, `estilos.css`, `config.js`, `app.js`, `apps.js`, `README.md` y los demás `.js` (solo versión).

## Novedades de la v0.10.0: Gastos completo
Gastos ahora tiene todo lo de la app de Gastos, en 7 pestañas:

| Pestaña | Qué hace |
| --- | --- |
| **Vencimientos** | Igual que antes, más **Anular** en cada vencimiento (con motivo) |
| **Obligaciones** (nueva) | Las reglas que crean los vencimientos: **nueva**, **editar**, **archivar** y **reactivar** (con ítem, reparto por área o en %, "Sugerir % según ventas", frecuencia, cuotas de una cuponera, monto estimado y tipo de monto). Más el **historial de pagos** por mes o completo |
| **Registrar** | Igual que antes |
| **Registrados** (nueva) | Todos los gastos desde el 1 de enero del año pasado, con búsqueda (ítem, área, monto, proveedor, folio, observación), mes y "A crédito / Por pagar". **Corregir** (fecha, ítem, área, monto, observación; el neto se recalcula) y **Anular** |
| **Análisis** (nueva) | El mes en costo operacional, fijos, variables y lo que queda fuera del costo (inversión, deuda, impuestos); por área, ítems que más pesan, directo e indirecto, por subtipo y los últimos 6 meses. Por fecha de compra o por fecha de pago |
| **Cargas del SII** | Igual que antes (con el arreglo de abajo) |
| **Ítems** (nueva) | Nuevo, editar, subir y bajar, **archivar** y reactivar |

(i) **Anular un gasto no lo borra.** La fila pasa a una pestaña nueva de la planilla, **"Gastos anulados"**, con la fecha, tu cuenta y el motivo, y sale de Registro Gasto: así deja de sumar en todos lados (análisis, Looker, prorrateo) sin filtrar nada. Si la compra tiene varias líneas (áreas o ítems con la misma boleta o factura), puedes anular la compra completa. Si era a crédito, te ofrece anular también su vencimiento; si era el pago de una obligación, te ofrece dejar ese vencimiento **por pagar de nuevo**.

(i) **Anular un vencimiento** lo deja como ANULADO en la hoja Vencimientos (con el motivo en ObsPago): no aparece, no avisa por correo y no se puede pagar. La obligación sigue generando los meses siguientes. **Obligaciones e ítems no se borran: se archivan.**

(i) **Antes de corregir o anular, Gastos revisa que la fila siga siendo la misma** (las filas se corren cuando entra un gasto nuevo). Si cambió, avisa y recarga la lista.

(i) **Arreglo del SII (corrección pendiente de la v0.9):** un documento se reconoce por RUT, folio **y tipo**. Una nota de crédito con el mismo folio que una factura del mismo proveedor ya no sale como "ya importada". Las notas de crédito nuevas se anotan "NC.123" en la observación; las antiguas ("F.123" con monto negativo) se reconocen solas.

(i) Necesita el **script de Gastos v2.4.0** (`gastos-script-v2.4.0.zip`). Sin él, las pestañas nuevas y Cargas del SII dicen "falta actualizarlo a v2.4.0"; Vencimientos y Registrar siguen funcionando.

Archivos: cambian `index.html`, `estilos.css`, `config.js`, `app.js`, `gastos.js`, `sii.js`, `apps.js`, `README.md`, y `caja.js`, `stock.js`, `ajustes.js`, `agenda.js` (solo versión). Reglas sin cambio.

## Novedades de la v0.9.0: Cargas del SII
Nueva pestaña **Gastos → Cargas del SII**: la carga masiva de la app de Gastos, ahora aquí.

| Paso | Qué hace |
| --- | --- |
| **Subir un archivo** | XML (Documentos recibidos → Descargar XML), XLS (Documentos recibidos) o CSV (Registro de Compras). Se reconoce solo cuál es. Marca los documentos que ya están en Gastos, trae tus notas y busca gastos registrados a mano que podrían ser el mismo documento. Una copia del archivo queda en Drive (carpeta "Cargas SII") y la carga entra al historial |
| **Clasificar** | Cada factura: ítem, reparto por área ($ o %, con "Sugerir % según ventas" del mes anterior), dividir en varios ítems, pagada o pendiente con su fecha (con el vencimiento del XML ya puesto). Si el documento trae detalle, se asigna ítem (y área) a cada producto y los montos se calculan solos. Notas de crédito: solo ítem, van en negativo con su fecha. "Aplicar a todas" marca estado o fecha de una vez |
| **¿Ya lo registraste a mano?** | Si un gasto sin RUT ni folio tiene el mismo monto y una fecha cercana, aparece para vincularlo: el gasto queda con el RUT y el folio y el documento como ya importado |
| **Importar las clasificadas** | Igual que en Gastos: una línea por ítem y área, el folio en la observación, vencimiento si es pendiente y los productos en "Detalle Compras". Si alguno ya estaba importado, no guarda nada y pregunta ("Importar solo las nuevas") |
| **Cargas anteriores** | Por mes, con cuántos documentos faltan, búsqueda en todas las cargas, ver documentos y su detalle, nota de la carga, **Reabrir** (trae el archivo desde Drive) y **Quitar del historial** |

(i) **Quitar del historial no borra nada**: la carga queda marcada como quitada en la planilla (columna nueva "Quitada" en la hoja Cargas SII), el archivo sigue en Drive y los gastos no se tocan. Si vuelves a subir el mismo archivo, reaparece. (En la app de Gastos el botón de basura sí la borra; mejor usa este.)

(i) **La copia del archivo en Drive ahora es privada** (en la app de Gastos quedaba abierta para cualquiera con el enlace). La abres igual con tu cuenta de Google.

(i) Gastos revisa todo antes de escribir: que el ítem exista, que las áreas sean válidas, que los montos sumen el total del documento y que no esté ya importado. Si se corta internet al importar, volver a tocar "Importar" no duplica.

(i) Necesitaba el script de Gastos v2.3.0 (desde la v0.10.0, el v2.4.0).

Archivos: `sii.js` es **nuevo**; cambian `index.html`, `estilos.css`, `config.js`, `app.js`, `gastos.js`, `apps.js`, `README.md`, y `caja.js`, `stock.js`, `ajustes.js`, `agenda.js` (solo versión). Reglas sin cambio.

## Novedades de la v0.8.0: Gastos en Sistema Fën
Nuevo **Gastos** en el menú, con dos pestañas:

| Pestaña | Qué hace |
| --- | --- |
| **Vencimientos** | Lo por pagar en grupos: Atrasados, Próximos 7 días, Resto del mes, Más adelante (las cuponeras cuota por cuota), y los pagados de los últimos 7 días. **Pagar** abre el pago: tipo de monto (bruto, neto, sin IVA) con su desglose, monto por área cuando el pago se reparte (remuneraciones, por ejemplo), fecha, comprobante opcional y observación |
| **Registrar gasto** | Fecha, tipo de monto, uno o varios ítems (con monto por área, reparto en % o área fija, y harina en materia prima), total con IVA, forma de pago (contado, tarjeta o crédito de proveedor con su fecha de pago), foto o PDF de la boleta (obligatoria, como en Gastos) y observación |

Además:
- En **Hoy**, "Pagos atrasados" y "Pagos de los próximos 7 días" abren Gastos aquí mismo.
- En la **Agenda** (semanal y del mes) aparecen todos los vencimientos de Gastos en su día ("Pago de…", en amarillo en el mes; tachado si ya está pagado). Tocar uno abre el pago.

(i) Pagar o registrar aquí hace exactamente lo mismo que en la app de Gastos (usa sus mismas funciones). Editar o anular gastos, obligaciones, ítems y cargas del SII siguen en la app de Gastos por ahora.

(i) Las fotos se achican antes de subir (lado mayor 1600 px) para que suban rápido desde el celular. Un PDF sube tal cual (hasta 8 MB).

(i) Necesita el **script de Gastos v2.2.0** (`gastos-script-v2.2.0.zip`, con su README). Sin él, Gastos dice "falta actualizarlo a v2.2.0" y Hoy sigue funcionando igual.

Archivos: `gastos.js` es **nuevo**; cambian `index.html`, `estilos.css`, `config.js`, `app.js`, `apps.js`, `README.md`, y `caja.js`, `stock.js`, `ajustes.js`, `agenda.js` (solo versión). Reglas sin cambio.

## Novedades de la v0.7.0: Agenda
- **Hoy → Agenda semanal:** lo de los próximos 7 días, desde hoy, agrupado por día (Hoy, Mañana, Mar 6…). Filtros **Todo / Fën / Personal** (el equipo recuerda cuál elegiste). Incluye solos los **pagos de Gastos** de la semana (tocarlos abre Gastos). **Agregar** y **Ver mes**.
- **Agenda** (nuevo en el menú): el mes en calendario (en el celular, lista de los días con algo), con mes anterior / siguiente / Hoy. Toca el número de un día para agregar algo ese día, o algo agendado para cambiarlo, **Marcar hecho** o **Quitar**.
- Cada cosa tiene: qué es, fecha, hora (opcional), **Fën o Personal** y una nota.

(i) **Personal** se guarda aparte (`agenda_personal`): solo lo ve y lo cambia la cuenta que lo creó, ni otras cuentas de administración, y no entra en los informes de Fën. En Seguridad → Actividad queda "Agregó a la agenda · personal", sin el título.

(i) **Quitar** no borra: queda guardado como quitado. Pasar algo de Fën a Personal (o al revés) lo copia al otro lado y deja el original como quitado.

(i) Pagos de Gastos en la agenda: los que trae el resumen de Gastos (hasta 5, los más próximos). La copia a Google Calendar llega más adelante.

**Reglas de Firestore v1.3.0:** agregan las colecciones `agenda` (solo administración) y `agenda_personal` (solo su dueño). Lo demás queda igual. Sin publicarlas, la agenda dice "Falta publicar las reglas v1.3.0".

Archivos: `agenda.js` es **nuevo**; cambian `index.html`, `estilos.css`, `config.js`, `app.js`, `firestore.rules`, `README.md`, y `caja.js`, `stock.js`, `ajustes.js`, `apps.js` (solo versión). `firestore-v1.2.0.rules` = las reglas anteriores, por si hay que volver.

## Novedades de la v0.6.0: Hoy con Gastos, Ventas B2B y Producción
**Hoy** ahora junta en Pendientes lo de las cuatro apps, una fila por tema y lo más urgente arriba. Arriba de cada pendiente dice de qué app viene; tocarlo abre esa app.

| App | Pendientes |
| --- | --- |
| Gastos | **Pagos atrasados** (cuántos, cuánto y cuáles) · **Pagos de los próximos 7 días** · **Documentos del SII sin gasto** (y cuántos tienen duda anotada) |
| Ventas B2B | **Cobros atrasados** (monto, cuántos clientes y los que más deben) · **Órdenes sin factura** (cuántas y cuántas atrasadas) |
| Producción | **Materias primas por aprobar** · **Habilitaciones por resolver** |

"De dónde lee Hoy" dice para cada app: Al día, Revisando, Falta la dirección, Falta actualizar o Sin respuesta.

Nuevo en **Configuración → Conexiones**: la dirección del Apps Script de cada app, con **Probar** (muestra la versión) y **Guardar**. Gastos y Producción ya vienen puestas; **la de Ventas B2B hay que pegarla** (está en la app B2B, ⚙️ Config).

(i) Para que Hoy lea una app, su Apps Script necesita la versión nueva (Gastos v2.1.0, Ventas B2B v2.1.0, Producción v2.2.0): vienen en `scripts-hoy-v0.6.0.zip` con su propio README. Mientras tanto Hoy dice "Falta actualizar" y sigue mostrando la caja.

Archivos: `apps.js` es **nuevo**; cambian `index.html`, `estilos.css`, `config.js`, `app.js`, `caja.js`, `stock.js` y `ajustes.js` (solo versión), `README.md`. Sin cambios en reglas de Firestore.

## Novedades de la v0.5.0: Configuración y botón (i)
Nuevo **Configuración** en el menú (en el celular, en Menú). Son los ajustes del negocio que antes se cambiaban dentro de la caja:

| Parte | Qué hace |
| --- | --- |
| **Motivos de merma** | La lista que elige la cajera al enviar a merma. Agregar, cambiar nombre (escribe y Enter), subir/bajar, quitar |
| **Tipos de leche** | Las opciones al vender un café con leche. Igual que arriba |
| **Subcategorías** | Por área. Al lado de cada una, cuántos productos la usan. Agregar, renombrar, ordenar, quitar |
| **Tiempos de pago** | Días hasta que llega la plata de débito, crédito y transferencia en Ainavillo. Barros Arana fijo en 0 (como en la caja) |
| **Períodos de conciliación** | Qué meses del año ya revisaste en la reconciliación de nombres históricos. Marcar o desmarcar |
| **Recetas sin producto en la caja** | Recetas que publica Producción sin producto vinculado. **Ocultar** las que no se venden en el mostrador; **Mostrar** para deshacer |

La impresora y el ancho de papel siguen en la caja (son de cada equipo).

**Botón (i):** las explicaciones nuevas van en un botón redondo con una *i* al lado del título o de la cifra. Tócalo para leer qué es y de dónde sale; se cierra tocando fuera o con Esc. Las notas "(i)" que ya estaban siguen donde estaban. En esta versión hay (i) en: cada parte de Configuración; Ventas del período, Neto y Ticket promedio (Reportes); Valor en stock, En última oferta y Merma / ventas (Merma y stock); Cajas abiertas ahora (Hoy).

(i) La caja lee estos ajustes al abrirse: cada tablet ve el cambio la próxima vez que se abre o se recarga la caja.

(i) Cada cambio se guarda sobre lo que está guardado en ese momento, así que no pisa un cambio hecho desde la caja. Lo contrario sí puede pasar: si tienes la caja abierta desde antes (como admin) y cambias la misma lista ahí, la caja guarda su lista vieja. Antes de cambiar una lista en la caja, recárgala.

(i) Cambiar el nombre o quitar un motivo, tipo de leche o subcategoría no cambia lo ya registrado (ventas, merma, productos). Los productos con una subcategoría quitada quedan "fuera de lista" en la caja.

Archivos: `ajustes.js` es **nuevo**; cambian `index.html`, `estilos.css`, `config.js`, `app.js`, `caja.js` y `stock.js` (solo versión), `README.md`. Sin cambios en reglas, scripts ni la caja.

## Novedades de la v0.4.0: Merma y stock
Nueva pestaña **Ventas de caja → Merma y stock**. Arriba eliges Barros Arana, Ainavillo o las dos.

| Parte | Qué hace |
| --- | --- |
| **Merma por registrar** | Lo que las cajeras enviaron a merma desde Stock: producto, unidades, cuándo y quién lo envió, motivos y pérdida. **Registrar merma** (o **Registrar todas**) lo saca del stock, lo guarda en el informe y lo pasa a la pestaña Merma de la planilla. **Rescatar** lo devuelve al stock eligiendo el día (define el precio) |
| **Merma sin pasar a planilla** | Si la planilla no respondió, la merma igual queda registrada y aparece aquí para **Reenviar** |
| **Stock ahora** | Valor, unidades, cuánto hay en última oferta y merma pendiente. Por día (Hoy, Ayer, Antes de ayer, Cuarto día, Última oferta, Sin vencimiento), con filtro por área |
| **Merma registrada** | Últimos 7 días / Este mes / Mes anterior: pérdida, unidades, **merma como % de las ventas de caja**, por área, por motivo y por producto |

(i) Ingresar stock, ajustar cantidades y enviar a merma se siguen haciendo en la caja: es trabajo del mostrador.

(i) Mejoras respecto de la caja:
- Registrar y rescatar se guardan en un solo paso: dos clics o dos equipos no duplican.
- La merma se guarda primero en Firebase y después va a la planilla; si la planilla falla, no se pierde (en la caja sí).
- La caja no limpia el registro de envíos al rescatar, así que una merma posterior podía salir con cantidades y motivos viejos. Aquí solo cuentan los envíos de lo que de verdad está en merma, y rescatar limpia el registro.
- "Valor en stock" incluye la última oferta (la caja no la suma).

(i) Antes de **Reenviar** una merma, mira la pestaña Merma de la planilla: a veces la fila llega aunque la respuesta se pierda. Un reenvío en las próximas horas no se duplica; uno de otro día sí podría (queda anotado para el script de la planilla).

Archivos: `stock.js` es **nuevo**; cambian `index.html`, `estilos.css`, `config.js`, `app.js`, `caja.js`, `README.md`. Sin cambios en reglas, scripts ni la caja.

## Novedades de la v0.3.0: Reportes de ventas
Nueva pestaña **Ventas de caja → Reportes** (lo que era Reportes → Ventas en la caja).
- **Período:** Ayer, Últimos 7 días, Este mes (sugerido), Mes anterior u Otras fechas (hasta un año). **Sucursal:** las dos, Barros Arana o Ainavillo.
- **Cifras:** ventas brutas (y cuánto cambió contra el mismo número de días anteriores), neto e IVA, número de ventas (y anuladas, que no suman) y ticket promedio.
- **Por día** (o por mes si eliges más de 2 meses): toca o pasa el mouse sobre una barra para ver el monto. Sábados y domingos van marcados.
- **Por área**, **por medio de pago** y, con las dos sucursales, **por sucursal**.
- **Productos** de mayor a menor venta, con filtro por área. Se ven 10 y "Ver todas".
- **Faltan resúmenes:** si un cierre del período no tiene resumen (por ejemplo, octubre), avisa arriba y el botón **Generar los que faltan** los crea ahí mismo, igual que "Generar resúmenes faltantes" de la caja.
- En **Hoy**, la tarjeta "Ventas de ayer" ahora abre el reporte de ayer.

(i) El reporte lee el resumen de cada cierre, no las ventas una por una: un mes son unas 60 lecturas en vez de miles (cuida el límite gratis de Firebase). Por eso las cajas abiertas no aparecen hasta que se cierran (lo avisa abajo).

(i) Diferencias con el reporte de la caja: no trae "tipo de leche" ni "por receta fën" (el resumen no los guarda; llegan con el catálogo en la etapa 4). Los montos son los mismos.

Archivos que cambian: `index.html`, `estilos.css`, `config.js`, `app.js`, `caja.js`, `README.md`. Sin cambios en reglas, scripts ni la caja.

## Novedades de la v0.2.3
- Logo centrado en el menú y en el celular, con "Sistema de administración" centrado debajo.
- Archivos que cambian: `index.html`, `estilos.css`, `config.js`, `app.js`, `caja.js` (solo versión), `README.md`. `logo-fen.png` es el mismo de la v0.2.2.

## Novedades de la v0.2.2
- Logo secundario de Fën en verde oscuro (#2F5A45, el color de los títulos) arriba del menú, en la entrada y arriba de cada pantalla en el celular. Archivo nuevo: `logo-fen.png` (fondo transparente).
- Archivos que cambian: `index.html`, `estilos.css`, `config.js`, `app.js`, `caja.js` (solo el número de versión), `README.md` y el nuevo `logo-fen.png`.

## Novedades de la v0.2.1
- **Arqueos:**
  - **Cuadrada:** solo la etiqueta verde, sin Corregir.
  - **Con diferencia:** *Corregir* (si se contó o anotó mal) o **Aceptar diferencia** (si ya no se puede aclarar). Aceptar no cambia montos: deja anotado quién la aceptó, cuándo y una nota opcional; la etiqueta pasa a gris "+$1.700 · aceptada" y el descuadre deja de aparecer en Hoy. Queda en Seguridad → Actividad.
  - **Sin arqueo:** sigue con *Corregir*, por si aparece el conteo.
  - Los descuadres por revisar van primero.
- **Listas largas:** en Ventas de caja y Seguridad se ven las primeras 3 filas y un botón **Ver todas (N)** / **Ver menos**. En Hoy no: los pendientes se ven siempre completos.
- (i) Si corriges un arqueo que ya estaba aceptado, la aceptación se quita: con montos nuevos, la diferencia se vuelve a revisar.

Archivos que cambian: `index.html`, `estilos.css`, `config.js`, `app.js`, `caja.js`, `README.md` (no cambian `firebase.js` ni las reglas).

## Novedades de la v0.2.0: Ventas de caja
Lo que hacías como administrador dentro de la caja, ahora sin abrirla.

| Pestaña | Qué hace |
| --- | --- |
| **Cierres** | **Cajas sin cerrar** de días anteriores: cerrar con arqueo (cuentas sin ver el sistema; al tocar *Revisar* aparece la tabla Sistema / Contado / Diferencia; si hay diferencia pide la nota) o sin arqueo. **Cierres sin pasar a planilla:** *Reenviar* uno o *Reenviar todas*. **Arqueos** de los últimos 60 días, con *Corregir* |
| **Anulaciones** | Por aprobar: *Aprobar anulación* o *Rechazar*. Debajo, las resueltas de los últimos 60 días |

Los pendientes de **Hoy** ahora abren estas pestañas (antes abrían la caja).

(i) Hace lo mismo que la caja v2.1.1, con estas mejoras:
- Un cierre hecho aquí pasa a la planilla al tiro, también **sin arqueo** (en la caja, sin arqueo no se pasaba).
- Si hay diferencia, llega el **mismo correo de descuadre** que manda la caja.
- **Pago dividido:** al anular una venta pagada con dos medios en una caja abierta, se descuenta de cada medio. La caja v2.1.1 todavía lo hace mal (queda anotado para arreglarla).
- **Sin dobles:** cerrar y aprobar se guardan en un solo paso. Si tú y la cajera (o dos equipos) lo hacen al mismo tiempo, solo uno cuenta y el otro ve "ya estaba cerrada / resuelta".
- **Caja que sigue vendiendo:** si una caja de otro día vendió hace menos de 30 minutos (por ejemplo, una tablet que quedó encendida desde ayer), avisa antes de cerrarla. Lo mejor en ese caso es cerrarla desde esa tablet.
- Cada cierre queda con quién lo cerró y "cerrada desde Sistema Fën". Todo queda también en Seguridad → Actividad.

(i) Reenviar nunca duplica filas: la planilla reconoce un cierre que ya tiene (usa la misma clave que la caja).

## Qué trae

| Pantalla | Qué hace |
| --- | --- |
| **Entrada** | Correo y contraseña de administración, nombre del equipo y por cuánto tiempo recordarlo: solo esta vez (hasta cerrar el navegador, máximo 12 horas), 30 días, 4 meses (sugerido), 1 año o una fecha |
| **Hoy** | Pendientes reales de la caja: descuadres de ayer y hoy, cajas de días anteriores sin cerrar, cierres sin pasar a planilla, anulaciones por aprobar. Ventas de ayer en caja y cajas abiertas ahora. Cada pendiente abre Ventas de caja |
| **Ventas de caja** | Cierres y anulaciones (ver arriba) |
| **Seguridad** | Tus equipos autorizados, cuándo vence cada uno, cambiar la duración, revocar, salir de este equipo, actividad reciente y correo para cambiar la contraseña |
| **Menú** | Abre las apps actuales (Ventas B2B, Gastos, Producción, Caja, Asistencia) en otra pestaña |

(i) Gastos, Ventas B2B y Producción siguen apareciendo en Hoy como "Próximamente": se conectan en una versión siguiente. La agenda llega en la etapa 3.

(i) Sistema Fën tiene **su propia sesión**: entrar, salir o revocar aquí no cambia ni cierra la cuenta abierta en la caja de ese equipo.

(i) Revocar un equipo cierra Sistema Fën ahí (al instante si está abierto). Si perdiste un equipo, además cambia tu contraseña desde Seguridad: al cambiarla, Firebase cierra tu cuenta en todos los equipos (también en la caja) en menos de una hora.

## Archivos y dónde va cada uno
```
index.html             la app                                     → GitHub, repo sistema-fen, raíz (reemplaza)
estilos.css            colores Salvia y arena                     → GitHub, sistema-fen, raíz (reemplaza)
config.js              versión, apps del menú, Firebase, scripts  → GitHub, sistema-fen, raíz (reemplaza)
firebase.js            conexión con Firebase                      → GitHub, sistema-fen, raíz (reemplaza)
app.js                 pantallas                                  → GitHub, sistema-fen, raíz (reemplaza)
previred.js            NUEVO en v0.10.1: cotizaciones de Previred → GitHub, sistema-fen, raíz
sii.js                 cargas del SII (v0.9.0)                    → GitHub, sistema-fen, raíz
gastos.js              Gastos (v0.8.0)                            → GitHub, sistema-fen, raíz
agenda.js              agenda (v0.7.0)                            → GitHub, sistema-fen, raíz
apps.js                pendientes de las otras apps (v0.6.0) → GitHub, sistema-fen, raíz
ajustes.js             configuración del negocio (v0.5.0)          → GitHub, sistema-fen, raíz
stock.js               merma y stock (v0.4.0)                     → GitHub, sistema-fen, raíz
caja.js                lógica de cierres y anulaciones     → GitHub, sistema-fen, raíz
logo-fen.png           logo secundario en verde                   → GitHub, sistema-fen, raíz (nuevo en v0.2.2)
README.md              este archivo                               → GitHub, sistema-fen, raíz (reemplaza)
firestore.rules        reglas v1.3.0 (agenda)                     → consola de Firebase (fen-ventas) → Firestore Database → Reglas → Publicar
firestore-v1.2.0.rules reglas anteriores, por si hay que volver   → no se sube (guárdalo)
```
En Apps Script cambia solo el de **Gastos** (v2.5.0, zip aparte con su README). Nada en la caja cambia.

(i) `config.js` lleva la configuración web de Firebase. No es secreta: es la misma que ya está en la caja y solo dice a qué proyecto conectarse. Lo que protege los datos son las reglas y tu contraseña.

## Instalación de la v0.10.1
0. **Primero el script de Gastos v2.5.0** (`gastos-script-v2.5.0.zip`, ver su README). Si no instalaste la v2.4.0, esta la incluye.
1. En GitHub, repo **sistema-fen** → **Add file → Upload files** → arrastra `previred.js` (nuevo), `sii.js`, `gastos.js`, `agenda.js`, `apps.js`, `ajustes.js`, `stock.js` y `index.html`, `estilos.css`, `config.js`, `app.js`, `caja.js`, `README.md` y `logo-fen.png` → **Commit changes**.
2. Espera 1 o 2 minutos y abre https://panaderiafen.github.io/sistema-fen/ (si ves la versión anterior, recarga con Ctrl+Shift+R; abajo a la izquierda debe decir **v0.10.1**).
3. Configuración → Conexiones → Gastos → **Probar**: debe decir "v2.5.0 · lista".

## Instalación de la v0.8.0 (ya hecha si la instalaste)
0. **Script de Gastos v2.2.0** (ver su README). **Reglas:** si ya publicaste las v1.3.0, no hace falta nada más; consola de Firebase → **fen-ventas** → Firestore Database → **Reglas** → borra todo, pega `firestore.rules` (v1.3.0) → **Publicar**. Después abre la caja y haz algo de todos los días: debe funcionar igual (si no, pega `firestore-v1.2.0.rules` y avísame).
1. En GitHub, repo **sistema-fen** → **Add file → Upload files** → arrastra `gastos.js` (nuevo), `agenda.js`, `apps.js`, `ajustes.js`, `stock.js` y `index.html`, `estilos.css`, `config.js`, `app.js`, `caja.js`, `README.md` y `logo-fen.png` → **Commit changes**.
2. Espera 1 o 2 minutos y abre https://panaderiafen.github.io/sistema-fen/ (si ves la versión anterior, recarga con Ctrl+Shift+R; abajo a la izquierda debe decir **v0.8.0**).

(i) Instalación desde cero (v0.1): reglas v1.2.0 en Firebase, subir los archivos, Settings → Pages → *Deploy from a branch*, **main**, **/(root)**. Ya está hecho.

## Lista de verificación
- [ ] **Previred**: sube el lote de agosto. El total debe ser el que pagaste en Previred y cada trabajador con su AFP, salud, AFC y empresa. Elige áreas e ítems y registra: en Registro Gasto aparece una fila por trabajador; en la planilla, la hoja **Cotizaciones** con el detalle (la columna "Folio Planilla" con los 16 dígitos completos).
- [ ] Vuelve a subir el mismo PDF: dice que ya estaba cargado completo.
- [ ] Abajo a la izquierda dice **v0.10.0**; Gastos tiene 7 pestañas.
- [ ] **Registrados**: aparecen tus gastos; busca uno por monto o proveedor. **Corrige** la observación de uno de prueba y revisa en la planilla que cambió solo esa fila.
- [ ] Registra un gasto de prueba y **anúlalo**: sale de Registro Gasto y aparece en la pestaña nueva **Gastos anulados** con tu cuenta y el motivo.
- [ ] **Análisis** de septiembre: compara el costo operacional con el de la app de Gastos (deben coincidir).
- [ ] **Obligaciones**: están tus reglas (las mismas que en la app de Gastos). Crea una de prueba con fecha específica y archívala.
- [ ] **Ítems**: el mismo orden que en la app de Gastos. Archiva uno de prueba: deja de aparecer en Registrar (aquí y en la app de Gastos); reactívalo.
- [ ] **Cargas del SII**: reabre una carga: los ya importados siguen en gris.
- [ ] Abajo a la izquierda dice **v0.9.0** y en Gastos aparece la pestaña **Cargas del SII**, con tus cargas anteriores agrupadas por mes (las mismas que en la app de Gastos).
- [ ] **Reabre** una carga con pendientes: aparecen sus documentos, los ya importados en gris con "Ya en Gastos".
- [ ] Sube un XML chico del SII (o el de esta semana). Clasifica **una** factura de prueba e impórtala. En la planilla de Gastos aparece igual que cuando importas desde la app (folio en la observación, RUT, y si era pendiente, su vencimiento en Vencimientos).
- [ ] Vuelve a subir el mismo archivo: esa factura sale como "Ya en Gastos".
- [ ] Si te aparece "¿Ya lo registraste a mano?" en alguna, revisa que el gasto sugerido sea el correcto antes de vincular.
- [ ] Quita del historial una carga de prueba: desaparece del historial y de Hoy, pero en la hoja Cargas SII sigue la fila con la columna "Quitada" llena.
- [ ] En Hoy, "Documentos del SII sin gasto" abre esta pestaña.
- [ ] Abajo a la izquierda dice **v0.8.0** y en el menú aparece **Gastos**.
- [ ] Gastos → Vencimientos muestra lo mismo que Obligaciones en la app de Gastos. Paga uno chico y registra un gasto de prueba: quedan igual que si los hubieras hecho en Gastos.
- [ ] En la Agenda del mes aparecen los vencimientos en su día.
- [ ] Agrega algo de Fën y algo personal en la agenda: aparecen en Hoy (si son de los próximos 7 días) y en Agenda. Quita uno de prueba.
- [ ] Actualiza los tres scripts (README de `scripts-hoy-v0.6.0.zip`) y pega la dirección de Ventas B2B en Configuración → Conexiones.
- [ ] En Hoy, "De dónde lee Hoy" dice **Al día** en las cuatro apps, y los pagos atrasados, cobros y solicitudes coinciden con lo que muestra cada app.
- [ ] En Configuración se ven tus motivos de merma, tipos de leche y subcategorías reales. Agrega un motivo de prueba, recarga la caja y revisa que aparezca al enviar a merma; después quítalo.
- [ ] Toca una (i): se abre la explicación; toca fuera y se cierra.
- [ ] **Merma y stock**: el stock de Barros Arana se ve igual que en la caja (Stock). Registra una merma pendiente y revisa que salga del stock en la caja y que llegue **una** fila a la pestaña Merma de la planilla.
- [ ] Ventas de caja → **Reportes** → **Este mes**: si avisa que faltan resúmenes, toca **Generar los que faltan**. Compara el total de septiembre (Mes anterior) con el reporte de la caja: deben coincidir.
- [ ] En Arqueos, las cuadradas ya no tienen Corregir. Acepta una diferencia que no se pueda aclarar: queda en gris "aceptada" y sale de Hoy.
- [ ] Una lista con más de 3 filas muestra "Ver todas".
- [ ] En **Hoy**, toca "Caja anterior sin cerrar": abre Ventas de caja → Cierres con las 3 cajas viejas.
- [ ] Cierra una de ellas (con arqueo si tienes el conteo, si no sin arqueo). Revisa en la planilla de la caja, pestaña **Cajas**, que llegó **una sola fila** con su ID Caja. Si quedó con diferencia, te llega el correo de descuadre.
- [ ] Ábrela en la caja (Reportes o evaluación): se ve como cerrada.
- [ ] Si hay una anulación pendiente, apruébala aquí y revisa en la caja que la venta salió como anulada.

## Si algo sale mal
- **"Firestore no dejó guardar":** revisa que en Firebase sigan las reglas v1.2.0.
- **"…el cierre no llegó a la planilla (…)":** la caja quedó cerrada; el cierre queda en *Cierres sin pasar a planilla*. Toca *Reenviar*. Si vuelve a fallar, mándame el texto del error.
- **Sigue viéndose la v0.1.1:** espera unos minutos y recarga con Ctrl+Shift+R.

## Pruebas automáticas (48, todas pasan)
Con Firebase simulado en el navegador:
- Las 12 de la v0.1.1 (entrada, Hoy, recargar, Seguridad, revocar, vencer, celular).
- Hoy abre Ventas de caja → Anulaciones. Aprobar una venta con pago dividido: efectivo y débito bajan lo justo, no aparece un medio "Dividido", el stock vuelve al mismo lote, queda en la actividad.
- Cerrar con arqueo: la diferencia exige nota; una sola evaluación; la planilla recibe el cierre con la misma clave que usa la caja y con la sesión de Sistema Fën; sale el correo de descuadre.
- Reenviar: si el script falla, queda en la lista con el error; al reintentar, sale de la lista.
- Cerrar sin arqueo (también pasa a la planilla) y corregir un arqueo.
- Caja que vendió hace 5 minutos: avisa y, si dices que no, no se cierra.
- Solicitud aprobada en otro equipo justo antes: no se descuenta dos veces.
- Celular: Caja en la barra inferior, sin scroll horizontal.
- v0.10.1: un PDF de prueba con el mismo formato que Previred (datos inventados): lee 2 trabajadores (uno con el nombre en dos líneas), totales por AFP, salud, AFC y empresa; área e ítem recordados y por defecto según el área; fecha = último día del período; propone el vencimiento de cotizaciones; pide área e ítem; registra con clave según el contenido; lote con un trabajador ya cargado registra solo el otro; mes completo ya cargado no deja guardar; un PDF que no es de Previred avisa; celular sin scroll horizontal. El lector se probó también con un lote real de Previred: el total leído coincide con el pagado. Pruebas del script: área e ítem validados, nombres sin fórmulas, un gasto por trabajador sin IVA con el detalle en la observación, PDF privado, hojas nuevas al final, vencimiento pagado, mismo mes otra vez no guarda nada, mismo envío no duplica, costo por trabajador. Una revisión independiente encontró 6 cosas (guardar con líneas sin leer, líneas que podían perderse sin aviso, reintento tras un corte, folios de 16 dígitos, lote con un trabajador nuevo, un resquicio de fórmulas): todas arregladas.
- v0.10.0: registrados con búsqueda, mes y "por pagar"; corregir (área fija del ítem, neto, historial con antes → después); anular una compra de dos líneas con motivo y su vencimiento; un pago de obligación sin boleta no se agrupa y ofrece dejar el vencimiento por pagar; anular un vencimiento; obligaciones con % sugerido, cuponera, archivar e historial; análisis (costo operacional sin la inversión, por área, subtipo, 6 meses); ítems (subir, renombrar, archivar y reactivar); celular sin scroll horizontal en las cuatro pestañas. Pruebas del script con la planilla en memoria y el Code.gs real: nota de crédito y factura con el mismo folio, notas de crédito antiguas, la app de Gastos sin tipo no reimporta, "NC." y "Tipo Doc"; lista con huella, corregir revisa la fila, conserva el folio y respeta el signo; anular copia a "Gastos anulados" (al final de las pestañas, por nombre de columna), borra de abajo hacia arriba, no repite con la misma clave y con otra clave detecta que la fila cambió; vencimiento anulado oculto, sin correo, sin pago y fuera de Hoy; obligaciones validadas (día, %, áreas, cuponera); ítems archivados fuera de Registrar y del orden. Una revisión independiente encontró 6 cosas (agrupar pagos distintos como una compra, pago anulado que dejaba la obligación pagada, área que cambiaba sola al corregir, reintento que podía anular otra fila igual, orden con archivados, columnas nuevas en "Gastos anulados"): todas arregladas.
- v0.9.0: subir un XML con 4 documentos (uno ya importado, uno con nota y coincidencia, una nota de crédito, uno con harina y vencimiento a 31 días ya puesto como pendiente); la carga queda en el historial con el archivo; asignar productos con "Mismo ítem a todos" y áreas (montos calculados con IVA e impuesto de harina, cuadrando exacto); vincular con un gasto a mano; importar (montos negativos y fecha propia en la nota de crédito). CSV sin detalle: no importa sin ítem; dividir en dos ítems con el acumulador y aviso de cuánto falta; % sugerido por ventas; pide pagada o pendiente; "Aplicar a todas"; repetidos → "Importar solo las nuevas" con otra clave; historial con búsqueda, ir a la carga, nota y quitar. Reabrir no vuelve a guardar la carga; detalle de un documento; script sin actualizar avisa sin romper Vencimientos; celular sin scroll horizontal. Pruebas del script con la planilla en memoria y el Code.gs real: ya importados y coincidencias, archivo privado en Drive, carga repetida no se duplica, notas sin fórmulas, quitar marca sin borrar (y desaparece de Hoy), volver a subir la trae de vuelta, vincular revisa que las filas sigan siendo las mismas, importar rechaza áreas que no suman, ítems inexistentes, áreas falsas y documentos repetidos, el reintento no duplica, repetidos no escriben nada, un corte a medias no deja vencimientos sueltos, documentos en $0. Una revisión independiente encontró 5 cosas (nota que podía guardarse en el documento equivocado, documentos en $0, lecturas sin bloqueo, mensaje tras un corte, "Misma área a todos" en ítems prorrateados): todas arregladas.
- v0.8.0: vencimientos por grupo con montos (remuneraciones = suma de sus áreas); pagar uno repartido por área con comprobante (la foto se achica y va con su clave única); registrar un gasto con varias áreas, reparto en % (debe sumar 100), harina, neto y crédito de proveedor (pide fecha de pago y foto); total con IVA e impuesto de harina; los vencimientos en la agenda del mes y tocar uno abre el pago; script sin actualizar avisa; celular. Más las pruebas del script: no paga dos veces, un envío repetido no duplica, un envío cortado a medias no se repite, áreas y % revisados en el servidor, ítems de obligaciones recurrentes no se registran a mano.
- v0.7.0: la agenda semanal en orden de fecha con lo propio, lo personal y los pagos de Gastos; no muestra lo quitado, lo personal de otra cuenta ni lo de más de 7 días; filtros; agregar; mes con agregar en un día, pasar de Fën a personal (el original queda quitado), marcar hecho y quitar sin borrar; lo personal no deja su título en la actividad; celular.
- v0.6.0: Hoy junta caja y Gastos en orden de urgencia, con el nombre de la app y el enlace; B2B sin dirección y Producción sin actualizar se muestran como tales; Conexiones valida la dirección, prueba la versión y la guarda; con B2B y Producción al día aparecen cobros, órdenes sin factura y solicitudes (sin filas vacías).
- v0.5.0: listas con los valores de fábrica de la caja si no existen; agregar, renombrar, mover y quitar; un cambio hecho desde la caja mientras la pantalla está abierta no se pierde; la lista no queda vacía; subcategorías con número de productos; tiempos de pago (Barros Arana queda en 0); marcar un período; ocultar una receta (lista de Producción con nombres con coma); botón (i) abre, cabe en el celular y se cierra con Esc o tocando fuera.
- v0.4.0: valor del stock con el precio de cada día (sin los que no controlan stock); merma por registrar por sucursal; registrar crea un registro por día de envío, sin contar envíos viejos ya rescatados, y lo pasa a la planilla con su clave; si la planilla falla queda para reenviar; rescatar vuelve al día elegido y limpia el registro; merma / ventas; celular.
- v0.3.0: desde Hoy abre el reporte de ayer; bruto, neto, anuladas, ticket promedio y porcentajes por medio de pago; genera el resumen que falta y lo suma; filtro por sucursal; por sucursal; celular sin scroll horizontal.
- v0.2.1: cuadrada sin Corregir; descuadre primero; 6 arqueos muestran 3 y "Ver todas (6)" / "Ver menos"; aceptar diferencia no cambia montos, queda en la actividad y sale de Hoy.

Además, una revisión independiente comparó `caja.js` con la caja v2.1.1 y el script de la planilla: los nombres de campos y la clave anti-duplicados coinciden. De esa revisión salieron las mejoras de "sin dobles", "caja que sigue vendiendo", el correo de descuadre y un arreglo de seguridad en *Corregir*.

**Pendiente para la caja (no es de esta entrega):** que rescatar limpie el registro de envíos; que vender y enviar a merma sumen y resten con incremento (hoy escriben un número calculado antes, y un cambio hecho al mismo tiempo desde otro equipo puede perderse); que el script de la planilla reconozca una merma ya escrita por su ID; que las reglas no dejen vender en una caja ya cerrada; que la caja también use "un solo paso" al cerrar y aprobar; arreglar el descuento del pago dividido; y en el script de la planilla, revisar duplicados por ID Caja en vez de por la primera venta.

**Lo que no pude probar aquí:** Firebase real y el script real. Por eso la lista de verificación.
