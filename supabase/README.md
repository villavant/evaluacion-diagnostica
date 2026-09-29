# Backend (Supabase)

Proyecto: `utec-evaluacion-diagnostica` (`blgcpoqhrjuvllmgwhhx`, región sa-east-1).

- `public.enviar_evaluacion(p jsonb)` — la llama el formulario (`index.html`). Califica en el
  servidor, guarda en `public.resultados` y devuelve el puntaje por sección.
- `public.resultados` — solo la pueden leer/borrar los correos de `public.admins` (RLS).
- `public.admins` — correos autorizados para `admin.html` (login con correo y contraseña).
- `privado.clave` — clave de respuestas. El esquema `privado` no se expone por la API.
  **No está en este repositorio.**

## Agregar un admin

1. Supabase → Authentication → Users → **Add user → Create new user**: correo +
   contraseña, con **Auto Confirm User** marcado.
2. En el SQL Editor, autorízalo para ver resultados:

```sql
insert into public.admins (email) values ('nombre@utec.edu.pe');
```

Para quitar el acceso: `delete from public.admins where email = '...';`

## Cambiar la clave de respuestas

Puntaje: Parte I = 20 preguntas × 4 = 80; Parte II (reto) = 7 + 7 + 6 = 20. Total 100.

```sql
update privado.clave set datos = '{"parte1":[...20 índices...],"reto1":{"r1a":0,"r1b":0,"r1c":0},"reto1_pts":{"r1a":7,"r1b":7,"r1c":6}}' where id = 1;
```
