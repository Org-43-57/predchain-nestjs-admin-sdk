import type { AccountInfo } from "../types";

function findNestedRecord(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  if (key in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>)[key];
  }
  for (const nested of Object.values(value as Record<string, unknown>)) {
    const found = findNestedRecord(nested, key);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

export function extractAccountInfo(address: string, payload: unknown): AccountInfo {
  const account = payload && typeof payload === "object" ? (payload as { account?: unknown }).account : undefined;
  const accountNumber = findNestedRecord(account, "account_number");
  const sequence = findNestedRecord(account, "sequence");
  if (accountNumber === undefined || sequence === undefined) {
    throw new Error(`failed to decode account_number/sequence for ${address}`);
  }
  return {
    address,
    accountNumber: BigInt(String(accountNumber)),
    sequence: BigInt(String(sequence)),
    exists: true,
  };
}
