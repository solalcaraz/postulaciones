// Flujo completo de una postulación. No guarda nada: recibe textos y devuelve resultados en memoria.
import { llamar, ErrorIA } from './ia.mjs';
import { idiomasSchema, resultadoSchema, revisionSchema } from './esquema/index.mjs';
import { pasoIdiomas, pasoGeneracion, pasoRevision } from './prompts.mjs';
import { validar } from './validacion/esquema.mjs';
import { listaNegra, datosNuevos, textosConUbicacion } from './validacion/controles.mjs';
import { leerContacto } from './lectura/contacto.mjs';
import { generarCv, nombreDeArchivo } from './docx/generar.mjs';

// Llama a la IA y valida la respuesta. Si viene mal, un reintento diciéndole qué falló; si falla de nuevo, error claro.
export async function llamarValidado({ prompt, esquema, llamarFn = llamar }) {
  let aviso = '';
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const r = await llamarFn({ prompt: prompt + aviso, esquema });
      const v = validar(esquema, r.resultado);
      if (v.ok) return { ...r, intentos: intento };
      aviso = `\n\nTu respuesta anterior no cumplió el esquema (${v.errores.slice(0, 5).join('; ')}). Respondé de nuevo cumpliéndolo.`;
    } catch (e) {
      if (e instanceof ErrorIA && e.tipo === 'formato' && intento === 1) {
        aviso = '\n\nTu respuesta anterior no fue un JSON válido. Respondé únicamente con el JSON pedido por el esquema.';
        continue;
      }
      throw e;
    }
  }
  throw new ErrorIA('La IA devolvió dos veces una respuesta con formato roto. Probá de nuevo; si sigue pasando, avisame.', 'formato');
}

// Llamada 1: idiomas del CV y de la oferta. La pantalla se los muestra a la candidata para que los confirme.
export const detectarIdiomas = ({ cv, oferta, llamarFn }) =>
  pasoIdiomas({ cv, oferta }).then((prompt) => llamarValidado({ prompt, esquema: idiomasSchema, llamarFn }));

const formatearGuia = (guia) => guia.map((q, i) =>
  `${i + 1}. ${q.pregunta}\n   Por qué es probable: ${q.por_que_es_probable}\n   Con qué responder: ${q.con_que_responder}\n   Evitá: ${q.evitar}\n   Si no lo hiciste: ${q.si_no_lo_hiciste}`).join('\n\n');

// Llamadas 2 y 3, controles con código y generación del .docx.
export async function generarPostulacion({ cv, oferta, perfil, infoEmpresa = '', idiomaSalida, niveles, celular = '', empresa = '', llamarFn, alPaso = () => {} }) {
  const contacto = leerContacto(perfil);
  if (!contacto.nombre) throw new ErrorIA('El perfil no tiene el nombre completo en la sección de contacto.', 'perfil');
  let costo = 0;

  alPaso('Analizando la oferta y escribiendo el CV, la carta y la guía…');
  const generado = await llamarValidado({ prompt: await pasoGeneracion({ oferta, infoEmpresa, cv, perfil, idiomaSalida, niveles }), esquema: resultadoSchema, llamarFn });
  costo += generado.costoEstimadoUsd;
  const resultado = generado.resultado;

  const revisar = async (borrador, nota = '') => {
    const prompt = (await pasoRevision({ resultado: borrador, cv, perfil, oferta, infoEmpresa, idiomaSalida, niveles })) + nota;
    const r = await llamarValidado({ prompt, esquema: revisionSchema, llamarFn });
    costo += r.costoEstimadoUsd;
    return r.resultado;
  };
  const textosFinales = (rev) => textosConUbicacion({ cv: rev.cv, carta: rev.carta, guia: rev.preparacion_entrevista });

  alPaso('Revisando que el texto no suene a generado…');
  let revision = await revisar(resultado);
  let prohibidas = await listaNegra(textosFinales(revision), idiomaSalida);
  if (prohibidas.length) {
    // Control con código: si quedó alguna frase prohibida, un reintento sobre esa parte.
    alPaso('Quedaron frases prohibidas: pidiendo una segunda revisión…');
    const lista = prohibidas.map((h) => `"${h.frase}" en ${h.donde}`).join('; ');
    revision = await revisar(revision, `\n\nAtención: siguen apareciendo frases prohibidas (${lista}). Reescribí esas partes sin cambiar los hechos.`);
    prohibidas = await listaNegra(textosFinales(revision), idiomaSalida);
  }

  const nuevos = datosNuevos(textosFinales(revision), [cv, perfil, oferta, infoEmpresa], { contacto });
  const docx = await generarCv({ cv: revision.cv, contacto, celular, idioma: idiomaSalida });
  const palabrasCarta = revision.carta.cuerpo.trim().split(/\s+/).length;
  const avisos = [];
  if (docx.paginasEstimadas > 2) avisos.push(`El CV ocuparía unas ${docx.paginasEstimadas} páginas (estimación): conviene acortarlo a 2.`);
  if (palabrasCarta < 150 || palabrasCarta > 220) avisos.push(`La carta tiene ${palabrasCarta} palabras: el objetivo es de 150 a 220.`);

  return {
    analisis: resultado.analisis,
    cv: revision.cv,
    carta: revision.carta,
    cartaTexto: `${revision.carta.saludo}\n\n${revision.carta.cuerpo}\n\n${revision.carta.firma}`,
    guiaTexto: formatearGuia(revision.preparacion_entrevista),
    cambios: revision.cambios,
    sinArreglar: revision.sin_arreglar,
    controles: { frasesProhibidas: prohibidas, datosNuevos: nuevos, avisos },
    docx: { buffer: docx.buffer, nombre: nombreDeArchivo(contacto.nombre, empresa, idiomaSalida), paginasEstimadas: docx.paginasEstimadas },
    palabrasCarta,
    costoEstimadoUsd: costo,
  };
}
