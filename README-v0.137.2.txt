Sistema Fën v0.137.2 (21 nov 2026) · Categoría de las materias primas: elegir de una lista · incluye la v0.137.0 y la v0.137.1

Pedido de Emmanuel el 21 nov: "si escribo mal una categoría que existe se creará otra" (había "Lácteos", "Lacteos" y "Leches").

QUÉ CAMBIA
- El campo Categoría es ahora una lista con las que existen (Chocolates, Especias, Harinas, Lácteos, Materia grasa, Semillas…)
  y al final "Otra…" para una nueva. Está en:
  · Producción → Por revisar → Materias primas pedidas (al crear la que pidió una jefa).
  · Finanzas → Costos → Nueva materia prima, y al abrir una para cambiarla.
- Si en "Otra…" escribe una que ya existe (sin tilde, en plural, con mayúsculas), avisa "Ya existe "Lácteos": se usará esa"
  y se guarda con la forma que existe. Lo mismo si llega escrita distinto por cualquier otro camino.

INCLUYE (si no las subió): v0.137.1 (arreglo de "Abriendo…": Firestore por consulta larga) y v0.137.0 (comisión de tarjeta
con la tasa real; botón "Recibir").

ARCHIVOS: campo-categoria.js (nuevo), mp-alta-modelo.js, produccion.js, vista-produccion.js, vista-finanzas.js, estilos.css,
config.js y la versión (?v=). Reglas: ninguna cambia.

CHECKLIST
   [ ] Subir el zip. Recargar: dice v0.137.2.
   [ ] Producción → Materias primas pedidas (jengibre, clavo): la Categoría es una lista; elija "Especias".
SI ALGO SALE MAL: volver a subir la v0.137.1.
PRUEBAS: cat-v01372 (2); batería completa.
