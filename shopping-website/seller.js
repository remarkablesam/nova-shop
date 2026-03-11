const api = window.NovaApi;
const summary = document.getElementById("summary");
const orderList = document.getElementById("orderList");
const payoutForm = document.getElementById("payoutForm");
const payoutAmount = document.getElementById("payoutAmount");
const payoutList = document.getElementById("payoutList");
const message = document.getElementById("message");

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

function setMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#992f2f" : "#1a7c67";
}

async function loadDashboard() {
  if (!api) return setMessage("API unavailable.", true);
  try {
    const [dash, payouts] = await Promise.all([api.seller.dashboard(), api.seller.payouts()]);
    const s = dash.summary || {};
    summary.textContent = `Products: ${s.productCount || 0} • Orders: ${s.orderCount || 0} • Revenue: #${Number(s.revenue || 0).toFixed(2)}`;
    const orders = Array.isArray(dash.orders) ? dash.orders : [];
    orderList.innerHTML = orders.length
      ? orders.map((o) => `<li>${(o.transactionId || o.id || "").slice(0, 8)} • ${o.status || "paid"} • #${Number(o.total || 0).toFixed(2)}</li>`).join("")
      : "<li>No seller orders yet.</li>";
    const payoutItems = Array.isArray(payouts.items) ? payouts.items : [];
    payoutList.innerHTML = payoutItems.length
      ? payoutItems.map((p) => `<li>#${Number(p.amount || 0).toFixed(2)} • ${p.status || "requested"} • ${new Date(p.createdAt || Date.now()).toLocaleString()}</li>`).join("")
      : "<li>No payouts yet.</li>";
  } catch (error) {
    setMessage(error.message || "Could not load seller dashboard.", true);
  }
}

payoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!api) return;
  const amount = Number(payoutAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) return setMessage("Enter a valid amount.", true);
  try {
    await api.seller.requestPayout(amount);
    payoutForm.reset();
    setMessage("Payout requested.");
    await loadDashboard();
  } catch (error) {
    setMessage(error.message || "Could not request payout.", true);
  }
});

if (api) {
  requireAccess(["seller"]).then((ok) => {
    if (ok) void loadDashboard();
  });
}
