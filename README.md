# Sistema Fën · v0.3.0

**App:** v0.3.0 · **Reglas de Firestore:** v1.2.0 (sin cambios) · 4 de octubre de 2026
**Dirección:** https://panaderiafen.github.io/sistema-fen/

Etapa 1. Solo entra la cuenta de administración (la misma de la caja).

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
caja.js                lógica de cierres y anulaciones     → GitHub, sistema-fen, raíz
logo-fen.png           logo secundario en verde                   → GitHub, sistema-fen, raíz (nuevo en v0.2.2)
README.md              este archivo                               → GitHub, sistema-fen, raíz (reemplaza)
firestore.rules        reglas v1.2.0, IGUALES a las que ya están  → no hace falta publicarlas de nuevo
```
Nada en Apps Script ni en la caja cambia.

(i) `config.js` lleva la configuración web de Firebase. No es secreta: es la misma que ya está en la caja y solo dice a qué proyecto conectarse. Lo que protege los datos son las reglas y tu contraseña.

## Instalación de la v0.3.0
1. En GitHub, repo **sistema-fen** → **Add file → Upload files** → arrastra `index.html`, `estilos.css`, `config.js`, `app.js`, `caja.js`, `README.md` y `logo-fen.png` → **Commit changes**.
2. Espera 1 o 2 minutos y abre https://panaderiafen.github.io/sistema-fen/ (si ves la versión anterior, recarga con Ctrl+Shift+R; abajo a la izquierda debe decir **v0.3.0**).

(i) Instalación desde cero (v0.1): reglas v1.2.0 en Firebase, subir los archivos, Settings → Pages → *Deploy from a branch*, **main**, **/(root)**. Ya está hecho.

## Lista de verificación
- [ ] Abajo a la izquierda dice **v0.3.0** y arriba aparece el logo en verde.
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

## Pruebas automáticas (22, todas pasan)
Con Firebase simulado en el navegador:
- Las 12 de la v0.1.1 (entrada, Hoy, recargar, Seguridad, revocar, vencer, celular).
- Hoy abre Ventas de caja → Anulaciones. Aprobar una venta con pago dividido: efectivo y débito bajan lo justo, no aparece un medio "Dividido", el stock vuelve al mismo lote, queda en la actividad.
- Cerrar con arqueo: la diferencia exige nota; una sola evaluación; la planilla recibe el cierre con la misma clave que usa la caja y con la sesión de Sistema Fën; sale el correo de descuadre.
- Reenviar: si el script falla, queda en la lista con el error; al reintentar, sale de la lista.
- Cerrar sin arqueo (también pasa a la planilla) y corregir un arqueo.
- Caja que vendió hace 5 minutos: avisa y, si dices que no, no se cierra.
- Solicitud aprobada en otro equipo justo antes: no se descuenta dos veces.
- Celular: Caja en la barra inferior, sin scroll horizontal.
- v0.3.0: desde Hoy abre el reporte de ayer; bruto, neto, anuladas, ticket promedio y porcentajes por medio de pago; genera el resumen que falta y lo suma; filtro por sucursal; por sucursal; celular sin scroll horizontal.
- v0.2.1: cuadrada sin Corregir; descuadre primero; 6 arqueos muestran 3 y "Ver todas (6)" / "Ver menos"; aceptar diferencia no cambia montos, queda en la actividad y sale de Hoy.

Además, una revisión independiente comparó `caja.js` con la caja v2.1.1 y el script de la planilla: los nombres de campos y la clave anti-duplicados coinciden. De esa revisión salieron las mejoras de "sin dobles", "caja que sigue vendiendo", el correo de descuadre y un arreglo de seguridad en *Corregir*.

**Pendiente para la caja (no es de esta entrega):** que las reglas no dejen vender en una caja ya cerrada; que la caja también use "un solo paso" al cerrar y aprobar; arreglar el descuento del pago dividido; y en el script de la planilla, revisar duplicados por ID Caja en vez de por la primera venta.

**Lo que no pude probar aquí:** Firebase real y el script real. Por eso la lista de verificación.
