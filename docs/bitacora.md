# Bitácora compartida

Cada sesión de trabajo de cualquiera de los dos Claude agrega una entrada **arriba** (la más nueva primero) con este formato:

```
## AAAA-MM-DD · Claude de Ray | Claude de Gualfredo
- Qué hizo:
- Rama o PR:
- Está tocando (para no chocar):
- Pendientes:
```

---

## 2026-11-03 · Claude de Ray
- Qué hizo: maqueta con el plan de corte semanal que sale de Producción (Costos › Semana: por herrero, Ray acepta o cambia, ya cortó, ¿qué alcanzo?, modelos sin cortes no frenan), Costos › Ganancia (gastos fijos, ¿alcanzamos este mes?, ganancia por producto), Depósito › Fabricación por tubo sin pedidos, Finanzas › Mes (cierre y reporte PDF), costo en el Catálogo, avisos de Inicio y PDF de hoja de corte, plan de compra y cierre. Plan actualizado (lotes 9 y 10).
- Rama o PR: `ray/maqueta-finanzas-costos`, PR #3 en borrador (no se une). No toca la app ni la base.
- Está tocando: solo `maqueta/` y docs.
- Pendientes: OK de Ray a la maqueta; respuestas de los socios (Zelle, Torniplemaca, Colores y Ambiente, $915 y 25 puertas, nómina con cuenta); servicio de OCR; cargar cortes de los modelos del catálogo; aluminio y 3D después.

## 2026-11-02 · Claude de Ray
- Qué hizo: maqueta viva de Finanzas, Proveedores, Compras (Depósito) y Costos, sobre una copia de la app con datos de ejemplo (`maqueta/`, con su `LEEME.md`). No toca la app, la base ni `main`. Plan por lotes en `docs/claude/documentos/plan-finanzas-costos.md`.
- Rama o PR: `ray/maqueta-finanzas-costos` (PR en borrador, **no se une**: la carpeta `maqueta/` no debe publicarse).
- Después (3 nov): Costos › Corte (plan de corte de la semana con retazos, ahorro y hoja de corte), Costos › Precios con explicación, reportes de Finanzas en dos columnas (nombre y número con + o −) y estado de cuenta en dos columnas. Prompt para Claude Code en `docs/claude/documentos/prompt-claude-code.md`. Pruebas: 25 de 27 TODO OK; `test21` se corta en un clic y `test26` falla a veces, igual en `main` (esta rama no cambia la app).
- Está tocando: nada de la app todavía. Los próximos lotes tocan `abonos` (seguridad, lote 1), Depósito (lote 5) y una fila en la ficha del Catálogo (lote 6). Inicio gana avisos y cuadros de Finanzas y Costos (solo admin).
- Pendientes:
  - Respuestas de los socios a las preguntas del plan (Zelle, Torniplemaca, Colores y Ambiente, quién registra, Bs, nómina con cuenta).
  - Borrar datos de prueba y devoluciones viejas antes del lote 3 (lo deciden los socios).
  - Lote 1 con el OK de Ray.

## 2026-11-02 · Claude de Gualfredo
- Qué hizo: preparó el repo para trabajar entre los dos Claude, sin tocar código de la app ni la base. Creó `CLAUDE.md` (reglas), `docs/modulos.md`, `docs/base-de-datos.md`, esta bitácora, copia literal de las instrucciones y de los documentos del proyecto de Gualfredo (`docs/claude/`), las 4 skills sacadas de las instrucciones, `docs/claude/memoria-app.md`, la lista de las 88 migraciones y una acción de GitHub para bajar su texto y el esquema actual.
- Rama o PR: `docs/reglas-compartidas`, PR #1.
- Después: agregó a `CLAUDE.md` la sección "Quién hizo qué" (nombre en git, `Hecho-por:`, ramas, título del PR, migraciones y bitácora marcadas por autor), porque Ray y Gualfredo usan la misma cuenta de GitHub y Supabase.
- Está tocando: solo documentación.
- Pendientes:
  - (Hecho) Se acordó que cada uno une su propio PR; no hace falta el OK de los dos.
  - Gualfredo agrega el secreto `SUPABASE_DB_URL` y corre "Bajar migraciones y esquema" (ver `supabase/migrations/LEEME.md`).
  - Proteger `main` en GitHub (Settings > Branches: pedir PR antes de unir).
  - Subir al repo el código de las edge functions (`notificar`, `gestionar_usuarios`, `copiar_fotos`).
  - Revisar las funciones expuestas a `anon` (lista en `docs/base-de-datos.md`).
  - Lo que sigue de la app: `docs/claude/memoria-app.md`, sección Pendientes. Finanzas y el Resumen en PDF pasan al Claude de Ray.
