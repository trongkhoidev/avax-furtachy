"use client";

import { useCallback } from "react";
import { erc20Abi } from "./abis";
import { useContractRead, useContractWrite } from "./hooks";
import { useWallet } from "@/app/components/client-providers";

export function useTokenBalance(
  tokenAddress: `0x${string}` | null,
  account?: `0x${string}` | null,
) {
  const wallet = useWallet();
  const targetAccount = account ?? (wallet.address as `0x${string}` | null);

  const { data, isLoading, error, refetch } = useContractRead({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: "balanceOf",
    args: targetAccount ? [targetAccount] : undefined,
    enabled: Boolean(tokenAddress && targetAccount),
  });

  return {
    balance: (data as bigint) ?? 0n,
    isLoading,
    error,
    refetch,
  };
}

export function useAllowance(
  tokenAddress: `0x${string}` | null,
  spender: `0x${string}` | null,
  owner?: `0x${string}` | null,
) {
  const wallet = useWallet();
  const targetOwner = owner ?? (wallet.address as `0x${string}` | null);

  const { data, isLoading, error, refetch } = useContractRead({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: "allowance",
    args: targetOwner && spender ? [targetOwner, spender] : undefined,
    enabled: Boolean(tokenAddress && targetOwner && spender),
  });

  return {
    allowance: (data as bigint) ?? 0n,
    isLoading,
    error,
    refetch,
  };
}

export function useApprove() {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const approve = useCallback(
    async (
      tokenAddress: `0x${string}`,
      spender: `0x${string}`,
      amount: bigint,
    ) => {
      return await write({
        abi: erc20Abi,
        address: tokenAddress,
        functionName: "approve",
        args: [spender, amount],
      });
    },
    [write],
  );

  return {
    approve,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}
