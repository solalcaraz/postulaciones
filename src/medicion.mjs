// Modo medición: guarda cada postulación durante un tiempo limitado para poder armar las métricas (ver docs/metricas.md).
// Se prende creando datos-privados/medicion.json con {"objetivo": 30}. Guarda hasta llegar al objetivo y después deja de guardar,
// pero el panel para anotar las respuestas sigue hasta que el archivo tenga "cerrada": true o se borre.
// Todo queda en datos-privados/mediciones/, que git ignora.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderPanel } from './panel.mjs';

export const RESPUESTAS = ['positiva', 'negativa'];

const leerJson = async (ruta) => { try { return JSON.parse(await readFile(ruta, 'utf8')); } catch { return null; } };

export async function estadoMedicion(datos) {
  const config = await leerJson(join(datos, 'medicion.json'));
  const objetivo = Number(config?.objetivo);
  if (!config || !(objetivo > 0) || config.cerrada === true) return { activa: false, guardando: false, objetivo: 0, hechas: 0, entradas: [] };
  const entradas = (await leerJson(join(datos, 'mediciones', 'registro.json'))) ?? [];
  return { activa: true, guardando: entradas.length < objetivo, objetivo, hechas: entradas.length, entradas };
}

// Las sugerencias aplicables son las de tipo título y tecnología (las brechas no se pueden aplicar).
export const sugerenciasAplicables = (analisis) => analisis.sugerencias.filter((s) => s.tipo !== 'brecha').length;

// El puesto sale de la primera línea de la oferta; se puede corregir a mano en registro.json.
const puestoDeLaOferta = (oferta) => (oferta.split(/\r?\n/).find((l) => l.trim()) ?? '').trim().slice(0, 80);

// Guarda la postulación si el modo medición está prendido y no llegó al objetivo. Devuelve { numero, objetivo } o null.
export async function guardarPostulacion(datos, { resultado: r, oferta, segundos, idioma, empresa = '' }) {
  const estado = await estadoMedicion(datos);
  if (!estado.guardando) return null;
  const numero = estado.hechas + 1;
  const id = String(numero).padStart(3, '0');
  const carpeta = join(datos, 'mediciones', id);
  await mkdir(carpeta, { recursive: true });
  await writeFile(join(carpeta, r.docx.nombre), r.docx.buffer);
  await writeFile(join(carpeta, 'carta.txt'), r.cartaTexto, 'utf8');
  await writeFile(join(carpeta, 'panel.md'), renderPanel(r), 'utf8');
  await writeFile(join(carpeta, 'oferta.txt'), oferta, 'utf8');
  if (r.guiaTexto) await writeFile(join(carpeta, 'entrevista.txt'), r.guiaTexto, 'utf8');
  const entrada = {
    id, fecha: new Date().toISOString(), puesto: puestoDeLaOferta(oferta), empresa, idioma, titulo: r.analisis.titulo_elegido.titulo, archivo: r.docx.nombre,
    segundos, costoEstimadoUsd: r.costoEstimadoUsd, paginas: r.paginas.cantidad, paginasMedidas: r.paginas.medido,
    palabrasCarta: r.palabrasCarta, frasesProhibidas: r.controles.frasesProhibidas.length, datosNuevos: r.controles.datosNuevos.length,
    sugerencias: sugerenciasAplicables(r.analisis), aplicadas: null, enviada: null, respuesta: null,
  };
  await writeFile(join(datos, 'mediciones', 'registro.json'), JSON.stringify([...estado.entradas, entrada], null, 2), 'utf8');
  return { numero, objetivo: estado.objetivo };
}

// Anota lo que pasó después de la postulación. Solo cambia los campos que vienen en `cambios`:
//   respuesta: 'positiva', 'negativa' o null · enviada: 'AAAA-MM-DD' o null · aplicadas: cuántas de las sugerencias aplicó (0 a las que había) o null.
export async function anotarCampos(datos, id, cambios) {
  const estado = await estadoMedicion(datos);
  const entrada = estado.entradas.find((e) => e.id === id);
  if (!estado.activa || !entrada) throw new Error('No encuentro esa postulación en la medición.');
  if ('respuesta' in cambios) {
    if (cambios.respuesta !== null && !RESPUESTAS.includes(cambios.respuesta)) throw new Error('Respuesta no válida.');
    entrada.respuesta = cambios.respuesta;
  }
  if ('enviada' in cambios) {
    const f = cambios.enviada;
    if (f !== null && !(/^\d{4}-\d{2}-\d{2}$/.test(f) && f >= '2020-01-01' && f <= '2100-12-31' && !Number.isNaN(Date.parse(f)))) throw new Error('La fecha de envío no es válida.');
    entrada.enviada = f;
  }
  if ('aplicadas' in cambios) {
    const n = cambios.aplicadas;
    if (n !== null && !(Number.isInteger(n) && n >= 0 && n <= entrada.sugerencias)) throw new Error(`Tiene que ser un número de 0 a ${entrada.sugerencias}.`);
    entrada.aplicadas = n;
  }
  await writeFile(join(datos, 'mediciones', 'registro.json'), JSON.stringify(estado.entradas, null, 2), 'utf8');
  return entrada;
}
