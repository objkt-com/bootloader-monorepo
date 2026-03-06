import { decodeParamsFromQuery } from "./param-encoder";

export interface ParsedGenericWebArtifactUri {
  cid: string;
  seed?: string;
  iteration?: number;
  paramsEncoded?: string;
  params?: Record<string, unknown>;
}

export function parseGenericWebArtifactUri(
  artifactUri: string
): ParsedGenericWebArtifactUri | null {
  if (!artifactUri || !artifactUri.startsWith("ipfs://")) {
    return null;
  }

  const withoutPrefix = artifactUri.slice("ipfs://".length);
  const [cidPart, queryString = ""] = withoutPrefix.split("?");
  if (!cidPart) {
    return null;
  }

  const query = new URLSearchParams(queryString);
  const seed = query.get("s") || undefined;
  const iterationRaw = query.get("i");
  const iteration =
    iterationRaw != null &&
    iterationRaw.trim() !== "" &&
    Number.isFinite(Number(iterationRaw))
      ? Math.trunc(Number(iterationRaw))
      : undefined;
  const paramsEncoded = query.get("p") || undefined;

  return {
    cid: cidPart,
    seed,
    iteration,
    paramsEncoded,
    params: paramsEncoded ? decodeParamsFromQuery(paramsEncoded) || undefined : undefined,
  };
}
