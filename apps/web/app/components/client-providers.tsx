"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Wallet as WalletIcon, X } from "lucide-react";
import { WalletBrandIcon } from "./wallet-brand-icon";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  providers?: EthereumProvider[];
  isMetaMask?: boolean;
  isCore?: boolean;
  isCoreWallet?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isBitKeep?: boolean;
  isBitget?: boolean;
  isOKExWallet?: boolean;
  isOkxWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
};

type EIP6963ProviderDetail = {
  info: { name: string; rdns: string; uuid: string };
  provider: EthereumProvider;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type WalletStatus = "checking" | "unavailable" | "disconnected" | "connected" | "wrong-network";
type WalletChoice = { id: string; name: string; provider: EthereumProvider };
type WalletContextValue = {
  status: WalletStatus;
  address: string | null;
  chainId: number | null;
  targetChainId: number;
  providerAvailable: boolean;
  selectedWalletId: string | null;
  selectedWalletName: string | null;
  wallets: Array<{ id: string; name: string; installed: boolean }>;
  provider: EthereumProvider | null;
  error: string | null;
  pickerOpen: boolean;
  openWalletPicker: () => void;
  closeWalletPicker: () => void;
  connect: () => Promise<void>;
  connectWallet: (walletId: string) => Promise<boolean>;
  switchNetwork: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);
const targetChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "43113");

const walletCatalog = [
  { id: "core", name: "Core", detail: "Avalanche official wallet" },
  { id: "metamask", name: "MetaMask", detail: "Browser & mobile Web3 wallet" },
  { id: "trust", name: "Trust Wallet", detail: "Multi-chain Web3 wallet" },
  { id: "bitget", name: "Bitget Wallet", detail: "Web3 wallet" },
  { id: "okx", name: "OKX Wallet", detail: "Web3 wallet" },
  { id: "other", name: "Browser Wallet", detail: "Any injected EIP-1193 wallet" },
];

function identifyWallet(name: string, rdns: string, provider: EthereumProvider): string {
  const identity = `${name} ${rdns}`.toLowerCase();
  // Check Core first as Core sets isMetaMask for legacy compatibility
  if (identity.includes("core") || identity.includes("avax") || provider.isCore || provider.isCoreWallet) return "core";
  if (identity.includes("trust") || provider.isTrust || provider.isTrustWallet) return "trust";
  if (identity.includes("bitget") || identity.includes("bitkeep") || provider.isBitget || provider.isBitKeep) return "bitget";
  if (identity.includes("okx") || identity.includes("okex") || provider.isOKExWallet || provider.isOkxWallet) return "okx";
  if (identity.includes("metamask") || provider.isMetaMask) return "metamask";
  return "other";
}

function parseChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    if (/^0x[0-9a-f]+$/i.test(value)) {
      const parsed = Number.parseInt(value, 16);
      return Number.isSafeInteger(parsed) ? parsed : null;
    }
    const dec = Number.parseInt(value, 10);
    if (Number.isSafeInteger(dec)) return dec;
  }
  return null;
}

async function walletReadRequest(provider: EthereumProvider, method: string) {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("Wallet provider request timed out.")), 10_000);
  });
  try {
    return await Promise.race([provider.request({ method }), timeout]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

function chainParameters() {
  if (targetChainId === 31337) {
    return {
      chainId: "0x7a69",
      chainName: "Anvil Local",
      nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
      rpcUrls: [process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545"],
    };
  }
  return {
    chainId: `0x${targetChainId.toString(16)}`,
    chainName: targetChainId === 43113 ? "Avalanche Fuji C-Chain" : `Chain ${targetChainId}`,
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    rpcUrls: [process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc"],
    blockExplorerUrls: targetChainId === 43113 ? ["https://testnet.snowtrace.io/"] : undefined,
  };
}

function describeError(error: unknown) {
  if (error && typeof error === "object") {
    if ("code" in error && error.code === 4001) return "Connection request was rejected in wallet.";
    if ("message" in error && typeof error.message === "string") return error.message;
  }
  return "Wallet request failed. Check your wallet extension and try again.";
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("checking");
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletChoices, setWalletChoices] = useState<WalletChoice[]>([]);
  const [activeProvider, setActiveProvider] = useState<EthereumProvider | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const providerMap = useRef(new Map<string, EthereumProvider>());
  const activeProviderRef = useRef<EthereumProvider | null>(null);

  const activateProvider = useCallback((walletId: string, provider: EthereumProvider) => {
    activeProviderRef.current = provider;
    setActiveProvider(provider);
    setSelectedWalletId(walletId);
  }, []);

  const syncWallet = useCallback(async (provider: EthereumProvider) => {
    try {
      const [accounts, chainValue] = await Promise.all([
        walletReadRequest(provider, "eth_accounts"),
        walletReadRequest(provider, "eth_chainId"),
      ]);
      const account = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
      const currentChain = parseChainId(chainValue);
      setAddress(account);
      setChainId(currentChain);
      setStatus(!account ? "disconnected" : currentChain === targetChainId ? "connected" : "wrong-network");
    } catch {
      setStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    let preferredWalletId: string | null = null;
    try { preferredWalletId = window.localStorage.getItem("wolfdao-wallet-provider"); } catch { /* ignore */ }

    const registerProvider = (name: string, rdns: string, provider: EthereumProvider) => {
      const id = identifyWallet(name, rdns, provider);
      providerMap.current.set(id, provider);
      // Also register as other/fallback
      if (!providerMap.current.has("other")) {
        providerMap.current.set("other", provider);
      }
      const walletName = walletCatalog.find((entry) => entry.id === id)?.name ?? name;
      setWalletChoices(Array.from(providerMap.current, ([walletId, walletProvider]) => ({
        id: walletId,
        name: walletCatalog.find((entry) => entry.id === walletId)?.name ?? walletName,
        provider: walletProvider,
      })));
      if (!activeProviderRef.current || id === preferredWalletId) activateProvider(id, provider);
    };

    const onAnnounceProvider = (event: Event) => {
      const detail = (event as CustomEvent<EIP6963ProviderDetail>).detail;
      if (detail?.provider && detail.info) registerProvider(detail.info.name, detail.info.rdns, detail.provider);
    };

    window.addEventListener("eip6963:announceProvider", onAnnounceProvider);
    const injected = window.ethereum;
    if (injected) {
      const providers = injected.providers?.length ? injected.providers : [injected];
      for (const provider of providers) registerProvider("", "", provider);
    }
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", onAnnounceProvider);
  }, [activateProvider]);

  useEffect(() => {
    if (!activeProvider) {
      if (typeof window !== "undefined" && window.ethereum) {
        setStatus("disconnected");
      } else {
        setStatus(walletChoices.length ? "disconnected" : "unavailable");
      }
      setAddress(null);
      setChainId(null);
      return;
    }

    let mounted = true;
    const refresh = () => {
      void syncWallet(activeProvider).catch(() => {
        if (!mounted) return;
        setStatus("disconnected");
      });
    };
    const onAccountsChanged = (accounts: unknown) => {
      if (Array.isArray(accounts) && accounts.length > 0 && typeof accounts[0] === "string") {
        setAddress(accounts[0]);
      } else {
        setAddress(null);
      }
      refresh();
      setError(null);
    };
    const onChainChanged = (newChain: unknown) => {
      const parsed = parseChainId(newChain);
      if (parsed) setChainId(parsed);
      refresh();
      setError(null);
    };
    activeProvider.on?.("accountsChanged", onAccountsChanged as (...args: unknown[]) => void);
    activeProvider.on?.("chainChanged", onChainChanged as (...args: unknown[]) => void);
    refresh();
    return () => {
      mounted = false;
      activeProvider.removeListener?.("accountsChanged", onAccountsChanged as (...args: unknown[]) => void);
      activeProvider.removeListener?.("chainChanged", onChainChanged as (...args: unknown[]) => void);
    };
  }, [activeProvider, syncWallet, walletChoices.length]);

  const connectWallet = useCallback(async (walletId: string) => {
    let provider = providerMap.current.get(walletId);
    if (!provider && typeof window !== "undefined" && window.ethereum) {
      provider = window.ethereum;
    }
    if (!provider) {
      setError(`${walletCatalog.find((entry) => entry.id === walletId)?.name ?? "Wallet"} was not detected. Please install an extension (Core, MetaMask) or open in a dApp browser.`);
      return false;
    }

    activateProvider(walletId, provider);
    setError(null);
    setStatus("checking");
    try {
      const result = await provider.request({ method: "eth_requestAccounts" });
      const accounts = Array.isArray(result) ? (result as string[]) : [];
      if (accounts[0]) setAddress(accounts[0]);
      await syncWallet(provider);
      try { window.localStorage.setItem("wolfdao-wallet-provider", walletId); } catch { /* ignore */ }
      setPickerOpen(false);
      return true;
    } catch (cause) {
      await syncWallet(provider).catch(() => {
        setStatus("disconnected");
        setAddress(null);
      });
      setError(describeError(cause));
      return false;
    }
  }, [activateProvider, syncWallet]);

  const openWalletPicker = useCallback(() => setPickerOpen(true), []);
  const closeWalletPicker = useCallback(() => setPickerOpen(false), []);
  
  const connect = useCallback(async () => {
    // If a provider is already active or window.ethereum is ready, connect directly
    const directProvider = activeProviderRef.current ?? (typeof window !== "undefined" ? window.ethereum : null);
    if (directProvider) {
      setError(null);
      try {
        const result = await directProvider.request({ method: "eth_requestAccounts" });
        const accounts = Array.isArray(result) ? (result as string[]) : [];
        if (accounts[0]) setAddress(accounts[0]);
        await syncWallet(directProvider);
        return;
      } catch (err) {
        if (describeError(err) !== "Connection request was rejected in wallet.") {
          openWalletPicker();
          return;
        }
        setError(describeError(err));
        return;
      }
    }
    openWalletPicker();
  }, [openWalletPicker, syncWallet]);

  const switchNetwork = useCallback(async () => {
    const provider = activeProviderRef.current ?? (typeof window !== "undefined" ? window.ethereum : null);
    if (!provider) {
      setPickerOpen(true);
      return;
    }
    setError(null);
    const chain = chainParameters();
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain.chainId }] });
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? (cause as { code: number }).code : undefined;
      if (code === 4902 || String(cause).includes("4902") || String(cause).includes("Unrecognized chain")) {
        try {
          await provider.request({ method: "wallet_addEthereumChain", params: [chain] });
          await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain.chainId }] });
        } catch (addCause) {
          setError(describeError(addCause));
          return;
        }
      } else {
        setError(describeError(cause));
        return;
      }
    }
    await syncWallet(provider).catch((cause) => setError(describeError(cause)));
  }, [syncWallet]);

  const wallets = useMemo(() => {
    const hasInjected = typeof window !== "undefined" && Boolean(window.ethereum);
    return walletCatalog.map(({ id, name }) => {
      const isSpecificInstalled = walletChoices.some((choice) => choice.id === id);
      const installed = isSpecificInstalled || (hasInjected && (id === "other" || id === "metamask" || id === "core"));
      return { id, name, installed };
    });
  }, [walletChoices]);

  const selectedWalletName = walletCatalog.find((wallet) => wallet.id === selectedWalletId)?.name
    ?? walletChoices.find((wallet) => wallet.id === selectedWalletId)?.name
    ?? null;

  const value = useMemo(() => ({
    status,
    address,
    chainId,
    targetChainId,
    providerAvailable: walletChoices.length > 0 || (typeof window !== "undefined" && Boolean(window.ethereum)),
    selectedWalletId,
    selectedWalletName,
    wallets,
    provider: activeProvider,
    error,
    pickerOpen,
    openWalletPicker,
    closeWalletPicker,
    connect,
    connectWallet,
    switchNetwork,
  }), [status, address, chainId, selectedWalletId, selectedWalletName, wallets, activeProvider, error, pickerOpen, openWalletPicker, closeWalletPicker, connect, connectWallet, switchNetwork]);

  return <WalletContext.Provider value={value}>
    {children}
    <WalletPicker />
  </WalletContext.Provider>;
}

function WalletPicker() {
  const wallet = useWallet();
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet.pickerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") wallet.closeWalletPicker(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [wallet.pickerOpen, wallet.closeWalletPicker]);

  if (!wallet.pickerOpen) return null;

  const chooseWallet = async (walletId: string) => {
    setConnectingId(walletId);
    await wallet.connectWallet(walletId);
    setConnectingId(null);
  };

  return <div className="wallet-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) wallet.closeWalletPicker(); }}>
    <section className="wallet-picker" role="dialog" aria-modal="true" aria-labelledby="wallet-picker-title">
      <div className="wallet-picker-heading"><span className="wallet-picker-icon"><WalletIcon size={17} /></span><button type="button" className="wallet-picker-close" aria-label="Close wallet selection" onClick={wallet.closeWalletPicker}><X size={18} /></button><p>CONNECT TO WOLFDAO</p><h2 id="wallet-picker-title">Choose a wallet</h2><span>Use an EVM wallet connected to Avalanche Fuji C-Chain.</span></div>
      <div className="wallet-picker-list">
        {wallet.wallets.map((option) => {
          const catalogEntry = walletCatalog.find((entry) => entry.id === option.id);
          const isActive = wallet.selectedWalletId === option.id && wallet.status === "connected";
          const isConnecting = connectingId === option.id;
          return <div className={`wallet-picker-row ${option.installed ? "is-installed" : ""}`} key={option.id}>
            <span className="wallet-picker-brand"><WalletBrandIcon walletId={option.id} size={22} /></span>
            <span className="wallet-picker-copy"><strong>{option.name}</strong><small>{catalogEntry?.detail ?? "Compatible browser wallet"}</small></span>
            {option.installed
              ? <button className="wallet-picker-action" type="button" onClick={() => void chooseWallet(option.id)} disabled={Boolean(connectingId)}>{isActive ? <><Check size={14} /> Connected</> : isConnecting ? "Connecting…" : <>Connect <ArrowRight size={13} /></>}</button>
              : <button className="wallet-picker-action button-quiet" type="button" onClick={() => void chooseWallet(option.id)}>{isConnecting ? "Connecting…" : "Try connect"}</button>}
          </div>;
        })}
      </div>
      <p className="wallet-picker-note">Choose your wallet extension or open WolfDAO inside a mobile Web3 dApp browser. Approve the prompt in your wallet.</p>
      <p className="wallet-picker-chain">Target: Avalanche Fuji C-Chain (Chain ID <b>43113</b>)</p>
      {wallet.error && <p className="wallet-picker-error" role="alert">{wallet.error}</p>}
    </section>
  </div>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside ClientProviders");
  return value;
}
