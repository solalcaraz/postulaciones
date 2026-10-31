# Plan de métricas

**Estado: sin datos todavía.** Esta página es el espacio para completar con resultados reales. Todo lo que está en blanco es porque todavía no se midió.

## Qué se quiere saber
1. **¿Funciona?** Si el CV entra en una página, si la carta cumple las reglas y cuánto hay que corregir a mano.
2. **¿Cuánto cuesta?** Tiempo de generación y costo estimado por postulación.
3. **¿Sirve?** Si las postulaciones hechas con la herramienta reciben respuesta, entrevistas o contactos.

## Cuántas postulaciones hacen falta
No hay un número mágico. Mi criterio, para que lo definamos juntas:
- **Para lo técnico (preguntas 1 y 2): 10 postulaciones** alcanzan para ver valores típicos y cuánto varían. Son datos que sacás de la propia herramienta.
- **Para lo que pasa afuera (pregunta 3): 30 postulaciones o más.** La respuesta de las empresas es poco frecuente, así que con pocas postulaciones el resultado es puro azar. Ejemplo: si 3 de 30 responden (10 %), el valor real podría estar entre 3 % y 26 % con un 95 % de confianza. Con 10 postulaciones, entre 1 de 10 y 3 de 10 no se pueden distinguir.
- **Tiempo:** dejar pasar al menos 2 semanas después de la última postulación antes de cerrar el conteo, porque las respuestas llegan tarde.
- **Comparación:** para saber si la herramienta mejora algo, hace falta un punto de partida. Si tenés registro de postulaciones anteriores (cuántas enviaste y cuántas tuvieron respuesta), cargalo abajo. Si no, los resultados se pueden contar pero no comparar.

**Número elegido: ______ postulaciones.** Ventana: del ____ al ____.

## Checklist
**Antes de empezar**
- [ ] Definir el número de postulaciones y las fechas de inicio y cierre (arriba).
- [ ] Cargar el punto de partida: postulaciones anteriores sin la herramienta y sus respuestas, si existen.
- [ ] Decidir cómo se guardan las postulaciones durante la medición (ver "Pendiente" más abajo) y dejarlo implementado.
- [ ] Definir qué cuenta como "respuesta" y qué como "contacto" (por ejemplo: mail de la empresa, mensaje por LinkedIn, llamado, pedido de entrevista).
- [ ] Revisar que el ajuste de mejora del modelo en claude.ai esté apagado.

**Durante**
- [ ] Hacer cada postulación con la herramienta y anotar una fila en el registro.
- [ ] Anotar cuánto editaste a mano antes de enviar: nada, poco (frases sueltas) o mucho (reescribiste partes).
- [ ] Anotar la fecha de envío y, cuando llegue, la fecha y el tipo de respuesta. Las que no respondan quedan como "sin respuesta" recién al cerrar.
- [ ] Anotar cualquier error, mensaje de límite de uso o resultado raro, con la fecha.
- [ ] Una vez por semana, revisar que el conteo avance.

**Al cerrar**
- [ ] Esperar 2 semanas desde la última postulación.
- [ ] Marcar "sin respuesta" en las que no contestaron.
- [ ] Completar la tabla de resultados finales.
- [ ] Apagar el guardado de postulaciones y salidas, y borrar lo guardado que no vaya a conservarse.
- [ ] Pasar los resultados al README, en "Qué aprendí y qué mejoraría".

## Resultados finales
| Medida | Resultado |
|---|---|
| Postulaciones hechas con la herramienta | |
| Del ____ al ____ (ventana) | |
| Minutos de generación (mediana y rango) | |
| Costo estimado por postulación (mediana y rango, USD) | |
| CV que entraron en 1 página sin acortar a mano | |
| Cartas dentro de 200 a 280 palabras | |
| Postulaciones con datos nuevos marcados por el control | |
| Edición a mano: nada / poco / mucho | |
| Postulaciones con alguna respuesta | |
| Entrevistas | |
| Contactos por otras vías | |
| Punto de partida (sin la herramienta): enviadas / con respuesta | |

Un dato previo, de un solo caso y sin valor estadístico: en una prueba del 12/10/2026 con una oferta real, las 3 llamadas tardaron unos 2,7 minutos y costaron unos 0,50 USD estimados a precios de API (el uso real sale del plan de suscripción).

## Registro por postulación
Copiá una fila por postulación. Las columnas de generación salen del panel y del resultado; las de respuesta las anotás vos.

| # | Fecha | Empresa y puesto | Idioma | Min. de generación | Costo estimado (USD) | Páginas del CV | Palabras de la carta | Frases prohibidas | Datos nuevos marcados | Cuánto edité a mano | ¿La envié? (fecha) | Respuesta (fecha y tipo) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | | | | |
| 2 | | | | | | | | | | | | |
| 3 | | | | | | | | | | | | |
| 4 | | | | | | | | | | | | |
| 5 | | | | | | | | | | | | |
| 6 | | | | | | | | | | | | |
| 7 | | | | | | | | | | | | |
| 8 | | | | | | | | | | | | |
| 9 | | | | | | | | | | | | |
| 10 | | | | | | | | | | | | |
| 11 | | | | | | | | | | | | |
| 12 | | | | | | | | | | | | |
| 13 | | | | | | | | | | | | |
| 14 | | | | | | | | | | | | |
| 15 | | | | | | | | | | | | |
| 16 | | | | | | | | | | | | |
| 17 | | | | | | | | | | | | |
| 18 | | | | | | | | | | | | |
| 19 | | | | | | | | | | | | |
| 20 | | | | | | | | | | | | |
| 21 | | | | | | | | | | | | |
| 22 | | | | | | | | | | | | |
| 23 | | | | | | | | | | | | |
| 24 | | | | | | | | | | | | |
| 25 | | | | | | | | | | | | |
| 26 | | | | | | | | | | | | |
| 27 | | | | | | | | | | | | |
| 28 | | | | | | | | | | | | |
| 29 | | | | | | | | | | | | |
| 30 | | | | | | | | | | | | |

## Pendiente: cómo guardar durante la medición
Hoy la herramienta **no guarda nada**, a propósito. Para medir hace falta una excepción temporal. Propuesta, sin implementar hasta definir el número:
- Un **modo medición** que se prende a mano y se apaga solo al llegar al número definido.
- Mientras está prendido, guarda cada postulación y sus salidas en `datos-privados/mediciones/`, que git ignora. Contiene datos personales: no se sube a ningún lado.
- Al llegar al número, el modo se apaga solo y la herramienta vuelve a no guardar nada.
- Al cerrar, se borra lo que no se vaya a conservar.
