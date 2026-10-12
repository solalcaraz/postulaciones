// Formato de lo que devuelve la IA. Es la fuente de verdad: Claude Code lo usa para validar la respuesta (--json-schema).
// En la Fase 3 se vuelve a validar con código antes de usarla.

const texto = { type: 'string' };
const lista = { type: 'array', items: texto };
const arr = (item) => ({ type: 'array', items: item });
const obj = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const opciones = (...valores) => ({ type: 'string', enum: valores });

const NIVELES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'nativo', 'no_figura'];

// Llamada 1: idiomas del CV y de la oferta (la candidata los confirma en pantalla antes de generar).
export const idiomasSchema = obj({
  cv_idiomas: arr(obj({
    idioma: texto,
    nivel_en_el_cv: texto,
    nivel_cefr: opciones(...NIVELES),
    cita: texto,
  })),
  oferta: obj({
    idioma_detectado: opciones('es', 'en', 'otro'),
    idiomas_requeridos: arr(obj({
      idioma: texto,
      nivel_pedido: texto,
      excluyente: { type: 'boolean' },
      cita: texto,
    })),
  }),
});

const analisis = obj({
  lectura_de_la_oferta: obj({ filtros: lista, deseables: lista, lo_que_se_busca_de_verdad: lista }),
  titulo_elegido: obj({ titulo: texto, motivo: texto }),
  requisitos: arr(obj({
    texto,
    tipo: opciones('filtro', 'deseable'),
    puntaje: { type: 'integer', enum: [0, 1, 2, 3] },
    cita_del_cv: texto,
    justificacion: texto,
  })),
  decisiones_del_cv: obj({
    prioriza: lista,
    deja_afuera: arr(obj({ elemento: texto, motivo: texto })),
    orden: lista,
  }),
  no_cubierto: lista,
  alertas: arr(obj({
    tipo: opciones('idioma', 'contradiccion', 'instruccion_oculta', 'anos_de_experiencia', 'falta_informacion', 'falta_metrica', 'titulo_ajustado', 'otra'),
    detalle: texto,
  })),
});

const cv = obj({
  titulo: texto,
  resumen: texto,
  experiencia: arr(obj({ puesto: texto, organizacion: texto, lugar_y_modalidad: texto, fechas: texto, puntos: lista })),
  proyectos: arr(obj({ nombre: texto, encabezado: texto, fecha: texto, enlaces: lista, puntos: lista })),
  formacion: arr(obj({ titulo: texto, institucion: texto, estado_y_fechas: texto })),
  habilidades: arr(obj({ categoria: texto, items: lista })),
  idiomas: arr(obj({ idioma: texto, nivel: texto })),
  eventos_y_cursos: lista,
});

export const cvSchema = cv;

const carta = obj({ saludo: texto, cuerpo: texto, firma: texto });

const entrevista = arr(obj({
  pregunta: texto,
  por_que_es_probable: texto,
  con_que_responder: texto,
  evitar: texto,
  si_no_lo_hiciste: texto,
}));

// Llamada 2: primero se analiza y después se escribe (el orden de las partes importa).
export const resultadoSchema = obj({ analisis, cv, carta, preparacion_entrevista: entrevista });

// Llamada 3: revisión anti-IA.
export const revisionSchema = obj({ cv, carta, preparacion_entrevista: entrevista, cambios: lista, sin_arreglar: lista });
