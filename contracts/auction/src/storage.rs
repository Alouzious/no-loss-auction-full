use soroban_sdk::{contracttype, Address, String};

#[contracttype]
#[derive(Clone)]
pub struct Auction {
    pub auction_id: u64,
    pub title: String,
    pub admin: Address,
    pub token: Address,
    pub highest_bidder: Option<Address>,
    pub highest_bid: i128,
    pub end_time: u64,
    pub finalized: bool,
}

#[contracttype]
pub enum DataKey {
    AuctionCount,
    Auction(u64),
}
