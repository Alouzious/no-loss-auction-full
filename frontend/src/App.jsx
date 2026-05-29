import { useState, useEffect } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc";
import {
  CONTRACT_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
  TOKEN_ADDRESS,
  rpc,
  simulateAndSend,
} from "./lib/contract";

const contract = new StellarSdk.Contract(CONTRACT_ID);
const DUMMY_ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

export default function App() {
  const [secretKey, setSecretKey] = useState("");
  const [keypair, setKeypair] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [bidAuctionId, setBidAuctionId] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [finalizeId, setFinalizeId] = useState("");
  const [cancelId, setCancelId] = useState("");

  function notify(msg, type = "info") {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  }

  function connectWallet() {
    try {
      const kp = StellarSdk.Keypair.fromSecret(secretKey.trim());
      setKeypair(kp);
      notify("Wallet connected: " + kp.publicKey().slice(0, 10) + "...", "success");
    } catch {
      notify("Invalid secret key", "error");
    }
  }

  async function readCall(operation) {
    const tx = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(DUMMY_ACCOUNT, "0"),
      { fee: StellarSdk.BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }
    ).addOperation(operation).setTimeout(30).build();
    return rpc.simulateTransaction(tx);
  }

  async function fetchAuctions() {
    try {
      setLoading(true);
      const countSim = await readCall(contract.call("get_auction_count"));
      if (Api.isSimulationError(countSim)) return;
      const count = Number(StellarSdk.scValToNative(countSim.result.retval));

      const list = [];
      for (let i = 1; i <= count; i++) {
        const sim = await readCall(
          contract.call("get_auction", StellarSdk.nativeToScVal(i, { type: "u64" }))
        );
        if (!Api.isSimulationError(sim)) {
          const val = StellarSdk.scValToNative(sim.result.retval);
          if (val) list.push(val);
        }
      }
      setAuctions(list);
    } catch (e) {
      notify("Failed to fetch auctions: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function createAuction() {
    if (!keypair) return notify("Connect wallet first", "error");
    if (!title || !duration) return notify("Fill in title and duration", "error");
    try {
      setLoading(true);
      const account = await rpc.getAccount(keypair.publicKey());
      const op = contract.call(
        "create_auction",
        StellarSdk.nativeToScVal(keypair.publicKey(), { type: "address" }),
        StellarSdk.nativeToScVal(TOKEN_ADDRESS, { type: "address" }),
        StellarSdk.nativeToScVal(title, { type: "string" }),
        StellarSdk.nativeToScVal(Number(duration), { type: "u64" })
      );
      await simulateAndSend(account, op, keypair);
      notify("Auction created!", "success");
      setTitle("");
      setDuration("");
      fetchAuctions();
    } catch (e) {
      notify("Error: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function placeBid() {
    if (!keypair) return notify("Connect wallet first", "error");
    if (!bidAuctionId || !bidAmount) return notify("Fill in auction ID and amount", "error");
    try {
      setLoading(true);
      const account = await rpc.getAccount(keypair.publicKey());
      const op = contract.call(
        "place_bid",
        StellarSdk.nativeToScVal(Number(bidAuctionId), { type: "u64" }),
        StellarSdk.nativeToScVal(keypair.publicKey(), { type: "address" }),
        StellarSdk.nativeToScVal(BigInt(bidAmount) * BigInt(10_000_000), { type: "i128" })
      );
      await simulateAndSend(account, op, keypair);
      notify("Bid placed!", "success");
      setBidAuctionId("");
      setBidAmount("");
      fetchAuctions();
    } catch (e) {
      notify("Error: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function finalizeAuction() {
    if (!keypair) return notify("Connect wallet first", "error");
    if (!finalizeId) return notify("Enter auction ID", "error");
    try {
      setLoading(true);
      const account = await rpc.getAccount(keypair.publicKey());
      const op = contract.call(
        "finalize_auction",
        StellarSdk.nativeToScVal(Number(finalizeId), { type: "u64" })
      );
      await simulateAndSend(account, op, keypair);
      notify("Auction finalized!", "success");
      setFinalizeId("");
      fetchAuctions();
    } catch (e) {
      notify("Error: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function cancelAuction() {
    if (!keypair) return notify("Connect wallet first", "error");
    if (!cancelId) return notify("Enter auction ID", "error");
    try {
      setLoading(true);
      const account = await rpc.getAccount(keypair.publicKey());
      const op = contract.call(
        "cancel_auction",
        StellarSdk.nativeToScVal(Number(cancelId), { type: "u64" })
      );
      await simulateAndSend(account, op, keypair);
      notify("Auction cancelled!", "success");
      setCancelId("");
      fetchAuctions();
    } catch (e) {
      notify("Error: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAuctions(); }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">

        <h1 className="text-4xl font-bold text-center mb-2 text-indigo-400">
          No-Loss Auction
        </h1>
        <p className="text-center text-gray-400 mb-8 text-sm">
          Powered by Stellar Soroban — Contract: {CONTRACT_ID.slice(0, 12)}...
        </p>

        {message && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${
            messageType === "success" ? "bg-green-900 text-green-300" :
            messageType === "error" ? "bg-red-900 text-red-300" :
            "bg-blue-900 text-blue-300"
          }`}>
            {message}
          </div>
        )}

        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-indigo-300">Connect Wallet</h2>
          <div className="flex gap-3">
            <input
              type="password"
              placeholder="Enter your secret key (S...)"
              value={secretKey}
              onChange={e => setSecretKey(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={connectWallet}
              className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg text-sm font-medium transition"
            >
              Connect
            </button>
          </div>
          {keypair && (
            <p className="mt-2 text-xs text-green-400">
              Connected: {keypair.publicKey().slice(0, 20)}...
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-900 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-indigo-300">Create Auction</h2>
            <input
              placeholder="Auction title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm mb-3 focus:outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Duration in seconds (e.g. 3600)"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm mb-3 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={createAuction}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 py-2 rounded-lg text-sm font-medium transition"
            >
              Create Auction
            </button>
          </div>

          <div className="bg-gray-900 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-indigo-300">Place Bid</h2>
            <input
              placeholder="Auction ID"
              value={bidAuctionId}
              onChange={e => setBidAuctionId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm mb-3 focus:outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Amount in XLM"
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm mb-3 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={placeBid}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 py-2 rounded-lg text-sm font-medium transition"
            >
              Place Bid
            </button>
          </div>

          <div className="bg-gray-900 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-indigo-300">Finalize Auction</h2>
            <input
              placeholder="Auction ID"
              value={finalizeId}
              onChange={e => setFinalizeId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm mb-3 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={finalizeAuction}
              disabled={loading}
              className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 py-2 rounded-lg text-sm font-medium transition"
            >
              Finalize Auction
            </button>
          </div>

          <div className="bg-gray-900 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-indigo-300">Cancel Auction</h2>
            <input
              placeholder="Auction ID"
              value={cancelId}
              onChange={e => setCancelId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm mb-3 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={cancelAuction}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 py-2 rounded-lg text-sm font-medium transition"
            >
              Cancel Auction
            </button>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-indigo-300">Live Auctions</h2>
            <button
              onClick={fetchAuctions}
              disabled={loading}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-1 rounded-lg text-xs transition"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {auctions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No auctions yet</p>
          ) : (
            <div className="space-y-4">
              {auctions.map((a) => (
                <div key={String(a.auction_id)} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-gray-400">#{String(a.auction_id)}</span>
                      <h3 className="font-medium text-white">{String(a.title)}</h3>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      a.finalized ? "bg-gray-700 text-gray-400" : "bg-green-900 text-green-400"
                    }`}>
                      {a.finalized ? "Finalized" : "Active"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <span>Highest bid: <span className="text-white">
                      {String(BigInt(a.highest_bid) / BigInt(10_000_000))} XLM
                    </span></span>
                    <span>Ends: <span className="text-white">
                      {new Date(Number(a.end_time) * 1000).toLocaleString()}
                    </span></span>
                    <span className="col-span-2">Top bidder: <span className="text-indigo-300 break-all">
                      {a.highest_bidder ? String(a.highest_bidder).slice(0, 20) + "..." : "None"}
                    </span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
