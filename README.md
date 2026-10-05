# Sistema Fën · v0.8.0

**App:** v0.8.0 · **Reglas de Firestore:** v1.3.0 (sin cambios) · 4 de octubre de 2026
**Dirección:** https://panaderiafen.github.io/sistema-fen/

Etapa 1. Solo entra la cuenta de administración (la misma de la caja).

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
gastos.js              NUEVO en v0.8.0: Gastos                    → GitHub, sistema-fen, raíz
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
Nada en Apps Script ni en la caja cambia.

(i) `config.js` lleva la configuración web de Firebase. No es secreta: es la misma que ya está en la caja y solo dice a qué proyecto conectarse. Lo que protege los datos son las reglas y tu contraseña.

## Instalación de la v0.8.0
0. **Script de Gastos v2.2.0** (ver su README). **Reglas:** si ya publicaste las v1.3.0, no hace falta nada más; consola de Firebase → **fen-ventas** → Firestore Database → **Reglas** → borra todo, pega `firestore.rules` (v1.3.0) → **Publicar**. Después abre la caja y haz algo de todos los días: debe funcionar igual (si no, pega `firestore-v1.2.0.rules` y avísame).
1. En GitHub, repo **sistema-fen** → **Add file → Upload files** → arrastra `gastos.js` (nuevo), `agenda.js`, `apps.js`, `ajustes.js`, `stock.js` y `index.html`, `estilos.css`, `config.js`, `app.js`, `caja.js`, `README.md` y `logo-fen.png` → **Commit changes**.
2. Espera 1 o 2 minutos y abre https://panaderiafen.github.io/sistema-fen/ (si ves la versión anterior, recarga con Ctrl+Shift+R; abajo a la izquierda debe decir **v0.8.0**).

(i) Instalación desde cero (v0.1): reglas v1.2.0 en Firebase, subir los archivos, Settings → Pages → *Deploy from a branch*, **main**, **/(root)**. Ya está hecho.

## Lista de verificación
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

## Pruebas automáticas (37, todas pasan)
Con Firebase simulado en el navegador:
- Las 12 de la v0.1.1 (entrada, Hoy, recargar, Seguridad, revocar, vencer, celular).
- Hoy abre Ventas de caja → Anulaciones. Aprobar una venta con pago dividido: efectivo y débito bajan lo justo, no aparece un medio "Dividido", el stock vuelve al mismo lote, queda en la actividad.
- Cerrar con arqueo: la diferencia exige nota; una sola evaluación; la planilla recibe el cierre con la misma clave que usa la caja y con la sesión de Sistema Fën; sale el correo de descuadre.
- Reenviar: si el script falla, queda en la lista con el error; al reintentar, sale de la lista.
- Cerrar sin arqueo (también pasa a la planilla) y corregir un arqueo.
- Caja que vendió hace 5 minutos: avisa y, si dices que no, no se cierra.
- Solicitud aprobada en otro equipo justo antes: no se descuenta dos veces.
- Celular: Caja en la barra inferior, sin scroll horizontal.
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
