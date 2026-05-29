use soroban_sdk::contracterror;

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ContractError {
    AlreadyInitialized = 1,
    AuctionNotFound = 2,
    AuctionEnded = 3,
    AuctionNotEnded = 4,
    BidTooLow = 5,
    NoBids = 6,
    NotAdmin = 7,
    AuctionHasBids = 8,
    AlreadyFinalized = 9,
}
