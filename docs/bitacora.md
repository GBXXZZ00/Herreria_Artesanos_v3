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
