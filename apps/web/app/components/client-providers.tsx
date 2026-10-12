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
  { id: "core", name: "Core", detail: "Avalanche wallet" },
  { id: "metamask", name: "MetaMask", detail: "Browser and mobile wallet" },
  { id: "trust", name: "Trust Wallet", detail: "Browser and mobile wallet" },
  { id: "bitget", name: "Bitget Wallet", detail: "Web3 wallet" },
  { id: "okx", name: "OKX Wallet", detail: "Web3 wallet" },
  { id: "other", name: "Other EVM wallet", detail: "Any compatible EIP-1193 wallet" },
];

function identifyWallet(name: string, rdns: string, provider: EthereumProvider): string {
  const identity = `${name} ${rdns}`.toLowerCase();
  if (identity.includes("metamask") || provider.isMetaMask) return "metamask";
  if (identity.includes("trust") || provider.isTrust || provider.isTrustWallet) return "trust";
  if (identity.includes("bitget") || identity.includes("bitkeep") || provider.isBitget || provider.isBitKeep) return "bitget";
  if (identity.includes("okx") || identity.includes("okex") || provider.isOKExWallet || provider.isOkxWallet) return "okx";
  if (identity.includes("core") || identity.includes("avax") || provider.isCore || provider.isCoreWallet) return "core";
  return "other";
}

function parseChainId(value: unknown): number | null {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) return null;
  const parsed = Number.parseInt(value, 16);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function walletReadRequest(provider: EthereumProvider, method: string) {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("Wallet provider did not respond.")), 3_500);
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
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Wallet request failed. Check your wallet and try again.";
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
    const [accounts, chainValue] = await Promise.all([
      walletReadRequest(provider, "eth_accounts"),
      walletReadRequest(provider, "eth_chainId"),
    ]);
    const account = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
    const currentChain = parseChainId(chainValue);
    setAddress(account);
    setChainId(currentChain);
    setStatus(!account ? "disconnected" : currentChain === targetChainId ? "connected" : "wrong-network");
  }, []);

  useEffect(() => {
    let preferredWalletId: string | null = null;
    try { preferredWalletId = window.localStorage.getItem("wolfdao-wallet-provider"); } catch { /* optional preference */ }

    const registerProvider = (name: string, rdns: string, provider: EthereumProvider) => {
      const id = identifyWallet(name, rdns, provider);
      const previous = providerMap.current.get(id);
      if (previous === provider) return;
      if (previous && id === "other") return;
      providerMap.current.set(id, provider);
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
      setStatus(walletChoices.length ? "disconnected" : "unavailable");
      setAddress(null);
      setChainId(null);
      return;
    }

    let mounted = true;
    const refresh = () => {
      void syncWallet(activeProvider).catch(() => {
        if (!mounted) return;
        setStatus("disconnected");
        setError("Wallet is available but did not return its account and network state.");
      });
    };
    const onAccountsChanged = () => { refresh(); setError(null); };
    const onChainChanged = () => { refresh(); setError(null); };
    activeProvider.on?.("accountsChanged", onAccountsChanged);
    activeProvider.on?.("chainChanged", onChainChanged);
    refresh();
    return () => {
      mounted = false;
      activeProvider.removeListener?.("accountsChanged", onAccountsChanged);
      activeProvider.removeListener?.("chainChanged", onChainChanged);
    };
  }, [activeProvider, syncWallet, walletChoices.length]);

  const connectWallet = useCallback(async (walletId: string) => {
    const provider = providerMap.current.get(walletId);
    if (!provider) {
      setError(`${walletCatalog.find((entry) => entry.id === walletId)?.name ?? "Wallet"} was not detected. Install it or open WolfDAO in its dApp browser, then refresh.`);
      return false;
    }

    activateProvider(walletId, provider);
    setError(null);
    setStatus("checking");
    try {
      await provider.request({ method: "eth_requestAccounts" });
      await syncWallet(provider);
      try { window.localStorage.setItem("wolfdao-wallet-provider", walletId); } catch { /* selection remains active for this session */ }
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
  const connect = useCallback(async () => { openWalletPicker(); }, [openWalletPicker]);

  const switchNetwork = useCallback(async () => {
    const provider = activeProviderRef.current;
    if (!provider) {
      setPickerOpen(true);
      return;
    }
    setError(null);
    const chain = chainParameters();
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain.chainId }] });
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? cause.code : undefined;
      if (code !== 4902) {
        setError(describeError(cause));
        return;
      }
      try {
        await provider.request({ method: "wallet_addEthereumChain", params: [chain] });
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain.chainId }] });
      } catch (addCause) {
        setError(describeError(addCause));
        return;
      }
    }
    await syncWallet(provider).catch((cause) => setError(describeError(cause)));
  }, [openWalletPicker, syncWallet]);

  const wallets = useMemo(() => walletCatalog.map(({ id, name }) => ({ id, name, installed: walletChoices.some((choice) => choice.id === id) })), [walletChoices]);
  const selectedWalletName = walletCatalog.find((wallet) => wallet.id === selectedWalletId)?.name
    ?? walletChoices.find((wallet) => wallet.id === selectedWalletId)?.name
    ?? null;
  const value = useMemo(() => ({
    status,
    address,
    chainId,
    targetChainId,
    providerAvailable: walletChoices.length > 0,
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
      <div className="wallet-picker-heading"><span className="wallet-picker-icon"><WalletIcon size={17} /></span><button type="button" className="wallet-picker-close" aria-label="Close wallet selection" onClick={wallet.closeWalletPicker}><X size={18} /></button><p>CONNECT TO WOLFDAO</p><h2 id="wallet-picker-title">Choose a wallet</h2><span>Use an EVM wallet connected to Avalanche C-Chain.</span></div>
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
              : <span className="wallet-picker-unavailable">Not detected</span>}
          </div>;
        })}
      </div>
      <p className="wallet-picker-note">Install a wallet extension or open WolfDAO in its mobile dApp browser, then refresh this page. Wallet prompts are approved in your wallet app.</p>
      <p className="wallet-picker-chain">Avalanche Fuji C-Chain <b>43113</b></p>
      {wallet.error && <p className="wallet-picker-error" role="alert">{wallet.error}</p>}
    </section>
  </div>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside ClientProviders");
  return value;
}
