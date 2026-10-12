"use client";

import { useState } from "react";
import { CircleAlert, ShieldCheck } from "lucide-react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { useWallet } from "@/app/components/client-providers";
import { buildTimeAddresses } from "@/lib/contracts/addresses";
import { RaiseState, useClaimRaise, useContribute, useRefundRaise, useRaiseState, useUserContribution } from "@/lib/contracts/raise";
import { useAllowance, useApprove } from "@/lib/contracts/erc20";

const stages = new Set(["simulating", "awaiting-signature", "confirming"]);

export function ProjectRaiseActions({ raiseAddress, projectName }: { raiseAddress: `0x${string}`; projectName: string }) {
  const wallet = useWallet();
  const [amount, setAmount] = useState("");
  const usdc = buildTimeAddresses.usdc;
  const { state, totalContributed, isLoading, error: readError, refetch: refetchRaise } = useRaiseState(raiseAddress);
  const { contributed, hasClaimed, claimableTokens, refetch: refetchContribution } = useUserContribution(raiseAddress);
  const { allowance, refetch: refetchAllowance } = useAllowance(usdc, raiseAddress);
  const approveFlow = useApprove();
  const contributeFlow = useContribute(raiseAddress);
  const claimFlow = useClaimRaise(raiseAddress);
  const refundFlow = useRefundRaise(raiseAddress);
  let amountRaw = 0n;
  try { amountRaw = amount.trim() ? parseUnits(amount, 6) : 0n; } catch { amountRaw = 0n; }
  const busy = [approveFlow.stage, contributeFlow.stage, claimFlow.stage, refundFlow.stage].some((stage) => stages.has(stage));
  const refresh = () => { refetchRaise(); refetchContribution(); refetchAllowance(); };
  const error = readError || approveFlow.error || contributeFlow.error || claimFlow.error || refundFlow.error;

  const primaryAction = () => {
    if (wallet.status === "wrong-network") return <button className="button button-primary full-width" onClick={wallet.switchNetwork}>Switch to Avalanche Fuji</button>;
    if (wallet.status !== "connected") return <button className="button button-primary full-width" onClick={wallet.connect}>Connect wallet</button>;
    if (!usdc) return <button className="button button-outline full-width" disabled>USDC address is not configured</button>;
    if (readError || isLoading) return <button className="button button-outline full-width" disabled>{isLoading ? "Reading Fuji state…" : "Raise state unavailable"}</button>;

    if (state === RaiseState.Active && amountRaw > 0n) {
      if (allowance < amountRaw) return <button className="button button-primary full-width" onClick={async () => { await approveFlow.approve(usdc, raiseAddress, maxUint256); refetchAllowance(); }} disabled={busy}>{approveFlow.stage === "awaiting-signature" ? "Approve in wallet…" : approveFlow.stage === "confirming" ? "Confirming approval…" : approveFlow.stage === "simulating" ? "Checking approval…" : "Approve USDC"}</button>;
      return <button className="button button-primary full-width" onClick={async () => { await contributeFlow.contribute(amountRaw); refresh(); }} disabled={busy}>{contributeFlow.stage === "awaiting-signature" ? "Confirm in wallet…" : contributeFlow.stage === "confirming" ? "Waiting for Fuji…" : contributeFlow.stage === "simulating" ? "Checking contribution…" : `Contribute ${amount} USDC`}</button>;
    }

    if ((state === RaiseState.Succeeded || state === RaiseState.Finalized) && contributed > 0n && !hasClaimed) return <button className="button button-primary full-width" onClick={async () => { await claimFlow.claim(); refresh(); }} disabled={busy}>{claimFlow.stage === "awaiting-signature" ? "Confirm in wallet…" : claimFlow.stage === "confirming" ? "Waiting for Fuji…" : "Claim tokens and refund"}</button>;
    if (state === RaiseState.Failed && contributed > 0n && !hasClaimed) return <button className="button button-primary full-width" onClick={async () => { await refundFlow.refund(); refresh(); }} disabled={busy}>{refundFlow.stage === "awaiting-signature" ? "Confirm in wallet…" : refundFlow.stage === "confirming" ? "Waiting for Fuji…" : "Refund USDC"}</button>;
    return <button className="button button-outline full-width" disabled>{state === RaiseState.Active ? "Enter an amount to contribute" : hasClaimed ? "Claim completed" : "No available action"}</button>;
  };

  return <section className="panel proposal-trade-card project-raise-actions">
    <div className="proposal-trade-head"><div><small>FUJI RAISE CONTRACT</small><h2>Participate in {projectName}</h2></div><span className={`exchange-state ${state === RaiseState.Active ? "state-trading" : ""}`}>{isLoading ? "Reading" : readError ? "Unavailable" : ["Pending", "Active", "Failed", "Succeeded", "Finalized"][state] ?? "Unknown"}</span></div>
    <label className="field"><span>Contribution · USDC</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" aria-describedby="raise-action-note" /></label>
    {amount && amountRaw === 0n && <small className="field-error">Enter a positive amount with up to six decimal places.</small>}
    <div className="proposal-trade-quote"><span>Total raised on-chain</span><strong>{isLoading || readError ? "Unavailable" : `${formatUnits(totalContributed, 6)} USDC`}</strong></div>
    {wallet.status === "connected" && <div className="proposal-trade-quote"><span>Your contribution</span><strong>{formatUnits(contributed, 6)} USDC</strong></div>}
    {claimableTokens > 0n && !hasClaimed && <div className="proposal-trade-quote"><span>Claimable tokens</span><strong>{formatUnits(claimableTokens, 18)}</strong></div>}
    {error && <div className="warning-callout"><CircleAlert size={14} /><span>{error}</span></div>}
    {primaryAction()}
    <p id="raise-action-note" className="form-footnote"><ShieldCheck size={13} /> Contribution, claim, and refund actions are sent to the verified Fuji Raise contract.</p>
  </section>;
}
