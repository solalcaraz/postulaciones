// Llama a Claude Code en modo no interactivo, con la suscripción de quien lo tenga iniciado en esta compu.
// Basado en C:\Users\alcar\Desktop\rumbo-españa\app\lib\ia.js. Sin herramientas, sin MCP, sin configuraciones del usuario,
// sin guardar la conversación y con la salida validada contra un esquema JSON.
//
// Las instrucciones largas van por la entrada estándar: la línea de comandos de Windows tiene un límite de unos 32.000 caracteres.
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const EJECUTABLE = process.env.POSTULA_CLAUDE || 'claude';
const MODELO = process.env.POSTULA_MODELO || 'sonnet';
const SISTEMA = 'Seguís al pie de la letra las instrucciones y los datos que recibís. Respondés únicamente con el JSON que pide el esquema.';

export class ErrorIA extends Error {
  constructor(mensaje, tipo = 'otro') { super(mensaje); this.tipo = tipo; }
}

function mensajeAmigable(texto) {
  const t = String(texto || '').toLowerCase();
  if (/usage limit|rate limit|limit reached|quota|too many requests|429/.test(t)) {
    return new ErrorIA('Se llegó al límite de uso de tu plan de Claude. Probá de nuevo en unas horas.', 'limite');
  }
  if (/not logged in|login|authenticat|unauthorized|401|oauth|credential/.test(t)) {
    return new ErrorIA('Claude Code no tiene la sesión iniciada en esta compu. Abrí una terminal, escribí claude y seguí los pasos.', 'sesion');
  }
  if (/overloaded|529|500|502|503/.test(t)) return new ErrorIA('El servicio de Claude está saturado. Probá de nuevo en un rato.', 'temporal');
  return new ErrorIA('Claude no pudo completar la tarea: ' + String(texto || 'error desconocido').slice(0, 300), 'otro');
}

export function llamar({ prompt, esquema, limiteMs = 8 * 60 * 1000 }) {
  const args = [
    '-p', '--output-format', 'json', '--model', MODELO, '--no-session-persistence',
    '--strict-mcp-config', '--setting-sources', '', '--disable-slash-commands',
    '--system-prompt', SISTEMA, '--tools', '',
    '--json-schema', JSON.stringify(esquema),
  ];
  return new Promise((resolver, rechazar) => {
    let hijo;
    try {
      hijo = spawn(EJECUTABLE, args, { cwd: tmpdir(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      rechazar(new ErrorIA('No se encontró Claude Code en esta compu.', 'sin_claude'));
      return;
    }
    let salida = '';
    let errores = '';
    const reloj = setTimeout(() => { hijo.kill(); rechazar(new ErrorIA('La respuesta tardó demasiado y se cortó. Probá de nuevo.', 'temporal')); }, limiteMs);
    hijo.stdout.on('data', c => { salida += c; });
    hijo.stderr.on('data', c => { errores += c; });
    hijo.on('error', e => {
      clearTimeout(reloj);
      rechazar(e.code === 'ENOENT'
        ? new ErrorIA('No se encontró Claude Code en esta compu.', 'sin_claude')
        : new ErrorIA('No se pudo ejecutar Claude Code: ' + e.message));
    });
    hijo.on('close', () => {
      clearTimeout(reloj);
      let r;
      try { r = JSON.parse(salida); } catch { rechazar(mensajeAmigable(errores || salida)); return; }
      if (r.is_error || r.subtype !== 'success') {
        rechazar(mensajeAmigable(`${r.result || ''} ${r.api_error_status || ''} ${r.subtype || ''} ${errores}`));
        return;
      }
      let resultado = r.structured_output;
      if (resultado === undefined) {
        try { resultado = JSON.parse(String(r.result).replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch {
          rechazar(new ErrorIA('La respuesta de Claude no vino en el formato esperado.'));
          return;
        }
      }
      resolver({ resultado, costoEstimadoUsd: r.total_cost_usd || 0, duracionMs: r.duration_ms || 0, uso: r.usage || null });
    });
    hijo.stdin.end(prompt, 'utf8');
  });
}
