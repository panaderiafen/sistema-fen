Sistema Fën v0.133.0 (17 nov 2026) · incluye la v0.132.0

Pedido de Emmanuel el 17 nov: que el stock de las materias primas críticas se mueva solo con las facturas de compra.

QUÉ CAMBIA (Producción → Bodega, arriba: "Facturas de críticas")
- Cada factura de compra de una crítica entra sola a su bodega como llegada: cantidad de la factura × lo que trae
  cada unidad (80 sacos × 25 kg = 2.000 kg). No hay que presionar nada: pasa al abrir Bodega.
- Entra con la fecha de la factura. Si llegó otro día, se cambia en "Llegó el" y el stock se recalcula solo, también
  hacia atrás (el stock es siempre: último conteo + llegadas − lo que usaron las recetas desde ese conteo).
- Una factura de antes del último conteo ya está dentro del conteo (no suma de nuevo).
- "Productos de factura sin asociar": los que parecen de una crítica (harina, mantequilla). Se asocian una vez
  (materia prima y cuánto trae cada unidad) y desde ahí sus facturas entran solas. Asociar también actualiza el
  precio en Costos. Lo que no es (por ejemplo "papel mantequilla") se marca "No es materia prima".
- "Llegadas anotadas a mano que se repiten": las que anotaron las jefas desde el 1 oct de una crítica que ya recibe
  sus facturas. Botón "Anular las anotadas a mano" (quedan anuladas con el motivo; nada se borra).
- Cada llegada de factura queda una sola vez (id fijo); si alguien la anula, no vuelve a entrar.
- Las jefas ya NO anotan llegadas: solo cuentan cuando se les pida.

PRIMERA VEZ (una vez, después de subir)
1. Producción → Bodega → "Facturas de críticas" → "Productos de factura sin asociar". Asociar:
   · HARINA SUPER FINA PLUS 25 KG (Heredia) → Harina de fuerza · 25 kg
   · HARINA INTEGRAL POLI 25 KG (Heredia) → Harina integral · 25 kg
   · SACOS 25K HARINA EX/FINA 3/0 (Cunaco) → Harina T000 · 25 kg
   · SACOS 25K HARINA EX/FINA 4/0 (Cunaco) → Harina cuatro cero · 25 kg
   · SOPROLE Mantequilla Barra 4x5Kg → Mantequilla extra seca · 1 kg (la factura cobra por kg)
   · Papel mantequilla, mantequilla Don Ricardo y otros que no sean críticas → "No es materia prima".
2. "Anular las anotadas a mano" (las 4 llegadas de mantequilla que ya vienen en las facturas de Soprole).
3. Pedir un conteo de las 5 críticas (la cuatro cero nunca se ha contado).

Con los datos de hoy, después del paso 1 y 2 el stock quedaría (antes → después):
   Harina T000 −152 kg → 1.848 kg · Harina de fuerza 25 → 400 kg · Harina integral 106 → 256 kg ·
   Mantequilla −6 → 37 kg · Harina cuatro cero: sin conteo (hasta que se cuente).

ARCHIVOS
   Nuevo: bodega-facturas.js. Cambian: produccion.js, vista-produccion.js, estilos.css, config.js y la versión (?v=).
   Reglas de Firestore: ninguna cambia. Cocina: sin cambios (las jefas simplemente dejan de anotar llegadas).

CHECKLIST
   [ ] Subir el zip al repo sistema-fen (raíz; si son más de 100 archivos, sin la carpeta apps-script ni este README).
   [ ] Recargar: dice v0.133.0.
   [ ] Producción → Bodega: aparece "Facturas de críticas".
   [ ] Asociar los 5 productos (paso 1): las facturas de octubre y noviembre aparecen con "entró".
   [ ] Anular las llegadas a mano repetidas (paso 2). El stock de las harinas y la mantequilla deja de ser negativo.

SI ALGO SALE MAL
   Volver a subir la v0.132.0. Las llegadas de factura que alcanzaron a entrar se pueden anular igual que cualquier
   llegada; las asociaciones se cambian en Finanzas → Costos → Compras del SII.

PRUEBAS
   bodfac-v01330 (3: compras × contenido, notas de crédito, no repite lo anulado, factura tarde descuenta hacia atrás,
   fecha de recepción después del conteo, sin asociar, repetidas) y la batería completa. Simulación con los datos
   reales (sin escribir nada): los números de arriba.
