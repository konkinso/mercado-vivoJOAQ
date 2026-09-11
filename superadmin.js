// ============================================
// Panel de super-admin — versión completa con mejoras
// ============================================

let TODAS_TIENDAS = [];
let FILTRO_ACTUAL = 'todos';

document
  .querySelectorAll('.sa-nav-item[data-vista]')
  .forEach((b) => b.addEventListener('click', () => irAVista(b.dataset.vista)));

function irAVista(idVista) {
  document
    .querySelectorAll('.sa-seccion-vista')
    .forEach((s) => s.classList.remove('visible'));
  document.getElementById(idVista).classList.add('visible');
  document
    .querySelectorAll('.sa-nav-item[data-vista]')
    .forEach((b) => b.classList.remove('activo'));
  const boton = document.querySelector(`.sa-nav-item[data-vista="${idVista}"]`);
  if (boton) boton.classList.add('activo');
  if (idVista === 'vista-auditoria') cargarAuditoria();
  if (idVista === 'vista-crear') limpiarFormularioNuevaTienda();
}
window.irAVista = irAVista;

function limpiarFormularioNuevaTienda() {
  const form = document.getElementById('form-nueva-tienda');
  if (form) form.reset();
  correoEditadoManualmente = false;
  const campoTel = document.getElementById('nueva-telefono');
  if (campoTel) {
    campoTel.classList.remove('campo-error');
    document.getElementById('error-telefono').style.display = 'none';
  }
  document.getElementById('tarjeta-links-generados').style.display = 'none';
}

function irAVistaConFiltro(filtro) {
  irAVista('vista-tiendas');
  FILTRO_ACTUAL = filtro;
  document
    .querySelectorAll('.sa-filtro')
    .forEach((b) => b.classList.toggle('activo', b.dataset.filtro === filtro));
  aplicarFiltroYBuscador();
}
window.irAVistaConFiltro = irAVistaConFiltro;

async function verificarAccesoSuperAdmin() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const { data: soyAdmin, error } = await supabaseClient
    .from('super_admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error || !soyAdmin) {
    document.getElementById('aviso-acceso').style.display = 'block';
    return;
  }

  document.getElementById('contenido-superadmin').style.display = 'block';
  await cargarTodo();
}

async function cargarTodo() {
  try {
    const { data, error } = await supabaseClient
      .from('tiendas')
      .select(
        'id, nombre, rubro, slug, estado_pago, creado_en, telefono, notas_internas, fecha_ultimo_pago, nombre_usuario'
      )
      .order('creado_en', { ascending: false });
    if (error) throw error;
    TODAS_TIENDAS = data || [];
    pintarMetricas();
    pintarSolicitudesPendientes();
    aplicarFiltroYBuscador();
  } catch (err) {
    console.error('Error cargando tiendas:', err);
  }
}

function diasDesde(fecha) {
  if (!fecha) return Infinity;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

function pintarMetricas() {
  const activas = TODAS_TIENDAS.filter(
    (t) => t.estado_pago === 'activo'
  ).length;
  const pendientes = TODAS_TIENDAS.filter(
    (t) => t.estado_pago === 'pendiente'
  ).length;
  const vencidas = TODAS_TIENDAS.filter(
    (t) => t.estado_pago === 'activo' && diasDesde(t.fecha_ultimo_pago) > 30
  ).length;

  document.getElementById('total-tiendas').textContent = TODAS_TIENDAS.length;
  document.getElementById('total-activas').textContent = activas;
  document.getElementById('total-pendientes').textContent = pendientes;
  document.getElementById('ingreso-mensual').textContent = `S/${activas * 20}`;

  const badge = document.getElementById('badge-solicitudes');
  if (pendientes > 0) {
    badge.textContent = pendientes;
    badge.style.display = 'inline-block';
  } else badge.style.display = 'none';

  const avisoVenc = document.getElementById('aviso-vencidos');
  if (vencidas > 0) {
    avisoVenc.style.display = 'flex';
    document.getElementById('numero-vencidos-aviso').textContent = vencidas;
  } else avisoVenc.style.display = 'none';
}

function pintarSolicitudesPendientes() {
  const pendientes = TODAS_TIENDAS.filter((t) => t.estado_pago === 'pendiente');
  const lista = document.getElementById('lista-solicitudes');
  const aviso = document.getElementById('aviso-solicitudes');

  if (!pendientes.length) {
    lista.innerHTML = `<p class="sa-vacio">No hay solicitudes pendientes.</p>`;
    aviso.style.display = 'none';
    return;
  }

  aviso.style.display = 'flex';
  document.getElementById('numero-solicitudes-aviso').textContent =
    pendientes.length;
  lista.innerHTML = pendientes
    .map(
      (t) => `
    <div class="sa-solicitud">
      <div class="info-tienda"><span class="nombre">${
        t.nombre
      }</span><span class="meta">${
        t.rubro || 'Sin rubro'
      } · registrada el ${formatearFecha(t.creado_en)}</span></div>
      <div class="acciones">
        <button class="sa-boton sa-boton-aprobar" onclick="cambiarEstadoTienda('${
          t.id
        }','activo','Aprobación de solicitud')">Aprobar</button>
        <button class="sa-boton sa-boton-rechazar" onclick="confirmarAccion('¿Rechazar la solicitud de ${
          t.nombre
        }?', () => cambiarEstadoTienda('${
        t.id
      }','suspendido','Solicitud rechazada'))">Rechazar</button>
      </div>
    </div>
  `
    )
    .join('');
}

// ---------- Filtros + buscador ----------
document.querySelectorAll('.sa-filtro').forEach((btn) => {
  btn.addEventListener('click', () => {
    document
      .querySelectorAll('.sa-filtro')
      .forEach((b) => b.classList.remove('activo'));
    btn.classList.add('activo');
    FILTRO_ACTUAL = btn.dataset.filtro;
    aplicarFiltroYBuscador();
  });
});
document
  .getElementById('buscador-tiendas')
  .addEventListener('input', aplicarFiltroYBuscador);

function aplicarFiltroYBuscador() {
  const texto = document.getElementById('buscador-tiendas').value.toLowerCase();
  let lista = TODAS_TIENDAS;
  if (FILTRO_ACTUAL !== 'todos')
    lista = lista.filter((t) => t.estado_pago === FILTRO_ACTUAL);
  if (texto)
    lista = lista.filter((t) => t.nombre.toLowerCase().includes(texto));
  pintarTablaTiendas(lista);
}

function pintarTablaTiendas(lista) {
  const cuerpo = document.getElementById('cuerpo-tabla-tiendas');
  if (!lista.length) {
    cuerpo.innerHTML = `<tr><td colspan="5" class="sa-vacio">No hay tiendas con ese filtro.</td></tr>`;
    return;
  }

  cuerpo.innerHTML = lista
    .map((t) => {
      const dias = diasDesde(t.fecha_ultimo_pago);
      const vencido = t.estado_pago === 'activo' && dias > 30;
      return `
    <tr class="${vencido ? 'sa-fila-vencida' : ''}">
      <td><strong>${t.nombre}</strong>${
        t.notas_internas
          ? `<div style="font-size:0.75rem;color:var(--sa-texto-suave);">📝 ${t.notas_internas}</div>`
          : ''
      }</td>
      <td>
        <div class="sa-fila-estado">
          <button class="sa-interruptor ${
            t.estado_pago === 'activo'
              ? 'activo'
              : t.estado_pago === 'pendiente'
              ? 'pendiente'
              : ''
          }"
            onclick="confirmarAccion('¿Cambiar el estado de ${
              t.nombre
            }?', () => alternarEstado('${t.id}','${t.estado_pago}','${
        t.nombre
      }'))"></button>
          <span class="sa-texto-estado ${t.estado_pago}">${etiquetaTexto(
        t.estado_pago
      )}</span>
        </div>
      </td>
      <td>${t.fecha_ultimo_pago ? formatearFecha(t.fecha_ultimo_pago) : '—'} ${
        vencido ? '<div class="sa-texto-vencido">Vencido (+30 días)</div>' : ''
      }</td>
      <td><a href="tienda.html?tienda=${encodeURIComponent(
        t.slug
      )}" style="color:var(--sa-verde-brillo);" target="_blank">Ver catálogo</a></td>
      <td class="sa-acciones-fila">
        <button class="sa-icono-accion" title="Ver panel de esta tienda" onclick="window.open('admin.html?ver_tienda=${
          t.id
        }','_blank')">👁</button>
        <button class="sa-icono-accion" title="Editar" onclick="abrirModalEditarTienda('${
          t.id
        }')">✏️</button>
        ${
          t.telefono
            ? `<button class="sa-icono-accion" title="WhatsApp" onclick="window.open('https://wa.me/51${t.telefono.replace(
                /\\D/g,
                ''
              )}?text=${encodeURIComponent(
                'Hola ' +
                  t.nombre +
                  ', te escribimos de Mercado Vivo sobre tu suscripción.'
              )}','_blank')">💬</button>`
            : ''
        }
      </td>
    </tr>
  `;
    })
    .join('');
}

function etiquetaTexto(estado) {
  return estado === 'activo'
    ? 'Activo'
    : estado === 'suspendido'
    ? 'Suspendido'
    : 'Pendiente';
}
function formatearFecha(fechaISO) {
  if (!fechaISO) return '—';
  return new Date(fechaISO).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ---------- Confirmaciones ----------
function confirmarAccion(mensaje, callback) {
  if (confirm(mensaje)) callback();
}
window.confirmarAccion = confirmarAccion;

async function alternarEstado(tiendaId, estadoActual, nombreTienda) {
  const nuevoEstado = estadoActual === 'activo' ? 'suspendido' : 'activo';
  await cambiarEstadoTienda(
    tiendaId,
    nuevoEstado,
    `Cambio manual desde tabla (${nombreTienda})`
  );
}
window.alternarEstado = alternarEstado;

async function cambiarEstadoTienda(tiendaId, nuevoEstado, motivo) {
  try {
    const cambios = { estado_pago: nuevoEstado };
    if (nuevoEstado === 'activo')
      cambios.fecha_ultimo_pago = new Date().toISOString().split('T')[0];

    const { error } = await supabaseClient
      .from('tiendas')
      .update(cambios)
      .eq('id', tiendaId);
    if (error) throw error;

    await registrarAuditoria(tiendaId, `Estado → ${nuevoEstado}`, motivo);
    await cargarTodo();
  } catch (err) {
    console.error('Error actualizando estado:', err);
    alert('No se pudo actualizar: ' + (err.message || ''));
  }
}
window.cambiarEstadoTienda = cambiarEstadoTienda;

// ---------- Editar / eliminar tienda ----------
function abrirModalEditarTienda(id) {
  const t = TODAS_TIENDAS.find((x) => x.id === id);
  if (!t) return;
  document.getElementById('editar-tienda-id').value = t.id;
  document.getElementById('editar-tienda-nombre').value = t.nombre;
  document.getElementById('editar-tienda-usuario').value =
    t.nombre_usuario || '(no registrado — tienda creada antes de esta función)';
  document.getElementById('editar-tienda-rubro').value = t.rubro || '';
  document.getElementById('editar-tienda-telefono').value = t.telefono || '';
  document.getElementById('editar-tienda-notas').value = t.notas_internas || '';
  document.getElementById('editar-tienda-fecha-pago').value =
    t.fecha_ultimo_pago || '';
  document.getElementById('modal-editar-tienda').classList.add('abierto');
}

function resetearClaveTienda() {
  alert(
    'Por seguridad, Supabase no permite cambiar la contraseña de otro usuario directo desde el navegador. Para esto se necesita una función de servidor especial (Edge Function) que aún no está construida — la agregamos como siguiente mejora. Por ahora, la única forma es eliminar y volver a crear la tienda con un usuario/contraseña nuevos.'
  );
}
window.resetearClaveTienda = resetearClaveTienda;
window.abrirModalEditarTienda = abrirModalEditarTienda;

function cerrarModalEditarTienda() {
  document.getElementById('modal-editar-tienda').classList.remove('abierto');
}
window.cerrarModalEditarTienda = cerrarModalEditarTienda;

document
  .getElementById('form-editar-tienda')
  .addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editar-tienda-id').value;
    const cambios = {
      nombre: document.getElementById('editar-tienda-nombre').value.trim(),
      rubro:
        document.getElementById('editar-tienda-rubro').value.trim() || null,
      telefono:
        document.getElementById('editar-tienda-telefono').value.trim() || null,
      notas_internas:
        document.getElementById('editar-tienda-notas').value.trim() || null,
      fecha_ultimo_pago:
        document.getElementById('editar-tienda-fecha-pago').value || null,
    };
    try {
      const { error } = await supabaseClient
        .from('tiendas')
        .update(cambios)
        .eq('id', id);
      if (error) throw error;
      await registrarAuditoria(id, 'Datos editados', 'Edición desde panel');
      cerrarModalEditarTienda();
      await cargarTodo();
    } catch (err) {
      alert('No se pudo guardar: ' + (err.message || ''));
    }
  });

function eliminarTiendaConfirmado() {
  const id = document.getElementById('editar-tienda-id').value;
  const nombre = document.getElementById('editar-tienda-nombre').value;
  if (
    !confirm(
      `¿ELIMINAR PERMANENTEMENTE "${nombre}" y todos sus productos? Esta acción no se puede deshacer.`
    )
  )
    return;
  if (!confirm('Confirma una segunda vez: esto es irreversible.')) return;
  eliminarTienda(id);
}
window.eliminarTiendaConfirmado = eliminarTiendaConfirmado;

async function eliminarTienda(id) {
  try {
    const { error } = await supabaseClient
      .from('tiendas')
      .delete()
      .eq('id', id);
    if (error) throw error;
    cerrarModalEditarTienda();
    await cargarTodo();
  } catch (err) {
    alert('No se pudo eliminar: ' + (err.message || ''));
  }
}

// ---------- Auditoría ----------
async function registrarAuditoria(tiendaId, accion, detalle) {
  try {
    await supabaseClient
      .from('auditoria')
      .insert([{ tienda_id: tiendaId, accion, detalle }]);
  } catch (err) {
    console.error('No se pudo registrar auditoría:', err);
  }
}

async function cargarAuditoria() {
  const cont = document.getElementById('lista-auditoria');
  try {
    const { data, error } = await supabaseClient
      .from('auditoria')
      .select('accion, detalle, creado_en, tiendas(nombre)')
      .order('creado_en', { ascending: false })
      .limit(50);
    if (error) throw error;
    if (!data || !data.length) {
      cont.innerHTML = `<p class="sa-vacio">Sin actividad registrada todavía.</p>`;
      return;
    }

    cont.innerHTML = data
      .map(
        (a) => `
      <div class="sa-solicitud">
        <div class="info-tienda">
          <span class="nombre">${
            a.tiendas ? a.tiendas.nombre : 'Tienda eliminada'
          } — ${a.accion}</span>
          <span class="meta">${a.detalle || ''} · ${new Date(
          a.creado_en
        ).toLocaleString('es-PE')}</span>
        </div>
      </div>
    `
      )
      .join('');
  } catch (err) {
    cont.innerHTML = `<p class="sa-vacio">No se pudo cargar el historial.</p>`;
  }
}

// ---------- Exportar Excel ----------
function exportarExcel() {
  const datos = TODAS_TIENDAS.map((t) => ({
    Nombre: t.nombre,
    Rubro: t.rubro || '',
    Estado: etiquetaTexto(t.estado_pago),
    Telefono: t.telefono || '',
    UltimoPago: t.fecha_ultimo_pago || '',
    Notas: t.notas_internas || '',
    Registrada: formatearFecha(t.creado_en),
  }));
  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Tiendas');
  XLSX.writeFile(
    libro,
    `mercado-vivo-tiendas-${new Date().toISOString().split('T')[0]}.xlsx`
  );
}
window.exportarExcel = exportarExcel;

// ---------- Validación de teléfono (9 dígitos) ----------
const campoTelefonoNuevo = document.getElementById('nueva-telefono');
campoTelefonoNuevo.addEventListener('input', () => {
  campoTelefonoNuevo.value = campoTelefonoNuevo.value
    .replace(/\D/g, '')
    .slice(0, 9);
  validarTelefonoNuevo();
});
function validarTelefonoNuevo() {
  const valor = campoTelefonoNuevo.value;
  const errorEl = document.getElementById('error-telefono');
  const valido =
    valor.length === 0 || (valor.length === 9 && valor.startsWith('9'));
  if (valor.length > 0 && !valido) {
    campoTelefonoNuevo.classList.add('campo-error');
    errorEl.style.display = 'inline';
    return false;
  }
  campoTelefonoNuevo.classList.remove('campo-error');
  errorEl.style.display = 'none';
  return valido;
}

// ---------- Generadores de correo ----------
function limpiarParaCorreo(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)[0]; // solo la primera palabra del nombre, sin espacios
}

// Palabras relacionadas a productos naturales, para que el correo tenga sentido con el rubro
const PALABRAS_NATURALES = [
  'natura',
  'bio',
  'verde',
  'vital',
  'organico',
  'herbal',
  'pura',
  'vida',
  'planta',
  'eco',
];
function generarColaAleatoria() {
  const palabra =
    PALABRAS_NATURALES[Math.floor(Math.random() * PALABRAS_NATURALES.length)];
  const numero = Math.floor(Math.random() * 90 + 10);
  return `${palabra}${numero}`;
}

// ---------- Correo automático según el nombre de tienda ----------
let correoEditadoManualmente = false;

document.getElementById('nueva-correo').addEventListener('input', () => {
  correoEditadoManualmente = true;
});

document.getElementById('nueva-nombre').addEventListener('input', () => {
  if (correoEditadoManualmente) return; // si el usuario ya lo tocó a mano, no lo pisamos
  const nombre = document.getElementById('nueva-nombre').value.trim();
  const campoCorreo = document.getElementById('nueva-correo');
  if (!nombre) {
    campoCorreo.value = '';
    return;
  }
  const base = limpiarParaCorreo(nombre);
  campoCorreo.value = base ? `${base}${generarColaAleatoria()}` : '';
});

// ---------- Links generados en vivo (acceso + público) según el nombre ----------
document
  .getElementById('nueva-nombre')
  .addEventListener('input', actualizarLinksGenerados);

function slugificar(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function actualizarLinksGenerados() {
  const nombre = document.getElementById('nueva-nombre').value.trim();
  const tarjeta = document.getElementById('tarjeta-links-generados');

  if (!nombre) {
    tarjeta.style.display = 'none';
    return;
  }

  const slug = slugificar(nombre);
  const base =
    window.location.origin +
    window.location.pathname.replace('superadmin.html', '');

  document.getElementById(
    'link-acceso-generado'
  ).textContent = `${base}login.html`;
  document.getElementById(
    'link-publico-generado'
  ).textContent = `${base}tienda.html?tienda=${slug}`;
  tarjeta.style.display = 'flex';
}

document.querySelectorAll('.sa-boton-copiar').forEach((boton) => {
  boton.addEventListener('click', async () => {
    const idValor = boton.dataset.copiar;
    const texto = document.getElementById(idValor).textContent;
    try {
      await navigator.clipboard.writeText(texto);
      const textoOriginal = boton.textContent;
      boton.textContent = '✓ Copiado';
      boton.classList.add('copiado');
      setTimeout(() => {
        boton.textContent = textoOriginal;
        boton.classList.remove('copiado');
      }, 1800);
    } catch (err) {
      alert('No se pudo copiar automáticamente. Copia manualmente: ' + texto);
    }
  });
});

document
  .getElementById('boton-correo-aleatorio')
  .addEventListener('click', () => {
    const nombre = document.getElementById('nueva-nombre').value.trim();
    const base = nombre ? limpiarParaCorreo(nombre) : 'tienda';
    document.getElementById(
      'nueva-correo'
    ).value = `${base}${generarColaAleatoria()}`;
    correoEditadoManualmente = true;
  });

// ---------- Ojito de contraseña ----------
document.getElementById('boton-ver-clave').addEventListener('click', () => {
  const campo = document.getElementById('nueva-clave');
  campo.type = campo.type === 'password' ? 'text' : 'password';
});

// ---------- Generador de contraseña "cool" basada en el nombre de la tienda ----------
const PALABRAS_CHEVERE = [
  'Vivo',
  'Sol',
  'Verde',
  'Vital',
  'Fresco',
  'Puro',
  'Bio',
  'Luz',
  'Rio',
  'Flor',
];
document
  .getElementById('boton-clave-aleatoria')
  .addEventListener('click', () => {
    const nombre = document.getElementById('nueva-nombre').value.trim();
    const base = nombre ? limpiarParaCorreo(nombre) : 'tienda';
    const inicialMayus = base.charAt(0).toUpperCase() + base.slice(1);
    const palabra =
      PALABRAS_CHEVERE[Math.floor(Math.random() * PALABRAS_CHEVERE.length)];
    const numero = Math.floor(Math.random() * 90 + 10);
    const clave = `${inicialMayus}${palabra}${numero}`;
    document.getElementById('nueva-clave').value = clave;
    document.getElementById('nueva-clave').type = 'text';
  });

// ---------- Crear tienda ----------
document
  .getElementById('form-nueva-tienda')
  .addEventListener('submit', async (e) => {
    e.preventDefault();

    const telefono = document.getElementById('nueva-telefono').value.trim();
    if (telefono && !validarTelefonoNuevo()) {
      alert(
        'Revisa el número de teléfono: debe empezar con 9 y tener 9 dígitos.'
      );
      return;
    }

    const nombre = document.getElementById('nueva-nombre').value.trim();
    const rubro = document.getElementById('nueva-rubro').value;
    const nombreUsuario = document
      .getElementById('nueva-correo')
      .value.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const clave = document.getElementById('nueva-clave').value;
    const slug = nombre
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    if (!nombreUsuario) {
      alert('Falta el nombre de usuario.');
      return;
    }

    // Supabase Auth requiere formato de correo por dentro, pero el dueño solo ve/usa su "nombre de usuario"
    const correoInterno = `${nombreUsuario}@mercadovivo.app`;

    try {
      // Guardamos la sesión actual del super-admin, porque signUp() la reemplaza
      // automáticamente por la del usuario recién creado.
      const { data: sesionActual } = await supabaseClient.auth.getSession();
      const sesionAdminGuardada = sesionActual.session;

      const { data, error } = await supabaseClient.auth.signUp({
        email: correoInterno,
        password: clave,
      });
      if (error) throw error;

      // Restauramos la sesión del super-admin antes de insertar la tienda,
      // para que la política de seguridad (RLS) lo reconozca como super-admin.
      if (sesionAdminGuardada) {
        await supabaseClient.auth.setSession({
          access_token: sesionAdminGuardada.access_token,
          refresh_token: sesionAdminGuardada.refresh_token,
        });
      }

      const { data: tiendaCreada, error: errorTienda } = await supabaseClient
        .from('tiendas')
        .insert([
          {
            user_id: data.user.id,
            nombre,
            rubro,
            telefono: telefono || null,
            nombre_usuario: nombreUsuario,
            estado_pago: 'activo',
            fecha_ultimo_pago: new Date().toISOString().split('T')[0],
            slug,
          },
        ])
        .select()
        .single();
      if (errorTienda) throw errorTienda;

      await registrarAuditoria(
        tiendaCreada.id,
        'Tienda creada',
        'Alta directa por super-admin'
      );
      document.getElementById('form-nueva-tienda').reset();
      await cargarTodo();
      irAVista('vista-tiendas');
      mostrarBoletaCredenciales(nombre, nombreUsuario, clave, slug, telefono);
    } catch (err) {
      alert('No se pudo crear la tienda: ' + (err.message || ''));
    }
  });

async function cerrarSesion() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}
window.cerrarSesion = cerrarSesion;

// ---------- Boleta de credenciales (tipo "boleta" para el cliente) ----------
let TELEFONO_BOLETA_ACTUAL = '';

function mostrarBoletaCredenciales(
  nombreTienda,
  usuario,
  clave,
  slug,
  telefono
) {
  const base =
    window.location.origin +
    window.location.pathname.replace('superadmin.html', '');
  document.getElementById('boleta-nombre').textContent = nombreTienda;
  document.getElementById('boleta-usuario').textContent = usuario;
  document.getElementById('boleta-clave').textContent = clave;
  document.getElementById(
    'boleta-link-login'
  ).textContent = `${base}login.html`;
  document.getElementById(
    'boleta-link-publico'
  ).textContent = `${base}tienda.html?tienda=${slug}`;
  TELEFONO_BOLETA_ACTUAL = telefono || '';
  document.getElementById('modal-credenciales').classList.add('abierto');
}

function cerrarModalCredenciales() {
  document.getElementById('modal-credenciales').classList.remove('abierto');
}
window.cerrarModalCredenciales = cerrarModalCredenciales;

document
  .getElementById('boton-descargar-boleta')
  .addEventListener('click', async () => {
    const elemento = document.getElementById('boleta-para-capturar');
    try {
      const canvas = await html2canvas(elemento, {
        backgroundColor: '#FFFEFA',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `credenciales-${document
        .getElementById('boleta-nombre')
        .textContent.toLowerCase()
        .replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      alert(
        'No se pudo generar la imagen. Puedes hacer una captura de pantalla manualmente.'
      );
    }
  });

document
  .getElementById('boton-enviar-boleta-wsp')
  .addEventListener('click', () => {
    const nombre = document.getElementById('boleta-nombre').textContent;
    const usuario = document.getElementById('boleta-usuario').textContent;
    const clave = document.getElementById('boleta-clave').textContent;
    const linkLogin = document.getElementById('boleta-link-login').textContent;
    const linkPublico = document.getElementById(
      'boleta-link-publico'
    ).textContent;

    const mensaje =
      `Hola, aquí tienes tus datos de acceso a Mercado Vivo 🌿\n\n` +
      `Tienda: ${nombre}\n` +
      `Usuario: ${usuario}\n` +
      `Contraseña: ${clave}\n\n` +
      `Link para ingresar a tu panel:\n${linkLogin}\n\n` +
      `Link de tu catálogo público (para tus clientes):\n${linkPublico}\n\n` +
      `Guarda esta información en un lugar seguro.`;

    const url = TELEFONO_BOLETA_ACTUAL
      ? `https://wa.me/51${TELEFONO_BOLETA_ACTUAL.replace(
          /\D/g,
          ''
        )}?text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  });

verificarAccesoSuperAdmin();
