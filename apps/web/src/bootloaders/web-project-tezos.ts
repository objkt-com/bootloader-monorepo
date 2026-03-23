import type { TezosToolkit } from "@taquito/taquito";
import {
  CONFIG,
  getRngContractAddressForBootloader,
} from "@/config";
import {
  CreateGeneratorResult,
  DeleteGeneratorResult,
  generateEntropy,
  loadBootloaderContract,
  MintResult,
  RegenerateTokenResult,
  SetSaleResult,
  stringToBytes,
  UpdateGeneratorResult,
} from "@/services/tezos-shared";
import type { BootloaderId } from "@/types/bootloader";
import { SHARED_BOOTLOADER_CATALOG } from "../../../../shared/bootloaders/catalog";

function normalizeIpfsUri(value: string): string {
  return value.startsWith("ipfs://") ? value : `ipfs://${value}`;
}

async function requestArtifactSignature(params: {
  authToken: string;
  bootloaderId: BootloaderId;
  artifactUri: string;
  author: string;
}): Promise<string | null> {
  const response = await fetch(
    `${CONFIG.sandboxWorkerUrl}/${params.bootloaderId}/v1/artifacts/sign?network=${CONFIG.network}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.authToken}`,
      },
      body: JSON.stringify({
        artifactUri: params.artifactUri,
        author: params.author,
      }),
    }
  );

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    let message = `Artifact signing request failed (${response.status})`;

    if (contentType.toLowerCase().includes("application/json")) {
      const body = (await response
        .json()
        .catch(() => ({ error: null }))) as { error?: string | null };
      if (body.error?.trim()) {
        message = body.error.trim();
      }
    } else {
      const bodyText = await response.text().catch(() => "");
      if (bodyText.trim()) {
        message = bodyText.trim();
      }
    }

    if (response.status === 404) {
      message +=
        " The worker route is missing; redeploy the updated worker before publishing.";
    } else if (
      response.status === 503 &&
      /artifact signer is not configured/i.test(message)
    ) {
      message +=
        " Set ARTIFACT_SIGNER_PRIVATE_KEY in the worker environment and redeploy it.";
    } else if (response.status === 401 || response.status === 403) {
      message += " Your auth token is missing or expired; sign in again.";
    }

    throw new Error(message);
  }

  const data = (await response.json()) as { signature?: string | null };
  return data.signature || null;
}

async function createWebProjectGeneratorContract(
  tezos: TezosToolkit,
  bootloaderId: BootloaderId,
  authToken: string,
  name: string,
  artifactCid: string,
  metadataCid = "",
  reservedEditions = 0,
  allowBlMetadataUpdate = true
): Promise<CreateGeneratorResult> {
  try {
    const contract = await loadBootloaderContract(tezos, bootloaderId);
    const rngContract = getRngContractAddressForBootloader(bootloaderId);
    if (!rngContract) {
      throw new Error("RNG contract not configured for this network");
    }

    const author = await tezos.wallet.pkh();
    const artifactUri = normalizeIpfsUri(artifactCid);
    const metadataUri = metadataCid ? normalizeIpfsUri(metadataCid) : "";
    const artifactSignature = await requestArtifactSignature({
      authToken,
      bootloaderId,
      artifactUri,
      author,
    });

    const operation = await contract.methodsObject
      .create_generator({
        name: stringToBytes(name),
        bootloader_spec_id: stringToBytes(
          SHARED_BOOTLOADER_CATALOG[bootloaderId].spec
        ),
        artifact_uri: stringToBytes(artifactUri),
        metadata_cid: stringToBytes(metadataUri),
        rng_contract: rngContract,
        reserved_editions: reservedEditions,
        allow_bl_metadata_update: allowBlMetadataUpdate,
        artifact_signature: artifactSignature,
      })
      .send();

    await operation.confirmation();
    const operationResults = await operation.operationResults();

    let generatorId: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = operationResults?.[0] as any;
      const diffs = result?.metadata?.operation_result?.lazy_storage_diff || [];
      for (const diff of diffs) {
        if (diff?.diff?.updates?.[0]?.key?.int) {
          generatorId = diff.diff.updates[0].key.int;
          break;
        }
      }
    } catch {
      console.warn("Could not extract generator ID from operation results");
    }

    return { success: true, hash: operation.opHash, generatorId };
  } catch (error) {
    console.error(`Failed to create ${bootloaderId} generator:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function updateWebProjectGeneratorContract(
  tezos: TezosToolkit,
  bootloaderId: BootloaderId,
  authToken: string,
  generatorId: string | number,
  name: string,
  artifactCid: string,
  metadataCid = "",
  reservedEditions = 0,
  allowBlMetadataUpdate = true
): Promise<UpdateGeneratorResult> {
  try {
    const contract = await loadBootloaderContract(tezos, bootloaderId);
    const rngContract = getRngContractAddressForBootloader(bootloaderId);
    if (!rngContract) {
      throw new Error("RNG contract not configured for this network");
    }

    const author = await tezos.wallet.pkh();
    const artifactUri = normalizeIpfsUri(artifactCid);
    const metadataUri = metadataCid ? normalizeIpfsUri(metadataCid) : "";
    const artifactSignature = await requestArtifactSignature({
      authToken,
      bootloaderId,
      artifactUri,
      author,
    });

    const operation = await contract.methodsObject
      .update_generator({
        generator_id: Number(generatorId),
        name: stringToBytes(name),
        bootloader_spec_id: stringToBytes(
          SHARED_BOOTLOADER_CATALOG[bootloaderId].spec
        ),
        artifact_uri: stringToBytes(artifactUri),
        metadata_cid: stringToBytes(metadataUri),
        rng_contract: rngContract,
        reserved_editions: reservedEditions,
        allow_bl_metadata_update: allowBlMetadataUpdate,
        artifact_signature: artifactSignature,
      })
      .send();

    await operation.confirmation();
    return { success: true, hash: operation.opHash };
  } catch (error) {
    console.error(`Failed to update ${bootloaderId} generator:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function setWebProjectGeneratorSale(
  tezos: TezosToolkit,
  bootloaderId: BootloaderId,
  generatorId: string | number,
  price: number,
  editions: number,
  paused = false,
  startTime: string | null = null,
  maxPerWallet: number | null = null
): Promise<SetSaleResult> {
  try {
    const contract = await loadBootloaderContract(tezos, bootloaderId);
    const operation = await contract.methodsObject
      .set_sale({
        generator_id: Number(generatorId),
        start_time: startTime,
        price,
        paused,
        editions,
        max_per_wallet: maxPerWallet,
      })
      .send();

    await operation.confirmation();
    return { success: true, hash: operation.opHash };
  } catch (error) {
    console.error(`Failed to set ${bootloaderId} sale:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function mintWebProjectToken(
  tezos: TezosToolkit,
  bootloaderId: BootloaderId,
  generatorId: string | number,
  price: number,
  params = ""
): Promise<MintResult> {
  try {
    const contract = await loadBootloaderContract(tezos, bootloaderId);
    const entropy = generateEntropy();

    const operation = await contract.methodsObject
      .mint({
        generator_id: Number(generatorId),
        entropy,
        params: stringToBytes(params),
      })
      .send({ amount: price, mutez: true });

    await operation.confirmation();
    const operationResults = await operation.operationResults();

    let tokenId: string | undefined;
    let seed: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = operationResults?.[0] as any;
      const diffs = result?.metadata?.operation_result?.lazy_storage_diff || [];
      for (const diff of diffs) {
        if (diff?.diff?.updates?.[0]?.key?.int) {
          tokenId = diff.diff.updates[0].key.int;
          break;
        }
      }

      for (const diff of diffs) {
        const rawSeed = diff?.diff?.updates?.[0]?.value?.raw_seed;
        if (rawSeed) {
          seed = rawSeed.startsWith("0x") ? rawSeed.slice(2) : rawSeed;
          break;
        }
      }
    } catch {
      console.warn("Could not extract token ID or seed from operation results");
    }

    return {
      success: true,
      hash: operation.opHash,
      tokenId,
      entropy,
      seed,
    };
  } catch (error) {
    console.error(`Failed to mint ${bootloaderId} token:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function deleteWebProjectGeneratorContract(
  tezos: TezosToolkit,
  bootloaderId: BootloaderId,
  generatorId: string | number
): Promise<DeleteGeneratorResult> {
  try {
    const contract = await loadBootloaderContract(tezos, bootloaderId);
    const operation = await contract.methodsObject
      .delete_generator(Number(generatorId))
      .send();

    await operation.confirmation();
    return { success: true, hash: operation.opHash };
  } catch (error) {
    console.error(`Failed to delete ${bootloaderId} generator:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function regenerateWebProjectToken(
  tezos: TezosToolkit,
  bootloaderId: BootloaderId,
  tokenId: string | number
): Promise<RegenerateTokenResult> {
  try {
    const contract = await loadBootloaderContract(tezos, bootloaderId);
    const operation = await contract.methodsObject
      .regenerate_token(Number(tokenId))
      .send();

    await operation.confirmation();
    return { success: true, hash: operation.opHash };
  } catch (error) {
    console.error(`Failed to regenerate ${bootloaderId} token:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function createWebProjectContractApi(bootloaderId: BootloaderId) {
  return {
    createGenerator: (
      tezos: TezosToolkit,
      authToken: string,
      name: string,
      artifactCid: string,
      metadataCid = "",
      reservedEditions = 0,
      allowBlMetadataUpdate = true
    ) =>
      createWebProjectGeneratorContract(
        tezos,
        bootloaderId,
        authToken,
        name,
        artifactCid,
        metadataCid,
        reservedEditions,
        allowBlMetadataUpdate
      ),
    updateGenerator: (
      tezos: TezosToolkit,
      authToken: string,
      generatorId: string | number,
      name: string,
      artifactCid: string,
      metadataCid = "",
      reservedEditions = 0,
      allowBlMetadataUpdate = true
    ) =>
      updateWebProjectGeneratorContract(
        tezos,
        bootloaderId,
        authToken,
        generatorId,
        name,
        artifactCid,
        metadataCid,
        reservedEditions,
        allowBlMetadataUpdate
      ),
    setSale: (
      tezos: TezosToolkit,
      generatorId: string | number,
      price: number,
      editions: number,
      paused = false,
      startTime: string | null = null,
      maxPerWallet: number | null = null
    ) =>
      setWebProjectGeneratorSale(
        tezos,
        bootloaderId,
        generatorId,
        price,
        editions,
        paused,
        startTime,
        maxPerWallet
      ),
    mint: (
      tezos: TezosToolkit,
      generatorId: string | number,
      price: number,
      params = ""
    ) => mintWebProjectToken(tezos, bootloaderId, generatorId, price, params),
    deleteGenerator: (tezos: TezosToolkit, generatorId: string | number) =>
      deleteWebProjectGeneratorContract(tezos, bootloaderId, generatorId),
    regenerateToken: (tezos: TezosToolkit, tokenId: string | number) =>
      regenerateWebProjectToken(tezos, bootloaderId, tokenId),
  };
}
