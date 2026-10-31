/*--------- AUTENTICACION Y CONTROL DE ACCESO ---------*/

const SESSION_KEY = 'inhub_session';
const ENV_URL = './.env';

/*--------- VISTAS PERMITIDAS POR ROL ---------*/

const ROLE_VIEWS = {
  Admin: ['resumen', 'operacion', 'hu-soldati', 'hu-echeverria', 'curvas', 'plan', 'huplan', 'docks', 'mix', 'subca', 'jornales', 'mail', 'reporte', 'config', 'monitor'],
  usuario: ['resumen', 'operacion', 'hu-soldati', 'mix']
};

let session = null;

/*--------- CARGA DE .env ---------*/

async function loadEnv() {
  const res = await fetch(ENV_URL);
  if (!res.ok) throw new Error('No se pudo cargar .env');
  const text = await res.text();
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

/*--------- FETCH DE USUARIOS DESDE GOOGLE SHEET ---------*/

async function fetchUsers(apiUrl) {
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error('Error al consultar el backend de usuarios');
  const data = await res.json();
  return Array.isArray(data) ? data : (data.data || data.users || []);
}

/*--------- LOGIN ---------*/

export async function login(username, password) {
  const env = await loadEnv();
  const apiUrl = env.FETCH_API;
  if (!apiUrl) throw new Error('No se encontró FETCH_API en .env');

  const users = await fetchUsers(apiUrl);

  const user = users.find(u =>
    String(u.Usuario || u.usuario || '').trim() === username.trim() &&
    String(u.Contraseña || u.contraseña || u['Contrase\u00f1a'] || '').trim() === password.trim()
  );

  if (!user) throw new Error('Usuario o contrase\u00f1a incorrectos');

  session = {
    nombre: user.Nombre || user.nombre || '',
    apellido: user.Apellido || user.apellido || '',
    rol: String(user.Rol || user.rol || '').trim(),
    turno: user.Turno || user.turno || '',
    usuario: user.Usuario || user.usuario || username
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/*--------- SESION Y LOGOUT ---------*/

export function getSession() {
  if (session) return session;
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    try { session = JSON.parse(stored); } catch { session = null; }
    return session;
  }
  return null;
}

export function logout() {
  session = null;
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
}

/*--------- CONTROL DE VISTAS POR ROL ---------*/

export function getRole() {
  return session?.rol || null;
}

export function getAllowedViews() {
  const role = getRole();
  if (!role) return [];
  return ROLE_VIEWS[role] || [];
}

export function isViewAllowed(view) {
  return getAllowedViews().includes(view);
}

export function applyRoleFilter() {
  const allowed = getAllowedViews();
  const navButtons = document.querySelectorAll('.nav');
  let firstAllowed = null;

  navButtons.forEach(btn => {
    const view = btn.dataset.view;
    const ok = allowed.includes(view);
    btn.style.display = ok ? '' : 'none';
    if (ok && !firstAllowed) firstAllowed = btn;
  });

  // Si la vista activa no esta permitida, cambiar a la primera disponible
  const active = document.querySelector('.nav.active');
  if (active && !allowed.includes(active.dataset.view) && firstAllowed) {
    navButtons.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    firstAllowed.classList.add('active');
    const target = document.getElementById('view-' + firstAllowed.dataset.view);
    if (target) target.classList.add('active');
  }
}
