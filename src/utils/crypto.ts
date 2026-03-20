import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";

import { decodeHex } from "./address";

export function signDirect(privateKeyHex: string, signDocBytes: Uint8Array): Uint8Array {
  const digest = sha256(signDocBytes);
  return secp256k1.sign(digest, decodeHex(privateKeyHex)).toCompactRawBytes();
}

export function sha256Hex(bytes: Uint8Array): string {
  return Buffer.from(sha256(bytes)).toString("hex").toUpperCase();
}
