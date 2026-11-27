# Sistema Fën v0.139.1 — Cobros de logística en órdenes ya facturadas

**Dónde va:** repo **sistema-fen** en GitHub (Add file → Upload files, todo el contenido del zip, Commit).
**Antes:** publicar las reglas **fen-b2b v1.11.0** (archivo aparte) en Firebase → proyecto fen-b2b → Firestore → Reglas → Publicar.

## Qué cambia
- Logística ahora puede cobrar órdenes que **ya tienen folio** (cuando se factura antes de que cobre).
- Al **recibir** ese cobro en Efectivo → Por recibir, el pago queda como **abono del folio** (igual que cuando se factura una orden ya pagada):
  - si con eso se cubre la factura, las demás órdenes del folio quedan **Pagadas**; si no, **Parcial**.
  - si el folio ya estaba pagado entero por otro lado (por ejemplo, transferencia), no se agrega otro abono.

## Revisar después de subir
- [ ] Abajo a la izquierda dice **v0.139.1**.
- [ ] Al recibir un cobro de logística de una orden facturada, en Cobranza el folio muestra el abono.
