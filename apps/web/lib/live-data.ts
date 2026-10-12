export type LiveProject = {
  id: string;
  founder: string;
  raise: string;
  token: string | null;
  treasury: string | null;
  governor: string | null;
  spotAmm: string | null;
  name: string | null;
  symbol: string | null;
  state: string;
  minRaise: string;
  hardCap: string;
  totalContributed: string;
  acceptedTotal: string;
  metadataURI: string;
  createdAt: string;
};

export type LiveProposal = {
  id: string;
  projectId: string;
  projectName: string | null;
  projectSymbol: string | null;
  governor: string;
  proposer: string;
  title: string | null;
  descriptionURI: string;
  state: string;
  outcome: string | null;
  createdAt: string;
  tradingStart: string | null;
  tradingEnd: string | null;
  executionDeadline: string | null;
  passAmm: string;
  failAmm: string;
  passSpotE18: string | null;
  failSpotE18: string | null;
  twapPassE18: string | null;
  twapFailE18: string | null;
};

const apiBase = process.env.FUTARA_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiBase}${path}`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

export async function getLiveProjects() {
  return apiGet<{ items: LiveProject[]; total: number; available: boolean; reason?: string }>("/api/v1/projects");
}

export async function getLiveMarkets() {
  return apiGet<{ items: LiveProposal[]; available: boolean; reason?: string }>("/api/v1/markets");
}

export async function getProjectProposals(projectId: string) {
  return apiGet<{ items: LiveProposal[]; available: boolean; reason?: string }>(`/api/v1/projects/${encodeURIComponent(projectId)}/proposals`);
}

export function formatTokenAmount(raw: string | null | undefined, decimals = 6, maximumFractionDigits = 2) {
  if (!raw || !/^\d+$/.test(raw)) return "—";
  const amount = Number(raw) / 10 ** decimals;
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(amount);
}

export function compactAddress(address: string | null | undefined) {
  if (!address) return "Not deployed";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
