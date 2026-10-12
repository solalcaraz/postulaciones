// Datos de ejemplo INVENTADOS y ayudas para las pruebas. Nada de esto es de una persona real.
import { inflateRawSync } from 'node:zlib';

export const PERFIL = `# Perfil de candidata — Ana Ejemplo

## 1. Contacto
- **Nombre completo:** Ana Ejemplo
- **Email profesional:** ana@ejemplo.com
- **Ciudad y provincia:** Rosario, Santa Fe
- **LinkedIn:** linkedin.com/in/ana-ejemplo
- **GitHub:** github.com/anaejemplo
- **Portfolio:** todavía no existe. No se incluye hasta que haya URL.
- **Celular:** no se guarda acá.

## 2. Cómo me presento
Desarrolladora Full Stack.

## 5. Proyectos
### Tienda de ejemplo
- Armé la tienda con Kotlin y PostgreSQL. Trabajo en equipo de 4. Pasamos de 10 a 25 tests.
`;

export const CV_TEXTO = 'Ana Ejemplo. Desarrolladora Full Stack. Kotlin, PostgreSQL, React. Tienda de ejemplo: trabajo en equipo de 4, pasamos de 10 a 25 tests. Español nativo, inglés B1. '.repeat(3);
export const OFERTA = 'Buscamos una persona con Kotlin y PostgreSQL para sumarse a un equipo chico. Escribir a rrhh@empresa.com.';

export const CV_ES = {
  titulo: 'Desarrolladora Full Stack',
  resumen: 'Armo APIs en Kotlin y PostgreSQL. Trabajé en un proyecto de equipo de 4 personas.',
  experiencia: [{ puesto: 'Operadora telefónica', organizacion: 'Banco Ejemplo', lugar_y_modalidad: 'Remoto', fechas: 'Ene 2026 – Mar 2026', puntos: ['Atendí consultas de clientes por teléfono.', 'Registré cada consulta en sistemas internos.'] }],
  proyectos: [{ nombre: 'Tienda de ejemplo', encabezado: 'Trabajo en equipo de 4 · Kotlin, PostgreSQL', fecha: 'Mar 2026 – Jun 2026', enlaces: ['github.com/anaejemplo/tienda'], puntos: ['Armé el carrito de compras con Kotlin.', 'Pasamos de 10 a 25 tests.'] }],
  formacion: [{ titulo: 'Tecnicatura en Programación', institucion: 'Universidad Ejemplo', estado_y_fechas: 'Título en trámite' }],
  habilidades: [{ categoria: 'Lenguajes', items: ['Kotlin', 'Python'] }, { categoria: 'Bases de datos', items: ['PostgreSQL'] }],
  idiomas: [{ idioma: 'Español', nivel: 'Nativo' }, { idioma: 'Inglés', nivel: 'B1' }],
  eventos_y_cursos: [],
};

export const CARTA = {
  saludo: 'Hola, ¿qué tal?',
  cuerpo: Array.from({ length: 170 }, (_, i) => `palabra${i}`).join(' '),
  firma: 'Ana Ejemplo',
};

const PREGUNTA = { pregunta: '¿Qué hiciste?', por_que_es_probable: 'Es un filtro.', con_que_responder: 'La tienda de ejemplo.', evitar: 'Exagerar.', si_no_lo_hiciste: 'Decilo.' };

export const ANALISIS = {
  lectura_de_la_oferta: { filtros: ['Kotlin'], deseables: [], lo_que_se_busca_de_verdad: ['Autonomía'] },
  titulo_elegido: { titulo: 'Desarrolladora Full Stack', motivo: 'La oferta es de desarrollo.' },
  requisitos: [{ texto: 'Kotlin', tipo: 'filtro', puntaje: 3, cita_del_cv: 'Kotlin, PostgreSQL, React', justificacion: 'Lo usó.' }],
  decisiones_del_cv: { prioriza: ['Tienda de ejemplo'], deja_afuera: [], orden: ['Proyectos'] },
  no_cubierto: [],
  alertas: [],
};

export const resultadoEjemplo = () => structuredClone({ analisis: ANALISIS, cv: CV_ES, carta: CARTA, preparacion_entrevista: [PREGUNTA] });
export const revisionEjemplo = () => structuredClone({ cv: CV_ES, carta: CARTA, preparacion_entrevista: [PREGUNTA], cambios: ['Sin cambios.'], sin_arreglar: [] });

// Simula la IA: devuelve las respuestas en orden y cuenta las llamadas.
export function iaFalsa(respuestas) {
  const cola = [...respuestas];
  const fn = async () => {
    fn.llamadas++;
    const siguiente = cola.shift();
    if (siguiente instanceof Error) throw siguiente;
    return { resultado: siguiente, costoEstimadoUsd: 0.1, duracionMs: 1 };
  };
  fn.llamadas = 0;
  return fn;
}

// Lee un archivo de adentro de un .docx (que es un zip) sin dependencias.
export function leerEntradaZip(buffer, nombre) {
  let fin = buffer.length - 22;
  while (fin >= 0 && buffer.readUInt32LE(fin) !== 0x06054b50) fin--;
  let pos = buffer.readUInt32LE(fin + 16);
  for (let i = 0; i < buffer.readUInt16LE(fin + 10); i++) {
    const metodo = buffer.readUInt16LE(pos + 10);
    const tamano = buffer.readUInt32LE(pos + 20);
    const largoNombre = buffer.readUInt16LE(pos + 28);
    const extra = buffer.readUInt16LE(pos + 30) + buffer.readUInt16LE(pos + 32);
    const local = buffer.readUInt32LE(pos + 42);
    if (buffer.toString('utf8', pos + 46, pos + 46 + largoNombre) === nombre) {
      const inicio = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const datos = buffer.subarray(inicio, inicio + tamano);
      return (metodo === 8 ? inflateRawSync(datos) : datos).toString('utf8');
    }
    pos += 46 + largoNombre + extra;
  }
  return null;
}

export const IDIOMAS = {
  cv_idiomas: [{ idioma: 'Español', nivel_en_el_cv: 'Nativo', nivel_cefr: 'nativo', cita: 'Español: Nativo' }, { idioma: 'Inglés', nivel_en_el_cv: 'intermedio', nivel_cefr: 'no_figura', cita: 'Inglés: intermedio' }],
  oferta: { idioma_detectado: 'es', idiomas_requeridos: [{ idioma: 'Inglés', nivel_pedido: 'avanzado', excluyente: true, cita: 'Inglés avanzado' }] },
};

// Simula la IA según el esquema que le piden; `espera` demora la respuesta y `error` simula una falla del servicio.
export function iaPorEsquema({ espera = 0, error = null } = {}) {
  return async ({ esquema }) => {
    if (espera) await new Promise((r) => setTimeout(r, espera));
    if (error) throw error;
    const resultado = esquema.properties.cv_idiomas ? IDIOMAS : esquema.properties.analisis ? resultadoEjemplo() : revisionEjemplo();
    return { resultado: structuredClone(resultado), costoEstimadoUsd: 0.1, duracionMs: 1 };
  };
}
