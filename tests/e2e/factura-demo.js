// Factura A ficticia con el formato de "Comprobantes en línea" de ARCA y
// un QR real (RG 4291), para probar la lectura de comprobantes sin usar
// facturas reales. Los CUIT tienen dígito verificador válido.
import QRCode from 'qrcode';

export const EMISOR = '30712345671';
export const RECEPTOR = '30700000016';
export const FACTURA = { fecha: '2026-05-21', ptoVta: 3, nroCmp: 1234, neto: 100000, iva: 21000, total: 121000 };

const pesos = (n) => n.toLocaleString('es-AR', { minimumFractionDigits: 2 });

export async function htmlFactura({ conQr = true, soloTitulo = false } = {}) {
  if (soloTitulo) {
    return `<html><body style="margin:0;padding:40px;font:28px Arial;background:#fff;width:700px">
      <p>Comprobante de pago</p></body></html>`;
  }
  const qr = 'https://www.afip.gob.ar/fe/qr/?p=' + Buffer.from(JSON.stringify({
    ver: 1, fecha: FACTURA.fecha, cuit: +EMISOR, ptoVta: FACTURA.ptoVta, tipoCmp: 1,
    nroCmp: FACTURA.nroCmp, importe: FACTURA.total, moneda: 'PES', ctz: 1, tipoDocRec: 80,
    nroDocRec: +RECEPTOR, tipoCodAut: 'E', codAut: 76123456789012
  })).toString('base64');
  const imagenQr = conQr ? await QRCode.toDataURL(qr, { margin: 2, width: 220 }) : null;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:28px;font:15px Arial,sans-serif;color:#000;background:#fff;width:760px}
    .caja{border:1px solid #000;padding:12px 16px;margin-bottom:10px}
    .dos{display:flex;justify-content:space-between;gap:20px}
    .letra{font-size:42px;font-weight:bold;border:2px solid #000;padding:2px 16px;text-align:center}
    table{width:100%;border-collapse:collapse;margin:10px 0}
    td,th{border:1px solid #000;padding:5px;font-size:13px}
    .tot p{margin:4px 0;text-align:right;font-size:16px}
    p{margin:4px 0}
  </style></head><body>
  <div class="caja dos">
    <div><p style="font-size:20px"><b>HORMIGONES DEL PARANA S.A.</b></p>
      <p>Razón Social: HORMIGONES DEL PARANA S.A.</p>
      <p>Domicilio Comercial: Av. Pellegrini 1234 - Rosario</p>
      <p>Condición frente al IVA: IVA Responsable Inscripto</p></div>
    <div><div class="letra">A<br><span style="font-size:13px">COD. 01</span></div></div>
    <div><p style="font-size:20px"><b>FACTURA</b></p>
      <p>Punto de Venta: 0000${FACTURA.ptoVta} Comp. Nro: 0000${FACTURA.nroCmp}</p>
      <p>Fecha de Emisión: 21/05/2026</p>
      <p>CUIT: ${EMISOR}</p></div>
  </div>
  <div class="caja"><p>CUIT: ${RECEPTOR}</p><p>Apellido y Nombre / Razón Social: FIDEICOMISO OBRA NORTE</p></div>
  <table><tr><th>Producto / Servicio</th><th>Cantidad</th><th>Precio Unit.</th><th>Alícuota IVA</th><th>Subtotal c/IVA</th></tr>
    <tr><td>Hormigón H21 elaborado</td><td>10,00</td><td>10000,00</td><td>21%</td><td>${pesos(FACTURA.total)}</td></tr></table>
  <div class="dos">
    <div>${imagenQr ? `<img src="${imagenQr}" width="150" height="150">` : ''}
      <p>CAE N°: 76123456789012</p><p>Fecha de Vto. de CAE: 31/05/2026</p></div>
    <div class="tot">
      <p>Importe Neto Gravado: $ ${pesos(FACTURA.neto)}</p>
      <p>IVA 21%: $ ${pesos(FACTURA.iva)}</p>
      <p>IVA 10.5%: $ 0,00</p>
      <p>Importe Otros Tributos: $ 0,00</p>
      <p><b>Importe Total: $ ${pesos(FACTURA.total)}</b></p>
    </div>
  </div>
  </body></html>`;
}
