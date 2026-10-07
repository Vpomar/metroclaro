/* =====================================================================
   vistas/avance.js
   Pestaña Avance: fotos y gráfico de avance

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- Avance con fotos y gráficos ---------- */
function vAvance(o){
  const av = avancesDe(o.id).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const gs = gastosDe(o.id).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const pres = totalesObra(o.id).pres;

  // Serie mensual: financiero acumulado vs avance físico declarado
  const meses = [...new Set([...gs.map(g=>mesDe(g.fecha)), ...av.map(a=>mesDe(a.fecha))])].sort();
  let acum = 0;
  const serie = meses.map(m => {
    acum += gs.filter(g=>mesDe(g.fecha)===m).reduce((s,g)=>s+ +g.usd,0);
    const fis = av.filter(a=>mesDe(a.fecha)===m && a.pct_avance!=null)
                  .map(a=>+a.pct_avance).sort((x,y)=>y-x)[0];
    return { mes:m, fin: pres ? acum/pres*100 : null, fis };
  });
  let ultFis = null;
  serie.forEach(p => { if(p.fis!=null) ultFis = p.fis; else p.fis = ultFis; });

  return `
  ${puedeEditar()?`<div class="acciones">
    <button class="btn" onclick="formAvance()">Cargar foto de avance</button></div>`:''}
  ${serie.length>1 ? `<h3>Avance físico contra avance financiero</h3>
    <div class="grafico">${grafico(serie)}</div>
    <p class="sub" style="margin-top:10px">Si la línea financiera va muy por encima de la física,
    se está gastando más rápido de lo que se construye.</p>` : ''}

  <h3>Registro fotográfico</h3>
  ${av.length ? `<div class="galeria">
    ${av.map(a=>`<div class="foto">
      <img loading="lazy" alt="${esc(a.titulo||'Avance de obra')}"
        src="" data-ruta="${esc(a.archivo||'')}" onerror="this.style.opacity=.3">
      <div class="pie-foto">
        <strong>${esc(a.titulo||'Sin título')}</strong>
        <p class="pct">${fecha(a.fecha)}${a.pct_avance!=null?` · ${fmtPct(a.pct_avance)} de avance`:''}</p>
        ${a.descripcion?`<p class="pct">${esc(a.descripcion)}</p>`:''}
        ${esAdmin()?`<button class="link" onclick="borrar('avances','${a.id}')">Eliminar</button>`:''}
      </div></div>`).join('')}
    </div>` : `<div class="vacio">Sin fotos cargadas todavía.</div>`}`;
}

function grafico(serie){
  const W = 700, H = 260, mx = 44, my = 24;
  const x = i => mx + i*(W-mx-14)/Math.max(serie.length-1,1);
  const y = v => H-my - (v/100)*(H-my*2);
  const linea = (campo,color,guion) => {
    const pts = serie.map((p,i)=>p[campo]==null?null:`${x(i)},${y(Math.min(p[campo],100))}`).filter(Boolean);
    return pts.length>1 ? `<polyline fill="none" stroke="${color}" stroke-width="2"
      ${guion?'stroke-dasharray="5 4"':''} points="${pts.join(' ')}"/>` : '';
  };
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Avance físico y financiero por mes">
    ${[0,25,50,75,100].map(v=>`<line x1="${mx}" y1="${y(v)}" x2="${W-14}" y2="${y(v)}"
      stroke="var(--linea)" stroke-width="1"/>
      <text x="${mx-8}" y="${y(v)+4}" text-anchor="end" font-size="10"
        fill="var(--gris)">${v}%</text>`).join('')}
    ${linea('fin','var(--azul)',false)}
    ${linea('fis','var(--verde)',true)}
    ${serie.map((p,i)=> i%Math.ceil(serie.length/6)===0
      ? `<text x="${x(i)}" y="${H-6}" text-anchor="middle" font-size="10"
          fill="var(--gris)">${p.mes.slice(5)}/${p.mes.slice(2,4)}</text>` : '').join('')}
    <g font-size="11">
      <line x1="${W-190}" y1="14" x2="${W-170}" y2="14" stroke="var(--azul)" stroke-width="2"/>
      <text x="${W-165}" y="18" fill="var(--gris)">financiero</text>
      <line x1="${W-95}" y1="14" x2="${W-75}" y2="14" stroke="var(--verde)" stroke-width="2" stroke-dasharray="5 4"/>
      <text x="${W-70}" y="18" fill="var(--gris)">físico</text>
    </g></svg>`;
}

