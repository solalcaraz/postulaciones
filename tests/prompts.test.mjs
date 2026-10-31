import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasoGeneracion, pasoRevision } from '../src/prompts.mjs';
import { FIRMA, SALUDO } from '../src/config.mjs';
import { CV_TEXTO, OFERTA, PERFIL, resultadoEjemplo } from './ayudas.mjs';

const niveles = { es: 'nativo', en: 'B1' };

test('la firma y el saludo de config.mjs llegan a los prompts y no quedan variables sin reemplazar', async () => {
  const generacion = await pasoGeneracion({ oferta: OFERTA, cv: CV_TEXTO, perfil: PERFIL, idiomaSalida: 'es', niveles });
  const revision = await pasoRevision({ resultado: resultadoEjemplo(), cv: CV_TEXTO, perfil: PERFIL, oferta: OFERTA, idiomaSalida: 'es', niveles });
  for (const prompt of [generacion, revision]) {
    assert.ok(prompt.includes(FIRMA), 'incluye la firma');
    assert.ok(prompt.includes(SALUDO.es), 'incluye el saludo en español');
    assert.ok(!prompt.includes('{{'), 'no quedan variables sin reemplazar');
  }
  assert.ok(generacion.includes(SALUDO.en), 'la carta en inglés usa el saludo en inglés');
});
