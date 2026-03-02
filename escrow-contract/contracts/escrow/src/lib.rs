#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    InvalidState = 4,
    InvalidAmount = 5,
}

/// Escrow lifecycle states
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub enum EscrowState {
    Created,
    Funded,
    Completed,
    Refunded,
    Disputed,
    Canceled,
}

/// Escrow data stored on-chain
#[derive(Clone, Debug)]
#[contracttype]
pub struct EscrowData {
    pub depositor: Address,
    pub beneficiary: Address,
    pub arbiter: Address,
    pub amount: i128,
    pub token: Address,
    pub state: EscrowState,
}

/// Storage keys
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Escrow(u64),
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize a new escrow with a unique ID.
    pub fn initialize(
        env: Env,
        id: u64,
        depositor: Address,
        beneficiary: Address,
        arbiter: Address,
        amount: i128,
        token: Address,
    ) -> Result<(), EscrowError> {
        // Ensure not already initialized
        if env.storage().persistent().has(&DataKey::Escrow(id)) {
            return Err(EscrowError::AlreadyInitialized);
        }

        // Validate inputs
        if amount <= 0 {
            return Err(EscrowError::InvalidAmount);
        }

        // Require depositor authorization
        depositor.require_auth();

        let escrow = EscrowData {
            depositor,
            beneficiary,
            arbiter,
            amount,
            token,
            state: EscrowState::Created,
        };

        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        
        // Publish event
        env.events().publish(
            (symbol_short!("Escrow"), symbol_short!("Init")),
            id,
        );
        
        Ok(())
    }

    /// Cancel the escrow if it hasn't been funded yet (Created state).
    pub fn cancel(env: Env, id: u64, caller: Address) -> Result<(), EscrowError> {
        caller.require_auth();

        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::NotInitialized)?;

        if escrow.depositor != caller {
            return Err(EscrowError::NotAuthorized);
        }
        if escrow.state != EscrowState::Created {
            return Err(EscrowError::InvalidState);
        }

        escrow.state = EscrowState::Canceled;
        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        
        // Publish event
        env.events().publish(
            (symbol_short!("Escrow"), symbol_short!("Cancel")),
            id,
        );
        
        Ok(())
    }

    /// Deposit tokens into the escrow.
    pub fn deposit(env: Env, id: u64, depositor: Address) -> Result<(), EscrowError> {
        depositor.require_auth();

        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::NotInitialized)?;

        if escrow.depositor != depositor {
            return Err(EscrowError::NotAuthorized);
        }
        if escrow.state != EscrowState::Created {
            return Err(EscrowError::InvalidState);
        }

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(
            &escrow.depositor,
            &env.current_contract_address(),
            &escrow.amount,
        );

        escrow.state = EscrowState::Funded;
        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        
        // Publish event
        env.events().publish(
            (symbol_short!("Escrow"), symbol_short!("Deposit")),
            id,
        );
        
        Ok(())
    }

    /// Approve the escrow — release funds to the beneficiary.
    pub fn approve(env: Env, id: u64, arbiter: Address) -> Result<(), EscrowError> {
        arbiter.require_auth();

        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::NotInitialized)?;

        if escrow.arbiter != arbiter {
            return Err(EscrowError::NotAuthorized);
        }
        if escrow.state != EscrowState::Funded && escrow.state != EscrowState::Disputed {
            return Err(EscrowError::InvalidState);
        }

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(
            &env.current_contract_address(),
            &escrow.beneficiary,
            &escrow.amount,
        );

        escrow.state = EscrowState::Completed;
        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        
        // Publish event
        env.events().publish(
            (symbol_short!("Escrow"), symbol_short!("Approve")),
            id,
        );
        
        Ok(())
    }

    /// Refund the escrow — return funds to the depositor.
    pub fn refund(env: Env, id: u64, arbiter: Address) -> Result<(), EscrowError> {
        arbiter.require_auth();

        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::NotInitialized)?;

        if escrow.arbiter != arbiter {
            return Err(EscrowError::NotAuthorized);
        }
        if escrow.state != EscrowState::Funded && escrow.state != EscrowState::Disputed {
            return Err(EscrowError::InvalidState);
        }

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(
            &env.current_contract_address(),
            &escrow.depositor,
            &escrow.amount,
        );

        escrow.state = EscrowState::Refunded;
        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        
        // Publish event
        env.events().publish(
            (symbol_short!("Escrow"), symbol_short!("Refund")),
            id,
        );
        
        Ok(())
    }

    /// Raise a dispute — either depositor or beneficiary can call this.
    pub fn dispute(env: Env, id: u64, caller: Address) -> Result<(), EscrowError> {
        caller.require_auth();

        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::NotInitialized)?;

        if caller != escrow.depositor && caller != escrow.beneficiary {
            return Err(EscrowError::NotAuthorized);
        }
        if escrow.state != EscrowState::Funded {
            return Err(EscrowError::InvalidState);
        }

        escrow.state = EscrowState::Disputed;
        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        
        // Publish event
        env.events().publish(
            (symbol_short!("Escrow"), symbol_short!("Dispute")),
            id,
        );
        
        Ok(())
    }

    /// Get the current escrow data.
    pub fn get_escrow(env: Env, id: u64) -> Result<EscrowData, EscrowError> {
        env.storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::NotInitialized)
    }
}

mod test;

