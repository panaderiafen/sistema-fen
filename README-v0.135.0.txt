Sistema Fën v0.135.0 (18 nov 2026) · Boletas: una sola puerta (entrega 2 de 2: la Bandeja) · incluye la v0.134.0

Boceto "Boletas: una sola puerta", aprobado por Emmanuel el 18 nov.

QUÉ CAMBIA EN GASTOS → BANDEJA
1. En cada cargo sin documento: Buscar su documento · Tengo la boleta (foto) · Sin documento · No es gasto
   (y siguen Pago a cuenta y Nota).
   - "Tengo la boleta (foto)": la boleta no estaba anotada. Se anota con su foto y queda unida a ese cargo.
     Si ya hay una boleta anotada del mismo monto, primero pregunta "¿Es la boleta del …?" para no anotarla dos veces.
   - "Sin documento": comisión, interés, impuesto del banco, cuota. Sin foto ni N° de boleta.
   - Se retiran "Registrar a mano" y "Registrar gasto sin banco". En un resto de cargo, "Otro…" pasa a "Sin documento".
2. "Boletas esperando su pago" (grupo propio, ya no mezcladas en Documentos sin pago). Cada una dice qué espera:
   su cargo, la compra del estado de cuenta de la tarjeta, el retiro "Pago a proveedor" de la caja o el pago del cobro.
   Si el pago en efectivo que espera ya está anotado, aparece "Ya está anotado un pago de este monto" y
   "Buscar su pago en efectivo" la une (usted confirma).
3. Aprende el comercio: al unir una boleta con su cargo, la glosa queda aprendida. La próxima vez, el par aparece en
   Para conciliar con "aprendido: MERPAGO JAVI es Punto Frut". Para que funcione, escriba el comercio siempre igual
   en "Dónde compró" (la lista sugiere los ya usados).
4. "Parece repetido": el mismo cargo (cuenta, fecha, monto y glosa) en dos cartolas distintas. Se queda el de la
   cartola que llegó primero; el otro muestra "Es repetido" (queda como no es gasto, se puede volver) o
   "Son dos compras" (no vuelve a avisar).
5. La (i) de + Boleta suma: "Un cargo de una boleta que no anotó: en el cargo, Tengo la boleta" y lo que aprende.

ARCHIVOS
   Cambian: vista-gn.js, gn-fs.js, gn-bandeja.js, estilos.css, config.js y la versión (?v=).
   Reglas: ninguna cambia.

CHECKLIST
   [ ] Subir el zip (raíz del repo sistema-fen). Recargar: dice v0.135.0.
   [ ] Gastos → Bandeja: un cargo sin documento muestra los 4 botones; ya no está "Registrar gasto sin banco".
   [ ] Si hay boletas anotadas sin pago, aparece "Boletas esperando su pago".

SI ALGO SALE MAL
   Volver a subir la v0.134.0.

PRUEBAS
   bandbol-v01350 (6: botones del cargo, Tengo la boleta con foto y glosa aprendida, Sin documento, par con glosa
   aprendida, boletas esperando con retiro de caja unido, parece repetido); boleta2-v01340 y batería completa.
