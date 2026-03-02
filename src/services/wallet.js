/**
 * Wallet Service — Freighter API wrapper
 * Compatible with @stellar/freighter-api v6+
 */

import { isConnected, requestAccess, getAddress, signTransaction } from '@stellar/freighter-api';

/**
 * Check if Freighter extension is installed
 * @returns {Promise<boolean>}
 */
export async function checkFreighterInstalled() {
    try {
        const result = await isConnected();
        return result.isConnected || false;
    } catch {
        return false;
    }
}

/**
 * Connect to Freighter wallet
 * @returns {Promise<{publicKey: string}>}
 */
export async function connectWallet() {
    const connected = await checkFreighterInstalled();
    if (!connected) {
        throw new Error('Freighter wallet extension is not installed. Please install it from freighter.app');
    }

    const accessResult = await requestAccess();
    if (accessResult.error) {
        throw new Error(accessResult.error);
    }

    const addrResult = await getAddress();
    if (addrResult.error) {
        throw new Error(addrResult.error);
    }

    return { publicKey: addrResult.address || addrResult };
}

/**
 * Get current public key (if already connected)
 * @returns {Promise<string|null>}
 */
export async function getWalletPublicKey() {
    try {
        const result = await getAddress();
        return result.address || result || null;
    } catch {
        return null;
    }
}

/**
 * Sign a transaction XDR with Freighter
 * @param {string} xdr - Transaction XDR
 * @param {string} network - TESTNET or PUBLIC
 * @returns {Promise<string>} Signed XDR
 */
export async function signTransactionXDR(xdr, network = 'TESTNET') {
    const result = await signTransaction(xdr, {
        networkPassphrase: network === 'TESTNET'
            ? 'Test SDF Network ; September 2015'
            : 'Public Global Stellar Network ; September 2015',
    });

    if (result.error) {
        throw new Error(result.error);
    }

    return result.signedTxXdr || result;
}

/**
 * Disconnect wallet (clear local state)
 */
export function disconnectWallet() {
    return true;
}

/**
 * Shorten address for display
 * @param {string} address
 * @returns {string}
 */
export function shortenAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
