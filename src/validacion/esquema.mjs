// Segunda validación de lo que devuelve la IA, contra el mismo JSON Schema que ya usa Claude Code.
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });
const compilados = new WeakMap();

export function validar(esquema, dato) {
  if (!compilados.has(esquema)) compilados.set(esquema, ajv.compile(esquema));
  const funcion = compilados.get(esquema);
  const ok = funcion(dato);
  return { ok, errores: ok ? [] : funcion.errors.map((e) => `${e.instancePath || '(raíz)'} ${e.message}`) };
}
