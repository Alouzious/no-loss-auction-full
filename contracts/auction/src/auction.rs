use soroban_sdk::{contract, contractimpl, token, Address, Env, String};

use crate::{
    error::ContractError,
    events::{AuctionCancelled, AuctionFinalized, BidPlaced},
    storage::{Auction, DataKey},
};

#[contract]
pub struct AuctionContract;

#[contractimpl]
impl AuctionContract {
    pub fn create_auction(
        env: Env,
        admin: Address,
        token: Address,
        title: String,
        duration_seconds: u64,
    ) -> u64 {
        admin.require_auth();

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::AuctionCount)
            .unwrap_or(0);

        count += 1;

        let auction = Auction {
            auction_id: count,
            title,
            admin,
            token,
            highest_bidder: None,
            highest_bid: 0,
            end_time: env.ledger().timestamp() + duration_seconds,
            finalized: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Auction(count), &auction);

        env.storage()
            .instance()
            .set(&DataKey::AuctionCount, &count);

        count
    }

    pub fn place_bid(
        env: Env,
        auction_id: u64,
        bidder: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        bidder.require_auth();

        let mut auction: Auction = env
            .storage()
            .persistent()
            .get(&DataKey::Auction(auction_id))
            .ok_or(ContractError::AuctionNotFound)?;

        if env.ledger().timestamp() >= auction.end_time {
            return Err(ContractError::AuctionEnded);
        }

        if amount <= auction.highest_bid {
            return Err(ContractError::BidTooLow);
        }

        let contract_address = env.current_contract_address();
        let token_client = token::Client::new(&env, &auction.token);

        if let Some(prev_bidder) = auction.highest_bidder.clone() {
            token_client.transfer(&contract_address, &prev_bidder, &auction.highest_bid);
        }

        token_client.transfer(&bidder, &contract_address, &amount);

        auction.highest_bidder = Some(bidder.clone());
        auction.highest_bid = amount;

        env.storage()
            .persistent()
            .set(&DataKey::Auction(auction_id), &auction);

        BidPlaced { auction_id, bidder, amount }.publish(&env);

        Ok(())
    }

    pub fn finalize_auction(env: Env, auction_id: u64) -> Result<(), ContractError> {
        let mut auction: Auction = env
            .storage()
            .persistent()
            .get(&DataKey::Auction(auction_id))
            .ok_or(ContractError::AuctionNotFound)?;

        if env.ledger().timestamp() < auction.end_time {
            return Err(ContractError::AuctionNotEnded);
        }

        if auction.finalized {
            return Err(ContractError::AlreadyFinalized);
        }

        if auction.highest_bidder.is_none() {
            return Err(ContractError::NoBids);
        }

        let contract_address = env.current_contract_address();
        let token_client = token::Client::new(&env, &auction.token);

        token_client.transfer(&contract_address, &auction.admin, &auction.highest_bid);

        auction.finalized = true;

        env.storage()
            .persistent()
            .set(&DataKey::Auction(auction_id), &auction);

        AuctionFinalized {
            auction_id,
            winner: auction.highest_bidder.unwrap(),
            amount: auction.highest_bid,
        }
        .publish(&env);

        Ok(())
    }

    pub fn cancel_auction(env: Env, auction_id: u64) -> Result<(), ContractError> {
        let auction: Auction = env
            .storage()
            .persistent()
            .get(&DataKey::Auction(auction_id))
            .ok_or(ContractError::AuctionNotFound)?;

        auction.admin.require_auth();

        if auction.highest_bidder.is_some() {
            return Err(ContractError::AuctionHasBids);
        }

        env.storage()
            .persistent()
            .remove(&DataKey::Auction(auction_id));

        AuctionCancelled { auction_id }.publish(&env);

        Ok(())
    }

    pub fn get_auction(env: Env, auction_id: u64) -> Option<Auction> {
        env.storage()
            .persistent()
            .get(&DataKey::Auction(auction_id))
    }

    pub fn get_auction_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::AuctionCount)
            .unwrap_or(0)
    }
}
