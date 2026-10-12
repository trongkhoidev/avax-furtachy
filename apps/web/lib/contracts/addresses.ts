/**
 * Contract address resolution by chain ID.
 *
 * Addresses are resolved from `NEXT_PUBLIC_*` environment variables at build
 * time. When an address is not set the corresponding hook will report the
 * contract as unconfigured and disable write operations.
 *
 * After deploying to Fuji via `forge script`, copy the addresses from
 * `packages/contracts/deployments/fuji.json` into your `.env.fuji` and
 * rebuild the web app so they are baked into the client bundle.
 */

export interface ContractAddresses {
  factory: `0x${string}` | null;
  usdc: `0x${string}` | null;
  /** Populated after createProject — not a build-time constant. */
  raise: `0x${string}` | null;
  governor: `0x${string}` | null;
  treasury: `0x${string}` | null;
  spotAmm: `0x${string}` | null;
  forecastRegistry: `0x${string}` | null;
}

function cleanAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return value as `0x${string}`;
}

export const buildTimeAddresses: ContractAddresses = {
  factory: cleanAddress(process.env.NEXT_PUBLIC_FACTORY_ADDRESS),
  usdc: cleanAddress(process.env.NEXT_PUBLIC_USDC_ADDRESS),
  raise: cleanAddress(process.env.NEXT_PUBLIC_RAISE_ADDRESS),
  governor: cleanAddress(process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS),
  treasury: cleanAddress(process.env.NEXT_PUBLIC_TREASURY_ADDRESS),
  spotAmm: cleanAddress(process.env.NEXT_PUBLIC_SPOT_AMM_ADDRESS),
  forecastRegistry: cleanAddress(process.env.NEXT_PUBLIC_FORECAST_REGISTRY_ADDRESS),
};

/** Chain configuration for the target network. */
export const chainConfig = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "43113"),
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc",
} as const;

/** Explicit metadata avoids bundling viem's generated chain registry. */
export const targetChain = {
  id: chainConfig.id,
  name: chainConfig.id === 43113 ? "Avalanche Fuji" : chainConfig.id === 31337 ? "Anvil Local" : `Chain ${chainConfig.id}`,
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: { default: { http: [chainConfig.rpcUrl] } },
  blockExplorers: { default: { name: "Snowtrace", url: chainConfig.id === 43113 ? "https://testnet.snowtrace.io" : "https://snowtrace.io" } },
  testnet: chainConfig.id === 43113,
} as const;

/**
 * Returns true when the minimum set of factory-level addresses is configured.
 * This gates the "Create Project" flow in the wizard.
 */
export function isFactoryConfigured(): boolean {
  return buildTimeAddresses.factory !== null && buildTimeAddresses.usdc !== null;
}
