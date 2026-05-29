use soroban_sdk::{contractevent, Address};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BidPlaced {
    #[topic]
    pub auction_id: u64,
    #[topic]
    pub bidder: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuctionFinalized {
    #[topic]
    pub auction_id: u64,
    pub winner: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuctionCancelled {
    #[topic]
    pub auction_id: u64,
}
