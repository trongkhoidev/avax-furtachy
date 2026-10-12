"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, CircleAlert, ShieldCheck } from "lucide-react";
import { isAddress, parseUnits } from "viem";
import { useWallet } from "@/app/components/client-providers";
import { AmountField } from "@/app/components/interaction";
import { useAmmAmountOut, useAmmReserves, useConditionalMarketSwap } from "@/lib/contracts/market";
import { useFinalizeProposal, useProposalMarket } from "@/lib/contracts/governor";
import { parsePositiveBigInt } from "@/lib/projects";
import type { LiveProposal } from "@/lib/live-data";

const zeroAddress = "0x0000000000000000000000000000000000000000";

function displayPrice(raw: bigint) {
  const whole = raw / 10n ** 18n;
  const fraction = ((raw % 10n ** 18n) * 1_000n / 10n ** 18n).toString().padStart(3, "0");
  return `${whole}.${fraction}`;
}

function displayUnits(raw: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = ((raw % base) * 10_000n / base).toString().padStart(4, "0").replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}

export function ProposalExperience({ governor, proposalId }: { governor: string; proposalId: string }) {
  const wallet = useWallet();
  const govAddr = isAddress(governor) ? governor as `0x${string}` : null;
  const numericProposalId = parsePositiveBigInt(proposalId);
  const [side, setSide] = useState<"Pass" | "Fail">("Pass");
  const [order, setOrder] = useState<"Buy" | "Sell">("Buy");
  const [amount, setAmount] = useState("10");
  const [proposal, setProposal] = useState<LiveProposal | null>(null);
  const [indexerError, setIndexerError] = useState<string | null>(null);

  const { market, isLoading: marketLoading, error: marketError } = useProposalMarket(govAddr, numericProposalId);
  const verifiedMarket = Boolean(market && market.passAmm !== zeroAddress && market.failAmm !== zeroAddress && market.vaultUsdc !== zeroAddress && market.vaultToken !== zeroAddress);
  const targetAmm = verifiedMarket ? (side === "Pass" ? market!.passAmm : market!.failAmm) : null;
  const { reserveBase: passReserveBase, reserveQuote: passReserveQuote, spotPrice: passPrice } = useAmmReserves(verifiedMarket ? market!.passAmm : null);
  const { reserveBase: failReserveBase, reserveQuote: failReserveQuote, spotPrice: failPrice } = useAmmReserves(verifiedMarket ? market!.failAmm : null);

  let amountIn = 0n;
  try {
    amountIn = order === "Buy" ? parseUnits(amount || "0", 6) : parseUnits(amount || "0", 18);
  } catch { amountIn = 0n; }
  const quote = useAmmAmountOut(targetAmm, order === "Buy", amountIn);
  const { swap, stage: swapStage, statusMessage, txHash: swapHash, error: swapError } = useConditionalMarketSwap(verifiedMarket ? market : null);
  const { finalize, stage: finalizeStage, txHash: finalizeHash, error: finalizeError } = useFinalizeProposal(govAddr);

  useEffect(() => {
    if (!govAddr || numericProposalId === null) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    let active = true;
    void fetch(`${apiBase}/api/v1/proposals/${govAddr}/${numericProposalId.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "Proposal is not indexed yet." : "Fuji proposal index is unavailable.");
        return await response.json() as LiveProposal;
      })
      .then((data) => { if (active) { setProposal(data); setIndexerError(null); } })
      .catch((error: unknown) => { if (active) setIndexerError(error instanceof Error ? error.message : "Fuji proposal index is unavailable."); });
    return () => { active = false; };
  }, [govAddr, numericProposalId]);

  const validAmount = useMemo(() => amountIn > 0n, [amountIn]);
  const tradingHasEnded = Boolean(proposal?.state === "Trading" && proposal.tradingEnd && Number(proposal.tradingEnd) <= Math.floor(Date.now() / 1000));
  const isInvalidRoute = !govAddr || numericProposalId === null;
  const activePrice = side === "Pass" ? passPrice : failPrice;
  const activeReserve = side === "Pass" ? passReserveBase + passReserveQuote : failReserveBase + failReserveQuote;

  if (isInvalidRoute) return <main className="container page-wrap"><div className="panel panel-pad"><h1>Proposal unavailable</h1><p className="muted">Use a valid Governor address and a positive decimal proposal ID.</p><Link className="text-link" href="/">Back to markets <ArrowLeft size={14} /></Link></div></main>;

  return <main className="container page-wrap proposal-live-page">
    <div className="proposal-live-breadcrumb"><Link href="/">Markets</Link><span>/</span><span>{proposal?.projectName || `Project #${proposal?.projectId ?? "—"}`}</span><span>/</span><span>Proposal #{numericProposalId.toString()}</span></div>
    <header className="proposal-live-heading"><div><p className="exchange-kicker"><span className="exchange-live-dot" /> FUJI · CONDITIONAL MARKET</p><h1>{proposal?.title?.trim() || `Proposal #${numericProposalId.toString()}`}</h1><p>Governor <code>{governor}</code> · Avalanche Fuji · chain 43113</p></div><span className={`exchange-state state-${(proposal?.state || "pending").toLowerCase()}`}>{proposal?.state || (marketLoading ? "Loading" : "On-chain")}</span></header>

    {(marketError || indexerError) && <div className="warning-callout" style={{ margin: "16px 0" }}><CircleAlert size={15} /><span>{marketError || indexerError}</span></div>}
    <div className="proposal-live-grid">
      <section className="proposal-live-main">
        <div className="panel proposal-live-prices">
          <div className="proposal-live-panel-heading"><div><small>LIVE CONTRACT READ</small><h2>Conditional prices</h2></div><span>{verifiedMarket ? "Pools verified" : marketLoading ? "Checking pools" : "Pools unavailable"}</span></div>
          {verifiedMarket ? <div className="proposal-outcome-grid">
            <article className="proposal-outcome-row is-pass"><div><i /><span><strong>Pass</strong><small>If approved</small></span></div><strong>{displayPrice(passPrice)} <small>USDC / token</small></strong><span>Reserves {displayUnits(passReserveBase, 18)} / {displayUnits(passReserveQuote, 6)}</span></article>
            <article className="proposal-outcome-row is-fail"><div><i /><span><strong>Fail</strong><small>If rejected</small></span></div><strong>{displayPrice(failPrice)} <small>USDC / token</small></strong><span>Reserves {displayUnits(failReserveBase, 18)} / {displayUnits(failReserveQuote, 6)}</span></article>
          </div> : <div className="exchange-empty"><span className="exchange-empty-mark"><i /><i /></span><div><strong>{marketLoading ? "Reading the Governor" : "No conditional pools found"}</strong><p>Prices appear after this proposal's Pass and Fail AMMs are deployed and have on-chain observations.</p></div></div>}
          <div className="proposal-live-meta"><span><small>Proposal state</small><strong>{proposal?.state || "Not indexed"}</strong></span><span><small>Trading window</small><strong>{proposal?.tradingEnd ? new Date(Number(proposal.tradingEnd) * 1000).toLocaleString() : "Unavailable"}</strong></span><span><small>Final TWAP</small><strong>{proposal?.twapPassE18 && proposal.twapFailE18 ? "Recorded" : "Not finalized"}</strong></span></div>
        </div>

        <div className="panel proposal-live-contracts"><h2>Verified contracts</h2><div><span>Governor</span><a href={`https://testnet.snowtrace.io/address/${governor}`} target="_blank" rel="noreferrer">{governor}<ArrowUpRight size={13} /></a></div>{verifiedMarket && <><div><span>Pass AMM</span><a href={`https://testnet.snowtrace.io/address/${market!.passAmm}`} target="_blank" rel="noreferrer">{market!.passAmm}<ArrowUpRight size={13} /></a></div><div><span>Fail AMM</span><a href={`https://testnet.snowtrace.io/address/${market!.failAmm}`} target="_blank" rel="noreferrer">{market!.failAmm}<ArrowUpRight size={13} /></a></div></>}</div>

        {tradingHasEnded && wallet.status === "connected" && <button className="button button-outline" onClick={() => finalize(numericProposalId)} disabled={finalizeStage === "simulating" || finalizeStage === "awaiting-signature" || finalizeStage === "confirming"}>{finalizeStage === "confirming" ? "Confirming finalization…" : "Finalize proposal"}</button>}
        {finalizeHash && <p className="muted small">Finalization transaction <a href={`https://testnet.snowtrace.io/tx/${finalizeHash}`} target="_blank" rel="noreferrer">{finalizeHash.slice(0, 12)}…</a></p>}
        {finalizeError && <p className="field-error">{finalizeError}</p>}
      </section>

      <aside className="panel proposal-trade-card">
        <div className="proposal-trade-head"><div><small>FUJI ORDER</small><h2>Trade outcome</h2></div><span className={`exchange-state ${wallet.status === "connected" ? "state-trading" : ""}`}>{wallet.status === "connected" ? "Wallet connected" : "Connect wallet"}</span></div>
        <div className="side-toggle"><button onClick={() => setSide("Pass")} className={side === "Pass" ? "active pass" : ""}>Pass</button><button onClick={() => setSide("Fail")} className={side === "Fail" ? "active fail" : ""}>Fail</button></div>
        <div className="trade-tabs"><button onClick={() => setOrder("Buy")} className={order === "Buy" ? "active" : ""}>Buy</button><button onClick={() => setOrder("Sell")} className={order === "Sell" ? "active" : ""}>Sell</button></div>
        <AmountField label={order === "Buy" ? "Spend amount" : "Outcome tokens"} symbol={order === "Buy" ? "USDC" : "EDU"} value={amount} onChange={setAmount} />
        <div className="proposal-trade-quote"><span>Estimated receive</span><strong>{quote.isLoading ? "Reading quote…" : quote.amountOut > 0n ? `${displayUnits(quote.amountOut, order === "Buy" ? 18 : 6)} ${order === "Buy" ? `${side} EDU` : "USDC"}` : "—"}</strong></div>
        <div className="proposal-trade-facts"><span>Current price<strong>{verifiedMarket ? `${displayPrice(activePrice)} USDC` : "—"}</strong></span><span>Pool reserve<strong>{verifiedMarket ? displayUnits(activeReserve, 6) : "—"}</strong></span><span>Slippage limit<strong>0.50%</strong></span></div>
        {swapHash && <div className="success-callout"><ShieldCheck size={14} /> Confirmed on Fuji · <a href={`https://testnet.snowtrace.io/tx/${swapHash}`} target="_blank" rel="noreferrer">{swapHash.slice(0, 12)}…</a></div>}
        {swapError && <div className="warning-callout"><CircleAlert size={14} />{swapError}</div>}
        {statusMessage && swapStage !== "confirmed" && swapStage !== "idle" && <p className="proposal-trade-status">{statusMessage}</p>}
        {wallet.status === "wrong-network" ? <button className="button button-primary full-width" onClick={wallet.switchNetwork}>Switch to Avalanche Fuji</button>
          : wallet.status !== "connected" ? <button className="button button-primary full-width" onClick={wallet.connect}>Connect wallet</button>
          : !verifiedMarket ? <button className="button button-outline full-width" disabled>Market is not active</button>
          : proposal?.state !== "Trading" ? <button className="button button-outline full-width" disabled>Trading is not open</button>
          : <button className="button button-primary full-width" disabled={!validAmount || swapStage === "simulating" || swapStage === "awaiting-signature" || swapStage === "confirming"} onClick={() => swap({ side, order, amount: amountIn, recipient: wallet.address as `0x${string}`, deadline: BigInt(Math.floor(Date.now() / 1000) + 600), slippageBps: 50 })}>{swapStage === "simulating" ? "Checking transaction…" : swapStage === "awaiting-signature" ? "Confirm in wallet…" : swapStage === "confirming" ? "Waiting for Fuji…" : `${order} ${side}`}</button>}
        <p className="form-footnote"><ShieldCheck size={13} /> The app prepares conditional tokens, checks the call, then asks your wallet to sign each required transaction.</p>
      </aside>
    </div>
  </main>;
}
