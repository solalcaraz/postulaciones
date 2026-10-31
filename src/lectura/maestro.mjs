// CV maestro: el CV completo que vive en datos-privados, para no tener que subirlo en cada postulación.
// Se reconoce por el nombre (CV-maestro*.pdf o .docx). Si hay uno por idioma (terminado en -es o -en), se usa el del idioma pedido.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { leerArchivo } from './archivo.mjs';

export async function listarMaestros(carpeta) {
  try { return (await readdir(carpeta)).filter((n) => /^cv-maestro.*\.(pdf|docx)$/i.test(n)).sort(); } catch { return []; }
}

export async function leerMaestro(carpeta, idioma = 'es') {
  const nombres = await listarMaestros(carpeta);
  const nombre = nombres.find((n) => new RegExp(`-${idioma}\\.\\w+$`, 'i').test(n)) ?? nombres[0];
  if (!nombre) return null;
  return leerArchivo(await readFile(join(carpeta, nombre)), nombre);
}
