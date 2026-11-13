Sistema Fën v0.127.2 · 13 nov 2026 (incluye la v0.127.1)

Qué cambia: Cartolas por período (boceto aprobado el 13 nov)
1. Gastos → Bandeja → Cartolas, y Ventas a empresas → Conciliación → Cartolas:
   las cartolas en línea de la misma cuenta se juntan en una sola tarjeta. Arriba la más nueva (trae todo lo de las
   anteriores); las anteriores quedan plegadas en "En línea anteriores de estos mismos días". Nada se borra.
2. Cuando sube la histórica que cubre esos días, manda ella: las en línea quedan dentro ("En línea que quedaron dentro de
   esta") y en Gastos se ve "Comprobada con las en línea: N ya estaban · M nuevos", con lo que trae solo la histórica.
   En Ventas a empresas dice cuántos abonos parecen repetidos, con "Revisar".
3. En una cartola en línea cuyo saldo no calza dice "Saldo: se revisa con la histórica cuando llegue" (antes, en rojo).
   La histórica sigue diciendo "Saldo no calza" si no calza.
Regla nueva (decidida el 13 nov): se concilia todos los días con la en línea; la histórica solo comprueba.

De la v0.127.1 (si no la subió): "Marcar como repetido" para la tercera copia de un abono; "Ya lo anoté a mano".

Cómo subirlo
- Copie los archivos del zip sobre su carpeta sistema-fen (reemplazar) y súbalos a GitHub como siempre.
- Recargue: abajo a la izquierda debe decir v0.127.2. Archivo nuevo: cartolas-periodo.js.

Revisión rápida
[ ] Gastos → Bandeja → Cartolas: una sola tarjeta "BancoEstado · 9 nov al 13 nov" con "En línea anteriores… · 6".
[ ] La Histórica N°57 sigue aparte.
[ ] Ventas a empresas → Conciliación → Cartolas: lo mismo con las en línea de abonos.
