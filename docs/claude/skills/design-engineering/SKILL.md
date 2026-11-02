---
name: design-engineering
description: Usar al crear o cambiar animaciones e interacciones de la App Artesanos (feedback táctil, transiciones, tiempos, cascada).
---

<!-- Copia literal de la sección 2 de docs/claude/instrucciones-proyecto.md -->

## 2. Design Engineering (Animaciones e Interacciones por Emil Kowalski)
* **Feedback Táctil:** Todo elemento tocable debe sentirse responsivo. Aplica `transform: scale(0.97)` en `:active`. Nunca animes desde `scale(0)`: empieza desde `scale(0.95)` y `opacity: 0`.
* **Aceleración por Hardware:** Anima ÚNICAMENTE `transform` y `opacity`.
* **Transiciones Físicas e Interrumpibles:** Nunca uses `ease-in` para UI. Usa `--ease-out: cubic-bezier(0.23, 1, 0.32, 1);`. Prefiere CSS `transition` sobre `@keyframes` para que se puedan interrumpir.
* **Tiempos:** Animaciones de UI por debajo de 300 ms. Botones 100-160 ms, tooltips 125-200 ms, hojas y modales 200-500 ms.
* **Staggering (Cascada):** Si varios elementos entran a la vez, usa retrasos de 30-80 ms entre ellos con `animation-delay: calc(var(--index) * 50ms);`.
* **Clip-Path para Revelados:** Usa `clip-path: inset(...)` para revelar imágenes o transiciones de color en pestañas.
