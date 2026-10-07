/* =====================================================================
   nucleo/datos.js
   Carga de datos: lectura paginada de todas las tablas

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* =====================================================================
   CARGA DE DATOS
   ===================================================================== */
/* PostgREST devuelve como máximo 1000 filas por consulta. Se pide por
   páginas hasta traer todo: sin esto, al pasar las 1000 filas los totales
   quedaban incompletos sin ningún aviso. La clave primaria se agrega al
   final del orden para que las páginas no se pisen. */
const PAGINA = 1000;
const CLAVE = { presupuestos:['obra_id','rubro_id'], fichas:['obra_id'], analisis:['obra_id'] };
async function todo(tabla, armar = q => q){
  const filas = [];
  for(let desde = 0; ; desde += PAGINA){
    let q = armar(sb.from(tabla).select('*'));
    for(const c of CLAVE[tabla] || ['id']) q = q.order(c);
    const { data, error } = await q.range(desde, desde + PAGINA - 1);
    if(error) return { data: null, error };
    filas.push(...data);
    if(data.length < PAGINA) return { data: filas, error: null };
  }
}

async function cargarDatos(){
  const t = [
    todo('obras', q => q.order('creado_en')),
    todo('rubros', q => q.eq('activo', true).order('orden')),
    todo('cajas', q => q.eq('activa', true).order('orden')),
    todo('clases'),
    todo('presupuestos'),
    todo('inversores', q => q.order('nombre')),
    todo('aportes', q => q.order('fecha')),
    todo('comprobantes', q => q.order('fecha')),
    todo('avances', q => q.order('fecha')),
    todo('documentos', q => q.order('fecha')),
    todo('cierres', q => q.order('hasta')),
    todo('participaciones'),
    todo('ventas', q => q.order('fecha')),
    todo('fichas'),
    todo('proveedores', q => q.order('nombre')),
    todo('pedidos', q => q.order('fecha')),
    todo('pedido_respuestas'),
    todo('analisis'),
    todo('niveles', q => q.order('orden')),
    todo('indices', q => q.order('periodo')),
    todo('cuotas', q => q.order('numero')),
    todo('enlaces', q => q.order('creado_en')),
    todo('unidades', q => q.order('orden'))
  ];
  const r = await Promise.all(t);
  const malo = r.find(x => x.error);
  if(malo){ aviso('No se pudieron cargar los datos: ' + malo.error.message, true); return; }
  D = { obras:r[0].data, rubros:r[1].data, cajas:r[2].data, clases:r[3].data,
        presupuestos:r[4].data, inversores:r[5].data, aportes:r[6].data,
        comprobantes:r[7].data, avances:r[8].data, documentos:r[9].data, cierres:r[10].data, participaciones:r[11].data, ventas:r[12].data,
        fichas:r[13].data, proveedores:r[14].data,
        pedidos:r[15].data, respuestas:r[16].data,
        analisis:r[17].data, niveles:r[18].data,
        indices:r[19].data, cuotas:r[20].data, enlaces:r[21].data,
        unidades_obra:r[22].data };
  if(!obraActiva || !D.obras.some(o => o.id === obraActiva))
    obraActiva = D.obras[0]?.id ?? null;
  render();
}

