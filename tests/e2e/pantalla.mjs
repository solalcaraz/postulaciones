// Prueba manual de la pantalla en un Chrome real (sin ventana), con una IA simulada y datos inventados.
// Sube un CV, completa el formulario, confirma niveles, espera el resultado y saca capturas de cada paso.
//   node tests/e2e/pantalla.mjs [carpeta-de-capturas]
// No es parte de `npm test` porque necesita Chrome instalado. No usa dependencias: habla con Chrome por el protocolo de depuración.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearServidor } from '../../app/servidor.mjs';
import { generarCv } from '../../src/docx/generar.mjs';
import { CV_ES, OFERTA, PERFIL, iaPorEsquema } from '../ayudas.mjs';

// Con PANTALLA_REAL=1 usa Claude de verdad, tu perfil y el archivo PANTALLA_OFERTA (gasta cupo de tu plan). Si no se pasa PANTALLA_CV, usa el CV maestro de datos-privados.
// Las rutas tienen que ser absolutas: con una relativa, Chrome no adjunta el CV.
// PANTALLA_DIFUMINAR="texto1,texto2" difumina esos textos en las capturas (por ejemplo, el nombre de la empresa) y los reemplaza por "[empresa]" en el cuadro de la oferta.
const real = process.env.PANTALLA_REAL === '1';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const capturas = process.argv[2] || 'datos-privados/capturas';
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const temporal = await mkdtemp(join(tmpdir(), 'pantalla-'));
await mkdir(capturas, { recursive: true });

// Servidor con IA simulada y un perfil de ejemplo.
await writeFile(join(temporal, 'perfil.md'), PERFIL, 'utf8');
const rutaCv = real ? process.env.PANTALLA_CV || null : join(temporal, 'cv-ejemplo.docx');
const difuminar = (process.env.PANTALLA_DIFUMINAR || '').split(',').map((t) => t.trim()).filter(Boolean);
if (!real) await writeFile(rutaCv, (await generarCv({ cv: CV_ES, contacto: { nombre: 'Ana Ejemplo' }, idioma: 'es' })).buffer);
const textoOferta = real ? await readFile(process.env.PANTALLA_OFERTA, 'utf8') : OFERTA + ' Valoramos el trabajo en equipo y la comunicación clara.';
// Carta inventada, con solo datos del perfil y la oferta de ejemplo, para que las capturas se vean como un resultado real.
const CARTA_EJEMPLO = [
  'Vi que buscan a alguien con Kotlin y PostgreSQL para sumarse a un equipo chico, y ese es justo el tipo de lugar donde me gusta trabajar: pocas personas, mucha comunicación y responsabilidad compartida sobre lo que se entrega.',
  'Me defino como desarrolladora full stack que arma las cosas de punta a punta. Trabajo con Kotlin y PostgreSQL, me gusta entender el problema antes de escribir código y prefiero explicar una decisión técnica con palabras simples antes que esconderla detrás de la jerga. En un equipo chico eso ayuda: cada persona sabe en qué anda la otra y los cambios no sorprenden a nadie.',
  'Un ejemplo concreto es la Tienda de ejemplo, un proyecto en equipo de 4 personas. Mi parte fue el carrito de compras en Kotlin. Cuando empezamos teníamos 10 tests y terminamos con 25, porque cada vez que tocaba el carrito sumaba pruebas para las reglas nuevas. Eso nos dejó cambiar cosas sin miedo a romper lo que ya funcionaba, y la entrega salió ordenada. Esa costumbre de probar primero lo que más duele es la que llevo a cualquier equipo nuevo.',
  'Me gustaría conversar sobre cómo trabaja el equipo hoy y qué necesitan resolver primero. Puedo escribir a rrhh@empresa.com para coordinar una charla cuando les quede cómodo.',
].join('\n\n');
const iaDeEjemplo = async (pedido) => {
  const respuesta = await iaPorEsquema({ espera: 1500 })(pedido);
  if (respuesta.resultado.carta) respuesta.resultado.carta.cuerpo = CARTA_EJEMPLO;
  return respuesta;
};
const app = real ? crearServidor() : crearServidor({ llamarFn: iaDeEjemplo, carpetaDatos: temporal, rutaPerfil: join(temporal, 'perfil.md'), ejecutableClaude: process.execPath });
const puerto = await app.escuchar(0);

// Chrome sin ventana.
const puertoChrome = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [`--remote-debugging-port=${puertoChrome}`, `--user-data-dir=${join(temporal, 'perfil-chrome')}`, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
let pagina;
for (let i = 0; i < 60 && !pagina; i++) {
  await pausa(250);
  try { pagina = (await (await fetch(`http://127.0.0.1:${puertoChrome}/json/list`)).json()).find((p) => p.type === 'page'); } catch { /* Chrome todavía arranca */ }
}
if (!pagina) throw new Error('No se pudo conectar con Chrome.');

const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let n = 0;
const pendientes = new Map();
const errores = [];
ws.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errores.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
});
const cdp = (metodo, params = {}) => new Promise((resolver) => { const id = ++n; pendientes.set(id, resolver); ws.send(JSON.stringify({ id, method: metodo, params })); });
const evaluar = async (expresion) => (await cdp('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true })).result?.result?.value;
async function esperar(expresion, ms = 20000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (await evaluar(expresion)) return true; await pausa(150); }
  throw new Error(`No se cumplió a tiempo: ${expresion}`);
}
// Envuelve cada aparición de los textos a ocultar en un <span> con desenfoque (no toca lo que ya está difuminado).
const ocultarTextos = () => evaluar(`(() => {
  const textos = ${JSON.stringify(difuminar)}.map((t) => t.toLowerCase());
  const nodos = [];
  const caminante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (caminante.nextNode()) nodos.push(caminante.currentNode);
  for (const nodo of nodos) {
    if (nodo.parentElement.dataset.difuminado) continue;
    const original = nodo.nodeValue;
    const minusculas = original.toLowerCase();
    const trozos = [];
    let desde = 0;
    while (desde < original.length) {
      const hallados = textos.map((t) => [minusculas.indexOf(t, desde), t.length]).filter(([pos]) => pos >= 0).sort((a, b) => a[0] - b[0] || b[1] - a[1]);
      if (!hallados.length) break;
      const [pos, largo] = hallados[0];
      if (pos > desde) trozos.push(document.createTextNode(original.slice(desde, pos)));
      const span = document.createElement('span');
      span.dataset.difuminado = '1';
      span.style.filter = 'blur(7px)';
      span.textContent = original.slice(pos, pos + largo);
      trozos.push(span);
      desde = pos + largo;
    }
    if (!trozos.length) continue;
    if (desde < original.length) trozos.push(document.createTextNode(original.slice(desde)));
    nodo.replaceWith(...trozos);
  }
})()`);
async function captura(nombre, ancho = 1000) {
  if (difuminar.length) await ocultarTextos();
  const { result } = await cdp('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true });
  await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: Math.min(result.result.value + 20, 6000), deviceScaleFactor: 1, mobile: ancho < 600 });
  const { result: img } = await cdp('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(capturas, `${nombre}.png`), Buffer.from(img.data, 'base64'));
  console.log(`  captura: ${join(capturas, nombre)}.png`);
}

try {
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('DOM.enable');
  await cdp('Page.navigate', { url: `http://127.0.0.1:${puerto}/` });
  await esperar(`document.readyState === 'complete' && !!document.querySelector('#formulario')`);
  console.log('1. Formulario cargado');
  await captura('1-formulario');

  // Un error de validación (sin CV) debe mostrarse. Con el CV maestro en datos-privados no hay error: el CV es opcional.
  await evaluar(`document.querySelector('#oferta').value = ${JSON.stringify(textoOferta)}`);
  if (!real) {
    await evaluar(`document.querySelector('#continuar').click()`);
    await esperar(`!document.querySelector('#error').hidden`);
    console.log('   error sin CV:', await evaluar(`document.querySelector('#error').textContent`));
  }

  // Sube el CV (si no hay uno, se usa el maestro), tilda el celular y completa los datos.
  if (rutaCv) {
    const { result: raiz } = await cdp('DOM.getDocument');
    const { result: campo } = await cdp('DOM.querySelector', { nodeId: raiz.root.nodeId, selector: '#cv' });
    await cdp('DOM.setFileInputFiles', { files: [rutaCv], nodeId: campo.nodeId });
  }
  if (!real) {
    await evaluar(`document.querySelector('#usar-celular').click()`);
    await evaluar(`document.querySelector('#celular').value = '11 5555 0000'`);
  }
  if (!real) await evaluar(`document.querySelector('#empresa').value = 'Empresa'`);
  await evaluar(`document.querySelector('#error').hidden = true`);
  // En la captura, el cuadro de la oferta no muestra los textos ocultos (un cuadro de texto no se puede difuminar a medias).
  const ofertaVisible = difuminar.reduce((t, palabra) => t.replaceAll(palabra, '[empresa]'), textoOferta);
  await evaluar(`document.querySelector('#oferta').value = ${JSON.stringify(ofertaVisible)}`);
  await captura('1b-formulario-completo');
  await evaluar(`document.querySelector('#oferta').value = ${JSON.stringify(textoOferta)}`);
  await evaluar(`document.querySelector('#continuar').click()`);
  await esperar(`!document.querySelector('#paso-niveles').hidden`, real ? 120000 : 20000);
  console.log('2. Niveles detectados. Generar deshabilitado hasta confirmar el inglés (que figura como "intermedio"):', await evaluar(`document.querySelector('#generar').disabled`), '·', await evaluar(`document.querySelector('#falta-nivel').textContent`));
  await captura('2-niveles');

  await evaluar(`(() => { const s = document.querySelector('select[data-clave="en"]'); s.value = 'B1'; s.dispatchEvent(new Event('change')); })()`);
  console.log('   Generar habilitado tras elegir B1:', !(await evaluar(`document.querySelector('#generar').disabled`)));
  await evaluar(`document.querySelector('#generar').click()`);
  await esperar(`!document.querySelector('#paso-progreso').hidden`);
  await esperar(`document.querySelector('#progreso-mensaje').textContent !== 'Empezando…'`, 10000);
  console.log('3. Progreso:', await evaluar(`document.querySelector('#progreso-mensaje').textContent`));
  await captura('3-progreso');

  await esperar(`!document.querySelector('#paso-resultado').hidden`, real ? 600000 : 20000);
  console.log('4. Resultado listo');
  await captura('4-resultado');
  console.log('   corte de la carta (px):', await evaluar(`Math.round(document.querySelectorAll('#resultado .bloque')[1].getBoundingClientRect().bottom + scrollY)`));
  const enlace = await evaluar(`document.querySelector('#resultado a.boton').getAttribute('href')`);
  const descarga = await fetch(`http://127.0.0.1:${puerto}${enlace}`);
  console.log('   descarga del .docx:', descarga.status, descarga.headers.get('content-disposition'));
  if (real) await writeFile(join(capturas, 'cv-generado.docx'), Buffer.from(await descarga.arrayBuffer()));

  // El botón Copiar de la carta.
  await evaluar(`window.__copiado = null; navigator.clipboard.writeText = async (t) => { window.__copiado = t; }`);
  await evaluar(`[...document.querySelectorAll('#resultado button')].find((b) => b.textContent === 'Copiar').click()`);
  await pausa(200);
  console.log('   texto copiado empieza con:', JSON.stringify((await evaluar('window.__copiado') || '').slice(0, 20)));

  // Modo oscuro y celular.
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await captura('5-resultado-oscuro');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await captura('6-resultado-celular', 390);
  console.log('   corte de la carta en celular (px):', await evaluar(`Math.round(document.querySelectorAll('#resultado .bloque')[1].getBoundingClientRect().bottom + scrollY)`));

  // Nada se guarda en el navegador.
  console.log('   localStorage vacío:', (await evaluar('localStorage.length')) === 0, '· cookies:', JSON.stringify(await evaluar('document.cookie')));
  console.log(errores.length ? `ERRORES EN LA CONSOLA:\n${errores.join('\n')}` : 'Sin errores en la consola del navegador.');
} finally {
  ws.close();
  chrome.kill();
  await app.cerrar();
  await pausa(500);
  await rm(temporal, { recursive: true, force: true }).catch(() => {});
}
