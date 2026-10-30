// Pantalla única. Todo lo que viene del servidor o de la IA se muestra como texto (textContent), nunca como HTML.
// No se guarda nada en el navegador: ni en localStorage ni en cookies.

const $ = (id) => document.getElementById(id);
const el = (etiqueta, props = {}, ...hijos) => {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(props)) {
    if (clave === 'class') nodo.className = valor;
    else nodo.setAttribute(clave, valor);
  }
  for (const hijo of hijos.flat()) if (hijo !== null && hijo !== undefined && hijo !== false) nodo.append(hijo);
  return nodo;
};

const MAX_BYTES = 8 * 1024 * 1024;
const NIVELES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'nativo'];
const datos = { archivo: null, oferta: '', info: '', idiomaElegido: 'auto', empresa: '', celular: '', guia: false, idiomas: null, filas: [], trabajo: null };
let temporizador = null;

/* ---------- utilidades ---------- */
async function api(ruta, opciones = {}) {
  const respuesta = await fetch(ruta, {
    ...opciones,
    headers: { 'X-Postulaciones': '1', ...(opciones.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo completar el pedido.');
  return cuerpo;
}

const aBase64 = (archivo) => new Promise((resolver, rechazar) => {
  const lector = new FileReader();
  lector.onload = () => resolver(String(lector.result).split(',')[1]);
  lector.onerror = () => rechazar(new Error('No pude leer el archivo.'));
  lector.readAsDataURL(archivo);
});

function mostrarPaso(id) {
  for (const paso of ['paso-datos', 'paso-niveles', 'paso-progreso', 'paso-resultado']) $(paso).hidden = paso !== id;
  window.scrollTo({ top: 0 });
}
function mostrarError(mensaje) { $('error').textContent = mensaje; $('error').hidden = false; $('error').scrollIntoView({ block: 'nearest' }); }
function limpiarError() { $('error').hidden = true; $('error').textContent = ''; }

async function copiar(texto, boton) {
  try { await navigator.clipboard.writeText(texto); } catch {
    const auxiliar = el('textarea', { 'aria-hidden': 'true' });
    auxiliar.value = texto;
    document.body.append(auxiliar);
    auxiliar.select();
    document.execCommand('copy');
    auxiliar.remove();
  }
  const original = boton.textContent;
  boton.textContent = 'Copiado';
  setTimeout(() => { boton.textContent = original; }, 2000);
}

const codigoDeIdioma = (nombre) => (/^(espa[nñ]ol|castellano|spanish)/i.test(nombre) ? 'es' : /^(ingl[eé]s|english)/i.test(nombre) ? 'en' : null);
const nombreDeNivel = (n) => (n === 'nativo' ? 'Nativo' : n);

/* ---------- estado de la herramienta ---------- */
async function verificarEstado() {
  try {
    const estado = await api('/api/estado');
    const problemas = [];
    if (!estado.claude.disponible) problemas.push('No encuentro Claude Code en esta compu. Instalalo y abrí una terminal con "claude" para iniciar sesión.');
    if (!estado.perfil) problemas.push('No encuentro tu perfil (datos-privados/perfil.md).');
    if (problemas.length) { $('estado').textContent = problemas.join(' '); $('estado').hidden = false; }
  } catch { /* el formulario igual se puede completar */ }
}

/* ---------- paso 1: datos ---------- */
$('usar-celular').addEventListener('change', (e) => {
  $('celular').disabled = !e.target.checked;
  if (e.target.checked) $('celular').focus(); else $('celular').value = '';
});
$('cv').addEventListener('change', () => {
  const archivo = $('cv').files[0];
  $('cv-nombre').textContent = archivo ? `${archivo.name} (${Math.round(archivo.size / 1024)} KB)` : '';
});

$('formulario').addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarError();
  const archivo = $('cv').files[0];
  const oferta = $('oferta').value.trim();
  if (!archivo) return mostrarError('Subí tu CV en PDF o Word.');
  if (!/\.(pdf|docx)$/i.test(archivo.name)) return mostrarError('El CV tiene que ser un PDF o un archivo de Word (.docx).');
  if (archivo.size > MAX_BYTES) return mostrarError('El archivo pesa más de 8 MB. Subí un CV más liviano.');
  if (oferta.length < 80) return mostrarError('Pegá el texto completo de la oferta.');
  if ($('usar-celular').checked && !$('celular').value.trim()) return mostrarError('Escribí tu celular o destildá la casilla.');

  const boton = $('continuar');
  boton.disabled = true;
  boton.textContent = 'Leyendo tu CV…';
  try {
    datos.archivo = { nombre: archivo.name, base64: await aBase64(archivo) };
    Object.assign(datos, { oferta, info: $('info').value.trim(), idiomaElegido: $('idioma').value, empresa: $('empresa').value.trim(), celular: $('usar-celular').checked ? $('celular').value.trim() : '', guia: $('usar-guia').checked });
    datos.idiomas = await api('/api/idiomas', { method: 'POST', body: JSON.stringify({ archivo: datos.archivo, oferta }) });
    prepararNiveles();
    mostrarPaso('paso-niveles');
  } catch (error) {
    mostrarError(error.message);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Continuar';
  }
});

/* ---------- paso 2: confirmar niveles ---------- */
function prepararNiveles() {
  const { cv_idiomas: delCv, oferta: deOferta } = datos.idiomas;
  const filas = [{ clave: 'es', nombre: 'Español' }, { clave: 'en', nombre: 'Inglés' }];
  for (const detectado of delCv) {
    const codigo = codigoDeIdioma(detectado.idioma);
    const fila = filas.find((f) => f.clave === (codigo ?? detectado.idioma)) ?? (filas.push({ clave: detectado.idioma, nombre: detectado.idioma }), filas[filas.length - 1]);
    Object.assign(fila, { enCv: detectado.nivel_en_el_cv, cita: detectado.cita, nivel: detectado.nivel_cefr === 'no_figura' ? '' : detectado.nivel_cefr });
  }
  datos.filas = filas;

  const tbody = $('filas-niveles');
  tbody.replaceChildren(...filas.map((fila) => {
    const select = el('select', { 'aria-label': `Tu nivel de ${fila.nombre}`, 'data-clave': fila.clave },
      el('option', { value: '' }, 'Elegí tu nivel'),
      ...NIVELES.map((n) => el('option', { value: n }, nombreDeNivel(n))));
    select.value = fila.nivel ?? '';
    select.addEventListener('change', () => { fila.nivel = select.value; actualizarGenerar(); });
    return el('tr', {},
      el('th', { scope: 'row' }, fila.nombre),
      el('td', { class: 'cita' }, fila.enCv ? `«${fila.enCv}»` : 'No figura en tu CV'),
      el('td', {}, select));
  }));

  const pide = deOferta.idiomas_requeridos;
  $('pide-oferta').hidden = pide.length === 0;
  $('pide-oferta').textContent = pide.length ? 'La oferta pide: ' + pide.map((i) => `${i.idioma} ${i.nivel_pedido}${i.excluyente ? ' (excluyente)' : ''}`).join(' · ') + '.' : '';

  const salida = $('idioma-salida');
  const detectado = deOferta.idioma_detectado;
  const inicial = datos.idiomaElegido !== 'auto' ? datos.idiomaElegido : (['es', 'en'].includes(detectado) ? detectado : '');
  salida.replaceChildren(el('option', { value: '' }, 'Elegí el idioma'), el('option', { value: 'es' }, 'Español'), el('option', { value: 'en' }, 'Inglés'));
  salida.value = inicial;
  salida.addEventListener('change', actualizarGenerar);
  actualizarGenerar();
}

// Hay que confirmar el nivel de cada idioma que figura en el CV (aunque no tenga nivel claro) y el del idioma en el que se escribe.
function actualizarGenerar() {
  const salida = $('idioma-salida').value;
  const faltan = datos.filas.filter((f) => (f.enCv || f.clave === salida) && !f.nivel);
  $('falta-nivel').textContent = faltan.length ? `Falta elegir tu nivel de ${faltan.map((f) => f.nombre).join(' y ')}.` : '';
  $('generar').disabled = !salida || faltan.length > 0;
}

$('volver').addEventListener('click', () => { limpiarError(); mostrarPaso('paso-datos'); });

$('generar').addEventListener('click', async () => {
  limpiarError();
  const niveles = {};
  for (const fila of datos.filas) if (fila.nivel) niveles[fila.clave] = fila.nivel;
  try {
    const { id } = await api('/api/generar', {
      method: 'POST',
      body: JSON.stringify({ archivo: datos.archivo, oferta: datos.oferta, infoEmpresa: datos.info, idioma: $('idioma-salida').value, niveles, celular: datos.celular, empresa: datos.empresa, guia: datos.guia }),
    });
    datos.trabajo = id;
    mostrarPaso('paso-progreso');
    seguirTrabajo();
  } catch (error) {
    mostrarError(error.message);
  }
});

/* ---------- paso 3: progreso ---------- */
function seguirTrabajo() {
  clearInterval(temporizador);
  temporizador = setInterval(async () => {
    try {
      const t = await api(`/api/trabajo/${datos.trabajo}`);
      $('progreso-mensaje').textContent = t.mensaje || 'Trabajando…';
      $('progreso-tiempo').textContent = `Van ${Math.floor(t.segundos / 60)} min ${t.segundos % 60} s.`;
      if (t.estado === 'listo') { clearInterval(temporizador); mostrarResultado(t.resultado); }
      if (t.estado === 'error') { clearInterval(temporizador); mostrarPaso('paso-niveles'); mostrarError(t.error); }
    } catch (error) {
      clearInterval(temporizador);
      mostrarPaso('paso-niveles');
      mostrarError(error.message);
    }
  }, 2000);
}

/* ---------- paso 4: resultado ---------- */
// Muestra los primeros 8 y pliega el resto, para que la pantalla no se vuelva interminable.
const lista = (items, maximo = 8) => {
  if (!items.length) return el('p', { class: 'nota' }, 'Nada.');
  const ul = (partes) => el('ul', { class: 'lista' }, partes.map((i) => el('li', {}, i)));
  if (items.length <= maximo) return ul(items);
  return [ul(items.slice(0, maximo)), el('details', {}, el('summary', {}, `Ver los ${items.length - maximo} restantes`), ul(items.slice(maximo)))];
};

function cvATexto(cv) {
  const l = [cv.titulo, '', cv.resumen, ''];
  if (cv.proyectos.length) l.push('PROYECTOS', ...cv.proyectos.flatMap((p) => [`${p.nombre} · ${p.encabezado} · ${p.fecha}`, p.enlaces.join(' · '), ...p.puntos.map((x) => `  - ${x}`)]), '');
  if (cv.experiencia.length) l.push('EXPERIENCIA', ...cv.experiencia.flatMap((e) => [`${e.puesto} · ${e.organizacion} · ${e.lugar_y_modalidad} · ${e.fechas}`, ...e.puntos.map((p) => `  - ${p}`)]), '');
  if (cv.formacion.length) l.push('FORMACIÓN', ...cv.formacion.map((f) => `${f.titulo} · ${f.institucion} · ${f.estado_y_fechas}`), '');
  if (cv.habilidades.length) l.push('HABILIDADES', ...cv.habilidades.map((h) => `${h.categoria}: ${h.items.join(', ')}`), '');
  if (cv.idiomas.length) l.push('IDIOMAS', cv.idiomas.map((i) => `${i.idioma}: ${i.nivel}`).join(' | '));
  return l.join('\n');
}

function bloqueCopiable(titulo, texto, nota) {
  const boton = el('button', { class: 'boton boton-secundario boton-chico', type: 'button' }, 'Copiar');
  boton.addEventListener('click', () => copiar(texto, boton));
  return el('div', { class: 'bloque' },
    el('div', { class: 'encabezado-bloque' }, el('h3', {}, titulo), boton),
    nota ? el('p', { class: 'nota' }, nota) : null,
    el('pre', { class: 'texto' }, texto));
}

const ROTULO = { titulo: 'Título sugerido', tecnologia: 'Tecnología sugerida', brecha: 'Brecha' };

function textoPaginas(p) {
  const base = p.medido ? `Ocupa ${p.cantidad} página(s), medido en un PDF real.` : `Ocupa unas ${p.cantidad} página(s) (estimación: no se pudo medir).`;
  return `${base} Se abre y se edita en Word.`;
}

function mostrarResultado(r) {
  const a = r.analisis;
  const c = r.controles;
  const avisos = [...c.avisos];
  const contenido = [
    el('div', { class: 'bloque' },
      el('h3', {}, 'Tu CV'),
      el('p', { class: 'titulo-cv' }, a.titulo_elegido.titulo),
      el('p', { class: 'nota' }, a.titulo_elegido.motivo),
      el('p', {}, el('a', { class: 'boton', href: `/api/trabajo/${datos.trabajo}/cv`, download: r.docx.nombre }, `Descargar ${r.docx.nombre}`)),
      el('p', { class: 'nota' }, textoPaginas(r.paginas)),
      el('details', {}, el('summary', {}, 'Ver el texto del CV'), el('pre', { class: 'texto' }, cvATexto(r.cv)))),
    bloqueCopiable(`Carta (${r.palabrasCarta} palabras)`, r.cartaTexto),
    r.guiaTexto ? bloqueCopiable('Preparate para una entrevista', r.guiaTexto, 'Las preguntas van en el idioma de la oferta; las notas, en español.') : null,
    el('div', { class: 'bloque' },
      el('h3', {}, 'Análisis de la oferta'),
      el('p', { class: 'etiqueta' }, 'Requisitos'),
      a.requisitos.map((q) => el('div', { class: 'requisito' },
        el('span', { class: `puntaje puntaje-${q.puntaje}` }, `${q.puntaje}/3`),
        el('strong', {}, q.texto), ` (${q.tipo})`,
        el('div', { class: 'nota' }, q.justificacion))),
      el('p', { class: 'etiqueta' }, 'No cubierto'), lista(a.no_cubierto),
      el('p', { class: 'etiqueta' }, 'Sugerencias (no se aplicaron al CV: decidís vos)'), lista(a.sugerencias.map((s) => `${ROTULO[s.tipo]}: ${s.sugerido}. ${s.motivo}${s.respaldo ? ` Respaldo: ${s.respaldo}` : ''}`)),
      el('p', { class: 'etiqueta' }, 'Alertas'), lista(a.alertas.map((x) => `${x.tipo}: ${x.detalle}`)),
      el('details', {},
        el('summary', {}, 'Qué priorizó y qué dejó afuera'),
        el('p', { class: 'etiqueta' }, 'Prioriza'), lista(a.decisiones_del_cv.prioriza),
        el('p', { class: 'etiqueta' }, 'Deja afuera'), lista(a.decisiones_del_cv.deja_afuera.map((d) => `${d.elemento}: ${d.motivo}`)))),
    el('div', { class: 'bloque' },
      el('h3', {}, 'Qué corrigió la revisión'), lista(r.cambios),
      r.sinArreglar.length ? [el('p', { class: 'etiqueta' }, 'Sin arreglar'), lista(r.sinArreglar)] : null),
    el('div', { class: 'bloque' },
      el('h3', {}, 'Controles automáticos'),
      el('p', { class: 'nota' }, 'Revisiones hechas por el programa, sin IA.'),
      el('p', { class: 'etiqueta' }, 'Frases prohibidas que siguen en el texto'), lista(c.frasesProhibidas.map((h) => `"${h.frase}" en ${h.donde}`)),
      el('p', { class: 'etiqueta' }, 'Datos que no están en tu CV, tu perfil ni la oferta (revisalos)'), lista(c.datosNuevos.map((d) => `${d.tipo} "${d.valor}" en ${d.donde}`)),
      avisos.length ? [el('p', { class: 'etiqueta' }, 'Avisos'), lista(avisos)] : null),
  ];
  $('resultado').replaceChildren(...contenido);
  mostrarPaso('paso-resultado');
}

$('nueva').addEventListener('click', async () => {
  if (datos.trabajo) await api(`/api/trabajo/${datos.trabajo}`, { method: 'DELETE' }).catch(() => {});
  location.reload(); // se limpia todo lo que había en pantalla
});

verificarEstado();
