// API base URL - backend no Render
const API_BASE = 'https://url-shortener-ifay.onrender.com/api/v1';

// Sistema de internacionalização
const translations = {
  pt: {
    title: "Encurtador de Links",
    subtitle: "Encurte sua URL agora",
    login: "Entrar",
    register: "Cadastrar",
    logout: "Sair",
    email: "Email",
    password: "Senha",
    shorten: "Encurtar",
    customCode: "Código personalizado (opcional)",
    copy: "Copiar",
    clicks: "Cliques",
    created: "Criado em",
    myLinks: "Meus Links",
    noLinks: "Você ainda não criou nenhuma URL encurtada.",
    success: "Sucesso",
    error: "Erro",
    loginSuccess: "Login realizado!",
    registerSuccess: "Conta criada! Faça login.",
    urlShortened: "URL encurtada com sucesso!",
    urlCopied: "URL copiada!",
    logoutSuccess: "Logout realizado!",
    requiredFields: "Preencha email e senha",
    loginError: "Erro no login",
    registerError: "Erro no cadastro",
    urlError: "Erro ao encurtar URL",
    deleteConfirm: "Tem certeza que deseja deletar esta URL?",
    deleteSuccess: "URL deletada!",
    deleteError: "Erro ao deletar",
    theme: "Alternar tema",
    footer: "Projeto de portfólio • Feito com FastAPI + Python • 2026"
  },
  en: {
    title: "URL Shortener",
    subtitle: "Shorten your URL now",
    login: "Login",
    register: "Register",
    logout: "Logout",
    email: "Email",
    password: "Password",
    shorten: "Shorten",
    customCode: "Custom code (optional)",
    copy: "Copy",
    clicks: "Clicks",
    created: "Created on",
    myLinks: "My Links",
    noLinks: "You haven't created any shortened URLs yet.",
    success: "Success",
    error: "Error",
    loginSuccess: "Login successful!",
    registerSuccess: "Account created! Please login.",
    urlShortened: "URL shortened successfully!",
    urlCopied: "URL copied!",
    logoutSuccess: "Logout successful!",
    requiredFields: "Please fill in email and password",
    loginError: "Login error",
    registerError: "Registration error",
    urlError: "Error shortening URL",
    deleteConfirm: "Are you sure you want to delete this URL?",
    deleteSuccess: "URL deleted!",
    deleteError: "Error deleting",
    theme: "Toggle theme",
    footer: "Portfolio project • Made with FastAPI + Python • 2026"
  }
};

// Detecta idioma do navegador
let currentLang = 'pt';
function detectLanguage() {
  const browserLang = navigator.language || navigator.userLanguage;
  currentLang = browserLang.startsWith('pt') ? 'pt' : 'en';
  console.log('Idioma detectado:', currentLang, browserLang);
}

// Função de tradução
function t(key) {
  return translations[currentLang][key] || key;
}

// Estado da aplicação
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// Elementos DOM
const themeToggleBtn = document.getElementById("theme-toggle");
const iconSun = document.querySelector(".icon-sun");
const iconMoon = document.querySelector(".icon-moon");
const body = document.body;

const urlForm = document.getElementById('url-form');
const originalUrlInput = document.getElementById('original-url');
const customCodeInput = document.getElementById('custom-code');
const resultDiv = document.getElementById('result');
const shortUrlInput = document.getElementById('short-url');
const copyBtn = document.getElementById('btn-copy');
const clickCountSpan = document.getElementById('click-count');

const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnLogout = document.getElementById('btn-logout');
const authModal = document.getElementById('auth-modal');
const closeModal = document.getElementById('close-modal');
const authForm = document.getElementById('auth-form');
const modalTitle = document.getElementById('modal-title');
const submitAuthBtn = document.getElementById('submit-auth');
const toggleAuthLink = document.getElementById('toggle-auth');

const myLinksSection = document.getElementById('my-links-section');
const linksList = document.getElementById('links-list');

// Toggle de tema
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "dark";
  if (savedTheme === "light") {
    body.classList.replace("dark-theme", "light-theme");
    iconSun.classList.add("hidden");
    iconMoon.classList.remove("hidden");
  } else {
    body.classList.add("dark-theme");
    iconSun.classList.remove("hidden");
    iconMoon.classList.add("hidden");
  }
}

themeToggleBtn.addEventListener("click", () => {
  if (body.classList.contains("dark-theme")) {
    body.classList.replace("dark-theme", "light-theme");
    iconSun.classList.add("hidden");
    iconMoon.classList.remove("hidden");
    localStorage.setItem("theme", "light");
  } else {
    body.classList.replace("light-theme", "dark-theme");
    iconSun.classList.remove("hidden");
    iconMoon.classList.add("hidden");
    localStorage.setItem("theme", "dark");
  }
});

// Utilitários
function showMessage(message, type = 'info') {
  // Remove mensagens anteriores
  const existingMessages = document.querySelectorAll('.message');
  existingMessages.forEach(msg => msg.remove());

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = message;

  // Insere após o formulário
  urlForm.parentNode.insertBefore(messageDiv, urlForm.nextSibling);

  // Remove automaticamente após 5 segundos
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 5000);
}

function showResult(shortUrl, clicks) {
  shortUrlInput.value = shortUrl;
  clickCountSpan.textContent = clicks;
  resultDiv.classList.remove('hidden');
  resultDiv.classList.add('slide-up');
}

function hideResult() {
  resultDiv.classList.add('hidden');
  resultDiv.classList.remove('slide-up');
}

// API calls
async function apiRequest(endpoint, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (authToken) {
    defaultOptions.headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
    throw new Error(error.detail || `Erro ${response.status}`);
  }

  return response.json();
}

// Autenticação
function updateAuthUI() {
  if (currentUser) {
    btnLogin.classList.add('hidden');
    btnRegister.classList.add('hidden');
    btnLogout.classList.remove('hidden');
    myLinksSection.classList.remove('hidden');
    loadUserLinks();
  } else {
    btnLogin.classList.remove('hidden');
    btnRegister.classList.remove('hidden');
    btnLogout.classList.add('hidden');
    myLinksSection.classList.add('hidden');
    hideResult();
  }
}

function openAuthModal(isLogin = true) {
  modalTitle.textContent = isLogin ? 'Entrar' : 'Cadastrar';
  submitAuthBtn.textContent = isLogin ? 'Entrar' : 'Cadastrar';
  toggleAuthLink.innerHTML = isLogin
    ? 'Ainda não tem conta? <a href="#" id="switch-to-register">Cadastre-se</a>'
    : 'Já tem conta? <a href="#" id="switch-to-login">Entre</a>';

  authForm.dataset.mode = isLogin ? 'login' : 'register';
  authModal.classList.remove('hidden');
  authModal.classList.add('fade-modal');
}

function closeAuthModal() {
  authModal.classList.add('hidden');
  authModal.classList.remove('fade-modal');
  authForm.reset();
}

async function handleAuth(e) {
  e.preventDefault();

  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  const isLogin = authForm.dataset.mode === 'login';

  if (!email || !password) {
    showMessage(t('requiredFields'), 'error');
    return;
  }

  try {
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    const body = new URLSearchParams({
      username: email,
      password: password,
    });

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    const responseText = await response.text();

    if (!response.ok) {
      showMessage(`Erro: ${responseText}`, 'error');
      return;
    }

    const data = JSON.parse(responseText);

    if (isLogin) {
      authToken = data.access_token;
      localStorage.setItem('authToken', authToken);
      await loadCurrentUser();
      showMessage(t('loginSuccess'), 'success');
    } else {
      showMessage(t('registerSuccess'), 'success');
      openAuthModal(true);
      return;
    }

    closeAuthModal();
    updateAuthUI();

  } catch (error) {
    console.error('ERRO GERAL:', error);
    showMessage('Erro: ' + error.message, 'error');
  }
}

async function loadCurrentUser() {
  try {
    // Para verificar se o token é válido, vamos tentar fazer uma requisição
    await apiRequest('/urls/');
    currentUser = { email: 'user' }; // Simplificado
  } catch (error) {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('authToken');
  }
}

async function logout() {
  currentUser = null;
  authToken = null;
  localStorage.removeItem('authToken');
  updateAuthUI();
  showMessage(t('logoutSuccess'), 'success');
}

// URLs
async function shortenUrl(e) {
  e.preventDefault();

  if (!currentUser) {
    showMessage('Você precisa estar logado para encurtar URLs', 'error');
    openAuthModal(true);
    return;
  }

  const originalUrl = originalUrlInput.value.trim();
  const customCode = customCodeInput.value.trim();

  if (!originalUrl) {
    showMessage('Por favor, insira uma URL válida', 'error');
    return;
  }

  try {
    const response = await apiRequest('/urls/', {
      method: 'POST',
      body: JSON.stringify({
        original_url: originalUrl,
        custom_code: customCode || null,
      }),
    });

    showResult(response.short_url, response.clicks);
    showMessage('URL encurtada com sucesso!', 'success');
    urlForm.reset();
    loadUserLinks(); // Recarrega a lista
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function loadUserLinks() {
  if (!currentUser) return;

  try {
    const urls = await apiRequest('/urls/');

    linksList.innerHTML = '';

    if (urls.length === 0) {
      linksList.innerHTML = '<p class="no-links">Você ainda não criou nenhuma URL encurtada.</p>';
      return;
    }

    urls.forEach(url => {
      const linkItem = document.createElement('div');
      linkItem.className = 'link-item card';

      const linkInfo = document.createElement('div');
      linkInfo.className = 'link-info';

      const originalUrl = document.createElement('div');
      originalUrl.className = 'original-url';
      originalUrl.textContent = url.original_url;

      const shortUrlWrap = document.createElement('div');
      shortUrlWrap.className = 'short-url';

      const shortUrlLink = document.createElement('a');
      shortUrlLink.href = url.short_url;
      shortUrlLink.target = '_blank';
      shortUrlLink.rel = 'noopener noreferrer';
      shortUrlLink.textContent = url.short_url;

      const copyBtnSmall = document.createElement('button');
      copyBtnSmall.className = 'btn-copy-small';
      copyBtnSmall.dataset.url = url.short_url;
      const copyIcon = document.createElement('i');
      copyIcon.className = 'fas fa-copy';
      copyBtnSmall.appendChild(copyIcon);

      shortUrlWrap.appendChild(shortUrlLink);
      shortUrlWrap.appendChild(copyBtnSmall);

      const linkStats = document.createElement('div');
      linkStats.className = 'link-stats';
      const clicksSpan = document.createElement('span');
      clicksSpan.textContent = `Cliques: ${url.clicks}`;
      const createdSpan = document.createElement('span');
      createdSpan.textContent = `Criado em: ${new Date(url.created_at).toLocaleDateString('pt-BR')}`;
      linkStats.appendChild(clicksSpan);
      linkStats.appendChild(createdSpan);

      linkInfo.appendChild(originalUrl);
      linkInfo.appendChild(shortUrlWrap);
      linkInfo.appendChild(linkStats);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.dataset.id = url.id;
      const deleteIcon = document.createElement('i');
      deleteIcon.className = 'fas fa-trash';
      deleteBtn.appendChild(deleteIcon);

      linkItem.appendChild(linkInfo);
      linkItem.appendChild(deleteBtn);
      linksList.appendChild(linkItem);
    });

    // Adiciona event listeners para os botões
    document.querySelectorAll('.btn-copy-small').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = e.currentTarget.dataset.url;
        navigator.clipboard.writeText(url).then(() => {
          showMessage('URL copiada para a área de transferência!', 'success');
        });
      });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const urlId = e.currentTarget.dataset.id;
        if (confirm('Tem certeza que deseja deletar esta URL?')) {
          try {
            await apiRequest(`/urls/${urlId}`, { method: 'DELETE' });
            showMessage('URL deletada com sucesso!', 'success');
            loadUserLinks();
          } catch (error) {
            showMessage(error.message, 'error');
          }
        }
      });
    });

  } catch (error) {
    showMessage('Erro ao carregar links: ' + error.message, 'error');
  }
}

// Event listeners
urlForm.addEventListener('submit', shortenUrl);

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(shortUrlInput.value).then(() => {
    showMessage('URL copiada para a área de transferência!', 'success');
  });
});

btnLogin.addEventListener('click', () => openAuthModal(true));
btnRegister.addEventListener('click', () => openAuthModal(false));
btnLogout.addEventListener('click', logout);

closeModal.addEventListener('click', closeAuthModal);
authForm.addEventListener('submit', handleAuth);

toggleAuthLink.addEventListener('click', (e) => {
  e.preventDefault();
  const isLogin = authForm.dataset.mode === 'login';
  openAuthModal(!isLogin);
});

// Fecha modal ao clicar fora
authModal.addEventListener('click', (e) => {
  if (e.target === authModal) {
    closeAuthModal();
  }
});

// Atualiza textos da interface
function updateUIText() {
  // Título da página
  document.title = t('title');

  // Header
  document.querySelector('h1').textContent = t('title');

  // Botões de auth
  document.getElementById('btn-login').textContent = t('login');
  document.getElementById('btn-register').textContent = t('register');
  document.getElementById('btn-logout').textContent = t('logout');

  // Seção principal
  document.querySelector('.url-form-section h2').textContent = t('subtitle');
  document.getElementById('original-url').placeholder = t('subtitle').replace('Encurte sua URL agora', 'Cole sua URL longa aqui...');
  document.querySelector('#url-form button[type="submit"]').textContent = t('shorten');
  document.getElementById('custom-code').placeholder = t('customCode');
  document.getElementById('btn-copy').textContent = t('copy');

  // Resultado
  const resultP = document.querySelector('#result p');
  if (resultP) resultP.textContent = currentLang === 'pt' ? 'Seu link encurtado está pronto:' : 'Your shortened link is ready:';

  const infoP = document.querySelector('#result .info');
  if (infoP) infoP.innerHTML = `${t('clicks')}: <span id="click-count">0</span>`;

  // Seção de links
  const myLinksH2 = document.querySelector('#my-links-section h2');
  if (myLinksH2) myLinksH2.textContent = t('myLinks');

  // Footer
  document.querySelector('footer p').textContent = t('footer');

  // Tema toggle
  document.getElementById('theme-toggle').title = t('theme');
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  detectLanguage();
  updateUIText();
  initTheme();

  if (authToken) {
    await loadCurrentUser();
  }

  updateAuthUI();
});
