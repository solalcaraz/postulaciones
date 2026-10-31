import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mediana, porcentajeCambiado, porcentajeEdicion, tablaRegistro, resultados } from '../src/medicion-resumen.mjs';
import { generarCv } from '../src/docx/generar.mjs';
import { CV_ES } from './ayudas.mjs';

const entrada = (id, extra = {}) => ({
  id, fecha: `2026-10-3${id}T12:00:00.000Z`, puesto: `Puesto ${id}`, idioma: 'es', segundos: 120, costoEstimadoUsd: 0.4, paginas: 1, paginasMedidas: true,
  palabrasCarta: 230, frasesProhibidas: 0, datosNuevos: 0, sugerencias: 2, aplicadas: null, enviada: null, respuesta: null, ...extra,
});

test('mediana de cantidades pares e impares', () => {
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([4, 1, 2, 3]), 2.5);
});

test('porcentaje de palabras cambiadas: igual, distinto y parcial', () => {
  assert.equal(porcentajeCambiado('uno dos tres cuatro', 'uno dos tres cuatro'), 0);
  assert.equal(porcentajeCambiado('uno dos', 'tres cuatro'), 100);
  assert.equal(porcentajeCambiado('uno dos tres cuatro', 'uno dos tres cinco'), 25);
});

test('la tabla y los resultados salen del registro, sin nombres de empresa', () => {
  const entradas = [entrada('1', { aplicadas: 1, enviada: '2026-11-02', respuesta: 'positiva' }), entrada('2', { paginas: 2, palabrasCarta: 190, datosNuevos: 1, segundos: 60 })];
  const tabla = tablaRegistro(entradas, { 1: 12.4 });
  assert.match(tabla, /\| 1 \| 31\/10\/2026 \| Puesto 1 \| es \| 2,0 \| 0,40 \| 1 \| 230 \| 0 \| 0 \| 1\/2 \| 12 % \| 02\/11\/2026 \| positiva \|/);
  assert.match(tabla, /\| 2 \| .* \| _\/2 \| {2}\| {2}\| {2}\|$/m);
  const r = resultados(entradas, { 1: 12.4 });
  assert.match(r, /Postulaciones hechas con la herramienta \| 2 \|/);
  assert.match(r, /Minutos de generación \(mediana y rango\) \| 1,5 \(de 1,0 a 2,0\)/);
  assert.match(r, /CV que entraron en 1 página \| 1 de 2/);
  assert.match(r, /Cartas dentro de 200 a 280 palabras \| 1 de 2/);
  assert.match(r, /datos nuevos marcados por el control \| 1 de 2/);
  assert.match(r, /Sugerencias aplicadas \| 1 de 2 \(en 1 postulaciones cargadas\)/);
  assert.match(r, /Enviadas \| 1 de 2/);
  assert.match(r, /Con respuesta positiva \| 1 de 2/);
  assert.match(r, /Enviadas sin respuesta todavía \| 0 de 2/);
});

let carpeta;
before(async () => { carpeta = await mkdtemp(join(tmpdir(), 'medicion-')); });
after(() => rm(carpeta, { recursive: true, force: true }));

test('calcula la edición si está enviado.docx y devuelve null si no', async () => {
  assert.equal(await porcentajeEdicion(carpeta), null);
  await writeFile(join(carpeta, 'CV-generado.docx'), (await generarCv({ cv: CV_ES, contacto: { nombre: 'Ana Ejemplo' } })).buffer);
  assert.equal(await porcentajeEdicion(carpeta), null, 'sin enviado.docx no hay comparación');
  await writeFile(join(carpeta, 'enviado.docx'), (await generarCv({ cv: CV_ES, contacto: { nombre: 'Ana Ejemplo' } })).buffer);
  assert.equal(await porcentajeEdicion(carpeta), 0, 'un CV igual al generado cambió 0 %');
  const editado = { ...CV_ES, resumen: 'Resumen totalmente distinto con palabras que no estaban antes en el texto.' };
  await writeFile(join(carpeta, 'enviado.docx'), (await generarCv({ cv: editado, contacto: { nombre: 'Ana Ejemplo' } })).buffer);
  const cambio = await porcentajeEdicion(carpeta);
  assert.ok(cambio > 0 && cambio < 50, `cambio parcial: ${cambio}`);
});
