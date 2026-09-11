-- ============================================
-- ESQUEMA: Mercado Vivo — con login y roles
-- Ejecutar en: Supabase > SQL Editor
-- ============================================

-- ---------- 1. Tabla de tiendas (ahora ligada a un usuario de Supabase Auth) ----------
create table if not exists tiendas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null, -- el dueño (login) de esta tienda
  nombre text not null,
  rubro text,
  slug text unique not null,
  estado_pago text not null default 'pendiente', -- 'activo' | 'pendiente' | 'suspendido'
  creado_en timestamp with time zone default now()
);

-- ---------- 2. Tabla de productos (igual que antes, + imagen_url) ----------
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid references tiendas(id) on delete cascade,
  nombre text not null,
  precio numeric(10,2) not null,
  categoria text,
  codigo_barras text,
  icono text,
  imagen_url text,
  creado_en timestamp with time zone default now()
);

create unique index if not exists idx_producto_codigo_por_tienda
  on productos(tienda_id, codigo_barras)
  where codigo_barras is not null;

create index if not exists idx_productos_codigo_barras on productos(codigo_barras);
create index if not exists idx_productos_categoria on productos(categoria);

-- ---------- 3. Tabla de super-admins (para saber quién eres TÚ) ----------
create table if not exists super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ============================================
-- SEGURIDAD (RLS — Row Level Security)
-- Esto es lo que evita que una tienda vea/edite los datos de otra.
-- ============================================

alter table tiendas enable row level security;
alter table productos enable row level security;
alter table super_admins enable row level security;

-- Cualquiera (incluso sin login) puede LEER el directorio de tiendas y productos
create policy "Lectura publica de tiendas" on tiendas
  for select using (true);

create policy "Lectura publica de productos" on productos
  for select using (true);

-- Solo el DUEÑO de la tienda puede modificar SU propia fila en "tiendas"
create policy "Tienda edita su propio registro" on tiendas
  for update using (auth.uid() = user_id);

-- Solo el DUEÑO puede insertar/editar/borrar SUS propios productos
create policy "Tienda administra sus propios productos" on productos
  for insert with check (
    tienda_id in (select id from tiendas where user_id = auth.uid())
  );

create policy "Tienda edita sus propios productos" on productos
  for update using (
    tienda_id in (select id from tiendas where user_id = auth.uid())
  );

create policy "Tienda borra sus propios productos" on productos
  for delete using (
    tienda_id in (select id from tiendas where user_id = auth.uid())
  );

-- Un super-admin puede hacer TODO sobre "tiendas" (crear, activar, suspender)
create policy "Super-admin administra tiendas" on tiendas
  for all using (
    auth.uid() in (select user_id from super_admins)
  );

-- Un super-admin puede leer su propia fila en super_admins
create policy "Super-admin se lee a si mismo" on super_admins
  for select using (auth.uid() = user_id);

-- ============================================
-- Datos de ejemplo (tiendas SIN dueño todavía)
-- ============================================
insert into tiendas (nombre, rubro, slug, estado_pago) values
  ('Bionaturista', 'Extractos y capsulas naturales', 'bionaturista', 'pendiente'),
  ('Force Nature', 'Suplementos y colagenos', 'force-nature', 'pendiente'),
  ('Fitosana', 'Productos herbales', 'fitosana', 'pendiente')
on conflict (slug) do nothing;

-- ============================================
-- COMO CONVERTIRTE EN SUPER-ADMIN (hazlo TU mismo, una sola vez):
-- 1. Registrate en tu propia pagina (login.html) con tu correo.
-- 2. Ve a Supabase > Authentication > Users, copia tu "User UID".
-- 3. Corre esto reemplazando TU-UID-AQUI:
--
-- insert into super_admins (user_id) values ('TU-UID-AQUI');
-- ============================================

-- ============================================
-- AMPLIACIÓN: campos para mejoras del super-admin
-- ============================================
alter table tiendas add column if not exists telefono text;
alter table tiendas add column if not exists notas_internas text;
alter table tiendas add column if not exists fecha_ultimo_pago date;

create table if not exists auditoria (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid references tiendas(id) on delete cascade,
  accion text not null,
  detalle text,
  creado_en timestamp with time zone default now()
);
alter table auditoria enable row level security;
create policy "Super-admin lee auditoria" on auditoria
  for select using (auth.uid() in (select user_id from super_admins));
create policy "Super-admin escribe auditoria" on auditoria
  for insert with check (auth.uid() in (select user_id from super_admins));

-- ============================================
-- AMPLIACIÓN: control de stock
-- ============================================
alter table productos add column if not exists stock integer;

-- ============================================
-- AMPLIACIÓN: guardar nombre de usuario visible para el super-admin
-- ============================================
alter table tiendas add column if not exists nombre_usuario text;

-- ============================================
-- ALMACENAMIENTO: bucket para imágenes de productos
-- ============================================
insert into storage.buckets (id, name, public)
values ('productos-imagenes', 'productos-imagenes', true)
on conflict (id) do nothing;

create policy "Lectura publica de imagenes" on storage.objects
  for select using (bucket_id = 'productos-imagenes');

create policy "Usuarios autenticados suben imagenes" on storage.objects
  for insert with check (bucket_id = 'productos-imagenes' and auth.role() = 'authenticated');

create policy "Usuarios autenticados actualizan sus imagenes" on storage.objects
  for update using (bucket_id = 'productos-imagenes' and auth.role() = 'authenticated');