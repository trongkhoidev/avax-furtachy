import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Check, Clock3, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";

export function PageIntro({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="intro-copy">{description}</p>}</div>{action && <div className="intro-action">{action}</div>}</div>;
}

export function SectionHeading({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return <div className="section-heading"><h2>{title}</h2>{aside}</div>;
}

export function ButtonLink({ href, children, variant = "primary", size = "md" }: { href: string; children: React.ReactNode; variant?: "primary" | "dark" | "outline" | "quiet"; size?: "sm" | "md" }) {
  return <Link className={`button button-${variant} button-${size}`} href={href}>{children}</Link>;
}

export function StatusChip({ state }: { state: string }) {
  const normalized = state.toLowerCase().replaceAll(" ", "-");
  const pass = ["passed", "executed", "live", "active"].includes(normalized);
  const fail = ["failed", "execution-failed"].includes(normalized);
  return <span className={`status-chip ${pass ? "status-pass" : fail ? "status-fail" : "status-neutral"}`}>{state}</span>;
}

export function OutcomeBadge({ pass, margin }: { pass: boolean; margin?: string }) {
  return <span className={`outcome ${pass ? "outcome-pass" : "outcome-fail"}`}>{pass ? "▲ Pass" : "▼ Fail"}{margin && <small>{margin}</small>}</span>;
}

export function Stat({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "pass" | "agent" }) {
  return <div className={`stat ${tone ? `stat-${tone}` : ""}`}><span>{label}</span><strong className="tabular">{value}</strong>{detail && <small>{detail}</small>}</div>;
}

export function AddressChip({ address }: { address: string }) {
  return <span className="address-chip" title={address}>{address}<button aria-label={`Copy ${address}`} onClick={() => navigator.clipboard?.writeText(address)}>Copy</button></span>;
}

export function EmptyState({ title, description, href, action }: { title: string; description: string; href?: string; action?: string }) {
  return <div className="empty-state"><div className="empty-icon"><ShieldCheck size={20} /></div><h3>{title}</h3><p>{description}</p>{href && <Link className="text-link" href={href}>{action ?? "Explore projects"}<ArrowUpRight size={14} /></Link>}</div>;
}

export function Countdown({ label }: { label: string }) {
  return <span className="countdown"><Clock3 size={13} />{label}</span>;
}

export function ActivityIcon({ positive = true }: { positive?: boolean }) {
  return <span className={`activity-icon ${positive ? "activity-up" : "activity-down"}`}>{positive ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}</span>;
}

export function AgentMark({ children = "Agent" }: { children?: React.ReactNode }) {
  return <span className="agent-mark"><Sparkles size={12} />{children}</span>;
}

export function VerifiedLabel() {
  return <span className="verified-label"><Check size={13} /> Content verified</span>;
}

export function ExternalLinkText({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="external-link" href={href} target="_blank" rel="noreferrer">{children}<ExternalLink size={13} /></a>;
}
