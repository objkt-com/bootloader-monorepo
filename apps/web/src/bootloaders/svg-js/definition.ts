import { SHARED_BOOTLOADER_CATALOG } from "../../../../../shared/bootloaders/catalog";
import { SvgJsViewer, SvgJsCreator } from "@/bootloaders/svg-js";
import { SvgJsGeneratorDetailView } from "@/bootloaders/svg-js/generator-detail-view";
import { SvgJsTokenDetailView } from "@/bootloaders/svg-js/token-detail-view";
import {
  deleteGenerator,
  mint,
  regenerateToken,
  setSale,
  updateGenerator,
} from "@/services/tezos";
import type { BootloaderDefinition } from "@/bootloaders/definition-types";

export const svgJsBootloaderDefinition: BootloaderDefinition = {
  id: "svg-js",
  currentVersion: SHARED_BOOTLOADER_CATALOG["svg-js"].currentVersion,
  spec: SHARED_BOOTLOADER_CATALOG["svg-js"].spec,
  name: "SVG-JS",
  description: "Inline JavaScript code that generates SVG artwork",
  longDescription: `The SVG JavaScript bootloader stores your generative art code directly
on-chain. Write JavaScript that uses the BTLDR runtime to create SVG artwork. Your code
has access to a seeded random number generator for deterministic output. Perfect for
lightweight, fully on-chain generative art.`,
  constraints: {
    maxSize: 24576,
    formats: ["svg"],
  },
  features: {
    hasCodeEditor: true,
    hasParameterSupport: false,
    hasZipUpload: false,
    hasHardwareSupport: false,
    previewType: "svg",
    storageType: "onchain",
  },
  ViewerComponent: SvgJsViewer,
  CreatorComponent: SvgJsCreator,
  GeneratorDetailViewComponent: SvgJsGeneratorDetailView,
  TokenDetailViewComponent: SvgJsTokenDetailView,
  editMode: "inline",
  supportsPendingCreateNavigation: false,
  supportsIndexedFeatures: SHARED_BOOTLOADER_CATALOG["svg-js"].supportsIndexedFeatures,
  supportsGeneratorMetadata:
    SHARED_BOOTLOADER_CATALOG["svg-js"].supportsGeneratorMetadata,
  operations: {
    mint: ({ tezos, generatorId, price }) => mint(tezos, generatorId, price),
    setSale: ({ tezos, generatorId, price, editions, paused, startTime }) =>
      setSale(tezos, generatorId, price, editions, paused, startTime),
    deleteGenerator: ({ tezos, generatorId }) =>
      deleteGenerator(tezos, generatorId),
    updateGenerator: ({ tezos, generatorId, name, codeOrCid }) =>
      updateGenerator(tezos, generatorId, name, codeOrCid),
    regenerateToken: ({ tezos, tokenId }) => regenerateToken(tezos, tokenId),
  },
  status: "active",
};
