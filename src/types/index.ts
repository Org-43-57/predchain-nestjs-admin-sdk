export type BroadcastMode =
  | "BROADCAST_MODE_UNSPECIFIED"
  | "BROADCAST_MODE_BLOCK"
  | "BROADCAST_MODE_SYNC"
  | "BROADCAST_MODE_ASYNC";

export interface PredchainAdminSdkConfig {
  apiUrl: string;
  rpcUrl: string;
  privateKeyHex: string;
  signerAddress?: string;
  timeoutMs?: number;
  chainId?: string;
  defaultBroadcastMode?: BroadcastMode;
  defaultCommitTimeoutMs?: number;
  maxSequenceRetries?: number;
}

export interface PredchainAdminSdkModuleOptions extends PredchainAdminSdkConfig {}

export interface ParlayLegInput {
  marketId: number | bigint;
  requiredOutcome: string;
}

export interface ValidatorSlotInput {
  index: number;
  name: string;
  consensusAddress: string;
  consensusPubKey: string | Uint8Array;
  power: number | bigint;
}

export interface ListMarketsOptions {
  type?: string;
  status?: string;
  contains?: string;
  groupId?: number;
  legMarketId?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface TxBroadcastOptions {
  gasLimit?: number;
  broadcastMode?: BroadcastMode;
  commitTimeoutMs?: number;
}

export interface TxSubmission {
  txHash: string;
  requestedMode: BroadcastMode;
  usedMode: BroadcastMode;
  accepted: boolean;
  committed: boolean;
  success: boolean;
  status:
    | "accepted"
    | "broadcast_rejected"
    | "committed_success"
    | "committed_failure"
    | "commit_timeout";
  broadcast: Record<string, unknown>;
  committedResult: Record<string, unknown> | null;
}

export interface AccountInfo {
  address: string;
  accountNumber: bigint;
  sequence: bigint;
  exists: boolean;
}

export interface EncodedPredchainMessage {
  typeUrl: string;
  value: Uint8Array;
  signerAddress: string;
}
