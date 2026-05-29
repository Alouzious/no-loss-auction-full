import { useState, useEffect } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc";
import {
  CONTRACT_ID,
  NETWORK_PASSPHRASE,
  TOKEN_ADDRESS,
  rpc,
  simulateAndSend,
} from "./lib/contract";

const contract = new StellarSdk.Contract(CONTRACT_ID);
const DUMMY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

function readCall(op) {
  const tx = new StellarSdk.TransactionBuilder(
    new StellarSdk.Account(DUMMY, "0"),
    { fee: StellarSdk.BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }
  ).addOperation(op).setTimeout(30).build();
  return rpc.simulateTransaction(tx);
}

export default function App() {
  const [secretKey, setSecretKey] = useState("");
  const [keypair, setKeypair] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("auctions");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [bidAuctionId, setBidAuctionId] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [finalizeId, setFinalizeId] = useState("");
  const [cancelId, setCancelId] = useState("");

  function notify(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  function connectWallet() {
    try {
      const kp = StellarSdk.Keypair.fromSecret(secretKey.trim());
      setKeypair(kp);
      notify("Wallet connected");
    } catch {
      notify("Invalid secret key", "error");
    }
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
      notify("Failed to load auctions", "error");
    } finally {
      setLoading(false);
    }
  }

  async function createAuction() {
    if (!keypair) return notify("Connect wallet first", "error");
    if (!title || !duration) return notify("Fill all fields", "error");
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
      notify("Auction created successfully");
      setTitle(""); setDuration("");
      fetchAuctions();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function placeBid() {
    if (!keypair) return notify("Connect wallet first", "error");
    if (!bidAuctionId || !bidAmount) return notify("Fill all fields", "error");
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
      notify("Bid placed successfully");
      setBidAuctionId(""); setBidAmount("");
      fetchAuctions();
    } catch (e) {
      notify(e.message, "error");
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
      await simulateAndSend(account,
        contract.call("finalize_auction", StellarSdk.nativeToScVal(Number(finalizeId), { type: "u64" })),
        keypair
      );
      notify("Auction finalized");
      setFinalizeId("");
      fetchAuctions();
    } catch (e) {
      notify(e.message, "error");
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
      await simulateAndSend(account,
        contract.call("cancel_auction", StellarSdk.nativeToScVal(Number(cancelId), { type: "u64" })),
        keypair
      );
      notify("Auction cancelled");
      setCancelId("");
      fetchAuctions();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAuctions(); }, []);

  const activeAuctions = auctions.filter(a => !a.finalized);
  const finalizedAuctions = auctions.filter(a => a.finalized);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>

      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 1000,
          background: toast.type === "error" ? "#2a0f0f" : "#0f2a1a",
          border: `1px solid ${toast.type === "error" ? "#ff4444" : "#00ff88"}`,
          color: toast.type === "error" ? "#ff6666" : "#00ff88",
          padding: "12px 20px", borderRadius: 6,
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 13,
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)"
        }}>
          {toast.type === "error" ? "✗ " : "✓ "}{toast.msg}
        </div>
      )}

      <div style={{ borderBottom: "1px solid #1a1a2e", padding: "0 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 32, height: 32, background: "linear-gradient(135deg, #00ff88 0%, #0088ff 100%)",
              borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <span style={{ fontSize: 16 }}>⬡</span>
            </div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px" }}>
              BITLOT
            </span>
            <span style={{ fontSize: 11, color: "#444", marginLeft: 4, fontWeight: 300 }}>/ TESTNET</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {keypair ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#0f2a1a", border: "1px solid #00ff8830", borderRadius: 6, padding: "8px 14px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88" }} />
                <span style={{ fontSize: 12, color: "#00ff88", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {keypair.publicKey().slice(0, 8)}...{keypair.publicKey().slice(-4)}
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="password"
                  placeholder="secret key..."
                  value={secretKey}
                  onChange={e => setSecretKey(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && connectWallet()}
                  style={{
                    background: "#111", border: "1px solid #1a1a2e", borderRadius: 6,
                    padding: "8px 14px", color: "#e8e8f0", fontSize: 12,
                    fontFamily: "'IBM Plex Mono', monospace", width: 220,
                    outline: "none"
                  }}
                />
                <button onClick={connectWallet} style={{
                  background: "#00ff88", color: "#000", border: "none",
                  borderRadius: 6, padding: "8px 16px", fontWeight: 600,
                  fontSize: 12, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace"
                }}>
                  CONNECT
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px" }}>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 40 }}>
          {[
            { label: "TOTAL AUCTIONS", value: auctions.length, accent: "#0088ff" },
            { label: "ACTIVE", value: activeAuctions.length, accent: "#00ff88" },
            { label: "FINALIZED", value: finalizedAuctions.length, accent: "#888" },
          ].map(stat => (
            <div key={stat.label} style={{
              background: "#0d0d17", border: "1px solid #1a1a2e",
              borderRadius: 8, padding: "20px 24px"
            }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 8 }}>{stat.label}</div>
              <div style={{ fontSize: 36, fontWeight: 600, color: stat.accent, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>

          <div>
            <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid #1a1a2e" }}>
              {["auctions", "finalized"].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  background: "none", border: "none", padding: "12px 20px",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                  letterSpacing: 1, fontFamily: "'IBM Plex Mono', monospace",
                  color: activeTab === tab ? "#00ff88" : "#444",
                  borderBottom: activeTab === tab ? "2px solid #00ff88" : "2px solid transparent",
                  marginBottom: -1
                }}>
                  {tab.toUpperCase()} ({tab === "auctions" ? activeAuctions.length : finalizedAuctions.length})
                </button>
              ))}
              <button onClick={fetchAuctions} disabled={loading} style={{
                background: "none", border: "none", padding: "12px 16px",
                color: "#333", cursor: "pointer", marginLeft: "auto", fontSize: 13
              }}>
                {loading ? "⟳" : "↻"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(activeTab === "auctions" ? activeAuctions : finalizedAuctions).length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#333", fontSize: 13 }}>
                  — no auctions —
                </div>
              ) : (
                (activeTab === "auctions" ? activeAuctions : finalizedAuctions).map(a => (
                  <div key={String(a.auction_id)} style={{
                    background: "#0d0d17", border: "1px solid #1a1a2e",
                    borderRadius: 8, padding: "20px 24px",
                    borderLeft: a.finalized ? "3px solid #333" : "3px solid #00ff88"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#444", letterSpacing: 2, marginBottom: 4 }}>
                          AUCTION #{String(a.auction_id)}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
                          {String(a.title)}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 10, padding: "4px 10px", borderRadius: 4, letterSpacing: 1,
                        background: a.finalized ? "#1a1a1a" : "#0f2a1a",
                        color: a.finalized ? "#555" : "#00ff88",
                        border: `1px solid ${a.finalized ? "#222" : "#00ff8830"}`
                      }}>
                        {a.finalized ? "CLOSED" : "LIVE"}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#444", letterSpacing: 1, marginBottom: 4 }}>HIGHEST BID</div>
                        <div style={{ fontSize: 20, fontWeight: 600, color: "#0088ff", fontFamily: "'Space Grotesk', sans-serif" }}>
                          {String(BigInt(a.highest_bid) / BigInt(10_000_000))} <span style={{ fontSize: 11, color: "#444" }}>XLM</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#444", letterSpacing: 1, marginBottom: 4 }}>DEADLINE</div>
                        <div style={{ fontSize: 13, color: "#aaa" }}>
                          {new Date(Number(a.end_time) * 1000).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: 11, color: "#555" }}>
                          {new Date(Number(a.end_time) * 1000).toLocaleTimeString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#444", letterSpacing: 1, marginBottom: 4 }}>TOP BIDDER</div>
                        <div style={{ fontSize: 12, color: "#888", fontFamily: "'IBM Plex Mono', monospace" }}>
                          {a.highest_bidder
                            ? String(a.highest_bidder).slice(0, 6) + "..." + String(a.highest_bidder).slice(-4)
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <Panel title="CREATE AUCTION">
              <Field label="TITLE">
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Rare NFT #001" />
              </Field>
              <Field label="DURATION (SECONDS)">
                <Input value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 3600" />
              </Field>
              <Btn onClick={createAuction} disabled={loading} color="#00ff88">CREATE →</Btn>
            </Panel>

            <Panel title="PLACE BID">
              <Field label="AUCTION ID">
                <Input value={bidAuctionId} onChange={e => setBidAuctionId(e.target.value)} placeholder="1" />
              </Field>
              <Field label="AMOUNT (XLM)">
                <Input value={bidAmount} onChange={e => setBidAmount(e.target.value)} placeholder="100" />
              </Field>
              <Btn onClick={placeBid} disabled={loading} color="#0088ff">BID →</Btn>
            </Panel>

            <Panel title="FINALIZE">
              <Field label="AUCTION ID">
                <Input value={finalizeId} onChange={e => setFinalizeId(e.target.value)} placeholder="1" />
              </Field>
              <Btn onClick={finalizeAuction} disabled={loading} color="#ffaa00">FINALIZE →</Btn>
            </Panel>

            <Panel title="CANCEL">
              <Field label="AUCTION ID">
                <Input value={cancelId} onChange={e => setCancelId(e.target.value)} placeholder="1" />
              </Field>
              <Btn onClick={cancelAuction} disabled={loading} color="#ff4444">CANCEL →</Btn>
            </Panel>

          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div style={{ background: "#0d0d17", border: "1px solid #1a1a2e", borderRadius: 8, padding: "20px" }}>
      <div style={{ fontSize: 10, color: "#444", letterSpacing: 2, marginBottom: 16 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#555", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%", background: "#111", border: "1px solid #1a1a2e",
        borderRadius: 6, padding: "10px 14px", color: "#e8e8f0",
        fontSize: 13, fontFamily: "'IBM Plex Mono', monospace",
        outline: "none", boxSizing: "border-box"
      }}
    />
  );
}

function Btn({ onClick, disabled, color, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", background: "transparent",
      border: `1px solid ${color}`,
      color: color, borderRadius: 6, padding: "10px",
      fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1,
      opacity: disabled ? 0.4 : 1, transition: "background 0.15s"
    }}
      onMouseEnter={e => !disabled && (e.target.style.background = color + "15")}
      onMouseLeave={e => e.target.style.background = "transparent"}
    >
      {children}
    </button>
  );
}
