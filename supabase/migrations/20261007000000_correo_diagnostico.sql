-- Correo con el resultado al postulante (con copia a la coordinación).
-- Cada fila nueva de public.resultados dispara la Edge Function
-- enviar-diagnostico, que envía el correo y deja el estado en la misma fila.

create extension if not exists pg_net;

-- correo_estado: null (envíos anteriores a esta función) | pendiente | enviando | enviado | error
alter table public.resultados
  add column if not exists correo_token uuid not null default gen_random_uuid(),
  add column if not exists correo_estado text,
  add column if not exists correo_enviado_en timestamptz,
  add column if not exists correo_error text;

-- Solo las filas nuevas nacen 'pendiente'; las que ya existían quedan en null.
alter table public.resultados alter column correo_estado set default 'pendiente';

create or replace function privado.despachar_correo()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- Nunca debe impedir que se registre el envío del postulante.
  begin
    perform net.http_post(
      url := 'https://blgcpoqhrjuvllmgwhhx.supabase.co/functions/v1/enviar-diagnostico',
      body := jsonb_build_object('id', new.id, 'token', new.correo_token),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 30000
    );
  exception when others then
    raise warning 'No se pudo despachar el correo del resultado %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function privado.despachar_correo() from public;

-- También se dispara al volver una fila a 'pendiente' (reintento manual).
drop trigger if exists resultados_despachar_correo on public.resultados;
create trigger resultados_despachar_correo
  after insert or update of correo_estado on public.resultados
  for each row
  when (new.correo_estado = 'pendiente')
  execute function privado.despachar_correo();
