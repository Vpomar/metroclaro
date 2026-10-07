## Qué cambia

<!-- Una o dos oraciones: qué hace este cambio y por qué. -->

## Tipo de cambio

- [ ] Funcionalidad nueva
- [ ] Corrección
- [ ] Seguridad
- [ ] Base de datos (incluye migración en `supabase/migrations/`)
- [ ] Documentación / mantenimiento

## Cómo se probó

- [ ] En local (`npm run dev`) contra **staging**
- [ ] Sondeo de seguridad sin fallas (`npm run test:seguridad`)
- [ ] Si toca la base: migración aplicada y probada primero en staging
- [ ] Si toca permisos o RLS: pruebas por rol (`tests/seguridad/rls-roles.sql`)

## Antes de mergear

- [ ] No incluye respaldos, `.env.local` ni claves secretas
- [ ] Si hay migración: hay un respaldo reciente de producción
