import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validar } from '../src/validacion/esquema.mjs';
import { listaNegra, datosNuevos, textosConUbicacion } from '../src/validacion/controles.mjs';
import { idiomasSchema, resultadoSchema } from '../src/esquema/index.mjs';
import { resultadoEjemplo } from './ayudas.mjs';

test('el esquema acepta una respuesta completa y rechaza una incompleta', () => {
  assert.equal(validar(resultadoSchema, resultadoEjemplo()).ok, true);
  const rota = resultadoEjemplo();
  delete rota.carta;
  const v = validar(resultadoSchema, rota);
  assert.equal(v.ok, false);
  assert.ok(v.errores.length > 0);
});

test('el esquema rechaza valores fuera de lo permitido', () => {
  const v = validar(idiomasSchema, { cv_idiomas: [{ idioma: 'Inglés', nivel_en_el_cv: 'B1', nivel_cefr: 'avanzado', cita: 'x' }], oferta: { idioma_detectado: 'es', idiomas_requeridos: [] } });
  assert.equal(v.ok, false);
});

test('la lista negra encuentra frases prohibidas en español, con su ubicación', async () => {
  const textos = textosConUbicacion({ cv: { resumen: 'Soy una desarrolladora apasionada por la tecnología.' }, carta: { cuerpo: 'Me dirijo a ustedes.' } });
  const hallazgos = await listaNegra(textos, 'es');
  assert.deepEqual(hallazgos.map((h) => h.donde).sort(), ['cv.resumen', 'carta.cuerpo'].sort());
});

test('la lista negra encuentra frases prohibidas en inglés y no marca texto limpio', async () => {
  assert.equal((await listaNegra([{ ruta: 'cv.resumen', texto: 'I am a passionate developer who leveraged Astro.' }], 'en')).length, 2);
  assert.equal((await listaNegra([{ ruta: 'cv.resumen', texto: 'I built a website with Astro.' }], 'en')).length, 0);
  assert.equal((await listaNegra([{ ruta: 'cv.resumen', texto: 'Armé una web con Astro.' }], 'es')).length, 0);
});

test('detecta números, enlaces y términos que no están en las fuentes', () => {
  const fuentes = ['Armé una tienda con Kotlin y PostgreSQL. Pasamos de 10 a 25 tests. github.com/ana/tienda'];
  const textos = [{ ruta: 'cv.puntos[0]', texto: 'Pasamos de 10 a 25 tests con Kotlin y PostgreSQL (github.com/ana/tienda).' }];
  assert.deepEqual(datosNuevos(textos, fuentes), []);
  const inventado = [{ ruta: 'cv.puntos[1]', texto: 'Reduje el tiempo un 40 % con MongoDB y publiqué en github.com/otra/cosa.' }];
  const tipos = datosNuevos(inventado, fuentes).map((d) => `${d.tipo}:${d.valor}`);
  assert.ok(tipos.includes('número:40'));
  assert.ok(tipos.includes('término:MongoDB'));
  assert.ok(tipos.includes('enlace:github.com/otra/cosa'));
});

test('los números con formato distinto se reconocen como el mismo dato', () => {
  const fuentes = ['173.242 transacciones y un 9,2 % de aciertos'];
  assert.deepEqual(datosNuevos([{ ruta: 'x', texto: '173242 transacciones y 9.2% de aciertos' }], fuentes), []);
});

test('los términos técnicos de la guía de entrevista no se marcan, pero sus números sí', () => {
  const fuentes = ['Armé la tienda con Kotlin y PostgreSQL.'];
  const guia = [{ ruta: 'guia[0].si_no_lo_hiciste', texto: 'Preparate para consultas SELECT y UPDATE. Dijiste que fueron 99 casos.' }];
  const tipos = datosNuevos(guia, fuentes).map((d) => d.tipo);
  assert.deepEqual(tipos, ['número']);
});
