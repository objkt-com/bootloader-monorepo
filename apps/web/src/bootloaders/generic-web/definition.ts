import { CONFIG } from "@/config";
import { GenericWebViewer, GenericWebCreator } from "@/bootloaders/generic-web";
import { GenericWebGeneratorDetailView } from "@/bootloaders/generic-web/generator-detail-view";
import { GenericWebTokenDetailView } from "@/bootloaders/generic-web/token-detail-view";
import { GeneratorEditPage as GenericWebGeneratorEditPage } from "@/bootloaders/generic-web/edit-page";
import {
  deleteGenericWebGenerator,
  mintGenericWeb,
  regenerateGenericWebToken,
  setGenericWebSale,
  updateGenericWebGenerator,
} from "@/services/tezos";
import { SHARED_BOOTLOADER_CATALOG } from "../../../../../shared/bootloaders/catalog";
import { triggerGenericWebTokenIndexer } from "@/bootloaders/generic-web/workflow";
import type { BootloaderDefinition } from "@/bootloaders/definition-types";

async function triggerGenericWebMintRefresh(
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

export const genericWebBootloaderDefinition: BootloaderDefinition = {
  id: "generic-web",
  currentVersion: SHARED_BOOTLOADER_CATALOG["generic-web"].currentVersion,
  spec: SHARED_BOOTLOADER_CATALOG["generic-web"].spec,
  name: "Generic Web",
  description: "HTML/CSS/JS projects packaged as zip uploads",
  longDescription: `The Generic Web bootloader runs any web-based generative art project.
Upload a zip file containing your HTML, CSS, and JavaScript files along with a manifest.json
that defines entry and capture settings. Supports p5.js, three.js, canvas, and any
web technology.`,
  constraints: {},
  features: {
    hasCodeEditor: false,
    hasParameterSupport: false,
    hasZipUpload: true,
    hasHardwareSupport: false,
    previewType: "iframe",
    storageType: "ipfs",
  },
  ViewerComponent: GenericWebViewer,
  CreatorComponent: GenericWebCreator,
  GeneratorDetailViewComponent: GenericWebGeneratorDetailView,
  TokenDetailViewComponent: GenericWebTokenDetailView,
  EditPageComponent: GenericWebGeneratorEditPage,
  editMode: "route",
  getEditHref: (generatorId) => `/generator/generic-web/${generatorId}/edit`,
  supportsPendingCreateNavigation: true,
  supportsIndexedFeatures:
    SHARED_BOOTLOADER_CATALOG["generic-web"].supportsIndexedFeatures,
  supportsGeneratorMetadata:
    SHARED_BOOTLOADER_CATALOG["generic-web"].supportsGeneratorMetadata,
  operations: {
    mint: ({ tezos, generatorId, price }) =>
      mintGenericWeb(tezos, generatorId, price),
    setSale: ({ tezos, generatorId, price, editions, paused, startTime }) =>
      setGenericWebSale(tezos, generatorId, price, editions, paused, startTime),
    deleteGenerator: ({ tezos, generatorId }) =>
      deleteGenericWebGenerator(tezos, generatorId),
    updateGenerator: ({ tezos, generatorId, name, codeOrCid }) =>
      updateGenericWebGenerator(tezos, generatorId, name, codeOrCid),
    regenerateToken: ({ tezos, tokenId }) =>
      regenerateGenericWebToken(tezos, tokenId),
    afterMint: async ({ tokenId, authToken, refetchTokens }) => {
      if (!tokenId || !authToken) return;
      try {
        await triggerGenericWebTokenIndexer(tokenId, authToken);
      } catch (error) {
        console.warn("[mint] failed to trigger manual indexer", error);
      }
      await triggerGenericWebMintRefresh(refetchTokens);
    },
    afterRegenerate: async ({ tokenId, authToken }) => {
      if (!authToken) return;
      try {
        await triggerGenericWebTokenIndexer(tokenId, authToken, {
          waitForCompletion: true,
        });
      } catch (error) {
        console.warn("[regenerate] failed to trigger manual indexer", error);
      }
    },
  },
  status: CONFIG.network === "shadownet" ? "active" : "coming-soon",
};
