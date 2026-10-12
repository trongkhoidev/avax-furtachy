"use client";

import { useCallback, useState } from "react";
import { encodeFunctionData, parseUnits, parseEther, isAddress, maxUint256, parseEventLogs } from "viem";
import { metadataHash } from "@futara/sdk";
import { decisionAmmAbi, erc20Abi, governorAbi } from "./abis";
import { buildTimeAddresses } from "./addresses";
import { usePropose, type ProposalAction } from "./governor";
import { usePublicClient, useWalletClient } from "./hooks";
import { useWallet } from "@/app/components/client-providers";

export interface CreateProposalInput {
  title: string;
  summary: string;
  body: string;
  category: string;
  actionType: string;
  amount: string;
  recipient: string;
  calldata: string;
  initialLiquidityUsdc: string;
  governorAddress?: `0x${string}` | null;
}

function toBase64Utf8(str: string): string {
  if (typeof window === "undefined") return "";
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return "";
  }
}

export function useCreateProposal(governorAddress?: `0x${string}` | null) {
  const wallet = useWallet();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const [createdProposalId, setCreatedProposalId] = useState<bigint | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);

  const targetGovernor = governorAddress ?? buildTimeAddresses.governor;
  const { propose, stage: proposeStage, txHash, receipt, error: proposeError, reset: resetPropose } = usePropose(targetGovernor);

  const reset = useCallback(() => {
    resetPropose();
    setCreatedProposalId(null);
    setStatusMessage(null);
    setCustomError(null);
  }, [resetPropose]);

  const createProposal = useCallback(
    async (input: CreateProposalInput) => {
      setCustomError(null);
      setStatusMessage(null);
      const govAddr = input.governorAddress ?? targetGovernor;
      if (!govAddr) {
        throw new Error("Governor contract address not configured.");
      }
      if (!wallet.address || !walletClient) {
        throw new Error("Wallet not connected.");
      }

      try {
      // 1. Build Proposal metadata with safe UTF-8 base64
      const meta = {
        title: input.title,
        summary: input.summary,
        body: input.body,
        category: input.category,
        createdAt: Math.floor(Date.now() / 1000),
        proposer: wallet.address,
      };

      const hash = metadataHash(meta);
      const uri = `data:application/json;base64,${toBase64Utf8(JSON.stringify(meta))}`;

      // 2. Build actions array
      const actions: ProposalAction[] = [];

      // Resolve the project-specific assets and parameters from this Governor.
      setStatusMessage("Reading project market parameters...");
      let govUsdc: `0x${string}`;
      let govToken: `0x${string}`;
      let govParams: readonly [number, number, number, number, number, number, number, number, bigint, bigint];
      let spotAmm: `0x${string}`;
      try {
        [govUsdc, govToken, govParams, spotAmm] = await Promise.all([
          publicClient.readContract({ abi: governorAbi, address: govAddr, functionName: "usdc" }),
          publicClient.readContract({ abi: governorAbi, address: govAddr, functionName: "token" }),
          publicClient.readContract({ abi: governorAbi, address: govAddr, functionName: "params" }),
          publicClient.readContract({ abi: governorAbi, address: govAddr, functionName: "spotAmm" }),
        ] as const);
      } catch (error) {
        setStatusMessage(null);
        throw error;
      }
      const zero = "0x0000000000000000000000000000000000000000";
      if (!isAddress(govUsdc) || !isAddress(govToken) || !isAddress(spotAmm) || govUsdc === zero || govToken === zero || spotAmm === zero) {
        setStatusMessage(null);
        throw new Error("Governor is missing its USDC, project token, or spot market.");
      }
      if (!Array.isArray(govParams) || govParams.length < 10) {
        setStatusMessage(null);
        throw new Error("Governor parameters could not be read.");
      }
      const minUpdateInterval = govParams[4];
      const proposalBond = govParams[8] as bigint;
      const minLiquidityUsdc = govParams[9] as bigint;

      if (input.actionType === "Transfer USDC") {
        if (!isAddress(input.recipient)) throw new Error("Enter a valid recipient address.");
        const amt = parseUnits(input.amount || "0", 6);
        if (amt <= 0n) throw new Error("Transfer amount must be greater than zero.");
        const data = encodeFunctionData({
          abi: [
            {
              type: "function",
              name: "transfer",
              inputs: [
                { name: "to", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              outputs: [{ name: "", type: "bool" }],
              stateMutability: "nonpayable",
            },
          ],
          args: [input.recipient as `0x${string}`, amt],
        });
        actions.push({ target: govUsdc, value: 0n, data });
      } else if (input.actionType === "Advanced calldata" && /^0x(?:[a-fA-F0-9]{2})*$/.test(input.calldata)) {
        if (!isAddress(input.recipient)) throw new Error("Enter a valid target contract address.");
        actions.push({
          target: input.recipient as `0x${string}`,
          value: input.amount.trim() ? parseEther(input.amount) : 0n,
          data: input.calldata as `0x${string}`,
        });
      } else {
        throw new Error("Unsupported proposal action.");
      }

      const liqUsdc = parseUnits(input.initialLiquidityUsdc || "0", 6);
      if (liqUsdc <= 0n) throw new Error("Initial liquidity must be greater than zero.");
      if (liqUsdc < minLiquidityUsdc) throw new Error("Initial liquidity is below the Governor minimum.");
      const seedPrice = await publicClient.readContract({ abi: decisionAmmAbi, address: spotAmm, functionName: "consult", args: [Number(minUpdateInterval) * 5] }).catch(async () => await publicClient.readContract({ abi: decisionAmmAbi, address: spotAmm, functionName: "spotPriceE18" }));
      if (seedPrice <= 0n) throw new Error("The project's spot market has no valid seed price.");
      const liquidityTokenAmount = liqUsdc * 10n ** 30n / seedPrice;
      const maxLiqToken = liquidityTokenAmount * 10_050n / 10_000n;
      if (liquidityTokenAmount <= 0n) throw new Error("Initial liquidity rounds to zero project tokens.");
      const usdcAddress = govUsdc;
      const tokenAddress = govToken;

      /*
       * Allowances are checked against this exact Governor and its project
       * token pair, then approved before `propose` transfers the bond and
       * market collateral.
       */
      setStatusMessage("Checking USDC allowance...");
      if (usdcAddress) {
        try {
          const usdcAllowance = (await publicClient.readContract({
            abi: erc20Abi,
            address: usdcAddress,
            functionName: "allowance",
            args: [wallet.address as `0x${string}`, govAddr],
          })) as bigint;

          if (usdcAllowance < liqUsdc) {
            setStatusMessage("Approving USDC for Governor...");
            const { request: usdcReq } = await publicClient.simulateContract({
              abi: erc20Abi,
              address: usdcAddress,
              functionName: "approve",
              args: [govAddr, maxUint256],
              account: walletClient.account,
            });
            const approveHash = await walletClient.writeContract(usdcReq as never);
            const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 1 });
            if (approvalReceipt.status !== "success") throw new Error("USDC approval reverted.");
          }
        } catch (err) {
          const msg = `Failed to approve USDC: ${(err as Error).message}`;
          setCustomError(msg);
          setStatusMessage(null);
          throw new Error(msg);
        }
      }

      setStatusMessage("Checking project-token allowance...");
      if (tokenAddress) {
        try {
          const tokenAllowance = (await publicClient.readContract({
            abi: erc20Abi,
            address: tokenAddress,
            functionName: "allowance",
            args: [wallet.address as `0x${string}`, govAddr],
          })) as bigint;

          const requiredToken = maxLiqToken + proposalBond;
          if (tokenAllowance < requiredToken) {
            setStatusMessage("Approving project token for Governor...");
            const { request: tokenReq } = await publicClient.simulateContract({
              abi: erc20Abi,
              address: tokenAddress,
              functionName: "approve",
              args: [govAddr, maxUint256],
              account: walletClient.account,
            });
            const approveHash = await walletClient.writeContract(tokenReq as never);
            const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 1 });
            if (approvalReceipt.status !== "success") throw new Error("Project-token approval reverted.");
          }
        } catch (err) {
          const msg = `Failed to approve token: ${(err as Error).message}`;
          setCustomError(msg);
          setStatusMessage(null);
          throw new Error(msg);
        }
      }

      // 4. Propose on-chain
      setStatusMessage("Submitting proposal to Governor...");
      let txReceipt;
      try {
        txReceipt = await propose(actions, uri, hash, liqUsdc, maxLiqToken, govAddr);
      } catch (error) {
        setStatusMessage(null);
        throw error;
      }

      // 5. Correctly decode ProposalCreated event to get proposal ID
      if (txReceipt && txReceipt.status === "success") {
        try {
          const createdLogs = parseEventLogs({
            abi: governorAbi,
            eventName: "ProposalCreated",
            logs: txReceipt.logs,
          });
          if (createdLogs.length > 0 && createdLogs[0].args.id !== undefined) {
            setCreatedProposalId(createdLogs[0].args.id);
          }
        } catch {
          // If parseEventLogs has any issue, leave createdProposalId as null without failing receipt
        }
      }

      setStatusMessage(null);
      return txReceipt;
      } catch (error) {
        setStatusMessage(null);
        setCustomError(error instanceof Error ? error.message : "Proposal submission failed.");
        throw error;
      }
    },
    [propose, publicClient, targetGovernor, wallet.address, walletClient],
  );

  return {
    createProposal,
    stage: proposeStage,
    txHash,
    receipt,
    error: customError || proposeError,
    createdProposalId,
    statusMessage,
    reset,
    isGovernorConfigured: Boolean(targetGovernor),
  };
}
