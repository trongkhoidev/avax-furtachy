"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Info, ShieldCheck } from "lucide-react";
import { AllocationDonut } from "@/app/components/charts";
import { PageIntro } from "@/app/components/ui";
import { useWallet } from "@/app/components/client-providers";
import { useCreateProject, useCreateProposal, useGovernorParams } from "@/lib/contracts";
import { formatUnits } from "viem";

const projectSteps = ["Basics", "Token & allocation", "Raise", "Governance", "Review & launch"];
const proposalSteps = ["Describe", "Action", "Bond & liquidity", "Review"];


function isOptionalWebUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function StepRail({ steps, current }: { steps: string[]; current: number }) {
  return <aside className="panel wizard-steps">{steps.map((step, index) => <div key={step} className={`wizard-step ${index === current ? "active" : index < current ? "done" : ""}`}><span className="step-num">{index < current ? <Check size={12} /> : index + 1}</span><span>{step}</span></div>)}</aside>;
}

function PreviewCard({ name, symbol, tagline, amount }: { name: string; symbol: string; tagline: string; amount: string }) {
  return <aside className="panel wizard-preview"><span className="muted small">Configuration preview</span><div className="project-glyph">{(symbol || "FT").slice(0, 2)}</div><h3>{name || "Your project"} <span className="muted">{symbol || "TOKEN"}</span></h3><p>{tagline || "Project details will appear here."}</p><div className="divider" style={{ margin: "15px 0 5px" }} /><div className="preview-stat"><span>Hard cap</span><strong>${Number(amount || 0).toLocaleString()}</strong></div><div className="preview-stat"><span>Network</span><strong>Avalanche Fuji · 43113</strong></div><div className="preview-stat"><span>Factory</span><strong>Fuji environment</strong></div><span className="verified-label" style={{ marginTop: 13 }}><ShieldCheck size={13} /> Pass/Fail governance</span></aside>;
}

export function ProjectWizard() {
  const wallet = useWallet();
  const {
    createProject,
    stage: createStage,
    txHash: createTxHash,
    error: createError,
    createdProjectId,
    isConfigured: isFactoryConfigured,
  } = useCreateProject();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [github, setGithub] = useState("");
  const [minRaise, setMinRaise] = useState("50000");
  const [hardCap, setHardCap] = useState("200000");
  const [supply, setSupply] = useState("10000000");
  const [allocation, setAllocation] = useState([50, 15, 20, 15]);
  const [liquidityUsdcPercent, setLiquidityUsdcPercent] = useState("20");
  const [preset, setPreset] = useState("Standard");
  const [tradingPeriodSeconds, setTradingPeriodSeconds] = useState("259200");
  const [thresholdBps, setThresholdBps] = useState("300");
  const [twapDelaySeconds, setTwapDelaySeconds] = useState("86400");
  const [minimumLiquidity, setMinimumLiquidity] = useState("50000");
  const [monthlyBudget, setMonthlyBudget] = useState("5000");
  const [operatorWallet, setOperatorWallet] = useState("");
  const allocationItems = ["Sale", "Liquidity", "Treasury", "Founder"];
  function changeAllocation(index: number, raw: number) {
    const next = [...allocation];
    const peers = allocation.map((_, itemIndex) => itemIndex).filter((itemIndex) => itemIndex !== index);
    const remaining = 100 - raw;
    const peerTotal = peers.reduce((sum, itemIndex) => sum + allocation[itemIndex], 0);
    let assigned = 0;
    next[index] = raw;
    peers.forEach((itemIndex, peerIndex) => {
      const amount = peerIndex === peers.length - 1
        ? remaining - assigned
        : peerTotal > 0 ? Math.floor(remaining * allocation[itemIndex] / peerTotal) : Math.floor(remaining / peers.length);
      next[itemIndex] = amount;
      assigned += amount;
    });
    setAllocation(next);
  }
  const validBasics = name.trim().length >= 2 && /^[A-Z0-9]{2,8}$/.test(symbol) && tagline.trim().length >= 8 && isOptionalWebUrl(website) && isOptionalWebUrl(github);
  const allocationTotal = allocation.reduce((sum, item) => sum + item, 0);
  const validSupply = Number.isSafeInteger(Number(supply)) && Number(supply) > 0;
  const saleTokens = Number(supply || 0) * allocation[0] / 100;
  const liquidityTokens = Number(supply || 0) * allocation[1] / 100;
  const minimumPrice = saleTokens > 0 ? Number(minRaise) / saleTokens : 0;
  const capPrice = saleTokens > 0 ? Number(hardCap) / saleTokens : 0;
  const poolUsdcAtCap = Number(hardCap || 0) * Number(liquidityUsdcPercent || 0) / 100;
  const poolPriceAtCap = liquidityTokens > 0 ? poolUsdcAtCap / liquidityTokens : 0;
  const validAllocation = allocationTotal === 100 && allocation[0] > 0 && allocation[1] > 0;
  const validRaise = Number.isFinite(Number(minRaise)) && Number(minRaise) > 0 && Number.isFinite(Number(hardCap)) && Number(hardCap) >= Number(minRaise);
  const liquidityShare = Number(liquidityUsdcPercent);
  const validLiquidityShare = Number.isFinite(liquidityShare) && liquidityShare > 0 && liquidityShare <= 50;
  const poolPreflightPasses = validAllocation && validRaise && validLiquidityShare && poolPriceAtCap >= capPrice;
  const validOperatorWallet = !operatorWallet || /^0x[a-fA-F0-9]{40}$/.test(operatorWallet);
  const validGovernance = [tradingPeriodSeconds, thresholdBps, twapDelaySeconds, minimumLiquidity, monthlyBudget].every((value) => value.trim() !== "" && Number.isFinite(Number(value))) && Number.isInteger(Number(tradingPeriodSeconds)) && Number(tradingPeriodSeconds) > 0 && Number.isInteger(Number(thresholdBps)) && Number(thresholdBps) > 0 && Number(thresholdBps) <= 2_000 && Number.isInteger(Number(twapDelaySeconds)) && Number(twapDelaySeconds) >= 0 && Number(tradingPeriodSeconds) > Number(twapDelaySeconds) && Number(minimumLiquidity) > 0 && Number(monthlyBudget) >= 0 && validOperatorWallet;
  const formatSeconds = (raw: string) => {
    const seconds = Number(raw);
    if (!Number.isFinite(seconds)) return "Invalid";
    if (seconds === 0) return "0 seconds";
    if (seconds % 86_400 === 0) {
      const days = seconds / 86_400;
      return `${days} day${days === 1 ? "" : "s"}`;
    }
    if (seconds % 3_600 === 0) {
      const hours = seconds / 3_600;
      return `${hours} hour${hours === 1 ? "" : "s"}`;
    }
    if (seconds % 60 === 0) {
      const minutes = seconds / 60;
      return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  };
  return <div className="container page-wrap"><PageIntro eyebrow="AVALANCHE FUJI · PROJECT FACTORY" title="Create a project" description="Configure your project and submit its creation transaction to the Fuji Factory." />
    <div className="wizard-layout"><StepRail steps={projectSteps} current={step} /><section className="panel wizard-form">
      {step === 0 && <><h2>Project basics</h2><p>Tell backers what you are building and why it matters.</p><div className="field"><label htmlFor="project-name">Project name</label><input id="project-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" /></div><div className="field"><label htmlFor="project-symbol">Token symbol</label><input id="project-symbol" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} maxLength={8} /></div><div className="field"><label htmlFor="project-tagline">Tagline</label><input id="project-tagline" value={tagline} onChange={(event) => setTagline(event.target.value)} maxLength={100} /></div><div className="field"><label htmlFor="project-description">Project description</label><textarea id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} /><small className="muted">This text is committed as project metadata on Fuji.</small></div><div className="split-columns"><div className="field"><label htmlFor="project-website">Website</label><input id="project-website" type="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://example.com" />{!isOptionalWebUrl(website) && <small className="field-error">Enter a valid HTTP or HTTPS URL, or leave this blank.</small>}</div><div className="field"><label htmlFor="project-github">GitHub</label><input id="project-github" type="url" value={github} onChange={(event) => setGithub(event.target.value)} placeholder="https://github.com/..." />{!isOptionalWebUrl(github) && <small className="field-error">Enter a valid HTTP or HTTPS URL, or leave this blank.</small>}</div></div><div className="field"><label>Project logo</label><button className="upload-field" type="button" disabled title="Metadata storage is not configured">Logo upload unavailable <span>Storage not configured</span></button></div></>}
      {step === 1 && <><h2>Token and allocation</h2><p>Set a proposed supply and draft its allocation across sale, liquidity, treasury, and founders.</p><div className="field"><label htmlFor="total-supply">Proposed total supply</label><input id="total-supply" type="number" min="1" step="1" value={supply} onChange={(event) => setSupply(event.target.value)} /><small className="muted">Draft value only. No token contract or mint authority is configured.</small>{!validSupply && <small className="field-error">Supply must be a positive whole number.</small>}</div><div className="allocation-layout"><div>{allocationItems.map((item, index) => <div className="allocation-row" key={item}><span>{item}</span><input aria-label={`${item} allocation`} type="range" min="0" max="100" value={allocation[index]} onChange={(event) => changeAllocation(index, Number(event.target.value))} /><strong>{allocation[index]}%</strong></div>)}<div className="allocation-total"><span>Total allocation</span><strong>{allocationTotal}%</strong></div></div><AllocationDonut allocation={allocation} supply={supply} symbol={symbol} /></div>{!validAllocation && <small className="field-error">Sale and liquidity allocations must both be greater than zero.</small>}<div className="warning-callout"><Info size={15} /> Draft allocation: {allocation[0]}% sale · {allocation[1]}% liquidity · {allocation[2]}% treasury · {allocation[3]}% founders.</div><div className="split-columns price-estimates"><div className="summary-box"><small>Illustrative sale price at minimum</small><strong>${minimumPrice.toFixed(4)} / {symbol}</strong></div><div className="summary-box"><small>Illustrative sale price at hard cap</small><strong>${capPrice.toFixed(4)} / {symbol}</strong></div></div></>}
      {step === 2 && <><h2>Raise terms</h2><p>Configure the minimum raise, hard cap, and initial liquidity allocation.</p><div className="split-columns"><div className="field"><label htmlFor="min-raise">Minimum raise · USDC</label><input id="min-raise" type="number" min="1" value={minRaise} onChange={(event) => setMinRaise(event.target.value)} /><small className="muted">Draft specification.</small></div><div className="field"><label htmlFor="hard-cap">Hard cap · USDC</label><input id="hard-cap" type="number" min="1" value={hardCap} onChange={(event) => setHardCap(event.target.value)} />{!validRaise && <small className="field-error">Enter positive values and keep the cap at or above the minimum.</small>}</div></div><div className="summary-box"><small>Documented raise durations</small><strong>3 days · configured raise window</strong></div><div className="field" style={{ marginTop: 16 }}><label htmlFor="liquidity-usdc-percent">USDC allocated to initial liquidity</label><input id="liquidity-usdc-percent" type="number" min="1" max="50" value={liquidityUsdcPercent} onChange={(event) => setLiquidityUsdcPercent(event.target.value)} /><small className="muted">Percent of the accepted raise · draft configuration, maximum 50%.</small>{!validLiquidityShare && <small className="field-error">Enter a value from 1% to 50%.</small>}</div><div className="split-columns price-estimates"><div className="summary-box"><small>Draft raise price at hard cap</small><strong>${capPrice.toFixed(4)} / {symbol}</strong></div><div className="summary-box"><small>Initial liquidity seed price</small><strong>${poolPriceAtCap.toFixed(4)} / {symbol}</strong></div></div>{poolPreflightPasses ? <div className="success-callout"><Check size={15} /> The initial liquidity seed price meets the factory’s minimum-price rule. The deployed contract will validate this configuration.</div> : <div className="warning-callout"><CircleAlert size={15} /> The factory would reject this configuration: the seed price (${poolPriceAtCap.toFixed(4)} / {symbol}) must meet or exceed the raise price (${capPrice.toFixed(4)} / {symbol}). Increase the liquidity share or adjust the token allocation.</div>}</>}
      {step === 3 && <><h2>Governance parameters</h2><p>These parameters are submitted to the Fuji Factory and enforced by the deployed project contracts.</p><div className="preset-row">{["Standard", "Custom"].map((item) => <button type="button" key={item} className={`preset-card ${preset === item ? "active" : ""}`} onClick={() => { setPreset(item); if (item === "Standard") { setTradingPeriodSeconds("259200"); setThresholdBps("300"); setTwapDelaySeconds("86400"); setMinimumLiquidity("50000"); } }}><strong>{item}</strong><small>{item === "Standard" ? "3-day market · 3% threshold" : "Edit each parameter"}</small></button>)}</div>{preset === "Custom" && <div className="split-columns custom-fields"><div className="field"><label htmlFor="trading-period">Trading period · seconds</label><input id="trading-period" type="number" min="1" value={tradingPeriodSeconds} onChange={(event) => setTradingPeriodSeconds(event.target.value)} /></div><div className="field"><label htmlFor="threshold-bps">Pass threshold · basis points</label><input id="threshold-bps" type="number" min="1" max="2000" value={thresholdBps} onChange={(event) => setThresholdBps(event.target.value)} /></div><div className="field"><label htmlFor="twap-delay">TWAP delay · seconds</label><input id="twap-delay" type="number" min="0" value={twapDelaySeconds} onChange={(event) => setTwapDelaySeconds(event.target.value)} /></div><div className="field"><label htmlFor="minimum-liquidity">Minimum market liquidity · USDC</label><input id="minimum-liquidity" type="number" min="1" value={minimumLiquidity} onChange={(event) => setMinimumLiquidity(event.target.value)} /></div></div>}{!validGovernance && <small className="field-error">The threshold must be 1–2,000 bps, and the market window must exceed the TWAP delay. Other values must be valid and positive.</small>}<div className="field" style={{ marginTop: 18 }}><label htmlFor="monthly-budget">Operating budget · USDC per 30 days</label><input id="monthly-budget" type="number" min="0" value={monthlyBudget} onChange={(event) => setMonthlyBudget(event.target.value)} /><small className="muted">Draft policy amount. No operator or claim permission is configured.</small></div><div className="field"><label htmlFor="operator-wallet">Operator wallet · optional</label><input id="operator-wallet" value={operatorWallet} onChange={(event) => setOperatorWallet(event.target.value)} placeholder="Not configured" />{!validOperatorWallet && <small className="field-error">Enter a valid 20-byte address or leave it blank.</small>}</div></>}
      {step === 4 && <><h2>Review draft configuration & launch</h2><p>{createStage === "confirmed" ? "Your project raise is now registered on Avalanche Fuji. Token and governance contracts deploy after the raise is finalized." : isFactoryConfigured ? "Review the deployment terms below and submit the transaction to create the project." : "Review draft values. Note: factory contract address is not set in the current environment."}</p><div className="review-grid"><div className="review-row"><span>Project</span><strong>{name} ({symbol})</strong></div><div className="review-row"><span>Tagline</span><strong>{tagline}</strong></div><div className="review-row"><span>Description</span><strong>{description.trim() || "Not provided"}</strong></div><div className="review-row"><span>Website</span><strong>{website.trim() || "Not provided"}</strong></div><div className="review-row"><span>GitHub</span><strong>{github.trim() || "Not provided"}</strong></div><div className="review-row"><span>Draft raise</span><strong>${Number(minRaise).toLocaleString()}–${Number(hardCap).toLocaleString()} USDC</strong></div><div className="review-row"><span>Proposed supply</span><strong>{Number(supply).toLocaleString()} {symbol}</strong></div><div className="review-row"><span>Draft allocation</span><strong>{allocation[0]}% sale · {allocation[1]}% liquidity · {allocation[2]}% treasury · {allocation[3]}% founders</strong></div><div className="review-row"><span>Governance preset</span><strong>{preset}</strong></div><div className="review-row"><span>Market window / threshold</span><strong>{formatSeconds(tradingPeriodSeconds)} · {Number(thresholdBps) / 100}%</strong></div><div className="review-row"><span>TWAP delay / minimum liquidity</span><strong>{formatSeconds(twapDelaySeconds)} · ${Number(minimumLiquidity).toLocaleString()} USDC</strong></div><div className="review-row"><span>Operating policy</span><strong>${Number(monthlyBudget).toLocaleString()} USDC / 30 days</strong></div><div className="review-row"><span>Operator wallet</span><strong>{operatorWallet || wallet.address || "Defaults to deployer"}</strong></div><div className="review-row"><span>Initial liquidity price rule</span><strong>${poolPriceAtCap.toFixed(4)} / {symbol} vs. ${capPrice.toFixed(4)} raise price</strong></div></div>{!poolPreflightPasses && <div className="warning-callout"><CircleAlert size={15} /> The factory rejects a seed price below the raise price; correct the liquidity ratio before deployment.</div>}{createStage === "confirmed" && <div className="success-callout"><Check size={15} /><span>Project created successfully! {createTxHash && <>Tx: <a href={`https://testnet.snowtrace.io/tx/${createTxHash}`} target="_blank" rel="noreferrer" className="mono" style={{ textDecoration: "underline" }}>{createTxHash.slice(0, 10)}...{createTxHash.slice(-8)}</a></>}{createdProjectId && <> · Project #{createdProjectId.toString()}</>}</span></div>}{createError && <div className="warning-callout"><CircleAlert size={15} /> {createError}</div>}<div className="stepper"><div className={`stepper-line ${createStage !== "idle" ? "active" : ""}`}><span className="stepper-dot">1</span><span>Prepare project metadata</span><small>{createStage === "confirmed" || createStage === "confirming" || createStage === "awaiting-signature" ? "Generated & hashed" : isFactoryConfigured ? "Ready" : "Factory unconfigured"}</small></div><div className={`stepper-line ${createStage === "awaiting-signature" || createStage === "confirming" ? "active" : createStage === "confirmed" ? "done" : ""}`}><span className="stepper-dot">2</span><span>Sign createProject transaction</span><small>{createStage === "simulating" ? "Checking transaction..." : createStage === "awaiting-signature" ? "Awaiting wallet signature..." : createStage === "confirming" ? "Waiting for confirmation..." : createStage === "confirmed" ? "Confirmed on-chain" : wallet.status === "connected" ? "Ready to sign" : "Wallet disconnected"}</small></div><div className={`stepper-line ${createStage === "confirmed" ? "done" : ""}`}><span className="stepper-dot">3</span><span>Open the project</span><small>{createStage === "confirmed" ? "Live on-chain" : "After deployment"}</small></div></div></>}
      <div className="wizard-footer"><button className="button button-quiet" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || createStage === "simulating" || createStage === "awaiting-signature" || createStage === "confirming"}><ArrowLeft size={14} /> Back</button>{step < 4 ? <button className="button button-primary" onClick={() => setStep(Math.min(4, step + 1))} disabled={(step === 0 && !validBasics) || (step === 1 && (!validSupply || !validAllocation)) || (step === 2 && (!validRaise || !validLiquidityShare || !poolPreflightPasses)) || (step === 3 && !validGovernance)}>Continue <ArrowRight size={14} /></button> : createStage === "confirmed" ? <Link href={createdProjectId ? `/p/${createdProjectId.toString()}` : "/raise"} className="button button-primary">{createdProjectId ? `View Project #${createdProjectId.toString()}` : "View Raise"} <ArrowRight size={14} /></Link> : !isFactoryConfigured ? <button className="button button-outline" disabled title="Set NEXT_PUBLIC_FACTORY_ADDRESS in environment">Factory unconfigured</button> : wallet.status === "wrong-network" ? <button className="button button-primary" onClick={wallet.switchNetwork}>Switch to Fuji</button> : wallet.status !== "connected" ? <button className="button button-primary" onClick={wallet.connect}>Connect wallet to deploy</button> : <button className="button button-primary" onClick={async () => { try { await createProject({ name, symbol, tagline, description, website, github, supply, allocation: allocation as [number, number, number, number], minRaise, hardCap, liquidityUsdcPercent, tradingPeriodSeconds, thresholdBps, twapDelaySeconds, minimumLiquidity, monthlyBudget, operatorWallet }); } catch {} }} disabled={!poolPreflightPasses || createStage === "simulating" || createStage === "awaiting-signature" || createStage === "confirming"}>{createStage === "simulating" ? "Checking transaction..." : createStage === "awaiting-signature" ? "Sign in wallet..." : createStage === "confirming" ? "Confirming tx..." : "Create raise on Fuji"}</button>}</div>{step === 4 && !isFactoryConfigured && <small id="deployment-unavailable-reason" className="muted">Disabled · factory contract is not configured. Set NEXT_PUBLIC_FACTORY_ADDRESS to enable on-chain deployment.</small>}
    </section><PreviewCard name={name} symbol={symbol} tagline={tagline} amount={hardCap} /></div>
    <p className="form-footnote page-footnote"><ShieldCheck size={13} /> Project metadata is hashed and included in the Fuji Factory transaction.</p>
  </div>;
}

export function ProposalWizard({ projectId, governorAddress, projectName, tokenSymbol }: { projectId: string; governorAddress: `0x${string}`; projectName: string; tokenSymbol: string }) {
  const wallet = useWallet();
  const {
    createProposal,
    stage: proposalStage,
    txHash: proposalTxHash,
    error: proposalError,
    createdProposalId,
    statusMessage,
    isGovernorConfigured,
  } = useCreateProposal(governorAddress);
  const { params, isLoading: paramsLoading, error: paramsError } = useGovernorParams(governorAddress);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Spending");
  const [actionType, setActionType] = useState("Transfer USDC");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [calldata, setCalldata] = useState("");
  const [initialLiquidity, setInitialLiquidity] = useState("");
  const minLiquidity = params ? params[9] : null;
  const proposalBond = params ? params[8] : null;
  const minLiquidityDisplay = minLiquidity === null ? null : formatUnits(minLiquidity, 6);
  const bondDisplay = proposalBond === null ? null : formatUnits(proposalBond, 18);
  const isTransfer = actionType === "Transfer USDC";
  const validTitle = title.trim().length >= 3;
  const validRecipient = /^0x[a-fA-F0-9]{40}$/.test(recipient.trim());
  const validAmount = isTransfer
    ? /^(0|[1-9]\d*)(\.\d{1,6})?$/.test(amount.trim()) && Number(amount) > 0
    : amount.trim() === "" || (/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(amount.trim()) && Number(amount) >= 0);
  const validCalldata = /^0x(?:[a-fA-F0-9]{2})*$/.test(calldata.trim());
  const validAction = validRecipient && validAmount && (isTransfer || validCalldata);
  const liquidityValue = Number(initialLiquidity);
  const validLiquidity = Boolean(minLiquidityDisplay) && Number.isFinite(liquidityValue) && liquidityValue >= Number(minLiquidityDisplay) && liquidityValue > 0;
  const actionSummary = isTransfer
    ? `Transfer ${amount || "—"} USDC to ${recipient ? `${recipient.slice(0, 8)}…${recipient.slice(-5)}` : "recipient not set"}`
    : `Call ${recipient ? `${recipient.slice(0, 8)}…${recipient.slice(-5)}` : "target not set"}${amount ? ` with ${amount} AVAX` : ""}`;
  const busy = ["simulating", "awaiting-signature", "confirming"].includes(proposalStage) || Boolean(statusMessage);

  return <div className="container page-wrap"><PageIntro eyebrow={`FUJI · ${projectName} · GOVERNANCE`} title="Create a proposal" description="Choose the action the project treasury should execute if this proposal passes. The configured Governor will create both conditional markets on-chain." action={<Link className="text-link" href={`/p/${projectId}/proposals`}><ArrowLeft size={13} /> Back to proposals</Link>} />
    <div className="wizard-layout proposal-wizard-layout"><StepRail steps={proposalSteps} current={step} /><section className="panel wizard-form">
      {step === 0 && <><h2>Describe the decision</h2><p>Write a concise decision and include the context voters need to evaluate it.</p><div className="field"><label htmlFor="proposal-title">Proposal title</label><input id="proposal-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="What should the treasury do?" />{title && !validTitle && <small className="field-error">Use at least 3 characters.</small>}</div><div className="field"><label htmlFor="proposal-summary">Summary</label><textarea id="proposal-summary" value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={280} placeholder="Summarize the expected effect." /></div><div className="field"><label htmlFor="proposal-category">Category</label><select id="proposal-category" value={category} onChange={(event) => setCategory(event.target.value)}><option>Spending</option><option>Parameter</option><option>Operations</option><option>Other</option></select></div><div className="field"><label htmlFor="proposal-body">Details and rationale</label><textarea id="proposal-body" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Describe the rationale, risks, and relevant constraints." /></div></>}
      {step === 1 && <><h2>Configure the treasury action</h2><p>The Governor stores this action and the Treasury executes it only after a passing outcome.</p><div className="field"><label htmlFor="action-type">Action</label><select id="action-type" value={actionType} onChange={(event) => { setActionType(event.target.value); setAmount(""); }}><option>Transfer USDC</option><option>Advanced calldata</option></select></div><div className="field"><label htmlFor="action-recipient">{isTransfer ? "USDC recipient" : "Target contract"}</label><input id="action-recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="0x…" />{recipient && !validRecipient && <small className="field-error">Enter a valid 20-byte address.</small>}</div>{isTransfer ? <div className="field"><label htmlFor="action-amount">Amount · USDC</label><input id="action-amount" type="number" min="0" step="0.000001" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div> : <><div className="field"><label htmlFor="action-calldata">Calldata</label><textarea id="action-calldata" value={calldata} onChange={(event) => setCalldata(event.target.value)} maxLength={8194} placeholder="0x" />{calldata && !validCalldata && <small className="field-error">Enter an even-length hexadecimal byte string beginning with 0x.</small>}</div><div className="field"><label htmlFor="action-amount">Optional call value · AVAX</label><input id="action-amount" type="number" min="0" step="0.000000000000000001" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></div></>}<div className="action-preview"><span className="status-chip status-neutral">Treasury action</span><strong>{actionSummary}</strong><small>The action is recorded in the proposal and runs through this project’s Treasury if the Governor finalizes a Pass outcome.</small></div></>}
      {step === 2 && <><h2>Seed the conditional markets</h2><p>Proposal bond and minimum liquidity are read directly from this project’s Governor.</p><div className="split-columns"><div className="summary-box"><small>Proposal bond · {tokenSymbol}</small><strong>{paramsLoading ? "Reading Fuji…" : bondDisplay ? `${Number(bondDisplay).toLocaleString()} ${tokenSymbol}` : "Unavailable"}</strong><span className="muted small">Paid in the project token; returned when the market finalizes.</span></div><div className="summary-box"><small>Minimum liquidity</small><strong>{paramsLoading ? "Reading Fuji…" : minLiquidityDisplay ? `${Number(minLiquidityDisplay).toLocaleString()} USDC` : "Unavailable"}</strong><span className="muted small">Required collateral for the Pass and Fail markets.</span></div></div><div className="field" style={{ marginTop: 18 }}><label htmlFor="initial-liquidity">Initial market liquidity · USDC</label><input id="initial-liquidity" type="number" min={minLiquidityDisplay ?? undefined} step="0.01" value={initialLiquidity} onChange={(event) => setInitialLiquidity(event.target.value)} placeholder={minLiquidityDisplay ?? "Read Governor minimum"} /><small className="muted">Minimum read from this Governor: {minLiquidityDisplay ? `${Number(minLiquidityDisplay).toLocaleString()} USDC` : "not available"}.</small>{initialLiquidity && !validLiquidity && minLiquidityDisplay && <small className="field-error">Enter at least {Number(minLiquidityDisplay).toLocaleString()} USDC.</small>}</div>{paramsError && <div className="warning-callout"><CircleAlert size={15} /> Governor parameters could not be read from Fuji.</div>}</>}
      {step === 3 && <><h2>Review and submit</h2><p>{proposalStage === "confirmed" ? "The proposal has been confirmed by Avalanche Fuji." : "Review the exact action and market collateral before signing."}</p><div className="review-grid"><div className="review-row"><span>Project</span><strong>{projectName} · {tokenSymbol}</strong></div><div className="review-row"><span>Title</span><strong>{title}</strong></div><div className="review-row"><span>Category</span><strong>{category}</strong></div><div className="review-row"><span>Summary</span><strong>{summary.trim() || "Not provided"}</strong></div><div className="review-row"><span>Action</span><strong>{actionSummary}</strong></div><div className="review-row"><span>Proposal bond</span><strong>{bondDisplay ? `${Number(bondDisplay).toLocaleString()} ${tokenSymbol}` : "Unavailable"}</strong></div><div className="review-row"><span>Initial liquidity</span><strong>{initialLiquidity ? `${Number(initialLiquidity).toLocaleString()} USDC` : "Not set"}</strong></div></div>{proposalStage === "confirmed" && <div className="success-callout"><Check size={15} /><span>Proposal created on Fuji. {proposalTxHash && <>Tx: <a href={`https://testnet.snowtrace.io/tx/${proposalTxHash}`} target="_blank" rel="noreferrer" className="mono" style={{ textDecoration: "underline" }}>{proposalTxHash.slice(0, 10)}…{proposalTxHash.slice(-8)}</a></>}{createdProposalId !== null && <> · Proposal #{createdProposalId.toString()}</>}</span></div>}{proposalError && <div className="warning-callout"><CircleAlert size={15} /> {proposalError}</div>}<div className="stepper"><div className={`stepper-line ${proposalStage !== "idle" ? "active" : ""}`}><span className="stepper-dot">1</span><span>Prepare proposal metadata</span><small>UTF-8 encoded and hashed</small></div><div className={`stepper-line ${statusMessage ? "active" : proposalStage === "awaiting-signature" || proposalStage === "confirming" ? "active" : proposalStage === "confirmed" ? "done" : ""}`}><span className="stepper-dot">2</span><span>Approve tokens and submit</span><small>{statusMessage ?? (proposalStage === "simulating" ? "Checking transaction…" : proposalStage === "awaiting-signature" ? "Awaiting wallet signature…" : proposalStage === "confirming" ? "Waiting for Fuji confirmation…" : proposalStage === "confirmed" ? "Confirmed on-chain" : wallet.status === "connected" ? "Ready to sign" : "Wallet disconnected")}</small></div></div></>}
      <div className="wizard-footer"><button className="button button-quiet" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || busy}><ArrowLeft size={14} /> Back</button>{step < 3 ? <button className="button button-primary" onClick={() => setStep(step + 1)} disabled={(step === 0 && !validTitle) || (step === 1 && !validAction) || (step === 2 && (!validLiquidity || paramsLoading || !params))}>Continue <ArrowRight size={14} /></button> : proposalStage === "confirmed" ? <Link href={`/p/${projectId}/proposals`} className="button button-primary">View proposal <ArrowRight size={14} /></Link> : !isGovernorConfigured ? <button className="button button-outline" disabled>Governor unavailable</button> : wallet.status === "wrong-network" ? <button className="button button-primary" onClick={wallet.switchNetwork}>Switch to Fuji</button> : wallet.status !== "connected" ? <button className="button button-primary" onClick={wallet.connect}>Connect wallet</button> : <button className="button button-primary" onClick={async () => { try { await createProposal({ title, summary, body, category, actionType, amount, recipient, calldata, initialLiquidityUsdc: initialLiquidity, governorAddress }); } catch {} }} disabled={busy}>{statusMessage ?? (proposalStage === "simulating" ? "Checking transaction…" : proposalStage === "awaiting-signature" ? "Sign in wallet…" : proposalStage === "confirming" ? "Confirming on Fuji…" : "Submit proposal")}</button>}</div>
    </section><aside className="panel wizard-preview"><span className="muted small">Proposal preview</span><span className="proposal-category">{category} · {projectName}</span><h3>{title || "Proposal title"}</h3><p>{summary || "Your summary will appear here."}</p><div className="divider" style={{ margin: "15px 0" }} /><div className="preview-stat"><span>Treasury action</span><strong>{actionSummary}</strong></div><div className="preview-stat"><span>Market liquidity</span><strong>{initialLiquidity ? `${initialLiquidity} USDC` : "Not set"}</strong></div><div className="preview-stat"><span>Network</span><strong>Avalanche Fuji · 43113</strong></div><p className="muted small">Proposal and token allowance transactions are sent to the verified project Governor.</p></aside></div>
  </div>;
}
