// ============================================
// Catálogo de tienda + Carrito de compras → WhatsApp
// ============================================

const params = new URLSearchParams(window.location.search);
const slugTienda = params.get('tienda');

let TODOS_LOS_PRODUCTOS = [];
let TIENDA_INFO = null;
let CARRITO = []; // { id, nombre, precio, cantidad }

// ---------- Cargar tienda y productos ----------
async function cargarTienda() {
  if (!slugTienda) {
    document.getElementById('nombre-tienda').textContent =
      'Tienda no especificada';
    return;
  }

  try {
    const { data: tienda, error: errorTienda } = await supabaseClient
      .from('tiendas')
      .select('id, nombre, rubro, slug, telefono')
      .eq('slug', slugTienda)
      .single();

    if (errorTienda || !tienda)
      throw errorTienda || new Error('Tienda no encontrada');
    TIENDA_INFO = tienda;

    document.getElementById('nombre-tienda').textContent = tienda.nombre;
    document.getElementById('rubro-tienda').textContent =
      tienda.rubro || 'Productos naturales';
    document.getElementById('sello-tienda').textContent = tienda.nombre
      .charAt(0)
      .toUpperCase();
    document.getElementById('miga-tienda').textContent = tienda.nombre;
    document.title = `${tienda.nombre} — Mercado Vivo`;

    await cargarProductos(tienda.id);
    cargarCarritoDesdeMemoria();
  } catch (err) {
    console.error('Error cargando tienda:', err);
    document.getElementById('nombre-tienda').textContent =
      'No se encontró esta tienda';
  }
}

async function cargarProductos(tiendaId) {
  const contenedor = document.getElementById('grilla-productos');
  try {
    const { data, error } = await supabaseClient
      .from('productos')
      .select('id, nombre, precio, categoria, icono, imagen_url, stock')
      .eq('tienda_id', tiendaId)
      .order('nombre', { ascending: true });

    if (error) throw error;
    TODOS_LOS_PRODUCTOS = data || [];
    renderizarProductos(TODOS_LOS_PRODUCTOS);
  } catch (err) {
    console.error('Error cargando productos:', err);
    contenedor.innerHTML = `<p class="tv-vacio">No se pudieron cargar los productos.</p>`;
  }
}

function renderizarProductos(lista) {
  const contenedor = document.getElementById('grilla-productos');
  if (!lista.length) {
    contenedor.innerHTML = `<p class="tv-vacio">Esta tienda todavía no tiene productos cargados.</p>`;
    return;
  }

  contenedor.innerHTML = lista
    .map((p) => {
      const sinStock =
        p.stock !== null && p.stock !== undefined && p.stock <= 0;
      const imagen = p.imagen_url
        ? `<img src="${p.imagen_url}" alt="${p.nombre}">`
        : p.icono || '🌿';

      return `
    <div class="tv-tarjeta-producto">
      <div class="tv-imagen-producto">${imagen}</div>
      <div class="tv-cuerpo-producto">
        <div class="tv-marca-producto">${p.categoria || 'Natural'}</div>
        <h3>${p.nombre}</h3>
        ${sinStock ? '<div class="tv-sin-stock">Agotado</div>' : ''}
        <div class="tv-fila-precio">
          <span class="tv-precio">S/${Number(p.precio).toFixed(2)}</span>
          ${
            sinStock
              ? ''
              : `<button class="tv-boton-agregar" onclick="agregarAlCarrito('${p.id}')" title="Agregar al carrito">+</button>`
          }
        </div>
      </div>
    </div>`;
    })
    .join('');
}

document.getElementById('buscador-productos').addEventListener('input', (e) => {
  const texto = e.target.value.toLowerCase();
  renderizarProductos(
    TODOS_LOS_PRODUCTOS.filter((p) => p.nombre.toLowerCase().includes(texto))
  );
});

// ============================================
// Carrito de compras
// ============================================
function agregarAlCarrito(productoId) {
  const producto = TODOS_LOS_PRODUCTOS.find((p) => p.id === productoId);
  if (!producto) return;

  const existente = CARRITO.find((i) => i.id === productoId);
  if (existente) existente.cantidad += 1;
  else
    CARRITO.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: 1,
    });

  guardarCarritoEnMemoria();
  pintarCarrito();

  const botonCarrito = document.getElementById('boton-carrito');
  botonCarrito.classList.remove('pulso');
  void botonCarrito.offsetWidth; // reinicia la animación si se toca varias veces seguidas
  botonCarrito.classList.add('pulso');

  abrirDrawer();
}
window.agregarAlCarrito = agregarAlCarrito;

function cambiarCantidad(productoId, delta) {
  const item = CARRITO.find((i) => i.id === productoId);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) CARRITO = CARRITO.filter((i) => i.id !== productoId);
  guardarCarritoEnMemoria();
  pintarCarrito();
}
window.cambiarCantidad = cambiarCantidad;

function quitarDelCarrito(productoId) {
  CARRITO = CARRITO.filter((i) => i.id !== productoId);
  guardarCarritoEnMemoria();
  pintarCarrito();
}
window.quitarDelCarrito = quitarDelCarrito;

function pintarCarrito() {
  const lista = document.getElementById('lista-carrito');
  const badge = document.getElementById('badge-carrito');
  const totalCantidad = CARRITO.reduce((s, i) => s + i.cantidad, 0);

  if (totalCantidad > 0) {
    badge.textContent = totalCantidad;
    badge.style.display = 'flex';
  } else badge.style.display = 'none';

  if (!CARRITO.length) {
    lista.innerHTML = `<p class="tv-vacio">Tu carrito está vacío.</p>`;
    document.getElementById('total-carrito').textContent = 'S/0.00';
    return;
  }

  lista.innerHTML = CARRITO.map(
    (item) => `
    <div class="tv-item-carrito">
      <div class="info">
        <h4>${item.nombre}</h4>
        <div class="precio-u">S/${Number(item.precio).toFixed(2)} c/u</div>
      </div>
      <div class="tv-control-cantidad">
        <button onclick="cambiarCantidad('${item.id}', -1)">−</button>
        <span>${item.cantidad}</span>
        <button onclick="cambiarCantidad('${item.id}', 1)">+</button>
      </div>
      <button class="tv-quitar-item" onclick="quitarDelCarrito('${
        item.id
      }')">Quitar</button>
    </div>
  `
  ).join('');

  const total = CARRITO.reduce((s, i) => s + i.cantidad * Number(i.precio), 0);
  document.getElementById('total-carrito').textContent = `S/${total.toFixed(
    2
  )}`;
}

// Persistencia simple en memoria de sesión (no localStorage, para no perder datos entre tiendas distintas se limpia por slug)
function guardarCarritoEnMemoria() {
  window._carritoMercadoVivo = window._carritoMercadoVivo || {};
  window._carritoMercadoVivo[slugTienda] = CARRITO;
}
function cargarCarritoDesdeMemoria() {
  window._carritoMercadoVivo = window._carritoMercadoVivo || {};
  CARRITO = window._carritoMercadoVivo[slugTienda] || [];
  pintarCarrito();
}

// ---------- Abrir/cerrar drawer ----------
function abrirDrawer() {
  document.getElementById('drawer-carrito').classList.add('abierto');
  document.getElementById('fondo-drawer').classList.add('abierto');
}
function cerrarDrawer() {
  document.getElementById('drawer-carrito').classList.remove('abierto');
  document.getElementById('fondo-drawer').classList.remove('abierto');
}
document.getElementById('boton-carrito').addEventListener('click', abrirDrawer);
document
  .getElementById('cerrar-drawer')
  .addEventListener('click', cerrarDrawer);
document.getElementById('fondo-drawer').addEventListener('click', cerrarDrawer);

// ---------- Enviar pedido por WhatsApp ----------
document.getElementById('boton-enviar-pedido').addEventListener('click', () => {
  if (!CARRITO.length) {
    alert('Tu carrito está vacío.');
    return;
  }
  if (!TIENDA_INFO || !TIENDA_INFO.telefono) {
    alert(
      'Esta tienda todavía no registró un número de WhatsApp. Contacta al administrador de Mercado Vivo.'
    );
    return;
  }

  let mensaje = `Hola ${TIENDA_INFO.nombre}, quiero hacer este pedido:\n\n`;
  let total = 0;
  CARRITO.forEach((item) => {
    const subtotal = item.cantidad * Number(item.precio);
    total += subtotal;
    mensaje += `${item.cantidad}x ${item.nombre} — S/${subtotal.toFixed(2)}\n`;
  });
  mensaje += `\nTotal: S/${total.toFixed(2)}`;

  const telefonoComprador = document
    .getElementById('telefono-comprador')
    .value.trim();
  if (telefonoComprador) mensaje += `\n\nMi número: ${telefonoComprador}`;

  const telefonoTienda = TIENDA_INFO.telefono.replace(/\D/g, '');
  window.open(
    `https://wa.me/51${telefonoTienda}?text=${encodeURIComponent(mensaje)}`,
    '_blank'
  );
});

cargarTienda();
