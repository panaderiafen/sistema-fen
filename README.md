# Sistema Fën · v0.15.0

**App:** v0.15.0 · **Reglas de Firestore (fen-ventas):** v1.3.0 (sin cambios) · **Reglas de fen-b2b:** v1.5.0 · **Script de B2B:** v2.8.0 · 8 de octubre de 2026
**Dirección:** https://panaderiafen.github.io/sistema-fen/

Solo entra la cuenta de administración (la misma de la caja). Sistema Fën es solo para el dueño: las jefas siguen en Producción con su PIN, y logística usa su app nueva (fen-logistica).

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
3. **GitHub, repo `sistema-fen`:** sube todos los archivos de esta carpeta (reemplazan a los de antes) → Commit. A los minutos, abajo a la izquierda debe decir **v0.15.0** (si no, recarga con Ctrl+Shift+R o cierra y abre en el celular).

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
