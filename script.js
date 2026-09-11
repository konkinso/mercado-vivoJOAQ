// ============================================
// MERCADO VIVO
// JavaScript principal (Optimizado)
// ============================================

let TODAS_LAS_TIENDAS = [];

// ============================================
// 1. CARGAR TIENDAS DESDE SUPABASE
// ============================================

async function cargarTiendas() {
  const contenedor = document.getElementById('grilla-tiendas');
  if (!contenedor) return;

  try {
    const { data, error } = await supabaseClient
      .from('tiendas')
      .select('id, nombre, rubro, slug')
      .order('nombre', { ascending: true });

    if (error) throw error;

    TODAS_LAS_TIENDAS = data || [];
    renderizarTiendas(TODAS_LAS_TIENDAS);
  } catch (error) {
    console.error('Error cargando tiendas:', error);
    contenedor.innerHTML = `
      <p class="estado-vacio">
        No se pudieron cargar las tiendas todavía.
        Revisa la configuración de Supabase.
      </p>
    `;
  }
}

// ============================================
// 2. MOSTRAR TIENDAS
// ============================================

function renderizarTiendas(lista) {
  const contenedor = document.getElementById('grilla-tiendas');
  if (!contenedor) return;

  if (!lista || lista.length === 0) {
    contenedor.innerHTML = `
      <p class="estado-vacio">
        Aún no hay tiendas registradas. ¡Sé la primera!
      </p>
    `;
    return;
  }

  contenedor.innerHTML = lista
    .map((tienda) => {
      const nombre = tienda.nombre || 'Tienda';
      const rubro = tienda.rubro || 'Productos naturales';
      const slug = tienda.slug || '';
      const inicial = nombre.charAt(0).toUpperCase();

      return `
        <a
          class="tarjeta-tienda"
          href="tienda.html?tienda=${encodeURIComponent(slug)}"
        >
          <div class="sello">${inicial}</div>
          <h3>${nombre}</h3>
          <div class="rubro">${rubro}</div>
          <div class="ver-mas">Ver catálogo →</div>
        </a>
      `;
    })
    .join('');
}

// ============================================
// 3. BUSCADOR CON DEBOUNCE (OPTIMIZACIÓN)
// ============================================

function debounce(func, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

function iniciarBuscadorTiendas() {
  const buscador = document.getElementById('buscador-tiendas');
  if (!buscador) return;

  const ejecutarBusqueda = debounce((evento) => {
    const texto = evento.target.value.toLowerCase().trim();

    const tiendasFiltradas = TODAS_LAS_TIENDAS.filter((tienda) => {
      const nombre = (tienda.nombre || '').toLowerCase();
      const rubro = (tienda.rubro || '').toLowerCase();
      return nombre.includes(texto) || rubro.includes(texto);
    });

    renderizarTiendas(tiendasFiltradas);
  }, 250);

  buscador.addEventListener('input', ejecutarBusqueda);
}

// ============================================
// 4. CARRUSEL CON SOPORTE TÁCTIL Y AUTO-CLEANUP
// ============================================

function iniciarCarruselDemo() {
  const track = document.getElementById('carousel-track');
  if (!track) return;

  const tarjetas = track.querySelectorAll('.card');
  if (!tarjetas.length) return;

  const botonAnterior = document.getElementById('flecha-anterior');
  const botonSiguiente = document.getElementById('flecha-siguiente');
  const contenedorDots = document.getElementById('dots-carrusel');
  const dots = contenedorDots ? contenedorDots.querySelectorAll('.dot') : [];

  let indiceActual = 0;
  let intervalo = null;

  function actualizarCarrusel() {
    tarjetas.forEach((tarjeta, indice) => {
      tarjeta.classList.remove('activa', 'anterior', 'siguiente', 'oculta');

      if (indice === indiceActual) {
        tarjeta.classList.add('activa');
      } else if (
        indice ===
        (indiceActual - 1 + tarjetas.length) % tarjetas.length
      ) {
        tarjeta.classList.add('anterior');
      } else if (indice === (indiceActual + 1) % tarjetas.length) {
        tarjeta.classList.add('siguiente');
      } else {
        tarjeta.classList.add('oculta');
      }
    });

    dots.forEach((dot, indice) => {
      dot.classList.toggle('active', indice === indiceActual);
    });
  }

  function siguienteProducto() {
    indiceActual = (indiceActual + 1) % tarjetas.length;
    actualizarCarrusel();
  }

  function anteriorProducto() {
    indiceActual = (indiceActual - 1 + tarjetas.length) % tarjetas.length;
    actualizarCarrusel();
  }

  function iniciarTimer() {
    pararTimer();
    intervalo = setInterval(siguienteProducto, 3500);
  }

  function pararTimer() {
    if (intervalo) clearInterval(intervalo);
  }

  // Controles
  if (botonAnterior)
    botonAnterior.addEventListener('click', () => {
      anteriorProducto();
      iniciarTimer();
    });
  if (botonSiguiente)
    botonSiguiente.addEventListener('click', () => {
      siguienteProducto();
      iniciarTimer();
    });

  dots.forEach((dot, indice) => {
    dot.addEventListener('click', () => {
      indiceActual = indice;
      actualizarCarrusel();
      iniciarTimer();
    });
  });

  // Pausa en PC
  const carrusel = document.querySelector('.carrusel-demo');
  if (carrusel) {
    carrusel.addEventListener('mouseenter', pararTimer);
    carrusel.addEventListener('mouseleave', iniciarTimer);
  }

  // Gestos táctiles (Mobile Swipe)
  let touchStartX = 0;
  let touchEndX = 0;

  track.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
      pararTimer();
    },
    { passive: true }
  );

  track.addEventListener(
    'touchend',
    (e) => {
      touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 40) siguienteProducto();
      if (touchEndX - touchStartX > 40) anteriorProducto();
      iniciarTimer();
    },
    { passive: true }
  );

  // Iniciar
  actualizarCarrusel();
  iniciarTimer();
}

// ============================================
// 5. INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  cargarTiendas();
  iniciarBuscadorTiendas();
  iniciarCarruselDemo();
});
