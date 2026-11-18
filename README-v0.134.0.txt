Sistema Fën v0.134.0 (18 nov 2026) · Boletas: una sola puerta (entrega 1 de 2) · incluye la v0.133.0

Boceto "Boletas: una sola puerta", aprobado por Emmanuel el 18 nov.
La regla: lo que compró se anota una vez, con + Boleta. Cómo se pagó lo encuentra el sistema: usted confirma.

QUÉ CAMBIA
1. + Boleta
   - La (i) ahora es la cartilla: qué hacer en cada caso (débito, crédito, efectivo, mi plata, sin boleta posible,
     un cargo que parece de una boleta).
   - Medios: Débito o transferencia · Tarjeta de crédito · Efectivo · Mi plata. Debajo, una línea dice qué va a pasar.
   - Efectivo pregunta "¿De dónde salió la plata?":
     · Caja de administración: queda pagada al guardar (como antes).
     · Una caja de venta: si la cajera ya anotó el retiro "Pago a proveedor" de ese monto, lo propone ("Es este pago:
       unir la boleta"); si todavía no está, la boleta lo espera (no descuenta nada de la caja de administración).
     · Un cobro a un cliente: si ya hay un pago anotado al recibir ese cobro, lo propone; si no, queda pagada y al
       recibir el cobro con "llegó menos" se marca (como desde la v0.131.0).
   - Tarjeta de crédito: ya NO crea su propia compra de la tarjeta. La boleta espera la compra del estado de cuenta
     (así no se repite). Hay que subir el estado de cuenta de la tarjeta cada mes.
2. Efectivo → Salida → "Pago en efectivo (solo para pagos en efectivo sin boleta posible)"
   - Al guardar, pide ítem y área y queda en Gastos como gasto "Sin documento", unido a la salida. Si presiona
     "Después", queda por unir y se termina desde "Unir a su documento" → "No tiene boleta posible: registrar el gasto".
   - En "Unir a su documento", el enlace a "Registrar gasto sin banco" se reemplazó por + Boleta o "sin documento".

VIENE EN LA ENTREGA 2 (Bandeja): "Boletas esperando su pago" visible; en cada cargo: Buscar su documento · Tengo la
boleta · Sin documento · No es gasto; aprende cómo aparece cada comercio en la cartola; aviso de cargo repetido entre
cartolas; se retiran "Registrar a mano" y "Registrar gasto sin banco".

ARCHIVOS
   Cambian: vista-gn.js, gn-fs.js, vista-efectivo.js, efectivo-modelo.js, estilos.css, config.js y la versión (?v=).
   Reglas: ninguna cambia.

CHECKLIST
   [ ] Subir el zip (raíz del repo sistema-fen). Recargar: dice v0.134.0.
   [ ] + Boleta → la (i) muestra la cartilla.
   [ ] + Boleta → Efectivo → aparece "¿De dónde salió la plata?".
   [ ] Efectivo → Salida: el motivo dice "Pago en efectivo (solo para pagos en efectivo sin boleta posible)" y al
       guardar pide ítem y área.

SI ALGO SALE MAL
   Volver a subir la v0.133.0.

PRUEBAS
   boleta2-v01340 (4: caja de venta une con su retiro, caja de venta sin retiro espera, crédito no crea compra,
   efectivo sin boleta posible queda como gasto unido), boleta-v01300 y efcob-v01310 siguen pasando; batería completa.
