"use client";

import { useCallback } from "react";
import { raiseAbi, erc20Abi } from "./abis";
import { useContractRead, useContractWrite } from "./hooks";
import { useWallet } from "@/app/components/client-providers";

export enum RaiseState {
  Pending = 0,
  Active = 1,
  Failed = 2,
  Succeeded = 3,
  Finalized = 4,
}

export function useRaiseState(raiseAddress: `0x${string}` | null) {
  const { data: state, isLoading: stateLoading, error: stateError, refetch: refetchState } = useContractRead({
    abi: raiseAbi,
    address: raiseAddress,
    functionName: "state",
    enabled: Boolean(raiseAddress),
  });

  const { data: totalContributed, isLoading: totalLoading, error: totalError, refetch: refetchTotal } = useContractRead({
    abi: raiseAbi,
    address: raiseAddress,
    functionName: "totalContributed",
    enabled: Boolean(raiseAddress),
  });

  const { data: acceptedTotal, refetch: refetchAccepted } = useContractRead({
    abi: raiseAbi,
    address: raiseAddress,
    functionName: "acceptedTotal",
    enabled: Boolean(raiseAddress),
  });

  const refetch = useCallback(() => {
    refetchState();
    refetchTotal();
    refetchAccepted();
  }, [refetchState, refetchTotal, refetchAccepted]);

  return {
    state: (state as number | undefined) ?? RaiseState.Pending,
    totalContributed: (totalContributed as bigint | undefined) ?? 0n,
    acceptedTotal: (acceptedTotal as bigint | undefined) ?? 0n,
    isLoading: stateLoading || totalLoading,
    error: stateError || totalError,
    refetch,
  };
}

export function useUserContribution(
  raiseAddress: `0x${string}` | null,
  userAddress?: `0x${string}` | null,
) {
  const wallet = useWallet();
  const targetUser = userAddress ?? (wallet.address as `0x${string}` | null);

  const { data: contributed, isLoading: contributedLoading, refetch: refetchContributed } = useContractRead({
    abi: raiseAbi,
    address: raiseAddress,
    functionName: "contributed",
    args: targetUser ? [targetUser] : undefined,
    enabled: Boolean(raiseAddress && targetUser),
  });

  const { data: hasClaimed, refetch: refetchClaimed } = useContractRead({
    abi: raiseAbi,
    address: raiseAddress,
    functionName: "claimed",
    args: targetUser ? [targetUser] : undefined,
    enabled: Boolean(raiseAddress && targetUser),
  });

  const { data: previewClaimData, refetch: refetchPreview } = useContractRead({
    abi: raiseAbi,
    address: raiseAddress,
    functionName: "previewClaim",
    args: targetUser ? [targetUser] : undefined,
    enabled: Boolean(raiseAddress && targetUser),
  });

  const preview = previewClaimData as [bigint, bigint] | undefined;

  const refetch = useCallback(() => {
    refetchContributed();
    refetchClaimed();
    refetchPreview();
  }, [refetchContributed, refetchClaimed, refetchPreview]);

  return {
    contributed: (contributed as bigint | undefined) ?? 0n,
    hasClaimed: Boolean(hasClaimed),
    claimableTokens: preview ? preview[0] : 0n,
    refundUsdc: preview ? preview[1] : 0n,
    isLoading: contributedLoading,
    refetch,
  };
}

export function useContribute(raiseAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const contribute = useCallback(
    async (amount: bigint) => {
      if (!raiseAddress) throw new Error("Raise contract address not provided.");
      return await write({
        abi: raiseAbi,
        address: raiseAddress,
        functionName: "contribute",
        args: [amount],
      });
    },
    [raiseAddress, write],
  );

  return {
    contribute,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}

export function useClaimRaise(raiseAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const claim = useCallback(async () => {
    if (!raiseAddress) throw new Error("Raise contract address not provided.");
    return await write({
      abi: raiseAbi,
      address: raiseAddress,
      functionName: "claim",
    });
  }, [raiseAddress, write]);

  return {
    claim,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}

export function useRefundRaise(raiseAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const refund = useCallback(async () => {
    if (!raiseAddress) throw new Error("Raise contract address not provided.");
    return await write({
      abi: raiseAbi,
      address: raiseAddress,
      functionName: "refund",
    });
  }, [raiseAddress, write]);

  return {
    refund,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}

export function useFinalizeRaise(raiseAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const finalize = useCallback(async () => {
    if (!raiseAddress) throw new Error("Raise contract address not provided.");
    return await write({
      abi: raiseAbi,
      address: raiseAddress,
      functionName: "finalize",
    });
  }, [raiseAddress, write]);

  return {
    finalize,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}
