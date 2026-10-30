// Mide cuántas páginas ocupa el CV de verdad: convierte el .docx a PDF (con LibreOffice si está instalado; si no, con Word)
// y cuenta las páginas y cuánto llena la última. El archivo temporal se borra apenas termina.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDocumentProxy } from 'unpdf';

const MARGEN_PT = 42.5; // 850 twips: el margen de arriba y de abajo que usa generar.mjs
export const MAX_SEGUNDA_HOJA = 0.25; // la única excepción: una segunda hoja con 1/4 de página como máximo

const LIBREOFFICE = [process.env.POSTULA_SOFFICE, 'C:\\Program Files\\LibreOffice\\program\\soffice.exe', 'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'].filter(Boolean).find(existsSync);

const correr = (programa, args, env = {}, limiteMs = 90000) => new Promise((resolver, rechazar) => {
  const hijo = spawn(programa, args, { windowsHide: true, stdio: 'ignore', env: { ...process.env, ...env } });
  const reloj = setTimeout(() => { hijo.kill(); rechazar(new Error('La conversión a PDF tardó demasiado.')); }, limiteMs);
  hijo.on('error', (e) => { clearTimeout(reloj); rechazar(e); });
  hijo.on('close', (codigo) => { clearTimeout(reloj); codigo === 0 ? resolver() : rechazar(new Error(`La conversión a PDF falló (código ${codigo}).`)); });
});

const GUION_WORD = '$w=New-Object -ComObject Word.Application;$w.Visible=$false;$w.DisplayAlerts=0;' +
  'try{$d=$w.Documents.Open($env:CV_DOCX,$false,$true);$d.ExportAsFixedFormat($env:CV_PDF,17);$d.Close($false)}finally{$w.Quit()}';

async function aPdf(carpeta, docx) {
  const pdf = join(carpeta, 'cv.pdf');
  if (LIBREOFFICE) await correr(LIBREOFFICE, ['--headless', '--convert-to', 'pdf', '--outdir', carpeta, docx]);
  else await correr('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', GUION_WORD], { CV_DOCX: docx, CV_PDF: pdf });
  return readFile(pdf);
}

// Devuelve { paginas, ultima } (ultima = qué parte de la última página está llena, de 0 a 1) o null si no se pudo convertir.
export async function medirPaginas(docxBuffer) {
  const carpeta = await mkdtemp(join(tmpdir(), 'postulaciones-pdf-'));
  try {
    const docx = join(carpeta, 'cv.docx');
    await writeFile(docx, docxBuffer);
    const pdf = await getDocumentProxy(new Uint8Array(await aPdf(carpeta, docx)), { verbosity: 0 });
    const ultimaPagina = await pdf.getPage(pdf.numPages);
    const alto = ultimaPagina.view[3] - ultimaPagina.view[1];
    const { items } = await ultimaPagina.getTextContent();
    const bajo = Math.min(...items.filter((i) => i.str.trim()).map((i) => i.transform[5]));
    const usado = (alto - MARGEN_PT - bajo) / (alto - 2 * MARGEN_PT);
    return { paginas: pdf.numPages, ultima: Math.min(1, Math.max(0, usado)) };
  } catch {
    return null;
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

// Una hoja, o dos con la segunda casi vacía (caso límite). Cualquier otra cosa es demasiado larga.
export function evaluarPaginas({ paginas, ultima }) {
  if (paginas === 1) return 'ok';
  if (paginas === 2 && ultima <= MAX_SEGUNDA_HOJA) return 'limite';
  return 'largo';
}
