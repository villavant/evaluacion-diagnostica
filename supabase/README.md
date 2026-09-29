# Backend (Supabase)

Proyecto: `utec-evaluacion-diagnostica` (`blgcpoqhrjuvllmgwhhx`, región sa-east-1).

- `public.enviar_evaluacion(p jsonb)` — la llama el formulario (`index.html`). Califica en el
  servidor, guarda en `public.resultados` y devuelve el puntaje por sección.
- `public.resultados` — solo la pueden leer/borrar los correos de `public.admins` (RLS).
- `public.admins` — correos autorizados para `admin.html`.
- `privado.clave` — clave de respuestas. El esquema `privado` no se expone por la API.
  **No está en este repositorio.**

## Agregar un admin

En el SQL Editor de Supabase:

```sql
insert into public.admins (email) values ('nombre@utec.edu.pe');
```

## Cambiar la clave de respuestas

```sql
update privado.clave set datos = '{"parte1":[...20 índices...],"reto1":{"r1a":0,"r1b":0,"r1c":0},"reto2":0}' where id = 1;
```
