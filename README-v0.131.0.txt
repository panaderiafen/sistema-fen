Sistema Fën v0.131.0 (17 nov 2026) · va con fen-logistica v1.4.0

Aprobado por Emmanuel el 17 nov (bocetos "Cobros en efectivo desde logística" y "Boleta primero, pago después").

QUÉ CAMBIA

1. Efectivo → Por recibir: "Cobrado por logística"
   - Lo que logística marca como pagado en efectivo (app de logística → Cobros) aparece aquí solo,
     uno por cliente: "Cobrado por logística · cliente · órdenes N° ... · cobró ...", con el total y el redondeo.
   - Se recibe como siempre (uno, varios o todos). Al recibir, las órdenes quedan "recibidas" y logística
     ya no puede deshacer el cobro.
   - El redondeo (a la decena, como en la caja) no es faltante: la orden queda pagada completa en
     Ventas a empresas y en Efectivo entra lo que se cobró en billetes.
   - Si logística deshace un cobro antes de que usted lo reciba, al abrir Efectivo desaparece de Por recibir
     (queda anulado con el motivo "Logística deshizo el cobro"; nada se borra).
   - Si Ventas a empresas no está conectada en el equipo, Efectivo funciona igual y avisa que no leyó los cobros.

2. Boleta primero, pago después
   - Al recibir con "llegó menos", aparecen las boletas pagadas en efectivo de los últimos 7 días (las de
     + Boleta). Se marcan las que se pagaron con esa plata: explican la diferencia y NO se descuentan otra vez.
   - Efectivo → Salida → Pago en efectivo: si ya hay una boleta en efectivo del mismo monto, avisa.
     "Es esa boleta: no anotar otra vez" o "Es otro pago: anotar igual".

REGLAS DE FIRESTORE (publicar ANTES de subir los archivos)
   a) fen-b2b v1.9.0: consola de Firebase → proyecto fen-b2b → Firestore Database → Reglas → borrar todo,
      pegar firestore-b2b.rules → Publicar. (Logística puede marcar el pago de una orden sin folio y deshacerlo
      mientras usted no lo recibe; nada más de la orden.)
   b) fen-ventas v1.10.0: proyecto fen-ventas → Firestore Database → Reglas → pegar firestore.rules → Publicar.
      (Permite marcar una boleta como "explica lo que faltó al recibir".)

ARCHIVOS
   Cambian: b2b.js, efectivo-modelo.js, efectivo-fs.js, vista-efectivo.js, vista-gn.js, estilos.css, config.js,
   firestore-b2b.rules, firestore.rules y la versión (?v=) de los demás archivos. Subir todos los del zip al repo
   sistema-fen (raíz) → Commit changes. Abajo a la izquierda debe decir v0.131.0.

CHECKLIST
   [ ] Publicar las reglas fen-b2b v1.9.0 y fen-ventas v1.10.0.
   [ ] Subir este zip. Recargar Sistema Fën: dice v0.131.0.
   [ ] Subir fen-logistica-v1.4.0.zip al repo fen-logistica.
   [ ] En logística → Cobros, marcar un cliente de prueba → Pagado.
   [ ] En Sistema Fën → Efectivo → Por recibir aparece "Cobrado por logística" con su monto y redondeo.
   [ ] Recibirlo: la orden queda recibida; en logística ya no aparece Deshacer.
   [ ] Recibir con "llegó menos" muestra las boletas en efectivo de los últimos días.
   [ ] Salida → Pago en efectivo del mismo monto que una boleta: aparece el aviso.

SI ALGO SALE MAL
   Volver a subir v0.130.2. Las reglas nuevas aceptan también la versión anterior.

PRUEBAS
   efcob-v01310 (3), logcob-v140 (3) y la batería completa (ver resultado en la entrega).
