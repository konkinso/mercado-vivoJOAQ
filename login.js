// ============================================
// Login de tiendas — SOLO ingreso, sin auto-registro.
// Las cuentas las crea el super-admin desde superadmin.html.
// ============================================

const mensaje = document.getElementById('mensaje-auth');

document.getElementById('form-auth').addEventListener('submit', async (e) => {
  e.preventDefault();
  const entrada = document.getElementById('campo-correo').value.trim();
  // Si ya es un correo real (ej. el del super-admin), se usa tal cual.
  // Si es un nombre de usuario simple (tiendas creadas desde el panel), se completa el dominio interno.
  const correo = entrada.includes('@')
    ? entrada
    : `${entrada.toLowerCase()}@mercadovivo.app`;
  const clave = document.getElementById('campo-clave').value;
  mensaje.textContent = 'Ingresando…';
  mensaje.style.color = 'var(--lg-tinta-suave)';

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: correo,
      password: clave,
    });
    if (error) throw error;

    mensaje.textContent = 'Sesión iniciada, redirigiendo…';
    mensaje.style.color = 'var(--lg-verde)';
    window.location.href = 'admin.html';
  } catch (err) {
    console.error('Error de autenticación:', err);
    mensaje.textContent =
      'Usuario o contraseña incorrectos, o tu cuenta aún no existe. Contacta al administrador.';
    mensaje.style.color = '#B4532A';
  }
});
