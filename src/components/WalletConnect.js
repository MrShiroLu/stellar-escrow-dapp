import React, { useState, useCallback } from 'react';
import { connectWallet, shortenAddress } from '../services/wallet';
import { getBalance, fundWithFriendbot } from '../services/stellar';
import { SkeletonText } from './SkeletonLoader';
import { useToast } from './Toast';

/**
 * Wallet connection component
 * @param {Object} props
 * @param {string|null} props.publicKey
 * @param {string|null} props.balance
 * @param {Function} props.onConnect - (publicKey, balance) => void
 * @param {Function} props.onDisconnect
 * @param {boolean} props.loading
 */
export function WalletConnect({ publicKey, balance, onConnect, onDisconnect, loading }) {
    const [connecting, setConnecting] = useState(false);
    const [funding, setFunding] = useState(false);
    const toast = useToast();

    const handleConnect = useCallback(async () => {
        setConnecting(true);
        try {
            const { publicKey: key } = await connectWallet();
            let bal = '0';
            try {
                bal = await getBalance(key);
            } catch {
                // Account may not exist yet
            }
            onConnect(key, bal);
            toast.success('Wallet Connected', shortenAddress(key));
        } catch (error) {
            toast.error('Connection Failed', error.message);
        } finally {
            setConnecting(false);
        }
    }, [onConnect, toast]);

    const handleDisconnect = useCallback(() => {
        onDisconnect();
        toast.info('Disconnected', 'Wallet has been disconnected');
    }, [onDisconnect, toast]);

    const handleFund = useCallback(async () => {
        if (!publicKey) return;
        setFunding(true);
        try {
            await fundWithFriendbot(publicKey);
            const newBalance = await getBalance(publicKey);
            onConnect(publicKey, newBalance);
            toast.success('Funded', '10,000 XLM received from Friendbot');
        } catch (error) {
            toast.error('Funding Failed', error.message);
        } finally {
            setFunding(false);
        }
    }, [publicKey, onConnect, toast]);

    if (loading) {
        return (
            <div className="wallet-section">
                <div className="section-title">Wallet</div>
                <div className="card">
                    <SkeletonText lines={2} />
                </div>
            </div>
        );
    }

    return (
        <div className="wallet-section">
            <div className="section-title">Wallet</div>
            <div className="card">
                {publicKey ? (
                    <div className="wallet-card">
                        <div className="wallet-info">
                            <div className="wallet-avatar">◈</div>
                            <div className="wallet-details">
                                <span className="wallet-address">{shortenAddress(publicKey)}</span>
                                <span className="wallet-balance">{parseFloat(balance || 0).toFixed(2)} XLM</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                            <button
                                className={`btn btn-sm ${funding ? 'btn-loading' : ''}`}
                                onClick={handleFund}
                                disabled={funding}
                                title="Get testnet XLM from Friendbot"
                            >
                                Fund
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={handleDisconnect}>
                                Disconnect
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="wallet-not-connected">
                        <p>Connect your Freighter wallet to interact with the escrow contract on Stellar Testnet.</p>
                        <button
                            className={`btn btn-primary ${connecting ? 'btn-loading' : ''}`}
                            onClick={handleConnect}
                            disabled={connecting}
                            id="connect-wallet-btn"
                        >
                            Connect Wallet
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default WalletConnect;
