-- Bootloader D1 Database Schema
-- Users table with roles for authentication and authorization

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  public_key TEXT UNIQUE,
  roles INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login TEXT,
  display_name TEXT,
  avatar_url TEXT
);

-- Index for fast lookups by address
CREATE INDEX IF NOT EXISTS idx_users_address ON users(address);
CREATE INDEX IF NOT EXISTS idx_users_public_key ON users(public_key);

-- Sessions table to link upload sessions to users
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  cid TEXT,
  created_at TEXT NOT NULL,
  last_accessed TEXT,
  name TEXT,
  description TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_cid ON sessions(cid);
CREATE INDEX IF NOT EXISTS idx_sessions_is_public ON sessions(is_public);

-- Auth nonces for signature verification (short-lived)
CREATE TABLE IF NOT EXISTS auth_nonces (
  id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_nonces_public_key ON auth_nonces(public_key);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires_at ON auth_nonces(expires_at);

-- Role constants (stored as bitflags):
-- 0 = Regular user (no special permissions)
-- 1 = Admin (full access)
-- 2 = Moderator (can flag content)
-- 4 = Creator (verified creator badge)
-- Roles can be combined: Admin + Creator = 1 + 4 = 5

-- Generators table to store generator metadata
CREATE TABLE IF NOT EXISTS generators (
  id INTEGER NOT NULL,                          -- On-chain generator ID
  network TEXT NOT NULL DEFAULT 'mainnet',      -- 'mainnet' or 'shadownet'
  bootloader TEXT NOT NULL DEFAULT 'svg-js',    -- 'svg-js' or 'generic-web'
  name TEXT,                                    -- Generator name
  artifact_cid TEXT,                            -- IPFS CID of the project archive
  metadata_cid TEXT,                            -- IPFS CID of metadata JSON
  generator_description TEXT,                   -- Description of the generator
  token_description TEXT,                       -- Description template for tokens
  creator_address TEXT,                         -- Creator's Tezos address
  thumbnail_seed TEXT,                          -- Seed to use for generator thumbnail
  created_at TEXT NOT NULL,                     -- When we first saw this generator
  updated_at TEXT NOT NULL,                     -- Last update time
  PRIMARY KEY (id, network, bootloader)
);

-- Indexes for generator lookups
CREATE INDEX IF NOT EXISTS idx_generators_network ON generators(network);
CREATE INDEX IF NOT EXISTS idx_generators_bootloader ON generators(bootloader);
CREATE INDEX IF NOT EXISTS idx_generators_creator ON generators(creator_address);

-- Tokens table to store on-chain token data
CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY,                    -- On-chain token ID
  generator_id INTEGER NOT NULL,             -- Generator/collection this token belongs to
  network TEXT NOT NULL DEFAULT 'mainnet',   -- 'mainnet' or 'shadownet'
  bootloader TEXT NOT NULL DEFAULT 'svg-js', -- 'svg-js' or 'generic-web'
  seed TEXT,                                 -- Seed used to generate the token
  iteration INTEGER,                         -- Iteration number
  owner_address TEXT,                        -- Current owner's Tezos address
  minted_at TEXT,                            -- When the token was minted
  features_json TEXT,                        -- Full features JSON (for reference)
  created_at TEXT NOT NULL,                  -- When we first saw this token
  updated_at TEXT NOT NULL                   -- Last update time
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tokens_generator ON tokens(generator_id);
CREATE INDEX IF NOT EXISTS idx_tokens_network ON tokens(network);
CREATE INDEX IF NOT EXISTS idx_tokens_bootloader ON tokens(bootloader);
CREATE INDEX IF NOT EXISTS idx_tokens_owner ON tokens(owner_address);

-- Token attributes table (denormalized for efficient filtering/search)
-- Each row represents a single attribute for a token
CREATE TABLE IF NOT EXISTS token_attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER NOT NULL,
  generator_id INTEGER NOT NULL,             -- Denormalized for collection-level queries
  network TEXT NOT NULL DEFAULT 'mainnet',   -- Denormalized for filtering
  attribute_name TEXT NOT NULL,              -- Attribute name (e.g., "Background", "Color")
  attribute_value TEXT NOT NULL,             -- Attribute value (e.g., "Blue", "Rare")
  value_type TEXT NOT NULL DEFAULT 'string', -- 'string', 'number', 'boolean'
  numeric_value REAL,                        -- For numeric values (enables range queries)
  created_at TEXT NOT NULL,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE
);

-- Clean up legacy duplicate rows before enforcing uniqueness.
DELETE FROM token_attributes
WHERE id NOT IN (
  SELECT MAX(id)
  FROM token_attributes
  GROUP BY token_id, network, attribute_name
);

-- Indexes for attribute searching and filtering
CREATE INDEX IF NOT EXISTS idx_token_attrs_token ON token_attributes(token_id);
CREATE INDEX IF NOT EXISTS idx_token_attrs_generator ON token_attributes(generator_id);
CREATE INDEX IF NOT EXISTS idx_token_attrs_name ON token_attributes(attribute_name);
CREATE INDEX IF NOT EXISTS idx_token_attrs_value ON token_attributes(attribute_value);
CREATE INDEX IF NOT EXISTS idx_token_attrs_network ON token_attributes(network);
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_attrs_unique_name_per_token
  ON token_attributes(token_id, network, attribute_name);
-- Composite index for common filter pattern: collection + attribute + value
CREATE INDEX IF NOT EXISTS idx_token_attrs_filter ON token_attributes(generator_id, attribute_name, attribute_value);
-- Composite index for numeric range queries
CREATE INDEX IF NOT EXISTS idx_token_attrs_numeric ON token_attributes(generator_id, attribute_name, numeric_value);
