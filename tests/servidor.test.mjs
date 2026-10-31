import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { writeFile, rm, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearServidor } from '../app/servidor.mjs';
import { generarCv } from '../src/docx/generar.mjs';
import { ErrorIA } from '../src/ia.mjs';
import { CV_ES, OFERTA, PERFIL, iaPorEsquema } from './ayudas.mjs';

const OFERTA_LARGA = OFERTA + ' ' + 'Valoramos el trabajo en equipo y la comunicación clara. '.repeat(3);
let carpeta, rutaPerfil, cvBase64;

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'postulaciones-test-'));
  rutaPerfil = join(carpeta, 'perfil.md');
  await writeFile(rutaPerfil, PERFIL, 'utf8');
  cvBase64 = (await generarCv({ cv: CV_ES, contacto: { nombre: 'Ana Ejemplo' }, idioma: 'es' })).buffer.toString('base64');
});
after(() => rm(carpeta, { recursive: true, force: true }));

async function conServidor(opciones, prueba) {
  const app = crearServidor({ carpetaDatos: carpeta, rutaPerfil, ejecutableClaude: 'programa-que-no-existe', medirFn: async () => ({ paginas: 1, ultima: 1 }), ...opciones });
  const puerto = await app.escuchar(0);
  const base = `http://127.0.0.1:${puerto}`;
  const pedir = async (ruta, { metodo = 'GET', cuerpo, cabeceras = {} } = {}) => {
    const r = await fetch(base + ruta, { method: metodo, headers: { ...(metodo === 'POST' ? { 'X-Postulaciones': '1', 'Content-Type': 'application/json' } : {}), ...cabeceras }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    return { estado: r.status, tipo: r.headers.get('content-type'), r, json: async () => r.json() };
  };
  try { await prueba({ app, base, puerto, pedir }); } finally { await app.cerrar(); }
}

const cuerpoGenerar = (extra = {}) => ({ archivo: { nombre: 'cv.docx', base64: cvBase64 }, oferta: OFERTA_LARGA, idioma: 'es', niveles: { es: 'nativo', en: 'B1' }, celular: '', empresa: 'Empresa', ...extra });

async function esperar(pedir, id) {
  for (let i = 0; i < 100; i++) {
    const t = await (await pedir(`/api/trabajo/${id}`)).json();
    if (t.estado !== 'en curso') return t;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error('El trabajo no terminó a tiempo.');
}

test('sirve la pantalla y el estado de la herramienta', () => conServidor({ llamarFn: iaPorEsquema() }, async ({ pedir }) => {
  const inicio = await pedir('/');
  assert.equal(inicio.estado, 200);
  assert.match(inicio.tipo, /text\/html/);
  const estado = await (await pedir('/api/estado')).json();
  assert.equal(estado.perfil, true);
  assert.equal(estado.claude.disponible, false);
}));

test('avisa si falta el perfil', () => conServidor({ llamarFn: iaPorEsquema(), rutaPerfil: join(carpeta, 'no-existe.md') }, async ({ pedir }) => {
  assert.equal((await (await pedir('/api/estado')).json()).perfil, false);
  const r = await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar() });
  assert.equal(r.estado, 500);
  assert.match((await r.json()).error, /perfil/);
}));

test('rechaza pedidos sin la cabecera propia y pedidos con otro Host', () => conServidor({ llamarFn: iaPorEsquema() }, async ({ pedir, puerto }) => {
  const sin = await pedir('/api/idiomas', { metodo: 'POST', cuerpo: {}, cabeceras: { 'X-Postulaciones': '0' } });
  assert.equal(sin.estado, 403);
  const estado = await new Promise((resolver) => {
    const req = http.request({ host: '127.0.0.1', port: puerto, path: '/api/estado', headers: { Host: 'sitio-ajeno.com' } }, (res) => { res.resume(); resolver(res.statusCode); });
    req.end();
  });
  assert.equal(estado, 403);
}));

test('no entrega archivos de afuera de la carpeta pública', () => conServidor({ llamarFn: iaPorEsquema() }, async ({ pedir }) => {
  assert.equal((await pedir('/%2e%2e/servidor.mjs')).estado, 404);
  assert.equal((await pedir('/../../package.json')).estado, 404);
  assert.equal((await pedir('/inexistente.html')).estado, 404);
}));

test('detecta los idiomas de un CV en Word', () => conServidor({ llamarFn: iaPorEsquema() }, async ({ pedir }) => {
  const r = await pedir('/api/idiomas', { metodo: 'POST', cuerpo: { archivo: { nombre: 'cv.docx', base64: cvBase64 }, oferta: OFERTA_LARGA } });
  assert.equal(r.estado, 200);
  const cuerpo = await r.json();
  assert.equal(cuerpo.cv_idiomas[1].nivel_cefr, 'no_figura');
  assert.equal(cuerpo.oferta.idioma_detectado, 'es');
}));

test('un PDF sin texto, un archivo inválido y una oferta corta dan errores claros', () => conServidor({ llamarFn: iaPorEsquema() }, async ({ pedir }) => {
  const pdfVacio = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF').toString('base64');
  const a = await pedir('/api/idiomas', { metodo: 'POST', cuerpo: { archivo: { nombre: 'cv.pdf', base64: pdfVacio }, oferta: OFERTA_LARGA } });
  assert.equal(a.estado, 400);
  assert.match((await a.json()).error, /no tiene texto/);
  const b = await pedir('/api/idiomas', { metodo: 'POST', cuerpo: { archivo: { nombre: 'cv.txt', base64: Buffer.from('hola').toString('base64') }, oferta: OFERTA_LARGA } });
  assert.match((await b.json()).error, /PDF o un archivo de Word/);
  const c = await pedir('/api/idiomas', { metodo: 'POST', cuerpo: { archivo: { nombre: 'cv.docx', base64: cvBase64 }, oferta: 'corta' } });
  assert.match((await c.json()).error, /texto completo de la oferta/);
  const d = await pedir('/api/idiomas', { metodo: 'POST', cuerpo: {} });
  assert.match((await d.json()).error, /Subí tu CV/);
}));

test('rechaza un cuerpo demasiado grande', () => conServidor({ llamarFn: iaPorEsquema() }, async ({ pedir }) => {
  const r = await pedir('/api/idiomas', { metodo: 'POST', cuerpo: { archivo: { nombre: 'cv.pdf', base64: 'A'.repeat(13 * 1024 * 1024) }, oferta: OFERTA_LARGA } }).catch((e) => ({ estado: 'cortado', e }));
  assert.ok(r.estado === 413 || r.estado === 'cortado', `estado inesperado: ${r.estado}`);
}));

test('valida el idioma y los niveles antes de generar', () => conServidor({ llamarFn: iaPorEsquema() }, async ({ pedir }) => {
  const sinIdioma = await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar({ idioma: 'fr' }) });
  assert.match((await sinIdioma.json()).error, /idioma del CV/);
  const sinNivel = await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar({ niveles: { es: 'nativo' }, idioma: 'en' }) });
  assert.match((await sinNivel.json()).error, /nivel/);
  const nivelRaro = await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar({ niveles: { es: 'nativo', en: 'avanzado' } }) });
  assert.equal(nivelRaro.estado, 400);
}));

test('flujo completo: genera, muestra el resultado y descarga el .docx', () => conServidor({ llamarFn: iaPorEsquema({ espera: 20 }) }, async ({ pedir }) => {
  const r = await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar({ celular: '11 5555 0000' }) });
  assert.equal(r.estado, 202);
  const { id } = await r.json();
  const t = await esperar(pedir, id);
  assert.equal(t.estado, 'listo');
  assert.equal(t.resultado.docx.nombre, 'CV-Ana-Ejemplo-Empresa-es.docx');
  assert.match(t.resultado.cartaTexto, /Hola, ¿qué tal\?/);
  assert.equal(t.resultado.docx.buffer, undefined, 'el .docx no viaja dentro del JSON');

  const descarga = await pedir(`/api/trabajo/${id}/cv`);
  assert.equal(descarga.estado, 200);
  assert.match(descarga.tipo, /wordprocessingml/);
  assert.match(descarga.r.headers.get('content-disposition'), /CV-Ana-Ejemplo-Empresa-es\.docx/);
  const bytes = Buffer.from(await descarga.r.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');

  assert.equal((await pedir(`/api/trabajo/${id}`, { metodo: 'DELETE', cabeceras: { 'X-Postulaciones': '1' } })).estado, 200);
  assert.equal((await pedir(`/api/trabajo/${id}`)).estado, 404);
}));

test('no deja empezar una segunda postulación mientras hay una en curso', () => conServidor({ llamarFn: iaPorEsquema({ espera: 300 }) }, async ({ pedir }) => {
  const primera = await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar() });
  assert.equal(primera.estado, 202);
  const segunda = await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar() });
  assert.equal(segunda.estado, 409);
  const { id } = await primera.json();
  assert.equal((await esperar(pedir, id)).estado, 'listo');
  assert.equal((await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar() })).estado, 202);
}));

test('si la IA devuelve un formato roto dos veces, la pantalla recibe un error claro y no se crea ningún CV', async () => {
  const base = iaPorEsquema();
  let intentosDeGeneracion = 0;
  const llamarFn = async (pedido) => {
    if (!pedido.esquema.properties.analisis) return base(pedido);
    intentosDeGeneracion++;
    const { resultado } = await base(pedido);
    delete resultado.cv;
    return { resultado, costoEstimadoUsd: 0.1, duracionMs: 1 };
  };
  await conServidor({ llamarFn }, async ({ pedir }) => {
    const { id } = await (await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar() })).json();
    const t = await esperar(pedir, id);
    assert.equal(t.estado, 'error');
    assert.match(t.error, /formato/i);
    assert.equal(intentosDeGeneracion, 2, 'reintenta una sola vez');
    assert.equal((await pedir(`/api/trabajo/${id}/cv`)).estado, 409);
  });
});

test('si la IA falla, el trabajo termina con un mensaje claro',() => conServidor({ llamarFn: iaPorEsquema({ error: new ErrorIA('Se llegó al límite de uso de tu plan de Claude.', 'limite') }) }, async ({ pedir }) => {
  const { id } = await (await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar() })).json();
  const t = await esperar(pedir, id);
  assert.equal(t.estado, 'error');
  assert.match(t.error, /límite de uso/);
  assert.equal((await pedir(`/api/trabajo/${id}/cv`)).estado, 409);
}));

test('la guía de entrevista llega solo si se la pidió', () => conServidor({ llamarFn: iaPorEsquema() }, async ({ pedir }) => {
  const sin = await (await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar() })).json();
  assert.equal((await esperar(pedir, sin.id)).resultado.guiaTexto, '');
  const con = await (await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar({ guia: true }) })).json();
  assert.match((await esperar(pedir, con.id)).resultado.guiaTexto, /¿Qué hiciste\?/);
}));

// Carpeta de datos aparte, con perfil y, si se pide, CV maestro en español y en inglés (con un texto distinto en cada uno).
async function carpetaConDatos({ maestros = false, medicion = null } = {}) {
  const datos = await mkdtemp(join(tmpdir(), 'postulaciones-datos-'));
  await writeFile(join(datos, 'perfil.md'), PERFIL, 'utf8');
  if (maestros) {
    await writeFile(join(datos, 'CV-maestro-ana-es.docx'), (await generarCv({ cv: CV_ES, contacto: { nombre: 'Ana Ejemplo' }, idioma: 'es' })).buffer);
    const cvEn = { ...CV_ES, titulo: 'Marcador del CV en ingles' };
    await writeFile(join(datos, 'CV-maestro-ana-en.docx'), (await generarCv({ cv: cvEn, contacto: { nombre: 'Ana Ejemplo' }, idioma: 'en' })).buffer);
  }
  if (medicion) await writeFile(join(datos, 'medicion.json'), JSON.stringify(medicion), 'utf8');
  return datos;
}

function iaQueRecuerda() {
  const base = iaPorEsquema();
  const fn = async (pedido) => { fn.prompts.push(pedido.prompt); return base(pedido); };
  fn.prompts = [];
  return fn;
}

test('sin CV subido usa el CV maestro del idioma pedido; si se sube uno, manda el subido', async () => {
  const datos = await carpetaConDatos({ maestros: true });
  const ia = iaQueRecuerda();
  try {
    await conServidor({ llamarFn: ia, carpetaDatos: datos, rutaPerfil: join(datos, 'perfil.md') }, async ({ pedir }) => {
      assert.deepEqual((await (await pedir('/api/estado')).json()).maestros, ['CV-maestro-ana-en.docx', 'CV-maestro-ana-es.docx']);
      assert.equal((await pedir('/api/idiomas', { metodo: 'POST', cuerpo: { oferta: OFERTA_LARGA } })).estado, 200);

      const { id } = await (await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar({ archivo: undefined, idioma: 'en' }) })).json();
      assert.equal((await esperar(pedir, id)).estado, 'listo');
      assert.ok(ia.prompts.some((p) => p.includes('Marcador del CV en ingles')), 'con idioma en usa el maestro en inglés');

      ia.prompts.length = 0;
      const subido = await (await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar({ idioma: 'en' }) })).json();
      assert.equal((await esperar(pedir, subido.id)).estado, 'listo');
      assert.ok(!ia.prompts.some((p) => p.includes('Marcador del CV en ingles')), 'el CV subido tiene prioridad');
    });
  } finally { await rm(datos, { recursive: true, force: true }); }
});

test('sin CV subido y sin maestro pide subir uno', () => conServidor({ llamarFn: iaPorEsquema() }, async ({ pedir }) => {
  const r = await pedir('/api/idiomas', { metodo: 'POST', cuerpo: { oferta: OFERTA_LARGA } });
  assert.equal(r.estado, 400);
  assert.match((await r.json()).error, /Subí tu CV/);
}));

test('sin medicion.json no se guarda nada y no hay panel de medición', async () => {
  const datos = await carpetaConDatos();
  try {
    await conServidor({ llamarFn: iaPorEsquema(), carpetaDatos: datos, rutaPerfil: join(datos, 'perfil.md') }, async ({ pedir }) => {
      assert.equal((await (await pedir('/api/medicion')).json()).activa, false);
      const { id } = await (await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar() })).json();
      const t = await esperar(pedir, id);
      assert.equal(t.estado, 'listo');
      assert.equal(t.resultado.medicion, null);
      assert.ok(!(await readdir(datos)).includes('mediciones'));
    });
  } finally { await rm(datos, { recursive: true, force: true }); }
});

test('modo medición: guarda hasta el objetivo, deja de guardar y permite anotar respuestas', async () => {
  const datos = await carpetaConDatos({ medicion: { objetivo: 1 } });
  try {
    await conServidor({ llamarFn: iaPorEsquema(), carpetaDatos: datos, rutaPerfil: join(datos, 'perfil.md') }, async ({ pedir }) => {
      const primera = await esperar(pedir, (await (await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar() })).json()).id);
      assert.deepEqual(primera.resultado.medicion, { numero: 1, objetivo: 1 });
      assert.deepEqual((await readdir(join(datos, 'mediciones', '001'))).sort(), ['CV-Ana-Ejemplo-Empresa-es.docx', 'carta.txt', 'oferta.txt', 'panel.md']);

      const segunda = await esperar(pedir, (await (await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar() })).json()).id);
      assert.equal(segunda.resultado.medicion, null, 'al llegar al objetivo ya no guarda');

      const m = await (await pedir('/api/medicion')).json();
      assert.deepEqual([m.activa, m.guardando, m.hechas, m.objetivo], [true, false, 1, 1]);
      assert.equal(m.entradas[0].respuesta, null);

      const anotar = (id, cuerpo) => pedir(`/api/medicion/${id}`, { metodo: 'POST', cuerpo });
      const registro = async () => JSON.parse(await readFile(join(datos, 'mediciones', 'registro.json'), 'utf8'))[0];
      assert.deepEqual([m.entradas[0].puesto, m.entradas[0].idioma, m.entradas[0].sugerencias, m.entradas[0].aplicadas, m.entradas[0].enviada], [OFERTA_LARGA.split('\n')[0].slice(0, 80), 'es', 1, null, null]);

      assert.equal((await (await anotar('001', { respuesta: 'positiva' })).json()).respuesta, 'positiva');
      assert.equal((await registro()).respuesta, 'positiva');
      assert.equal((await anotar('001', { respuesta: 'quizas' })).estado, 400);
      assert.equal((await anotar('009', { respuesta: 'negativa' })).estado, 400);

      const completa = await (await anotar('001', { enviada: '2026-11-02', aplicadas: 1 })).json();
      assert.deepEqual([completa.enviada, completa.aplicadas, completa.respuesta], ['2026-11-02', 1, 'positiva'], 'solo cambia lo que viene en el pedido');
      assert.equal((await anotar('001', { aplicadas: 2 })).estado, 400, 'no puede haber más aplicadas que sugerencias');
      assert.equal((await anotar('001', { aplicadas: 1.5 })).estado, 400);
      assert.equal((await anotar('001', { enviada: '2 de noviembre' })).estado, 400);
      assert.equal((await (await anotar('001', { respuesta: null, enviada: null, aplicadas: null })).json()).respuesta, null);
    });
  } finally { await rm(datos, { recursive: true, force: true }); }
});

test('una medición cerrada ya no muestra el panel', async () => {
  const datos = await carpetaConDatos({ medicion: { objetivo: 5, cerrada: true } });
  try {
    await conServidor({ llamarFn: iaPorEsquema(), carpetaDatos: datos, rutaPerfil: join(datos, 'perfil.md') }, async ({ pedir }) => {
      assert.equal((await (await pedir('/api/medicion')).json()).activa, false);
    });
  } finally { await rm(datos, { recursive: true, force: true }); }
});
