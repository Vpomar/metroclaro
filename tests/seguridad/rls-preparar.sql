-- =====================================================================
--  Ayudante para las pruebas de RLS. SOLO STAGING / LOCAL.
--
--  pruebas.intentar(sql) ejecuta una sentencia con los permisos de
--  quien llama, cuenta las filas afectadas y SIEMPRE revierte. Devuelve
--  'permitido (n)' o 'rechazado: <sqlstate>'.
-- =====================================================================
create schema if not exists pruebas;

create or replace function pruebas.intentar(p_sql text)
returns text language plpgsql as $$
declare n bigint;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'P0001', message = '__revertir__:' || n;
  exception when others then
    if sqlerrm like '__revertir__:%' then
      return 'permitido (' || split_part(sqlerrm, ':', 2) || ')';
    end if;
    return 'rechazado: ' || sqlstate;
  end;
end $$;

-- pruebas.valor(sql) ejecuta una o más sentencias y devuelve el valor
-- que produce la última (un SELECT), o el error. También revierte siempre.
create or replace function pruebas.valor(p_sql text)
returns text language plpgsql as $$
declare v text;
begin
  begin
    execute p_sql into v;
    raise exception using errcode = 'P0001', message = '__revertir__:' || coalesce(v, 'null');
  exception when others then
    if sqlerrm like '__revertir__:%' then
      return substr(sqlerrm, length('__revertir__:') + 1);
    end if;
    return 'rechazado: ' || sqlstate || ' ' || sqlerrm;
  end;
end $$;

grant usage on schema pruebas to authenticated;
grant execute on function pruebas.intentar(text) to authenticated;
grant execute on function pruebas.valor(text) to authenticated;
