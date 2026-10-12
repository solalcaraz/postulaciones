# Revisión de textos con `revisor-textos-web`

La skill `revisor-textos-web` se usa **tal cual**, sin cambios, como control de calidad al probar los resultados (Fase 2 y Fase 5). No corre dentro de la app.

Corrige ortografía, claridad y tono con el mínimo cambio necesario, y no reescribe por gusto propio. Complementa al verificador (`pruebas/verificador.md`): el verificador mira que no se haya inventado nada y esta revisión mira que el texto esté bien escrito.

## Los tres datos que pide la skill, ya definidos
La skill pide una guía de tono antes de corregir. Para esta herramienta se le dan siempre estos tres:

1. **Guía de tono** (de `tono.md`): cercana, directa, reflexiva y honesta; humor sutil solo en la carta; sin autoayuda ni frases corporativas.
2. **Registro:** español rioplatense con voseo y semi-formal en la carta; el CV casi sin segunda persona. En inglés, sencillo y a nivel B1.
3. **Público:** reclutadores y equipos técnicos que leen muchos CV y cartas en poco tiempo.

## Cómo se usa
Se le pasa el texto a revisar (CV, carta o guía) más los tres datos. Devuelve un veredicto (**LISTO PARA PUBLICAR** o **REQUIERE AJUSTES**) y una tabla Original / Corregido / Motivo (ortografía, claridad o tono).

## Reglas a recordar al aplicar sus cambios
- Datos concretos (números, nombres, fechas) no se tocan aunque parezcan raros: se señalan, no se corrigen.
- Un cambio de tono no puede agregar hechos ni subir el nivel de idioma.
- No se toca el cierre de la carta que sugiere una charla.
