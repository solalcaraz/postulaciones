import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { writeFile, rm, mkdtemp } from 'node:fs/promises';
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
  const app = crearServidor({ rutaPerfil, ejecutableClaude: 'programa-que-no-existe', ...opciones });
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

test('si la IA falla, el trabajo termina con un mensaje claro', () => conServidor({ llamarFn: iaPorEsquema({ error: new ErrorIA('Se llegó al límite de uso de tu plan de Claude.', 'limite') }) }, async ({ pedir }) => {
  const { id } = await (await pedir('/api/generar', { metodo: 'POST', cuerpo: cuerpoGenerar() })).json();
  const t = await esperar(pedir, id);
  assert.equal(t.estado, 'error');
  assert.match(t.error, /límite de uso/);
  assert.equal((await pedir(`/api/trabajo/${id}/cv`)).estado, 409);
}));
