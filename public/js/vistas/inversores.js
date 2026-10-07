/* =====================================================================
   vistas/inversores.js
   Pestaña Inversores y calculador de aportes a requerir

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- Inversores ---------- */
function vInversores(o){
  const cl = clasesDe(o.id), ap0 = aportesDe(o.id);
  const total = ap0.reduce((s,a)=>s+ +a.usd,0);
  const totU  = ap0.reduce((s,a)=>s+unidades(o.id,a),0);
  const totA = ap0.filter(a=>a.clase!=='B').reduce((s,a)=>s+ +a.usd,0);
  const totB = ap0.filter(a=>a.clase==='B').reduce((s,a)=>s+ +a.usd,0);
  const difCoef = cl.A.coef !== cl.B.coef;
  const filas = partsDe(o.id).map(p=>{
    const i = inv(p.inversor_id);
    if(!i) return null;
    const ap = ap0.filter(a=>a.inversor_id===i.id);
    const a = ap.filter(x=>x.clase!=='B').reduce((s,x)=>s+ +x.usd,0);
    const b = ap.filter(x=>x.clase==='B').reduce((s,x)=>s+ +x.usd,0);
    const u = ap.reduce((s,x)=>s+unidades(o.id,x),0);
    const cA = +p.comp_a||0, cB = +p.comp_b||0, integrado = a+b, comp = cA+cB;
    const porAporte = [...new Set(ap.map(x=>x.unidad).filter(Boolean))];
    const adjudicadas = unidadesDe(o.id).filter(x=>x.inversor_id===i.id).map(x=>x.codigo);
    const asignadas = [...new Set([...adjudicadas, ...porAporte])];
    return { p,i,a,b,u,cA,cB,asignadas,integrado,comp,pendiente:comp-integrado,
             part: totU?u/totU*100:0, partA: totA?a/totA*100:0, partB: totB?b/totB*100:0, n:ap.length };
  }).filter(Boolean)
    .sort((x,y)=> (y.integrado+y.comp)-(x.integrado+x.comp) || x.i.nombre.localeCompare(y.i.nombre));

  const campoCl = (letra,campo,v,ancho) => puedeEditar()
    ? `<input value="${esc(v)}" onchange="setClase('${letra}','${campo}',this.value)"
        ${campo==='coeficiente'?'type="number" min="0" step="0.01"':''}
        style="width:${ancho};${campo==='coeficiente'?'text-align:right;':''}font:inherit;padding:5px 7px;
        border:1px solid var(--linea-fuerte);border-radius:3px">`
    : esc(v);

  return `
  ${puedeEditar()?`<div class="acciones">
    <button class="btn" onclick="formParticipacion()">Sumar inversor a esta obra</button>
    <button class="btn sec" onclick="formAporte()">Registrar aporte</button></div>`:''}
  <h3>Clases de participación</h3>
  <table><thead><tr><th>Clase</th><th>Nombre</th><th class="der" style="width:120px">Coeficiente</th>
    <th class="der">Capital</th><th class="der">Unidades</th></tr></thead><tbody>
    ${['A','B'].map(L=>{const cap = L==='A'?totA:totB;
      return `<tr><td><strong>${L}</strong></td>
      <td>${campoCl(L,'nombre',cl[L].nombre,'150px')}</td>
      <td class="der">${campoCl(L,'coeficiente',cl[L].coef,'90px')}</td>
      <td class="der num">${fmtUsd(cap)}</td>
      <td class="der num">${fmtUsd(cap*cl[L].coef)}</td></tr>`;}).join('')}
  </tbody></table>
  <p class="sub" style="margin-top:8px">El coeficiente convierte capital en unidades de participación.
  Con ambas en 1,00 la participación es proporcional al capital.</p>

  <h3>Posición de cada inversor</h3>
  ${filas.length ? `<table><thead><tr><th>Inversor</th><th class="der">${esc(cl.A.nombre)}</th>
    <th class="der">${esc(cl.B.nombre)}</th><th class="der">Integrado</th>
    <th class="der ocultar-chico">Comprometido</th><th class="der">Pendiente</th>
    <th class="der">Participación</th></tr></thead><tbody>
    ${filas.map(f=>`<tr><td><strong>${esc(f.i.nombre)}</strong>
      <br><span class="pct">${f.n ? `${f.n} aporte${f.n===1?'':'s'}`
        : (f.comp ? 'sin aportes todavía' : 'sin participación en esta obra')}</span>
      ${f.asignadas.length?`<br><span class="chip">${f.asignadas.map(esc).join(' · ')}</span>`:''}
      ${puedeEditar()?`<br><button class="link" onclick="formParticipacion('${f.p.id}')">Editar</button>`:''}
      ${esAdmin() && !f.n
        ? `<br><button class="link" data-nombre="${esc(f.i.nombre)}" onclick="quitarDeObra('${f.p.id}', this.dataset.nombre)">Quitar de la obra</button>` : ''}</td>
      <td class="der num">${f.a?fmtUsd(f.a):'—'}
        ${f.a?`<br><span class="pct">${fmtPct(f.partA)} de la clase</span>`:''}
        ${f.cA?`<br><span class="pct">de ${fmtUsd(f.cA)} suscriptos</span>`:''}</td>
      <td class="der num">${f.b?fmtUsd(f.b):'—'}
        ${f.b?`<br><span class="pct">${fmtPct(f.partB)} de la clase</span>`:''}
        ${f.cB?`<br><span class="pct">de ${fmtUsd(f.cB)} suscriptos</span>`:''}</td>
      <td class="der num" style="font-weight:600">${fmtUsd(f.integrado)}
        ${difCoef?`<br><span class="pct">${fmtUsd(f.u)} en unidades</span>`:''}</td>
      <td class="der num ocultar-chico">${f.comp?fmtUsd(f.comp):'—'}</td>
      <td class="der">${f.comp ? (f.pendiente>0
        ? `<span class="chip a num">${fmtUsd(f.pendiente)}</span>`
        : `<span class="chip v">Integrado</span>`) : '—'}</td>
      <td class="der num" style="font-weight:600">${fmtPct(f.part)}</td></tr>`).join('')}
    <tr><td><strong>Total</strong></td>
      <td class="der num"><strong>${fmtUsd(totA)}</strong></td>
      <td class="der num"><strong>${fmtUsd(totB)}</strong></td>
      <td class="der num"><strong>${fmtUsd(total)}</strong></td>
      <td class="der num ocultar-chico">${fmtUsd(filas.reduce((s,f)=>s+f.comp,0))}</td><td></td>
      <td class="der num"><strong>${total?'100,0%':'—'}</strong></td></tr>
    </tbody></table>
    <p class="sub" style="margin-top:12px">La ficha del inversor es una sola para todo el estudio,
    pero el capital suscripto y la participación son de esta obra.</p>
    ${calculadorAportes(o, filas, totU)}`
    : `<div class="vacio">Todavía no hay inversores en esta obra.
       Sumá el primero con el botón de arriba.</div>`}`;
}

/* ---------- Calculador de aportes a requerir ---------- */
function setCalc(campo, v){
  if(campo === 'monto'){
    const n = parseFloat(String(v).replace(/\./g,'').replace(',','.'));
    // El monto se guarda siempre en dólares, se ingrese en la moneda que se ingrese
    calcMonto = isNaN(n) ? null : (calcMoneda === 'ARS' ? n / (cotizacion||1) : n);
  }
  else if(campo === 'moneda') calcMoneda = v;
  else if(campo === 'base')   calcBase = v;
  else calcMetodo = v;
  render();
}

function calculadorAportes(o, filas, totU){
  const t = totalesObra(o.id);
  const faltante = Math.max(t.deuda - t.saldo, 0);
  const monto = calcMonto == null ? t.deuda : calcMonto;

  // Base de prorrateo: capital suscripto (lo contractual) o participación actual
  const hayComp = filas.some(f => f.comp > 0);
  const base = calcBase==='suscripto' && hayComp ? 'suscripto' : 'participacion';
  const degenerado = base==='participacion' && calcMetodo==='nivelar';
  const baseDe = f => base==='suscripto' ? f.comp : f.u;
  const sumaBase = filas.reduce((s,f)=>s+baseDe(f), 0);
  const yaAportado = filas.reduce((s,f)=>s+f.integrado, 0);
  const objetivo = yaAportado + monto;

  const calc = filas.map(f => {
    const pct = sumaBase ? baseDe(f)/sumaBase : 0;
    const corresponde = calcMetodo==='nivelar' ? pct*objetivo : f.integrado + pct*monto;
    const dif = corresponde - f.integrado;
    return { f, pct:pct*100, corresponde, requerir: Math.max(dif,0), excedente: Math.max(-dif,0) };
  });
  const totalReq = calc.reduce((s,c)=>s+c.requerir,0);
  const totalExc = calc.reduce((s,c)=>s+c.excedente,0);

  const sel = (id,campo,ops,actual) => `<select id="${id}" onchange="setCalc('${campo}',this.value)"
    style="font:inherit;font-size:13.5px;padding:6px 9px;border:1px solid var(--linea-fuerte);border-radius:3px">
    ${ops.map(([v,n])=>`<option value="${v}" ${v===actual?'selected':''}>${n}</option>`).join('')}</select>`;

  return `
  <h3>Cuánto pedirle a cada inversor</h3>
  <p class="sub">Calcula el aporte a requerir según la proporción de cada uno, descontando lo que ya integró.</p>

  <div class="acciones">
    <label for="calc-monto" style="font-size:12.5px;color:var(--gris)">Monto a cubrir</label>
    <input id="calc-monto" type="number" min="0" step="1000"
      value="${Math.round(calcMoneda === 'ARS' ? monto*cotizacion : monto)||''}"
      onchange="setCalc('monto',this.value)"
      style="width:150px;text-align:right;font:inherit;font-size:13.5px;padding:6px 9px;
      border:1px solid var(--linea-fuerte);border-radius:3px">
    <select onchange="setCalc('moneda',this.value)"
      style="font:inherit;font-size:13.5px;padding:6px 9px;border:1px solid var(--linea-fuerte);border-radius:3px">
      <option value="USD" ${calcMoneda==='USD'?'selected':''}>Dólares</option>
      <option value="ARS" ${calcMoneda==='ARS'?'selected':''}>Pesos</option>
    </select>
    <span class="pct">${calcMoneda === 'ARS'
      ? `= ${fmtUsd(monto)} a ${cotizacion.toLocaleString('es-AR',{maximumFractionDigits:2})}`
      : `= ${fmtArs(monto*cotizacion)} a ${cotizacion.toLocaleString('es-AR',{maximumFractionDigits:2})}`}</span>
    <button class="btn sec" onclick="setCalc('moneda','USD');setCalc('monto',${Math.round(t.deuda)})">Deuda ${fmtUsd(t.deuda)}</button>
    <button class="btn sec" onclick="setCalc('moneda','USD');setCalc('monto',${Math.round(faltante)})">Faltante ${fmtUsd(faltante)}</button>
    ${sel('calc-base','base',[['participacion','Prorratear por participación actual'],
      ['suscripto','Prorratear por capital suscripto']], base)}
    ${sel('calc-metodo','metodo',[['nivelar','Nivelar posiciones'],
      ['proporcional','Proporcional al nuevo aporte']], calcMetodo)}
  </div>

  ${!sumaBase ? `<div class="vacio">Para calcular hace falta capital suscripto o aportes cargados.</div>`
  : `<p class="sub">Se pide ${fmtUsd(monto)}, equivalentes a ${fmtArs(monto*cotizacion)}
    a la cotización de ${cotizacion.toLocaleString('es-AR',{maximumFractionDigits:2})} del panel.
    Los importes por inversor van en las dos monedas.</p>
    <table><thead><tr><th>Inversor</th><th class="der">Proporción</th>
      <th class="der">Ya integró</th><th class="der ocultar-chico">% del capital</th>
      <th class="der">Le corresponde</th>
      <th class="der">A requerir USD</th><th class="der">A requerir $</th>
      <th class="der">Excedente</th></tr></thead><tbody>
    ${calc.map(c=>`<tr>
      <td><strong>${esc(c.f.i.nombre)}</strong></td>
      <td class="der num">${fmtPct(c.pct)}</td>
      <td class="der num">${fmtUsd(c.f.integrado)}</td>
      <td class="der num ocultar-chico">${yaAportado?fmtPct(c.f.integrado/yaAportado*100):'—'}</td>
      <td class="der num">${fmtUsd(c.corresponde)}</td>
      <td class="der num" style="font-weight:600">${c.requerir>0.5?fmtUsd(c.requerir):'—'}</td>
      <td class="der num">${c.requerir>0.5?fmtArs(c.requerir*cotizacion):'—'}</td>
      <td class="der">${c.excedente>0.5?`<span class="chip v num">${fmtUsd(c.excedente)}</span>`:'—'}</td>
      </tr>`).join('')}
    <tr><td><strong>Total</strong></td><td class="der num">100,0%</td>
      <td class="der num">${fmtUsd(yaAportado)}</td>
      <td class="der num ocultar-chico">${yaAportado?'100,0%':'—'}</td>
      <td class="der num">${fmtUsd(calc.reduce((s,c)=>s+c.corresponde,0))}</td>
      <td class="der num"><strong>${fmtUsd(totalReq)}</strong></td>
      <td class="der num"><strong>${fmtArs(totalReq*cotizacion)}</strong></td>
      <td class="der num">${totalExc>0.5?fmtUsd(totalExc):'—'}</td></tr>
    </tbody></table>

    <p class="sub" style="margin-top:12px">
    ${base==='suscripto'
      ? 'Prorrateo según el capital suscripto de cada uno, que es lo que fija el contrato.'
      : 'Prorrateo según la participación actual, calculada sobre las unidades ya integradas.'}
    ${calcMetodo==='nivelar'
      ? ' Método nivelar: se calcula la posición que le corresponde sobre el total y se le pide la diferencia. El que venía adelantado aporta menos o nada.'
      : ' Método proporcional: cada uno aporta su porcentaje del nuevo requerimiento, sin corregir desfasajes anteriores.'}
    </p>
    ${totalExc>0.5 && calcMetodo==='nivelar' ? `<p class="sub">
      El total a requerir (${fmtUsd(totalReq)}) supera el monto a cubrir porque hay
      ${fmtUsd(totalExc)} aportados de más. Si no querés devolver ese excedente,
      pedí solo hasta completar el monto y el desfasaje se corrige en el próximo llamado.</p>` : ''}
    ${degenerado ? `<p class="sub">
      Con la participación actual como base, nivelar y proporcional dan el mismo resultado:
      la proporción se calcula sobre lo ya integrado, así que nadie figura adelantado.
      Para que el sistema compense a quien puso de más, cargá el capital suscripto de cada
      inversor y elegí ese prorrateo.</p>` : ''}
    ${filas.some(f=>f.pendiente>0) ? `<p class="sub">
      Hay inversores con capital suscripto pendiente de integrar. Revisá la columna Pendiente
      de la tabla de arriba antes de mandar el pedido.</p>` : ''}`}`;
}

