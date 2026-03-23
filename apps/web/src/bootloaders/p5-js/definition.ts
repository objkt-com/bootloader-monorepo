import { CONFIG } from "@/config";
import { P5JsCreator, P5JsViewer } from "@/bootloaders/p5-js";
import { P5JsEditPage } from "@/bootloaders/p5-js/edit-page";
import { P5JsGeneratorDetailView } from "@/bootloaders/p5-js/generator-detail-view";
import { P5JsTokenDetailView } from "@/bootloaders/p5-js/token-detail-view";
import {
  deleteP5JsGenerator,
  mintP5Js,
  regenerateP5Js,
  setP5JsSale,
  updateP5JsGenerator,
} from "@/services/tezos";
import { SHARED_BOOTLOADER_CATALOG } from "../../../../../shared/bootloaders/catalog";
import { triggerGenericWebTokenIndexer } from "@/bootloaders/generic-web/workflow";
import type { BootloaderDefinition } from "@/bootloaders/definition-types";

async function triggerP5JsMintRefresh(
  refetchTokens?: () => void | Promise<void>
): Promise<void> {
  if (!refetchTokens) return;
  window.setTimeout(() => {
    void refetchTokens();
  }, 2500);
  window.setTimeout(() => {
    void refetchTokens();
  }, 7000);
}

export const p5JsBootloaderDefinition: BootloaderDefinition = {
  id: "p5-js",
  currentVersion: SHARED_BOOTLOADER_CATALOG["p5-js"].currentVersion,
  spec: SHARED_BOOTLOADER_CATALOG["p5-js"].spec,
  name: "p5.js",
  description: "Code-first p5.js sketches packaged into signed IPFS artifacts",
  longDescription: `The p5.js bootloader gives you a live coding workspace for seeded
p5 sketches, then packages the sketch into a boot:web artifact using a fixed
template at publish time. The final artifact is signed before it is registered
with the shared core contract.`,
  constraints: {},
  features: {
    hasCodeEditor: true,
    hasParameterSupport: false,
    hasZipUpload: false,
    hasHardwareSupport: false,
    previewType: "iframe",
    storageType: "ipfs",
  },
  ViewerComponent: P5JsViewer,
  CreatorComponent: P5JsCreator,
  GeneratorDetailViewComponent: P5JsGeneratorDetailView,
  TokenDetailViewComponent: P5JsTokenDetailView,
  EditPageComponent: P5JsEditPage,
  editMode: "route",
  getEditHref: (generatorId) => `/generator/p5-js/${generatorId}/edit`,
  supportsPendingCreateNavigation: true,
  supportsIndexedFeatures:
    SHARED_BOOTLOADER_CATALOG["p5-js"].supportsIndexedFeatures,
  supportsGeneratorMetadata:
    SHARED_BOOTLOADER_CATALOG["p5-js"].supportsGeneratorMetadata,
  operations: {
    mint: ({ tezos, generatorId, price }) => mintP5Js(tezos, generatorId, price),
    setSale: ({ tezos, generatorId, price, editions, paused, startTime }) =>
      setP5JsSale(tezos, generatorId, price, editions, paused, startTime),
    deleteGenerator: ({ tezos, generatorId }) =>
      deleteP5JsGenerator(tezos, generatorId),
    updateGenerator: ({ tezos, generatorId, name, codeOrCid }) =>
      updateP5JsGenerator(tezos, generatorId, name, codeOrCid),
    regenerateToken: ({ tezos, tokenId }) => regenerateP5Js(tezos, tokenId),
    afterMint: async ({ tokenId, authToken, refetchTokens }) => {
      if (!tokenId || !authToken) return;
      try {
        await triggerGenericWebTokenIndexer(tokenId, authToken, {
          bootloaderId: "p5-js",
        });
      } catch (error) {
        console.warn("[mint] failed to trigger p5-js indexer", error);
      }
      await triggerP5JsMintRefresh(refetchTokens);
    },
    afterRegenerate: async ({ tokenId, authToken }) => {
      if (!authToken) return;
      try {
        await triggerGenericWebTokenIndexer(tokenId, authToken, {
          bootloaderId: "p5-js",
          waitForCompletion: true,
        });
      } catch (error) {
        console.warn("[regenerate] failed to trigger p5-js indexer", error);
      }
    },
  },
  status: CONFIG.network === "shadownet" ? "active" : "coming-soon",
};
