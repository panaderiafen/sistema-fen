Sistema Fën v0.128.1 · 13 nov 2026 (incluye v0.127.1, v0.127.2 y v0.128.0)

Qué cambia
1. Mercado Pago, saldo exacto: al subir el reporte de liberaciones se guarda el saldo de su última fila (BALANCE_AMOUNT).
   Plata hoy usa ese saldo: "Mercado Pago · saldo del reporte al 12 nov 12:49".
2. Mercado Pago, pagos en reserva: un pago con el saldo que el reporte todavía muestra como reserva (reserve_for_payment, sin su
   "payment") ahora entra como cargo en Gastos. Si un reporte después trae el pago terminado de esa operación, no se repite.
3. Plata hoy: la deuda de antes del 1 oct se muestra aparte y ya no se suma (casi siempre se pagó antes del corte).

Después de subirlo
- Vuelva a subir el reporte de liberaciones del 1 al 12 nov (Gastos → arrastrar el archivo). No se repite nada:
  entran los 3 pagos del 11 nov que estaban en reserva ($2.850, $37.008 y $6.320) y queda guardado el saldo final ($600.565).
- Después, en la Bandeja, una el de $37.008 con la factura de Electrocom y el de $6.320 con la de Bau-Plan.

Revisión rápida
[ ] Abajo a la izquierda dice v0.128.1.
[ ] Finanzas → Plata hoy: Mercado Pago $600.565 (si subió de nuevo el reporte).
[ ] "Deuda de antes del 1 oct" aparece en gris y dice "no se suma".
