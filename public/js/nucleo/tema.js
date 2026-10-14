/* =====================================================================
   nucleo/tema.js
   Claro u oscuro

   Por defecto sigue al sistema. El botón fija la preferencia y queda
   guardada para la próxima vez; si nunca se tocó, acompaña al sistema
   cuando cambia.

   El tema se aplica antes de dibujar, con el script que está en el
   <head> de index.html. Acá va solo el botón: si esto corriera después
   de cargar todo, se vería un destello claro antes de pasar a oscuro.
   ===================================================================== */

const TEMA_CLAVE = 'metroclaro:tema';

function sistemaEnOscuro(){
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
}

function temaActual(){
  const puesto = document.documentElement.dataset.tema;
  return puesto ? puesto : (sistemaEnOscuro() ? 'oscuro' : 'claro');
}

/* La barra del navegador en el celular tiene que acompañar al fondo */
function pintarBarraNavegador(){
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.content = temaActual() === 'oscuro' ? '#121211' : '#FFFFFF';
}

function cambiarTema(){
  const raiz = document.documentElement;
  raiz.dataset.tema = temaActual() === 'oscuro' ? 'claro' : 'oscuro';
  try { localStorage.setItem(TEMA_CLAVE, raiz.dataset.tema); } catch(e) {}
  pintarBarraNavegador();
}

/* Lo llama nucleo/inicio.js */
function iniciarTema(){
  pintarBarraNavegador();
  if(window.matchMedia){
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      /* Solo si el usuario nunca eligió a mano */
      if(!document.documentElement.dataset.tema) pintarBarraNavegador();
    });
  }
}
