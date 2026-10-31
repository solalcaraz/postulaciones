import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerArchivo, ErrorArchivo, MAX_BYTES } from '../src/lectura/archivo.mjs';
import { leerContacto } from '../src/lectura/contacto.mjs';
import { generarCv } from '../src/docx/generar.mjs';
import { CV_ES, PERFIL } from './ayudas.mjs';

// PDF mínimo con una página en blanco: es lo que pasa con un CV escaneado (una imagen, sin texto).
const PDF_SIN_TEXTO = Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R/Size 4>>
%%EOF`);

test('lee el texto de un .docx', async () => {
  const { buffer } = await generarCv({ cv: CV_ES, contacto: { nombre: 'Ana Ejemplo' }, idioma: 'es' });
  const texto = await leerArchivo(buffer, 'cv.docx');
  assert.match(texto, /Ana Ejemplo/);
  assert.match(texto, /Kotlin/);
});

test('un PDF sin texto (escaneado) da un error claro', async () => {
  await assert.rejects(leerArchivo(PDF_SIN_TEXTO, 'cv.pdf'), (e) => e instanceof ErrorArchivo && /no tiene texto/.test(e.message));
});

test('rechaza tipos de archivo no permitidos', async () => {
  await assert.rejects(leerArchivo(Buffer.from('hola'), 'cv.txt'), /PDF o un archivo de Word/);
});

test('rechaza un archivo que dice ser PDF y no lo es', async () => {
  await assert.rejects(leerArchivo(Buffer.from('esto no es un pdf, aunque tenga la extensión'), 'cv.pdf'), /no es un PDF válido/);
});

test('rechaza archivos de más de 8 MB y archivos vacíos', async () => {
  await assert.rejects(leerArchivo(Buffer.alloc(MAX_BYTES + 1), 'cv.pdf'), /8 MB/);
  await assert.rejects(leerArchivo(Buffer.alloc(0), 'cv.pdf'), /vacío/);
});

// PDF mínimo con texto en una página, armado a mano para no depender de ningún archivo personal.
function pdfConTexto(lineas) {
  const contenido = `BT /F1 12 Tf 50 750 Td 14 TL ${lineas.map((l) => `(${l}) Tj T*`).join(' ')} ET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const posiciones = objetos.map((o, i) => { const pos = pdf.length; pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; return pos; });
  const inicioXref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posiciones.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

test('lee el texto de un PDF con texto', async () => {
  const lineas = Array.from({ length: 6 }, (_, i) => `Ana Ejemplo trabajo con Kotlin y PostgreSQL en el proyecto numero ${i + 1} de la tienda.`);
  const texto = await leerArchivo(pdfConTexto(lineas), 'cv.pdf');
  assert.match(texto, /Kotlin y PostgreSQL/);
  assert.match(texto, /numero 6/);
});

test('saca el contacto del perfil e ignora lo que no existe todavía', () => {
  const c = leerContacto(PERFIL);
  assert.equal(c.nombre, 'Ana Ejemplo');
  assert.equal(c.email, 'ana@ejemplo.com');
  assert.equal(c.ubicacion, 'Rosario, Santa Fe');
  assert.equal(c.github, 'github.com/anaejemplo');
  assert.equal(c.portfolio, undefined, 'el portfolio "todavía no existe" no debe aparecer');
});
