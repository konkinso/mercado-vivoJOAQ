// ============================================
// Panel de tienda — sidebar + dashboard + CRUD + escaneo
// ============================================

let TIENDA_ACTUAL = null;
let PRODUCTOS_ACTUALES = [];

// ---------- Navegación entre vistas ----------
document.querySelectorAll('.ad-nav-item[data-vista]').forEach(boton => {
  boton.addEventListener('click', () => irAVista(boton.dataset.vista));
});

function irAVista(idVista) {
  document.querySelectorAll('.ad-vista').forEach(s => s.classList.remove('visible'));
  document.getElementById(idVista).classList.add('visible');
  document.querySelectorAll('.ad-nav-item[data-vista]').forEach(b => b.classList.remove('activo'));
  const boton = document.querySelector(`.ad-nav-item[data-vista="${idVista}"]`);
  if (boton) boton.classList.add('activo');
}
window.irAVista = irAVista;

// ---------- Verificación de sesión y carga ----------
async function verificarSesionYCargar() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const { data: tienda, error } = await supabaseClient
    .from('tiendas')
    .select('id, nombre, slug, estado_pago')
    .eq('user_id', session.user.id)
    .single();

  if (error || !tienda) {
    document.querySelector('.ad-main').innerHTML = `
      <p class="ad-vacio">No encontramos una tienda ligada a tu cuenta. Contacta al administrador.</p>
      <button class="ad-boton" onclick="cerrarSesion()">Cerrar sesión</button>
    `;
    return;
  }

  TIENDA_ACTUAL = tienda;
  document.getElementById('nombre-tienda-sidebar').textContent = tienda.nombre;

  if (tienda.estado_pago === 'suspendido') {
    document.getElementById('aviso-suspendido').style.display = 'block';
    return;
  }

  document.getElementById('contenido-admin').style.display = 'block';

  const linkPublico = `tienda.html?tienda=${encodeURIComponent(tienda.slug)}`;
  document.getElementById('link-publico-tienda').href = linkPublico;
  document.getElementById('link-publico-tienda').textContent = linkPublico;
  document.getElementById('cuenta-nombre').textContent = tienda.nombre;
  document.getElementById('cuenta-link').href = linkPublico;
  document.getElementById('cuenta-link').textContent = linkPublico;

  pintarEtiquetaEstado('estado-pago-tienda', tienda.estado_pago);
  pintarEtiquetaEstado('cuenta-estado', tienda.estado_pago);

  await cargarProductosAdmin();
}

function pintarEtiquetaEstado(idElemento, estado) {
  const el = document.getElementById(idElemento);
  const textos = { activo: 'Activo', pendiente: 'Pendiente de pago', suspendido: 'Suspendido' };
  el.textContent = textos[estado] || estado;
  el.className = `ad-etiqueta-estado ${estado}`;
}

// ---------- Cargar y pintar productos ----------
async function cargarProductosAdmin() {
  const cuerpo = document.getElementById('cuerpo-tabla-productos');
  try {
    const { data, error } = await supabaseClient
      .from('productos')
      .select('id, nombre, categoria, precio, codigo_barras, stock, imagen_url')
      .eq('tienda_id', TIENDA_ACTUAL.id)
      .order('nombre', { ascending: true });

    if (error) throw error;

    PRODUCTOS_ACTUALES = data || [];
    pintarTablaProductos();
    pintarMetricasDashboard();
  } catch (err) {
    console.error('Error cargando productos:', err);
    cuerpo.innerHTML = `<tr><td colspan="5" class="ad-vacio">No se pudieron cargar los productos.</td></tr>`;
  }
}

function pintarTablaProductos() {
  const cuerpo = document.getElementById('cuerpo-tabla-productos');

  if (!PRODUCTOS_ACTUALES.length) {
    cuerpo.innerHTML = `<tr><td colspan="5" class="ad-vacio">Todavía no tienes productos cargados.</td></tr>`;
    return;
  }

  cuerpo.innerHTML = PRODUCTOS_ACTUALES.map(p => `
    <tr>
      <td style="display:flex;align-items:center;gap:10px;">
        ${p.imagen_url ? `<img src="${p.imagen_url}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex-shrink:0;">` : `<span style="width:36px;height:36px;border-radius:6px;background:var(--ad-oxido-suave);display:flex;align-items:center;justify-content:center;flex-shrink:0;">🌿</span>`}
        ${p.nombre}
      </td>
      <td>${p.categoria || '—'}</td>
      <td class="precio-celda">S/${Number(p.precio).toFixed(2)}</td>
      <td class="mono" style="font-size:0.82rem;">${p.codigo_barras || '—'}</td>
      <td>${p.stock === null || p.stock === undefined ? '—' : (p.stock <= 3 ? `<span style="color:#B4532A;font-weight:600;">${p.stock} ⚠️</span>` : p.stock)}</td>
      <td style="display:flex;gap:6px;">
        <button class="ad-boton" style="padding:6px 12px;font-size:0.8rem;" onclick="abrirModalEditar('${p.id}')">Editar</button>
        <button class="ad-boton" style="padding:6px 12px;font-size:0.8rem;color:#7A1E1E;" onclick="borrarProducto('${p.id}')">Borrar</button>
      </td>
    </tr>
  `).join('');
}

function pintarMetricasDashboard() {
  const productos = PRODUCTOS_ACTUALES;
  document.getElementById('numero-productos').textContent = productos.length;

  if (!productos.length) {
    document.getElementById('precio-promedio').textContent = 'S/0';
    document.getElementById('numero-categorias').textContent = '0';
    return;
  }

  const promedio = productos.reduce((sum, p) => sum + Number(p.precio), 0) / productos.length;
  document.getElementById('precio-promedio').textContent = `S/${promedio.toFixed(2)}`;

  const categorias = new Set(productos.map(p => p.categoria).filter(Boolean));
  document.getElementById('numero-categorias').textContent = categorias.size;

  // Producto(s) estrella: los 3 más caros. Hueso: los 3 más económicos.
  const ordenados = [...productos].sort((a, b) => Number(b.precio) - Number(a.precio));
  const estrella = ordenados.slice(0, 3);
  const hueso = ordenados.slice(-3).reverse();

  document.getElementById('lista-estrella').innerHTML = estrella.map(p => `
    <div class="ad-item-destacado"><span>${p.nombre}</span><span class="precio">S/${Number(p.precio).toFixed(2)}</span></div>
  `).join('');

  document.getElementById('lista-hueso').innerHTML = hueso.map(p => `
    <div class="ad-item-destacado"><span>${p.nombre}</span><span class="precio">S/${Number(p.precio).toFixed(2)}</span></div>
  `).join('');
}

// ---------- Crear producto ----------
// ---------- Previsualización de imagen al seleccionarla ----------
document.getElementById('campo-imagen').addEventListener('change', (e) => {
  const archivo = e.target.files[0];
  const previsualizacion = document.getElementById('previsualizacion-imagen');
  if (!archivo) { previsualizacion.style.display = 'none'; return; }
  const lector = new FileReader();
  lector.onload = (ev) => {
    document.getElementById('imagen-previsualizada').src = ev.target.result;
    previsualizacion.style.display = 'block';
  };
  lector.readAsDataURL(archivo);
});

async function subirImagenProducto(archivo) {
  const extension = archivo.name.split('.').pop();
  const nombreArchivo = `${TIENDA_ACTUAL.id}/${Date.now()}.${extension}`;
  const { error } = await supabaseClient.storage.from('productos-imagenes').upload(nombreArchivo, archivo);
  if (error) throw error;
  const { data } = supabaseClient.storage.from('productos-imagenes').getPublicUrl(nombreArchivo);
  return data.publicUrl;
}

document.getElementById('form-producto').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!TIENDA_ACTUAL) return;

  const botonGuardar = document.getElementById('boton-guardar-producto');
  const archivoImagen = document.getElementById('campo-imagen').files[0];
  const mensajeImagen = document.getElementById('mensaje-imagen');

  botonGuardar.disabled = true;
  botonGuardar.textContent = 'Guardando…';

  try {
    let imagenUrl = null;
    if (archivoImagen) {
      mensajeImagen.textContent = 'Subiendo foto…';
      imagenUrl = await subirImagenProducto(archivoImagen);
    }

    const nuevoProducto = {
      tienda_id: TIENDA_ACTUAL.id,
      nombre: document.getElementById('campo-nombre').value.trim(),
      precio: parseFloat(document.getElementById('campo-precio').value),
      categoria: document.getElementById('campo-categoria').value.trim() || null,
      codigo_barras: document.getElementById('campo-codigo').value.trim() || null,
      stock: document.getElementById('campo-stock').value ? parseInt(document.getElementById('campo-stock').value) : null,
      imagen_url: imagenUrl,
      ar_habilitado: document.getElementById('campo-ar-habilitado').checked,
      plantilla_ar_id: document.getElementById('campo-plantilla-ar').value || null,
    };

    const { error } = await supabaseClient.from('productos').insert([nuevoProducto]);
    if (error) throw error;

    document.getElementById('form-producto').reset();
    document.getElementById('mensaje-autocompletado').textContent = '';
    document.getElementById('mensaje-imagen').textContent = '';
    document.getElementById('previsualizacion-imagen').style.display = 'none';
    await cargarProductosAdmin();
    irAVista('vista-productos');
  } catch (err) {
    console.error('Error guardando producto:', err);
    alert('No se pudo guardar el producto: ' + (err.message || ''));
  } finally {
    botonGuardar.disabled = false;
    botonGuardar.textContent = 'Guardar producto';
  }
});

// ---------- Editar / borrar producto ----------
function abrirModalEditar(id) {
  const producto = PRODUCTOS_ACTUALES.find(p => p.id === id);
  if (!producto) return;

  document.getElementById('editar-id').value = producto.id;
  document.getElementById('editar-nombre').value = producto.nombre;
  document.getElementById('editar-precio').value = producto.precio;
  document.getElementById('editar-categoria').value = producto.categoria || '';
  document.getElementById('editar-codigo').value = producto.codigo_barras || '';
  document.getElementById('editar-imagen').value = '';

  const imgActual = document.getElementById('editar-imagen-actual');
  if (producto.imagen_url) { imgActual.src = producto.imagen_url; imgActual.style.display = 'block'; }
  else imgActual.style.display = 'none';

  document.getElementById('modal-editar').style.display = 'flex';
}
window.abrirModalEditar = abrirModalEditar;

function cerrarModalEditar() {
  document.getElementById('modal-editar').style.display = 'none';
}
window.cerrarModalEditar = cerrarModalEditar;

document.getElementById('form-editar-producto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editar-id').value;

  const cambios = {
    nombre: document.getElementById('editar-nombre').value.trim(),
    precio: parseFloat(document.getElementById('editar-precio').value),
    categoria: document.getElementById('editar-categoria').value.trim() || null,
    codigo_barras: document.getElementById('editar-codigo').value.trim() || null,
  };

  try {
    const archivoNuevo = document.getElementById('editar-imagen').files[0];
    if (archivoNuevo) {
      cambios.imagen_url = await subirImagenProducto(archivoNuevo);
    }

    const { error } = await supabaseClient.from('productos').update(cambios).eq('id', id);
    if (error) throw error;
    cerrarModalEditar();
    await cargarProductosAdmin();
  } catch (err) {
    console.error('Error editando producto:', err);
    alert('No se pudo guardar el cambio: ' + (err.message || ''));
  }
});

async function borrarProducto(id) {
  const producto = PRODUCTOS_ACTUALES.find(p => p.id === id);
  const confirmar = confirm(`¿Seguro que quieres borrar "${producto ? producto.nombre : 'este producto'}"?`);
  if (!confirmar) return;

  try {
    const { error } = await supabaseClient.from('productos').delete().eq('id', id);
    if (error) throw error;
    await cargarProductosAdmin();
  } catch (err) {
    console.error('Error borrando producto:', err);
    alert('No se pudo borrar el producto: ' + (err.message || ''));
  }
}
window.borrarProducto = borrarProducto;

async function cerrarSesion() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}
window.cerrarSesion = cerrarSesion;

// ============================================
// Escaneo de código de barras + autocompletado (Open Food Facts)
// ============================================
let lectorAdmin = null;
let escaneandoAdmin = false;

const botonEscanearAdmin = document.getElementById('boton-escanear-admin');
const contenedorCamaraAdmin = document.getElementById('lector-camara-admin');
const mensajeAutocompletado = document.getElementById('mensaje-autocompletado');

botonEscanearAdmin.addEventListener('click', async () => {
  if (escaneandoAdmin) {
    await detenerCamaraAdmin();
    return;
  }

  contenedorCamaraAdmin.style.display = 'block';
  contenedorCamaraAdmin.innerHTML = '';
  lectorAdmin = new Html5Qrcode("lector-camara-admin");

  try {
    await lectorAdmin.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 140 } },
      async (textoDecodificado) => {
        if (!escaneandoAdmin) return;
        escaneandoAdmin = false;
        document.getElementById('campo-codigo').value = textoDecodificado;
        await detenerCamaraAdmin();
        await buscarYAutocompletar(textoDecodificado);
      },
      () => {}
    );
    escaneandoAdmin = true;
    botonEscanearAdmin.textContent = '⏹ Detener';
  } catch (err) {
    console.error('No se pudo iniciar la cámara:', err);
    mensajeAutocompletado.textContent = 'No se pudo acceder a la cámara. Escribe el código manualmente.';
    contenedorCamaraAdmin.style.display = 'none';
  }
});

async function detenerCamaraAdmin() {
  if (lectorAdmin) {
    try { await lectorAdmin.stop(); await lectorAdmin.clear(); } catch (e) {}
  }
  escaneandoAdmin = false;
  botonEscanearAdmin.textContent = '📷 Escanear';
  contenedorCamaraAdmin.style.display = 'none';
}

async function buscarYAutocompletar(codigo) {
  mensajeAutocompletado.textContent = 'Buscando en base de productos…';
  try {
    const resp = await fetch(`https://world.openfoodfacts.org/api/v2/product/${codigo}.json`);
    const datos = await resp.json();

    if (datos.status === 1 && datos.product) {
      const nombre = datos.product.product_name || datos.product.product_name_es || '';
      const marca = datos.product.brands || '';
      if (nombre) {
        document.getElementById('campo-nombre').value = marca ? `${marca} — ${nombre}` : nombre;
        mensajeAutocompletado.textContent = 'Producto encontrado y autocompletado. Revisa y ajusta el precio.';
        return;
      }
    }
    mensajeAutocompletado.textContent = 'Código guardado. No encontramos este producto en la base pública — escribe el nombre manualmente.';
  } catch (err) {
    console.error('Error consultando Open Food Facts:', err);
    mensajeAutocompletado.textContent = 'Código guardado. No se pudo consultar la base pública — escribe el nombre manualmente.';
  }
}

verificarSesionYCargar();

// ============================================
// Realidad Aumentada: selector de plantilla 3D
// ============================================
document.getElementById('campo-ar-habilitado').addEventListener('change', (e) => {
  document.getElementById('campo-plantilla-ar').style.display = e.target.checked ? 'block' : 'none';
});

async function cargarPlantillasARDisponibles() {
  const select = document.getElementById('campo-plantilla-ar');
  try {
    const { data, error } = await supabaseClient.from('plantillas_ar').select('id, nombre').order('nombre');
    if (error) throw error;
    (data || []).forEach(p => {
      const opcion = document.createElement('option');
      opcion.value = p.id;
      opcion.textContent = p.nombre;
      select.appendChild(opcion);
    });
  } catch (err) {
    console.error('Error cargando plantillas AR:', err);
  }
}
cargarPlantillasARDisponibles();

// ============================================
// Interpretar pedido pegado de WhatsApp → armar boleta
// ============================================
let BOLETA_ACTUAL = [];

document.getElementById('boton-interpretar-pedido').addEventListener('click', () => {
  const texto = document.getElementById('texto-pedido-wsp').value.trim();
  if (!texto) return;

  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  BOLETA_ACTUAL = lineas.map(linea => interpretarLinea(linea)).filter(Boolean);

  pintarBoleta();
});

function interpretarLinea(linea) {
  // Extrae cantidad al inicio (ej. "2 colageno" → cantidad 2, resto "colageno")
  const match = linea.match(/^(\d+)\s*[xX]?\s*(.+)$/);
  const cantidad = match ? parseInt(match[1]) : 1;
  const textoBuscar = (match ? match[2] : linea).toLowerCase().trim();

  if (!textoBuscar) return null;

  // Busca el producto más parecido en el catálogo de la tienda (coincidencia parcial)
  const encontrado = PRODUCTOS_ACTUALES.find(p => p.nombre.toLowerCase().includes(textoBuscar))
    || PRODUCTOS_ACTUALES.find(p => textoBuscar.includes(p.nombre.toLowerCase().split(' ')[0]));

  return {
    textoOriginal: linea,
    cantidad,
    producto: encontrado || null,
  };
}

function pintarBoleta() {
  const cuerpo = document.getElementById('cuerpo-boleta');
  const resultadoDiv = document.getElementById('resultado-pedido');
  resultadoDiv.style.display = 'block';

  let total = 0;

  cuerpo.innerHTML = BOLETA_ACTUAL.map((item, i) => {
    if (!item.producto) {
      return `<tr>
        <td>${item.cantidad}</td>
        <td style="color:#B4532A;">"${item.textoOriginal}" — no encontrado</td>
        <td>—</td><td>—</td>
        <td style="color:#B4532A;">Sin coincidencia</td>
      </tr>`;
    }
    const subtotal = item.cantidad * Number(item.producto.precio);
    total += subtotal;
    return `<tr>
      <td>${item.cantidad}</td>
      <td>${item.producto.nombre}</td>
      <td class="precio-celda">S/${Number(item.producto.precio).toFixed(2)}</td>
      <td class="precio-celda">S/${subtotal.toFixed(2)}</td>
      <td style="color:var(--ad-verde);font-size:0.82rem;">✓ Coincidencia</td>
    </tr>`;
  }).join('');

  document.getElementById('total-boleta').textContent = `S/${total.toFixed(2)}`;
}

document.getElementById('boton-nuevo-pedido').addEventListener('click', () => {
  document.getElementById('texto-pedido-wsp').value = '';
  document.getElementById('telefono-cliente-pedido').value = '';
  document.getElementById('resultado-pedido').style.display = 'none';
  BOLETA_ACTUAL = [];
});

document.getElementById('boton-confirmar-wsp').addEventListener('click', () => {
  const telefono = document.getElementById('telefono-cliente-pedido').value.trim().replace(/\D/g, '');
  const validos = BOLETA_ACTUAL.filter(i => i.producto);
  if (!validos.length) { alert('No hay productos válidos en la boleta.'); return; }

  let mensaje = `Hola, confirmamos tu pedido en ${TIENDA_ACTUAL.nombre}:\n\n`;
  let total = 0;
  validos.forEach(i => {
    const subtotal = i.cantidad * Number(i.producto.precio);
    total += subtotal;
    mensaje += `${i.cantidad}x ${i.producto.nombre} — S/${subtotal.toFixed(2)}\n`;
  });
  mensaje += `\nTotal: S/${total.toFixed(2)}`;

  const url = telefono
    ? `https://wa.me/51${telefono}?text=${encodeURIComponent(mensaje)}`
    : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
});