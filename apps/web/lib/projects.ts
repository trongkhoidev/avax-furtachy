import { createPublicClient, http } from "viem";
import { futaraFactoryAbi, raiseAbi } from "./contracts/abis";
import { buildTimeAddresses, chainConfig, targetChain } from "./contracts/addresses";

/**
 * Safely validates and parses a string into a positive BigInt (> 0).
 * Rejects non-integers, scientific notation (e.g. "1e2"), floats (e.g. "1.5"), and non-positive numbers.
 */
export function parsePositiveBigInt(value: string | undefined | null): bigint | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

/**
 * Safely validates and parses a string into a non-negative BigInt (>= 0).
 * Rejects non-integers, scientific notation, floats, and negative numbers.
 */
export function parseNonNegativeBigInt(value: string | undefined | null): bigint | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^(0|[1-9]\d*)$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

export interface RaiseDetails {
  state: number; // 0: Pending, 1: Active, 2: Failed, 3: Succeeded, 4: Finalized
  startTime: bigint;
  endTime: bigint;
  totalContributed: bigint;
}

export interface FactoryProjectRecord {
  id: bigint;
  founder: `0x${string}`;
  raise: `0x${string}`;
  token: `0x${string}`;
  treasury: `0x${string}`;
  governor: `0x${string}`;
  spotAmm: `0x${string}`;
  name: string;
  symbol: string;
  totalSupply: bigint;
  minRaise: bigint;
  hardCap: bigint;
  isLive: boolean;
  metadataURI: string;
  raiseDetails: RaiseDetails | null;
}

export type ProjectLookupResult =
  | { status: "found"; project: FactoryProjectRecord }
  | { status: "not-found" }
  | { status: "unconfigured" }
  | { status: "error"; error: string };

import { VERIFIED_PROJECTS } from "./verified-markets";

export async function getFactoryProject(projectId: bigint): Promise<ProjectLookupResult> {
  const verifiedMatch = VERIFIED_PROJECTS.find((p) => p.id === projectId.toString());
  const fallbackProject: FactoryProjectRecord | null = verifiedMatch ? {
    id: projectId,
    founder: verifiedMatch.founder as `0x${string}`,
    raise: verifiedMatch.raise as `0x${string}`,
    token: (verifiedMatch.token || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    treasury: (verifiedMatch.treasury || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    governor: (verifiedMatch.governor || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    spotAmm: (verifiedMatch.spotAmm || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    name: verifiedMatch.name || `Project #${projectId}`,
    symbol: verifiedMatch.symbol || "TOKEN",
    totalSupply: 1_000_000_000_000_000_000_000_000n,
    minRaise: BigInt(verifiedMatch.minRaise || "0"),
    hardCap: BigInt(verifiedMatch.hardCap || "0"),
    isLive: true,
    metadataURI: verifiedMatch.metadataURI || "",
    raiseDetails: {
      state: 4,
      startTime: BigInt(verifiedMatch.createdAt || "1760000000"),
      endTime: BigInt(verifiedMatch.createdAt || "1760000000") + 86400n * 7n,
      totalContributed: BigInt(verifiedMatch.totalContributed || "0"),
    },
  } : null;

  const factoryAddr = buildTimeAddresses.factory;
  if (!factoryAddr) {
    if (fallbackProject) return { status: "found", project: fallbackProject };
    return { status: "unconfigured" };
  }

  const client = createPublicClient({
    chain: targetChain,
    transport: http(chainConfig.rpcUrl),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: any;
  try {
    res = await client.readContract({
      abi: futaraFactoryAbi,
      address: factoryAddr,
      functionName: "getProject",
      args: [projectId],
    });
  } catch (err) {
    if (fallbackProject) return { status: "found", project: fallbackProject };
    const errorMsg = err instanceof Error ? err.message : "RPC request to FutaraFactory failed.";
    return { status: "error", error: errorMsg };
  }

  if (!res || !res.founder || res.founder === "0x0000000000000000000000000000000000000000") {
    if (fallbackProject) return { status: "found", project: fallbackProject };
    return { status: "not-found" };
  }

  const isLive = Boolean(res.token && res.token !== "0x0000000000000000000000000000000000000000");

  let raiseDetails: RaiseDetails | null = null;
  if (res.raise && res.raise !== "0x0000000000000000000000000000000000000000") {
    const startTime = BigInt(res.raiseCfg?.startTime ?? 0);
    const endTime = BigInt(res.raiseCfg?.endTime ?? 0);

    try {
      const [rState, rTotal] = await Promise.all([
        client.readContract({
          abi: raiseAbi,
          address: res.raise,
          functionName: "state",
        }),
        client.readContract({
          abi: raiseAbi,
          address: res.raise,
          functionName: "totalContributed",
        }),
      ]);

      raiseDetails = {
        state: Number(rState ?? 0),
        startTime,
        endTime,
        totalContributed: BigInt(rTotal ?? 0n),
      };
    } catch {
      raiseDetails = null;
    }
  }

  return {
    status: "found",
    project: {
      id: projectId,
      founder: res.founder,
      raise: res.raise,
      token: res.token,
      treasury: res.treasury,
      governor: res.governor,
      spotAmm: res.spotAmm,
      name: res.tokenCfg?.name || `Project #${projectId}`,
      symbol: res.tokenCfg?.symbol || "TOKEN",
      totalSupply: res.tokenCfg?.totalSupply || 0n,
      minRaise: res.raiseCfg?.minRaise || 0n,
      hardCap: res.raiseCfg?.hardCap || 0n,
      isLive,
      metadataURI: res.metadataURI || "",
      raiseDetails,
    },
  };
}
