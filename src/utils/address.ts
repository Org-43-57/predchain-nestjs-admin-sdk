import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";

export function normalizeHex(value: string): string {
  const raw = value.trim();
  return raw.startsWith("0x") || raw.startsWith("0X") ? raw.slice(2) : raw;
}

export function decodeHex(value: string): Uint8Array {
  const raw = normalizeHex(value);
  const normalized = raw.length % 2 === 1 ? `0${raw}` : raw;
  return Uint8Array.from(Buffer.from(normalized, "hex"));
}

export function encodeHex(value: Uint8Array, prefix = true): string {
  const hex = Buffer.from(value).toString("hex");
  return prefix ? `0x${hex}` : hex;
}

export function normalizeAddress(value: string): string {
  const raw = normalizeHex(value);
  if (raw.length !== 40) {
    throw new Error(`expected 20-byte hex address, got ${value}`);
  }
  return `0x${raw.toLowerCase()}`;
}

export function deriveAddressFromPrivateKey(privateKeyHex: string): string {
  const privateKey = decodeHex(privateKeyHex);
  const uncompressed = secp256k1.getPublicKey(privateKey, false);
  const hash = keccak_256(uncompressed.slice(1));
  return encodeHex(hash.slice(-20));
}

export function compressedPubkeyFromPrivateKey(privateKeyHex: string): Uint8Array {
  return secp256k1.getPublicKey(decodeHex(privateKeyHex), true);
}
