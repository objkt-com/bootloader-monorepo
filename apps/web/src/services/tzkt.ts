import { getNetworkConfig, getContractAddress, getGenericWebContractAddress } from '@/config'
import type { Generator, Token } from '@/types/generator'
import type { BootloaderId } from '@/types/bootloader'
import { TzktClient } from '@/services/tzkt-client'
import {
  getSvgJsGenerator,
  getSvgJsGeneratorMints,
  getSvgJsGenerators,
  getSvgJsFragments,
  getSvgJsToken,
} from '@/bootloaders/svg-js/tzkt'
import {
  getGenericWebGenerator,
  getGenericWebGeneratorMints,
  getGenericWebGenerators,
  getGenericWebToken,
} from '@/bootloaders/generic-web/tzkt'

class TzKTService {
  private client: TzktClient
  private svgJsContractAddress: string
  private genericWebContractAddress: string

  constructor() {
    const config = getNetworkConfig()
    this.client = new TzktClient(config.tzktApi)
    this.svgJsContractAddress = getContractAddress()
    this.genericWebContractAddress = getGenericWebContractAddress()
  }

  async getGenerators(): Promise<Generator[]> {
    return getSvgJsGenerators(this.client, this.svgJsContractAddress)
  }

  async getGenericWebGenerators(): Promise<Generator[]> {
    if (!this.genericWebContractAddress) {
      return []
    }
    return getGenericWebGenerators(this.client, this.genericWebContractAddress)
  }

  async getAllGenerators(): Promise<Generator[]> {
    const [svgJsGenerators, genericWebGenerators] = await Promise.all([
      this.getGenerators(),
      this.getGenericWebGenerators(),
    ])

    const allGenerators = [...svgJsGenerators, ...genericWebGenerators]
    allGenerators.sort((a, b) => (b.firstLevel ?? 0) - (a.firstLevel ?? 0))
    return allGenerators
  }

  async getGeneratorByBootloader(
    generatorId: string,
    bootloaderId?: BootloaderId
  ): Promise<Generator | null> {
    if (bootloaderId === 'generic-web') {
      return this.getGenericWebGenerator(generatorId)
    }
    if (bootloaderId === 'svg-js') {
      return this.getGenerator(generatorId)
    }

    const svgGenerator = await this.getGenerator(generatorId)
    if (svgGenerator) {
      return svgGenerator
    }

    return this.getGenericWebGenerator(generatorId)
  }

  async getGenerator(generatorId: string): Promise<Generator | null> {
    return getSvgJsGenerator(this.client, this.svgJsContractAddress, generatorId)
  }

  async getGenericWebGenerator(generatorId: string): Promise<Generator | null> {
    if (!this.genericWebContractAddress) {
      return null
    }
    return getGenericWebGenerator(this.client, this.genericWebContractAddress, generatorId)
  }

  async getGeneratorMints(
    generatorId: string,
    bootloaderId: BootloaderId,
    limit = 10,
    generator?: Generator
  ): Promise<Token[]> {
    if (bootloaderId === 'generic-web') {
      return this.getGenericWebGeneratorMints(generatorId, limit, generator)
    }
    return getSvgJsGeneratorMints(
      this.client,
      this.svgJsContractAddress,
      generatorId,
      limit,
      generator
    )
  }

  async getGeneratorTokens(
    generatorId: string,
    bootloaderId: BootloaderId,
    limit = 10,
    generator?: Generator
  ): Promise<Token[]> {
    return this.getGeneratorMints(generatorId, bootloaderId, limit, generator)
  }

  async getGenericWebGeneratorMints(
    generatorId: string,
    limit = 10,
    generator?: Generator
  ): Promise<Token[]> {
    if (!this.genericWebContractAddress) {
      return []
    }
    return getGenericWebGeneratorMints(
      this.client,
      this.genericWebContractAddress,
      generatorId,
      limit,
      generator
    )
  }

  async getToken(tokenId: string, bootloaderId?: BootloaderId): Promise<Token | null> {
    if (bootloaderId === 'generic-web') {
      return this.getGenericWebToken(tokenId)
    }
    if (bootloaderId === 'svg-js') {
      return this.getSvgJsToken(tokenId)
    }

    const svgToken = await this.getSvgJsToken(tokenId)
    if (svgToken) {
      return svgToken
    }

    return this.getGenericWebToken(tokenId)
  }

  async getSvgJsToken(tokenId: string): Promise<Token | null> {
    return getSvgJsToken(this.client, this.svgJsContractAddress, tokenId)
  }

  async getGenericWebToken(tokenId: string): Promise<Token | null> {
    if (!this.genericWebContractAddress) {
      return null
    }
    return getGenericWebToken(this.client, this.genericWebContractAddress, tokenId)
  }

  async getFragments(): Promise<string[]> {
    return getSvgJsFragments(this.client, this.svgJsContractAddress)
  }
}

export const tzktService = new TzKTService()
