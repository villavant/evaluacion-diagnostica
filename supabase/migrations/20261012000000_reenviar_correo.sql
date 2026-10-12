-- Botón "Reenviar" del panel de administración: vuelve la fila a 'pendiente'
-- y el trigger resultados_despachar_correo dispara de nuevo el envío.

create or replace function public.reenviar_correo(p_id bigint)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.resultados
    set correo_estado = 'pendiente', correo_error = null
    where id = p_id;
  if not found then
    raise exception 'Resultado no encontrado';
  end if;
end;
$$;

revoke all on function public.reenviar_correo(bigint) from public, anon;
grant execute on function public.reenviar_correo(bigint) to authenticated;
