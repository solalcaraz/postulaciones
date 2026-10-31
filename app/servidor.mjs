// Servidor local de la herramienta. Escucha solo en esta compu (127.0.0.1) y no guarda nada en disco:
// el CV llega en cada pedido y el trabajo en curso vive únicamente en la memoria del proceso.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { leerArchivo, ErrorArchivo } from '../src/lectura/archivo.mjs';
import { detectarIdiomas, generarPostulacion } from '../src/postular.mjs';
import { ErrorIA } from '../src/ia.mjs';
import { leerMaestro, listarMaestros } from '../src/lectura/maestro.mjs';
import { estadoMedicion, guardarPostulacion, anotarRespuesta } from '../src/medicion.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PUBLICO = join(RAIZ, 'app', 'public');
const LIMITE_CUERPO = 12 * 1024 * 1024; // un archivo de 8 MB en base64 pesa unos 11 MB
const VIDA_DEL_TRABAJO_MS = 30 * 60 * 1000;
const NIVELES_VALIDOS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'nativo'];
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

class ErrorPedido extends Error {
  constructor(mensaje, estado = 400) { super(mensaje); this.estado = estado; }
}

function enviarJson(res, estado, cuerpo) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(cuerpo));
}

function leerCuerpo(req) {
  return new Promise((resolver, rechazar) => {
    const partes = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > LIMITE_CUERPO) { rechazar(new ErrorPedido('El archivo es demasiado grande (máximo 8 MB).', 413)); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => {
      try { resolver(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')); } catch { rechazar(new ErrorPedido('El pedido no tiene un formato válido.')); }
    });
    req.on('error', rechazar);
  });
}

// Si se sube un CV, manda ese. Si no, se usa el CV maestro de datos-privados.
async function textoDelCv(archivo, carpetaDatos, idioma) {
  if (archivo?.nombre && typeof archivo.base64 === 'string') return leerArchivo(Buffer.from(archivo.base64, 'base64'), archivo.nombre);
  const maestro = await leerMaestro(carpetaDatos, idioma);
  if (!maestro) throw new ErrorPedido('Subí tu CV en PDF o Word.');
  return maestro;
}

function validarOferta(oferta) {
  if (typeof oferta !== 'string' || oferta.trim().length < 80) throw new ErrorPedido('Pegá el texto completo de la oferta.');
  return oferta.trim();
}

function mensajeDeError(e) {
  if (e instanceof ErrorPedido) return { estado: e.estado, mensaje: e.message };
  if (e instanceof ErrorArchivo) return { estado: 400, mensaje: e.message };
  if (e instanceof ErrorIA) return { estado: e.tipo === 'perfil' ? 500 : 502, mensaje: e.message };
  return { estado: 500, mensaje: 'Algo salió mal del lado del programa. Probá de nuevo.' };
}

// Comprueba si Claude Code está disponible (la IA se llama con la sesión iniciada en esta compu).
function verificarClaude(ejecutable) {
  return new Promise((resolver) => {
    let salida = '';
    let hijo;
    try { hijo = spawn(ejecutable, ['--version'], { windowsHide: true }); } catch { resolver({ disponible: false }); return; }
    hijo.stdout.on('data', (c) => { salida += c; });
    hijo.on('error', () => resolver({ disponible: false }));
    hijo.on('close', (codigo) => resolver({ disponible: codigo === 0, version: salida.trim() }));
  });
}

export function crearServidor({ llamarFn, medirFn, carpetaDatos = join(RAIZ, 'datos-privados'), rutaPerfil = join(carpetaDatos, 'perfil.md'), ejecutableClaude = process.env.POSTULA_CLAUDE || 'claude' } = {}) {
  const trabajos = new Map();
  let puerto = 0;

  const leerPerfil = async () => {
    try { return await readFile(rutaPerfil, 'utf8'); } catch { throw new ErrorPedido('No encuentro tu perfil. Tiene que estar en datos-privados/perfil.md.', 500); }
  };

  async function rutaIdiomas(req) {
    const { archivo, oferta } = await leerCuerpo(req);
    const cv = await textoDelCv(archivo, carpetaDatos, 'es');
    const { resultado } = await detectarIdiomas({ cv, oferta: validarOferta(oferta), llamarFn });
    return resultado;
  }

  async function rutaGenerar(req) {
    if ([...trabajos.values()].some((t) => t.estado === 'en curso')) throw new ErrorPedido('Ya hay una postulación en curso. Esperá a que termine.', 409);
    const { archivo, oferta, infoEmpresa, idioma, niveles, celular, empresa, guia } = await leerCuerpo(req);
    const textoOferta = validarOferta(oferta);
    if (!['es', 'en'].includes(idioma)) throw new ErrorPedido('Elegí el idioma del CV: español o inglés.');
    const cv = await textoDelCv(archivo, carpetaDatos, idioma);
    if (!niveles || !NIVELES_VALIDOS.includes(niveles[idioma])) throw new ErrorPedido('Confirmá el nivel del idioma en el que se escribe el CV.');
    for (const [nombre, nivel] of Object.entries(niveles)) {
      if (!NIVELES_VALIDOS.includes(nivel)) throw new ErrorPedido(`El nivel de ${nombre} no es válido.`);
    }
    const perfil = await leerPerfil();

    const id = randomUUID();
    const trabajo = { estado: 'en curso', mensaje: 'Empezando…', inicio: Date.now() };
    trabajos.set(id, trabajo);
    setTimeout(() => trabajos.delete(id), VIDA_DEL_TRABAJO_MS).unref();

    generarPostulacion({
      cv, oferta: textoOferta, perfil, infoEmpresa: String(infoEmpresa || ''), idiomaSalida: idioma, niveles,
      celular: String(celular || '').slice(0, 40), empresa: String(empresa || '').slice(0, 60), conGuia: guia === true, llamarFn, medirFn,
      alPaso: (m) => { trabajo.mensaje = m; },
    }).then(async (r) => {
      const { docx, ...resto } = r;
      trabajo.resultado = { ...resto, docx: { nombre: docx.nombre } };
      trabajo.buffer = docx.buffer;
      try {
        trabajo.resultado.medicion = await guardarPostulacion(carpetaDatos, { resultado: r, oferta: textoOferta, segundos: Math.round((Date.now() - trabajo.inicio) / 1000) });
      } catch {
        trabajo.resultado.controles.avisos.push('No pude guardar esta postulación en la medición.');
      }
      trabajo.estado = 'listo';
    }).catch((e) => {
      trabajo.estado = 'error';
      trabajo.error = mensajeDeError(e).mensaje;
    });
    return { id };
  }

  const servidor = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      // Defensa contra páginas ajenas que intenten hablarle a este servidor local.
      const host = String(req.headers.host || '');
      if (!new RegExp(`^(127\\.0\\.0\\.1|localhost):${puerto}$`).test(host)) throw new ErrorPedido('Pedido no permitido.', 403);
      if (req.method === 'POST' && req.headers['x-postulaciones'] !== '1') throw new ErrorPedido('Pedido no permitido.', 403);

      if (req.method === 'GET' && url.pathname === '/api/estado') {
        let perfilOk = true;
        try { await readFile(rutaPerfil, 'utf8'); } catch { perfilOk = false; }
        const { activa, guardando, objetivo, hechas } = await estadoMedicion(carpetaDatos);
        return enviarJson(res, 200, { claude: await verificarClaude(ejecutableClaude), perfil: perfilOk, maestros: await listarMaestros(carpetaDatos), medicion: { activa, guardando, objetivo, hechas } });
      }
      if (req.method === 'GET' && url.pathname === '/api/medicion') return enviarJson(res, 200, await estadoMedicion(carpetaDatos));
      const respuesta = url.pathname.match(/^\/api\/medicion\/(\d{3,})\/respuesta$/);
      if (req.method === 'POST' && respuesta) {
        const { valor } = await leerCuerpo(req);
        try { return enviarJson(res, 200, await anotarRespuesta(carpetaDatos, respuesta[1], valor ?? null)); } catch (e) { throw new ErrorPedido(e.message); }
      }
      if (req.method === 'POST' && url.pathname === '/api/idiomas') return enviarJson(res, 200, await rutaIdiomas(req));
      if (req.method === 'POST' && url.pathname === '/api/generar') return enviarJson(res, 202, await rutaGenerar(req));

      const m = url.pathname.match(/^\/api\/trabajo\/([\w-]+)(\/cv)?$/);
      if (req.method === 'GET' && m) {
        const trabajo = trabajos.get(m[1]);
        if (!trabajo) throw new ErrorPedido('Ese resultado ya no está. Hacé la postulación de nuevo.', 404);
        if (m[2]) {
          if (trabajo.estado !== 'listo') throw new ErrorPedido('El CV todavía no está listo.', 409);
          res.writeHead(200, { 'Content-Type': DOCX, 'Content-Disposition': `attachment; filename="${trabajo.resultado.docx.nombre}"`, 'Cache-Control': 'no-store' });
          return res.end(trabajo.buffer);
        }
        return enviarJson(res, 200, { estado: trabajo.estado, mensaje: trabajo.mensaje, segundos: Math.round((Date.now() - trabajo.inicio) / 1000), error: trabajo.error, resultado: trabajo.resultado });
      }
      if (req.method === 'DELETE' && m && !m[2]) { trabajos.delete(m[1]); return enviarJson(res, 200, { ok: true }); }

      if (req.method === 'GET') {
        const ruta = url.pathname === '/' ? '/index.html' : url.pathname;
        const archivo = normalize(join(PUBLICO, ruta));
        if (!archivo.startsWith(PUBLICO)) throw new ErrorPedido('No encontrado.', 404);
        try {
          const contenido = await readFile(archivo);
          res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
          return res.end(contenido);
        } catch { throw new ErrorPedido('No encontrado.', 404); }
      }
      throw new ErrorPedido('No encontrado.', 404);
    } catch (e) {
      const { estado, mensaje } = mensajeDeError(e);
      if (!res.headersSent) enviarJson(res, estado, { error: mensaje });
    }
  });

  return {
    servidor,
    trabajos,
    escuchar: (p = Number(process.env.POSTULA_PUERTO) || 4400) => new Promise((resolver, rechazar) => {
      servidor.once('error', rechazar);
      servidor.listen(p, '127.0.0.1', () => { puerto = servidor.address().port; resolver(puerto); });
    }),
    cerrar: () => new Promise((resolver) => servidor.close(resolver)),
  };
}
