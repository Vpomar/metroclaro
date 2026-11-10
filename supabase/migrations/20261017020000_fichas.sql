-- =====================================================================
--  Fichas
--
--  La participación en efectivo se divide en fichas de un valor fijo.
--  Es más simple de administrar que porcentajes sueltos: se habla de
--  cantidad de fichas, los repartos dan limpios, y cuando alguien
--  quiere salir se transfieren fichas en vez de renegociar.
-- =====================================================================

alter table public.negocios
  add column if not exists valor_ficha numeric(12,2) not null default 5000;

comment on column public.negocios.valor_ficha is
  'Valor de cada ficha de participación en efectivo, en dólares. '
  'El aporte total en efectivo se expresa como cantidad de fichas.';

select 'columna valor_ficha' as objeto,
       (select count(*) from information_schema.columns
        where table_name = 'negocios' and column_name = 'valor_ficha')::text as ok;
