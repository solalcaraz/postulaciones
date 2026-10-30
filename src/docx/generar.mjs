// Genera el CV en Word (.docx) editable y apto para filtros automáticos (ATS):
// una columna, títulos de sección estándar, sin tablas, imágenes ni cuadros de texto, y con estilos reales de Word.
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, BorderStyle } from 'docx';

const TITULOS = {
  es: { resumen: 'Resumen profesional', experiencia: 'Experiencia', proyectos: 'Proyectos', formacion: 'Formación', habilidades: 'Habilidades', idiomas: 'Idiomas', eventos: 'Eventos y cursos' },
  en: { resumen: 'Professional summary', experiencia: 'Experience', proyectos: 'Projects', formacion: 'Education', habilidades: 'Skills', idiomas: 'Languages', eventos: 'Events and courses' },
};
const FUENTE = 'Calibri';
const LINEAS_POR_PAGINA = 52;
const CARACTERES_POR_LINEA = 105;

export function nombreDeArchivo(nombre, empresa, idioma) {
  const limpiar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return ['CV', limpiar(nombre), limpiar(empresa), idioma].filter(Boolean).join('-') + '.docx';
}

export async function generarCv({ cv, contacto = {}, celular = '', idioma = 'es' }) {
  const t = TITULOS[idioma] ?? TITULOS.es;
  const parrafos = [];
  let lineas = 0;
  const contar = (texto, extra = 0) => { lineas += Math.max(1, Math.ceil(String(texto).length / CARACTERES_POR_LINEA)) + extra; };

  const texto = (contenido, opciones = {}) => new TextRun({ text: contenido, font: FUENTE, ...opciones });
  const agregar = (opciones, ...runs) => parrafos.push(new Paragraph({ ...opciones, children: runs }));
  const seccion = (titulo) => {
    agregar({ heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '808080', space: 1 } } }, texto(titulo));
    contar(titulo, 1);
  };
  const entrada = (titulo, detalle) => {
    agregar({ heading: HeadingLevel.HEADING_2, spacing: { before: 100, after: 0 }, keepNext: true }, texto(titulo));
    contar(titulo);
    if (detalle) { agregar({ spacing: { after: 20 }, keepNext: true }, texto(detalle, { color: '404040' })); contar(detalle); }
  };
  const viñeta = (contenido) => {
    agregar({ numbering: { reference: 'vinetas', level: 0 }, spacing: { after: 20 } }, texto(contenido));
    contar(contenido);
  };

  // Encabezado: nombre, título y contacto, todo en texto común (lo que mejor leen los ATS).
  if (contacto.nombre) { agregar({ heading: HeadingLevel.TITLE, spacing: { after: 20 } }, texto(contacto.nombre)); contar(contacto.nombre, 1); }
  if (cv.titulo) { agregar({ spacing: { after: 40 } }, texto(cv.titulo, { bold: true, size: 24 })); contar(cv.titulo); }
  const datos = [contacto.ubicacion, contacto.email, celular?.trim() || null, contacto.linkedin, contacto.github, contacto.portfolio].filter(Boolean);
  if (datos.length) { agregar({ spacing: { after: 60 } }, texto(datos.join('  |  '))); contar(datos.join('  |  ')); }

  if (cv.resumen) { seccion(t.resumen); agregar({ spacing: { after: 40 } }, texto(cv.resumen)); contar(cv.resumen); }

  if (cv.proyectos?.length) {
    seccion(t.proyectos);
    for (const p of cv.proyectos) {
      entrada(p.nombre, [p.encabezado, p.fecha].filter(Boolean).join(' · '));
      if (p.enlaces?.length) { agregar({ spacing: { after: 20 } }, texto(p.enlaces.join(' · '), { color: '404040' })); contar(p.enlaces.join(' · ')); }
      p.puntos.forEach(viñeta);
    }
  }
  if (cv.experiencia?.length) {
    seccion(t.experiencia);
    for (const e of cv.experiencia) {
      entrada(e.puesto, [e.organizacion, e.lugar_y_modalidad, e.fechas].filter(Boolean).join(' · '));
      e.puntos.forEach(viñeta);
    }
  }
  if (cv.formacion?.length) {
    seccion(t.formacion);
    for (const f of cv.formacion) viñeta([f.titulo, f.institucion, f.estado_y_fechas].filter(Boolean).join(' · '));
  }
  if (cv.habilidades?.length) {
    seccion(t.habilidades);
    for (const h of cv.habilidades) {
      agregar({ spacing: { after: 20 } }, texto(`${h.categoria}: `, { bold: true }), texto(h.items.join(', ')));
      contar(`${h.categoria}: ${h.items.join(', ')}`);
    }
  }
  if (cv.idiomas?.length) {
    seccion(t.idiomas);
    agregar({}, texto(cv.idiomas.map((i) => `${i.idioma}: ${i.nivel}`).join('  |  ')));
    contar('x');
  }
  if (cv.eventos_y_cursos?.length) { seccion(t.eventos); cv.eventos_y_cursos.forEach(viñeta); }

  const documento = new Document({
    creator: contacto.nombre || 'CV',
    title: `CV - ${contacto.nombre || ''}`.trim(),
    styles: {
      default: { document: { run: { font: FUENTE, size: 21 } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: FUENTE, size: 40, bold: true }, paragraph: { spacing: { after: 20 } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FUENTE, size: 24, bold: true, allCaps: true }, paragraph: { keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FUENTE, size: 22, bold: true }, paragraph: { keepNext: true } },
      ],
    },
    numbering: { config: [{ reference: 'vinetas', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
    sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 1000, right: 1000 } } }, children: parrafos }],
  });

  return { buffer: await Packer.toBuffer(documento), paginasEstimadas: Math.max(1, Math.ceil(lineas / LINEAS_POR_PAGINA)) };
}
