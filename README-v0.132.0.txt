Sistema Fën v0.132.0 (17 nov 2026) · incluye la v0.131.0 (cobros de logística, boleta primero) si aún no la subió

QUÉ CAMBIA
1. Hoy → "Solicitudes" (arriba, antes de Mi ritmo)
   - Todo lo que piden las otras apps y espera su respuesta, una por una, la más antigua primero:
     · Caja: anular una venta, pedir un producto.
     · Logística: anular una orden, producto nuevo, agregar a B2B, precio especial.
     · Cocina: receta propuesta (nueva o cambio), materia prima nueva.
   - Cada una dice de dónde viene, quién la pidió y hace cuánto. Al tocarla lo lleva a la pantalla donde se resuelve
     (esas pantallas siguen igual). Cuando la resuelve allá, sale de Hoy.
   - Los avisos sueltos que había en Pendientes (anulación por aprobar, productos pedidos, solicitudes de logística,
     recetas y materias primas de Cocina) ya no se repiten ahí.
   - Si no hay nada por responder, la tarjeta no aparece.

2. Correo por cada solicitud nueva: script nuevo "Avisos de solicitudes" (carpeta apps-script/avisos-solicitudes)
   - Cada 5 minutos revisa lo pendiente en las tres bases y manda un correo por cada solicitud nueva, con qué pide,
     quién, el detalle y un botón para abrir Sistema Fën → Hoy. No cambia nada en ninguna base ni en ninguna app.
   - Anular una venta en la caja NO se repite: ese correo ya lo manda la caja misma.
   - Lo que ya está pendiente al instalarlo no se avisa (para no recibir una ola de correos viejos).

INSTALAR EL SCRIPT DE AVISOS (una vez)
   Debe hacerlo con la cuenta de Google dueña de los proyectos de Firebase fen-ventas, fen-b2b y fen-produccion
   (si no es la misma para los tres, avíseme). Los correos llegan a esa cuenta.
   1. script.google.com → Nuevo proyecto. Nombre: "Fën · Avisos de solicitudes".
   2. Borrar lo que trae Código.gs y pegar AvisosSolicitudes.gs.
   3. Configuración del proyecto (engranaje) → marcar "Mostrar el archivo de manifiesto appsscript.json en el editor".
      Volver al editor, abrir appsscript.json, borrar todo y pegar el appsscript.json del zip. Guardar.
   4. Arriba elegir la función "instalar" → Ejecutar → aceptar los permisos (Firestore, enviar correos, ejecutar cada 5 min).
   5. Llega un correo "Avisos de solicitudes activados" con cada base: debe decir OK en las cuatro líneas.
   Para apagarlo: ejecutar "desinstalar".

ARCHIVOS
   Nuevos: solicitudes-hoy.js, apps-script/avisos-solicitudes/ (AvisosSolicitudes.gs, appsscript.json).
   Cambian: app.js, produccion.js, estilos.css, config.js y la versión (?v=) de los demás.
   Reglas de Firestore: ninguna cambia en esta versión (las de la v0.131.0 siguen siendo necesarias si no las publicó).

CHECKLIST
   [ ] Subir el zip al repo sistema-fen (raíz). Recargar: dice v0.132.0.
   [ ] Hoy muestra "Solicitudes" con lo pendiente de la caja, logística y Cocina; cada una lleva a su pantalla.
   [ ] Instalar el script de avisos; llega el correo de prueba con OK en las cuatro líneas.
   [ ] Pedir un producto de prueba desde la caja: en menos de 5 minutos llega el correo "Solicitud · Caja · Producto nuevo: ...".

SI ALGO SALE MAL
   Volver a subir v0.131.0 (o v0.130.2). El script de avisos se apaga con "desinstalar".

PRUEBAS
   solhoy-v01320 (Hoy, 1440 y 390), avisos-sol-v01320 (script: avisa una vez, no repite) y la batería completa.
