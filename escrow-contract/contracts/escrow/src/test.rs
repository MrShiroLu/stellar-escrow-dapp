#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env};

fn setup_test() -> (Env, Address, Address, Address, Address, EscrowContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    // Create test accounts
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let arbiter = Address::generate(&env);

    // Deploy the escrow contract
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    // Create and configure a token for testing
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    // Mint tokens to depositor
    token_admin_client.mint(&depositor, &1_000_000_000); // 100 XLM in stroops

    (env, depositor, beneficiary, arbiter, token_address, client)
}

// ========================================
// Happy Path Tests
// ========================================

#[test]
fn test_initialize() {
    let (_env, depositor, beneficiary, arbiter, token, client) = setup_test();
    let amount = 500_000_000;

    let res = client.try_initialize(
        &1,
        &depositor,
        &beneficiary,
        &arbiter,
        &amount, // 50 XLM
        &token,
    );
    assert!(res.is_ok());

    let escrow = client.get_escrow(&1);
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.beneficiary, beneficiary);
    assert_eq!(escrow.arbiter, arbiter);
    assert_eq!(escrow.amount, amount);
    assert_eq!(escrow.token, token);
    assert_eq!(escrow.state, EscrowState::Created);
}

#[test]
fn test_cancel() {
    let (_env, depositor, beneficiary, arbiter, token, client) = setup_test();
    let amount = 500_000_000;

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &amount, &token);
    let res = client.try_cancel(&1, &depositor);
    assert!(res.is_ok());

    let escrow = client.get_escrow(&1);
    assert_eq!(escrow.state, EscrowState::Canceled);
}

#[test]
fn test_deposit() {
    let (env, depositor, beneficiary, arbiter, token, client) = setup_test();
    let amount = 500_000_000;

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &amount, &token);
    client.deposit(&1, &depositor);

    let escrow = client.get_escrow(&1);
    assert_eq!(escrow.state, EscrowState::Funded);

    // Verify token was transferred to contract
    let token_client = token::Client::new(&env, &token);
    let contract_balance = token_client.balance(&client.address);
    assert_eq!(contract_balance, amount);
}

#[test]
fn test_full_approve_flow() {
    let (env, depositor, beneficiary, arbiter, token, client) = setup_test();
    let amount = 500_000_000;
    let token_client = token::Client::new(&env, &token);

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &amount, &token);
    client.deposit(&1, &depositor);
    client.approve(&1, &arbiter);

    let escrow = client.get_escrow(&1);
    assert_eq!(escrow.state, EscrowState::Completed);

    // Verify beneficiary received tokens
    let beneficiary_balance = token_client.balance(&beneficiary);
    assert_eq!(beneficiary_balance, amount);

    // Verify contract is empty
    let contract_balance = token_client.balance(&client.address);
    assert_eq!(contract_balance, 0);
}

#[test]
fn test_refund_flow() {
    let (env, depositor, beneficiary, arbiter, token, client) = setup_test();
    let amount = 500_000_000;
    let token_client = token::Client::new(&env, &token);

    let initial_balance = token_client.balance(&depositor);

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &amount, &token);
    client.deposit(&1, &depositor);

    // Verify deposit deducted
    let after_deposit = token_client.balance(&depositor);
    assert_eq!(after_deposit, initial_balance - amount);

    client.refund(&1, &arbiter);

    let escrow = client.get_escrow(&1);
    assert_eq!(escrow.state, EscrowState::Refunded);

    // Verify depositor got refunded
    let after_refund = token_client.balance(&depositor);
    assert_eq!(after_refund, initial_balance);

    // Verify contract is empty
    let contract_balance = token_client.balance(&client.address);
    assert_eq!(contract_balance, 0);
}

#[test]
fn test_dispute() {
    let (_env, depositor, beneficiary, arbiter, token, client) = setup_test();
    let amount = 500_000_000;

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &amount, &token);
    client.deposit(&1, &depositor);
    client.dispute(&1, &depositor);

    let escrow = client.get_escrow(&1);
    assert_eq!(escrow.state, EscrowState::Disputed);
}

#[test]
fn test_beneficiary_can_dispute() {
    let (_env, depositor, beneficiary, arbiter, token, client) = setup_test();
    let amount = 500_000_000;

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &amount, &token);
    client.deposit(&1, &depositor);
    client.dispute(&1, &beneficiary);

    let escrow = client.get_escrow(&1);
    assert_eq!(escrow.state, EscrowState::Disputed);
}

// ========================================
// Error / Authorization Tests
// ========================================

#[test]
fn test_double_initialize() {
    let (_env, depositor, beneficiary, arbiter, token, client) = setup_test();
    let amount = 500_000_000;

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &amount, &token);
    // Second init should fail
    let res = client.try_initialize(&1, &depositor, &beneficiary, &arbiter, &amount, &token);
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from_contract_error(1)))); // AlreadyInitialized = 1
}

#[test]
fn test_unauthorized_deposit() {
    let (_env, depositor, beneficiary, arbiter, token, client) = setup_test();
    let amount = 500_000_000;

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &amount, &token);
    // Beneficiary tries to deposit — should fail (NotAuthorized = 3)
    let res = client.try_deposit(&1, &beneficiary);
    // With env.mock_all_auths() this actually will still pass the require_auth call natively,
    // but the `escrow.depositor != depositor` check should fail:
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from_contract_error(3))));
}

#[test]
fn test_unauthorized_approve() {
    let (_env, depositor, beneficiary, arbiter, token, client) = setup_test();
    let amount = 500_000_000;

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &amount, &token);
    client.deposit(&1, &depositor);
    // Depositor tries to approve — should fail
    let res = client.try_approve(&1, &depositor);
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from_contract_error(3))));
}

#[test]
fn test_unauthorized_refund() {
    let (_env, depositor, beneficiary, arbiter, token, client) = setup_test();
    let amount = 500_000_000;

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &amount, &token);
    client.deposit(&1, &depositor);
    // Beneficiary tries to refund — should fail
    let res = client.try_refund(&1, &beneficiary);
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from_contract_error(3))));
}

#[test]
fn test_unauthorized_dispute() {
    let (_env, depositor, beneficiary, arbiter, token, client) = setup_test();
    let amount = 500_000_000;

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &amount, &token);
    client.deposit(&1, &depositor);
    // Arbiter tries to dispute — should fail
    let res = client.try_dispute(&1, &arbiter);
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from_contract_error(3))));
}

#[test]
fn test_double_deposit() {
    let (_env, depositor, beneficiary, arbiter, token, client) = setup_test();

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &500_000_000, &token);
    client.deposit(&1, &depositor);
    // Double deposit should fail (InvalidState = 4)
    let res = client.try_deposit(&1, &depositor);
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from_contract_error(4))));
}

#[test]
fn test_approve_before_deposit() {
    let (_env, depositor, beneficiary, arbiter, token, client) = setup_test();

    client.initialize(&1, &depositor, &beneficiary, &arbiter, &500_000_000, &token);
    // Approve without deposit should fail (InvalidState = 4)
    let res = client.try_approve(&1, &arbiter);
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from_contract_error(4))));
}

#[test]
fn test_zero_amount() {
    let (_env, depositor, beneficiary, arbiter, token, client) = setup_test();

    let res = client.try_initialize(&1, &depositor, &beneficiary, &arbiter, &0, &token);
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from_contract_error(5)))); // InvalidAmount = 5
}

