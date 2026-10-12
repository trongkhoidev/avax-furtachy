"use client";

import { useCallback } from "react";
import { governorAbi } from "./abis";
import { useContractRead, useContractWrite } from "./hooks";

export enum ProposalState {
  None = 0,
  Pending = 1,
  Trading = 2,
  Finalizable = 3,
  Passed = 4,
  Failed = 5,
  Executed = 6,
  ExecutionFailed = 7,
  Cancelled = 8,
}

export interface ProposalAction {
  target: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
}

export type GovernorParams = readonly [number, number, number, number, number, number, number, number, bigint, bigint];

export function useGovernorParams(governorAddress: `0x${string}` | null) {
  const { data, isLoading, error, refetch } = useContractRead({
    abi: governorAbi,
    address: governorAddress,
    functionName: "params",
    enabled: Boolean(governorAddress),
  });

  return {
    params: data as GovernorParams | undefined,
    isLoading,
    error,
    refetch,
  };
}

export function useProposal(governorAddress: `0x${string}` | null, proposalId: bigint | null) {
  const { data, isLoading, error, refetch } = useContractRead({
    abi: governorAbi,
    address: governorAddress,
    functionName: "proposals",
    args: proposalId !== null ? [proposalId] : undefined,
    enabled: Boolean(governorAddress && proposalId !== null),
  });

  return {
    proposal: data,
    isLoading,
    error,
    refetch,
  };
}

export function useProposalMarket(governorAddress: `0x${string}` | null, proposalId: bigint | null) {
  const { data, isLoading, error, refetch } = useContractRead({
    abi: governorAbi,
    address: governorAddress,
    functionName: "getMarket",
    args: proposalId !== null ? [proposalId] : undefined,
    enabled: Boolean(governorAddress && proposalId !== null),
  });

  const tuple = data as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`] | undefined;
  const market = tuple
    ? {
        vaultUsdc: tuple[0],
        vaultToken: tuple[1],
        passAmm: tuple[2],
        failAmm: tuple[3],
      }
    : null;

  return {
    market,
    isLoading,
    error,
    refetch,
  };
}

export function usePropose(governorAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const propose = useCallback(
    async (
      actions: ProposalAction[],
      uri: string,
      hash: `0x${string}`,
      liqUsdc: bigint,
      maxLiqToken: bigint,
      targetAddress?: `0x${string}` | null,
    ) => {
      const target = targetAddress ?? governorAddress;
      if (!target) throw new Error("Governor contract address not provided.");
      return await write({
        abi: governorAbi,
        address: target,
        functionName: "propose",
        args: [actions, uri, hash, liqUsdc, maxLiqToken],
      });
    },
    [governorAddress, write],
  );

  return {
    propose,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}

export function useActivateProposal(governorAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const activate = useCallback(
    async (proposalId: bigint) => {
      if (!governorAddress) throw new Error("Governor contract address not provided.");
      return await write({
        abi: governorAbi,
        address: governorAddress,
        functionName: "activate",
        args: [proposalId],
      });
    },
    [governorAddress, write],
  );

  return {
    activate,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}

export function useFinalizeProposal(governorAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const finalize = useCallback(
    async (proposalId: bigint) => {
      if (!governorAddress) throw new Error("Governor contract address not provided.");
      return await write({
        abi: governorAbi,
        address: governorAddress,
        functionName: "finalize",
        args: [proposalId],
      });
    },
    [governorAddress, write],
  );

  return {
    finalize,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}

export function useExecuteProposal(governorAddress: `0x${string}` | null) {
  const { write, stage, txHash, receipt, error, reset } = useContractWrite();

  const execute = useCallback(
    async (proposalId: bigint) => {
      if (!governorAddress) throw new Error("Governor contract address not provided.");
      return await write({
        abi: governorAbi,
        address: governorAddress,
        functionName: "execute",
        args: [proposalId],
      });
    },
    [governorAddress, write],
  );

  return {
    execute,
    stage,
    txHash,
    receipt,
    error,
    reset,
  };
}
