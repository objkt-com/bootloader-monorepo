import type { ComponentType } from "react";
import type { TezosToolkit } from "@taquito/taquito";
import type {
  DeleteGeneratorResult,
  MintResult,
  RegenerateTokenResult,
  SetSaleResult,
  UpdateGeneratorResult,
} from "@/services/tezos";
import type {
  Bootloader,
  BootloaderViewerProps,
} from "@/types/bootloader";
import type {
  BootloaderGeneratorDetailViewProps,
  BootloaderTokenDetailViewProps,
} from "@/bootloaders/page-types";

export interface BootloaderOperationContext {
  tezos: TezosToolkit;
}

export interface BootloaderMintContext extends BootloaderOperationContext {
  generatorId: string;
  price: number;
}

export interface BootloaderSetSaleContext extends BootloaderOperationContext {
  generatorId: string;
  price: number;
  editions: number;
  paused: boolean;
  startTime: string | null;
}

export interface BootloaderDeleteGeneratorContext
  extends BootloaderOperationContext {
  generatorId: string;
}

export interface BootloaderUpdateGeneratorContext
  extends BootloaderOperationContext {
  generatorId: string;
  name: string;
  codeOrCid: string;
}

export interface BootloaderRegenerateTokenContext
  extends BootloaderOperationContext {
  tokenId: string;
}

export interface BootloaderAfterMintContext {
  tokenId?: string;
  authToken?: string | null;
  refetchTokens?: () => void | Promise<void>;
}

export interface BootloaderAfterRegenerateContext {
  tokenId: string;
  authToken?: string | null;
}

export interface BootloaderDefinition extends Bootloader {
  ViewerComponent: ComponentType<BootloaderViewerProps>;
  CreatorComponent: ComponentType<{ bootloader: Bootloader; className?: string }>;
  GeneratorDetailViewComponent: ComponentType<BootloaderGeneratorDetailViewProps>;
  TokenDetailViewComponent: ComponentType<BootloaderTokenDetailViewProps>;
  EditPageComponent?: ComponentType;
  editMode: "inline" | "route" | "none";
  getEditHref?: (generatorId: string) => string;
  supportsPendingCreateNavigation?: boolean;
  supportsIndexedFeatures?: boolean;
  supportsGeneratorMetadata?: boolean;
  operations: {
    mint: (ctx: BootloaderMintContext) => Promise<MintResult>;
    setSale: (ctx: BootloaderSetSaleContext) => Promise<SetSaleResult>;
    deleteGenerator: (
      ctx: BootloaderDeleteGeneratorContext
    ) => Promise<DeleteGeneratorResult>;
    updateGenerator: (
      ctx: BootloaderUpdateGeneratorContext
    ) => Promise<UpdateGeneratorResult>;
    regenerateToken: (
      ctx: BootloaderRegenerateTokenContext
    ) => Promise<RegenerateTokenResult>;
    afterMint?: (ctx: BootloaderAfterMintContext) => Promise<void>;
    afterRegenerate?: (
      ctx: BootloaderAfterRegenerateContext
    ) => Promise<void>;
  };
}
