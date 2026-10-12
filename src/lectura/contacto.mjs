// Saca los datos de contacto de la sección "1. Contacto" del perfil. Los inserta el programa en el CV: no se le mandan a la IA.
const CAMPOS = {
  nombre: /^nombre completo/i,
  email: /^email/i,
  ubicacion: /^ciudad/i,
  linkedin: /^linkedin/i,
  github: /^github/i,
  portfolio: /^portfolio/i,
};

const esDato = (valor) => valor && !/a confirmar/i.test(valor) && !/todav[ií]a no|no existe|no se incluye/i.test(valor);

export function leerContacto(perfil) {
  const seccion = String(perfil).split(/^## /m).find((s) => /^1\.\s*Contacto/i.test(s)) || '';
  const contacto = {};
  for (const linea of seccion.split('\n')) {
    const m = linea.match(/^-\s*\*\*(.+?):\*\*\s*(.*)$/);
    if (!m) continue;
    const campo = Object.keys(CAMPOS).find((c) => CAMPOS[c].test(m[1].trim()));
    const valor = m[2].trim();
    if (campo && esDato(valor)) contacto[campo] = valor;
  }
  return contacto;
}
