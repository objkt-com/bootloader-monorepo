import { NetworkConfig, BigMapKeyResponse } from './types';

export class TzKTClient {
  constructor(private config: NetworkConfig) {}

  async getBigMapKey(bigmapId: number, key: string): Promise<any> {
    const url = `${this.config.tzktBaseUrl}/bigmaps/${bigmapId}/keys/${key}`;
    const response = await fetch(url);

    // TzKT returns 204 when key is not found
    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`TzKT API error: ${response.status} ${response.statusText}`);
    }

    const data: BigMapKeyResponse = await response.json();
    return data.value;
  }

  async getBigMapKeys(bigmapId: number, keys: string[]): Promise<BigMapKeyResponse[]> {
    if (keys.length === 0) {
      return [];
    }

    if (keys.length === 1) {
      const value = await this.getBigMapKey(bigmapId, keys[0]);
      if (value === null) {
        return [];
      }
      return [{ key: keys[0], value }];
    }

    const url = `${this.config.tzktBaseUrl}/bigmaps/${bigmapId}/keys?key.in=${keys.join(',')}`;
    const response = await fetch(url);

    if (response.status === 204) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`TzKT API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}
