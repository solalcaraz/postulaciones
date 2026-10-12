// Lee el texto de un CV en PDF o Word. Todo se hace en memoria: no se escribe nada en disco.
import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';

export const MAX_BYTES = 8 * 1024 * 1024;
const MIN_CARACTERES = 200;

export class ErrorArchivo extends Error {}

const esPdf = (b) => b.length > 4 && b.subarray(0, 4).toString('latin1') === '%PDF';
const esZip = (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b; // un .docx es un zip

const limpiar = (t) => String(t).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export async function leerArchivo(buffer, nombre) {
  if (!buffer?.length) throw new ErrorArchivo('El archivo está vacío.');
  if (buffer.length > MAX_BYTES) throw new ErrorArchivo('El archivo pesa más de 8 MB. Subí un CV más liviano.');
  const extension = String(nombre).toLowerCase().split('.').pop();

  let texto;
  if (extension === 'pdf') {
    if (!esPdf(buffer)) throw new ErrorArchivo('El archivo no es un PDF válido.');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    ({ text: texto } = await extractText(pdf, { mergePages: true }));
  } else if (extension === 'docx') {
    if (!esZip(buffer)) throw new ErrorArchivo('El archivo no es un .docx válido.');
    ({ value: texto } = await mammoth.extractRawText({ buffer }));
  } else {
    throw new ErrorArchivo('Subí un PDF o un archivo de Word (.docx).');
  }

  texto = limpiar(texto);
  if (texto.replace(/\s/g, '').length < MIN_CARACTERES) {
    throw new ErrorArchivo(extension === 'pdf'
      ? 'Este PDF no tiene texto: exportá tu CV como PDF con texto o subí el .docx.'
      : 'Este archivo casi no tiene texto. Revisá que sea el CV correcto.');
  }
  return texto;
}
