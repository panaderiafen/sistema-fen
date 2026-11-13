Sistema Fën v0.129.0 · 13 nov 2026 (incluye v0.127.1 a v0.128.3)

Qué cambia: Informe de conciliación (boceto aprobado el 13 nov)
- Finanzas → Resultados → Cierre de mes: tarjeta nueva "Informe de conciliación" para el mes elegido.
  "Preparar el informe" muestra cargos y abonos conciliados (con su %) y lo pendiente; "Descargar informe (Excel)" baja
  "Fen conciliacion AAAA-MM.xlsx" con tres hojas:
  · Resumen: por cuenta, saldo inicial y final de la cartola, lo que entró y salió, si calza, cuánto está conciliado;
    la lista de pendientes con su nota; las ventas con tarjeta liberadas por Mercado Pago, por día.
  · Cargos: cada cargo con glosa, N° de operación, monto, cómo quedó (unido a su documento, no es gasto, pago a cuenta,
    pendiente) y, si tiene, su documento (tipo, folio, RUT, razón social), ítem, área, situación ante el SII, foto y nota.
  · Abonos: cada abono con cómo quedó, cliente, folios que paga y nota (los repetidos dicen de cuál son copia).
- Sale con los datos del día en que se descarga (si el mes está abierto, dice "borrador").

Cómo subirlo
- Copie los archivos del zip sobre su carpeta sistema-fen (reemplazar) y súbalos a GitHub como siempre.
- Recargue: abajo a la izquierda debe decir v0.129.0. Archivos nuevos: informe-conc.js, vista-informe-conc.js.

Revisión rápida
[ ] Finanzas → Resultados → Cierre de mes → elija octubre → "Preparar el informe de octubre".
[ ] Descargue el Excel y revise las tres hojas.
[ ] En Resumen, la chequera: ¿calza el saldo?
