import { Wallet } from "lucide-react";

type WalletBrandIconProps = {
  walletId: string;
  size?: number;
};

export function WalletBrandIcon({ walletId, size = 22 }: WalletBrandIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    className: `wallet-brand-svg wallet-brand-${walletId}`,
    "aria-hidden": true as const,
    focusable: false as const,
  };

  switch (walletId) {
    case "core":
      return <svg {...common}><path fill="#E84142" fillRule="evenodd" d="M16 2.7 30 27H2L16 2.7Zm0 7.1L9.1 22h13.8L16 9.8Z" /><path fill="#fff" d="M10.6 19.1h10.8l-1.7 3H12.3l-1.7-3Z" /></svg>;
    case "metamask":
      return <svg {...common}>
        <path fill="#E27625" d="m4.1 8.1 7.4 1.6 4.5-4.1 4.5 4.1 7.4-1.6 2 6.5-4.3 8.6-9.6 5.2-9.6-5.2-4.3-8.6 2-6.5Z" />
        <path fill="#F6851B" d="m4.1 8.1 7.4 1.6 4.5 8.6-8.1 2.2-5.8-5.9 2-6.5Zm23.8 0-7.4 1.6-4.5 8.6 8.1 2.2 5.8-5.9-2-6.5Z" />
        <path fill="#CD6116" d="m7.9 20.5 8.1-2.2 8.1 2.2-2.4 5-5.7 2.9-5.7-2.9-2.4-5Z" />
        <path fill="#F8D7B5" d="m11.5 13.1 4.5 5.2-7.6 2.2 3.1-7.4Zm9 0-4.5 5.2 7.6 2.2-3.1-7.4Z" />
        <path fill="#763D16" d="m12.5 22.1 3.5-1.8 3.5 1.8-3.5 2.1-3.5-2.1Z" />
      </svg>;
    case "trust":
      return <svg {...common}>
        <path fill="#3375BB" d="M16 2.5 28 7v8.2c0 7.1-4.9 12-12 14.3C8.9 27.2 4 22.3 4 15.2V7l12-4.5Z" />
        <path fill="#fff" d="m16 7 6.2 6.1-6.2 3.1-6.2-3.1L16 7Zm-7.6 8.1 6.1 3.1-4.1 3.1-2-6.2Zm15.2 0-2 6.2-4.1-3.1 6.1-3.1ZM12 23l4-3 4 3-4 2.3-4-2.3Z" />
      </svg>;
    case "bitget":
      return <svg {...common}>
        <path fill="#00BDA5" d="M5.5 5h13.3a7.2 7.2 0 0 1 5.6 11.7A7.2 7.2 0 0 1 19 27H5.5v-6.3h13.2a1.1 1.1 0 1 0 0-2.2h-8.4v-6.1h8.4a1.1 1.1 0 1 0 0-2.2H5.5V5Z" />
        <path fill="#75E2D3" d="M5.5 10.9h6v10h-6z" />
      </svg>;
    case "okx":
      return <svg {...common} fill="currentColor">
        <path d="M5 5h7v7H5zM20 5h7v7h-7zM5 20h7v7H5zM20 20h7v7h-7zM12.5 12.5h7v7h-7z" />
      </svg>;
    default:
      return <Wallet size={size} strokeWidth={1.8} aria-hidden="true" />;
  }
}
