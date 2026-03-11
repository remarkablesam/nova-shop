const api = window.NovaApi;
const refreshBtn = document.getElementById("refreshBtn");
const saveTokenBtn = document.getElementById("saveTokenBtn");
const adminTokenInput = document.getElementById("adminToken");
const statsGrid = document.getElementById("statsGrid");
const ordersList = document.getElementById("ordersList");
const usersList = document.getElementById("usersList");
const waitlistList = document.getElementById("waitlistList");
const adminMessage = document.getElementById("adminMessage");
const resetWalletsBtn = document.getElementById("resetWalletsBtn");
const serviceProviderForm = document.getElementById("serviceProviderForm");
const serviceProvidersList = document.getElementById("serviceProvidersList");
const spName = document.getElementById("spName");
const spAddress = document.getElementById("spAddress");
const spPhone = document.getElementById("spPhone");
const spPhoto = document.getElementById("spPhoto");
const spPhotoPreview = document.getElementById("spPhotoPreview");
const spActive = document.getElementById("spActive");
const userDetailsModal = document.getElementById("userDetailsModal");
const closeUserDetailsBtn = document.getElementById("closeUserDetailsBtn");
const userDetailsTitle = document.getElementById("userDetailsTitle");
const userDetailsMeta = document.getElementById("userDetailsMeta");
const userPostedItems = document.getElementById("userPostedItems");
const userTransactions = document.getElementById("userTransactions");

let spImageData = "";

async function requireAccess(allowedRoles) {
  if (!api) return false;
  const me = await api.auth.me().catch(() => ({ user: null }));
  if (!me.user) {
    window.location.href = "auth.html";
    return false;
  }
  const role = me.user.role || "user";
  if (!allowedRoles.includes(role)) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

const tokenStorageKey = "nova_admin_token";
const moneyFor = (value, walletType) => `${walletType === "crypto" ? "$" : "#"}${Number(value || 0).toFixed(2)}`;

function closeUserDetailsModal() {
  if (!userDetailsModal) return;
  userDetailsModal.hidden = true;
  userDetailsModal.classList.remove("is-open");
}

function openUserDetailsModal() {
  if (!userDetailsModal) return;
  userDetailsModal.hidden = false;
  userDetailsModal.classList.add("is-open");
}

function setMessage(text, isError = false) {
  adminMessage.textContent = text;
  adminMessage.style.color = isError ? "#ff9aa5" : "#2bd2a0";
}

function getAdminToken() {
  return localStorage.getItem(tokenStorageKey) || "";
}

function setAdminToken(token) {
  localStorage.setItem(tokenStorageKey, token);
}

function renderStats(overview) {
  const commissionRatePct = Number(overview.commissionRate || 0) * 100;
  const cards = [
    { label: "Users", value: overview.summary.userCount },
    { label: "Orders", value: overview.summary.orderCount },
    { label: "Waitlist", value: overview.summary.waitlistCount },
    { label: "Wallet Records", value: overview.summary.walletCount },
    { label: "Naria Balance", value: moneyFor(overview.wallets.local, "local") },
    { label: "Crypto Balance", value: moneyFor(overview.wallets.crypto, "crypto") },
    { label: "Revenue (Naria)", value: moneyFor(overview.revenue.local, "local") },
    { label: "Revenue (Crypto)", value: moneyFor(overview.revenue.crypto, "crypto") },
    { label: "Commission (Naria)", value: moneyFor(overview.commissions.local, "local") },
    { label: "Commission (Crypto)", value: moneyFor(overview.commissions.crypto, "crypto") },
    { label: "Commission Rate", value: `${commissionRatePct.toFixed(2)}%` }
  ];

  statsGrid.innerHTML = cards
    .map((card) => `<article><p>${card.label}</p><strong>${card.value}</strong></article>`)
    .join("");
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersList.innerHTML = '<div class="list-item">No orders yet.</div>';
    return;
  }

  ordersList.innerHTML = orders
    .map((order) => {
      const date = new Date(order.createdAt || Date.now()).toLocaleString();
      const commission = moneyFor(order.commission || 0, order.wallet);
      return `
      <div class="list-item">
        ${order.userEmail} • ${order.itemCount || 0} item(s) • ${moneyFor(order.total, order.wallet)}
        <small>${order.wallet} wallet • commission ${commission} • ${date}</small>
      </div>
    `;
    })
    .join("");
}

function getInitials(name) {
  if (!name || !String(name).trim()) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(name).slice(0, 2).toUpperCase();
}

function renderUsers(users) {
  if (!users.length) {
    usersList.innerHTML = '<div class="list-item">No users yet.</div>';
    return;
  }

  usersList.innerHTML = users
    .map((user) => {
      const date = new Date(user.createdAt || Date.now()).toLocaleString();
      const name = escapeHtml(user.name || "");
      const email = escapeHtml(user.email || "");
      const avatar = user.profileImage
        ? `<img class="user-list-avatar-img" src="${escapeHtml(user.profileImage)}" alt="" />`
        : `<span class="user-list-avatar-initials">${escapeHtml(getInitials(user.name))}</span>`;
      return `
      <div class="list-item list-item-user user-row" data-user-id="${escapeHtml(user.id)}">
        <div class="user-list-avatar">${avatar}</div>
        <div class="user-list-body">
          <span class="user-list-name">${name}</span>
          <span class="user-list-sep"> • </span>
          <span class="user-list-email">${email}</span>
          <small>Joined ${date}</small>
        </div>
      </div>
    `;
    })
    .join("");
}

function renderUserDetails(details) {
  if (!details || !details.user) return;
  const user = details.user;
  const posts = Array.isArray(details.postedItems) ? details.postedItems : [];
  const transactions = Array.isArray(details.purchases) ? details.purchases : [];

  if (userDetailsTitle) userDetailsTitle.textContent = `${user.name || "Customer"} Details`;
  if (userDetailsMeta) {
    userDetailsMeta.textContent = `${user.email || ""} • Joined ${new Date(user.createdAt || Date.now()).toLocaleString()}`;
  }
  if (userPostedItems) {
    userPostedItems.innerHTML = posts.length
      ? posts.map((item) => `
          <div class="list-item">
            ${escapeHtml(item.title || "Item")} • ${escapeHtml(item.productId || "-")} • #${Number(item.price || 0).toFixed(2)}
            <small>${escapeHtml(item.category || "other")} • stock ${Number(item.stockTotal || 0)} • sold ${Number(item.soldCount || 0)} • ${new Date(item.createdAt || Date.now()).toLocaleString()}</small>
          </div>
        `).join("")
      : '<div class="list-item">No posted items.</div>';
  }
  if (userTransactions) {
    userTransactions.innerHTML = transactions.length
      ? transactions.map((order) => {
          const items = Array.isArray(order.items) ? order.items : [];
          const itemLines = items
            .map((item) => `${escapeHtml(item.productId || "-")} (${escapeHtml(item.name || "Item")} x${Number(item.quantity || 1)})`)
            .join(", ");
          return `
            <div class="list-item">
              TX: <a class="tx-link" href="admin-order.html?id=${encodeURIComponent(order.transactionId || order.id || "")}">${escapeHtml(order.transactionId || order.id || "-")}</a> • ${escapeHtml(order.userEmail || "")} • ${moneyFor(order.total || 0, order.wallet)}
              <small>${escapeHtml(order.wallet || "local")} wallet • ${new Date(order.createdAt || Date.now()).toLocaleString()}</small>
              <p class="user-transaction-detail">Address: ${escapeHtml(order.shippingAddress || "Not provided")}</p>
              <p class="user-transaction-detail">Items: ${itemLines || "-"}</p>
            </div>
          `;
        }).join("")
      : '<div class="list-item">No buyer transactions.</div>';
  }
}

async function openUserDetails(userId) {
  if (!api || !api.admin || !api.admin.userDetails) return;
  try {
    const details = await api.admin.userDetails(userId, getAdminToken());
    renderUserDetails(details);
    openUserDetailsModal();
  } catch (error) {
    setMessage(error.message || "Could not load user details.", true);
  }
}

function renderWaitlist(entries) {
  if (!entries.length) {
    waitlistList.innerHTML = '<div class="list-item">No waitlist entries yet.</div>';
    return;
  }

  waitlistList.innerHTML = entries
    .map((entry) => {
      const date = new Date(entry.createdAt || Date.now()).toLocaleString();
      return `
      <div class="list-item">
        ${entry.name} • ${entry.email}
        <small>${entry.role || "Investor"} • ${date}</small>
      </div>
    `;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderServiceProviders(items) {
  if (!serviceProvidersList) return;
  if (!items || !items.length) {
    serviceProvidersList.innerHTML = '<div class="list-item">No service providers yet. Add one above.</div>';
    return;
  }
  serviceProvidersList.innerHTML = items
    .map((p) => {
      const date = new Date(p.createdAt || Date.now()).toLocaleString();
      const rating = p.ratingCount > 0 ? `${Number(p.ratingAverage).toFixed(1)} ★ (${p.ratingCount})` : "No ratings";
      const status = p.isActive !== false ? "Active" : "Inactive";
      const img = p.imageData
        ? `<img src="${escapeHtml(p.imageData)}" alt="" class="sp-list-photo" />`
        : "";
      return `
      <div class="list-item sp-list-item">
        ${img}
        <div>
          <strong>${escapeHtml(p.name)}</strong> • ${status}
          <small>${escapeHtml(p.phone || "")} ${p.address ? "• " + escapeHtml(p.address) : ""}</small>
          <small>${rating} • ${date}</small>
        </div>
      </div>
    `;
    })
    .join("");
}

async function loadServiceProviders() {
  if (!api || !api.admin.serviceProviders) return;
  try {
    const res = await api.admin.serviceProviders.list(getAdminToken());
    renderServiceProviders(res.items || []);
  } catch (e) {
    const msg = (e && e.message) || "";
    const hint = msg.toLowerCase().includes("unauthorized") || msg.includes("401")
      ? " Enter the admin token above and click Save Token, then Refresh."
      : "";
    if (serviceProvidersList) {
      serviceProvidersList.innerHTML = `<div class="list-item">Could not load providers.${hint}</div>`;
    }
  }
}

async function loadOverview() {
  if (!api) {
    setMessage("API unavailable.", true);
    return;
  }

  try {
    const overview = await api.admin.overview(getAdminToken());
    renderStats(overview);
    renderOrders(overview.recentOrders || []);
    renderUsers(overview.allUsers || []);
    renderWaitlist(overview.recentWaitlist || []);
    await loadServiceProviders();
    setMessage(`Last updated ${new Date(overview.at).toLocaleTimeString()}`);
  } catch (error) {
    setMessage(error.message || "Could not load admin data.", true);
  }
}

refreshBtn.addEventListener("click", () => {
  void loadOverview();
});

saveTokenBtn.addEventListener("click", () => {
  setAdminToken(adminTokenInput.value.trim());
  setMessage("Admin token saved.");
  void loadOverview();
});

resetWalletsBtn.addEventListener("click", async () => {
  if (!api) return setMessage("API unavailable.", true);
  if (!window.confirm("Reset all wallets to zero?")) return;

  try {
    const result = await api.admin.resetAllWallets(getAdminToken());
    setMessage(`Reset ${result.resetCount || 0} wallet record(s).`);
    void loadOverview();
  } catch (error) {
    setMessage(error.message || "Could not reset wallets.", true);
  }
});

if (spPhoto) {
  spPhoto.addEventListener("change", async () => {
    const file = spPhoto.files && spPhoto.files[0];
    if (!file || !file.type.startsWith("image/")) {
      spImageData = "";
      if (spPhotoPreview) {
        spPhotoPreview.innerHTML = "";
        spPhotoPreview.classList.add("hidden");
      }
      return;
    }
    spImageData = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("Read failed"));
      r.readAsDataURL(file);
    });
    if (spPhotoPreview) {
      spPhotoPreview.innerHTML = `<img src="${spImageData}" alt="Preview" style="max-width:80px;max-height:80px;border-radius:50%;object-fit:cover;" />`;
      spPhotoPreview.classList.remove("hidden");
    }
  });
}

if (serviceProviderForm) {
  serviceProviderForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!api || !api.admin.serviceProviders) return setMessage("API unavailable.", true);
    const name = (spName && spName.value) ? spName.value.trim() : "";
    if (name.length < 2) return setMessage("Name must be at least 2 characters.", true);
    try {
      await api.admin.serviceProviders.create(
        {
          name,
          address: (spAddress && spAddress.value) ? spAddress.value.trim() : "",
          phone: (spPhone && spPhone.value) ? spPhone.value.trim() : "",
          imageData: spImageData || undefined,
          isActive: spActive ? spActive.checked : true
        },
        getAdminToken()
      );
      setMessage("Service provider added.");
      serviceProviderForm.reset();
      spImageData = "";
      if (spPhotoPreview) {
        spPhotoPreview.innerHTML = "";
        spPhotoPreview.classList.add("hidden");
      }
      if (spActive) spActive.checked = true;
      await loadServiceProviders();
    } catch (err) {
      const msg = err.message || "Could not add provider.";
      const hint = (msg.toLowerCase().includes("unauthorized") || msg.includes("401"))
        ? " Enter the admin token above and click Save Token."
        : "";
      setMessage(msg + hint, true);
    }
  });
}

if (usersList) {
  usersList.addEventListener("click", (event) => {
    const target = event.target;
    const origin = target instanceof Element ? target : target && target.parentElement;
    const row = origin instanceof Element ? origin.closest(".user-row") : null;
    if (!row) return;
    const userId = row.getAttribute("data-user-id") || "";
    if (!userId) return;
    void openUserDetails(userId);
  });
}

if (closeUserDetailsBtn) {
  closeUserDetailsBtn.addEventListener("click", () => {
    closeUserDetailsModal();
  });
}

if (userDetailsModal) {
  userDetailsModal.addEventListener("click", (event) => {
    if (event.target === userDetailsModal) closeUserDetailsModal();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeUserDetailsModal();
});

adminTokenInput.value = getAdminToken();
requireAccess(["admin"]).then((ok) => {
  if (ok) void loadOverview();
});
