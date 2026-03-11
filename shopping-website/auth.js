const api = window.NovaApi;
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const authFlipCard = document.getElementById("authFlipCard");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const savedMessage = document.getElementById("savedMessage");
const sessionUser = document.getElementById("sessionUser");
const logoutBtn = document.getElementById("logoutBtn");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const signupName = document.getElementById("signupName");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupConfirm = document.getElementById("signupConfirm");

function syncFlipCardHeight() {
  const loginHeight = loginForm.scrollHeight;
  const signupHeight = signupForm.scrollHeight;
  authFlipCard.style.height = `${Math.max(loginHeight, signupHeight)}px`;
}

function showAuthMessage(message, isError = false) {
  savedMessage.textContent = message;
  savedMessage.style.color = isError ? "#d94848" : "#0a8f74";
  savedMessage.classList.add("show");
  setTimeout(() => savedMessage.classList.remove("show"), 2000);
}

function activateAuthTab(tab) {
  const loginActive = tab === "login";
  loginTab.classList.toggle("active", loginActive);
  signupTab.classList.toggle("active", !loginActive);
  authFlipCard.classList.toggle("flipped", !loginActive);
  requestAnimationFrame(syncFlipCardHeight);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function renderSessionState() {
  if (!api) {
    sessionUser.textContent = "API unavailable";
    logoutBtn.disabled = true;
    logoutBtn.style.opacity = "0.45";
    return;
  }

  try {
    const result = await api.auth.me();
    const user = result.user;
    sessionUser.textContent = user ? `${user.name} (${user.email})` : "Not logged in";
    logoutBtn.disabled = !user;
    logoutBtn.style.opacity = user ? "1" : "0.45";
  } catch (error) {
    sessionUser.textContent = "Session check failed";
    logoutBtn.disabled = true;
    logoutBtn.style.opacity = "0.45";
  }
}

loginTab.addEventListener("click", () => activateAuthTab("login"));
signupTab.addEventListener("click", () => activateAuthTab("signup"));
window.addEventListener("resize", syncFlipCardHeight);
window.addEventListener("load", syncFlipCardHeight);

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = signupName.value.trim();
  const email = signupEmail.value.trim().toLowerCase();
  const password = signupPassword.value;
  const confirmPassword = signupConfirm.value;

  if (name.length < 2) return showAuthMessage("Please enter your full name.", true);
  if (!isValidEmail(email)) return showAuthMessage("Please enter a valid email.", true);
  if (password.length < 8) return showAuthMessage("Password must be at least 8 characters.", true);
  if (password !== confirmPassword) return showAuthMessage("Passwords do not match.", true);
  if (!api) return showAuthMessage("API unavailable.", true);

  try {
    await api.auth.signup({ name, email, password });
    showAuthMessage("Account created.");
    signupForm.reset();
    activateAuthTab("login");
    loginEmail.value = email;
    await renderSessionState();
  } catch (error) {
    showAuthMessage(error.message || "Signup failed.", true);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = loginEmail.value.trim().toLowerCase();
  const password = loginPassword.value;
  if (!api) return showAuthMessage("API unavailable.", true);

  try {
    await api.auth.login({ email, password });
    showAuthMessage("Login successful.");
    loginForm.reset();
    await renderSessionState();
  } catch (error) {
    showAuthMessage(error.message || "Login failed.", true);
  }
});

logoutBtn.addEventListener("click", async () => {
  if (!api) return;
  try {
    await api.auth.logout();
    await renderSessionState();
    showAuthMessage("Logged out.");
  } catch (error) {
    showAuthMessage("Logout failed.", true);
  }
});

syncFlipCardHeight();
renderSessionState();
