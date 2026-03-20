import { PredchainAdminSdkClient } from "../src";

async function main(): Promise<void> {
  const client = PredchainAdminSdkClient.fromPrivateKey({
    apiUrl: "http://46.62.232.134/api",
    rpcUrl: "http://46.62.232.134/rpc",
    privateKeyHex: process.env.PREDCHAIN_ADMIN_PRIVATE_KEY ?? "",
  });

  const tx = await client.pauseSettlement(true);
  console.log(tx);
}

void main();
