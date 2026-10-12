"use client";

import { useCallback, useState } from "react";
import { parseEther, parseUnits, parseEventLogs } from "viem";
import { metadataHash } from "@futara/sdk";
import { futaraFactoryAbi } from "./abis";
import { buildTimeAddresses, isFactoryConfigured } from "./addresses";
import { useContractWrite, type TxStage } from "./hooks";
import { useWallet } from "@/app/components/client-providers";

export interface CreateProjectParams {
  name: string;
  symbol: string;
  tagline: string;
  description: string;
  website: string;
  github: string;
  supply: string;
  allocation: [number, number, number, number]; // sale, liquidity, treasury, founder (percentages summing to 100)
  minRaise: string;
  hardCap: string;
  liquidityUsdcPercent: string;
  tradingPeriodSeconds: string;
  thresholdBps: string;
  twapDelaySeconds: string;
  minimumLiquidity: string;
  monthlyBudget: string;
  operatorWallet: string;
}

function toBase64Utf8(str: string): string {
  if (typeof window === "undefined") return "";
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return "";
  }
}

export function useCreateProject() {
  const wallet = useWallet();
  const { write, stage, txHash, receipt, error: writeError, reset } = useContractWrite();
  const [createdProjectId, setCreatedProjectId] = useState<bigint | null>(null);

  const createProject = useCallback(
    async (params: CreateProjectParams) => {
      if (!isFactoryConfigured() || !buildTimeAddresses.factory) {
        throw new Error("Factory contract is not configured on this network.");
      }
      if (!wallet.address) {
        throw new Error("Wallet not connected.");
      }

      const founderAddress = wallet.address as `0x${string}`;
      const operatorAddress = (
        params.operatorWallet && /^0x[a-fA-F0-9]{40}$/.test(params.operatorWallet)
          ? params.operatorWallet
          : founderAddress
      ) as `0x${string}`;

      // Build metadata payload
      const metadata = {
        name: params.name,
        symbol: params.symbol,
        tagline: params.tagline,
        description: params.description,
        website: params.website,
        github: params.github,
        createdAt: Math.floor(Date.now() / 1000),
        creator: founderAddress,
      };

      const hash = metadataHash(metadata);
      const metadataURI = `data:application/json;base64,${toBase64Utf8(JSON.stringify(metadata))}`;

      // Convert percentages (0-100) to bps (0-10000)
      const saleBps = Math.round(params.allocation[0] * 100);
      const liquidityBps = Math.round(params.allocation[1] * 100);
      const treasuryBps = Math.round(params.allocation[2] * 100);
      const founderBps = Math.round(params.allocation[3] * 100);

      const totalSupply = parseEther(params.supply);
      const minRaise = parseUnits(params.minRaise, 6);
      const hardCap = parseUnits(params.hardCap, 6);
      const minContribution = parseUnits("10", 6); // 10 USDC min
      const now = Math.floor(Date.now() / 1000);
      const startTime = BigInt(now + 60); // Starts in 1 minute
      const endTime = BigInt(now + 60 + 86400 * 3); // 3 days raise
      const liquidityUsdcBps = Math.round(Number(params.liquidityUsdcPercent) * 100);

      const tokenCfg = {
        name: params.name,
        symbol: params.symbol,
        totalSupply,
        allocation: {
          saleBps,
          liquidityBps,
          treasuryBps,
          founderBps,
        },
      };

      const raiseCfg = {
        minRaise,
        hardCap,
        minContribution,
        startTime,
        endTime,
        liquidityUsdcBps,
        liquidityPremiumBps: 0,
      };

      const futarchyParams = {
        warmup: 60, // 1 min warmup
        tradingPeriod: Number(params.tradingPeriodSeconds),
        twapStartDelay: Number(params.twapDelaySeconds),
        executionWindow: 86400, // 1 day
        minUpdateInterval: 30, // 30 sec
        maxObsChangeBps: 100, // 1%
        thresholdBps: Number(params.thresholdBps),
        ammFeeBps: 30, // 0.3%
        proposalBond: parseEther("1000"), // 1,000 project tokens (18 decimals)
        minLiquidityUsdc: parseUnits(params.minimumLiquidity, 6),
      };

      const budget = {
        operator: operatorAddress,
        monthlyBudget: parseUnits(params.monthlyBudget || "0", 6),
        budgetPeriod: 30 * 86400, // 30 days
      };

      const founderCfg = {
        beneficiary: founderAddress,
        cliff: 180 * 86400, // 180 days
        twapWindow: 7 * 86400, // 7 days TWAP
        milestoneMultipliersX100: [150, 200, 300], // 1.5x, 2.0x, 3.0x
        unlockBps: [3333, 3333, 3334], // 10,000 bps total
      };

      const txReceipt = await write({
        abi: futaraFactoryAbi,
        address: buildTimeAddresses.factory,
        functionName: "createProject",
        args: [
          tokenCfg,
          raiseCfg,
          futarchyParams,
          budget,
          founderCfg,
          metadataURI,
          hash,
        ],
      });

      if (txReceipt && txReceipt.status === "success") {
        try {
          const createdLogs = parseEventLogs({
            abi: futaraFactoryAbi,
            eventName: "ProjectCreated",
            logs: txReceipt.logs,
          });
          if (createdLogs.length > 0 && (createdLogs[0].args as any)?.projectId !== undefined) {
            setCreatedProjectId((createdLogs[0].args as any).projectId);
          } else if (txReceipt.logs.length > 0 && txReceipt.logs[0]?.topics?.[1]) {
            setCreatedProjectId(BigInt(txReceipt.logs[0].topics[1]));
          }
        } catch {
          if (txReceipt.logs.length > 0 && txReceipt.logs[0]?.topics?.[1]) {
            setCreatedProjectId(BigInt(txReceipt.logs[0].topics[1]));
          }
        }
      }

      return txReceipt;
    },
    [wallet.address, write],
  );

  return {
    createProject,
    stage,
    txHash,
    receipt,
    error: writeError,
    createdProjectId,
    reset,
    isConfigured: isFactoryConfigured(),
  };
}
