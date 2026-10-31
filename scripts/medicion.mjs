// Completa docs/metricas.md con los datos de la medición: node scripts/medicion.mjs  (o npm run medicion)
// Lee datos-privados/mediciones/registro.json y reemplaza lo que hay entre las marcas <!-- registro:inicio --> y <!-- resultados:inicio --> de ese archivo.
// Si en la carpeta de una postulación dejás el CV que mandaste de verdad como enviado.docx, calcula cuánto cambió respecto del generado.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { porcentajeEdicion, tablaRegistro, resultados } from '../src/medicion-resumen.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const mediciones = join(RAIZ, 'datos-privados', 'mediciones');
const doc = join(RAIZ, 'docs', 'metricas.md');

let entradas;
try { entradas = JSON.parse(await readFile(join(mediciones, 'registro.json'), 'utf8')); } catch {
  console.error('No hay datos-privados/mediciones/registro.json: el modo medición todavía no guardó nada.');
  process.exit(1);
}

const ediciones = {};
for (const e of entradas) {
  const porcentaje = await porcentajeEdicion(join(mediciones, e.id));
  if (porcentaje !== null) ediciones[e.id] = porcentaje;
}

const reemplazar = (texto, nombre, contenido) => {
  const inicio = `<!-- ${nombre}:inicio -->`;
  const fin = `<!-- ${nombre}:fin -->`;
  const desde = texto.indexOf(inicio);
  const hasta = texto.indexOf(fin);
  if (desde < 0 || hasta < desde) throw new Error(`Faltan las marcas ${inicio} y ${fin} en docs/metricas.md.`);
  return `${texto.slice(0, desde + inicio.length)}\n${contenido}\n${texto.slice(hasta)}`;
};

let texto = await readFile(doc, 'utf8');
texto = reemplazar(texto, 'resultados', resultados(entradas, ediciones));
texto = reemplazar(texto, 'registro', tablaRegistro(entradas, ediciones));
await writeFile(doc, texto, 'utf8');
console.log(`docs/metricas.md completado con ${entradas.length} postulaciones (${Object.keys(ediciones).length} con enviado.docx).`);
