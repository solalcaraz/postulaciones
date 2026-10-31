// Cálculos de la medición a partir de datos-privados/mediciones/registro.json: tabla, resultados finales y porcentaje de edición.
// No usa IA ni guarda nada nuevo; lo usa scripts/medicion.mjs para completar docs/metricas.md.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import mammoth from 'mammoth';

const coma = (n, decimales) => n.toFixed(decimales).replace('.', ',');
const fechaCorta = (iso) => iso.slice(0, 10).split('-').reverse().join('/');

export function mediana(valores) {
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

// Qué porcentaje de las palabras cambió entre el texto generado y el que se mandó: 100 × (1 − 2 × palabras en común / total de palabras de ambos).
// "En común" es la subsecuencia más larga de palabras que se conserva en el mismo orden.
export function porcentajeCambiado(original, nuevo) {
  const a = original.split(/\s+/).filter(Boolean);
  const b = nuevo.split(/\s+/).filter(Boolean);
  if (!a.length && !b.length) return 0;
  let anterior = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const actual = [0];
    for (let j = 1; j <= b.length; j++) actual[j] = a[i - 1] === b[j - 1] ? anterior[j - 1] + 1 : Math.max(anterior[j], actual[j - 1]);
    anterior = actual;
  }
  return 100 * (1 - (2 * anterior[b.length]) / (a.length + b.length));
}

// Si en la carpeta de la postulación está enviado.docx (el CV que se mandó de verdad), lo compara con el generado. Si no, devuelve null.
export async function porcentajeEdicion(carpeta) {
  let archivos;
  try { archivos = await readdir(carpeta); } catch { return null; }
  const generado = archivos.find((a) => a.endsWith('.docx') && a !== 'enviado.docx');
  if (!archivos.includes('enviado.docx') || !generado) return null;
  const texto = async (nombre) => (await mammoth.extractRawText({ path: join(carpeta, nombre) })).value;
  return porcentajeCambiado(await texto(generado), await texto('enviado.docx'));
}

const columnas = ['#', 'Fecha', 'Puesto', 'Idioma', 'Min.', 'Costo (USD)', 'Páginas', 'Palabras de la carta', 'Frases prohibidas', 'Datos nuevos', 'Edité (sugerencias aplicadas)', 'Edición del Word (% de palabras)', 'Enviada', 'Respuesta'];

// `ediciones` es un objeto { id: porcentaje } con las postulaciones que tienen enviado.docx.
export function tablaRegistro(entradas, ediciones = {}) {
  const filas = entradas.map((e) => [
    e.id, fechaCorta(e.fecha), e.puesto ?? '', e.idioma ?? '', coma(e.segundos / 60, 1), coma(e.costoEstimadoUsd, 2), e.paginas, e.palabrasCarta, e.frasesProhibidas, e.datosNuevos,
    `${e.aplicadas ?? '_'}/${e.sugerencias ?? '_'}`, e.id in ediciones ? `${Math.round(ediciones[e.id])} %` : '', e.enviada ? fechaCorta(e.enviada) : '', e.respuesta ?? '',
  ]);
  return [columnas, columnas.map(() => '---'), ...filas].map((f) => `| ${f.join(' | ')} |`).join('\n');
}

const rango = (valores, decimales) => `${coma(mediana(valores), decimales)} (de ${coma(Math.min(...valores), decimales)} a ${coma(Math.max(...valores), decimales)})`;

export function resultados(entradas, ediciones = {}) {
  const n = entradas.length;
  if (!n) return '| Medida | Resultado |\n|---|---|\n| Postulaciones hechas con la herramienta | 0 |';
  const de = (cuantas) => `${cuantas} de ${n}`;
  const enviadas = entradas.filter((e) => e.enviada);
  const conAplicadas = entradas.filter((e) => e.aplicadas !== null && e.aplicadas !== undefined);
  const porcentajes = Object.values(ediciones);
  const fechas = entradas.map((e) => fechaCorta(e.fecha));
  const filas = [
    ['Postulaciones hechas con la herramienta', n],
    ['Ventana', fechas[0] === fechas[n - 1] ? fechas[0] : `del ${fechas[0]} al ${fechas[n - 1]}`],
    ['Minutos de generación (mediana y rango)', rango(entradas.map((e) => e.segundos / 60), 1)],
    ['Costo estimado por postulación en USD (mediana y rango)', rango(entradas.map((e) => e.costoEstimadoUsd), 2)],
    ['CV que entraron en 1 página', de(entradas.filter((e) => e.paginas === 1).length)],
    ['Cartas dentro de 200 a 280 palabras', de(entradas.filter((e) => e.palabrasCarta >= 200 && e.palabrasCarta <= 280).length)],
    ['Postulaciones con datos nuevos marcados por el control', de(entradas.filter((e) => e.datosNuevos > 0).length)],
    ['Sugerencias aplicadas', conAplicadas.length ? `${conAplicadas.reduce((s, e) => s + e.aplicadas, 0)} de ${conAplicadas.reduce((s, e) => s + e.sugerencias, 0)} (en ${conAplicadas.length} postulaciones cargadas)` : 'sin cargar'],
    ['Edición del Word (promedio de palabras cambiadas)', porcentajes.length ? `${Math.round(porcentajes.reduce((s, p) => s + p, 0) / porcentajes.length)} % (en ${porcentajes.length} postulaciones con enviado.docx)` : 'sin datos'],
    ['Enviadas', de(enviadas.length)],
    ['Con respuesta positiva', de(entradas.filter((e) => e.respuesta === 'positiva').length)],
    ['Con respuesta negativa', de(entradas.filter((e) => e.respuesta === 'negativa').length)],
    ['Enviadas sin respuesta todavía', de(enviadas.filter((e) => !e.respuesta).length)],
  ];
  return ['| Medida | Resultado |', '|---|---|', ...filas.map(([medida, valor]) => `| ${medida} | ${valor} |`)].join('\n');
}
