Sistema Fën v0.136.0 (18 nov 2026) · Efectivo: recibir los cobros juntos con una sola línea del total

Pedido de Emmanuel el 18 nov: "una línea de cuánto llegó para que el sistema haga la resta solo". Los cobros B2B llegan
siempre juntos.

QUÉ CAMBIA (Efectivo → Por recibir → Recibir todos / Recibir lo seleccionado)
- Arriba, la lista de lo que se esperaba (cada cobro con su monto) y el total.
- Una sola línea: "¿Cuánto llegó en total?". Parte con el total esperado; escriba lo que contó.
- Si llegó menos, aparece al tiro "Llegaron $X menos" con:
  · las boletas ya pagadas en efectivo (+ Boleta) para marcar;
  · "+ Un pago hecho con esa plata" (el monto se sugiere solo con lo que falta);
  · "+ Falta y no sé en qué se usó".
  Debajo dice "Falta explicar $Y" o "Diferencia explicada".
- El sistema reparte la diferencia entre los cobros (usted no reparte nada). Cada cobro queda recibido con lo que le
  tocó, igual que antes. Una boleta no se parte entre dos cobros: si una boleta es mayor que cada cobro por separado,
  lo avisa.
- Recibir uno solo (su botón Recibir) sigue igual.

ARCHIVOS
   Cambian: vista-efectivo.js, efectivo-modelo.js, config.js y la versión (?v=).
   Reglas: ninguna cambia.

CHECKLIST
   [ ] Subir el zip (raíz del repo sistema-fen). Recargar: dice v0.136.0.
   [ ] Efectivo → Recibir todos: aparece "¿Cuánto llegó en total?".
   [ ] Al escribir menos, aparece la lista de boletas y los botones; al explicar todo dice "Diferencia explicada".

SI ALGO SALE MAL
   Volver a subir la v0.135.0.

PRUEBAS
   efectivo-sel-v01248 (línea del total con faltante; cobros juntos con una boleta ya pagada y un pago, el saldo y lo
   que queda por unir), recibir-v01210; batería completa.
