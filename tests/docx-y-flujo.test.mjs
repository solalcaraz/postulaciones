import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generarCv, nombreDeArchivo } from '../src/docx/generar.mjs';
import { generarPostulacion, llamarValidado } from '../src/postular.mjs';
import { ErrorIA } from '../src/ia.mjs';
import { resultadoSchema, sinGuia } from '../src/esquema/index.mjs';
import { evaluarPaginas } from '../src/docx/paginas.mjs';
import { CV_ES, CV_TEXTO, OFERTA, PERFIL, iaFalsa, leerEntradaZip, resultadoEjemplo, revisionEjemplo } from './ayudas.mjs';

const contacto = { nombre: 'Ana Ejemplo', ubicacion: 'Rosario, Santa Fe', email: 'ana@ejemplo.com', linkedin: 'linkedin.com/in/ana-ejemplo', github: 'github.com/anaejemplo' };
const unaHoja = async () => ({ paginas: 1, ultima: 1 });
const base = { cv: CV_TEXTO, oferta: OFERTA, perfil: PERFIL, idiomaSalida: 'es', niveles: { es: 'nativo', en: 'B1' }, empresa: 'Empresa', conGuia: true, medirFn: unaHoja };

test('el .docx es de una columna, sin tablas ni imágenes, con estilos y listas reales de Word', async () => {
  const { buffer } = await generarCv({ cv: CV_ES, contacto, idioma: 'es' });
  const xml = leerEntradaZip(buffer, 'word/document.xml');
  assert.ok(xml, 'tiene document.xml');
  for (const prohibido of ['<w:tbl>', '<w:drawing', '<w:pict', '<w:txbxContent', '<w:cols ']) assert.ok(!xml.includes(prohibido), `no debe tener ${prohibido}`);
  assert.match(xml, /w:pStyle w:val="Heading1"/);
  assert.match(xml, /w:pStyle w:val="Heading2"/);
  assert.match(xml, /<w:numPr>/);
  assert.ok(leerEntradaZip(buffer, 'word/numbering.xml'), 'tiene definición de listas');
});

test('los títulos de sección se traducen según el idioma', async () => {
  const es = leerEntradaZip((await generarCv({ cv: CV_ES, contacto, idioma: 'es' })).buffer, 'word/document.xml');
  const en = leerEntradaZip((await generarCv({ cv: CV_ES, contacto, idioma: 'en' })).buffer, 'word/document.xml');
  assert.match(es, /Experiencia/);
  assert.match(en, /Experience/);
  assert.match(en, /Education/);
});

test('el celular aparece solo si se lo pide', async () => {
  const sin = leerEntradaZip((await generarCv({ cv: CV_ES, contacto })).buffer, 'word/document.xml');
  const con = leerEntradaZip((await generarCv({ cv: CV_ES, contacto, celular: '11 5555 0000' })).buffer, 'word/document.xml');
  assert.ok(!sin.includes('5555'));
  assert.ok(con.includes('11 5555 0000'));
});

test('el nombre del archivo sale sin tildes ni caracteres raros', () => {
  assert.equal(nombreDeArchivo('María Sol Alcaraz', 'Exactian S.A.', 'es'), 'CV-Maria-Sol-Alcaraz-Exactian-S-A-es.docx');
});

test('si la IA devuelve un formato roto, reintenta una vez y funciona', async () => {
  const rota = resultadoEjemplo();
  delete rota.cv;
  const ia = iaFalsa([rota, resultadoEjemplo()]);
  const r = await llamarValidado({ prompt: 'x', esquema: resultadoSchema, llamarFn: ia });
  assert.equal(r.intentos, 2);
  assert.equal(ia.llamadas, 2);
});

test('si la IA devuelve un formato roto dos veces, el error es claro', async () => {
  const rota = resultadoEjemplo();
  delete rota.cv;
  const ia = iaFalsa([rota, rota]);
  await assert.rejects(llamarValidado({ prompt: 'x', esquema: resultadoSchema, llamarFn: ia }), (e) => e instanceof ErrorIA && /formato roto/.test(e.message));
  assert.equal(ia.llamadas, 2);
});

test('un error del servicio (por ejemplo, el límite del plan) no se reintenta', async () => {
  const ia = iaFalsa([new ErrorIA('Se llegó al límite de uso de tu plan.', 'limite')]);
  await assert.rejects(llamarValidado({ prompt: 'x', esquema: resultadoSchema, llamarFn: ia }), /límite/);
  assert.equal(ia.llamadas, 1);
});

test('flujo completo con una IA simulada: genera el .docx, la carta y los controles', async () => {
  const ia = iaFalsa([resultadoEjemplo(), revisionEjemplo()]);
  const r = await generarPostulacion({ ...base, llamarFn: ia });
  assert.equal(ia.llamadas, 2);
  assert.equal(r.docx.nombre, 'CV-Ana-Ejemplo-Empresa-es.docx');
  assert.equal(r.palabrasCarta, 230);
  assert.match(r.cartaTexto, /^Hola, ¿qué tal\?/);
  assert.match(r.cartaTexto, /Ana Ejemplo$/);
  assert.equal(r.controles.frasesProhibidas.length, 0);
});

test('si queda una frase prohibida, pide una segunda revisión y la corrige', async () => {
  const sucia = revisionEjemplo();
  sucia.cv.resumen = 'Desarrolladora apasionada por la tecnología.';
  const ia = iaFalsa([resultadoEjemplo(), sucia, revisionEjemplo()]);
  const r = await generarPostulacion({ ...base, llamarFn: ia });
  assert.equal(ia.llamadas, 3);
  assert.equal(r.controles.frasesProhibidas.length, 0);
});

test('si la frase prohibida sigue después del reintento, se avisa en los controles', async () => {
  const sucia = revisionEjemplo();
  sucia.cv.resumen = 'Desarrolladora apasionada por la tecnología.';
  const ia = iaFalsa([resultadoEjemplo(), sucia, sucia]);
  const r = await generarPostulacion({ ...base, llamarFn: ia });
  assert.equal(ia.llamadas, 3);
  assert.equal(r.controles.frasesProhibidas.length, 1);
});

test('un dato inventado en el texto final aparece en los controles', async () => {
  const inventada = revisionEjemplo();
  inventada.cv.proyectos[0].puntos.push('Reduje el tiempo de respuesta un 73 %.');
  const r = await generarPostulacion({ ...base, llamarFn: iaFalsa([resultadoEjemplo(), inventada]) });
  assert.ok(r.controles.datosNuevos.some((d) => d.valor === '73'));
});

test('avisa si la carta se pasa del largo pedido', async () => {
  const larga = revisionEjemplo();
  larga.carta.cuerpo = Array.from({ length: 300 }, (_, i) => `p${i}`).join(' ');
  const r = await generarPostulacion({ ...base, llamarFn: iaFalsa([resultadoEjemplo(), larga]) });
  assert.ok(r.controles.avisos.some((a) => /200 a 280/.test(a)));
});

test('la guía de entrevista no se genera si no se pidió, y sí si se pidió', async () => {
  const sin = iaFalsa([(() => { const r = resultadoEjemplo(); delete r.preparacion_entrevista; return r; })(), (() => { const r = revisionEjemplo(); delete r.preparacion_entrevista; return r; })()]);
  const r1 = await generarPostulacion({ ...base, conGuia: false, llamarFn: sin });
  assert.equal(r1.guiaTexto, '');
  const con = iaFalsa([resultadoEjemplo(), revisionEjemplo()]);
  const r2 = await generarPostulacion({ ...base, llamarFn: con });
  assert.match(r2.guiaTexto, /¿Qué hiciste?/);
  assert.ok(!('preparacion_entrevista' in sinGuia(resultadoSchema).properties));
});

test('el análisis trae la nota de sugerencias, separada del CV', async () => {
  const r = await generarPostulacion({ ...base, llamarFn: iaFalsa([resultadoEjemplo(), revisionEjemplo()]) });
  assert.equal(r.analisis.sugerencias[0].tipo, 'tecnologia');
  assert.ok(!JSON.stringify(r.cv).includes('CI/CD'));
});

test('el .docx pone Proyectos antes que Experiencia', async () => {
  const xml = leerEntradaZip((await generarCv({ cv: CV_ES, contacto, idioma: 'es' })).buffer, 'word/document.xml');
  assert.ok(xml.indexOf('>Proyectos<') < xml.indexOf('>Experiencia<'));
});

test('las páginas: una hoja está bien; dos solo si la segunda lleva 1/4 o menos', () => {
  assert.equal(evaluarPaginas({ paginas: 1, ultima: 0.9 }), 'ok');
  assert.equal(evaluarPaginas({ paginas: 2, ultima: 0.25 }), 'limite');
  assert.equal(evaluarPaginas({ paginas: 2, ultima: 0.26 }), 'largo');
  assert.equal(evaluarPaginas({ paginas: 3, ultima: 0.1 }), 'largo');
});

test('si el CV no entra en una hoja, se pide acortarlo y se vuelve a medir', async () => {
  const medidas = [{ paginas: 2, ultima: 0.6 }, { paginas: 1, ultima: 0.8 }];
  const ia = iaFalsa([resultadoEjemplo(), revisionEjemplo(), { cv: { ...CV_ES, eventos_y_cursos: [] } }]);
  const r = await generarPostulacion({ ...base, conGuia: true, llamarFn: ia, medirFn: async () => medidas.shift() });
  assert.equal(ia.llamadas, 3);
  assert.equal(r.paginas.cantidad, 1);
  assert.equal(r.controles.avisos.length, 0);
});

test('la segunda hoja con 1/4 o menos se acepta y se avisa como caso límite, sin acortar', async () => {
  const ia = iaFalsa([resultadoEjemplo(), revisionEjemplo()]);
  const r = await generarPostulacion({ ...base, conGuia: true, llamarFn: ia, medirFn: async () => ({ paginas: 2, ultima: 0.2 }) });
  assert.equal(ia.llamadas, 2);
  assert.ok(r.controles.avisos.some((a) => /Caso límite/.test(a)));
});

test('una carta que menciona lo que falta se detecta como frase prohibida', async () => {
  const sucia = revisionEjemplo();
  sucia.carta.cuerpo += ' No tengo experiencia con Go.';
  const r = await generarPostulacion({ ...base, conGuia: true, llamarFn: iaFalsa([resultadoEjemplo(), sucia, sucia]) });
  assert.ok(r.controles.frasesProhibidas.some((h) => h.frase === 'no tengo experiencia'));
});
