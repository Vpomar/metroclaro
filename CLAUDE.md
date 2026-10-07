# CLAUDE.md

Las reglas del proyecto están en AGENTS.md y son obligatorias:

@AGENTS.md

## Además, para Claude Code

- **Siempre una rama nueva por funcionalidad, y el pull request se abre
  desde GitHub.** Antes de tocar código, verificar con `git branch
  --show-current` que no estás en `main`. Si estás en `main`, crear la rama
  primero.
- No hacer `git push` a `main` ni mergear pull requests: eso lo hace una
  persona desde GitHub. Pushear la rama de trabajo, sí.
- **Supabase:** con el conector de Supabase (MCP), trabajar en staging
  (`tverjzxsmwnrnpnsimgh`). En producción (`gccbybrslcrecimfblwe`) solo
  lecturas, salvo que la persona pida explícitamente aplicar algo ahí, y
  siempre después de haberlo aplicado y probado en staging.
- Cambios en la base: con `apply_migration`, con el mismo contenido que el
  archivo de `supabase/migrations/`. Nunca DDL suelto con `execute_sql`.
- Antes de aplicar en producción: respaldo, foto de los totales (aportes y
  comprobantes por obra) y, después, comparar la huella del esquema con
  staging y repetir los totales.
- No imprimir ni repetir secretos, tokens de enlaces de rendición ni datos
  personales de inversores en la conversación.
- No iniciar sesión en la app con contraseñas reales: las pruebas con sesión
  las hace la persona o la CI con las contraseñas de staging como secrets.
- Para verificar en el navegador: `npm run dev` y abrir http://localhost:8000
  (staging).
- Al terminar una tarea: correr `npm run test:unit` y
  `npm run test:seguridad`, y decir claramente qué se probó y qué no.
