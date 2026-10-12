// Controles hechos con código, sin IA y sin gastar cupo. Son un cinturón de seguridad: no reemplazan las reglas de los prompts.
//   1) Lista negra: frases prohibidas que siguen apareciendo en el texto final.
//   2) Datos nuevos: números, enlaces y términos técnicos del texto final que no figuran en el CV, el perfil ni la oferta.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
let listaCache;
async function cargarLista() {
  listaCache ??= JSON.parse(await readFile(join(RAIZ, 'prompts/listas/prohibidas.json'), 'utf8'));
  return listaCache;
}

// Recorre un objeto y devuelve cada texto con su ubicación (por ejemplo, "cv.proyectos[1].puntos[0]").
export function textosConUbicacion(valor, ruta = '') {
  if (typeof valor === 'string') return [{ ruta, texto: valor }];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => textosConUbicacion(v, `${ruta}[${i}]`));
  if (valor && typeof valor === 'object') return Object.entries(valor).flatMap(([k, v]) => textosConUbicacion(v, ruta ? `${ruta}.${k}` : k));
  return [];
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listaNegra(textos, idioma) {
  const lista = await cargarLista();
  const frases = lista[idioma] ?? [];
  const hallazgos = [];
  for (const { ruta, texto } of textos) {
    for (const frase of frases) {
      if (new RegExp(`(?<![\\p{L}])${escapar(frase)}`, 'iu').test(texto)) hallazgos.push({ frase, donde: ruta });
    }
  }
  return hallazgos;
}

const numeros = (t) => (String(t).match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,](?=\d{3}(?!\d))/g, '').replace(',', '.'));
const enlaces = (t) => (String(t).toLowerCase().match(/(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s),;]*)?/g) ?? [])
  .map((e) => e.replace(/^https?:\/\//, '').replace(/[./]+$/, ''));
// Términos técnicos con forma reconocible: MongoDB, PostgreSQL, JUnit, API, CRUD...
const terminos = (t) => (String(t).match(/\b(?:[A-Z][a-z]+[A-Z][A-Za-z0-9]*|[A-Z]{2,}[a-z]?[A-Za-z0-9]*)\b/g) ?? []);

// `fuentes` son los textos de los que sale todo lo que se puede afirmar: CV, perfil, oferta e información de la empresa.
// Los términos técnicos se revisan solo en el CV y la carta: la guía de entrevista puede nombrar ejemplos (SELECT, UPDATE) como consejo.
export function datosNuevos(textos, fuentes, { contacto = {}, sinTerminosEn = ['guia'] } = {}) {
  const corpus = [...fuentes, ...Object.values(contacto)].join('\n');
  const nums = new Set(numeros(corpus));
  const links = enlaces(corpus);
  const minusculas = corpus.toLowerCase();
  const avisos = [];
  for (const { ruta, texto } of textos) {
    for (const n of new Set(numeros(texto))) if (!nums.has(n)) avisos.push({ tipo: 'número', valor: n, donde: ruta });
    for (const e of new Set(enlaces(texto))) {
      if (!links.some((l) => l === e || l.startsWith(e) || e.startsWith(l))) avisos.push({ tipo: 'enlace', valor: e, donde: ruta });
    }
    if (sinTerminosEn.some((p) => ruta.startsWith(p))) continue;
    for (const t of new Set(terminos(texto))) if (!minusculas.includes(t.toLowerCase())) avisos.push({ tipo: 'término', valor: t, donde: ruta });
  }
  return avisos;
}
