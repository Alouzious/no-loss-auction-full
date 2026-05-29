# No-Loss Auction Protocol

A decentralized no-loss auction system built on Stellar Soroban.

## Contract ID (Testnet)
`CAH5RGKKZ27D6LDN75XFGHHL73C7OZAEBXY4RKC7WTEEGITNXFV6LVIX`

## Structure
- `contracts/` — Soroban smart contract (Rust)
- `frontend/` — React + Vite + Tailwind frontend

## Features
- Create auctions
- Place bids using XLM (SEP-41 token)
- Automatic refund of previous highest bidder
- Finalize auction after deadline
- Cancel auction only if no bids exist

## Frontend
cd frontend
npm install
npm run dev

## Contract
cargo test
cargo build --target wasm32v1-none --release
