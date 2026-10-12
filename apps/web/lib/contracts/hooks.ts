/**
 * Generic contract interaction hooks.
 *
 * These hooks wrap viem's client creation around the EIP-1193 provider
 * exposed by `useWallet()`. They provide:
 *
 * - `usePublicClient` – read-only RPC client for `eth_call` / `getLogs`
 * - `useWalletClient` – signer-backed client for `eth_sendTransaction`
 * - `useContractRead` – typed read with loading / error state
 * - `useContractWrite` – simulate → sign → wait-for-receipt pipeline
 *
 * All write operations simulate first via `eth_call` to surface reverts
 * before the user is prompted to sign in their wallet.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Abi,
  type Account,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type PublicClient,
  type SimulateContractReturnType,
  type TransactionReceipt,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from "viem";
import { useWallet } from "@/app/components/client-providers";
import { chainConfig, targetChain } from "./addresses";

/* -------------------------------------------------------------------------- */
/*  usePublicClient                                                            */
/* -------------------------------------------------------------------------- */

/** Read-only RPC client (no wallet required). */
export function usePublicClient(): PublicClient {
  return useMemo(
    () =>
      createPublicClient({
        chain: targetChain,
        transport: http(chainConfig.rpcUrl),
      }),
    [],
  );
}

/* -------------------------------------------------------------------------- */
/*  useWalletClient                                                            */
/* -------------------------------------------------------------------------- */

/** Signer-backed wallet client, or `null` when the wallet is not connected to the target chain. */
export function useWalletClient(): WalletClient | null {
  const wallet = useWallet();

  return useMemo(() => {
    if (wallet.status !== "connected" || !wallet.provider) return null;
    return createWalletClient({
      account: wallet.address as `0x${string}`,
      chain: targetChain,
      transport: custom(wallet.provider),
    });
  }, [wallet.status, wallet.address, wallet.provider]);
}

/* -------------------------------------------------------------------------- */
/*  useContractRead                                                            */
/* -------------------------------------------------------------------------- */

export type ContractReadState<T> = {
  data: T | undefined;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Read a single view/pure function from a contract.
 *
 * Re-fetches when `args` or `address` change. Set `enabled: false` to skip.
 */
function serializeArgs(args: unknown): string {
  if (args === undefined) return "";
  try {
    return JSON.stringify(args, (_, v) => (typeof v === "bigint" ? v.toString() + "n" : v));
  } catch {
    return String(args);
  }
}

export function useContractRead<
  TAbi extends Abi,
  TFn extends ContractFunctionName<TAbi, "view" | "pure">,
>(options: {
  abi: TAbi;
  address: `0x${string}` | null;
  functionName: TFn;
  args?: ContractFunctionArgs<TAbi, "view" | "pure", TFn>;
  enabled?: boolean;
}): ContractReadState<unknown> {
  const { abi, address, functionName, args, enabled = true } = options;
  const publicClient = usePublicClient();
  const [data, setData] = useState<unknown>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const serializedArgs = serializeArgs(args);
  const stableArgsRef = useRef(args);
  const prevSerializedArgsRef = useRef(serializedArgs);

  if (prevSerializedArgsRef.current !== serializedArgs) {
    prevSerializedArgsRef.current = serializedArgs;
    stableArgsRef.current = args;
  }

  const fetch = useCallback(async () => {
    if (!address || !enabled) return;
    const currentArgs = stableArgsRef.current;
    const id = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await publicClient.readContract({
        abi,
        address,
        functionName: functionName as string,
        args: currentArgs as unknown[],
      } as never);
      if (id === fetchIdRef.current) setData(result);
    } catch (cause) {
      if (id === fetchIdRef.current) {
        setError(cause instanceof Error ? cause.message : "Contract read failed.");
      }
    } finally {
      if (id === fetchIdRef.current) setIsLoading(false);
    }
  }, [publicClient, abi, address, functionName, serializedArgs, enabled]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

/* -------------------------------------------------------------------------- */
/*  useContractWrite                                                           */
/* -------------------------------------------------------------------------- */

export type TxStage = "idle" | "simulating" | "awaiting-signature" | "confirming" | "confirmed" | "error";

export type ContractWriteState = {
  stage: TxStage;
  txHash: `0x${string}` | null;
  receipt: TransactionReceipt | null;
  error: string | null;
  reset: () => void;
};

type WriteOptions<
  TAbi extends Abi,
  TFn extends ContractFunctionName<TAbi, "nonpayable" | "payable">,
> = {
  abi: TAbi;
  address: `0x${string}`;
  functionName: TFn;
  args?: ContractFunctionArgs<TAbi, "nonpayable" | "payable", TFn>;
  value?: bigint;
};

/**
 * Returns a `write` function that runs the simulate → sign → confirm pipeline.
 *
 * Usage:
 * ```ts
 * const { write, stage, receipt, error, reset } = useContractWrite();
 * await write({ abi: raiseAbi, address, functionName: "contribute", args: [amount] });
 * ```
 */
export function useContractWrite(): ContractWriteState & {
  write: <TAbi extends Abi, TFn extends ContractFunctionName<TAbi, "nonpayable" | "payable">>(
    options: WriteOptions<TAbi, TFn>,
  ) => Promise<TransactionReceipt | null>;
} {
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const [stage, setStage] = useState<TxStage>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStage("idle");
    setTxHash(null);
    setReceipt(null);
    setError(null);
  }, []);

  const write = useCallback(
    async <TAbi extends Abi, TFn extends ContractFunctionName<TAbi, "nonpayable" | "payable">>(
      options: WriteOptions<TAbi, TFn>,
    ): Promise<TransactionReceipt | null> => {
      if (!walletClient) {
        setStage("error");
        setError("Wallet is not connected to the target network.");
        return null;
      }

      try {
        // 1. Simulate
        setStage("simulating");
        setError(null);
        setTxHash(null);
        setReceipt(null);

        const { request } = (await publicClient.simulateContract({
          abi: options.abi,
          address: options.address,
          functionName: options.functionName as string,
          args: options.args as unknown[],
          value: options.value,
          account: walletClient.account as Account,
        } as never)) as SimulateContractReturnType;

        // 2. Sign & send
        setStage("awaiting-signature");
        const hash = await walletClient.writeContract(request as never);
        setTxHash(hash);

        // 3. Wait for receipt
        setStage("confirming");
        const txReceipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

        if (txReceipt.status === "reverted") {
          setStage("error");
          setError("Transaction reverted on-chain.");
          setReceipt(txReceipt);
          return txReceipt;
        }

        setStage("confirmed");
        setReceipt(txReceipt);
        return txReceipt;
      } catch (cause) {
        setStage("error");
        const message =
          cause instanceof Error ? cause.message : "Transaction failed.";
        // Truncate very long revert messages
        setError(message.length > 300 ? message.slice(0, 300) + "…" : message);
        return null;
      }
    },
    [publicClient, walletClient],
  );

  return { write, stage, txHash, receipt, error, reset };
}
