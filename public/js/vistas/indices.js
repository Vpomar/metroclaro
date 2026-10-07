/* =====================================================================
   vistas/indices.js
   Pestaña Índices (CAC)

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- Índice CAC ---------- */
function vIndices(){
  const serie = serieCac().slice().reverse();
  const u = cacUltimo();
  const mesActual = hoy().slice(0,7);
  const falta = !serie.some(x => x.periodo === mesActual);

  return `
  ${puedeEditar()?`<div class="acciones">
    <button class="btn" onclick="formIndice()">Cargar índice del mes</button>
  </div>`:''}
  <p class="sub">El índice de la Cámara Argentina de la Construcción ajusta las cuotas de las
  ventas financiadas en pesos. Se carga una vez por mes, desde
  <a href="https://www.cifrasonline.com.ar/indice-cac/" target="_blank" rel="noopener"
     style="color:var(--azul)">cifrasonline.com.ar</a>.
  Podés cargar el nivel del índice o la variación mensual: si cargás solo la variación,
  el nivel se encadena desde el mes anterior.</p>

  ${falta && u ? `<div class="vacio" style="text-align:left;border-color:var(--ambar)">
    <strong>Falta el índice de ${nombreMes(mesActual)}.</strong>
    <p style="font-size:12.5px;color:var(--gris);margin:6px 0 0">
      Hasta que lo cargues, las cuotas se ajustan con el de ${nombreMes(u.periodo)}.</p>
  </div>` : ''}

  ${serie.length ? `<table><thead><tr><th>Período</th><th class="der">Nivel</th>
    <th class="der">Variación</th><th class="der">Acumulado 12 meses</th>
    <th>Cargado</th><th></th></tr></thead><tbody>
    ${serie.map((x,i)=>{
      const ant = serie[i+1];
      const varMes = x.variacion != null ? +x.variacion
        : (ant && ant.nivel && x.nivel ? (x.nivel/ant.nivel - 1)*100 : null);
      const hace12 = serie[i+12];
      const anual = hace12 && hace12.nivel && x.nivel ? (x.nivel/hace12.nivel - 1)*100 : null;
      return `<tr>
        <td><strong>${nombreMes(x.periodo)}</strong>
          ${x.periodo===u?.periodo?' <span class="chip v">último</span>':''}</td>
        <td class="der num">${x.nivel!=null?x.nivel.toLocaleString('es-AR',{maximumFractionDigits:2}):'—'}
          ${x.valor==null?'<br><span class="pct">encadenado</span>':''}</td>
        <td class="der num">${varMes!=null?fmtPct(varMes):'—'}</td>
        <td class="der num">${anual!=null?fmtPct(anual):'—'}</td>
        <td><span class="pct">${esc(x.nota||x.fuente||'')}</span></td>
        <td class="der">${puedeEditar()?`<button class="link" onclick="formIndice('${x.id}')">Editar</button>`:''}
          ${esAdmin()?`<br><button class="link" onclick="borrar('indices','${x.id}')">Eliminar</button>`:''}</td>
      </tr>`;
    }).join('')}
  </tbody></table>` : `<div class="vacio">Todavía no hay índices cargados.
    Cargá al menos uno para poder ajustar cuotas por CAC.</div>`}

  ${(() => {
    const usadas = D.ventas.filter(v => v.modalidad === 'cuotas_cac');
    if(!usadas.length) return '';
    return `<h3>Ventas ajustadas por este índice</h3>
    <table><thead><tr><th>Obra</th><th>Comprador</th><th>Base</th>
      <th class="der">Coeficiente</th><th class="der">Por cobrar</th></tr></thead><tbody>
      ${usadas.map(v=>{
        const r = resumenVenta(v);
        const coef = u && +v.indice_base ? u.nivel/+v.indice_base : null;
        return `<tr><td>${esc(D.obras.find(o=>o.id===v.obra_id)?.nombre||'')}</td>
          <td>${esc(v.cliente)} <span class="pct">${esc(v.unidad||'')}</span></td>
          <td>${v.periodo_base?nombreMes(v.periodo_base):'—'}
            <br><span class="pct num">${v.indice_base?(+v.indice_base).toLocaleString('es-AR',{maximumFractionDigits:2}):''}</span></td>
          <td class="der num">${coef?coef.toLocaleString('es-AR',{minimumFractionDigits:3,maximumFractionDigits:3}):'—'}</td>
          <td class="der num">${fmtArs(r.porCobrar)}</td></tr>`;
      }).join('')}
    </tbody></table>`;
  })()}`;
}

function formIndice(id){
  const x = id ? D.indices.find(i=>i.id===id) : null;
  const mes = hoy().slice(0,7);
  modal(id ? 'Editar índice' : 'Cargar índice CAC', `
    <div class="campo"><label for="ix-periodo">Período</label>
      <input id="ix-periodo" type="month" value="${x?x.periodo:mes}"></div>
    <div class="campo"><label for="ix-valor">Nivel del índice</label>
      <input id="ix-valor" type="number" step="0.0001" value="${x&&x.valor!=null?x.valor:''}"
        placeholder="opcional"></div>
    <div class="campo"><label for="ix-var">Variación mensual %</label>
      <input id="ix-var" type="number" step="0.0001" value="${x&&x.variacion!=null?x.variacion:''}"
        placeholder="opcional"></div>
    <div class="campo"><label for="ix-nota">Nota</label>
      <input id="ix-nota" value="${x?esc(x.nota||''):''}" placeholder="Opcional"></div>
    <div class="campo ancho"><span class="ayuda">Cargá el nivel si lo tenés.
      Si en la publicación solo figura el porcentaje de aumento respecto al mes anterior,
      cargá la variación y el sistema encadena el nivel.</span></div>`,
    async ()=>{
      const periodo = val('ix-periodo');
      if(!periodo) return err('Elegí el período.');
      const valor = val('ix-valor'), variacion = val('ix-var');
      if(!valor && !variacion) return err('Cargá el nivel o la variación.');
      const datos = { nombre:'CAC', periodo,
        valor: valor ? parseFloat(valor) : null,
        variacion: variacion ? parseFloat(variacion) : null,
        nota: val('ix-nota'), cargado_por: perfil.id };
      cerrar();
      if(id) return guardar('indices', datos, id);
      const { error } = await sb.from('indices').upsert(datos, { onConflict:'nombre,periodo' });
      if(error) return aviso('No se pudo guardar: ' + error.message, true);
      aviso('Índice guardado');
      await cargarDatos();
    });
}

