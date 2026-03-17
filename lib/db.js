/**
 * Database layer: MongoDB (when MONGODB_URI is set) or JSON file fallback.
 * Uses a single "store" document to mirror the original db.json structure.
 */

const fs = require("fs");
const path = require("path");

const STORE_ID = "main";
const dbPath = path.join(__dirname, "..", "data", "db.json");

let _client = null;
let _db = null;

async function getMongoClient() {
  if (_client) return _client;
  const { MongoClient } = require("mongodb");
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  _client = new MongoClient(uri);
  await _client.connect();
  return _client;
}

async function getMongoDb() {
  if (_db) return _db;
  const client = await getMongoClient();
  if (!client) return null;
  const dbName = process.env.MONGODB_DB || "nova-market";
  _db = client.db(dbName);
  return _db;
}

function ensureJsonFolder() {
  const folder = path.dirname(dbPath);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
}

function readDbSync() {
  ensureJsonFolder();
  if (!fs.existsSync(dbPath)) return null;
  try {
    const raw = fs.readFileSync(dbPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeDbSync(data) {
  ensureJsonFolder();
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

/**
 * Read the full store. Returns a plain object suitable for merging with defaultDb.
 * @param {object} defaultDb - Default structure to merge with
 * @param {function} normalize - Optional function(parsed) => normalized
 * @returns {Promise<object>}
 */
async function readDb(defaultDb, normalize) {
  const mongo = await getMongoDb();
  if (mongo) {
    const col = mongo.collection("store");
    const doc = await col.findOne({ _id: STORE_ID });
    const parsed = doc ? doc.data : null;
    const normalized = normalize && parsed ? normalize(parsed) : parsed;
    return parsed ? { ...defaultDb, ...normalized } : { ...defaultDb };
  }
  const parsed = readDbSync();
  const normalized = normalize && parsed ? normalize(parsed) : parsed;
  return normalized ? { ...defaultDb, ...normalized } : { ...defaultDb };
}

/**
 * Write the full store.
 * @param {object} data - Full store object
 * @returns {Promise<void>}
 */
async function writeDb(data) {
  const mongo = await getMongoDb();
  if (mongo) {
    const col = mongo.collection("store");
    await col.replaceOne({ _id: STORE_ID }, { _id: STORE_ID, data }, { upsert: true });
    return;
  }
  writeDbSync(data);
}

function useMongo() {
  return !!process.env.MONGODB_URI;
}

module.exports = { readDb, writeDb, useMongo, readDbSync, writeDbSync, getMongoDb };

