import type { D1Database } from '@cloudflare/workers-types';

export interface Token {
  id: number;
  generatorId: number;
  network: 'mainnet' | 'shadownet';
  bootloader: 'svg-js' | 'generic-web';
  seed: string | null;
  iteration: number | null;
  ownerAddress: string | null;
  mintedAt: string | null;
  featuresJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TokenAttribute {
  id: number;
  tokenId: number;
  generatorId: number;
  network: string;
  attributeName: string;
  attributeValue: string;
  valueType: 'string' | 'number' | 'boolean';
  numericValue: number | null;
  createdAt: string;
}

export interface TokenWithAttributes extends Token {
  attributes: Array<{
    name: string;
    value: string;
    type: 'string' | 'number' | 'boolean';
    numericValue: number | null;
  }>;
}

export interface StoreTokenParams {
  id: number;
  generatorId: number;
  network: 'mainnet' | 'shadownet';
  bootloader: 'svg-js' | 'generic-web';
  seed?: string | null;
  iteration?: number | null;
  ownerAddress?: string | null;
  mintedAt?: string | null;
  features?: Record<string, unknown> | null;
}

export class TokenService {
  constructor(private db: D1Database) {}

  /**
   * Store or update a token with its attributes
   */
  async storeToken(params: StoreTokenParams): Promise<Token> {
    const now = new Date().toISOString();
    const featuresJson = params.features ? JSON.stringify(params.features) : null;

    // Upsert the token
    const existingToken = await this.getToken(params.id, params.network);

    if (existingToken) {
      // Update existing token
      await this.db
        .prepare(`
          UPDATE tokens
          SET generator_id = ?, bootloader = ?, seed = ?, iteration = ?,
              owner_address = ?, minted_at = ?, features_json = ?, updated_at = ?
          WHERE id = ? AND network = ?
        `)
        .bind(
          params.generatorId,
          params.bootloader,
          params.seed ?? null,
          params.iteration ?? null,
          params.ownerAddress ?? null,
          params.mintedAt ?? null,
          featuresJson,
          now,
          params.id,
          params.network
        )
        .run();
    } else {
      // Insert new token
      await this.db
        .prepare(`
          INSERT INTO tokens (id, generator_id, network, bootloader, seed, iteration, owner_address, minted_at, features_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          params.id,
          params.generatorId,
          params.network,
          params.bootloader,
          params.seed ?? null,
          params.iteration ?? null,
          params.ownerAddress ?? null,
          params.mintedAt ?? null,
          featuresJson,
          now,
          now
        )
        .run();
    }

    // Store attributes if features provided
    if (params.features && Object.keys(params.features).length > 0) {
      await this.storeAttributes(params.id, params.generatorId, params.network, params.features);
    }

    return (await this.getToken(params.id, params.network))!;
  }

  /**
   * Store attributes for a token (replaces existing)
   */
  async storeAttributes(
    tokenId: number,
    generatorId: number,
    network: string,
    features: Record<string, unknown>
  ): Promise<void> {
    const now = new Date().toISOString();

    // Delete existing attributes for this token
    await this.db
      .prepare('DELETE FROM token_attributes WHERE token_id = ? AND network = ?')
      .bind(tokenId, network)
      .run();

    // Insert new attributes
    for (const [name, value] of Object.entries(features)) {
      const { valueType, stringValue, numericValue } = normalizeAttributeValue(value);

      await this.db
        .prepare(`
          INSERT INTO token_attributes (token_id, generator_id, network, attribute_name, attribute_value, value_type, numeric_value, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(tokenId, generatorId, network, name, stringValue, valueType, numericValue, now)
        .run();
    }

    // Defensive cleanup for any pre-existing duplicate rows from race conditions.
    // Keep the most recent row per attribute name.
    await this.db
      .prepare(`
        DELETE FROM token_attributes
        WHERE token_id = ? AND network = ? AND id NOT IN (
          SELECT MAX(id)
          FROM token_attributes
          WHERE token_id = ? AND network = ?
          GROUP BY attribute_name
        )
      `)
      .bind(tokenId, network, tokenId, network)
      .run();
  }

  /**
   * Get a token by ID and network, optionally filtered by bootloader
   */
  async getToken(tokenId: number, network: string, bootloader?: string): Promise<Token | null> {
    let query = `
      SELECT id, generator_id as generatorId, network, bootloader, seed, iteration,
             owner_address as ownerAddress, minted_at as mintedAt, features_json as featuresJson,
             created_at as createdAt, updated_at as updatedAt
      FROM tokens WHERE id = ? AND network = ?
    `;
    const params: (number | string)[] = [tokenId, network];

    if (bootloader) {
      query += ' AND bootloader = ?';
      params.push(bootloader);
    }

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .first<Token>();

    return result || null;
  }

  /**
   * Get a token with its attributes, optionally filtered by bootloader
   */
  async getTokenWithAttributes(tokenId: number, network: string, bootloader?: string): Promise<TokenWithAttributes | null> {
    const token = await this.getToken(tokenId, network, bootloader);
    if (!token) return null;

    const attributeResults = await this.db
      .prepare(`
        SELECT ta.attribute_name as name, ta.attribute_value as value, ta.value_type as type, ta.numeric_value as numericValue
        FROM token_attributes ta
        INNER JOIN (
          SELECT attribute_name, MAX(id) as max_id
          FROM token_attributes
          WHERE token_id = ? AND network = ?
          GROUP BY attribute_name
        ) latest ON ta.id = latest.max_id
        ORDER BY ta.attribute_name
      `)
      .bind(tokenId, network)
      .all<{ name: string; value: string; type: 'string' | 'number' | 'boolean'; numericValue: number | null }>();

    return {
      ...token,
      attributes: attributeResults.results || [],
    };
  }

  /**
   * Get attributes for a token
   */
  async getAttributes(tokenId: number, network: string): Promise<TokenAttribute[]> {
    const result = await this.db
      .prepare(`
        SELECT ta.id as id, ta.token_id as tokenId, ta.generator_id as generatorId, ta.network as network,
               ta.attribute_name as attributeName, ta.attribute_value as attributeValue,
               ta.value_type as valueType, ta.numeric_value as numericValue, ta.created_at as createdAt
        FROM token_attributes ta
        INNER JOIN (
          SELECT attribute_name, MAX(id) as max_id
          FROM token_attributes
          WHERE token_id = ? AND network = ?
          GROUP BY attribute_name
        ) latest ON ta.id = latest.max_id
        ORDER BY ta.attribute_name
      `)
      .bind(tokenId, network)
      .all<TokenAttribute>();

    return result.results || [];
  }

  /**
   * Get all unique attribute names for a generator/collection
   */
  async getAttributeNamesForGenerator(generatorId: number, network: string): Promise<string[]> {
    const result = await this.db
      .prepare(`
        SELECT DISTINCT attribute_name
        FROM token_attributes WHERE generator_id = ? AND network = ?
        ORDER BY attribute_name
      `)
      .bind(generatorId, network)
      .all<{ attribute_name: string }>();

    return (result.results || []).map(r => r.attribute_name);
  }

  async getAttributeNamesForGeneratorByBootloader(
    generatorId: number,
    network: string,
    bootloader: 'svg-js' | 'generic-web'
  ): Promise<string[]> {
    const result = await this.db
      .prepare(`
        SELECT DISTINCT ta.attribute_name
        FROM token_attributes ta
        INNER JOIN tokens t ON t.id = ta.token_id AND t.network = ta.network
        WHERE ta.generator_id = ? AND ta.network = ? AND t.bootloader = ?
        ORDER BY ta.attribute_name
      `)
      .bind(generatorId, network, bootloader)
      .all<{ attribute_name: string }>();

    return (result.results || []).map(r => r.attribute_name);
  }

  /**
   * Get all unique values for an attribute in a collection
   */
  async getAttributeValuesForGenerator(
    generatorId: number,
    network: string,
    attributeName: string
  ): Promise<Array<{ value: string; count: number }>> {
    const result = await this.db
      .prepare(`
        SELECT attribute_value as value, COUNT(DISTINCT token_id) as count
        FROM token_attributes
        WHERE generator_id = ? AND network = ? AND attribute_name = ?
        GROUP BY attribute_value
        ORDER BY count DESC, value ASC
      `)
      .bind(generatorId, network, attributeName)
      .all<{ value: string; count: number }>();

    return result.results || [];
  }

  async getAttributeValuesForGeneratorByBootloader(
    generatorId: number,
    network: string,
    attributeName: string,
    bootloader: 'svg-js' | 'generic-web'
  ): Promise<Array<{ value: string; count: number }>> {
    const result = await this.db
      .prepare(`
        SELECT ta.attribute_value as value, COUNT(DISTINCT ta.token_id) as count
        FROM token_attributes ta
        INNER JOIN tokens t ON t.id = ta.token_id AND t.network = ta.network
        WHERE ta.generator_id = ? AND ta.network = ? AND ta.attribute_name = ? AND t.bootloader = ?
        GROUP BY ta.attribute_value
        ORDER BY count DESC, value ASC
      `)
      .bind(generatorId, network, attributeName, bootloader)
      .all<{ value: string; count: number }>();

    return result.results || [];
  }

  /**
   * Search tokens by attributes
   */
  async searchByAttributes(
    generatorId: number,
    network: string,
    filters: Array<{ name: string; value: string }>,
    limit = 100,
    offset = 0,
    bootloader?: 'svg-js' | 'generic-web'
  ): Promise<{ tokens: Token[]; total: number }> {
    if (filters.length === 0) {
      // No filters, return all tokens for generator
      const bootloaderClause = bootloader ? ' AND bootloader = ?' : '';
      const countResult = await this.db
        .prepare(`SELECT COUNT(*) as total FROM tokens WHERE generator_id = ? AND network = ?${bootloaderClause}`)
        .bind(generatorId, network, ...(bootloader ? [bootloader] : []))
        .first<{ total: number }>();

      const tokensResult = await this.db
        .prepare(`
          SELECT id, generator_id as generatorId, network, bootloader, seed, iteration,
                 owner_address as ownerAddress, minted_at as mintedAt, features_json as featuresJson,
                 created_at as createdAt, updated_at as updatedAt
          FROM tokens WHERE generator_id = ? AND network = ?${bootloaderClause}
          ORDER BY id DESC
          LIMIT ? OFFSET ?
        `)
        .bind(generatorId, network, ...(bootloader ? [bootloader] : []), limit, offset)
        .all<Token>();

      return {
        tokens: tokensResult.results || [],
        total: countResult?.total || 0,
      };
    }

    // Build query with attribute filters using INTERSECT
    // Each filter narrows down the set of matching token IDs
    const filterClauses = filters.map(() => {
      if (bootloader) {
        return `
          SELECT ta.token_id
          FROM token_attributes ta
          INNER JOIN tokens t ON t.id = ta.token_id AND t.network = ta.network
          WHERE ta.generator_id = ? AND ta.network = ? AND ta.attribute_name = ? AND ta.attribute_value = ? AND t.bootloader = ?
        `;
      }
      return `
        SELECT token_id FROM token_attributes
        WHERE generator_id = ? AND network = ? AND attribute_name = ? AND attribute_value = ?
      `;
    });

    const bindValues: (string | number)[] = [];
    for (const filter of filters) {
      bindValues.push(generatorId, network, filter.name, filter.value);
      if (bootloader) {
        bindValues.push(bootloader);
      }
    }

    const intersectQuery = filterClauses.join(' INTERSECT ');

    // Count matching tokens
    const countQuery = `SELECT COUNT(*) as total FROM (${intersectQuery})`;
    const countResult = await this.db
      .prepare(countQuery)
      .bind(...bindValues)
      .first<{ total: number }>();

    // Get matching tokens
    const tokensQuery = `
      SELECT t.id, t.generator_id as generatorId, t.network, t.bootloader, t.seed, t.iteration,
             t.owner_address as ownerAddress, t.minted_at as mintedAt, t.features_json as featuresJson,
             t.created_at as createdAt, t.updated_at as updatedAt
      FROM tokens t
      WHERE t.id IN (${intersectQuery}) AND t.network = ?${bootloader ? ' AND t.bootloader = ?' : ''}
      ORDER BY t.id DESC
      LIMIT ? OFFSET ?
    `;

    const tokensResult = await this.db
      .prepare(tokensQuery)
      .bind(...bindValues, network, ...(bootloader ? [bootloader] : []), limit, offset)
      .all<Token>();

    return {
      tokens: tokensResult.results || [],
      total: countResult?.total || 0,
    };
  }

  /**
   * Check if features exist for a token
   */
  async hasFeatures(tokenId: number, network: string): Promise<boolean> {
    const result = await this.db
      .prepare('SELECT 1 FROM token_attributes WHERE token_id = ? AND network = ? LIMIT 1')
      .bind(tokenId, network)
      .first();

    return result !== null;
  }
}

/**
 * Normalize an attribute value for storage
 */
function normalizeAttributeValue(value: unknown): {
  valueType: 'string' | 'number' | 'boolean';
  stringValue: string;
  numericValue: number | null;
} {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return {
      valueType: 'number',
      stringValue: String(value),
      numericValue: value,
    };
  }

  if (typeof value === 'boolean') {
    return {
      valueType: 'boolean',
      stringValue: String(value),
      numericValue: value ? 1 : 0,
    };
  }

  // Default to string
  const stringValue = value === null || value === undefined
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

  return {
    valueType: 'string',
    stringValue,
    numericValue: null,
  };
}
