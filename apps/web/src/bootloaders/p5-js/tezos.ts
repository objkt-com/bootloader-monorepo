import type { TezosToolkit } from "@taquito/taquito";
import { createWebProjectContractApi } from "@/bootloaders/web-project-tezos";
import type {
  CreateGeneratorResult,
  DeleteGeneratorResult,
  MintResult,
  RegenerateTokenResult,
  SetSaleResult,
  UpdateGeneratorResult,
} from "@/services/tezos-shared";

const p5JsContractApi = createWebProjectContractApi("p5-js");

export function createP5JsGeneratorContract(
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
  return p5JsContractApi.createGenerator(
    tezos,
    authToken,
    name,
    artifactCid,
    metadataCid,
    reservedEditions,
    allowBlMetadataUpdate
  );
}

export function updateP5JsGeneratorContract(
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
  return p5JsContractApi.updateGenerator(
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

export function setP5JsSale(
  tezos: TezosToolkit,
  generatorId: string | number,
  price: number,
  editions: number,
  paused = false,
  startTime: string | null = null,
  maxPerWallet: number | null = null
): Promise<SetSaleResult> {
  return p5JsContractApi.setSale(
    tezos,
    generatorId,
    price,
    editions,
    paused,
    startTime,
    maxPerWallet
  );
}

export function mintP5JsToken(
  tezos: TezosToolkit,
  generatorId: string | number,
  price: number,
  params = ""
): Promise<MintResult> {
  return p5JsContractApi.mint(tezos, generatorId, price, params);
}

export function deleteP5JsGeneratorContract(
  tezos: TezosToolkit,
  generatorId: string | number
): Promise<DeleteGeneratorResult> {
  return p5JsContractApi.deleteGenerator(tezos, generatorId);
}

export function regenerateP5JsToken(
  tezos: TezosToolkit,
  tokenId: string | number
): Promise<RegenerateTokenResult> {
  return p5JsContractApi.regenerateToken(tezos, tokenId);
}
