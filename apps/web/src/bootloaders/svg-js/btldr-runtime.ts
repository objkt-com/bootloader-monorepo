/**
 * Generate an SVG data URL from code, seed, and iteration
 * This replicates the SVG generation from the original frontend
 */
export function generateSvgDataUrl(
  code: string,
  seed: string | number,
  iterationNumber: number = 0
): string {
  const encodedCode = encodeURIComponent(code)

  // Normalize the seed: ensure hex strings have 0x prefix for BigInt literal
  let normalizedSeed: string
  if (typeof seed === 'string') {
    // If it's a hex string (64 chars, all hex), add 0x prefix if missing
    if (/^[0-9a-fA-F]{64}$/.test(seed)) {
      normalizedSeed = '0x' + seed
    } else if (seed.startsWith('0x')) {
      normalizedSeed = seed
    } else {
      // Treat as decimal number
      normalizedSeed = seed
    }
  } else {
    normalizedSeed = String(seed)
  }

  // Fragment 1: SVG header and seed initialization
  const frag_1 =
    "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cscript%3E%3C!%5BCDATA%5Bconst%20SEED%3D"

  // Fragment 2: splitmix64 + sfc32 PRNG setup
  const frag_2 =
    "n%3Bfunction%20splitmix64(f)%7Blet%20n%3Df%3Breturn%20function()%7Blet%20f%3Dn%3Dn%2B0x9e3779b97f4a7c15n%260xffffffffffffffffn%3Breturn%20f%3D((f%3D(f%5Ef%3E%3E30n)*0xbf58476d1ce4e5b9n%260xffffffffffffffffn)%5Ef%3E%3E27n)*0x94d049bb133111ebn%260xffffffffffffffffn%2CNumber(4294967295n%26(f%5E%3Df%3E%3E31n))%3E%3E%3E0%7D%7Dfunction%20sfc32(f%2Cn%2C%24%2Ct)%7Breturn%20function()%7B%24%7C%3D0%3Blet%20e%3D((f%7C%3D0)%2B(n%7C%3D0)%7C0)%2B(t%7C%3D0)%7C0%3Breturn%20t%3Dt%2B1%7C0%2Cf%3Dn%5En%3E%3E%3E9%2Cn%3D%24%2B(%24%3C%3C3)%7C0%2C%24%3D(%24%3D%24%3C%3C21%7C%24%3E%3E%3E11)%2Be%7C0%2C(e%3E%3E%3E0)%2F4294967296%7D%7Dconst%20sm%3Dsplitmix64(SEED)%2Ca%3Dsm()%2Cb%3Dsm()%2Cc%3Dsm()%2Cd%3Dsm()%2Cn%3D"

  // Fragment 3: BTLDR object setup
  const frag_3 =
    "%2CBTLDR%3D%7Brnd%3Asfc32(a%2Cb%2Cc%2Cd)%2Cseed%3ASEED%2CiterationNumber%3An%2CisPreview%3An%3D%3D%3D0%26%26SEED%3D%3D%3D0n%2Csvg%3Adocument.documentElement%2Cv%3A%27svg-js%3A0.0.1%27%7D%3B((BTLDR)%3D%3E%7B"

  // Fragment 4: Script and SVG closing tags
  const frag_4 = "%7D)(BTLDR)%3B%5D%5D%3E%3C%2Fscript%3E%3C%2Fsvg%3E"

  const svgContent = frag_1 + normalizedSeed + frag_2 + iterationNumber + frag_3 + encodedCode + frag_4

  return svgContent
}

/**
 * Calculate the storage cost for on-chain code
 * Based on the original storageCost.js
 */
export function calculateStorageCost(code: string): {
  byteCost: number
  totalBytes: number
  totalMutez: number
} {
  const codeBytes = new TextEncoder().encode(code).length
  const baseCreateBytes = 164
  const totalBytes = baseCreateBytes + codeBytes
  const byteCostMutez = 250 // 250 mutez per byte

  return {
    byteCost: byteCostMutez,
    totalBytes,
    totalMutez: totalBytes * byteCostMutez,
  }
}

/**
 * Format mutez as tez
 */
export function formatTez(mutez: number): string {
  return (mutez / 1_000_000).toFixed(6) + ' ꜩ'
}
