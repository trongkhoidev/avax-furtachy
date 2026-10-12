# Avalanche Fuji deployment runbook

This project targets Avalanche Fuji C-Chain (chain ID `43113`). The deploy command broadcasts real transactions and requires a locally held deployer key plus test AVAX. Never commit `.env` or share its private key.

## 1. Fund the wallet you intend to use

Use a wallet you control on Fuji and copy only its public address into the faucet. Request test AVAX from the [official Avalanche faucet](https://faucet.avax.network/). Request Fuji test USDC from the [Circle faucet](https://faucet.circle.com/) and select **Avalanche Fuji**. Faucet limits, captcha, and eligibility checks are controlled by each provider. Fuji USDC is `0x5425890298aed601595a70AB815c96711a31Bc65`.

## 2. Configure local deployment settings

```sh
cp .env.example .env
```

Set `DEPLOYER_PRIVATE_KEY` locally, confirm `RPC_URL_FUJI` and `USDC_ADDRESS`, and keep the key out of chat, source control, and browser configuration. The example file already points to Fuji and the published test USDC address. Leave the ERC-8004 registry addresses blank if those registries are not deployed for your environment.

## 3. Build and deploy the protocol

```sh
pnpm contracts:build
pnpm contracts:test
pnpm deploy:fuji
```

`pnpm deploy:fuji` checks chain ID inside the Solidity script, verifies that the configured USDC has code on Fuji, broadcasts the Factory, Router, and protocol implementations, then writes `packages/contracts/deployments/fuji.json`. Forecast and reputation contracts are only deployed when their required external registries are provided.

## 4. Configure the app with the deployment

Copy the `factory` address from `packages/contracts/deployments/fuji.json` into both `FACTORY_ADDRESS` and `NEXT_PUBLIC_FACTORY_ADDRESS` in `.env`. Set `NEXT_PUBLIC_USDC_ADDRESS` to the deployment’s `usdc` value. Set `FORECAST_REGISTRY_ADDRESS`, `REPUTATION_REPORTER_ADDRESS`, and their public counterpart only when those contracts exist. Restart all services after changing addresses so the client bundle reads the new public values.

The client build reads `NEXT_PUBLIC_*` values at build time; rebuild the web app after address changes.

Set `PINATA_JWT` for the API before creating a project or proposal. Their metadata is uploaded and hashed before the corresponding Factory or Governor transaction; the UI keeps the write action unavailable if the metadata service is not configured.

## 5. Start the indexer and app

```sh
pnpm db:up
pnpm dev:fuji
```

The indexer reads `FACTORY_ADDRESS`, `START_BLOCK`, `RPC_URL_FUJI`, and `DATABASE_URL` from `.env`. Set `START_BLOCK` to the Factory deployment block when initializing a fresh database. The API and UI distinguish an unavailable indexer from an empty index. Create a project only after the Factory address is configured and the wallet is on Fuji.

## 6. Smoke-test on Fuji

1. Open the web app and verify the wallet shows Avalanche Fuji, chain ID `43113`.
2. Confirm the configured Factory address and Fuji USDC address in `.env` match `deployments/fuji.json` and the token page on [Fuji Snowtrace](https://testnet.snowtrace.io/).
3. Create a project with a small test raise, and confirm `ProjectCreated` plus the project ID on Snowtrace.
4. Wait for the configured raise start time, approve USDC, contribute, and verify the contribution on the Raise contract.
5. Finalize after the end time, then verify the Factory `ProjectLive` event and project contracts.
6. Create a proposal with the displayed project-token bond and Governor minimum USDC liquidity. Confirm both token approvals and the Governor `ProposalCreated` event.
7. Activate after warmup, verify Pass/Fail markets and their conditional-token swaps, then finalize after the on-chain market window.

## Current operational boundary

No deployer key, funded wallet address, or Fuji deployment record is stored in this workspace. The code and runbook are prepared, but a real faucet request needs the wallet address you choose and provider-side eligibility steps; a deployment needs a funded signing account. Until those prerequisites exist, live contract addresses stay unconfigured and the interface shows that state.
