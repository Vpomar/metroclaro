-- =====================================================================
--  Cuándo se integra el efectivo
--
--  Cambia los números, y bastante. Si cada uno paga su ficha al entrar,
--  el dinero está invertido todo el plazo: devenga más tasa preferente
--  y queda menos rentabilidad para repartir. Si se va llamando a
--  medida que avanza la obra, es al revés.
--
--  Con fichas lo natural es cobrarlas al entrar, pero depende de cómo
--  se arme cada negocio, así que se elige.
-- =====================================================================

alter table public.negocios
  add column if not exists efectivo_al_inicio boolean not null default true;

comment on column public.negocios.efectivo_al_inicio is
  'Verdadero si cada aportante paga su ficha al entrar. Falso si el '
  'dinero se llama a medida que avanza la obra.';

select 'columna efectivo_al_inicio' as objeto,
       (select count(*) from information_schema.columns
        where table_name = 'negocios' and column_name = 'efectivo_al_inicio')::text as ok;
