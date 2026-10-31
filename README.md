# Postulaciones

Herramienta local que adapta mi CV a cada oferta de trabajo: subo el CV completo, pego la oferta y me devuelve un CV en Word de una página, una carta corta y un análisis de qué cubro y qué no. La armé sola en 2026, como proyecto personal. Nació de un problema propio: tener que adaptar mi CV para cada propuesta de trabajo.

## Problema que resuelve

Cada oferta pide cosas distintas, y mandar el mismo CV a todas no funciona. Adaptarlo a mano es lento y repetitivo, y la carta de presentación suma otra tarea por oferta.

Pasarle todo a un chat de IA tiene sus propios problemas, y esos son los que me interesó resolver:
- **Inventa.** Un modelo de lenguaje completa huecos: una tecnología que no usé, un número redondeado a mi favor, un nivel de inglés más alto del que tengo.
- **Suena a IA.** Los textos salen con las mismas muletillas, y quienes leen muchos CV y cartas las reconocen enseguida.
- **No respeta el formato.** El CV tiene que entrar en una página y ser un Word editable que un filtro automático (ATS) lea bien.
- **No avisa lo que falta.** Una oferta pide cinco cosas y mi CV cubre tres. Quiero saberlo yo, pero no que aparezca en la carta.

La herramienta ataca eso con reglas escritas en los prompts y con controles hechos en código, que no dependen de que la IA se acuerde de cumplirlas.

## Demo

![Flujo completo: formulario, confirmación de niveles de idioma, progreso y resultado](docs/demo/flujo.gif)

Es una corrida real, con Claude, mi CV maestro y una oferta de desarrollador de software back-end. Difuminé mi ubicación, mi email y el nombre de la empresa. El GIF recorre el flujo completo, con el análisis de la oferta, las sugerencias y las alertas que devuelve el sistema.

En esta corrida el CV ocupó una página y un 4 % de la segunda. La herramienta lo marca como caso límite, y lo dejé así. El resultado completo está en [resultado.png](docs/demo/resultado.png) y el CV en [cv-generado.png](docs/demo/cv-generado.png) y salen de `npm run pantalla`; con `PANTALLA_REAL=1` usa Claude de verdad (los detalles están al principio de [tests/e2e/pantalla.mjs](tests/e2e/pantalla.mjs)).

No hay demo online: la herramienta usa la sesión de Claude Code de mi compu, así que no tiene sentido publicarla en un hosting.

Empecé a medir el uso real el 31/10/2026, con un objetivo de 30 postulaciones. Todavía no tengo resultados: el plan y las tablas para completar están en [docs/metricas.md](docs/metricas.md).

## Tecnologías

- **Node.js** (probado con la versión 24), sin framework. Pantalla con HTML, CSS y JavaScript puros.
- **Claude Code** en modo no interactivo (`claude -p`) para escribir los textos.
- **docx** para generar el Word, **mammoth** para leer Word, **unpdf** para leer PDF y **ajv** para validar las respuestas de la IA contra un JSON Schema.
- **LibreOffice o Word** para convertir el CV a PDF y medir cuántas páginas ocupa.
- **node:test** para las pruebas (51) y el protocolo de depuración de Chrome para probar la pantalla.

## Cómo funciona

1. Subo el CV (PDF o Word) y pego la oferta. El programa lee el texto del CV en memoria.
2. **Llamada 1:** la IA detecta los idiomas y niveles que figuran en el CV. La pantalla me los muestra para que los confirme o corrija.
3. **Llamada 2:** analiza la oferta como lo haría una reclutadora, puntúa cada requisito de 0 a 3 con una cita del CV, y escribe el CV, la carta y, si lo pido, una guía para la entrevista.
4. **Llamada 3:** una revisión que corta muletillas y ordena, sin agregar contenido.
5. El programa chequea el resultado con código, arma el .docx, lo convierte a PDF para contar las páginas y, si no entra en una hoja, le pide a la IA que lo acorte (hasta 2 veces).
6. Veo el análisis, copio la carta y descargo el Word.

El contenido sale solo de dos fuentes: el CV que subo y un archivo local, `datos-privados/perfil.md`, donde tengo cada proyecto con el antes, el cambio, el después y los números con su fuente. Ese archivo no se sube a git.

Las decisiones que tomé y por qué:

- **Claude Code en vez de la API.** Primero había elegido la API de Anthropic. La cambié porque ya usaba Claude Code en otro proyecto mío: así no manejo claves ni pago aparte, y el uso sale del cupo de mi plan. El costo es que depende de tener la sesión iniciada en esa compu.
- **Las instrucciones van por entrada estándar.** Windows limita la línea de comandos a unos 32.000 caracteres y cada llamada es más larga.
- **Tres llamadas y no dos.** Probé fundir la revisión en la llamada grande: ahorraba unos 0,10 USD estimados, pero la lista de cambios dejaba de reflejar correcciones reales, y esa lista es lo que me deja auditar qué tocó la IA.
- **Validación doble.** Claude Code recibe el esquema de la respuesta, y yo la vuelvo a validar con `ajv`. Si viene mal, un reintento y después un mensaje claro.
- **Controles con código, sin IA.** Una lista negra de frases prohibidas y un control de datos nuevos: todo número, enlace o término técnico del texto final tiene que estar en el CV, el perfil o la oferta. Si no, el panel me lo marca.
- **El nivel de idioma lo confirmo yo.** Antes de generar, la pantalla me pide el nivel de cada idioma. El texto se escribe a ese nivel y nunca más alto. Si la oferta pide más, va al panel como "no cubierto".
- **Lo que falta no va a la carta.** Los requisitos sin cubrir aparecen en el panel, que es privado, y la carta no los menciona. Las sugerencias del panel (un título o una tecnología que podría sostener) tampoco se aplican solas al CV.
- **Páginas medidas, no estimadas.** Convierto el .docx a PDF y miro cuánto llena la última página. Admito una segunda hoja solo si lleva un cuarto de página o menos, y el panel lo avisa como caso límite.
- **Servidor propio y mínimo, sin framework.** Escucha solo en mi compu y la pantalla muestra todo como texto, nunca como HTML, porque el contenido viene de una IA.
- **La oferta y el CV son datos, no órdenes.** Si traen instrucciones para la IA, se ignoran y el panel lo avisa.
- **No se guarda nada**, salvo en el modo medición que prendo a mano durante un tiempo para juntar métricas (ver [docs/metricas.md](docs/metricas.md)). Ni el CV, ni la oferta, ni los resultados.
- **Privacidad.** Para escribir los textos, el CV, el perfil y la oferta se envían a Anthropic a través de Claude Code, con mi sesión.

## Cómo correrlo

Necesita Windows, Node.js y Claude Code con la sesión iniciada. Para medir las páginas del CV hace falta Word o LibreOffice.

```bash
git clone https://github.com/solalcaraz/postulaciones.git
cd postulaciones
npm install
npm start
```

Después abrí `http://127.0.0.1:4400`. En Windows también sirve `Abrir Postulaciones.cmd`. Las pruebas se corren con `npm test`.

Estos archivos son míos y tendrían que cambiarse para usarla con otros datos: `datos-privados/perfil.md` (se arma desde `plantillas/perfil.plantilla.md`), `datos-privados/CV-maestro*` (mi CV completo), `src/config.mjs` (firma y saludo de la carta) y los ejemplos de `prompts/02-cv.md` y `prompts/niveles-idioma.md`.

## Qué aprendí y qué mejoraría

**Qué aprendí**

- Pedirle a la IA que no invente no alcanza. Lo que me dio confianza fueron los controles en código que revisan el resultado, y una fuente de verdad clara: el CV y el perfil.
- Cambié dos decisiones sobre la marcha. Empecé con Next.js y la API, y terminé con un servidor de Node sin framework y Claude Code. Con un programa de este tamaño, menos dependencias me dejó entender y auditar todo el código.
- Aprendí a aplicar skills y a estructurar un `CLAUDE.md` para trabajar con IA. Lo que mejor funcionó fue pensar las decisiones primero, escribir un buen prompt y recién después pedir el código, con buenas herramientas de asistencia.
- Los prompts también son código: viven en archivos propios, versionados, y cambiar una palabra cambia el resultado. Por eso los ajusté probándolos con ofertas de ejemplo, y los cambios quedan en el historial de git.

**Qué mejoraría**

- **Medir con uso real.** Es lo principal que falta. El plan está en [docs/metricas.md](docs/metricas.md).
- **Probarla con una oferta real en inglés.** Las pruebas en inglés usaron ofertas inventadas.
- **Afinar el control de datos nuevos.** No revisa nombres propios comunes y puede marcar traducciones como si fueran datos nuevos (por ejemplo, "ATMs" por "cajeros").
- **Automatizar la auditoría.** Hoy la revisión de restricciones (`pruebas/verificador.md`) la hago a mano; los controles automáticos cubren solo una parte.
