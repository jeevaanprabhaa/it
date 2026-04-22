-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query → Run).
-- Creates all tables used by the ZEX backend.

CREATE TABLE IF NOT EXISTS wallets (
  session_id     TEXT PRIMARY KEY,
  username       TEXT NOT NULL,
  balance        NUMERIC(20,2) NOT NULL DEFAULT 10000,
  deposited      NUMERIC(20,2) NOT NULL DEFAULT 0,
  pnl_total      NUMERIC(20,2) NOT NULL DEFAULT 0,
  trades_count   INTEGER NOT NULL DEFAULT 0,
  wins_count     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL,
  symbol         TEXT NOT NULL,
  side           TEXT NOT NULL,
  order_type     TEXT NOT NULL,
  price          NUMERIC(20,8) NOT NULL DEFAULT 0,
  trigger_price  NUMERIC(20,8),
  quantity       NUMERIC(24,10) NOT NULL,
  status         TEXT NOT NULL,
  fill_price     NUMERIC(20,8),
  pnl            NUMERIC(20,2),
  filled_at      TIMESTAMPTZ,
  time           BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_session_idx ON orders(session_id);
CREATE INDEX IF NOT EXISTS orders_status_idx  ON orders(status);

CREATE TABLE IF NOT EXISTS journal_entries (
  id               TEXT PRIMARY KEY,
  session_id       TEXT NOT NULL,
  trade_id         TEXT NOT NULL,
  reason           TEXT,
  emotion          TEXT NOT NULL,
  market_condition TEXT,
  notes            TEXT,
  trade_json       JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS journal_session_idx ON journal_entries(session_id);

CREATE TABLE IF NOT EXISTS deposits (
  id                  SERIAL PRIMARY KEY,
  session_id          TEXT NOT NULL,
  payment_intent_id   TEXT UNIQUE,
  real_amount_cents   INTEGER NOT NULL,
  virtual_credits     NUMERIC(20,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
