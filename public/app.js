const $ = (s) => document.querySelector(s)
const token = {
  get: () => localStorage.getItem('ck') || '',
  set: (v) => localStorage.setItem('ck', v),
  clear: () => localStorage.removeItem('ck'),
}

async function api (path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(token.get() && { authorization: `Bearer ${token.get()}` }), ...opts.headers },
  })
  if (res.status === 401 && token.get()) { token.clear(); showAuth() }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `erro ${res.status}`)
  return res.status === 204 ? null : res.json()
}

function showAuth () {
  $('#auth').hidden = false
  $('#app').hidden = true
}
function showApp () {
  $('#auth').hidden = true
  $('#app').hidden = false
  loadLinks()
}

// --- auth --------------------------------------------------------------------
let mode = 'login'

const fail = (el, err) => { el.textContent = err.message; el.hidden = false }

$('#to-register').onclick = () => {
  mode = mode === 'login' ? 'register' : 'login'
  $('#auth-form button[data-mode]').textContent = mode === 'login' ? 'Entrar' : 'Criar conta'
}

$('#auth-form').onsubmit = async (e) => {
  e.preventDefault()
  $('#auth-error').hidden = true
  try {
    const body = { email: $('#email').value, password: $('#password').value }
    const { token: t } = await api(`/api/${mode}`, { method: 'POST', body: JSON.stringify(body) })
    token.set(t)
    showApp()
  } catch (err) { fail($('#auth-error'), err) }
}

$('#logout').onclick = () => { token.clear(); showAuth() }

// --- links -------------------------------------------------------------------
$('#link-form').onsubmit = async (e) => {
  e.preventDefault()
  $('#link-error').hidden = true
  try {
    const slug = $('#slug').value.trim()
    await api('/api/links', { method: 'POST', body: JSON.stringify({ url: $('#url').value, ...(slug && { slug }) }) })
    $('#url').value = ''
    $('#slug').value = ''
    loadLinks()
  } catch (err) { fail($('#link-error'), err) }
}

function sparkline (daily, days = 14) {
  if (!daily.length) return ''
  const byDay = Object.fromEntries(daily.map((d) => [d.d, d.n]))
  const bars = []
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)
    const n = byDay[day] || 0
    bars.push(`<i style="height:${Math.min(18, 4 + n * 3)}px" title="${day}: ${n} clique(s)"></i>`)
  }
  return `<div class="spark">${bars.join('')}</div>`
}

async function loadLinks () {
  const links = await api('/api/links')
  const list = $('#links')
  if (!links.length) { list.innerHTML = '<li class="empty">Nenhum link ainda.</li>'; return }
  list.innerHTML = links.map((l) => `
    <li data-slug="${l.slug}">
      <div>
        <a class="short" href="/${l.slug}" target="_blank" rel="noopener">/${l.slug}</a>
        <div class="dest">${l.url}</div>
        ${sparkline(l.daily)}
      </div>
      <div class="stats">
        <b>${l.clicks}</b>
        <small>clique${l.clicks === 1 ? '' : 's'}</small>
        <button class="del" title="remover" aria-label="remover /${l.slug}">×</button>
      </div>
    </li>`).join('')

  list.querySelectorAll('.del').forEach((btn) => {
    btn.onclick = async (e) => {
      const slug = e.target.closest('li').dataset.slug
      if (!confirm(`Remover /${slug}?`)) return
      await api(`/api/links/${slug}`, { method: 'DELETE' })
      loadLinks()
    }
  })
}

token.get() ? showApp() : showAuth()
