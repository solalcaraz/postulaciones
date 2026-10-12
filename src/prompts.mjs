// Arma el texto de cada llamada a partir de los archivos de /prompts y de los datos de la postulación.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (ruta) => readFile(join(RAIZ, ruta), 'utf8');
const bloque = (etiqueta, contenido) => `<${etiqueta}>\n${String(contenido).trim()}\n</${etiqueta}>`;

// De la guía por nivel se incluyen solo las reglas generales y la sección del nivel confirmado.
async function guiaDeNivel(nivel) {
  const guia = await leer('prompts/niveles-idioma.md');
  const partes = guia.split(/^## /m).slice(1);
  const seccion = (nombre) => partes.find(p => p.startsWith(nombre));
  const clave = { A1: 'A2', C2: 'C1', nativo: 'Nativo' }[nivel] || nivel;
  const nivelSeccion = seccion(clave);
  if (!nivelSeccion) throw new Error(`No hay guía de redacción para el nivel "${nivel}".`);
  return `## ${seccion('Reglas generales')}\n## ${nivelSeccion}`;
}

const textoNiveles = (niveles) => Object.entries(niveles).map(([idioma, nivel]) => `${idioma}: ${nivel}`).join('\n');
const cierre = 'Respondé únicamente con el JSON que pide el esquema.';

export async function pasoIdiomas({ cv, oferta }) {
  const instrucciones = await leer('prompts/05-idiomas.md');
  return [bloque('instrucciones', instrucciones), bloque('cv', cv), bloque('oferta', oferta), cierre].join('\n\n');
}

// `fundir` hace la revisión anti-IA dentro de la misma llamada que escribe (variante de 2 llamadas en lugar de 3).
export async function pasoGeneracion({ oferta, infoEmpresa, cv, perfil, idiomaSalida, niveles, fundir = false }) {
  const archivos = ['00-comun', '01-analisis-reclutador', '02-cv', '03-carta'];
  if (fundir) archivos.push('04-revision-anti-ia');
  let instrucciones = (await Promise.all(archivos.map(n => leer(`prompts/${n}.md`)))).join('\n\n---\n\n');
  const extras = [];
  if (fundir) {
    instrucciones += '\n\n---\n\n## En esta llamada también hacés la revisión anti-IA\nEscribí `cv`, `carta` y `preparacion_entrevista` y, **antes de responder**, revisalos con las reglas del prompt 04. En esta llamada, `<cv_generado>`, `<carta>` y `<guia>` son tu propio borrador, y `<cv_original>` es `<cv>`. Devolvé ya los textos revisados y completá `cambios[]` y `sin_arreglar[]`.';
    extras.push(bloque('lista_de_muletillas', await leer(idiomaSalida === 'en' ? 'prompts/listas/muletillas-en.md' : 'prompts/listas/muletillas-es.md')));
    extras.push(bloque('palabras_simples', await leer('prompts/listas/palabras-simples.md')));
  }
  return [
    bloque('instrucciones', instrucciones),
    ...extras,
    bloque('guia_de_nivel', await guiaDeNivel(niveles[idiomaSalida])),
    bloque('idioma_de_salida', idiomaSalida),
    bloque('niveles_confirmados', textoNiveles(niveles)),
    bloque('oferta', oferta),
    bloque('info_empresa', infoEmpresa || 'No hay información extra de la empresa.'),
    bloque('cv', cv),
    bloque('perfil', perfil),
    cierre,
  ].join('\n\n');
}

export async function pasoRevision({ resultado, cv, perfil, idiomaSalida, niveles }) {
  const instrucciones = (await Promise.all(['00-comun', '04-revision-anti-ia'].map(n => leer(`prompts/${n}.md`)))).join('\n\n---\n\n');
  const listaIdioma = await leer(idiomaSalida === 'en' ? 'prompts/listas/muletillas-en.md' : 'prompts/listas/muletillas-es.md');
  const simples = await leer('prompts/listas/palabras-simples.md');
  const { cv: cvGenerado, carta, preparacion_entrevista: guia } = resultado;
  return [
    bloque('instrucciones', instrucciones),
    bloque('lista_de_muletillas', listaIdioma),
    bloque('palabras_simples', simples),
    bloque('guia_de_nivel', await guiaDeNivel(niveles[idiomaSalida])),
    bloque('idioma_de_salida', idiomaSalida),
    bloque('niveles_confirmados', textoNiveles(niveles)),
    bloque('cv_generado', JSON.stringify(cvGenerado, null, 2)),
    bloque('carta', JSON.stringify(carta, null, 2)),
    bloque('guia', JSON.stringify(guia, null, 2)),
    bloque('cv_original', cv),
    bloque('perfil', perfil),
    cierre,
  ].join('\n\n');
}
