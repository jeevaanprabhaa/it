const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => console.error('Unexpected pg pool error', err));

const query = (text, params) => pool.query(text, params);

// ── Wallets ────────────────────────────────────────────────────────────────
async function getOrCreateWallet(sessionId) {
  const sel = await query('SELECT * FROM wallets WHERE session_id = $1', [sessionId]);
  if (sel.rows[0]) return rowToWallet(sel.rows[0]);
  const username = `Trader_${sessionId.slice(0, 6)}`;
  const ins = await query(
    `INSERT INTO wallets (session_id, username) VALUES ($1, $2) RETURNING *`,
    [sessionId, username]
  );
  return rowToWallet(ins.rows[0]);
}

async function updateWalletPnl(sessionId, pnl) {
  await getOrCreateWallet(sessionId);
  const r = await query(
    `UPDATE wallets
       SET pnl_total    = pnl_total + $2,
           balance      = balance   + $2,
           trades_count = trades_count + 1,
           wins_count   = wins_count + CASE WHEN $2 > 0 THEN 1 ELSE 0 END
     WHERE session_id = $1
     RETURNING *`,
    [sessionId, pnl]
  );
  return rowToWallet(r.rows[0]);
}

async function setUsername(sessionId, username) {
  await getOrCreateWallet(sessionId);
  const r = await query(
    `UPDATE wallets SET username = $2 WHERE session_id = $1 RETURNING *`,
    [sessionId, username]
  );
  return rowToWallet(r.rows[0]);
}

async function creditBalance(sessionId, amount) {
  await getOrCreateWallet(sessionId);
  const r = await query(
    `UPDATE wallets SET balance = balance + $2, deposited = deposited + $2 WHERE session_id = $1 RETURNING *`,
    [sessionId, amount]
  );
  return rowToWallet(r.rows[0]);
}

async function debitBalance(sessionId, amount) {
  const r = await query(
    `UPDATE wallets SET balance = balance - $2 WHERE session_id = $1 AND balance >= $2 RETURNING *`,
    [sessionId, amount]
  );
  return r.rows[0] ? rowToWallet(r.rows[0]) : null;
}

async function getLeaderboard() {
  const r = await query(
    `SELECT username, pnl_total, trades_count, wins_count, balance
       FROM wallets
       WHERE trades_count > 0
       ORDER BY pnl_total DESC
       LIMIT 20`
  );
  return r.rows.map(row => ({
    username: row.username,
    pnlTotal: parseFloat(row.pnl_total),
    tradesCount: row.trades_count,
    winRate: row.trades_count > 0
      ? parseFloat(((row.wins_count / row.trades_count) * 100).toFixed(1))
      : 0,
    balance: parseFloat(row.balance),
  }));
}

function rowToWallet(row) {
  return {
    sessionId:   row.session_id,
    username:    row.username,
    balance:     parseFloat(row.balance),
    deposited:   parseFloat(row.deposited),
    pnlTotal:    parseFloat(row.pnl_total),
    tradesCount: row.trades_count,
    winsCount:   row.wins_count,
    createdAt:   row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

// ── Orders ─────────────────────────────────────────────────────────────────
async function insertOrder(o) {
  const r = await query(
    `INSERT INTO orders
      (id, session_id, symbol, side, order_type, price, trigger_price, quantity, status, time)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
     RETURNING *`,
    [o.id, o.sessionId, o.symbol, o.side, o.orderType, o.price, o.triggerPrice ?? null, o.quantity, o.status, o.time]
  );
  return rowToOrder(r.rows[0]);
}

async function fillOrder(id, fillPrice, pnl) {
  const r = await query(
    `UPDATE orders
        SET status = 'FILLED', fill_price = $2, pnl = $3, filled_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, fillPrice, pnl]
  );
  return r.rows[0] ? rowToOrder(r.rows[0]) : null;
}

async function cancelOrder(id) {
  const r = await query(
    `UPDATE orders SET status = 'CANCELLED' WHERE id = $1 AND status = 'PENDING' RETURNING *`,
    [id]
  );
  return r.rows[0] ? rowToOrder(r.rows[0]) : null;
}

async function getPendingOrders() {
  const r = await query(`SELECT * FROM orders WHERE status = 'PENDING'`);
  return r.rows.map(rowToOrder);
}

async function getOrdersForSession(sessionId) {
  const r = await query(
    `SELECT * FROM orders WHERE session_id = $1 ORDER BY time DESC LIMIT 200`,
    [sessionId]
  );
  return r.rows.map(rowToOrder);
}

async function getAllOrders() {
  const r = await query(`SELECT * FROM orders ORDER BY time DESC LIMIT 1000`);
  return r.rows.map(rowToOrder);
}

function rowToOrder(row) {
  return {
    id:           row.id,
    sessionId:    row.session_id,
    symbol:       row.symbol,
    side:         row.side,
    orderType:    row.order_type,
    price:        parseFloat(row.price),
    triggerPrice: row.trigger_price !== null ? parseFloat(row.trigger_price) : undefined,
    quantity:     parseFloat(row.quantity),
    status:       row.status,
    fillPrice:    row.fill_price !== null ? parseFloat(row.fill_price) : null,
    pnl:          row.pnl !== null ? parseFloat(row.pnl) : null,
    filledAt:     row.filled_at ? new Date(row.filled_at).getTime() : null,
    time:         Number(row.time),
  };
}

// ── Journal ────────────────────────────────────────────────────────────────
async function insertJournalEntry(e) {
  const r = await query(
    `INSERT INTO journal_entries
       (id, session_id, trade_id, reason, emotion, market_condition, notes, trade_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [e.id, e.sessionId, e.trade_id, e.reason || '', e.emotion, e.market_condition || 'ranging', e.notes || '', e.trade ? JSON.stringify(e.trade) : null]
  );
  return rowToEntry(r.rows[0]);
}

async function getJournalEntries(sessionId) {
  const r = sessionId
    ? await query(`SELECT * FROM journal_entries WHERE session_id = $1 ORDER BY created_at DESC LIMIT 500`, [sessionId])
    : await query(`SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT 500`);
  return r.rows.map(rowToEntry);
}

function rowToEntry(row) {
  return {
    id:               row.id,
    sessionId:        row.session_id,
    trade_id:         row.trade_id,
    reason:           row.reason,
    emotion:          row.emotion,
    market_condition: row.market_condition,
    notes:            row.notes,
    trade:            row.trade_json,
    created_at:       row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

// ── Deposits ───────────────────────────────────────────────────────────────
async function insertDeposit(sessionId, paymentIntentId, realCents, virtualCredits) {
  await query(
    `INSERT INTO deposits (session_id, payment_intent_id, real_amount_cents, virtual_credits, status)
     VALUES ($1,$2,$3,$4,'pending')
     ON CONFLICT (payment_intent_id) DO NOTHING`,
    [sessionId, paymentIntentId, realCents, virtualCredits]
  );
}

async function markDepositSucceeded(paymentIntentId) {
  const r = await query(
    `UPDATE deposits SET status = 'succeeded' WHERE payment_intent_id = $1 AND status <> 'succeeded' RETURNING *`,
    [paymentIntentId]
  );
  return r.rows[0] || null;
}

module.exports = {
  pool, query,
  getOrCreateWallet, updateWalletPnl, setUsername, creditBalance, debitBalance, getLeaderboard,
  insertOrder, fillOrder, cancelOrder, getPendingOrders, getOrdersForSession, getAllOrders,
  insertJournalEntry, getJournalEntries,
  insertDeposit, markDepositSucceeded,
};
