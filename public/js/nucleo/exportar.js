/* =====================================================================
   nucleo/exportar.js
   Exportaciones a Excel

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- exportaciones ---------- */
/* Excel de verdad: una hoja por tabla y los números como números.
   Si la librería no cargó, cae en CSV para no dejar al usuario sin nada. */
function bajarExcel(hojas, nombre){
  if(!window.XLSX){
    const todo = [];
    hojas.forEach((h,i) => { if(i) todo.push([]); todo.push([h.nombre]); todo.push(...h.filas); });
    bajarCsv(todo, nombre + '.csv');
    aviso('Se descargó en CSV: no se pudo cargar el generador de Excel.', true);
    return;
  }
  const libro = XLSX.utils.book_new();
  hojas.forEach(h => {
    const hoja = XLSX.utils.aoa_to_sheet(h.filas);
    hoja['!cols'] = (h.filas[0]||[]).map((_,i) => ({
      wch: Math.min(38, Math.max(11, ...h.filas.map(f => String(f[i] ?? '').length + 2)))
    }));
    XLSX.utils.book_append_sheet(libro, hoja, h.nombre.slice(0,31));
  });
  XLSX.writeFile(libro, nombre + '.xlsx');
}

function bajarCsv(filas, nombre){
  const q = s => `"${String(s??'').replace(/"/g,'""')}"`;
  const csv = '\ufeff' + filas.map(f=>f.map(q).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = nombre; a.click(); URL.revokeObjectURL(a.href);
}
function exportarComprobantes(){
  const o = obra();
  const num = v => Math.round((+v||0)*100)/100;
  const filas = [['Fecha','Caja','Grupo','Rubro','Proveedor','CUIT','Tipo','Numero','Detalle',
                  'Moneda','Neto','IVA','Percepciones','Importe','Cotizacion','Importe USD',
                  'Estado','Fecha de pago','Tratamiento','Computa honorarios']];
  const gs = gastosDe(o.id).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  gs.forEach(g=>{
    const r = rubro(g.rubro_id);
    filas.push([g.fecha, caja(g.caja_id)?.nombre || '', r?.grupo || '', r?.nombre || '',
      g.proveedor, g.cuit, g.tipo, g.numero, g.detalle, g.moneda,
      num(g.neto), num(g.iva), num(g.percepciones), num(g.importe),
      num(g.cotizacion), num(g.usd), g.pago, g.fecha_pago || '',
      soloInfo(g) ? 'informativo' : 'costo de obra',
      g.computa_honorarios === false ? 'no' : 'si']);
  });
  if(gs.length) filas.push(['Total','','','','','','','','','','','','',
    '','', num(gs.filter(computa).reduce((s,g)=>s+ +g.usd,0)),'','','','']);
  bajarExcel([{ nombre:'Comprobantes', filas }],
    `comprobantes-${o.nombre.replace(/\s+/g,'-').toLowerCase()}`);
}
function exportarContador(){
  const o = obra();
  const num = v => Math.round((+v||0)*100)/100;

  /* Compras: comprobantes fiscales del período */
  const compras = [['Fecha','Proveedor','CUIT','Tipo','Numero','Rubro','Detalle','Moneda',
                    'Neto','IVA','Percepciones','Total','Cotizacion','Total USD',
                    'Estado','Tratamiento']];
  const gs = gastosDe(o.id).filter(g=>esFiscal(g)&&enPeriodo(g))
    .sort((a,b)=>a.fecha.localeCompare(b.fecha));
  gs.forEach(g => compras.push([g.fecha, g.proveedor, g.cuit, g.tipo, g.numero,
    rubro(g.rubro_id)?.nombre || '', g.detalle, g.moneda,
    num(g.neto), num(g.iva), num(g.percepciones), num(g.importe),
    num(g.cotizacion), num(g.usd), g.pago,
    soloInfo(g) ? 'informativo' : 'costo de obra']));
  if(gs.length) compras.push(['Total','','','','','','','',
    num(gs.reduce((s,g)=>s+ +g.neto,0)), num(gs.reduce((s,g)=>s+ +g.iva,0)),
    num(gs.reduce((s,g)=>s+ +g.percepciones,0)), '', '',
    num(gs.reduce((s,g)=>s+ +g.usd,0)), '', '']);

  /* Ventas del período */
  const ventas = [['Fecha','Tipo','Numero','CAE','Comprador','CUIT','Unidad','Concepto',
                   'Moneda','Neto','IVA','Total','Cotizacion','Total USD','Cobro']];
  ventasDe(o.id).filter(enPeriodo).sort((a,b)=>a.fecha.localeCompare(b.fecha))
    .forEach(v => ventas.push([v.fecha, v.tipo, v.numero, v.cae, v.cliente, v.cuit,
      v.unidad, v.concepto, v.moneda, num(v.neto), num(v.iva), num(v.importe),
      num(v.cotizacion), num(v.usd), v.cobro]));

  /* Aportes por clase */
  const cl = clasesDe(o.id);
  const aportes = [['Fecha','Mes','Inversor','Clase','Unidad','Moneda',
                    'Importe','Cotizacion','Importe USD']];
  aportesDe(o.id).filter(enPeriodo).sort((a,b)=>a.fecha.localeCompare(b.fecha))
    .forEach(a => aportes.push([a.fecha, mesDe(a.fecha), inv(a.inversor_id)?.nombre || '',
      cl[a.clase==='B'?'B':'A'].nombre, a.unidad, a.moneda,
      num(a.importe), num(a.cotizacion), num(a.usd)]));

  /* Resumen del período */
  const porTipo = {};
  gs.forEach(g => { const k = esImpuesto(g)&&!TIPOS_FISCALES.includes(g.tipo)
    ? 'Impuestos y tasas' : g.tipo;
    porTipo[k] = porTipo[k] || { total:0, neto:0, iva:0, perc:0 };
    const f = +g.importe ? +g.usd / +g.importe : 0;
    porTipo[k].total += +g.usd;
    porTipo[k].neto  += (+g.neto||0)*f;
    porTipo[k].iva   += (+g.iva||0)*f;
    porTipo[k].perc  += (+g.percepciones||0)*f; });

  const resumen = [
    ['Obra', o.nombre],
    ['Período', nombrePeriodo()],
    ['Emitido', hoy()],
    [],
    ['Compras por tipo de comprobante (en USD)'],
    ['Tipo','Neto','IVA','Percepciones','Total']
  ];
  Object.entries(porTipo).forEach(([k,v]) =>
    resumen.push([k, num(v.neto), num(v.iva), num(v.perc), num(v.total)]));
  resumen.push([], ['Aportes por clase (en USD)'], ['Clase','Cantidad','Importe']);
  ['A','B'].forEach(letra => {
    const ap = aportesDe(o.id).filter(enPeriodo).filter(a=>(a.clase==='B'?'B':'A')===letra);
    resumen.push([cl[letra].nombre, ap.length, num(ap.reduce((s,a)=>s+ +a.usd,0))]);
  });
  const vs = ventasDe(o.id).filter(enPeriodo);
  if(vs.length) resumen.push([], ['Ventas del período (en USD)'],
    ['Comprobantes', vs.length], ['Total', num(vs.reduce((s,v)=>s+ +v.usd,0))]);

  const hojas = [{ nombre:'Resumen', filas:resumen }, { nombre:'Compras', filas:compras }];
  if(ventas.length > 1)  hojas.push({ nombre:'Ventas',  filas:ventas });
  if(aportes.length > 1) hojas.push({ nombre:'Aportes', filas:aportes });

  bajarExcel(hojas,
    `contable-${o.nombre.replace(/\s+/g,'-').toLowerCase()}-${contDesde||'inicio'}-${contHasta||'hoy'}`);
}
