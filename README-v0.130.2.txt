Sistema Fën v0.130.2 (14 nov 2026)

Arreglo: Gastos → cargo → "Buscar su documento"
- El buscador no escondía nada: el estilo de la lista le ganaba al filtro. Ahora filtra.
- Busca también montos escritos con punto (55.848) o sin punto (55848).
- Busca en todos los documentos sin pago, no solo en los 60 primeros (sin texto se siguen viendo 60).
- El mismo arreglo vale para "¿Cómo se pagó?" y las otras ventanas que usan ese buscador.

Archivos: vista-gn.js, estilos.css, config.js y los ?v= de los archivos que cambian de versión.

Checklist
[ ] Subir los archivos del zip a GitHub (reemplazar).
[ ] Abrir Sistema Fën y recargar (debe decir v0.130.2).
[ ] Gastos → un cargo → Buscar su documento → escribir parte del nombre: la lista se achica.
[ ] Escribir un monto con punto: aparece el documento de ese monto.
