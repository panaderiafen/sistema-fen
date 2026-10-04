# Sistema Fën · v0.1.1

**App:** v0.1.1 · **Reglas de Firestore:** v1.2.0 · 4 de octubre de 2026
**Dirección:** https://panaderiafen.github.io/sistema-fen/

Primera versión de la etapa 1. Solo entra la cuenta de administración (la misma de la caja).

## Qué trae

| Pantalla | Qué hace |
| --- | --- |
| **Entrada** | Correo y contraseña de administración, nombre del equipo y por cuánto tiempo recordarlo: solo esta vez (hasta cerrar el navegador, máximo 12 horas), 30 días, 4 meses (sugerido), 1 año o una fecha |
| **Hoy** | Pendientes reales de la caja: descuadres de ayer y hoy, cajas de días anteriores sin cerrar, cierres sin pasar a planilla, anulaciones por aprobar. Ventas de ayer en caja y cajas abiertas ahora. Cada pendiente abre la caja |
| **Seguridad** | Tus equipos autorizados, cuándo vence cada uno, cambiar la duración, revocar, salir de este equipo, actividad reciente y correo para cambiar la contraseña |
| **Menú** | Abre las apps actuales (Ventas B2B, Gastos, Producción, Caja, Asistencia) en otra pestaña |

(i) Gastos, Ventas B2B y Producción aparecen en Hoy como "Llega en la v0.2": esa versión los conecta. La agenda llega en la etapa 3.

(i) Sistema Fën tiene **su propia sesión**: entrar, salir o revocar aquí no cambia ni cierra la cuenta abierta en la caja de ese equipo.

(i) Revocar un equipo cierra Sistema Fën ahí (al instante si está abierto). Si perdiste un equipo, además cambia tu contraseña desde Seguridad: al cambiarla, Firebase cierra tu cuenta en todos los equipos (también en la caja) en menos de una hora.

## Archivos y dónde va cada uno
```
firestore.rules        reglas v1.2.0                      → consola de Firebase (fen-ventas) → Firestore Database → Reglas
index.html             la app                              → GitHub, repo sistema-fen, raíz
estilos.css            colores Salvia y arena              → GitHub, sistema-fen, raíz
config.js              versión, apps del menú, Firebase    → GitHub, sistema-fen, raíz
firebase.js            conexión con Firebase               → GitHub, sistema-fen, raíz
app.js                 entrada, Hoy, Seguridad, menú        → GitHub, sistema-fen, raíz
README.md              este archivo                        → GitHub, sistema-fen, raíz
firestore-v1.1.0.rules reglas anteriores, por si hay que volver → no se sube (guárdalo)
```

(i) `config.js` lleva la configuración web de Firebase. No es secreta: es la misma que ya está en la caja y solo dice a qué proyecto conectarse. Lo que protege los datos son las reglas y tu contraseña.

## Instalación (en este orden)

### 1. Reglas de Firestore (2 minutos)
1. Consola de Firebase → **fen-ventas** → **Firestore Database** → pestaña **Reglas**.
2. Borra todo, pega el contenido de `firestore.rules` → **Publicar**.
3. (i) Es lo mismo que ya tenías más dos bloques nuevos (`equipos` e `historial`), que solo puede usar la cuenta de administración. Lo de la caja no cambia.
4. Revisa la caja: abre la caja y haz algo de todos los días, como ver Stock o Reportes. Debe funcionar igual.

### 2. GitHub
1. En el repo **sistema-fen**, sube `index.html`, `estilos.css`, `config.js`, `firebase.js`, `app.js` y `README.md` a la raíz.
2. **Settings → Pages →** Source: *Deploy from a branch* · Branch: **main** · carpeta **/(root)** → **Save**.
3. Espera 1 o 2 minutos y abre https://panaderiafen.github.io/sistema-fen/

### 3. Primera entrada
1. Correo y contraseña de administración de la caja.
2. Nombre del equipo (por ejemplo "Computador oficina") y **4 meses** → **Entrar**.
3. Haz lo mismo en tu celular (por ejemplo "Celular de Emmanuel").

## Lista de verificación
- [ ] Entras y aparece **Hoy** con los pendientes de la caja (o "Nada pendiente en la caja").
- [ ] Recargas la página: sigues dentro, sin volver a poner la contraseña.
- [ ] **Seguridad** muestra tus equipos. Desde el computador, revoca el celular: en el celular, Sistema Fën se cierra y explica por qué. Vuelve a entrar en el celular.
- [ ] La caja sigue funcionando como siempre (paso 1.4).

## Si algo sale mal
- **"Firestore no dejó guardar: falta publicar las reglas v1.2.0":** falta el paso 1.
- **La caja muestra errores de permisos después del paso 1:** en Reglas, pega `firestore-v1.1.0.rules` → Publicar (vuelve a como estaba) y avísame.
- **La página de GitHub muestra 404:** revisa el paso 2.2 y espera unos minutos.

## Pruebas automáticas (12, todas pasan)
Con Firebase simulado en el navegador:
- Entrada: contraseña mala y cuenta que no es de administración no entran. El dueño autoriza el equipo por 4 meses y queda en el historial.
- Hoy: muestra en orden el descuadre, la caja anterior sin cerrar, el cierre sin planilla y la anulación; las ventas de ayer; y las cajas abiertas hoy.
- Recargar no pide contraseña.
- Seguridad: cambiar la duración, revocar otro equipo, salir de este equipo (queda en la actividad), y el correo para cambiar la contraseña.
- Revocado desde otro equipo: se cierra al instante. Vencido, también con la app abierta: pide entrar de nuevo.
- "Solo esta vez" no queda guardado en el equipo.
- Celular: barra inferior, sin scroll horizontal, Seguridad en tarjetas, Menú.
- Sin errores de JavaScript.

Además, una revisión independiente del código y las reglas antes de entregar: las reglas de la caja quedan idénticas. Se corrigieron 4 detalles: la sesión ahora es propia de Sistema Fën y no toca la caja; se revisa el vencimiento con la app abierta; "Salir" deja su registro; un equipo revocado no puede volver a quedar vigente.

**Lo que no pude probar aquí:** Firebase real. Por eso la lista de verificación.
