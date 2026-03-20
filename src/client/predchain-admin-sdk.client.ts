import { Injectable } from "@nestjs/common";
import { AuthInfo, Fee, ModeInfo, ModeInfo_Single, SignDoc, SignerInfo, TxBody, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { Any } from "cosmjs-types/google/protobuf/any";

import {
  encodeAdminBurnUsdc,
  encodeAdminMintUsdc,
  encodeCreateMarket,
  encodeCreateNegRiskGroup,
  encodeCreateParlayMarket,
  encodeEthSecp256k1PubKey,
  encodePauseMarket,
  encodePauseSettlement,
  encodeResolveMarket,
  encodeSetMarketFee,
  encodeSetMatcherAuthorization,
  encodeSetValidatorSet,
  encodeUpdateMarketAdmin,
  encodeUpdateNegRiskGroup,
  encodeUpdatePoaAdmin,
  encodeUpdateTestnetMintAdmin,
} from "../encoding/messages";
import type {
  AccountInfo,
  BroadcastMode,
  EncodedPredchainMessage,
  ListMarketsOptions,
  ParlayLegInput,
  PredchainAdminSdkConfig,
  TxBroadcastOptions,
  TxSubmission,
  ValidatorSlotInput,
} from "../types";
import { compressedPubkeyFromPrivateKey, deriveAddressFromPrivateKey, normalizeAddress } from "../utils/address";
import { extractAccountInfo } from "../utils/account";
import { sha256Hex, signDirect } from "../utils/crypto";
import { PredchainAdminSdkError, requestJson } from "../utils/http";

const DEFAULT_CHAIN_ID = "pmtest-1";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_COMMIT_TIMEOUT_MS = 25_000;
const DEFAULT_BROADCAST_MODE: BroadcastMode = "BROADCAST_MODE_BLOCK";
const DEFAULT_GAS_LIMITS: Record<string, number> = {
  "/predictionmarket.market.v1.MsgCreateMarket": 250_000,
  "/predictionmarket.market.v1.MsgCreateParlayMarket": 400_000,
  "/predictionmarket.market.v1.MsgCreateNegRiskGroup": 300_000,
  "/predictionmarket.market.v1.MsgUpdateNegRiskGroup": 250_000,
  "/predictionmarket.market.v1.MsgUpdateAdmin": 160_000,
  "/predictionmarket.market.v1.MsgPauseMarket": 150_000,
  "/predictionmarket.market.v1.MsgSetMarketFee": 150_000,
  "/predictionmarket.market.v1.MsgResolveMarket": 220_000,
  "/predictionmarket.settlement.v1.MsgPauseSettlement": 150_000,
  "/predictionmarket.settlement.v1.MsgSetMatcherAuthorization": 150_000,
  "/predictionmarket.testnetmint.v1.MsgAdminMintUSDC": 180_000,
  "/predictionmarket.testnetmint.v1.MsgAdminBurnUSDC": 180_000,
  "/predictionmarket.testnetmint.v1.MsgUpdateAdmin": 160_000,
  "/predictionmarket.poa.v1.MsgSetValidatorSet": 250_000,
  "/predictionmarket.poa.v1.MsgUpdateAdmin": 160_000,
};

@Injectable()
export class PredchainAdminSdkClient {
  readonly apiUrl: string;
  readonly rpcUrl: string;
  readonly signerAddress: string;
  readonly privateKeyHex: string;
  readonly chainId: string;
  readonly timeoutMs: number;
  readonly defaultBroadcastMode: BroadcastMode;
  readonly defaultCommitTimeoutMs: number;
  readonly maxSequenceRetries: number;

  private accountNumber?: bigint;
  private nextSequence?: bigint;
  private submitQueue: Promise<unknown> = Promise.resolve();
  private readonly pubkeyAny: Any;

  constructor(config: PredchainAdminSdkConfig) {
    this.apiUrl = config.apiUrl.replace(/\/+$/, "");
    this.rpcUrl = config.rpcUrl.replace(/\/+$/, "");
    this.privateKeyHex = config.privateKeyHex;
    this.signerAddress = normalizeAddress(config.signerAddress ?? deriveAddressFromPrivateKey(config.privateKeyHex));
    this.chainId = config.chainId ?? DEFAULT_CHAIN_ID;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultBroadcastMode = config.defaultBroadcastMode ?? DEFAULT_BROADCAST_MODE;
    this.defaultCommitTimeoutMs = config.defaultCommitTimeoutMs ?? DEFAULT_COMMIT_TIMEOUT_MS;
    this.maxSequenceRetries = config.maxSequenceRetries ?? 2;

    const pubKey = compressedPubkeyFromPrivateKey(this.privateKeyHex);
    const pubKeyMsg = encodeEthSecp256k1PubKey(pubKey);
    this.pubkeyAny = Any.fromPartial({
      typeUrl: pubKeyMsg.typeUrl,
      value: pubKeyMsg.value,
    });
  }

  static fromPrivateKey(config: Omit<PredchainAdminSdkConfig, "signerAddress">): PredchainAdminSdkClient {
    return new PredchainAdminSdkClient(config);
  }

  async getAuthorities(): Promise<Record<string, unknown>> {
    return this.get(`/predictionmarket/explorer/v1/authorities`);
  }

  async getMarket(marketId: number): Promise<Record<string, unknown>> {
    return this.get(`/predictionmarket/explorer/v1/markets/${marketId}`);
  }

  async listMarkets(options: ListMarketsOptions = {}): Promise<Record<string, unknown>> {
    const params = new URLSearchParams();
    if (options.type) params.set("type", options.type);
    if (options.status) params.set("status", options.status);
    if (options.contains) params.set("contains", options.contains);
    if (options.groupId !== undefined) params.set("group_id", String(options.groupId));
    if (options.legMarketId !== undefined) params.set("leg_market_id", String(options.legMarketId));
    if (options.sort) params.set("sort", options.sort);
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.offset !== undefined) params.set("offset", String(options.offset));
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return this.get(`/predictionmarket/explorer/v1/markets${suffix}`);
  }

  async getMarketByPosition(positionId: string): Promise<Record<string, unknown>> {
    return this.get(`/predictionmarket/explorer/v1/markets/by-position/${encodeURIComponent(positionId)}`);
  }

  async getNegRiskGroup(groupId: number): Promise<Record<string, unknown>> {
    return this.get(`/predictionmarket/explorer/v1/neg-risk-groups/${groupId}`);
  }

  async getTx(txHash: string): Promise<Record<string, unknown>> {
    return this.get(`/cosmos/tx/v1beta1/txs/${encodeURIComponent(txHash)}`);
  }

  async waitForTx(txHash: string, timeoutMs = this.defaultCommitTimeoutMs): Promise<Record<string, unknown>> {
    const normalized = txHash.replace(/^0x/i, "").toUpperCase();
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline) {
      try {
        const payload = await this.getRpc(`/tx?hash=0x${normalized}&prove=false`);
        if (payload.result && typeof payload.result === "object") {
          return payload.result as Record<string, unknown>;
        }
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    throw new PredchainAdminSdkError(
      `tx ${txHash} was not committed within ${timeoutMs}ms`,
      undefined,
      lastError,
    );
  }

  async simulate(messages: EncodedPredchainMessage[], gasLimit?: number): Promise<Record<string, unknown>> {
    const account = await this.ensureSequenceState();
    const txBytes = this.buildSignedTxBytes(messages, account.accountNumber, account.sequence, gasLimit ?? this.defaultGas(messages));
    return this.post(`/cosmos/tx/v1beta1/simulate`, { tx_bytes: Buffer.from(txBytes).toString("base64") });
  }

  async broadcast(
    messages: EncodedPredchainMessage[],
    options: TxBroadcastOptions = {},
  ): Promise<TxSubmission> {
    return this.withSubmitLock(async () => {
      let account = await this.ensureSequenceState();
      const requestedMode = this.normalizeBroadcastMode(options.broadcastMode);
      const gasLimit = options.gasLimit ?? this.defaultGas(messages);

      for (let attempt = 0; attempt <= this.maxSequenceRetries; attempt += 1) {
        const sequence = this.nextSequence ?? account.sequence;
        const txBytes = this.buildSignedTxBytes(messages, account.accountNumber, sequence, gasLimit);
        const localHash = sha256Hex(txBytes);
        const broadcast = await this.post(`/cosmos/tx/v1beta1/txs`, {
          tx_bytes: Buffer.from(txBytes).toString("base64"),
          mode: requestedMode,
        });
        const txResponse = (broadcast.tx_response ?? {}) as Record<string, unknown>;
        const code = this.intValue(txResponse.code);
        const rawLog = String(txResponse.raw_log ?? "");

        if (code !== 0 && this.isSequenceMismatch(rawLog) && attempt < this.maxSequenceRetries) {
          account = await this.getAccountInfo(true);
          continue;
        }

        const txHash = String(txResponse.txhash ?? localHash);
        const accepted = code === 0;
        if (accepted) {
          this.nextSequence = sequence + 1n;
        }

        if (requestedMode !== "BROADCAST_MODE_BLOCK" || !accepted) {
          return {
            txHash,
            requestedMode,
            usedMode: requestedMode,
            accepted,
            committed: false,
            success: accepted,
            status: accepted ? "accepted" : "broadcast_rejected",
            broadcast: txResponse,
            committedResult: null,
          };
        }

        try {
          const committed = await this.waitForTx(txHash, options.commitTimeoutMs ?? this.defaultCommitTimeoutMs);
          const committedCode = this.intValue(
            (committed.tx_result as Record<string, unknown> | undefined)?.code,
          );
          return {
            txHash,
            requestedMode,
            usedMode: requestedMode,
            accepted: true,
            committed: true,
            success: committedCode === 0,
            status: committedCode === 0 ? "committed_success" : "committed_failure",
            broadcast: txResponse,
            committedResult: committed,
          };
        } catch {
          return {
            txHash,
            requestedMode,
            usedMode: requestedMode,
            accepted: true,
            committed: false,
            success: false,
            status: "commit_timeout",
            broadcast: txResponse,
            committedResult: null,
          };
        }
      }

      throw new PredchainAdminSdkError("broadcast failed after sequence retries");
    });
  }

  async createMarket(question: string, metadataUri = "", takerFeeBps = 100, authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeCreateMarket(authority, question, metadataUri, takerFeeBps)], options);
  }

  async createParlayMarket(question: string, legs: ParlayLegInput[], metadataUri = "", takerFeeBps = 100, authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeCreateParlayMarket(authority, question, metadataUri, takerFeeBps, legs)], options);
  }

  async createNegRiskGroup(title: string, marketIds: Array<number | bigint>, metadataUri = "", authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeCreateNegRiskGroup(authority, title, metadataUri, marketIds)], options);
  }

  async updateNegRiskGroup(groupId: number | bigint, addMarketIds: Array<number | bigint> = [], title = "", metadataUri = "", authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeUpdateNegRiskGroup(authority, groupId, title, metadataUri, addMarketIds)], options);
  }

  async pauseMarket(marketId: number | bigint, paused: boolean, authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodePauseMarket(authority, marketId, paused)], options);
  }

  async setMarketFee(marketId: number | bigint, takerFeeBps: number, authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeSetMarketFee(authority, marketId, takerFeeBps)], options);
  }

  async resolveMarket(marketId: number | bigint, winningOutcome: string, resolutionMetadataUri = "", authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeResolveMarket(authority, marketId, winningOutcome, resolutionMetadataUri)], options);
  }

  async updateMarketAdmin(newAdmin: string, authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeUpdateMarketAdmin(authority, newAdmin)], options);
  }

  async pauseSettlement(paused: boolean, authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodePauseSettlement(authority, paused)], options);
  }

  async setMatcherAuthorization(matcher: string, allowed: boolean, authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeSetMatcherAuthorization(authority, matcher, allowed)], options);
  }

  async adminMintUsdc(to: string, amount: string, authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeAdminMintUsdc(authority, to, amount)], options);
  }

  async adminBurnUsdc(from: string, amount: string, authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeAdminBurnUsdc(authority, from, amount)], options);
  }

  async updateTestnetMintAdmin(newAdmin: string, authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeUpdateTestnetMintAdmin(authority, newAdmin)], options);
  }

  async setValidatorSet(validators: ValidatorSlotInput[], authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeSetValidatorSet(authority, validators)], options);
  }

  async updatePoaAdmin(newAdmin: string, authority = this.signerAddress, options: TxBroadcastOptions = {}): Promise<TxSubmission> {
    return this.broadcast([encodeUpdatePoaAdmin(authority, newAdmin)], options);
  }

  private async get(path: string): Promise<Record<string, unknown>> {
    return requestJson<Record<string, unknown>>("GET", `${this.apiUrl}/${path.replace(/^\/+/, "")}`, this.timeoutMs);
  }

  private async getRpc(path: string): Promise<Record<string, unknown>> {
    return requestJson<Record<string, unknown>>("GET", `${this.rpcUrl}/${path.replace(/^\/+/, "")}`, this.timeoutMs);
  }

  private async post(path: string, body: unknown): Promise<Record<string, unknown>> {
    return requestJson<Record<string, unknown>>("POST", `${this.apiUrl}/${path.replace(/^\/+/, "")}`, this.timeoutMs, body);
  }

  private async getAccountInfo(refreshSequenceCache = false): Promise<AccountInfo> {
    try {
      const payload = await this.get(`/cosmos/auth/v1beta1/accounts/${encodeURIComponent(this.signerAddress)}`);
      const info = extractAccountInfo(this.signerAddress, payload);
      if (refreshSequenceCache) {
        this.accountNumber = info.accountNumber;
        this.nextSequence = info.sequence;
      }
      return info;
    } catch (error) {
      if (error instanceof PredchainAdminSdkError && error.statusCode === 404) {
        return {
          address: this.signerAddress,
          accountNumber: 0n,
          sequence: 0n,
          exists: false,
        };
      }
      throw error;
    }
  }

  private async ensureSequenceState(): Promise<AccountInfo> {
    if (this.accountNumber !== undefined && this.nextSequence !== undefined) {
      return {
        address: this.signerAddress,
        accountNumber: this.accountNumber,
        sequence: this.nextSequence,
        exists: true,
      };
    }
    const info = await this.getAccountInfo(true);
    if (!info.exists) {
      throw new PredchainAdminSdkError(`signer account ${this.signerAddress} does not exist on-chain`);
    }
    return info;
  }

  private defaultGas(messages: EncodedPredchainMessage[]): number {
    return messages.reduce((sum, message) => sum + (DEFAULT_GAS_LIMITS[message.typeUrl] ?? 500_000), 0);
  }

  private buildSignedTxBytes(
    messages: EncodedPredchainMessage[],
    accountNumber: bigint,
    sequence: bigint,
    gasLimit: number,
  ): Uint8Array {
    const body = TxBody.fromPartial({
      messages: messages.map((message) =>
        Any.fromPartial({
          typeUrl: message.typeUrl,
          value: message.value,
        }),
      ),
    });
    const bodyBytes = TxBody.encode(body).finish();

    const signerInfo = SignerInfo.fromPartial({
      publicKey: this.pubkeyAny,
      modeInfo: ModeInfo.fromPartial({
        single: ModeInfo_Single.fromPartial({ mode: SignMode.SIGN_MODE_DIRECT }),
      }),
      sequence,
    });
    const authInfo = AuthInfo.fromPartial({
      signerInfos: [signerInfo],
      fee: Fee.fromPartial({
        amount: [],
        gasLimit: BigInt(gasLimit),
      }),
    });
    const authInfoBytes = AuthInfo.encode(authInfo).finish();
    const signDoc = SignDoc.fromPartial({
      bodyBytes,
      authInfoBytes,
      chainId: this.chainId,
      accountNumber,
    });
    const signature = signDirect(this.privateKeyHex, SignDoc.encode(signDoc).finish());
    return TxRaw.encode(
      TxRaw.fromPartial({
        bodyBytes,
        authInfoBytes,
        signatures: [signature],
      }),
    ).finish();
  }

  private normalizeBroadcastMode(mode?: BroadcastMode): BroadcastMode {
    const raw = (mode ?? this.defaultBroadcastMode).toUpperCase();
    if (raw === "BROADCAST_MODE_ASYNC" || raw === "BROADCAST_MODE_BLOCK" || raw === "BROADCAST_MODE_SYNC" || raw === "BROADCAST_MODE_UNSPECIFIED") {
      return raw;
    }
    if (raw === "ASYNC") return "BROADCAST_MODE_ASYNC";
    if (raw === "BLOCK") return "BROADCAST_MODE_BLOCK";
    return "BROADCAST_MODE_SYNC";
  }

  private isSequenceMismatch(rawLog: string): boolean {
    const lowered = rawLog.toLowerCase();
    return lowered.includes("account sequence mismatch") || lowered.includes("incorrect account sequence");
  }

  private intValue(value: unknown): number {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      return Number.parseInt(value, 10);
    }
    return 0;
  }

  private withSubmitLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.submitQueue.then(fn, fn);
    this.submitQueue = run.then(() => undefined, () => undefined);
    return run;
  }
}
