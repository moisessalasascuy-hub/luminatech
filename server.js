const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const Database = require('better-sqlite3');

const PORT = Number(process.env.PORT) || 3000;
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const databasePath = process.env.DATABASE_PATH || path.join(dataDir, 'luminatech.sqlite');
const publicShare = process.env.PUBLIC_SHARE === '1';
const adminPassword = process.env.ADMIN_PASSWORD || '';
if (publicShare && !adminPassword) throw new Error('Define ADMIN_PASSWORD antes de compartir la aplicación.');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const catalog = {
  crm: { name: 'Lumina CRM', price: 29 },
  shield: { name: 'DataShield Pro', price: 49 },
  analytics: { name: 'Analytics Hub', price: 39 },
  web: { name: 'Desarrollo Web a Medida', price: 899 },
  ia: { name: 'Automatización con IA', price: 599 },
  seo: { name: 'Posicionamiento SEO', price: 249 },
  design: { name: 'Diseño UX/UI', price: 449 },
  cloud: { name: 'Migración a la nube', price: 699 },
  support: { name: 'Soporte Premium', price: 99 }
};

const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid_demo',
    cardholder TEXT,
    buyer_initials TEXT,
    card_last4 TEXT,
    card_expiry TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit_price REAL NOT NULL
  );
`);

const orderColumns = new Set(db.pragma('table_info(orders)').map(column => column.name));
if (!orderColumns.has('cardholder')) db.exec('ALTER TABLE orders ADD COLUMN cardholder TEXT');
if (!orderColumns.has('buyer_initials')) db.exec('ALTER TABLE orders ADD COLUMN buyer_initials TEXT');
if (!orderColumns.has('card_last4')) db.exec('ALTER TABLE orders ADD COLUMN card_last4 TEXT');
if (!orderColumns.has('card_expiry')) db.exec('ALTER TABLE orders ADD COLUMN card_expiry TEXT');

const legacyOrders = db.prepare('SELECT id, cardholder FROM orders WHERE cardholder IS NOT NULL').all();
const migrateLegacyOrder = db.prepare(`
  UPDATE orders SET buyer_initials = ?, cardholder = NULL,
    status = CASE WHEN card_last4 IS NOT NULL THEN 'paid_demo' ELSE status END
  WHERE id = ?
`);
for (const order of legacyOrders) {
  const initials = order.cardholder.trim().split(/\s+/).filter(Boolean)
    .map(part => Array.from(part)[0]).join('').toLocaleUpperCase('es');
  migrateLegacyOrder.run(initials || null, order.id);
}
db.prepare("UPDATE orders SET status = 'paid_demo' WHERE status = 'demo' AND card_last4 IS NOT NULL").run();

const insertEvent = db.prepare('INSERT INTO events (type, details) VALUES (?, ?)');
const insertContact = db.prepare('INSERT INTO contacts (company, email, message) VALUES (?, ?, ?)');
const insertOrder = db.prepare("INSERT INTO orders (total, status, buyer_initials) VALUES (?, 'paid_demo', ?)");
const insertOrderItem = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, unit_price) VALUES (?, ?, ?, ?)');

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) request.destroy();
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    request.on('error', reject);
  });
}

function cleanText(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function getInitials(value) {
  return cleanText(value, 100).split(/\s+/).filter(Boolean)
    .map(part => Array.from(part)[0]).join('').toLocaleUpperCase('es');
}

const saveOrder = db.transaction((items, payment) => {
  const total = items.reduce((sum, item) => sum + item.unitPrice, 0);
  const order = insertOrder.run(total, payment.buyerInitials);
  for (const item of items) {
    insertOrderItem.run(order.lastInsertRowid, item.productId, item.name, item.unitPrice);
  }
  return { id: order.lastInsertRowid, total };
});

async function handleApi(request, response, url) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    return response.end();
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/data') {
    if (publicShare) {
      const authorization = request.headers.authorization || '';
      const encodedCredentials = authorization.startsWith('Basic ') ? authorization.slice(6) : '';
      const credentials = Buffer.from(encodedCredentials, 'base64').toString('utf8');
      const separator = credentials.indexOf(':');
      const suppliedPassword = Buffer.from(separator >= 0 ? credentials.slice(separator + 1) : '');
      const expectedPassword = Buffer.from(adminPassword);
      const authorized = separator >= 0 && credentials.slice(0, separator) === 'admin'
        && suppliedPassword.length === expectedPassword.length
        && crypto.timingSafeEqual(suppliedPassword, expectedPassword);
      if (!authorized) return sendJson(response, 401, { error: 'Se necesita la contraseña del panel' });
    }
    const contacts = db.prepare('SELECT id, company, email, message, created_at FROM contacts ORDER BY id DESC').all();
    const orders = db.prepare(`
      SELECT orders.id, orders.total, orders.status, orders.buyer_initials, orders.created_at,
        COALESCE(json_group_array(json_object('name', order_items.product_name, 'price', order_items.unit_price)), '[]') AS items
      FROM orders LEFT JOIN order_items ON order_items.order_id = orders.id
      GROUP BY orders.id ORDER BY orders.id DESC
    `).all().map(order => ({ ...order, items: JSON.parse(order.items) }));
    const events = db.prepare('SELECT id, type, details, created_at FROM events ORDER BY id DESC').all()
      .map(event => ({ ...event, details: JSON.parse(event.details) }));
    return sendJson(response, 200, { contacts, orders, events });
  }

  if (request.method === 'POST' && url.pathname === '/api/events') {
    const body = await readBody(request);
    const type = cleanText(body.type, 80);
    if (!type) return sendJson(response, 400, { error: 'El tipo de evento es obligatorio' });
    insertEvent.run(type, JSON.stringify(body.details || {}));
    return sendJson(response, 201, { ok: true });
  }

  if (request.method === 'POST' && url.pathname === '/api/contacts') {
    const body = await readBody(request);
    const company = cleanText(body.company, 120);
    const email = cleanText(body.email, 160);
    const message = cleanText(body.message, 2000);
    if (!company || !email || !message) return sendJson(response, 400, { error: 'Completa todos los campos' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return sendJson(response, 400, { error: 'Correo electrónico no válido' });
    const result = insertContact.run(company, email, message);
    insertEvent.run('contact_created', JSON.stringify({ contactId: result.lastInsertRowid }));
    return sendJson(response, 201, { ok: true, id: result.lastInsertRowid });
  }

  if (request.method === 'POST' && url.pathname === '/api/orders') {
    const body = await readBody(request);
    const items = Array.isArray(body.items) ? body.items : [];
    const buyerInitials = getInitials(body.buyerName);
    if (!buyerInitials) return sendJson(response, 400, { error: 'Escribe el nombre del comprador' });
    const validItems = items
      .map(item => {
        const productId = cleanText(item.productId, 40);
        const product = catalog[productId];
        return product ? { productId, name: product.name, unitPrice: product.price } : null;
      })
      .filter(Boolean);
    if (!validItems.length) return sendJson(response, 400, { error: 'El pedido no contiene productos válidos' });
    const order = saveOrder(validItems, { buyerInitials });
    insertEvent.run('order_created', JSON.stringify({ orderId: order.id, itemCount: validItems.length }));
    return sendJson(response, 201, { ok: true, orderId: order.id, total: order.total });
  }

  return sendJson(response, 404, { error: 'Ruta no encontrada' });
}

function serveStatic(response, url) {
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(rootDir, requestedPath));
  if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404);
    return response.end('No encontrado');
  }
  const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(request, response, url);
    else serveStatic(response, url);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Error interno del servidor' });
  }
});

function openBrowser(url) {
  const commands = {
    win32: ['cmd', ['/c', 'start', '', url]],
    darwin: ['open', [url]],
    linux: ['xdg-open', [url]]
  };
  const [command, args] = commands[process.platform] || [];
  if (!command) return;

  const browser = spawn(command, args, { detached: true, stdio: 'ignore' });
  browser.on('error', () => console.warn(`No se pudo abrir el navegador. Abre ${url} manualmente.`));
  browser.unref();
}

function startServer(port) {
  server.once('error', error => {
    if (error.code === 'EADDRINUSE' && port === PORT) {
      console.warn(`El puerto ${port} está ocupado. Usando http://localhost:${port + 1}`);
      startServer(port + 1);
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });
  server.listen(port, '0.0.0.0', () => {
    const localAddress = `http://localhost:${port}`;
    console.log(`LuminaTech disponible en ${localAddress}`);
    if (process.argv.includes('--open')) openBrowser(localAddress);
    const networkAddresses = Object.values(os.networkInterfaces())
      .flat()
      .filter(address => address && address.family === 'IPv4' && !address.internal)
      .map(address => `http://${address.address}:${port}`);
    networkAddresses.forEach(address => console.log(`Acceso desde la red: ${address}`));
  });
}

startServer(PORT);
