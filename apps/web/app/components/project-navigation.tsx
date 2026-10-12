"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["Overview", ""], ["Raise", "raise"], ["Treasury", "treasury"], ["Proposals", "proposals"], ["Chains", "chains"],
];

export function ProjectNavigation({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  return <nav className="project-tabs" aria-label="Project sections">{items.map(([label, suffix]) => {
    const href = suffix ? `/p/${projectId}/${suffix}` : `/p/${projectId}`;
    const active = suffix ? pathname === href : pathname === `/p/${projectId}`;
    return <Link className={active ? "active" : ""} href={href} key={label} aria-current={active ? "page" : undefined}>{label}</Link>;
  })}</nav>;
}
