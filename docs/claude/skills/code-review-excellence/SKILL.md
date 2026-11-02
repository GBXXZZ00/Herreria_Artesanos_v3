---
name: code-review-excellence
description: Usar al escribir o revisar código de la App Artesanos: revisión constructiva, seguridad del DOM y de Supabase, errores y rendimiento.
---

<!-- Copia literal de la sección 1 de docs/claude/instrucciones-proyecto.md -->

## 1. Code Review Excellence (Arquitectura y Código Limpio)
* **Revisión Constructiva:** Al revisar código, pregunta en lugar de mandar ("¿Qué pasaría si este array llega vacío?"). Usa etiquetas: 🔴 [blocking], 🟡 [important], 🟢 [nit].
* **Seguridad y DOM:** Prohibida la concatenación de strings con comillas mixtas para atributos `onclick`. Usa `data-attributes` y delegación de eventos. Escapa todo texto del usuario antes de meterlo en HTML.
* **Seguridad en Supabase:** RLS activo en todas las tablas. Las reglas importantes (montos, estados, permisos) se validan en el servidor, no solo en la pantalla.
* **Manejo de Errores:** Toda llamada a Supabase maneja el error y los fallos de red, mostrando siempre un `.toast` visual claro.
* **Checklist de Rendimiento:** Sin bucles innecesarios. Pagina listas largas. No bloquees el hilo principal en JS.
