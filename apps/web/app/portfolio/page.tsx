import { PortfolioPage } from "@/app/components/account-pages";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WolfDAO — Portfolio",
  description: "Read-only portfolio availability for WolfDAO on Avalanche Fuji.",
};

export default function PortfolioRoute() { return <PortfolioPage />; }
