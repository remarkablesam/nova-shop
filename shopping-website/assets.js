const api = window.NovaApi;
const localBalanceEl = document.getElementById("localBalance");
const cryptoBalanceEl = document.getElementById("cryptoBalance");
const depositForm = document.getElementById("depositForm");
const depositType = document.getElementById("depositType");
const depositAmount = document.getElementById("depositAmount");
const withdrawForm = document.getElementById("withdrawForm");
const withdrawType = document.getElementById("withdrawType");
const withdrawDestination = document.getElementById("withdrawDestination");
const withdrawAmount = document.getElementById("withdrawAmount");
const assetMessage = document.getElementById("assetMessage");
const resetWalletBtn = document.getElementById("resetWalletBtn");
const orderHistory = document.getElementById("orderHistory");

let walletState = { local: 0, crypto: 0 };

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

function formatMoney(value) {
  return `#${Number(value || 0).toFixed(2)}`;
}

function formatWalletMoney(value, walletType) {
  const symbol = walletType === "crypto" ? "$" : "#";
  return `${symbol}${Number(value || 0).toFixed(2)}`;
}

function setAssetMessage(message, isError = false) {
  assetMessage.textContent = message;
  assetMessage.style.color = isError ? "#ff8a8a" : "#3ff2d0";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderWallets() {
  localBalanceEl.textContent = formatWalletMoney(walletState.local, "local");
  cryptoBalanceEl.textContent = formatWalletMoney(walletState.crypto, "crypto");
}

async function refreshWallets() {
  if (!api) return;
  walletState = await api.wallets.get();
  renderWallets();
}

async function renderOrderHistory() {
  if (!api) {
    orderHistory.innerHTML = "<li>Order service unavailable.</li>";
    return;
  }

  const result = await api.orders.list(500);
  const orders = result.items || [];
  orderHistory.innerHTML = "";

  if (orders.length === 0) {
    orderHistory.innerHTML = "<li>No purchases yet.</li>";
    return;
  }

  orders.forEach((order) => {
    const li = document.createElement("li");
    li.className = "order-item";
    const date = new Date(order.createdAt || Date.now()).toLocaleString();
    const walletType = order.wallet || "local";
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const sellers = Array.isArray(order.sellerNames) && order.sellerNames.length
      ? order.sellerNames.join(", ")
      : "Unknown Seller";
    const lines = orderItems
      .map((item) => {
        const productId = item.productId || "-";
        const sellerName = item.sellerName || "Unknown Seller";
        const quantity = Number(item.quantity) || 1;
        const price = formatWalletMoney(item.price || 0, walletType);
        return `<li>${escapeHtml(item.name)} • ${escapeHtml(productId)} • ${escapeHtml(sellerName)} • Qty ${quantity} • ${price}</li>`;
      })
      .join("");

    li.innerHTML = `
      <button type="button" class="order-summary" aria-expanded="false">
        ${escapeHtml(date)} • ${order.itemCount || 0} item(s) • ${escapeHtml(formatWalletMoney(order.total || 0, walletType))} • ${escapeHtml(walletType)} wallet
      </button>
      <div class="order-details" hidden>
        <p><strong>Transaction ID:</strong> ${escapeHtml(order.transactionId || order.id || "-")}</p>
        <p><strong>Date/Time:</strong> ${escapeHtml(date)}</p>
        <p><strong>Amount:</strong> ${escapeHtml(formatWalletMoney(order.total || 0, walletType))}</p>
        <p><strong>Wallet:</strong> ${escapeHtml(walletType)}</p>
        <p><strong>Seller(s):</strong> ${escapeHtml(sellers)}</p>
        <ul>${lines || "<li>No item details.</li>"}</ul>
      </div>
    `;
    orderHistory.appendChild(li);
  });
}

orderHistory.addEventListener("click", (event) => {
  const target = event.target;
  const button = target instanceof Element ? target.closest(".order-summary") : null;
  if (!(button instanceof HTMLButtonElement)) return;
  const item = button.closest(".order-item");
  const details = item ? item.querySelector(".order-details") : null;
  if (!details) return;
  const isOpen = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", isOpen ? "false" : "true");
  details.hidden = isOpen;
});

depositForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!api) return setAssetMessage("API unavailable.", true);

  const walletType = depositType.value;
  const amount = Number(depositAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    setAssetMessage("Enter a valid deposit amount.", true);
    return;
  }

  try {
    walletState = await api.wallets.deposit(walletType, amount);
    renderWallets();
    depositForm.reset();
    setAssetMessage(`Deposited ${formatWalletMoney(amount, walletType)} to ${walletType} wallet.`);
  } catch (error) {
    setAssetMessage(error.message || "Deposit failed.", true);
  }
});

withdrawForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!api) return setAssetMessage("API unavailable.", true);

  const walletType = withdrawType.value;
  const destination = withdrawDestination.value;
  const amount = Number(withdrawAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    setAssetMessage("Enter a valid withdrawal amount.", true);
    return;
  }

  try {
    walletState = await api.wallets.pay(walletType, amount);
    renderWallets();
    withdrawForm.reset();
    const destinationLabel = destination === "crypto_wallet" ? "crypto wallet" : "local bank";
    setAssetMessage(`Withdrawal successful: ${formatWalletMoney(amount, walletType)} sent to ${destinationLabel}.`);
  } catch (error) {
    setAssetMessage(error.message || "Withdrawal failed.", true);
  }
});

resetWalletBtn.addEventListener("click", async () => {
  if (!api) return setAssetMessage("API unavailable.", true);
  try {
    walletState = await api.wallets.reset();
    renderWallets();
    setAssetMessage("Wallets reset.");
  } catch (error) {
    setAssetMessage(error.message || "Reset failed.", true);
  }
});

(async function initAssetsPage() {
  if (!api) {
    setAssetMessage("Backend API not loaded.", true);
    orderHistory.innerHTML = "<li>Backend API not loaded.</li>";
    return;
  }
  if (!(await requireAccess(["user", "seller"]))) return;
  try {
    await refreshWallets();
    await renderOrderHistory();
  } catch (error) {
    setAssetMessage("Could not load wallet data.", true);
    orderHistory.innerHTML = "<li>Could not load orders.</li>";
  }
})();
