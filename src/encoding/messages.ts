import { Writer } from "protobufjs/minimal";

import type { EncodedPredchainMessage, ParlayLegInput, ValidatorSlotInput } from "../types";
import { decodeHex, normalizeAddress } from "../utils/address";

const MARKET = "predictionmarket.market.v1";
const SETTLEMENT = "predictionmarket.settlement.v1";
const TESTNETMINT = "predictionmarket.testnetmint.v1";
const POA = "predictionmarket.poa.v1";
const ETHSECP = "predictionmarket.crypto.v1.ethsecp256k1";

function message(typeUrl: string, signerAddress: string, writer: Writer): EncodedPredchainMessage {
  return {
    typeUrl,
    signerAddress: normalizeAddress(signerAddress),
    value: writer.finish(),
  };
}

function stringField(writer: Writer, field: number, value: string | undefined): void {
  if (value !== undefined && value !== "") {
    writer.uint32((field << 3) | 2).string(value);
  }
}

function boolField(writer: Writer, field: number, value: boolean | undefined): void {
  if (value !== undefined) {
    writer.uint32((field << 3) | 0).bool(value);
  }
}

function uint32Field(writer: Writer, field: number, value: number | undefined): void {
  if (value !== undefined) {
    writer.uint32((field << 3) | 0).uint32(value);
  }
}

function uint64Field(writer: Writer, field: number, value: number | bigint | string | undefined): void {
  if (value !== undefined) {
    writer.uint32((field << 3) | 0).uint64(String(value));
  }
}

function int64Field(writer: Writer, field: number, value: number | bigint | string | undefined): void {
  if (value !== undefined) {
    writer.uint32((field << 3) | 0).int64(String(value));
  }
}

function bytesField(writer: Writer, field: number, value: Uint8Array | undefined): void {
  if (value && value.length > 0) {
    writer.uint32((field << 3) | 2).bytes(value);
  }
}

function repeatedUint64Field(writer: Writer, field: number, values: Array<number | bigint> | undefined): void {
  for (const value of values ?? []) {
    writer.uint32((field << 3) | 0).uint64(String(value));
  }
}

function encodeParlayLeg(leg: ParlayLegInput): Uint8Array {
  const writer = Writer.create();
  uint64Field(writer, 1, leg.marketId);
  stringField(writer, 2, String(leg.requiredOutcome));
  return writer.finish();
}

function encodeValidatorSlot(slot: ValidatorSlotInput): Uint8Array {
  const writer = Writer.create();
  uint32Field(writer, 1, slot.index);
  stringField(writer, 2, String(slot.name));
  stringField(writer, 3, normalizeAddress(slot.consensusAddress));
  bytesField(
    writer,
    4,
    typeof slot.consensusPubKey === "string" ? decodeHex(slot.consensusPubKey) : slot.consensusPubKey,
  );
  int64Field(writer, 5, slot.power);
  return writer.finish();
}

export function encodeEthSecp256k1PubKey(key: Uint8Array): EncodedPredchainMessage {
  const writer = Writer.create();
  bytesField(writer, 1, key);
  return {
    typeUrl: `/${ETHSECP}.PubKey`,
    signerAddress: "",
    value: writer.finish(),
  };
}

export function encodeCreateMarket(
  authority: string,
  question: string,
  metadataUri: string,
  takerFeeBps: number,
): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  stringField(writer, 2, question);
  stringField(writer, 3, metadataUri);
  uint32Field(writer, 5, takerFeeBps);
  return message(`/${MARKET}.MsgCreateMarket`, authority, writer);
}

export function encodeCreateParlayMarket(
  authority: string,
  question: string,
  metadataUri: string,
  takerFeeBps: number,
  legs: ParlayLegInput[],
): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  stringField(writer, 2, question);
  stringField(writer, 3, metadataUri);
  uint32Field(writer, 5, takerFeeBps);
  for (const leg of legs) {
    writer.uint32((6 << 3) | 2).bytes(encodeParlayLeg(leg));
  }
  return message(`/${MARKET}.MsgCreateParlayMarket`, authority, writer);
}

export function encodeCreateNegRiskGroup(
  authority: string,
  title: string,
  metadataUri: string,
  marketIds: Array<number | bigint>,
): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  stringField(writer, 2, title);
  stringField(writer, 3, metadataUri);
  repeatedUint64Field(writer, 4, marketIds);
  return message(`/${MARKET}.MsgCreateNegRiskGroup`, authority, writer);
}

export function encodeUpdateNegRiskGroup(
  authority: string,
  groupId: number | bigint,
  title = "",
  metadataUri = "",
  addMarketIds: Array<number | bigint> = [],
): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  uint64Field(writer, 2, groupId);
  stringField(writer, 3, title);
  stringField(writer, 4, metadataUri);
  repeatedUint64Field(writer, 5, addMarketIds);
  return message(`/${MARKET}.MsgUpdateNegRiskGroup`, authority, writer);
}

export function encodeUpdateMarketAdmin(authority: string, newAdmin: string): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  stringField(writer, 2, normalizeAddress(newAdmin));
  return message(`/${MARKET}.MsgUpdateAdmin`, authority, writer);
}

export function encodePauseMarket(
  authority: string,
  marketId: number | bigint,
  paused: boolean,
): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  uint64Field(writer, 2, marketId);
  boolField(writer, 3, paused);
  return message(`/${MARKET}.MsgPauseMarket`, authority, writer);
}

export function encodeSetMarketFee(
  authority: string,
  marketId: number | bigint,
  takerFeeBps: number,
): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  uint64Field(writer, 2, marketId);
  uint32Field(writer, 3, takerFeeBps);
  return message(`/${MARKET}.MsgSetMarketFee`, authority, writer);
}

export function encodeResolveMarket(
  authority: string,
  marketId: number | bigint,
  winningOutcome: string,
  resolutionMetadataUri = "",
): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  uint64Field(writer, 2, marketId);
  stringField(writer, 3, winningOutcome);
  stringField(writer, 4, resolutionMetadataUri);
  return message(`/${MARKET}.MsgResolveMarket`, authority, writer);
}

export function encodePauseSettlement(authority: string, paused: boolean): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  boolField(writer, 2, paused);
  return message(`/${SETTLEMENT}.MsgPauseSettlement`, authority, writer);
}

export function encodeSetMatcherAuthorization(
  authority: string,
  matcher: string,
  allowed: boolean,
): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  stringField(writer, 2, normalizeAddress(matcher));
  boolField(writer, 3, allowed);
  return message(`/${SETTLEMENT}.MsgSetMatcherAuthorization`, authority, writer);
}

export function encodeAdminMintUsdc(
  authority: string,
  to: string,
  amount: string,
): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  stringField(writer, 2, normalizeAddress(to));
  stringField(writer, 3, String(amount));
  return message(`/${TESTNETMINT}.MsgAdminMintUSDC`, authority, writer);
}

export function encodeAdminBurnUsdc(
  authority: string,
  from: string,
  amount: string,
): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  stringField(writer, 2, normalizeAddress(from));
  stringField(writer, 3, String(amount));
  return message(`/${TESTNETMINT}.MsgAdminBurnUSDC`, authority, writer);
}

export function encodeUpdateTestnetMintAdmin(authority: string, newAdmin: string): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  stringField(writer, 2, normalizeAddress(newAdmin));
  return message(`/${TESTNETMINT}.MsgUpdateAdmin`, authority, writer);
}

export function encodeSetValidatorSet(
  authority: string,
  validators: ValidatorSlotInput[],
): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  for (const validator of validators) {
    writer.uint32((2 << 3) | 2).bytes(encodeValidatorSlot(validator));
  }
  return message(`/${POA}.MsgSetValidatorSet`, authority, writer);
}

export function encodeUpdatePoaAdmin(authority: string, newAdmin: string): EncodedPredchainMessage {
  const writer = Writer.create();
  stringField(writer, 1, normalizeAddress(authority));
  stringField(writer, 2, normalizeAddress(newAdmin));
  return message(`/${POA}.MsgUpdateAdmin`, authority, writer);
}
