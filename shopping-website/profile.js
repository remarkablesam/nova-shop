const api = window.NovaApi;
const loginPrompt = document.getElementById("loginPrompt");
const profileDetailsCard = document.getElementById("profileDetailsCard");
const profileDetailsView = document.getElementById("profileDetailsView");
const profileAvatarImg = document.getElementById("profileAvatarImg");
const profileInitials = document.getElementById("profileInitials");
const profileNameEl = document.getElementById("profileName");
const profileEmailEl = document.getElementById("profileEmail");
const updateInfoBtn = document.getElementById("updateInfoBtn");
const profileUpdateCard = document.getElementById("profileUpdateCard");
const profileUpdateForm = document.getElementById("profileUpdateForm");
const profileNameInput = document.getElementById("profileNameInput");
const profilePhotoInput = document.getElementById("profilePhotoInput");
const profilePhotoPreviewWrap = document.getElementById("profilePhotoPreviewWrap");
const profilePhotoPreview = document.getElementById("profilePhotoPreview");
const cancelUpdateBtn = document.getElementById("cancelUpdateBtn");
const sessionCard = document.getElementById("sessionCard");
const sessionUser = document.getElementById("sessionUser");
const savedMessage = document.getElementById("savedMessage");
const incomingTransactionsCard = document.getElementById("incomingTransactionsCard");
const incomingBadge = document.getElementById("incomingBadge");
const incomingEmpty = document.getElementById("incomingEmpty");
const incomingList = document.getElementById("incomingList");
const addressBookCard = document.getElementById("addressBookCard");
const addressForm = document.getElementById("addressForm");
const addressLabel = document.getElementById("addressLabel");
const addressLine = document.getElementById("addressLine");
const addressCity = document.getElementById("addressCity");
const addressCountry = document.getElementById("addressCountry");
const addressList = document.getElementById("addressList");
const notificationCard = document.getElementById("notificationCard");
const notificationList = document.getElementById("notificationList");

let profilePhotoData = "";

async function requireAccess(allowedRoles) {
  if (!api) return false;
  const me = await api.auth.me().catch(() => ({ user: null }));
  if (!me.user) {
    window.location.href = "auth.html";
    return false;
  }
  const role = me.user.role || "user";
  if (role !== "admin" && !allowedRoles.includes(role)) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

function showMessage(message, isError = false) {
  if (!savedMessage) return;
  savedMessage.textContent = message;
  savedMessage.style.color = isError ? "#d94848" : "#3ff2d0";
  savedMessage.classList.add("show");
  setTimeout(() => savedMessage.classList.remove("show"), 2000);
}

function getInitials(name) {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTime(value) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString();
}

function renderIncomingTransactions(user, items) {
  if (!incomingTransactionsCard) return;

  if (!user) {
    incomingTransactionsCard.hidden = true;
    return;
  }

  const list = Array.isArray(items) ? items : [];
  incomingTransactionsCard.hidden = false;
  if (incomingBadge) {
    incomingBadge.textContent = String(
      Math.max(0, Number(user.incomingTransactionCount) || 0)
    );
  }

  if (list.length === 0) {
    if (incomingEmpty) incomingEmpty.hidden = false;
    if (incomingList) incomingList.innerHTML = "";
    return;
  }

  if (incomingEmpty) incomingEmpty.hidden = true;
  if (!incomingList) return;
  incomingList.innerHTML = list
    .map((tx) => {
      const products = Array.isArray(tx.products) ? tx.products : [];
      const productLines = products
        .map(
          (product) =>
            `<li>${escapeHtml(product.productId)} - ${escapeHtml(product.name)} x${Number(product.quantity) || 1}</li>`
        )
        .join("");
      return `
        <article class="incoming-item">
          <p class="incoming-line"><strong>Transaction ID:</strong> ${escapeHtml(tx.transactionId)}</p>
          <p class="incoming-line"><strong>Buyer:</strong> ${escapeHtml(tx.buyerName)} (${escapeHtml(tx.buyerEmail)})</p>
          <p class="incoming-line"><strong>Date/Time Paid:</strong> ${escapeHtml(formatDateTime(tx.paidAt))}</p>
          <p class="incoming-line"><strong>Detailed Address:</strong> ${escapeHtml(tx.buyerAddress)}</p>
          <ul class="incoming-products">${productLines}</ul>
        </article>
      `;
    })
    .join("");
}

function renderAddresses(user, items) {
  if (!addressBookCard) return;
  if (!user) {
    addressBookCard.hidden = true;
    return;
  }
  addressBookCard.hidden = false;
  const list = Array.isArray(items) ? items : [];
  if (!addressList) return;
  addressList.innerHTML = list.length
    ? list.map((item) => `<li>${escapeHtml(item.label || "Address")}: ${escapeHtml(item.line || "")}, ${escapeHtml(item.city || "")}${item.country ? `, ${escapeHtml(item.country)}` : ""}</li>`).join("")
    : "<li>No saved addresses.</li>";
}

function renderNotifications(user, items) {
  if (!notificationCard) return;
  if (!user) {
    notificationCard.hidden = true;
    return;
  }
  notificationCard.hidden = false;
  const list = Array.isArray(items) ? items : [];
  if (!notificationList) return;
  notificationList.innerHTML = list.length
    ? list.map((item) => `<li>${escapeHtml(item.message || "")} • ${escapeHtml(formatDateTime(item.createdAt))}</li>`).join("")
    : "<li>No notifications yet.</li>";
}

function renderProfileDetails(user, incomingItems, addresses, notifications) {
  if (!user) {
    if (loginPrompt) loginPrompt.hidden = false;
    if (profileDetailsCard) profileDetailsCard.hidden = true;
    if (profileUpdateCard) profileUpdateCard.classList.add("hidden");
    if (sessionCard) sessionCard.hidden = true;
    renderIncomingTransactions(null, []);
    renderAddresses(null, []);
    renderNotifications(null, []);
    return;
  }
  if (loginPrompt) loginPrompt.hidden = true;
  if (sessionCard) {
    sessionCard.hidden = false;
    if (sessionUser) sessionUser.textContent = `${user.name || ""} (${user.email || ""})`;
  }
  profileDetailsCard.hidden = false;
  profileUpdateCard.classList.add("hidden");
  if (profileNameEl) profileNameEl.textContent = user.name || "";
  if (profileEmailEl) profileEmailEl.textContent = user.email || "";
  if (user.profileImage) {
    if (profileAvatarImg) {
      profileAvatarImg.src = user.profileImage;
      profileAvatarImg.hidden = false;
    }
    if (profileInitials) profileInitials.textContent = "";
  } else {
    if (profileAvatarImg) profileAvatarImg.hidden = true;
    if (profileInitials) profileInitials.textContent = getInitials(user.name);
  }
  renderIncomingTransactions(user, incomingItems);
  renderAddresses(user, addresses);
  renderNotifications(user, notifications);
}

async function loadProfile() {
  if (!api) {
    renderProfileDetails(null, [], [], []);
    showMessage("API unavailable.", true);
    return;
  }
  if (!(await requireAccess(["user", "seller"]))) return;
  try {
    const result = await api.auth.me();
    const user = result.user;
    let incomingItems = [];
    let addresses = [];
    let notifications = [];
    if (user && api.profile && api.profile.incomingTransactions) {
      const incoming = await api.profile.incomingTransactions(50).catch(() => ({ items: [] }));
      incomingItems = Array.isArray(incoming.items) ? incoming.items : [];
      if (api.addresses && api.addresses.list) {
        const addressRes = await api.addresses.list().catch(() => ({ items: [] }));
        addresses = Array.isArray(addressRes.items) ? addressRes.items : [];
      }
      if (api.notifications && api.notifications.list) {
        const notiRes = await api.notifications.list(25).catch(() => ({ items: [] }));
        notifications = Array.isArray(notiRes.items) ? notiRes.items : [];
      }
    }
    renderProfileDetails(user, incomingItems, addresses, notifications);
  } catch (err) {
    renderProfileDetails(null, [], [], []);
  }
}

if (addressForm) {
  addressForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!api || !api.addresses || !api.addresses.create) return showMessage("API unavailable.", true);
    const line = (addressLine && addressLine.value) ? addressLine.value.trim() : "";
    const city = (addressCity && addressCity.value) ? addressCity.value.trim() : "";
    if (!line || !city) return showMessage("Address line and city are required.", true);
    try {
      await api.addresses.create({
        label: (addressLabel && addressLabel.value) ? addressLabel.value.trim() : "",
        line,
        city,
        country: (addressCountry && addressCountry.value) ? addressCountry.value.trim() : ""
      });
      addressForm.reset();
      showMessage("Address saved.");
      await loadProfile();
    } catch (error) {
      showMessage(error.message || "Could not save address.", true);
    }
  });
}

if (updateInfoBtn) {
  updateInfoBtn.addEventListener("click", async () => {
    if (!api) return;
    try {
      const result = await api.auth.me();
      const user = result.user;
      if (!user) return;
      profileDetailsCard.hidden = true;
      profileUpdateCard.classList.remove("hidden");
      if (profileNameInput) profileNameInput.value = user.name || "";
      profilePhotoData = "";
      if (profilePhotoPreviewWrap) profilePhotoPreviewWrap.classList.add("hidden");
      if (profilePhotoInput) profilePhotoInput.value = "";
    } catch (e) {
      showMessage("Could not load profile.", true);
    }
  });
}

if (cancelUpdateBtn) {
  cancelUpdateBtn.addEventListener("click", () => {
    profileUpdateCard.classList.add("hidden");
    profileDetailsCard.hidden = false;
  });
}

if (profilePhotoInput) {
  profilePhotoInput.addEventListener("change", async () => {
    const file = profilePhotoInput.files && profilePhotoInput.files[0];
    if (!file || !file.type.startsWith("image/")) {
      profilePhotoData = "";
      if (profilePhotoPreviewWrap) profilePhotoPreviewWrap.classList.add("hidden");
      return;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read image."));
      reader.readAsDataURL(file);
    });
    profilePhotoData = dataUrl;
    if (profilePhotoPreview) profilePhotoPreview.src = dataUrl;
    if (profilePhotoPreviewWrap) profilePhotoPreviewWrap.classList.remove("hidden");
  });
}

if (profileUpdateForm) {
  profileUpdateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!api || !api.auth.updateProfile) return showMessage("API unavailable.", true);
    const name = (profileNameInput && profileNameInput.value) ? profileNameInput.value.trim() : "";
    if (name.length < 2) return showMessage("Name must be at least 2 characters.", true);
    try {
      await api.auth.updateProfile({ name, profileImage: profilePhotoData || undefined });
      showMessage("Profile updated.");
      await loadProfile();
      profileUpdateCard.classList.add("hidden");
      profileDetailsCard.hidden = false;
      profilePhotoData = "";
      if (profilePhotoInput) profilePhotoInput.value = "";
      if (profilePhotoPreviewWrap) profilePhotoPreviewWrap.classList.add("hidden");
    } catch (error) {
      showMessage(error.message || "Update failed.", true);
    }
  });
}

loadProfile();
