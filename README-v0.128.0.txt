Sistema Fën v0.128.0 · 13 nov 2026 (incluye la v0.127.1 y la v0.127.2)

Qué cambia: Plata de Fën hoy (boceto aprobado el 13 nov)
1. Finanzas → Plata hoy (pestaña nueva), con tres totales:
   - Lo que hay: BancoEstado chequera y cuenta corriente (saldo de su última cartola), Mercado Pago (último reporte),
     caja de administración (lo que debería haber), fondos de las cajas y sobres por recibir. Cada uno con la fecha de
     su dato; si tiene más de 2 días, la etiqueta "hace N días".
   - Lo que viene: por cobrar (folios de Ventas a empresas) y por pagar (documentos de Gastos), cada uno en vencido,
     esta semana y más adelante (se abren para ver el detalle); deuda de antes del 1 oct; tarjeta de crédito usada; su total.
     Sueldos, Previred, F29, cuotas y arriendos sin documento entran "estimado" hasta 30 días (como el Flujo de caja).
   - Lo que queda si todo se cobra y se paga = lo que hay + lo que viene.
   - Aviso si hay cargos o abonos sin conciliar (los totales pueden cambiar). La cuenta con el dueño se muestra al pie y no se suma.
2. Hoy: tarjeta "Plata de Fën" con los tres totales del último cálculo en este equipo (se actualiza al abrir Plata hoy).
No se anota nada nuevo y no hay reglas nuevas: usa los mismos datos del Flujo de caja.

Cómo subirlo
- Copie los archivos del zip sobre su carpeta sistema-fen (reemplazar) y súbalos a GitHub como siempre.
- Recargue: abajo a la izquierda debe decir v0.128.0. Archivos nuevos: plata-hoy.js, vista-plata.js, cartolas-periodo.js.

Revisión rápida
[ ] Finanzas → Plata hoy: los tres totales; "Lo que queda" = lo que hay + lo que viene.
[ ] Cada cuenta del banco con su fecha; la cuenta corriente probablemente con "hace N días".
[ ] Abra "Por pagar · Esta semana": se ven los documentos y los estimados con su etiqueta.
[ ] Vuelva a Hoy: la tarjeta "Plata de Fën" con los tres totales.
