const api = window.NovaApi;
const orderTitle = document.getElementById("orderTitle");
const orderMeta = document.getElementById("orderMeta");
const summaryBox = document.getElementById("summaryBox");
const itemsBox = document.getElementById("itemsBox");
const trackingBox = document.getElementById("trackingBox");
const pageMessage = document.getElementById("pageMessage");

const tokenStorageKey = "nova_admin_token";
const params = new URLSearchParams(window.location.search);
const orderId = String(params.get("id") || "").trim();

function getAdminToken() {
  return localStorage.getItem(tokenStorageKey) || "";
}

function moneyFor(value, walletType) {
  return `${walletType === "crypto" ? "$" : "#"}${Number(value || 0).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setMessage(text, isError = false) {
  pageMessage.textContent = text;
  pageMessage.style.color = isError ? "#ff9aa5" : "#2bd2a0";
}

async function loadOrder() {
  if (!api || !api.admin || !api.admin.orderDetails) return setMessage("API unavailable.", true);
  if (!orderId) return setMessage("Order ID missing in URL.", true);
  try {
    const result = await api.admin.orderDetails(orderId, getAdminToken());
    const order = result.order || {};
    const tracking = result.tracking || {};
    const wallet = order.wallet || "local";
    const created = new Date(order.createdAt || Date.now()).toLocaleString();

    orderTitle.textContent = `Order ${escapeHtml(order.transactionId || order.id || "-")}`;
    orderMeta.textContent = `${escapeHtml(order.userEmail || "guest")} • ${created}`;

    summaryBox.innerHTML = `
      <div class="list-item">
        <strong>Status:</strong> ${escapeHtml(order.status || tracking.status || "paid")}
        <small>Tracking No: ${escapeHtml(tracking.trackingNumber || order.trackingNumber || "-")}</small>
        <small>Total: ${moneyFor(order.total || 0, wallet)} • Wallet: ${escapeHtml(wallet)}</small>
        <small>Address: ${escapeHtml(order.shippingAddress || "Not provided")}</small>
      </div>
    `;

    const items = Array.isArray(order.items) ? order.items : [];
    itemsBox.innerHTML = items.length
      ? items.map((item) => `
          <div class="list-item">
            ${escapeHtml(item.productId || "-")} • ${escapeHtml(item.name || "Item")} x${Number(item.quantity || 1)}
            <small>Seller: ${escapeHtml(item.sellerName || "Unknown Seller")} • ${moneyFor(item.price || 0, wallet)} each</small>
          </div>
        `).join("")
      : '<div class="list-item">No item records.</div>';

    const history = Array.isArray(tracking.history) ? tracking.history : [];
    trackingBox.innerHTML = history.length
      ? history.map((h) => `
          <div class="list-item">
            ${escapeHtml(h.status || "-")}
            <small>${new Date(h.at || Date.now()).toLocaleString()} ${h.note ? "• " + escapeHtml(h.note) : ""}</small>
          </div>
        `).join("")
      : '<div class="list-item">No tracking history.</div>';

    setMessage("Order loaded.");
  } catch (error) {
    setMessage(error.message || "Could not load order details.", true);
  }
}

void loadOrder();
