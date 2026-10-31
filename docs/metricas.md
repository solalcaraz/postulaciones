# Plan de métricas

**Estado: midiendo desde el 31/10/2026, con un objetivo de 30 postulaciones.** Acá completo los resultados reales. Lo que está en blanco todavía no lo medí.

## Qué quiero saber
1. **¿Funciona?** Si el CV entra en una página, si la carta cumple las reglas y cuánto tengo que corregir a mano.
2. **¿Cuánto cuesta?** Tiempo de generación y costo estimado por postulación.
3. **¿Sirve?** Si las postulaciones hechas con la herramienta reciben respuesta, entrevistas o contactos.

## Cuántas postulaciones hacen falta
No hay un número mágico. Mi criterio:
- **Para lo técnico (preguntas 1 y 2): 10 postulaciones** alcanzan para ver valores típicos y cuánto varían. Son datos que salen de la propia herramienta.
- **Para lo que pasa afuera (pregunta 3): 30 postulaciones o más.** Las empresas responden poco, así que con pocas postulaciones el resultado es puro azar. Ejemplo: si 3 de 30 responden (10 %), el valor real podría estar entre 3 % y 26 % con un 95 % de confianza. Con 10 postulaciones, entre 1 de 10 y 3 de 10 no se pueden distinguir.
- **Tiempo:** dejo pasar al menos 2 semanas después de la última postulación antes de cerrar el conteo, porque las respuestas llegan tarde.
- **Comparación:** para saber si la herramienta mejora algo necesito un punto de partida. Si tengo registro de postulaciones anteriores (cuántas envié y cuántas tuvieron respuesta), lo cargo abajo. Si no, los resultados se pueden contar pero no comparar.

**Número elegido: 30 postulaciones.** Ventana: desde el 31/10/2026 hasta ____.

## Checklist
**Antes de empezar**
- [x] Definir el número de postulaciones y la fecha de inicio. Falta la fecha de cierre.
- [ ] Cargar el punto de partida: postulaciones anteriores sin la herramienta y sus respuestas, si existen.
- [x] Prender el modo medición (ver "Cómo se guarda") con el número elegido.
- [ ] Definir qué cuenta como "respuesta" y qué como "contacto" (por ejemplo: mail de la empresa, mensaje por LinkedIn, llamado, pedido de entrevista).
- [ ] Revisar que el ajuste de mejora del modelo en claude.ai esté apagado.

**Durante**
- [ ] Hacer cada postulación con la herramienta. El registro se completa solo.
- [ ] Anotar cuántas de las sugerencias apliqué (`Edité: __/X`) y dejar el CV que mandé como `enviado.docx` en la carpeta de esa postulación, para medir cuánto cambié el Word.
- [ ] Anotar la fecha de envío y, cuando llegue, si la respuesta fue positiva o negativa. Todo se carga en el panel "Medición" de la pantalla. Las que no respondan quedan como "sin respuesta" recién al cerrar.
- [ ] Anotar cualquier error, mensaje de límite de uso o resultado raro, con la fecha.
- [ ] Una vez por semana, revisar que el conteo avance.

**Al cerrar**
- [ ] Esperar 2 semanas desde la última postulación.
- [ ] Correr `npm run medicion` para completar el registro y los resultados finales, y completar a mano lo que falta (entrevistas, contactos y punto de partida).
- [ ] Cerrar la medición (`"cerrada": true` en `datos-privados/medicion.json`) y borrar lo guardado que no vaya a conservar.
- [ ] Pasar los resultados al README, en "Qué aprendí y qué mejoraría".

## Resultados finales
Se completan solos con `npm run medicion`, desde `datos-privados/mediciones/registro.json`.

<!-- resultados:inicio -->
| Medida | Resultado |
|---|---|
| Postulaciones hechas con la herramienta | 3 |
| Ventana | 31/10/2026 |
| Minutos de generación (mediana y rango) | 2,0 (de 1,9 a 2,0) |
| Costo estimado por postulación en USD (mediana y rango) | 0,44 (de 0,36 a 0,48) |
| CV que entraron en 1 página | 0 de 3 |
| Cartas dentro de 200 a 280 palabras | 2 de 3 |
| Postulaciones con datos nuevos marcados por el control | 0 de 3 |
| Sugerencias aplicadas | sin cargar |
| Edición del Word (promedio de palabras cambiadas) | sin datos |
| Enviadas | 0 de 3 |
| Con respuesta positiva | 0 de 3 |
| Con respuesta negativa | 0 de 3 |
| Enviadas sin respuesta todavía | 0 de 3 |
<!-- resultados:fin -->

Lo que no sale de la herramienta lo completo a mano:

| Medida | Resultado |
|---|---|
| Entrevistas | |
| Contactos por otras vías | |
| Punto de partida (sin la herramienta): enviadas / con respuesta | |

Un dato previo, de un solo caso y sin valor estadístico: en una prueba del 12/10/2026 con una oferta real, las 3 llamadas tardaron unos 2,7 minutos y costaron unos 0,50 USD estimados a precios de API (el uso real sale del plan de suscripción).

## Registro por postulación
Se completa solo con `npm run medicion`. El puesto sale de la primera línea de la oferta y no se anota la empresa, porque este archivo es público. En "Edité" va la cantidad de sugerencias del panel (título o tecnología) que apliqué, sobre el total que me sugirió.

<!-- registro:inicio -->
| # | Fecha | Puesto | Idioma | Min. | Costo (USD) | Páginas | Palabras de la carta | Frases prohibidas | Datos nuevos | Edité (sugerencias aplicadas) | Edición del Word (% de palabras) | Enviada | Respuesta |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | 31/10/2026 | Desarrollador de software | es | 1,9 | 0,36 | 2 | 206 | 0 | 0 | _/1 |  |  |  |
| 002 | 31/10/2026 | Software Engineer Backend | es | 2,0 | 0,48 | 2 | 197 | 0 | 0 | _/2 |  |  |  |
| 003 | 31/10/2026 | Fullstack React Java | es | 2,0 | 0,44 | 2 | 245 | 0 | 0 | _/1 |  |  |  |
<!-- registro:fin -->

## Cómo se guarda
Por defecto la herramienta **no guarda nada**. El modo medición es la única excepción, y es temporal:

1. **Prenderlo:** crear el archivo `datos-privados/medicion.json` con el número elegido, por ejemplo `{"objetivo": 30}`.
2. **Mientras guarda:** cada postulación deja una carpeta en `datos-privados/mediciones/` (por ejemplo `001/`) con el CV, la carta, el panel de análisis y la oferta, más una entrada en `registro.json` (fecha, minutos, costo estimado, páginas, palabras de la carta, avisos de los controles y la respuesta). La pantalla avisa que el modo está activo y en qué número va.
3. **Panel "Medición":** en la pantalla, por cada postulación anoto la fecha de envío, cuántas de las sugerencias apliqué (`Edité: __/X`) y si la respuesta fue positiva o negativa. Al llegar al objetivo deja de guardar postulaciones nuevas, pero el panel sigue.
4. **Resumen:** `npm run medicion` completa en este archivo el registro y los resultados finales. Si dejé el CV que mandé como `enviado.docx` dentro de la carpeta de la postulación, también calcula qué porcentaje de las palabras cambié respecto del generado.
5. **Cerrar:** poner `"cerrada": true` en `medicion.json` (o borrar el archivo). El panel desaparece y la herramienta vuelve a no guardar nada.

Esa carpeta tiene datos personales, git la ignora y no se sube a ningún lado. El registro tiene los datos técnicos; lo que pasa afuera (envío, sugerencias aplicadas, respuesta) lo anoto en el panel.
