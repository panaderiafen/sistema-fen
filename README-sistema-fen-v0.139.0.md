# Sistema Fën v0.139.0 — Gastos de logística y etiqueta del sobre B2B

**Dónde va:** repo **sistema-fen** en GitHub (Add file → Upload files, arrastrar todo el contenido del zip, Commit).

## Qué cambia
- **Efectivo → Por recibir:** los gastos que logística anota con la plata de los cobros (estacionamiento, compras chicas) llegan solos al recibir.
  - En cada cobro de logística de ese día aparece "Logística anotó gastos ese día: se descuentan al recibir".
  - Al tocar **Recibir** en ese cobro se abre **"Recibir el sobre de logística"**, con todos los cobros del día y los gastos ya puestos como pagos. "¿Cuánto llegó?" viene con lo que debería llegar (cobrado − gastos).
  - Cada gasto queda como pago en efectivo **Por unir a su documento**: en Gastos lo une a su boleta ("Tengo la boleta") o lo deja "Sin documento", como siempre.
  - Al recibir, los gastos quedan recibidos y logística ya no los puede quitar.
- **Sobre del efectivo B2B (Cobranza):** el botón ahora es **"Imprimir etiqueta"**: en el iPhone abre Compartir con la etiqueta de 80 × 50 mm (con el logo); elija **Print Label**. En el iMac la descarga como PDF. Si la app no recibe el PDF, el enlace "compártala como imagen". (El iPhone no deja imprimir directo desde una página; la caja de Ainavillo y logística sí imprimen directo.)

## Antes de usarlo
1. Pegar las reglas **fen-b2b v1.10.0** (archivo aparte `reglas-fen-b2b-v1.10.0.txt`) en la consola de Firebase del proyecto **fen-b2b** → Firestore → Reglas → Publicar. Sin esto, logística no puede guardar gastos.

## Revisar después de subir
- [ ] Abajo a la izquierda dice **v0.139.0**.
- [ ] Efectivo abre normal y Por recibir se ve igual que antes (sin gastos, nada cambia).
- [ ] En Cobranza, el sobre de un pago en efectivo muestra "Imprimir etiqueta" y en el iPhone abre Compartir.
