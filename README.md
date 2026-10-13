# Sistema Fën · v0.58.0

**App:** v0.58.0 · **Reglas de Firestore (fen-ventas):** v1.3.0 (sin cambios) · **Reglas de fen-b2b:** v1.6.0 (sin cambios) · **Reglas de fen-produccion:** v1.7.0 (sin cambios) · **Reglas de fen-gastos:** v0.1.0 (sin cambios) · **Script de Producción:** v2.10.0 (sin cambios; nuevo en la v0.56.0) · **Script de B2B:** v2.8.2 (sin cambios) · **Script de Gastos:** v2.17.0 (sin cambios) · 13 de octubre de 2026
**Dirección:** https://panaderiafen.github.io/sistema-fen/

Solo entra la cuenta de administración (la misma de la caja). Sistema Fën es solo para el dueño: las jefas siguen en Producción con su PIN, y logística usa su app nueva (fen-logistica).

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
- **Clasificar obligaciones** (Gastos → Obligaciones → **Revisar y clasificar**, y desde Base nueva): cada obligación activa con su ítem, su monto, sus últimos pagos y una **propuesta** de tipo: **monto fijo** si los últimos 3 pagos fueron iguales; **según documento** si es luz, agua, gas, internet o teléfono, o si el SII tiene facturas de un proveedor con ese nombre; **libre** si es un sueldo o los montos cambian mucho. Y de **identificador**: el número del nombre ("LUZ AINAVILLO 2020220 / 1945063" → 2020220; con varios eliges tú), el RUT del proveedor del SII o Previred. Nada se guarda solo: **Guardar** en cada una o marca varias y **Aplicar propuestas** (sus vencimientos abiertos toman el tipo nuevo, como en Editar).
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
- Cada abono de la cartola se cruza con su transferencia por cuenta, monto y día (o ±1 día). Si hay dos iguales, desempata por el nombre. El abono muestra: "Transfirió: NOMBRE COMPLETO · RUT · Banco · hora".
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
