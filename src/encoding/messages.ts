import { PubKey } from "../gen/predictionmarket/crypto/v1/keys";
import {
  MsgCreateMarket,
  MsgCreateNegRiskGroup,
  MsgCreateParlayMarket,
  MsgPauseMarket,
  MsgResolveMarket,
  MsgSetMarketFee,
  MsgUpdateAdmin as MarketMsgUpdateAdmin,
  MsgUpdateNegRiskGroup,
  ParlayLeg,
} from "../gen/predictionmarket/market/v1/tx";
import {
  MsgUpdateAdmin as PoaMsgUpdateAdmin,
  MsgSetValidatorSet,
  ValidatorSlot,
} from "../gen/predictionmarket/poa/v1/tx";
import {
  MsgPauseSettlement,
  MsgSetMatcherAuthorization,
} from "../gen/predictionmarket/settlement/v1/tx";
import {
  MsgAdminBurnUSDC,
  MsgAdminMintUSDC,
  MsgUpdateAdmin as TestnetMintMsgUpdateAdmin,
} from "../gen/predictionmarket/testnetmint/v1/tx";
import type { EncodedPredchainMessage, ParlayLegInput, ValidatorSlotInput } from "../types";
import { decodeHex, normalizeAddress } from "../utils/address";

const MARKET = "predictionmarket.market.v1";
const SETTLEMENT = "predictionmarket.settlement.v1";
const TESTNETMINT = "predictionmarket.testnetmint.v1";
const POA = "predictionmarket.poa.v1";
const ETHSECP = "predictionmarket.crypto.v1.ethsecp256k1";

function encoded<T>(
  typeUrl: string,
  signerAddress: string,
  encoder: { encode(message: T): { finish(): Uint8Array } },
  message: T,
): EncodedPredchainMessage {
  return {
    typeUrl,
    signerAddress: normalizeAddress(signerAddress),
    value: encoder.encode(message).finish(),
  };
}

function toParlayLegs(legs: ParlayLegInput[]): ParlayLeg[] {
  return legs.map((leg) =>
    ParlayLeg.fromPartial({
      marketId: BigInt(leg.marketId),
      requiredOutcome: String(leg.requiredOutcome),
    }),
  );
}

function toValidatorSlots(validators: ValidatorSlotInput[]): ValidatorSlot[] {
  return validators.map((slot) =>
    ValidatorSlot.fromPartial({
      index: slot.index,
      name: String(slot.name),
      consensusAddress: normalizeAddress(slot.consensusAddress),
      consensusPubKey:
        typeof slot.consensusPubKey === "string" ? decodeHex(slot.consensusPubKey) : slot.consensusPubKey,
      power: BigInt(slot.power),
    }),
  );
}

export function encodeEthSecp256k1PubKey(key: Uint8Array): EncodedPredchainMessage {
  const message = PubKey.fromPartial({ key });
  return {
    typeUrl: `/${ETHSECP}.PubKey`,
    signerAddress: "",
    value: PubKey.encode(message).finish(),
  };
}

export function encodeCreateMarket(
  authority: string,
  question: string,
  metadataUri: string,
  takerFeeBps: number,
): EncodedPredchainMessage {
  const message = MsgCreateMarket.fromPartial({
    authority: normalizeAddress(authority),
    question,
    metadataUri,
    takerFeeBps,
  });
  return encoded(`/${MARKET}.MsgCreateMarket`, authority, MsgCreateMarket, message);
}

export function encodeCreateParlayMarket(
  authority: string,
  question: string,
  metadataUri: string,
  takerFeeBps: number,
  legs: ParlayLegInput[],
): EncodedPredchainMessage {
  const message = MsgCreateParlayMarket.fromPartial({
    authority: normalizeAddress(authority),
    question,
    metadataUri,
    takerFeeBps,
    legs: toParlayLegs(legs),
  });
  return encoded(`/${MARKET}.MsgCreateParlayMarket`, authority, MsgCreateParlayMarket, message);
}

export function encodeCreateNegRiskGroup(
  authority: string,
  title: string,
  metadataUri: string,
  marketIds: Array<number | bigint>,
): EncodedPredchainMessage {
  const message = MsgCreateNegRiskGroup.fromPartial({
    authority: normalizeAddress(authority),
    title,
    metadataUri,
    marketIds: marketIds.map((marketId) => BigInt(marketId)),
  });
  return encoded(`/${MARKET}.MsgCreateNegRiskGroup`, authority, MsgCreateNegRiskGroup, message);
}

export function encodeUpdateNegRiskGroup(
  authority: string,
  groupId: number | bigint,
  title = "",
  metadataUri = "",
  addMarketIds: Array<number | bigint> = [],
): EncodedPredchainMessage {
  const message = MsgUpdateNegRiskGroup.fromPartial({
    authority: normalizeAddress(authority),
    groupId: BigInt(groupId),
    title,
    metadataUri,
    addMarketIds: addMarketIds.map((marketId) => BigInt(marketId)),
  });
  return encoded(`/${MARKET}.MsgUpdateNegRiskGroup`, authority, MsgUpdateNegRiskGroup, message);
}

export function encodeUpdateMarketAdmin(authority: string, newAdmin: string): EncodedPredchainMessage {
  const message = MarketMsgUpdateAdmin.fromPartial({
    authority: normalizeAddress(authority),
    newAdmin: normalizeAddress(newAdmin),
  });
  return encoded(`/${MARKET}.MsgUpdateAdmin`, authority, MarketMsgUpdateAdmin, message);
}

export function encodePauseMarket(
  authority: string,
  marketId: number | bigint,
  paused: boolean,
): EncodedPredchainMessage {
  const message = MsgPauseMarket.fromPartial({
    authority: normalizeAddress(authority),
    marketId: BigInt(marketId),
    paused,
  });
  return encoded(`/${MARKET}.MsgPauseMarket`, authority, MsgPauseMarket, message);
}

export function encodeSetMarketFee(
  authority: string,
  marketId: number | bigint,
  takerFeeBps: number,
): EncodedPredchainMessage {
  const message = MsgSetMarketFee.fromPartial({
    authority: normalizeAddress(authority),
    marketId: BigInt(marketId),
    takerFeeBps,
  });
  return encoded(`/${MARKET}.MsgSetMarketFee`, authority, MsgSetMarketFee, message);
}

export function encodeResolveMarket(
  authority: string,
  marketId: number | bigint,
  winningOutcome: string,
  resolutionMetadataUri = "",
): EncodedPredchainMessage {
  const message = MsgResolveMarket.fromPartial({
    authority: normalizeAddress(authority),
    marketId: BigInt(marketId),
    winningOutcome,
    resolutionMetadataUri,
  });
  return encoded(`/${MARKET}.MsgResolveMarket`, authority, MsgResolveMarket, message);
}

export function encodePauseSettlement(authority: string, paused: boolean): EncodedPredchainMessage {
  const message = MsgPauseSettlement.fromPartial({
    authority: normalizeAddress(authority),
    paused,
  });
  return encoded(`/${SETTLEMENT}.MsgPauseSettlement`, authority, MsgPauseSettlement, message);
}

export function encodeSetMatcherAuthorization(
  authority: string,
  matcher: string,
  allowed: boolean,
): EncodedPredchainMessage {
  const message = MsgSetMatcherAuthorization.fromPartial({
    authority: normalizeAddress(authority),
    matcher: normalizeAddress(matcher),
    allowed,
  });
  return encoded(`/${SETTLEMENT}.MsgSetMatcherAuthorization`, authority, MsgSetMatcherAuthorization, message);
}

export function encodeAdminMintUsdc(
  authority: string,
  to: string,
  amount: string,
): EncodedPredchainMessage {
  const message = MsgAdminMintUSDC.fromPartial({
    authority: normalizeAddress(authority),
    to: normalizeAddress(to),
    amount: String(amount),
  });
  return encoded(`/${TESTNETMINT}.MsgAdminMintUSDC`, authority, MsgAdminMintUSDC, message);
}

export function encodeAdminBurnUsdc(
  authority: string,
  from: string,
  amount: string,
): EncodedPredchainMessage {
  const message = MsgAdminBurnUSDC.fromPartial({
    authority: normalizeAddress(authority),
    from: normalizeAddress(from),
    amount: String(amount),
  });
  return encoded(`/${TESTNETMINT}.MsgAdminBurnUSDC`, authority, MsgAdminBurnUSDC, message);
}

export function encodeUpdateTestnetMintAdmin(authority: string, newAdmin: string): EncodedPredchainMessage {
  const message = TestnetMintMsgUpdateAdmin.fromPartial({
    authority: normalizeAddress(authority),
    newAdmin: normalizeAddress(newAdmin),
  });
  return encoded(`/${TESTNETMINT}.MsgUpdateAdmin`, authority, TestnetMintMsgUpdateAdmin, message);
}

export function encodeSetValidatorSet(
  authority: string,
  validators: ValidatorSlotInput[],
): EncodedPredchainMessage {
  const message = MsgSetValidatorSet.fromPartial({
    authority: normalizeAddress(authority),
    validators: toValidatorSlots(validators),
  });
  return encoded(`/${POA}.MsgSetValidatorSet`, authority, MsgSetValidatorSet, message);
}

export function encodeUpdatePoaAdmin(authority: string, newAdmin: string): EncodedPredchainMessage {
  const message = PoaMsgUpdateAdmin.fromPartial({
    authority: normalizeAddress(authority),
    newAdmin: normalizeAddress(newAdmin),
  });
  return encoded(`/${POA}.MsgUpdateAdmin`, authority, PoaMsgUpdateAdmin, message);
}
