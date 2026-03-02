/**
 * Stellar Service — Soroban RPC & Horizon interaction
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { rpc } from '@stellar/stellar-sdk';
import { cacheGet, cacheSet, cacheInvalidate } from './cache';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

/**
 * Get account balance from Horizon
 * @param {string} publicKey
 * @returns {Promise<string>} XLM balance
 */
export async function getBalance(publicKey) {
    const cacheKey = `balance_${publicKey}`;
    const cached = cacheGet(cacheKey);
    if (cached !== null) return cached;

    try {
        const server = new StellarSdk.Horizon.Server(HORIZON_URL);
        const account = await server.loadAccount(publicKey);
        const native = account.balances.find(b => b.asset_type === 'native');
        const balance = native ? native.balance : '0';

        cacheSet(cacheKey, balance, 15000); // 15s TTL
        return balance;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return '0';
        }
        throw error;
    }
}

/**
 * Fund account with Friendbot (testnet only)
 * @param {string} publicKey
 */
export async function fundWithFriendbot(publicKey) {
    const response = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
    );
    if (!response.ok) {
        throw new Error('Failed to fund account with Friendbot');
    }
    cacheInvalidate(`balance_${publicKey}`);
    return await response.json();
}

/**
 * Build a payment transaction
 * @param {string} sourcePublicKey
 * @param {string} destinationPublicKey
 * @param {string} amount
 * @returns {Promise<string>} Transaction XDR
 */
export async function buildPaymentTransaction(sourcePublicKey, destinationPublicKey, amount) {
    const server = new StellarSdk.Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(sourcePublicKey);

    const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(
            StellarSdk.Operation.payment({
                destination: destinationPublicKey,
                asset: StellarSdk.Asset.native(),
                amount: amount,
            })
        )
        .setTimeout(180)
        .build();

    return transaction.toXDR();
}

/**
 * Submit a signed transaction
 * @param {string} signedXDR
 * @returns {Promise<object>} Transaction result
 */
export async function submitTransaction(signedXDR) {
    const server = new StellarSdk.Horizon.Server(HORIZON_URL);
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
        signedXDR,
        NETWORK_PASSPHRASE
    );
    const result = await server.submitTransaction(transaction);
    return result;
}

/**
 * Get recent transactions for an account
 * @param {string} publicKey
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getTransactionHistory(publicKey, limit = 10) {
    const cacheKey = `tx_history_${publicKey}`;
    const cached = cacheGet(cacheKey);
    if (cached !== null) return cached;

    try {
        const server = new StellarSdk.Horizon.Server(HORIZON_URL);
        const transactions = await server
            .transactions()
            .forAccount(publicKey)
            .order('desc')
            .limit(limit)
            .call();

        const txList = transactions.records.map(tx => ({
            id: tx.id,
            hash: tx.hash,
            createdAt: tx.created_at,
            sourceAccount: tx.source_account,
            successful: tx.successful,
            memo: tx.memo || null,
            feeCharged: tx.fee_charged,
        }));

        cacheSet(cacheKey, txList, 30000); // 30s TTL
        return txList;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return [];
        }
        throw error;
    }
}

export const ESCROW_CONTRACT_ID = 'CBERFLV77LBKN4OFDJRSPYJHLDOK4WLIIYXP6VBYZVB7OBFA5HWPWNKJ';
export const TOKEN_CONTRACT_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'; // Native XLM on Testnet

/**
 * Build a transaction to invoke a Soroban contract
 * @param {string} publicKey
 * @param {string} contractId
 * @param {string} functionName
 * @param {Array<StellarSdk.xdr.ScVal>} args
 */
export async function buildSorobanTransaction(publicKey, contractId, functionName, args = []) {
    const horizonServer = new StellarSdk.Horizon.Server(HORIZON_URL);
    const sorobanServer = new rpc.Server(SOROBAN_RPC_URL);

    const account = await horizonServer.loadAccount(publicKey);
    const contract = new StellarSdk.Contract(contractId);

    let tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(contract.call(functionName, ...args))
        .setTimeout(180)
        .build();

    const simulation = await sorobanServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simulation)) {
        throw new Error(`Simulation failed: ${simulation.error}`);
    }

    const preparedTx = await sorobanServer.prepareTransaction(tx, simulation);
    return preparedTx.toXDR();
}

/**
 * Submit a Soroban transaction and wait for its completion
 * @param {string} signedXDR
 */
export async function submitSorobanTransaction(signedXDR) {
    const sorobanServer = new rpc.Server(SOROBAN_RPC_URL);
    const transaction = StellarSdk.TransactionBuilder.fromXDR(signedXDR, NETWORK_PASSPHRASE);

    const sendResponse = await sorobanServer.sendTransaction(transaction);
    if (sendResponse.status === "ERROR") {
        console.error("Send failed, full response:", JSON.stringify(sendResponse, null, 2));
        const errDetail = sendResponse.errorResult?.message
            || sendResponse.errorResultXdr
            || sendResponse.diagnosticEventsXdr?.[0]
            || JSON.stringify(sendResponse);
        throw new Error(`Send failed: ${errDetail}`);
    }

    let statusResponse = await sorobanServer.getTransaction(sendResponse.hash);
    while (statusResponse.status === "NOT_FOUND") {
        await new Promise(r => setTimeout(r, 2000));
        statusResponse = await sorobanServer.getTransaction(sendResponse.hash);
    }

    if (statusResponse.status === "SUCCESS") {
        return { hash: sendResponse.hash, result: statusResponse };
    } else {
        throw new Error(`Transaction failed: ${statusResponse.resultXdr || "unknown error"}`);
    }
}

/**
 * Read data from a Soroban contract without submitting a transaction
 */
export async function readSorobanData(contractId, functionName, args = []) {
    const sorobanServer = new rpc.Server(SOROBAN_RPC_URL);
    const contract = new StellarSdk.Contract(contractId);

    // Create a dummy transaction for simulation using a random source account
    const source = StellarSdk.Keypair.random().publicKey();
    const account = new StellarSdk.Account(source, "0");

    let tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(contract.call(functionName, ...args))
        .setTimeout(180)
        .build();

    const simulation = await sorobanServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simulation)) {
        throw new Error(`Read simulation failed: ${simulation.error}`);
    }
    if (rpc.Api.isSimulationRestore(simulation)) {
        throw new Error(`State restoration needed`);
    }

    return StellarSdk.scValToNative(simulation.result.retval);
}

/**
 * Attempt to find all escrows for a given account by searching their transaction history
 * for initialize or deposit calls. This acts as a fallback for local cache.
 * @param {string} publicKey 
 * @returns {Promise<Array<string>>} List of Escrow IDs
 */
export async function getEscrowsForAccount(publicKey) {
    const horizonServer = new StellarSdk.Horizon.Server(HORIZON_URL);
    const escrows = new Set();
    try {
        const transactions = await horizonServer
            .transactions()
            .forAccount(publicKey)
            .limit(100)
            .call();

        for (const tx of transactions.records) {
            if (!tx.successful) continue;

            // Getting operations for the transaction
            const ops = await tx.operations();
            for (const op of ops.records) {
                // If the operation is a contract call
                if (op.type === 'invoke_host_function') {
                    // Parse XDR to find Escrow IDs
                }
            }
        }
    } catch (e) {
        console.warn("Could not fetch escrows for account history", e);
    }
    return Array.from(escrows);
}

export { NETWORK_PASSPHRASE, HORIZON_URL, SOROBAN_RPC_URL };
