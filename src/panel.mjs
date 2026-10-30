// Panel de análisis en texto (Markdown). La pantalla de la Fase 4 va a mostrar lo mismo con otro formato.
const lista = (items) => (items.length ? items.map((i) => `- ${i}`).join('\n') : '- (nada)');

const ROTULO = { titulo: 'Título sugerido', tecnologia: 'Tecnología sugerida', brecha: 'Brecha' };
export const textoSugerencia = (s) => `**${ROTULO[s.tipo]}:** ${s.sugerido}. ${s.motivo}${s.respaldo ? ` Respaldo: ${s.respaldo}` : ''}`;

export function renderPanel(r) {
  const a = r.analisis;
  const c = r.controles;
  return [
    '# Panel de análisis', '',
    `**Título del CV:** ${a.titulo_elegido.titulo}`, `*${a.titulo_elegido.motivo}*`, '',
    '## Requisitos de la oferta',
    ...a.requisitos.map((q) => `- [${q.puntaje}/3] (${q.tipo}) ${q.texto}\n  - cita: ${q.cita_del_cv || '—'}\n  - ${q.justificacion}`), '',
    '## No cubierto', lista(a.no_cubierto), '',
    '## Sugerencias (no se aplicaron al CV)', lista(a.sugerencias.map(textoSugerencia)), '',
    '## Alertas', lista(a.alertas.map((x) => `**${x.tipo}:** ${x.detalle}`)), '',
    '## Qué priorizó y qué dejó afuera',
    `**Prioriza:**\n${lista(a.decisiones_del_cv.prioriza)}`,
    `**Deja afuera:**\n${lista(a.decisiones_del_cv.deja_afuera.map((d) => `${d.elemento}: ${d.motivo}`))}`, '',
    '## Qué corrigió la revisión', lista(r.cambios), '',
    '### Sin arreglar', lista(r.sinArreglar), '',
    '## Controles automáticos',
    `**Frases prohibidas que siguen en el texto:**\n${lista(c.frasesProhibidas.map((h) => `"${h.frase}" en ${h.donde}`))}`,
    `**Datos que no están en el CV, el perfil ni la oferta (revisalos):**\n${lista(c.datosNuevos.map((d) => `${d.tipo} "${d.valor}" en ${d.donde}`))}`,
    `**Avisos:**\n${lista(c.avisos)}`, '',
  ].join('\n');
}
