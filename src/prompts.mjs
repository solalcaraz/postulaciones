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
const guiaPedida = (conGuia) => bloque('guia_de_entrevista_pedida', conGuia ? 'sí' : 'no. No generes preparacion_entrevista: ese campo no existe en la respuesta.');
const cierre = 'Respondé únicamente con el JSON que pide el esquema.';

export async function pasoIdiomas({ cv, oferta }) {
  const instrucciones = await leer('prompts/05-idiomas.md');
  return [bloque('instrucciones', instrucciones), bloque('cv', cv), bloque('oferta', oferta), cierre].join('\n\n');
}

export async function pasoGeneracion({ oferta, infoEmpresa, cv, perfil, idiomaSalida, niveles, conGuia = false }) {
  const instrucciones = (await Promise.all(['00-comun', '01-analisis-reclutador', '02-cv', '03-carta'].map(n => leer(`prompts/${n}.md`)))).join('\n\n---\n\n');
  return [
    bloque('instrucciones', instrucciones),
    bloque('guia_de_nivel', await guiaDeNivel(niveles[idiomaSalida])),
    bloque('idioma_de_salida', idiomaSalida),
    guiaPedida(conGuia),
    bloque('niveles_confirmados', textoNiveles(niveles)),
    bloque('oferta', oferta),
    bloque('info_empresa', infoEmpresa || 'No hay información extra de la empresa.'),
    bloque('cv', cv),
    bloque('perfil', perfil),
    cierre,
  ].join('\n\n');
}

export async function pasoRevision({ resultado, cv, perfil, oferta, infoEmpresa, idiomaSalida, niveles, conGuia = false }) {
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
    conGuia ? bloque('guia', JSON.stringify(guia, null, 2)) : guiaPedida(false),
    bloque('cv_original', cv),
    bloque('perfil', perfil),
    bloque('oferta', oferta),
    bloque('info_empresa', infoEmpresa || 'No hay información extra de la empresa.'),
    cierre,
  ].join('\n\n');
}

// Cuando el CV no entra en una hoja: se le dice cuánto ocupa y se le pide que lo acorte.
export async function pasoAcortar({ cv, medida }) {
  const ocupa = medida.paginas === 1 ? 'una página' : `${medida.paginas} páginas, y la última está llena en un ${Math.round(medida.ultima * 100)} %`;
  return [bloque('instrucciones', await leer('prompts/06-acortar.md')), bloque('medida', `El CV ocupa ${ocupa}.`), bloque('cv', JSON.stringify(cv, null, 2)), cierre].join('\n\n');
}
