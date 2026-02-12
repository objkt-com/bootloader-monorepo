/**
 * Generator service for D1 database operations
 * Stores and retrieves generator metadata including descriptions
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface Generator {
  id: number;
  network: 'mainnet' | 'ghostnet';
  bootloader: 'svg-js' | 'generic-web';
  name: string | null;
  artifactCid: string | null;
  metadataCid: string | null;
  generatorDescription: string | null;
  tokenDescription: string | null;
  creatorAddress: string | null;
  thumbnailSeed: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreGeneratorParams {
  id: number;
  network: 'mainnet' | 'ghostnet';
  bootloader: 'svg-js' | 'generic-web';
  name?: string;
  artifactCid?: string;
  metadataCid?: string;
  generatorDescription?: string;
  tokenDescription?: string;
  creatorAddress?: string;
  thumbnailSeed?: string;
}

export interface UpdateGeneratorParams {
  name?: string;
  artifactCid?: string;
  metadataCid?: string;
  generatorDescription?: string;
  tokenDescription?: string;
  thumbnailSeed?: string;
}

export class GeneratorService {
  constructor(private db: D1Database) {}

  /**
   * Store or update a generator in the database
   */
  async storeGenerator(params: StoreGeneratorParams): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO generators (
          id, network, bootloader, name, artifact_cid, metadata_cid,
          generator_description, token_description, creator_address, thumbnail_seed,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id, network, bootloader) DO UPDATE SET
          name = COALESCE(excluded.name, generators.name),
          artifact_cid = COALESCE(excluded.artifact_cid, generators.artifact_cid),
          metadata_cid = COALESCE(excluded.metadata_cid, generators.metadata_cid),
          generator_description = COALESCE(excluded.generator_description, generators.generator_description),
          token_description = COALESCE(excluded.token_description, generators.token_description),
          creator_address = COALESCE(excluded.creator_address, generators.creator_address),
          thumbnail_seed = COALESCE(excluded.thumbnail_seed, generators.thumbnail_seed),
          updated_at = excluded.updated_at`
      )
      .bind(
        params.id,
        params.network,
        params.bootloader,
        params.name ?? null,
        params.artifactCid ?? null,
        params.metadataCid ?? null,
        params.generatorDescription ?? null,
        params.tokenDescription ?? null,
        params.creatorAddress ?? null,
        params.thumbnailSeed ?? null,
        now,
        now
      )
      .run();
  }

  /**
   * Get a generator by ID, network, and bootloader
   */
  async getGenerator(
    id: number,
    network: 'mainnet' | 'ghostnet',
    bootloader: 'svg-js' | 'generic-web'
  ): Promise<Generator | null> {
    const result = await this.db
      .prepare(
        `SELECT id, network, bootloader, name, artifact_cid, metadata_cid,
                generator_description, token_description, creator_address, thumbnail_seed,
                created_at, updated_at
         FROM generators
         WHERE id = ? AND network = ? AND bootloader = ?`
      )
      .bind(id, network, bootloader)
      .first<{
        id: number;
        network: string;
        bootloader: string;
        name: string | null;
        artifact_cid: string | null;
        metadata_cid: string | null;
        generator_description: string | null;
        token_description: string | null;
        creator_address: string | null;
        thumbnail_seed: string | null;
        created_at: string;
        updated_at: string;
      }>();

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      network: result.network as 'mainnet' | 'ghostnet',
      bootloader: result.bootloader as 'svg-js' | 'generic-web',
      name: result.name,
      artifactCid: result.artifact_cid,
      metadataCid: result.metadata_cid,
      generatorDescription: result.generator_description,
      tokenDescription: result.token_description,
      creatorAddress: result.creator_address,
      thumbnailSeed: result.thumbnail_seed,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  /**
   * Update a generator's metadata
   */
  async updateGenerator(
    id: number,
    network: 'mainnet' | 'ghostnet',
    bootloader: 'svg-js' | 'generic-web',
    params: UpdateGeneratorParams
  ): Promise<void> {
    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (params.name !== undefined) {
      updates.push('name = ?');
      values.push(params.name);
    }
    if (params.artifactCid !== undefined) {
      updates.push('artifact_cid = ?');
      values.push(params.artifactCid);
    }
    if (params.metadataCid !== undefined) {
      updates.push('metadata_cid = ?');
      values.push(params.metadataCid);
    }
    if (params.generatorDescription !== undefined) {
      updates.push('generator_description = ?');
      values.push(params.generatorDescription);
    }
    if (params.tokenDescription !== undefined) {
      updates.push('token_description = ?');
      values.push(params.tokenDescription);
    }
    if (params.thumbnailSeed !== undefined) {
      updates.push('thumbnail_seed = ?');
      values.push(params.thumbnailSeed);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(String(id), network, bootloader);

    await this.db
      .prepare(
        `UPDATE generators SET ${updates.join(', ')}
         WHERE id = ? AND network = ? AND bootloader = ?`
      )
      .bind(...values)
      .run();
  }

  /**
   * Get all generators for a creator
   */
  async getGeneratorsByCreator(
    creatorAddress: string,
    network: 'mainnet' | 'ghostnet'
  ): Promise<Generator[]> {
    const result = await this.db
      .prepare(
        `SELECT id, network, bootloader, name, artifact_cid, metadata_cid,
                generator_description, token_description, creator_address, thumbnail_seed,
                created_at, updated_at
         FROM generators
         WHERE creator_address = ? AND network = ?
         ORDER BY created_at DESC`
      )
      .bind(creatorAddress, network)
      .all<{
        id: number;
        network: string;
        bootloader: string;
        name: string | null;
        artifact_cid: string | null;
        metadata_cid: string | null;
        generator_description: string | null;
        token_description: string | null;
        creator_address: string | null;
        thumbnail_seed: string | null;
        created_at: string;
        updated_at: string;
      }>();

    return (result.results || []).map((row) => ({
      id: row.id,
      network: row.network as 'mainnet' | 'ghostnet',
      bootloader: row.bootloader as 'svg-js' | 'generic-web',
      name: row.name,
      artifactCid: row.artifact_cid,
      metadataCid: row.metadata_cid,
      generatorDescription: row.generator_description,
      tokenDescription: row.token_description,
      creatorAddress: row.creator_address,
      thumbnailSeed: row.thumbnail_seed,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}
