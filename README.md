# Predchain NestJS Admin SDK

NestJS-friendly TypeScript SDK for sending **admin-only** transactions to Predchain.

This package is intended for:
- admin dashboards
- internal backoffice tools
- scripted operational actions

It intentionally does **not** include:
- matcher / relayer flows
- user settlement flows
- CTF holder flows

## Supported transactions

### Market admin
- `createMarket`
- `createParlayMarket`
- `createNegRiskGroup`
- `updateNegRiskGroup`
- `pauseMarket`
- `setMarketFee`
- `resolveMarket`
- `updateMarketAdmin`

### Settlement admin
- `pauseSettlement`
- `setMatcherAuthorization`

### Testnet mint admin
- `adminMintUsdc`
- `adminBurnUsdc`
- `updateTestnetMintAdmin`

### PoA admin
- `setValidatorSet`
- `updatePoaAdmin`

### Market queries
- `getMarket`
- `listMarkets`
- `getMarketByPosition`
- `getNegRiskGroup`
- `getAuthorities`

### Tx helpers
- `simulate`
- `broadcast`
- `getTx`
- `waitForTx`

## Installation

```bash
npm install @org-43-57/predchain-nestjs-admin-sdk
```

## Plain TypeScript usage

```ts
import { PredchainAdminSdkClient } from "@org-43-57/predchain-nestjs-admin-sdk";

const client = PredchainAdminSdkClient.fromPrivateKey({
  apiUrl: "http://46.62.232.134/api",
  rpcUrl: "http://46.62.232.134/rpc",
  privateKeyHex: process.env.PREDCHAIN_ADMIN_PRIVATE_KEY!,
});

const tx = await client.createMarket(
  "Will BTC close above 100k on Friday?",
  "ipfs://market-meta",
  100,
);
```

## NestJS usage

```ts
import { Module } from "@nestjs/common";
import { PredchainAdminSdkModule } from "@org-43-57/predchain-nestjs-admin-sdk";

@Module({
  imports: [
    PredchainAdminSdkModule.forRoot({
      apiUrl: "http://46.62.232.134/api",
      rpcUrl: "http://46.62.232.134/rpc",
      privateKeyHex: process.env.PREDCHAIN_ADMIN_PRIVATE_KEY!,
    }),
  ],
})
export class AppModule {}
```

```ts
import { Injectable } from "@nestjs/common";
import { PredchainAdminSdkService } from "@org-43-57/predchain-nestjs-admin-sdk";

@Injectable()
export class AdminActionsService {
  constructor(private readonly predchain: PredchainAdminSdkService) {}

  pauseMarket(marketId: number) {
    return this.predchain.pauseMarket(marketId, true);
  }
}
```

## Method reference

### `createMarket(question, metadataUri?, takerFeeBps?, authority?, options?)`
Creates a new binary market with the configured admin key or an explicit authority override.

### `createParlayMarket(question, legs, metadataUri?, takerFeeBps?, authority?, options?)`
Creates a parlay market from underlying market legs.

### `createNegRiskGroup(title, marketIds, metadataUri?, authority?, options?)`
Creates a neg-risk group and attaches the provided markets.

### `updateNegRiskGroup(groupId, addMarketIds?, title?, metadataUri?, authority?, options?)`
Appends markets to a neg-risk group and optionally updates metadata.

### `pauseMarket(marketId, paused, authority?, options?)`
Pauses or unpauses one market.

### `setMarketFee(marketId, takerFeeBps, authority?, options?)`
Updates the taker fee for one market.

### `resolveMarket(marketId, winningOutcome, resolutionMetadataUri?, authority?, options?)`
Resolves a market to its winning outcome.

### `updateMarketAdmin(newAdmin, authority?, options?)`
Rotates the market module admin.

### `pauseSettlement(paused, authority?, options?)`
Pauses or unpauses settlement.

### `setMatcherAuthorization(matcher, allowed, authority?, options?)`
Adds or removes one authorized matcher.

### `adminMintUsdc(to, amount, authority?, options?)`
Mints test `uusdc` to the target account.

### `adminBurnUsdc(from, amount, authority?, options?)`
Burns test `uusdc` from the target account.

### `updateTestnetMintAdmin(newAdmin, authority?, options?)`
Rotates the testnet mint module admin.

### `setValidatorSet(validators, authority?, options?)`
Replaces the PoA validator slot set.

### `updatePoaAdmin(newAdmin, authority?, options?)`
Rotates the PoA module admin.

### `getMarket(marketId)`
Fetches one normalized market document from the chain explorer API.

### `listMarkets(options?)`
Fetches paginated market registry data.

### `getMarketByPosition(positionId)`
Resolves a position id back to its market.

### `getNegRiskGroup(groupId)`
Fetches one neg-risk group with grouped markets.

### `getAuthorities()`
Returns current market, settlement, PoA, and testnet mint authorities.

### `simulate(messages, gasLimit?)`
Simulates a tx built from encoded admin messages.

### `broadcast(messages, options?)`
Signs and broadcasts one tx containing pre-encoded messages.

### `getTx(txHash)`
Fetches a tx by hash from chain REST.

### `waitForTx(txHash, timeoutMs?)`
Polls RPC until the tx is committed or the timeout elapses.

## Notes

- Chain id defaults to `pmtest-1`.
- Signer address is derived from the provided private key if omitted.
- This SDK signs the native Cosmos tx directly.
- Admin addresses are normalized to lowercase `0x...` format.
