// ============================================
// Escáner por LECTURA DE ETIQUETA (OCR con Tesseract.js)
// ============================================

let streamCamara = null;
let elementoVideo = null;

const botonIniciar = document.getElementById('boton-iniciar');
const botonCapturar = document.getElementById('boton-capturar');
const botonDetener = document.getElementById('boton-detener');
const contenedorCamara = document.getElementById('lector-camara');
const mensajeOcr = document.getElementById('mensaje-ocr');
const resultadoDiv = document.getElementById('resultado');

botonIniciar.addEventListener('click', iniciarCamara);
botonCapturar.addEventListener('click', capturarYLeer);
botonDetener.addEventListener('click', detenerCamara);
document.getElementById('boton-buscar-manual').addEventListener('click', () => {
  const nombre = document.getElementById('nombre-manual').value.trim();
  if (nombre) buscarProductoPorNombre(nombre);
});

async function iniciarCamara() {
  try {
    streamCamara = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });

    contenedorCamara.innerHTML = '';
    elementoVideo = document.createElement('video');
    elementoVideo.setAttribute('playsinline', true);
    elementoVideo.srcObject = streamCamara;
    elementoVideo.play();
    contenedorCamara.appendChild(elementoVideo);

    // Marco de escaneo animado con esquinas + línea de barrido
    const marco = document.createElement('div');
    marco.className = 'es-marco-escaneo';
    marco.innerHTML = `
      <span class="esq-tl"></span><span class="esq-tr"></span>
      <span class="esq-bl"></span><span class="esq-br"></span>
      <div class="es-linea-escaneo"></div>
    `;
    contenedorCamara.appendChild(marco);

    botonIniciar.style.display = 'none';
    botonCapturar.style.display = 'inline-flex';
    botonDetener.style.display = 'inline-flex';
    mensajeOcr.textContent =
      'Centra el nombre del producto dentro del marco y toca "Capturar etiqueta".';
  } catch (err) {
    console.error('No se pudo iniciar la cámara:', err);
    contenedorCamara.innerHTML = `<span class="es-mensaje-inicial">No se pudo acceder a la cámara. Revisa permisos o usa la búsqueda manual.</span>`;
  }
}

function detenerCamara() {
  if (streamCamara) {
    streamCamara.getTracks().forEach((track) => track.stop());
    streamCamara = null;
  }
  contenedorCamara.innerHTML = `<span class="es-mensaje-inicial" id="mensaje-camara">Presiona "Iniciar cámara" para escanear la etiqueta</span>`;
  botonIniciar.style.display = 'inline-flex';
  botonCapturar.style.display = 'none';
  botonDetener.style.display = 'none';
  mensajeOcr.textContent = '';
}

async function capturarYLeer() {
  if (!elementoVideo) return;

  const canvas = document.createElement('canvas');
  canvas.width = elementoVideo.videoWidth;
  canvas.height = elementoVideo.videoHeight;
  canvas.getContext('2d').drawImage(elementoVideo, 0, 0);

  mensajeOcr.textContent = 'Leyendo etiqueta… esto puede tardar unos segundos.';
  resultadoDiv.innerHTML = `<p class="es-resultado-vacio">Analizando imagen…</p>`;

  try {
    const resultadoOcr = await Tesseract.recognize(canvas, 'spa', {
      logger: () => {},
    });
    const textoLeido = resultadoOcr.data.text.trim();

    if (!textoLeido) {
      mensajeOcr.textContent =
        'No se pudo leer texto claro. Acércate más o escribe el nombre manualmente.';
      resultadoDiv.innerHTML = `<p class="es-resultado-vacio">No se detectó texto legible.</p>`;
      return;
    }

    mensajeOcr.textContent = `Texto leído: "${textoLeido.split('\n')[0]}"`;
    await buscarProductoPorNombre(textoLeido);
  } catch (err) {
    console.error('Error en OCR:', err);
    mensajeOcr.textContent =
      'Ocurrió un error leyendo la etiqueta. Intenta de nuevo.';
  }
}

async function buscarProductoPorNombre(textoBuscado) {
  resultadoDiv.innerHTML = `<p class="es-resultado-vacio">Buscando producto…</p>`;

  const palabrasClave = textoBuscado
    .replace(/\n/g, ' ')
    .split(' ')
    .map((p) => p.trim())
    .filter((p) => p.length >= 4)
    .slice(0, 5);

  if (!palabrasClave.length) {
    resultadoDiv.innerHTML = `<p class="es-resultado-vacio">No se pudo identificar un nombre útil para buscar.</p>`;
    return;
  }

  try {
    const condiciones = palabrasClave
      .map((p) => `nombre.ilike.%${p}%`)
      .join(',');
    const { data, error } = await supabaseClient
      .from('productos')
      .select(
        'id, nombre, precio, categoria, icono, imagen_url, tienda_id, tiendas(nombre, slug)'
      )
      .or(condiciones)
      .limit(5);

    if (error) throw error;

    if (!data || !data.length) {
      resultadoDiv.innerHTML = `<p class="es-resultado-vacio">No encontramos ningún producto que coincida con "${palabrasClave.join(
        ' '
      )}". Puede que aún no esté registrado.</p>`;
      document.getElementById('similares-wrap').style.display = 'none';
      return;
    }

    if (data.length === 1) {
      mostrarResultado(data[0]);
      await buscarSimilares(data[0].categoria, data[0].id);
    } else {
      mostrarVariasCoincidencias(data);
    }
  } catch (err) {
    console.error('Error buscando producto:', err);
    resultadoDiv.innerHTML = `<p class="es-resultado-vacio">Ocurrió un error al buscar el producto.</p>`;
  }
}

function mostrarVariasCoincidencias(lista) {
  resultadoDiv.innerHTML = `
    <p style="font-weight:600;margin-bottom:10px;color:var(--es-tinta);">Encontramos varias coincidencias, elige la correcta:</p>
    ${lista
      .map(
        (p) => `
      <button class="es-opcion-coincidencia" onclick='mostrarResultadoDesdeBoton(${JSON.stringify(
        p
      ).replace(/'/g, '&apos;')})'>
        <strong>${p.nombre}</strong> — S/${Number(p.precio).toFixed(2)} (${
          p.tiendas ? p.tiendas.nombre : ''
        })
      </button>
    `
      )
      .join('')}
  `;
}

function mostrarResultadoDesdeBoton(producto) {
  mostrarResultado(producto);
  buscarSimilares(producto.categoria, producto.id);
}
window.mostrarResultadoDesdeBoton = mostrarResultadoDesdeBoton;

function mostrarResultado(producto) {
  const nombreTienda = producto.tiendas ? producto.tiendas.nombre : 'Tienda';
  const imagen = producto.imagen_url
    ? `<img src="${producto.imagen_url}" alt="${producto.nombre}">`
    : producto.icono || '🌿';

  resultadoDiv.innerHTML = `
    <div class="es-fila-producto">
      <div class="es-imagen-producto">${imagen}</div>
      <div>
        <div class="es-marca-tienda">${nombreTienda}</div>
        <div class="es-nombre-producto">${producto.nombre}</div>
      </div>
    </div>
    <div class="es-precio-grande">S/${Number(producto.precio).toFixed(2)}</div>
    <div class="es-meta-producto">Categoría: ${
      producto.categoria || 'Natural'
    }</div>
  `;
}

async function buscarSimilares(categoria, idExcluir) {
  const wrap = document.getElementById('similares-wrap');
  const grilla = document.getElementById('grilla-similares');

  if (!categoria) {
    wrap.style.display = 'none';
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('productos')
      .select('id, nombre, precio, icono, imagen_url, tiendas(nombre)')
      .eq('categoria', categoria)
      .neq('id', idExcluir)
      .limit(6);

    if (error || !data || !data.length) {
      wrap.style.display = 'none';
      return;
    }

    grilla.innerHTML = data
      .map(
        (p) => `
      <div class="es-tarjeta-similar">
        <div style="font-size:0.7rem;color:var(--es-verde);font-weight:700;text-transform:uppercase;">${
          p.tiendas ? p.tiendas.nombre : ''
        }</div>
        <div style="margin:4px 0;">${p.nombre}</div>
        <div class="precio">S/${Number(p.precio).toFixed(2)}</div>
      </div>
    `
      )
      .join('');
    wrap.style.display = 'block';
  } catch (err) {
    console.error('Error buscando similares:', err);
    wrap.style.display = 'none';
  }
}
