"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowLeftRight, ChevronDown, CircleAlert, LoaderCircle, Menu, WalletCards, X } from "lucide-react";
import { useWallet } from "@/app/components/client-providers";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { WalletBrandIcon } from "@/app/components/wallet-brand-icon";

const navigation = [
  { label: "Markets", href: "/", matches: (path: string) => path === "/" },
  { label: "Projects", href: "/explore", matches: (path: string) => path === "/explore" || path.startsWith("/p/") },
  { label: "Agents", href: "/agents", matches: (path: string) => path.startsWith("/agents") },
  { label: "Portfolio", href: "/portfolio", matches: (path: string) => path === "/portfolio" },
  { label: "Documentation", href: "/docs", matches: (path: string) => path === "/docs" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const wallet = useWallet();
  const chainLabel = wallet.targetChainId === 43113 ? "Avalanche Fuji" : wallet.targetChainId === 31337 ? "Anvil Local" : `Chain ${wallet.targetChainId}`;
  const shortAddress = wallet.address ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : null;
  const currentNetworkLabel = wallet.chainId === 84532 ? "Base Sepolia" : wallet.chainId ? `Chain ${wallet.chainId}` : "Unknown network";
  const isWrongNetwork = wallet.status === "wrong-network";
  const isConnected = wallet.status === "connected" && Boolean(shortAddress);

  const networkMark = <span className="wallet-header-network-mark" aria-hidden="true">
    {isWrongNetwork ? <CircleAlert size={16} /> : <svg viewBox="0 0 24 24"><path d="M12 2.5 22 20H2L12 2.5Zm0 5.1L6.5 17h11L12 7.6Z" /></svg>}
  </span>;

  const walletMark = wallet.selectedWalletId
    ? <WalletBrandIcon walletId={wallet.selectedWalletId} size={19} />
    : <WalletCards size={18} aria-hidden="true" />;

  return (
    <header className="site-header wolfdao-header">
      <div className="container nav-shell">
        <Link href="/" className="wolfdao-brand" aria-label="WolfDAO home" onClick={() => setMenuOpen(false)}>
          <span className="wolfdao-mark"><img src="/brand/wolfdao-logo.png" alt="" /></span>
          <span>WolfDAO</span>
        </Link>
        <button
          className="mobile-menu-button icon-button"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
        <nav id="main-navigation" className={`main-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
          {navigation.map(({ label, href, matches }) => {
            const active = matches(pathname);
            return <Link
              href={href}
              key={label}
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >{label}</Link>;
          })}
        </nav>
        <div className="wolfdao-header-tools">
          <ThemeToggle />
          <div className={`wallet-header-control${isWrongNetwork ? " is-wrong-network" : ""}${isConnected ? " is-connected" : ""}`} aria-label={isWrongNetwork ? `Wrong network: ${currentNetworkLabel}, chain ID ${wallet.chainId}; Avalanche Fuji required` : `${chainLabel} wallet controls`}>
            {isWrongNetwork ? <>
              <div className="wallet-header-network" title={`${currentNetworkLabel} · chain ${wallet.chainId}`}>
                {networkMark}
                <span className="wallet-header-network-copy"><small><span className="wallet-header-state-long">Wrong network</span><span className="wallet-header-state-short">Wrong</span></small><strong>{currentNetworkLabel}</strong></span>
                <code className="wallet-header-chain-id">{wallet.chainId}</code>
              </div>
              <button className="wallet-header-switch" type="button" onClick={() => void wallet.switchNetwork()} title={`Switch to ${chainLabel}`}>
                <span className="wallet-header-switch-long">Switch to Fuji</span><span className="wallet-header-switch-short">Switch</span><ArrowLeftRight size={14} aria-hidden="true" />
              </button>
              <button className="wallet-header-wallet" type="button" aria-label="Change wallet" title={`Change wallet${wallet.selectedWalletName ? ` · ${wallet.selectedWalletName}` : ""}`} onClick={wallet.openWalletPicker}>{walletMark}<ChevronDown size={12} aria-hidden="true" /></button>
            </> : isConnected ? <>
              <div className="wallet-header-network" title={`${chainLabel} · chain ${wallet.targetChainId}`}>
                {networkMark}
                <span className="wallet-header-network-copy"><small>NETWORK</small><strong>{chainLabel}</strong></span>
              </div>
              <button className="wallet-header-account" type="button" title={`Change wallet · ${wallet.address ?? ""}`} aria-label={`Connected wallet ${shortAddress}. Change wallet`} onClick={wallet.openWalletPicker}>{walletMark}<span>{shortAddress}</span><ChevronDown size={13} aria-hidden="true" /></button>
            </> : <>
              <div className="wallet-header-network" title={`${chainLabel} · chain ${wallet.targetChainId}`}>
                {networkMark}
                <span className="wallet-header-network-copy"><small>NETWORK</small><strong>{chainLabel}</strong></span>
              </div>
              {wallet.status === "checking"
                ? <span className="wallet-header-checking"><LoaderCircle size={15} />Checking…</span>
                : <button className="wallet-header-switch" type="button" aria-label={wallet.status === "unavailable" ? "Choose wallet" : "Connect wallet"} onClick={() => void wallet.connect()}>
                    <span className="wallet-header-connect-long">{wallet.status === "unavailable" ? "Choose wallet" : "Connect wallet"}</span>
                    <span className="wallet-header-connect-short">{wallet.status === "unavailable" ? "Choose" : "Connect"}</span>
                  </button>}
            </>}
            {wallet.error && <span className="wallet-header-error" role="status" title={wallet.error}>{wallet.error}</span>}
          </div>
        </div>
      </div>
    </header>
  );
}
