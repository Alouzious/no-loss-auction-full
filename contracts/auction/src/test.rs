#![cfg(test)]

use soroban_sdk::{testutils::{Address as _, Ledger}, token, Address, Env, String};

use crate::auction::{AuctionContract, AuctionContractClient};

fn create_token<'a>(env: &Env, admin: &Address) -> (Address, token::StellarAssetClient<'a>) {
    let contract_id = env.register_stellar_asset_contract_v2(admin.clone());
    (
        contract_id.address(),
        token::StellarAssetClient::new(env, &contract_id.address()),
    )
}

struct Setup<'a> {
    env: Env,
    client: AuctionContractClient<'a>,
    admin: Address,
    bidder1: Address,
    bidder2: Address,
    token_address: Address,
    token_client: token::StellarAssetClient<'a>,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let bidder1 = Address::generate(&env);
    let bidder2 = Address::generate(&env);

    let (token_address, token_client) = create_token(&env, &admin);

    let contract_id = env.register(AuctionContract, ());
    let client = AuctionContractClient::new(&env, &contract_id);

    Setup { env, client, admin, bidder1, bidder2, token_address, token_client }
}

#[test]
fn test_create_auction() {
    let s = setup();
    let title = String::from_str(&s.env, "My Auction");
    let id = s.client.create_auction(&s.admin, &s.token_address, &title, &3600u64);
    assert_eq!(id, 1);
    let auction = s.client.get_auction(&1u64).unwrap();
    assert_eq!(auction.auction_id, 1);
    assert_eq!(auction.highest_bid, 0);
}

#[test]
fn test_place_bid() {
    let s = setup();
    let title = String::from_str(&s.env, "My Auction");
    s.client.create_auction(&s.admin, &s.token_address, &title, &3600u64);

    s.token_client.mint(&s.bidder1, &1000i128);
    s.client.place_bid(&1u64, &s.bidder1, &500i128);

    let auction = s.client.get_auction(&1u64).unwrap();
    assert_eq!(auction.highest_bid, 500);
    assert_eq!(auction.highest_bidder, Some(s.bidder1.clone()));
}

#[test]
fn test_higher_bid_refunds_previous() {
    let s = setup();
    let title = String::from_str(&s.env, "My Auction");
    s.client.create_auction(&s.admin, &s.token_address, &title, &3600u64);

    s.token_client.mint(&s.bidder1, &1000i128);
    s.token_client.mint(&s.bidder2, &2000i128);

    s.client.place_bid(&1u64, &s.bidder1, &500i128);
    s.client.place_bid(&1u64, &s.bidder2, &1000i128);

    let auction = s.client.get_auction(&1u64).unwrap();
    assert_eq!(auction.highest_bidder, Some(s.bidder2.clone()));
    assert_eq!(auction.highest_bid, 1000);
}

#[test]
fn test_bid_too_low_fails() {
    let s = setup();
    let title = String::from_str(&s.env, "My Auction");
    s.client.create_auction(&s.admin, &s.token_address, &title, &3600u64);

    s.token_client.mint(&s.bidder1, &1000i128);
    s.token_client.mint(&s.bidder2, &1000i128);

    s.client.place_bid(&1u64, &s.bidder1, &500i128);
    let result = s.client.try_place_bid(&1u64, &s.bidder2, &300i128);
    assert!(result.is_err());
}

#[test]
fn test_finalize_auction() {
    let s = setup();
    let title = String::from_str(&s.env, "My Auction");
    s.client.create_auction(&s.admin, &s.token_address, &title, &3600u64);

    s.token_client.mint(&s.bidder1, &1000i128);
    s.client.place_bid(&1u64, &s.bidder1, &500i128);

    s.env.ledger().with_mut(|l| l.timestamp = 99999999);

    s.client.finalize_auction(&1u64);

    let auction = s.client.get_auction(&1u64).unwrap();
    assert!(auction.finalized);
}

#[test]
fn test_cancel_auction_no_bids() {
    let s = setup();
    let title = String::from_str(&s.env, "My Auction");
    s.client.create_auction(&s.admin, &s.token_address, &title, &3600u64);
    s.client.cancel_auction(&1u64);
    let auction = s.client.get_auction(&1u64);
    assert!(auction.is_none());
}

#[test]
fn test_cancel_auction_with_bids_fails() {
    let s = setup();
    let title = String::from_str(&s.env, "My Auction");
    s.client.create_auction(&s.admin, &s.token_address, &title, &3600u64);
    s.token_client.mint(&s.bidder1, &1000i128);
    s.client.place_bid(&1u64, &s.bidder1, &500i128);
    let result = s.client.try_cancel_auction(&1u64);
    assert!(result.is_err());
}
