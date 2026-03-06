export class TzktClient {
  constructor(public readonly baseUrl: string) {}

  async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  }

  async getBigMapByPath(
    path: string,
    contractAddress: string
  ): Promise<{ ptr: number } | null> {
    const url = `${this.baseUrl}/v1/bigmaps?contract=${contractAddress}&path=${path}&active=true`
    const bigmaps = await this.fetchJson<Array<{ ptr: number }>>(url)
    return bigmaps.length > 0 ? bigmaps[0] : null
  }

  async getBigMapKeys<T>(
    bigmapId: number,
    options: {
      limit?: number
      offset?: number
      sortDesc?: string
      sortAsc?: string
      select?: string
    } = {}
  ): Promise<Array<{ key: string; value: T; firstLevel?: number; lastLevel?: number }>> {
    const params = new URLSearchParams()
    params.append('active', 'true')
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.offset) params.append('offset', options.offset.toString())
    if (options.sortDesc) params.append('sort.desc', options.sortDesc)
    if (options.sortAsc) params.append('sort.asc', options.sortAsc)
    if (options.select) params.append('select', options.select)

    const url = `${this.baseUrl}/v1/bigmaps/${bigmapId}/keys?${params.toString()}`
    return this.fetchJson(url)
  }

  async getBigMapKey<T>(
    bigmapId: number,
    key: string
  ): Promise<{ key: string; value: T } | null> {
    const url = `${this.baseUrl}/v1/bigmaps/${bigmapId}/keys/${encodeURIComponent(key)}`
    try {
      return await this.fetchJson(url)
    } catch {
      return null
    }
  }
}
