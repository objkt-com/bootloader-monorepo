import type { TezosToolkit } from "@taquito/taquito";
import {
  createWebProjectContractApi,
} from "@/bootloaders/web-project-tezos";
import type {
  CreateGeneratorResult,
  DeleteGeneratorResult,
  MintResult,
  RegenerateTokenResult,
  SetSaleResult,
  UpdateGeneratorResult,
} from "@/services/tezos-shared";

const genericWebContractApi = createWebProjectContractApi("generic-web");

export function createGenericWebGeneratorContract(
  tezos: TezosToolkit,
  name: string,
  artifactCid: string,
  metadataCid = "",
  authToken?: string,
  reservedEditions = 0,
  allowBlMetadataUpdate = true
): Promise<CreateGeneratorResult> {
  if (!authToken) {
    return Promise.resolve({
      success: false,
      error: "Authentication required to sign artifact",
    });
  }
  return genericWebContractApi.createGenerator(
    tezos,
    authToken,
    name,
    artifactCid,
    metadataCid,
    reservedEditions,
    allowBlMetadataUpdate
  );
}

export function updateGenericWebGeneratorContract(
  tezos: TezosToolkit,
  generatorId: string | number,
  name: string,
  artifactCid: string,
  metadataCid = "",
  authToken?: string,
  reservedEditions = 0,
  allowBlMetadataUpdate = true
): Promise<UpdateGeneratorResult> {
  if (!authToken) {
    return Promise.resolve({
      success: false,
      error: "Authentication required to sign artifact",
    });
  }
  return genericWebContractApi.updateGenerator(
    tezos,
    authToken,
    generatorId,
    name,
    artifactCid,
    metadataCid,
    reservedEditions,
    allowBlMetadataUpdate
  );
}

export function setGenericWebGeneratorSale(
  tezos: TezosToolkit,
  generatorId: string | number,
  price: number,
  editions: number,
  paused = false,
  startTime: string | null = null,
  maxPerWallet: number | null = null
): Promise<SetSaleResult> {
  return genericWebContractApi.setSale(
    tezos,
    generatorId,
    price,
    editions,
    paused,
    startTime,
    maxPerWallet
  );
}

export function mintGenericWebToken(
  tezos: TezosToolkit,
  generatorId: string | number,
  price: number,
  params = ""
): Promise<MintResult> {
  return genericWebContractApi.mint(tezos, generatorId, price, params);
}

export function deleteGenericWebGeneratorContract(
  tezos: TezosToolkit,
  generatorId: string | number
): Promise<DeleteGeneratorResult> {
  return genericWebContractApi.deleteGenerator(tezos, generatorId);
}

export function regenerateGenericWebGeneratorToken(
  tezos: TezosToolkit,
  tokenId: string | number
): Promise<RegenerateTokenResult> {
  return genericWebContractApi.regenerateToken(tezos, tokenId);
}
