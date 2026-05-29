import * as StellarSdk from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

export const CONTRACT_ID = "CAH5RGKKZ27D6LDN75XFGHHL73C7OZAEBXY4RKC7WTEEGITNXFV6LVIX";
export const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const TOKEN_ADDRESS = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export const rpc = new Server(RPC_URL);

export async function simulateAndSend(account, operation, sourceKeypair) {
  const { TransactionBuilder, BASE_FEE, Networks } = StellarSdk;
  const { assembleTransaction, Api } = await import("@stellar/stellar-sdk/rpc");

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simResult = await rpc.simulateTransaction(tx);

  if (Api.isSimulationError(simResult)) {
    throw new Error(simResult.error);
  }

  const preparedTx = assembleTransaction(tx, simResult).build();
  preparedTx.sign(sourceKeypair);

  const sendResult = await rpc.sendTransaction(preparedTx);

  let status = sendResult;
  while (status.status === "PENDING" || status.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 2000));
    status = await rpc.getTransaction(sendResult.hash);
  }

  return status;
}
