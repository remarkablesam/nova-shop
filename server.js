const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");

const app = express();
const port = Number(process.env.PORT || 4173);
const dbPath = path.join(__dirname, "data", "db.json");
const sessionCookieName = "nova_sid";
const defaultCatalogStock = {
  "ARC-129": 80,
  "SKS-084": 93,
  "LTS-049": 50,
  "CGP-039": 76,
  "NCP-072": 66,
  "HDP-019": 86
};
const defaultCatalogProductDetails = {
  "ARC-129": {
    name: "Arc Jacket",
    category: "clothing",
    price: 129,
    sellerName: "Nova Apparel",
    description: "Heavy cotton jacket with clean fit and daily-wear comfort."
  },
  "SKS-084": {
    name: "Shadow Knit Set",
    category: "clothing",
    price: 84,
    sellerName: "Shadow Studio",
    description: "Two-piece knit set for casual and premium street styling."
  },
  "LTS-049": {
    name: "Local Tailor Session",
    category: "service",
    price: 49,
    sellerName: "City Stitch Team",
    description: "Book a local tailor session for fitting and custom adjustments."
  },
  "CGP-039": {
    name: "City Grooming Pass",
    category: "service",
    price: 39,
    sellerName: "Groom Hub",
    description: "Premium grooming package for men and women with home options."
  },
  "NCP-072": {
    name: "Nova Cargo Pants",
    category: "clothing",
    price: 72,
    sellerName: "Nova Utility Wear",
    description: "Relaxed cargo pants with utility pockets and reinforced seams."
  },
  "HDP-019": {
    name: "Home Delivery Prime",
    category: "service",
    price: 19,
    sellerName: "Prime Dispatch",
    description: "Priority same-day dispatch service for local merchant orders."
  }
};
const defaultPromoCodes = {
  WELCOME5: { type: "percent", value: 0.05 },
  SAVE10: { type: "flat", value: 10 }
};
const defaultCatalogSellerByProductId = {
  "ARC-129": "Nova Apparel",
  "SKS-084": "Shadow Studio",
  "LTS-049": "City Stitch Team",
  "CGP-039": "Groom Hub",
  "NCP-072": "Nova Utility Wear",
  "HDP-019": "Prime Dispatch"
};

const defaultDb = {
  users: [],
  sessions: {},
  carts: {},
  wallets: {},
  commissions: { local: 0, crypto: 0 },
  orders: [],
  waitlist: [],
  productPosts: [],
  adPosts: [],
  serviceProviders: [],
  serviceProviderRatings: {},
  catalogSales: {},
  wishlists: {},
  addresses: {},
  notifications: {},
  passwordResetTokens: {},
  emailVerificationTokens: {},
  productModeration: {},
  userFlags: {},
  returns: [],
  orderTracking: {},
  sellerPayouts: []
};

function ensureDbFile() {
  const folder = path.dirname(dbPath);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
  }
}

function readDb() {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(dbPath, "utf8");
    const parsed = JSON.parse(raw);
    const postItems = Array.isArray(parsed.productPosts) ? parsed.productPosts : [];
    const normalizedPosts = postItems.map((post) => {
      const safeId = String(post.id || generateId());
      const stockTotal = Math.max(1, Number(post.stockTotal) || 60);
      const soldCount = Math.max(0, Math.min(stockTotal, Number(post.soldCount) || 0));
      return {
        ...post,
        id: safeId,
        productId: String(post.productId || getPostProductId(safeId)),
        stockTotal,
        soldCount
      };
    });

    return {
      ...defaultDb,
      ...parsed,
      sessions: parsed.sessions || {},
      carts: parsed.carts || {},
      wallets: parsed.wallets || {},
      productPosts: normalizedPosts,
      adPosts: Array.isArray(parsed.adPosts) ? parsed.adPosts : [],
      serviceProviders: Array.isArray(parsed.serviceProviders) ? parsed.serviceProviders : [],
      serviceProviderRatings: parsed.serviceProviderRatings && typeof parsed.serviceProviderRatings === "object" ? parsed.serviceProviderRatings : {},
      catalogSales: parsed.catalogSales || {},
      wishlists: parsed.wishlists || {},
      addresses: parsed.addresses || {},
      notifications: parsed.notifications || {},
      passwordResetTokens: parsed.passwordResetTokens || {},
      emailVerificationTokens: parsed.emailVerificationTokens || {},
      productModeration: parsed.productModeration || {},
      userFlags: parsed.userFlags || {},
      returns: Array.isArray(parsed.returns) ? parsed.returns : [],
      orderTracking: parsed.orderTracking || {},
      sellerPayouts: Array.isArray(parsed.sellerPayouts) ? parsed.sellerPayouts : [],
      commissions: {
        ...defaultDb.commissions,
        ...(parsed.commissions || {})
      }
    };
  } catch (error) {
    return { ...defaultDb };
  }
}

function writeDb(db) {
  ensureDbFile();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function generateId() {
  return crypto.randomUUID();
}

function sanitizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeName(value) {
  return String(value || "").trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function sanitizeText(value, maxLength = 240) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeProductId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 32);
}

function getPostProductId(value) {
  return `P-${String(value || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() || "ITEM"}`;
}

function getCatalogStockForId(db, productId) {
  const normalized = normalizeProductId(productId);
  if (defaultCatalogStock[normalized]) return defaultCatalogStock[normalized];
  const post = (db.productPosts || []).find((item) => normalizeProductId(item.productId) === normalized);
  if (post) return Math.max(1, Number(post.stockTotal) || 60);
  return 0;
}

function getCatalogSoldCount(db, productId) {
  const normalized = normalizeProductId(productId);
  if (defaultCatalogStock[normalized]) {
    const map = db.catalogSales || {};
    return Math.max(0, Number(map[normalized]) || 0);
  }
  const post = (db.productPosts || []).find((item) => normalizeProductId(item.productId) === normalized);
  if (post) return Math.max(0, Number(post.soldCount) || 0);
  return 0;
}

function getCatalogRemainingForId(db, productId) {
  const stock = getCatalogStockForId(db, productId);
  const sold = getCatalogSoldCount(db, productId);
  return Math.max(0, stock - sold);
}

function sanitizeImageData(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const validPrefix = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i;
  if (!validPrefix.test(raw)) return "";
  if (raw.length > 2_800_000) return "";
  return raw;
}

const requestBuckets = new Map();
function getClientKey(req) {
  return req.ip || req.connection?.remoteAddress || "local";
}

function basicRateLimit(maxRequests = 240, windowMs = 60_000) {
  return (req, res, next) => {
    const key = `${getClientKey(req)}:${Math.floor(Date.now() / windowMs)}`;
    const used = (requestBuckets.get(key) || 0) + 1;
    requestBuckets.set(key, used);
    if (used > maxRequests) {
      res.status(429).json({ error: "Too many requests. Please try again shortly." });
      return;
    }
    next();
  };
}

function getOrderStatusHistory(order) {
  if (Array.isArray(order.statusHistory) && order.statusHistory.length > 0) return order.statusHistory;
  const createdAt = order.createdAt || new Date().toISOString();
  return [{ status: order.status || "paid", at: createdAt, note: "Order paid" }];
}

function pushNotification(db, userId, type, message, meta = {}) {
  if (!userId) return;
  db.notifications = db.notifications || {};
  if (!Array.isArray(db.notifications[userId])) db.notifications[userId] = [];
  db.notifications[userId].unshift({
    id: generateId(),
    type: String(type || "info"),
    message: sanitizeText(message, 280),
    meta: meta && typeof meta === "object" ? meta : {},
    read: false,
    createdAt: new Date().toISOString()
  });
  db.notifications[userId] = db.notifications[userId].slice(0, 200);
}

function getUserBySession(db, sessionId) {
  const session = db.sessions[sessionId];
  return session && session.userId ? db.users.find((item) => item.id === session.userId) : null;
}

function resolveActorUserId(db, actorKey) {
  const key = String(actorKey || "");
  if (!key.startsWith("user:")) return null;
  const userId = key.slice("user:".length);
  return (db.users || []).find((u) => u.id === userId) ? userId : null;
}

function applyPromo(total, promoCode) {
  const normalizedCode = sanitizeText(promoCode, 40).toUpperCase();
  if (!normalizedCode || !defaultPromoCodes[normalizedCode]) {
    return { promoCode: "", discount: 0 };
  }
  const rule = defaultPromoCodes[normalizedCode];
  if (rule.type === "percent") {
    return { promoCode: normalizedCode, discount: roundMoney(total * (Number(rule.value) || 0)) };
  }
  return { promoCode: normalizedCode, discount: roundMoney(Number(rule.value) || 0) };
}

function getCatalogAndPostProducts(db) {
  const catalogProducts = Object.keys(defaultCatalogStock).map((productId) => {
    const details = defaultCatalogProductDetails[productId] || {};
    const stockTotal = getCatalogStockForId(db, productId);
    const sold = getCatalogSoldCount(db, productId);
    return {
      productId,
      name: details.name || productId,
      category: details.category || "other",
      price: Number(details.price) || 0,
      sellerName: details.sellerName || defaultCatalogSellerByProductId[productId] || "Unknown Seller",
      description: details.description || "",
      stockTotal,
      sold,
      remaining: Math.max(0, stockTotal - sold),
      source: "catalog"
    };
  });

  const postProducts = (db.productPosts || []).map((post) => {
    const productId = normalizeProductId(post.productId || getPostProductId(post.id));
    const stockTotal = Math.max(1, Number(post.stockTotal) || 60);
    const sold = Math.max(0, Math.min(stockTotal, Number(post.soldCount) || 0));
    return {
      productId,
      name: sanitizeText(post.title, 120) || "Community Product",
      category: sanitizeText(post.category, 40) || "other",
      price: roundMoney(Number(post.price) || 0),
      sellerName: getSellerNameForProduct(db, productId),
      description: sanitizeText(post.description, 800),
      stockTotal,
      sold,
      remaining: Math.max(0, stockTotal - sold),
      source: "community"
    };
  });

  return [...catalogProducts, ...postProducts];
}

function getOrCreateSession(req, res, db) {
  let sid = req.cookies[sessionCookieName];
  if (!sid) {
    sid = generateId();
    res.cookie(sessionCookieName, sid, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30
    });
  }

  const existing = db.sessions[sid] || {};
  db.sessions[sid] = {
    userId: existing.userId || null,
    createdAt: existing.createdAt || new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };
  return sid;
}

function getActorKey(db, sid) {
  const session = db.sessions[sid];
  if (session && session.userId) return `user:${session.userId}`;
  return `guest:${sid}`;
}

function getDefaultWallet() {
  return { local: 0, crypto: 0 };
}

function getDefaultCommissionBalance() {
  return { local: 0, crypto: 0 };
}

function getCommissionRate() {
  const value = Number(process.env.COMMISSION_RATE);
  if (!Number.isFinite(value) || value < 0) return 0.02;
  if (value > 1) return 1;
  return value;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function sanitizeCartItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      name: String(item.name || "Item"),
      price: Number(item.price) || 0,
      quantity: Math.max(1, Number(item.quantity) || 1),
      productId: normalizeProductId(item.productId || "")
    }))
    .filter((item) => item.name && item.price >= 0);
}

function getCartTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getIncomingTransactionsForSeller(db, sellerUserId, limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  if (!sellerUserId) return [];

  const myProductIds = new Set(
    (db.productPosts || [])
      .filter((post) => post.sellerUserId === sellerUserId)
      .map((post) => normalizeProductId(post.productId || getPostProductId(post.id)))
      .filter(Boolean)
  );
  if (myProductIds.size === 0) return [];

  const orders = Array.isArray(db.orders) ? db.orders : [];
  const items = [];

  for (let i = orders.length - 1; i >= 0; i -= 1) {
    const order = orders[i];
    const matchedItems = (order.items || [])
      .map((item) => {
        const normalizedProductId = normalizeProductId(item.productId || "");
        if (!myProductIds.has(normalizedProductId)) return null;
        return {
          productId: normalizedProductId || String(item.productId || ""),
          name: String(item.name || "Item"),
          quantity: Math.max(1, Number(item.quantity) || 1),
          price: Number(item.price) || 0
        };
      })
      .filter(Boolean);

    if (matchedItems.length === 0) continue;

    items.push({
      transactionId: String(order.id || ""),
      paidAt: order.createdAt || null,
      buyerName: sanitizeText(order.buyerName || order.userName || "Guest", 120) || "Guest",
      buyerEmail: sanitizeEmail(order.userEmail || "") || "guest",
      buyerAddress: sanitizeText(order.shippingAddress || "", 500) || "Not provided",
      wallet: order.wallet || "local",
      products: matchedItems
    });

    if (items.length >= safeLimit) break;
  }

  return items;
}

function getDisplayNameFromEmail(email) {
  const clean = sanitizeEmail(email);
  if (!clean || clean === "guest") return "";
  const firstPart = clean.split("@")[0] || "";
  const normalized = firstPart.replace(/[._-]+/g, " ").trim();
  return normalized ? normalized.slice(0, 120) : "";
}

function getSellerNameForProduct(db, productId) {
  const normalizedProductId = normalizeProductId(productId);
  if (!normalizedProductId) return "Unknown Seller";
  if (defaultCatalogSellerByProductId[normalizedProductId]) {
    return defaultCatalogSellerByProductId[normalizedProductId];
  }

  const post = (db.productPosts || []).find((item) => normalizeProductId(item.productId) === normalizedProductId);
  if (!post) return "Unknown Seller";

  if (post.sellerUserId) {
    const seller = (db.users || []).find((user) => user.id === post.sellerUserId);
    if (seller && sanitizeName(seller.name)) return sanitizeName(seller.name);
  }
  if (sanitizeText(post.contact, 120)) return sanitizeText(post.contact, 120);
  if (post.userEmail) {
    const byEmail = getDisplayNameFromEmail(post.userEmail);
    if (byEmail) return byEmail;
  }
  return "Unknown Seller";
}

function hydrateOrderForClient(db, order) {
  const hydratedItems = (order.items || []).map((item) => {
    const productId = normalizeProductId(item.productId || "") || String(item.productId || "");
    return {
      name: String(item.name || "Item"),
      price: Number(item.price) || 0,
      quantity: Math.max(1, Number(item.quantity) || 1),
      productId,
      sellerName: getSellerNameForProduct(db, productId)
    };
  });

  const sellerNames = [...new Set(hydratedItems.map((item) => item.sellerName).filter(Boolean))];
  return {
    ...order,
    transactionId: String(order.id || ""),
    statusHistory: getOrderStatusHistory(order),
    items: hydratedItems,
    sellerNames
  };
}

function isSellerForOrder(db, userId, order) {
  if (!userId || !order) return false;
  const myProductIds = new Set(
    (db.productPosts || [])
      .filter((post) => post.sellerUserId === userId)
      .map((post) => normalizeProductId(post.productId || getPostProductId(post.id)))
      .filter(Boolean)
  );
  return (order.items || []).some((item) => myProductIds.has(normalizeProductId(item.productId || "")));
}

function getAdminToken() {
  const token = String(process.env.ADMIN_TOKEN || "").trim();
  return token || null;
}

function requireAdmin(req, res, next) {
  const expectedToken = getAdminToken();
  if (!expectedToken) {
    next();
    return;
  }

  const providedToken = String(req.get("x-admin-token") || "");
  if (providedToken !== expectedToken) {
    res.status(401).json({ error: "Unauthorized admin request." });
    return;
  }
  next();
}

function migrateGuestStateToUser(db, sid, userId) {
  const guestKey = `guest:${sid}`;
  const userKey = `user:${userId}`;

  if (!db.carts[userKey] && db.carts[guestKey]) {
    db.carts[userKey] = db.carts[guestKey];
  }
  if (!db.wallets[userKey] && db.wallets[guestKey]) {
    db.wallets[userKey] = db.wallets[guestKey];
  }

  delete db.carts[guestKey];
  delete db.wallets[guestKey];
}

const advertiserEmail = "info@novashop.com";
const advertiserPassword = "schoolmate";

function ensureAdvertiserUser(db) {
  const exists = db.users.some((u) => sanitizeEmail(u.email) === advertiserEmail);
  if (exists) return false;
  const salt = generateId();
  const user = {
    id: generateId(),
    name: "Nova Shop Ads",
    email: advertiserEmail,
    role: "advertiser",
    passwordSalt: salt,
    passwordHash: hashPassword(advertiserPassword, salt),
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  return true;
}

app.use(express.json({ limit: "12mb" }));
app.use(cookieParser());
app.use(basicRateLimit(300, 60_000));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    if (res.statusCode >= 500) {
      console.error(`${req.method} ${req.originalUrl} -> ${res.statusCode} in ${ms}ms`);
    }
  });
  next();
});

app.use((req, res, next) => {
  const db = readDb();
  const sid = getOrCreateSession(req, res, db);
  writeDb(db);
  req.sessionId = sid;
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

app.get("/api/auth/me", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) {
    res.json({ user: null });
    return;
  }

  const incomingTransactionCount = getIncomingTransactionsForSeller(db, user.id, 500).length;

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || "user",
      profileImage: user.profileImage || null,
      incomingTransactionCount,
      emailVerified: !!user.emailVerified,
      flagged: !!(db.userFlags || {})[user.id]
    }
  });
});

app.get("/api/profile/incoming-transactions", (req, res) => {
  const db = readDb();
  const session = db.sessions[req.sessionId];
  const user = session && session.userId ? db.users.find((item) => item.id === session.userId) : null;

  if (!user) {
    res.status(401).json({ error: "Please log in to view incoming transactions." });
    return;
  }

  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 50));
  const items = getIncomingTransactionsForSeller(db, user.id, limit);
  res.json({ items, count: items.length });
});

app.put("/api/auth/profile", (req, res) => {
  const db = readDb();
  const session = db.sessions[req.sessionId];
  const user = session && session.userId ? db.users.find((item) => item.id === session.userId) : null;
  if (!user) {
    res.status(401).json({ error: "Please log in to update your profile." });
    return;
  }
  const name = sanitizeName(req.body.name);
  const profileImage = sanitizeImageData(req.body.profileImage);
  if (name.length >= 2) user.name = name;
  if (profileImage !== undefined) user.profileImage = profileImage || "";
  writeDb(db);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || "user",
      profileImage: user.profileImage || null
    }
  });
});

app.post("/api/auth/signup", (req, res) => {
  const db = readDb();
  const name = sanitizeName(req.body.name);
  const email = sanitizeEmail(req.body.email);
  const password = String(req.body.password || "");

  if (name.length < 2) {
    res.status(400).json({ error: "Please enter your full name." });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const exists = db.users.some((user) => user.email === email);
  if (exists) {
    res.status(409).json({ error: "Account already exists." });
    return;
  }

  const salt = generateId();
  const user = {
    id: generateId(),
    name,
    email,
    role: "user",
    emailVerified: false,
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  db.emailVerificationTokens = db.emailVerificationTokens || {};
  db.emailVerificationTokens[user.id] = {
    token: generateId(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
  };
  db.sessions[req.sessionId].userId = user.id;
  migrateGuestStateToUser(db, req.sessionId, user.id);
  writeDb(db);
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post("/api/auth/login", (req, res) => {
  const db = readDb();
  const email = sanitizeEmail(req.body.email);
  const password = String(req.body.password || "");

  const user = db.users.find((item) => item.email === email);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const passwordHash = hashPassword(password, user.passwordSalt);
  if (passwordHash !== user.passwordHash) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  db.sessions[req.sessionId].userId = user.id;
  migrateGuestStateToUser(db, req.sessionId, user.id);
  writeDb(db);
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role || "user" } });
});

app.post("/api/auth/logout", (req, res) => {
  const db = readDb();
  if (db.sessions[req.sessionId]) {
    db.sessions[req.sessionId].userId = null;
    db.sessions[req.sessionId].lastSeenAt = new Date().toISOString();
    writeDb(db);
  }
  res.json({ ok: true });
});

app.get("/api/cart", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const items = sanitizeCartItems(db.carts[actorKey] || []);
  res.json({ items });
});

app.put("/api/cart", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const items = sanitizeCartItems(req.body.items);
  db.carts[actorKey] = items;
  writeDb(db);
  res.json({ items });
});

app.get("/api/wallets", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const wallet = {
    ...getDefaultWallet(),
    ...(db.wallets[actorKey] || {})
  };
  res.json(wallet);
});

app.post("/api/wallets/deposit", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const walletType = req.body.walletType;
  const amount = Number(req.body.amount);

  if (!["local", "crypto"].includes(walletType)) {
    res.status(400).json({ error: "Invalid wallet type." });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Enter a valid amount." });
    return;
  }

  const wallet = { ...getDefaultWallet(), ...(db.wallets[actorKey] || {}) };
  wallet[walletType] += amount;
  db.wallets[actorKey] = wallet;
  writeDb(db);
  res.json(wallet);
});

app.post("/api/wallets/pay", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const walletType = req.body.walletType;
  const amount = Number(req.body.amount);

  if (!["local", "crypto"].includes(walletType)) {
    res.status(400).json({ error: "Invalid wallet type." });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Enter a valid amount." });
    return;
  }

  const wallet = { ...getDefaultWallet(), ...(db.wallets[actorKey] || {}) };
  if (wallet[walletType] < amount) {
    res.status(400).json({ error: "Insufficient balance." });
    return;
  }

  wallet[walletType] -= amount;
  db.wallets[actorKey] = wallet;
  writeDb(db);
  res.json(wallet);
});

app.post("/api/wallets/reset", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  db.wallets[actorKey] = getDefaultWallet();
  writeDb(db);
  res.json(db.wallets[actorKey]);
});

app.post("/api/checkout", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const walletType = req.body.walletType;
  if (!["local", "crypto"].includes(walletType)) {
    res.status(400).json({ error: "Invalid wallet type." });
    return;
  }

  const cartItems = sanitizeCartItems(db.carts[actorKey] || []);
  if (cartItems.length === 0) {
    res.status(400).json({ error: "Cart is empty." });
    return;
  }

  const requestedByProductId = {};
  cartItems.forEach((item) => {
    const productId = normalizeProductId(item.productId);
    if (!productId) return;
    requestedByProductId[productId] = (requestedByProductId[productId] || 0) + item.quantity;
  });

  for (const [productId, quantity] of Object.entries(requestedByProductId)) {
    const stock = getCatalogStockForId(db, productId);
    if (stock <= 0) continue;
    const remaining = getCatalogRemainingForId(db, productId);
    if (quantity > remaining) {
      res.status(400).json({ error: `Not enough stock for ${productId}. Remaining: ${remaining}.` });
      return;
    }
  }

  const subtotal = getCartTotal(cartItems);
  const shippingMethod = sanitizeText(req.body.shippingMethod, 40) || "standard";
  const shippingFee = shippingMethod === "express" ? 12 : 4;
  const taxAmount = roundMoney(subtotal * 0.075);
  const promo = applyPromo(subtotal, req.body.promoCode);
  const discount = Math.min(roundMoney(promo.discount || 0), roundMoney(subtotal + shippingFee + taxAmount));
  const total = roundMoney(subtotal + shippingFee + taxAmount - discount);
  const commissionRate = getCommissionRate();
  const commissionAmount = roundMoney(total * commissionRate);
  const netAmount = roundMoney(total - commissionAmount);
  const wallet = { ...getDefaultWallet(), ...(db.wallets[actorKey] || {}) };
  if (wallet[walletType] < total) {
    res.status(400).json({ error: "Insufficient wallet balance." });
    return;
  }

  wallet[walletType] -= total;
  db.wallets[actorKey] = wallet;
  db.commissions = { ...getDefaultCommissionBalance(), ...(db.commissions || {}) };
  db.commissions[walletType] = roundMoney((db.commissions[walletType] || 0) + commissionAmount);

  const session = db.sessions[req.sessionId];
  const user = session && session.userId ? db.users.find((item) => item.id === session.userId) : null;
  const buyerName = sanitizeText(req.body.buyerName, 120) || (user ? user.name : "") || "Guest";
  const shippingAddress = sanitizeText(req.body.shippingAddress, 500) || "";
  const statusHistory = [{ status: "paid", at: new Date().toISOString(), note: "Payment completed" }];
  const order = {
    id: generateId(),
    actorKey,
    userEmail: user ? user.email : "guest",
    userName: user ? user.name : "",
    buyerName: buyerName || (user ? user.name : "Guest"),
    shippingAddress: shippingAddress || "",
    shippingMethod,
    shippingFee,
    taxAmount,
    promoCode: promo.promoCode,
    discount,
    wallet: walletType,
    subtotal,
    total,
    netAmount,
    commission: commissionAmount,
    commissionRate,
    itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    items: cartItems.map((item) => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      productId: item.productId || ""
    })),
    status: "paid",
    trackingNumber: `TRK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    statusHistory,
    createdAt: new Date().toISOString()
  };
  db.orders.push(order);
  db.orderTracking = db.orderTracking || {};
  db.orderTracking[order.id] = [{ status: "paid", at: order.createdAt, note: "Payment completed" }];

  const buyerUserId = user ? user.id : resolveActorUserId(db, actorKey);
  if (buyerUserId) {
    pushNotification(db, buyerUserId, "order_paid", `Order ${order.id.slice(0, 8)} paid successfully.`, {
      orderId: order.id
    });
  }

  db.catalogSales = db.catalogSales || {};
  Object.entries(requestedByProductId).forEach(([productId, quantity]) => {
    if (defaultCatalogStock[productId]) {
      db.catalogSales[productId] = Math.max(0, Number(db.catalogSales[productId]) || 0) + quantity;
      return;
    }
    const post = (db.productPosts || []).find((item) => normalizeProductId(item.productId) === productId);
    if (!post) return;
    const stockTotal = Math.max(1, Number(post.stockTotal) || 60);
    const soldCount = Math.max(0, Number(post.soldCount) || 0);
    post.soldCount = Math.min(stockTotal, soldCount + quantity);
  });
  db.carts[actorKey] = [];

  writeDb(db);
  res.json({ order, wallets: wallet, cart: [] });
});

app.get("/api/orders", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
  const items = db.orders
    .filter((order) => order.actorKey === actorKey)
    .slice(-limit)
    .reverse()
    .map((order) => hydrateOrderForClient(db, order));
  res.json({ items });
});

app.get("/api/orders/:id", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const id = String(req.params.id || "").trim();
  const order = (db.orders || []).find((o) => o.id === id && o.actorKey === actorKey);
  if (!order) return res.status(404).json({ error: "Order not found." });
  res.json({ order: hydrateOrderForClient(db, order) });
});

app.get("/api/orders/:id/tracking", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const id = String(req.params.id || "").trim();
  const order = (db.orders || []).find((o) => o.id === id && o.actorKey === actorKey);
  if (!order) return res.status(404).json({ error: "Order not found." });
  const history = (db.orderTracking && db.orderTracking[id]) || getOrderStatusHistory(order);
  res.json({ orderId: id, trackingNumber: order.trackingNumber || "", status: order.status || "paid", history });
});

app.post("/api/orders/:id/status", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });

  const id = String(req.params.id || "").trim();
  const status = sanitizeText(req.body.status, 30).toLowerCase();
  const note = sanitizeText(req.body.note, 180);
  const validStatuses = ["paid", "processing", "shipped", "delivered", "cancelled", "refunded"];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status." });

  const order = (db.orders || []).find((o) => o.id === id);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const canManage = user.role === "admin" || isSellerForOrder(db, user.id, order);
  if (!canManage) return res.status(403).json({ error: "You cannot update this order." });

  order.status = status;
  order.statusHistory = getOrderStatusHistory(order);
  order.statusHistory.push({ status, at: new Date().toISOString(), note: note || "" });
  db.orderTracking = db.orderTracking || {};
  db.orderTracking[id] = order.statusHistory.slice();

  const buyerId = resolveActorUserId(db, order.actorKey);
  if (buyerId) {
    pushNotification(db, buyerId, "order_status", `Order ${id.slice(0, 8)} is now ${status}.`, {
      orderId: id,
      status
    });
  }

  writeDb(db);
  res.json({ order: hydrateOrderForClient(db, order) });
});

app.post("/api/orders/:id/returns", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  const id = String(req.params.id || "").trim();
  const reason = sanitizeText(req.body.reason, 400);
  if (reason.length < 4) return res.status(400).json({ error: "Provide a return reason." });

  const actorKey = getActorKey(db, req.sessionId);
  const order = (db.orders || []).find((o) => o.id === id && o.actorKey === actorKey);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const ticket = {
    id: generateId(),
    orderId: id,
    userId: user.id,
    reason,
    status: "requested",
    createdAt: new Date().toISOString()
  };
  db.returns = db.returns || [];
  db.returns.push(ticket);
  pushNotification(db, user.id, "return_requested", `Return requested for order ${id.slice(0, 8)}.`, { orderId: id });
  writeDb(db);
  res.status(201).json({ ticket });
});

app.get("/api/returns", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  const items = (db.returns || []).filter((r) => r.userId === user.id).slice(-50).reverse();
  res.json({ items });
});

app.get("/api/products", (req, res) => {
  const db = readDb();
  const q = sanitizeText(req.query.q, 120).toLowerCase();
  const category = sanitizeText(req.query.category, 40).toLowerCase();
  const sort = sanitizeText(req.query.sort, 40).toLowerCase();
  let items = getCatalogAndPostProducts(db);

  items = items.filter((item) => {
    const moderationState = (db.productModeration || {})[item.productId];
    if (moderationState === "rejected") return false;
    return true;
  });

  if (q) {
    items = items.filter((item) =>
      [item.name, item.productId, item.sellerName, item.description].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }
  if (category) items = items.filter((item) => String(item.category || "").toLowerCase() === category);

  if (sort === "price_asc") items.sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === "price_desc") items.sort((a, b) => Number(b.price) - Number(a.price));
  if (sort === "best_selling") items.sort((a, b) => Number(b.sold) - Number(a.sold));
  res.json({ items });
});

app.get("/api/products/:productId", (req, res) => {
  const db = readDb();
  const productId = normalizeProductId(req.params.productId);
  const product = getCatalogAndPostProducts(db).find((item) => normalizeProductId(item.productId) === productId);
  if (!product) return res.status(404).json({ error: "Product not found." });
  const reviews = (db.serviceProviderRatings || {})[productId] || [];
  res.json({ product: { ...product, variants: ["default"], reviews } });
});

app.get("/api/wishlist", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const ids = (db.wishlists && db.wishlists[actorKey]) || [];
  res.json({ productIds: ids });
});

app.post("/api/wishlist/:productId", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const productId = normalizeProductId(req.params.productId);
  if (!productId) return res.status(400).json({ error: "Product ID required." });
  db.wishlists = db.wishlists || {};
  if (!Array.isArray(db.wishlists[actorKey])) db.wishlists[actorKey] = [];
  if (!db.wishlists[actorKey].includes(productId)) db.wishlists[actorKey].push(productId);
  writeDb(db);
  res.status(201).json({ productIds: db.wishlists[actorKey] });
});

app.delete("/api/wishlist/:productId", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const productId = normalizeProductId(req.params.productId);
  db.wishlists = db.wishlists || {};
  const list = Array.isArray(db.wishlists[actorKey]) ? db.wishlists[actorKey] : [];
  db.wishlists[actorKey] = list.filter((id) => id !== productId);
  writeDb(db);
  res.json({ productIds: db.wishlists[actorKey] });
});

app.get("/api/addresses", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  db.addresses = db.addresses || {};
  res.json({ items: db.addresses[user.id] || [] });
});

app.post("/api/addresses", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  const label = sanitizeText(req.body.label, 60) || "Address";
  const line = sanitizeText(req.body.line, 220);
  const city = sanitizeText(req.body.city, 120);
  const country = sanitizeText(req.body.country, 120);
  if (!line || !city) return res.status(400).json({ error: "Address line and city are required." });
  const item = { id: generateId(), label, line, city, country, createdAt: new Date().toISOString() };
  db.addresses = db.addresses || {};
  if (!Array.isArray(db.addresses[user.id])) db.addresses[user.id] = [];
  db.addresses[user.id].push(item);
  writeDb(db);
  res.status(201).json({ item, items: db.addresses[user.id] });
});

app.delete("/api/addresses/:id", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  const id = String(req.params.id || "").trim();
  db.addresses = db.addresses || {};
  const list = Array.isArray(db.addresses[user.id]) ? db.addresses[user.id] : [];
  db.addresses[user.id] = list.filter((item) => item.id !== id);
  writeDb(db);
  res.json({ items: db.addresses[user.id] });
});

app.get("/api/notifications", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
  const items = ((db.notifications && db.notifications[user.id]) || []).slice(0, limit);
  res.json({ items });
});

app.post("/api/notifications/:id/read", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  const id = String(req.params.id || "").trim();
  const list = ((db.notifications && db.notifications[user.id]) || []);
  const item = list.find((n) => n.id === id);
  if (!item) return res.status(404).json({ error: "Notification not found." });
  item.read = true;
  writeDb(db);
  res.json({ ok: true });
});

app.post("/api/auth/password-reset/request", (req, res) => {
  const db = readDb();
  const email = sanitizeEmail(req.body.email);
  const user = (db.users || []).find((u) => u.email === email);
  if (!user) return res.json({ ok: true });
  const token = generateId();
  db.passwordResetTokens = db.passwordResetTokens || {};
  db.passwordResetTokens[user.id] = { token, expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString() };
  writeDb(db);
  res.json({ ok: true, token });
});

app.post("/api/auth/password-reset/confirm", (req, res) => {
  const db = readDb();
  const email = sanitizeEmail(req.body.email);
  const token = sanitizeText(req.body.token, 120);
  const newPassword = String(req.body.newPassword || "");
  if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  const user = (db.users || []).find((u) => u.email === email);
  if (!user) return res.status(404).json({ error: "Account not found." });
  const entry = db.passwordResetTokens && db.passwordResetTokens[user.id];
  if (!entry || entry.token !== token || new Date(entry.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired reset token." });
  }
  user.passwordSalt = generateId();
  user.passwordHash = hashPassword(newPassword, user.passwordSalt);
  delete db.passwordResetTokens[user.id];
  writeDb(db);
  res.json({ ok: true });
});

app.post("/api/auth/email-verification/request", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  db.emailVerificationTokens = db.emailVerificationTokens || {};
  const token = generateId();
  db.emailVerificationTokens[user.id] = { token, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() };
  writeDb(db);
  res.json({ ok: true, token });
});

app.post("/api/auth/email-verification/verify", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  const token = sanitizeText(req.body.token, 120);
  const entry = db.emailVerificationTokens && db.emailVerificationTokens[user.id];
  if (!entry || entry.token !== token || new Date(entry.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired verification token." });
  }
  user.emailVerified = true;
  delete db.emailVerificationTokens[user.id];
  writeDb(db);
  res.json({ ok: true });
});

app.get("/api/seller/dashboard", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  const posts = (db.productPosts || []).filter((p) => p.sellerUserId === user.id);
  const orders = (db.orders || [])
    .filter((order) => isSellerForOrder(db, user.id, order))
    .slice(-100)
    .reverse()
    .map((order) => hydrateOrderForClient(db, order));
  const revenue = orders.reduce((sum, order) => sum + (Number(order.netAmount) || 0), 0);
  res.json({
    summary: { productCount: posts.length, orderCount: orders.length, revenue: roundMoney(revenue) },
    posts,
    orders
  });
});

app.post("/api/seller/payouts/request", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  const amount = roundMoney(Number(req.body.amount));
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Enter a valid amount." });
  const request = { id: generateId(), sellerUserId: user.id, amount, status: "requested", createdAt: new Date().toISOString() };
  db.sellerPayouts = db.sellerPayouts || [];
  db.sellerPayouts.push(request);
  writeDb(db);
  res.status(201).json({ request });
});

app.get("/api/seller/payouts", (req, res) => {
  const db = readDb();
  const user = getUserBySession(db, req.sessionId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  const items = (db.sellerPayouts || []).filter((p) => p.sellerUserId === user.id).slice(-100).reverse();
  res.json({ items });
});

app.post("/api/payments/intent", (req, res) => {
  const amount = roundMoney(Number(req.body.amount));
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Invalid payment amount." });
  const intentId = `pi_${generateId().replace(/-/g, "").slice(0, 20)}`;
  res.json({ id: intentId, status: "requires_confirmation", clientSecret: `${intentId}_secret_mock` });
});

app.post("/api/payments/webhook", (req, res) => {
  res.json({ ok: true, receivedAt: new Date().toISOString() });
});

app.get("/api/security/csrf", (req, res) => {
  const db = readDb();
  const session = db.sessions[req.sessionId];
  if (!session) return res.status(400).json({ error: "Session unavailable." });
  const token = generateId();
  session.csrfToken = token;
  session.csrfTokenAt = new Date().toISOString();
  writeDb(db);
  res.json({ token });
});

app.post("/api/waitlist", (req, res) => {
  const db = readDb();
  const name = sanitizeName(req.body.name);
  const email = sanitizeEmail(req.body.email);
  const role = sanitizeName(req.body.role || "Investor");

  if (!name || !isValidEmail(email)) {
    res.status(400).json({ error: "Please complete all fields with valid values." });
    return;
  }

  const exists = db.waitlist.some((entry) => entry.email === email);
  if (exists) {
    res.status(409).json({ error: "This email is already on the waitlist." });
    return;
  }

  const entry = {
    id: generateId(),
    name,
    email,
    role,
    createdAt: new Date().toISOString()
  };
  db.waitlist.push(entry);
  writeDb(db);
  res.status(201).json({ entry });
});

app.post("/api/product-posts", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const session = db.sessions[req.sessionId];
  const user = session && session.userId ? db.users.find((item) => item.id === session.userId) : null;

  if (user && user.role === "advertiser") {
    res.status(403).json({ error: "Advertiser accounts can only create ads, not product listings." });
    return;
  }

  const title = sanitizeText(req.body.title, 120);
  const category = sanitizeText(req.body.category, 40).toLowerCase();
  const description = sanitizeText(req.body.description, 800);
  const rawContact = sanitizeText(req.body.contact, 120);
  const imageData = sanitizeImageData(req.body.imageData);
  const price = roundMoney(Number(req.body.price));
  const contact = rawContact || (user ? user.email : "Not provided");
  const stockTotal = Math.max(1, Math.min(9999, Number(req.body.stockTotal) || 60));
  const postId = generateId();
  const productId = getPostProductId(postId);

  if (title.length < 3) {
    res.status(400).json({ error: "Product title must be at least 3 characters." });
    return;
  }
  if (!["clothing", "service", "other"].includes(category)) {
    res.status(400).json({ error: "Select a valid category." });
    return;
  }
  if (!Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "Enter a valid price." });
    return;
  }
  if (description.length < 10) {
    res.status(400).json({ error: "Description must be at least 10 characters." });
    return;
  }

  const post = {
    id: postId,
    productId,
    actorKey,
    sellerUserId: user ? user.id : null,
    userEmail: user ? user.email : "guest",
    title,
    category,
    price,
    description,
    contact,
    imageData,
    stockTotal,
    soldCount: 0,
    createdAt: new Date().toISOString()
  };
  db.productPosts.push(post);
  writeDb(db);
  res.status(201).json({
    post: {
      ...post,
      remaining: Math.max(0, stockTotal - post.soldCount)
    }
  });
});

app.get("/api/product-posts", (req, res) => {
  const db = readDb();
  const actorKey = getActorKey(db, req.sessionId);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
  const mineOnly = String(req.query.mine || "").toLowerCase() === "true" || String(req.query.mine || "") === "1";
  let items = Array.isArray(db.productPosts) ? db.productPosts : [];
  items = items.filter((item) => {
    const productId = normalizeProductId(item.productId || getPostProductId(item.id));
    return ((db.productModeration || {})[productId] || "approved") !== "rejected";
  });
  if (mineOnly) items = items.filter((item) => item.actorKey === actorKey);
  items = items.slice(-limit).reverse();
  const hydrated = items.map((item) => {
    const stockTotal = Math.max(1, Number(item.stockTotal) || 60);
    const soldCount = Math.max(0, Math.min(stockTotal, Number(item.soldCount) || 0));
    return {
      ...item,
      productId: String(item.productId || getPostProductId(item.id)),
      stockTotal,
      soldCount,
      remaining: Math.max(0, stockTotal - soldCount)
    };
  });
  res.json({ items: hydrated });
});

const validImagePositions = ["left", "right", "top", "bottom", "none"];

app.post("/api/ad-posts", (req, res) => {
  const db = readDb();
  const session = db.sessions[req.sessionId];
  const user = session && session.userId ? db.users.find((item) => item.id === session.userId) : null;

  if (!user || user.role !== "advertiser") {
    res.status(403).json({ error: "Only advertiser accounts can create ads." });
    return;
  }

  const text = sanitizeText(req.body.text, 1200);
  const text2 = sanitizeText(req.body.text2, 1200);
  const imageData = sanitizeImageData(req.body.imageData);
  const imagePosition = validImagePositions.includes(String(req.body.imagePosition || "").toLowerCase())
    ? String(req.body.imagePosition).toLowerCase()
    : "none";

  if (text.length < 1 && text2.length < 1) {
    res.status(400).json({ error: "At least one text block is required." });
    return;
  }

  const ad = {
    id: generateId(),
    actorKey: `user:${user.id}`,
    userEmail: user.email,
    text: text || "",
    text2: text2 || "",
    imageData: imageData || "",
    imagePosition,
    createdAt: new Date().toISOString()
  };
  db.adPosts = db.adPosts || [];
  db.adPosts.push(ad);
  writeDb(db);
  res.status(201).json({ ad });
});

app.get("/api/ad-posts", (req, res) => {
  const db = readDb();
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
  let items = Array.isArray(db.adPosts) ? db.adPosts : [];
  items = items.slice(-limit).reverse();
  res.json({ items });
});

app.delete("/api/ad-posts/:id", (req, res) => {
  const db = readDb();
  const session = db.sessions[req.sessionId];
  const user = session && session.userId ? db.users.find((item) => item.id === session.userId) : null;
  if (!user || user.role !== "advertiser") {
    res.status(403).json({ error: "Only the advertiser can delete ads." });
    return;
  }
  const id = String(req.params.id || "").trim();
  if (!id) {
    res.status(400).json({ error: "Ad ID required." });
    return;
  }
  const actorKey = `user:${user.id}`;
  const index = (db.adPosts || []).findIndex((ad) => ad.id === id && ad.actorKey === actorKey);
  if (index === -1) {
    res.status(404).json({ error: "Ad not found or you cannot delete it." });
    return;
  }
  db.adPosts.splice(index, 1);
  writeDb(db);
  res.json({ ok: true });
});

function getServiceProviderRatings(db, providerId) {
  const list = (db.serviceProviderRatings || {})[providerId];
  if (!Array.isArray(list)) return { average: 0, count: 0 };
  const count = list.length;
  if (count === 0) return { average: 0, count: 0 };
  const sum = list.reduce((s, r) => s + (Number(r.stars) || 0), 0);
  return { average: roundMoney(sum / count), count };
}

app.get("/api/service-providers", (req, res) => {
  const db = readDb();
  const list = Array.isArray(db.serviceProviders) ? db.serviceProviders : [];
  const activeOnly = String(req.query.active).toLowerCase() === "true";
  let items = activeOnly ? list.filter((p) => p.isActive !== false) : list;
  items = items.map((p) => {
    const { average, count } = getServiceProviderRatings(db, p.id);
    return { ...p, ratingAverage: average, ratingCount: count };
  });
  res.json({ items });
});

app.post("/api/service-providers/:id/rate", (req, res) => {
  const db = readDb();
  const session = db.sessions[req.sessionId];
  const user = session && session.userId ? db.users.find((item) => item.id === session.userId) : null;
  if (!user) {
    res.status(401).json({ error: "Please log in to rate a provider." });
    return;
  }
  const id = String(req.params.id || "").trim();
  const stars = Math.max(1, Math.min(5, Math.floor(Number(req.body.stars) || 0)));
  if (!id) {
    res.status(400).json({ error: "Provider ID required." });
    return;
  }
  const provider = (db.serviceProviders || []).find((p) => p.id === id);
  if (!provider) {
    res.status(404).json({ error: "Provider not found." });
    return;
  }
  db.serviceProviderRatings = db.serviceProviderRatings || {};
  if (!Array.isArray(db.serviceProviderRatings[id])) db.serviceProviderRatings[id] = [];
  const ratings = db.serviceProviderRatings[id];
  const existing = ratings.findIndex((r) => r.userId === user.id);
  const entry = { userId: user.id, stars, createdAt: new Date().toISOString() };
  if (existing >= 0) ratings[existing] = entry;
  else ratings.push(entry);
  writeDb(db);
  const { average, count } = getServiceProviderRatings(db, id);
  res.json({ ok: true, ratingAverage: average, ratingCount: count });
});

app.post("/api/admin/service-providers", requireAdmin, (req, res) => {
  const db = readDb();
  const name = sanitizeText(req.body.name, 120);
  const address = sanitizeText(req.body.address, 300);
  const phone = sanitizeText(req.body.phone, 40);
  const imageData = sanitizeImageData(req.body.imageData);
  const isActive = req.body.isActive !== false && req.body.isActive !== "false";

  if (name.length < 2) {
    res.status(400).json({ error: "Name must be at least 2 characters." });
    return;
  }

  const provider = {
    id: generateId(),
    name,
    address: address || "",
    phone: phone || "",
    imageData: imageData || "",
    isActive: !!isActive,
    createdAt: new Date().toISOString()
  };
  db.serviceProviders = db.serviceProviders || [];
  db.serviceProviders.push(provider);
  writeDb(db);
  const { average, count } = getServiceProviderRatings(db, provider.id);
  res.status(201).json({ provider: { ...provider, ratingAverage: average, ratingCount: count } });
});

app.get("/api/admin/service-providers", requireAdmin, (req, res) => {
  const db = readDb();
  const list = Array.isArray(db.serviceProviders) ? db.serviceProviders : [];
  const items = list.map((p) => {
    const { average, count } = getServiceProviderRatings(db, p.id);
    return { ...p, ratingAverage: average, ratingCount: count };
  });
  res.json({ items });
});

app.get("/api/admin/product-posts", requireAdmin, (req, res) => {
  const db = readDb();
  const items = (db.productPosts || []).slice().reverse().map((post) => ({
    ...post,
    moderationStatus: (db.productModeration || {})[normalizeProductId(post.productId || getPostProductId(post.id))] || "approved"
  }));
  res.json({ items });
});

app.post("/api/admin/product-posts/:id/moderate", requireAdmin, (req, res) => {
  const db = readDb();
  const id = String(req.params.id || "").trim();
  const status = sanitizeText(req.body.status, 20).toLowerCase();
  if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid moderation status." });
  const post = (db.productPosts || []).find((item) => item.id === id);
  if (!post) return res.status(404).json({ error: "Post not found." });
  const productId = normalizeProductId(post.productId || getPostProductId(post.id));
  db.productModeration = db.productModeration || {};
  db.productModeration[productId] = status;
  writeDb(db);
  res.json({ ok: true, productId, status });
});

app.post("/api/admin/users/:id/flag", requireAdmin, (req, res) => {
  const db = readDb();
  const id = String(req.params.id || "").trim();
  const reason = sanitizeText(req.body.reason, 220) || "Flagged by admin";
  const user = (db.users || []).find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "User not found." });
  db.userFlags = db.userFlags || {};
  db.userFlags[id] = { flaggedAt: new Date().toISOString(), reason };
  writeDb(db);
  res.json({ ok: true, flagged: db.userFlags[id] });
});

app.get("/api/admin/users/:id/details", requireAdmin, (req, res) => {
  const db = readDb();
  const id = String(req.params.id || "").trim();
  const user = (db.users || []).find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "User not found." });

  const postedItems = (db.productPosts || [])
    .filter((post) => post.sellerUserId === id || sanitizeEmail(post.userEmail) === sanitizeEmail(user.email))
    .slice()
    .reverse()
    .map((post) => ({
      id: post.id,
      productId: normalizeProductId(post.productId || getPostProductId(post.id)),
      title: sanitizeText(post.title, 120),
      category: sanitizeText(post.category, 40),
      price: roundMoney(Number(post.price) || 0),
      stockTotal: Math.max(1, Number(post.stockTotal) || 60),
      soldCount: Math.max(0, Number(post.soldCount) || 0),
      createdAt: post.createdAt || null
    }));

  const actorKey = `user:${id}`;
  const purchases = (db.orders || [])
    .filter((order) => order.actorKey === actorKey || sanitizeEmail(order.userEmail) === sanitizeEmail(user.email))
    .slice()
    .reverse()
    .map((order) => hydrateOrderForClient(db, order));

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || "user",
      profileImage: user.profileImage || null,
      createdAt: user.createdAt || null
    },
    postedItems,
    purchases
  });
});

app.get("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const db = readDb();
  const id = String(req.params.id || "").trim();
  const order = (db.orders || []).find((o) => o.id === id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  const hydrated = hydrateOrderForClient(db, order);
  const trackingHistory = (db.orderTracking && db.orderTracking[id]) || getOrderStatusHistory(order);
  res.json({
    order: hydrated,
    tracking: {
      orderId: id,
      trackingNumber: order.trackingNumber || "",
      status: order.status || "paid",
      history: trackingHistory
    }
  });
});

app.get("/api/admin/analytics", requireAdmin, (req, res) => {
  const db = readDb();
  const orders = Array.isArray(db.orders) ? db.orders : [];
  const products = getCatalogAndPostProducts(db);
  const byDay = {};
  orders.forEach((order) => {
    const day = String(order.createdAt || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + (Number(order.total) || 0);
  });
  const topProducts = products
    .slice()
    .sort((a, b) => Number(b.sold) - Number(a.sold))
    .slice(0, 10)
    .map((p) => ({ productId: p.productId, name: p.name, sold: p.sold, revenueEstimate: roundMoney((p.price || 0) * (p.sold || 0)) }));
  const abandonedCarts = Object.values(db.carts || {}).filter((items) => Array.isArray(items) && items.length > 0).length;
  res.json({
    generatedAt: new Date().toISOString(),
    kpis: {
      users: (db.users || []).length,
      orders: orders.length,
      productCount: products.length,
      abandonedCarts
    },
    revenueByDay: byDay,
    topProducts
  });
});

app.get("/api/admin/backup", requireAdmin, (req, res) => {
  const db = readDb();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename=\"nova-backup-${new Date().toISOString().slice(0, 10)}.json\"`);
  res.send(JSON.stringify(db, null, 2));
});

app.get("/api/catalog/stats", (req, res) => {
  const db = readDb();
  const catalogItems = Object.keys(defaultCatalogStock).map((productId) => {
    const sold = getCatalogSoldCount(db, productId);
    const stockTotal = getCatalogStockForId(db, productId);
    return {
      productId,
      sold,
      stockTotal,
      remaining: Math.max(0, stockTotal - sold)
    };
  });

  const postItems = (db.productPosts || []).map((item) => {
    const productId = normalizeProductId(item.productId || getPostProductId(item.id));
    const stockTotal = Math.max(1, Number(item.stockTotal) || 60);
    const sold = Math.max(0, Math.min(stockTotal, Number(item.soldCount) || 0));
    return {
      productId,
      sold,
      stockTotal,
      remaining: Math.max(0, stockTotal - sold)
    };
  });

  res.json({ items: [...catalogItems, ...postItems] });
});

app.get("/api/admin/overview", requireAdmin, (req, res) => {
  const db = readDb();
  const now = new Date().toISOString();

  const walletEntries = Object.values(db.wallets || {});
  const walletTotals = walletEntries.reduce(
    (acc, wallet) => {
      acc.local += Number(wallet.local) || 0;
      acc.crypto += Number(wallet.crypto) || 0;
      return acc;
    },
    { local: 0, crypto: 0 }
  );

  const orders = Array.isArray(db.orders) ? db.orders : [];
  const commissions = { ...getDefaultCommissionBalance(), ...(db.commissions || {}) };
  const totalCommissions = roundMoney((commissions.local || 0) + (commissions.crypto || 0));
  const orderTotals = orders.reduce(
    (acc, order) => {
      const total = Number(order.total) || 0;
      acc.all += total;
      if (order.wallet === "crypto") acc.crypto += total;
      else acc.local += total;
      return acc;
    },
    { all: 0, local: 0, crypto: 0 }
  );

  const recentOrders = orders.slice(-30).reverse();
  const allUsers = (db.users || []).slice().reverse().map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    profileImage: user.profileImage || null,
    createdAt: user.createdAt
  }));
  const recentWaitlist = (db.waitlist || []).slice(-20).reverse();

  res.json({
    at: now,
    commissionRate: getCommissionRate(),
    summary: {
      userCount: (db.users || []).length,
      sessionCount: Object.keys(db.sessions || {}).length,
      cartCount: Object.keys(db.carts || {}).length,
      walletCount: walletEntries.length,
      orderCount: orders.length,
      waitlistCount: (db.waitlist || []).length,
      productPostCount: (db.productPosts || []).length
    },
    wallets: walletTotals,
    revenue: orderTotals,
    commissions: {
      local: roundMoney(commissions.local || 0),
      crypto: roundMoney(commissions.crypto || 0),
      total: totalCommissions
    },
    recentOrders,
    allUsers,
    recentWaitlist
  });
});

app.post("/api/admin/wallets/reset-all", requireAdmin, (req, res) => {
  const db = readDb();
  const walletKeys = Object.keys(db.wallets || {});
  walletKeys.forEach((key) => {
    db.wallets[key] = getDefaultWallet();
  });
  writeDb(db);
  res.json({ ok: true, resetCount: walletKeys.length });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "welcome.html"));
});

app.use(express.static(__dirname));

app.listen(port, () => {
  const db = readDb();
  if (ensureAdvertiserUser(db)) {
    writeDb(db);
    console.log("Advertiser user created: info@novashop.com");
  }
  console.log(`Nova Market server running on http://localhost:${port}`);
});
