# Firgo — guía de despliegue

## 1. Supabase — crear el proyecto

1. Entra a supabase.com → **New project**.
2. Nombre: `firgo`. Elige una contraseña de base de datos (guárdala en algún lado, no la vuelves a necesitar seguido). Región: la más cercana a Perú (South America). Espera ~2 minutos a que se cree.
3. Ve a **SQL Editor** (ícono de la izquierda) → **New query** → pega esto completo → **Run**:

```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null,
  category text not null,
  image_url text,
  created_at timestamp with time zone default now()
);

alter table products enable row level security;

create policy "Public read" on products for select using (true);
create policy "Public insert" on products for insert with check (true);
create policy "Public delete" on products for delete using (true);

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true);

create policy "Public read images" on storage.objects for select using (bucket_id = 'product-images');
create policy "Public upload images" on storage.objects for insert with check (bucket_id = 'product-images');
create policy "Public delete images" on storage.objects for delete using (bucket_id = 'product-images');
```

Esto crea la tabla de productos y el espacio de fotos, con permisos abiertos (cualquiera con el link del admin puede publicar — no es seguridad de banco, pero es suficiente para una tienda familiar; la contraseña del `/admin` es el filtro real).

4. Ve a **Settings → API**. Copia dos valores, los vas a necesitar en el paso 3:
   - **Project URL**
   - **anon public** key

## 2. GitHub — subir el código

1. Entra a github.com → **New repository** → nómbralo `firgo-web` → **Create repository**.
2. En la página del repo recién creado, click en **uploading an existing file** (link azul).
3. Arrastra TODA la carpeta `firgo-web` (la que te acabo de dar) hacia esa zona — el navegador debería subir todos los archivos manteniendo las carpetas.
4. Abajo, click **Commit changes**.

## 3. Vercel — desplegar

1. Entra a vercel.com → **Add New → Project**.
2. Elige **Import** en el repositorio `firgo-web` (te va a pedir autorizar acceso a GitHub la primera vez).
3. Antes de darle a Deploy, abre **Environment Variables** y agrega estas tres:

| Nombre | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | el Project URL que copiaste de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | el anon public key que copiaste de Supabase |
| `NEXT_PUBLIC_ADMIN_PASSWORD` | la contraseña que quieras para el `/admin` (invéntala ahora) |

4. Click **Deploy**. Espera 1-2 minutos.
5. Te da una URL tipo `firgo-web.vercel.app` — esa es tu web en vivo.

## 4. Probar todo

1. Abre la URL que te dio Vercel → deberías ver el catálogo vacío (sin productos todavía).
2. Ve a `[tu-url]/admin`, entra con la contraseña que pusiste en el paso 3.
3. Sube un producto con foto real, precio y categoría → **Publicar producto**.
4. Vuelve a la página principal → debería aparecer.
5. Agrégalo al carrito → **Contactar por WhatsApp** → debería abrir WhatsApp con el mensaje y la foto como vista previa.

## Notas

- Cualquier cambio de código futuro: lo edito yo y te doy los archivos nuevos, los vuelves a subir a GitHub (mismo proceso del paso 2) y Vercel redespliega solo.
- Si algo falla en el deploy de Vercel, el error sale en la pestaña **Deployments** del proyecto — mándame captura y lo reviso.
