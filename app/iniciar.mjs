// Arranca la herramienta: node app/iniciar.mjs (o doble clic en "Abrir Postulaciones.cmd").
import { crearServidor } from './servidor.mjs';

const app = crearServidor();
try {
  const puerto = await app.escuchar();
  console.log(`Postulaciones está abierta en http://127.0.0.1:${puerto}`);
  console.log('Dejá esta ventana abierta mientras la usás. Si la cerrás, la herramienta se apaga y no queda nada guardado.');
} catch (e) {
  if (e.code === 'EADDRINUSE') console.error('El puerto ya está en uso. ¿Ya tenés la herramienta abierta? Entrá a http://127.0.0.1:4400 o cerrá la otra ventana y volvé a intentar.');
  else console.error('No se pudo abrir la herramienta:', e.message);
  process.exit(1);
}
