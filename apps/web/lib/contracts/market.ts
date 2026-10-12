"use client";

import { useCallback, useState } from "react";
import { maxUint256, type TransactionReceipt } from "viem";
import { decisionAmmAbi, conditionalVaultAbi, erc20Abi } from "./abis";
import { useContractRead, useContractWrite, usePublicClient, useWalletClient, type TxStage } from "./hooks";
import { useWallet } from "@/app/components/client-providers";

export function useAmmReserves(ammAddress: `0x${string}` | null) {
  const { data: reserveBase, isLoading: baseLoading, refetch: refetchBase } = useContractRead({
    abi: decisionAmmAbi,
    address: ammAddress,
    functionName: "reserveBase",
    enabled: Boolean(ammAddress),
  });

  const { data: reserveQuote, isLoading: quoteLoading, refetch: refetchQuote } = useContractRead({
    abi: decisionAmmAbi,
    address: ammAddress,
    functionName: "reserveQuote",
    enabled: Boolean(ammAddress),
  });

  const { data: spotPrice, refetch: refetchSpot } = useContractRead({
    abi: decisionAmmAbi,
    address: ammAddress,
    functionName: "spotPriceE18",
    enabled: Boolean(ammAddress),
  });

  const refetch = useCallback(() => {
    refetchBase();
    refetchQuote();
    refetchSpot();
  }, [refetchBase, refetchQuote, refetchSpot]);

  return {
    reserveBase: (reserveBase as bigint | undefined) ?? 0n,
    reserveQuote: (reserveQuote as bigint | undefined) ?? 0n,
    spotPrice: (spotPrice as bigint | undefined) ?? 0n,
    isLoading: baseLoading || quoteLoading,
    refetch,
  };
}

export function useAmmAmountOut(
  ammAddress: `0x${string}` | null,
  quoteToBase: boolean,
  amountIn: bigint,
) {
  const { data, isLoading, error, refetch } = useContractRead({
    abi: decisionAmmAbi,
    address: ammAddress,
    functionName: "getAmountOut",
    args: [quoteToBase, amountIn],
    enabled: Boolean(ammAddress && amountIn > 0n),
  });

  return {
    amountOut: (data as bigint | undefined) ?? 0n,
    isLoading,
    error,
    refetch,
  };
}

export function useSwapQuoteForBase(ammAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const swap = useCallback(
    async (quoteIn: bigint, minBaseOut: bigint, to: `0x${string}`, deadline: bigint) => {
      if (!ammAddress) throw new Error("AMM address not provided.");
      return await write({
        abi: decisionAmmAbi,
        address: ammAddress,
        functionName: "swapExactQuoteForBase",
        args: [quoteIn, minBaseOut, to, deadline],
      });
    },
    [ammAddress, write],
  );

  return {
    swap,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}

export function useSwapBaseForQuote(ammAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const swap = useCallback(
    async (baseIn: bigint, minQuoteOut: bigint, to: `0x${string}`, deadline: bigint) => {
      if (!ammAddress) throw new Error("AMM address not provided.");
      return await write({
        abi: decisionAmmAbi,
        address: ammAddress,
        functionName: "swapExactBaseForQuote",
        args: [baseIn, minQuoteOut, to, deadline],
      });
    },
    [ammAddress, write],
  );

  return {
    swap,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}

export function useVaultOutcome(vaultAddress: `0x${string}` | null) {
  const { data, isLoading, error, refetch } = useContractRead({
    abi: conditionalVaultAbi,
    address: vaultAddress,
    functionName: "outcome",
    enabled: Boolean(vaultAddress),
  });

  return {
    outcome: (data as number | undefined) ?? 0,
    isLoading,
    error,
    refetch,
  };
}

export function useVaultSplit(vaultAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const split = useCallback(
    async (amount: bigint, to: `0x${string}`) => {
      if (!vaultAddress) throw new Error("Vault address not provided.");
      return await write({
        abi: conditionalVaultAbi,
        address: vaultAddress,
        functionName: "split",
        args: [amount, to],
      });
    },
    [vaultAddress, write],
  );

  return {
    split,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}

export function useVaultMerge(vaultAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const merge = useCallback(
    async (amount: bigint, to: `0x${string}`) => {
      if (!vaultAddress) throw new Error("Vault address not provided.");
      return await write({
        abi: conditionalVaultAbi,
        address: vaultAddress,
        functionName: "merge",
        args: [amount, to],
      });
    },
    [vaultAddress, write],
  );

  return {
    merge,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}

export function useVaultRedeem(vaultAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const redeem = useCallback(
    async (to: `0x${string}`) => {
      if (!vaultAddress) throw new Error("Vault address not provided.");
      return await write({
        abi: conditionalVaultAbi,
        address: vaultAddress,
        functionName: "redeem",
        args: [to],
      });
    },
    [vaultAddress, write],
  );

  return {
    redeem,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}

export interface ProposalMarketPair {
  vaultUsdc: `0x${string}`;
  vaultToken: `0x${string}`;
  passAmm: `0x${string}`;
  failAmm: `0x${string}`;
}

export interface ConditionalSwapParams {
  side: "Pass" | "Fail";
  order: "Buy" | "Sell";
  amount: bigint;
  recipient: `0x${string}`;
  deadline: bigint;
  slippageBps?: number;
  minOut?: bigint;
}

export function useConditionalMarketSwap(market: ProposalMarketPair | null) {
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const wallet = useWallet();

  const [stage, setStage] = useState<TxStage>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStage("idle");
    setStatusMessage(null);
    setTxHash(null);
    setReceipt(null);
    setError(null);
  }, []);

  const swap = useCallback(
    async ({ side, order, amount, recipient, deadline, slippageBps = 50, minOut }: ConditionalSwapParams) => {
      setError(null);
      setStatusMessage(null);
      setTxHash(null);
      setReceipt(null);

      if (!market) {
        const msg = "No verified proposal market available.";
        setError(msg);
        throw new Error(msg);
      }
      if (!wallet.address || !walletClient) {
        const msg = "Wallet not connected.";
        setError(msg);
        throw new Error(msg);
      }
      if (amount <= 0n) {
        const msg = "Amount must be greater than zero.";
        setError(msg);
        throw new Error(msg);
      }

      const targetAmm = side === "Pass" ? market.passAmm : market.failAmm;
      const user = wallet.address as `0x${string}`;
      const slipBps = BigInt(Math.max(1, Math.min(2000, slippageBps))); // 0.01% - 20%

      try {
        if (order === "Buy") {
          // Buying outcome tokens with USDC
          setStage("simulating");
          setStatusMessage(`Checking ${side} outcome tokens...`);

          const outcomeQuoteToken = (await publicClient.readContract({
            abi: conditionalVaultAbi,
            address: market.vaultUsdc,
            functionName: side === "Pass" ? "passToken" : "failToken",
          })) as `0x${string}`;

          const outcomeBal = (await publicClient.readContract({
            abi: erc20Abi,
            address: outcomeQuoteToken,
            functionName: "balanceOf",
            args: [user],
          })) as bigint;

          if (outcomeBal < amount) {
            const splitNeeded = amount - outcomeBal;
            const usdcAddr = (await publicClient.readContract({
              abi: conditionalVaultAbi,
              address: market.vaultUsdc,
              functionName: "underlying",
            })) as `0x${string}`;

            const usdcAllowance = (await publicClient.readContract({
              abi: erc20Abi,
              address: usdcAddr,
              functionName: "allowance",
              args: [user, market.vaultUsdc],
            })) as bigint;

            if (usdcAllowance < splitNeeded) {
              setStage("awaiting-signature");
              setStatusMessage("Approving USDC for conditional vault...");
              const { request: appReq } = await publicClient.simulateContract({
                abi: erc20Abi,
                address: usdcAddr,
                functionName: "approve",
                args: [market.vaultUsdc, maxUint256],
                account: walletClient.account,
              });
              const appTx = await walletClient.writeContract(appReq as never);
              setStage("confirming");
              const appRcpt = await publicClient.waitForTransactionReceipt({ hash: appTx, confirmations: 1 });
              if (appRcpt.status !== "success") {
                throw new Error("USDC approval reverted on-chain.");
              }
            }

            setStage("awaiting-signature");
            setStatusMessage("Splitting USDC into Pass & Fail outcome tokens...");
            const { request: splitReq } = await publicClient.simulateContract({
              abi: conditionalVaultAbi,
              address: market.vaultUsdc,
              functionName: "split",
              args: [splitNeeded, user],
              account: walletClient.account,
            });
            const splitTx = await walletClient.writeContract(splitReq as never);
            setStage("confirming");
            const splitRcpt = await publicClient.waitForTransactionReceipt({ hash: splitTx, confirmations: 1 });
            if (splitRcpt.status !== "success") {
              throw new Error("Conditional split reverted on-chain.");
            }
          }

          // Approve outcome quote token to target AMM
          const ammAllowance = (await publicClient.readContract({
            abi: erc20Abi,
            address: outcomeQuoteToken,
            functionName: "allowance",
            args: [user, targetAmm],
          })) as bigint;

          if (ammAllowance < amount) {
            setStage("awaiting-signature");
            setStatusMessage(`Approving ${side} outcome tokens for AMM...`);
            const { request: appAmmReq } = await publicClient.simulateContract({
              abi: erc20Abi,
              address: outcomeQuoteToken,
              functionName: "approve",
              args: [targetAmm, maxUint256],
              account: walletClient.account,
            });
            const appAmmTx = await walletClient.writeContract(appAmmReq as never);
            setStage("confirming");
            const appAmmRcpt = await publicClient.waitForTransactionReceipt({ hash: appAmmTx, confirmations: 1 });
            if (appAmmRcpt.status !== "success") {
              throw new Error("AMM token approval reverted on-chain.");
            }
          }

          // Calculate minimum output based on expected amount out and slippage
          const expectedOut = (await publicClient.readContract({
            abi: decisionAmmAbi,
            address: targetAmm,
            functionName: "getAmountOut",
            args: [true, amount],
          })) as bigint;
          const minBaseOut = minOut ?? (expectedOut > 0n ? (expectedOut * (10000n - slipBps)) / 10000n : 1n);

          // Swap on AMM
          setStage("awaiting-signature");
          setStatusMessage(`Swapping ${side} outcome tokens on AMM...`);
          const { request: swapReq } = await publicClient.simulateContract({
            abi: decisionAmmAbi,
            address: targetAmm,
            functionName: "swapExactQuoteForBase",
            args: [amount, minBaseOut, recipient, deadline],
            account: walletClient.account,
          });
          const swapTx = await walletClient.writeContract(swapReq as never);
          setTxHash(swapTx);
          setStage("confirming");
          const finalReceipt = await publicClient.waitForTransactionReceipt({ hash: swapTx, confirmations: 1 });
          setReceipt(finalReceipt);

          if (finalReceipt.status !== "success") {
            setStage("error");
            const msg = "Swap transaction reverted on-chain.";
            setError(msg);
            throw new Error(msg);
          }

          setStage("confirmed");
          setStatusMessage("Swap confirmed!");
          return finalReceipt;
        } else {
          // Selling outcome tokens for USDC
          setStage("simulating");
          setStatusMessage(`Checking ${side} outcome tokens...`);

          const outcomeBaseToken = (await publicClient.readContract({
            abi: conditionalVaultAbi,
            address: market.vaultToken,
            functionName: side === "Pass" ? "passToken" : "failToken",
          })) as `0x${string}`;

          const outcomeBal = (await publicClient.readContract({
            abi: erc20Abi,
            address: outcomeBaseToken,
            functionName: "balanceOf",
            args: [user],
          })) as bigint;

          if (outcomeBal < amount) {
            const splitNeeded = amount - outcomeBal;
            const tokenAddr = (await publicClient.readContract({
              abi: conditionalVaultAbi,
              address: market.vaultToken,
              functionName: "underlying",
            })) as `0x${string}`;

            const tokenAllowance = (await publicClient.readContract({
              abi: erc20Abi,
              address: tokenAddr,
              functionName: "allowance",
              args: [user, market.vaultToken],
            })) as bigint;

            if (tokenAllowance < splitNeeded) {
              setStage("awaiting-signature");
              setStatusMessage("Approving project token for conditional vault...");
              const { request: appReq } = await publicClient.simulateContract({
                abi: erc20Abi,
                address: tokenAddr,
                functionName: "approve",
                args: [market.vaultToken, maxUint256],
                account: walletClient.account,
              });
              const appTx = await walletClient.writeContract(appReq as never);
              setStage("confirming");
              const appRcpt = await publicClient.waitForTransactionReceipt({ hash: appTx, confirmations: 1 });
              if (appRcpt.status !== "success") {
                throw new Error("Project token approval reverted on-chain.");
              }
            }

            setStage("awaiting-signature");
            setStatusMessage("Splitting project tokens into Pass & Fail tokens...");
            const { request: splitReq } = await publicClient.simulateContract({
              abi: conditionalVaultAbi,
              address: market.vaultToken,
              functionName: "split",
              args: [splitNeeded, user],
              account: walletClient.account,
            });
            const splitTx = await walletClient.writeContract(splitReq as never);
            setStage("confirming");
            const splitRcpt = await publicClient.waitForTransactionReceipt({ hash: splitTx, confirmations: 1 });
            if (splitRcpt.status !== "success") {
              throw new Error("Conditional split reverted on-chain.");
            }
          }

          // Approve outcome base token to AMM
          const ammAllowance = (await publicClient.readContract({
            abi: erc20Abi,
            address: outcomeBaseToken,
            functionName: "allowance",
            args: [user, targetAmm],
          })) as bigint;

          if (ammAllowance < amount) {
            setStage("awaiting-signature");
            setStatusMessage(`Approving ${side} outcome tokens for AMM...`);
            const { request: appAmmReq } = await publicClient.simulateContract({
              abi: erc20Abi,
              address: outcomeBaseToken,
              functionName: "approve",
              args: [targetAmm, maxUint256],
              account: walletClient.account,
            });
            const appAmmTx = await walletClient.writeContract(appAmmReq as never);
            setStage("confirming");
            const appAmmRcpt = await publicClient.waitForTransactionReceipt({ hash: appAmmTx, confirmations: 1 });
            if (appAmmRcpt.status !== "success") {
              throw new Error("AMM token approval reverted on-chain.");
            }
          }

          // Calculate minimum output based on expected amount out and slippage
          const expectedOut = (await publicClient.readContract({
            abi: decisionAmmAbi,
            address: targetAmm,
            functionName: "getAmountOut",
            args: [false, amount],
          })) as bigint;
          const minQuoteOut = minOut ?? (expectedOut > 0n ? (expectedOut * (10000n - slipBps)) / 10000n : 1n);

          // Swap on AMM
          setStage("awaiting-signature");
          setStatusMessage(`Swapping ${side} outcome tokens on AMM...`);
          const { request: swapReq } = await publicClient.simulateContract({
            abi: decisionAmmAbi,
            address: targetAmm,
            functionName: "swapExactBaseForQuote",
            args: [amount, minQuoteOut, recipient, deadline],
            account: walletClient.account,
          });
          const swapTx = await walletClient.writeContract(swapReq as never);
          setTxHash(swapTx);
          setStage("confirming");
          const finalReceipt = await publicClient.waitForTransactionReceipt({ hash: swapTx, confirmations: 1 });
          setReceipt(finalReceipt);

          if (finalReceipt.status !== "success") {
            setStage("error");
            const msg = "Swap transaction reverted on-chain.";
            setError(msg);
            throw new Error(msg);
          }

          setStage("confirmed");
          setStatusMessage("Swap confirmed!");
          return finalReceipt;
        }
      } catch (err) {
        setStage("error");
        const msg = (err as Error).message || "Conditional swap failed.";
        setError(msg);
        throw err;
      }
    },
    [market, wallet.address, walletClient, publicClient],
  );

  return {
    swap,
    stage,
    statusMessage,
    txHash,
    receipt,
    error,
    reset,
  };
}

