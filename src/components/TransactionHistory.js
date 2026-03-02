import React from 'react';
import { shortenAddress } from '../services/wallet';
import { SkeletonText } from './SkeletonLoader';

/**
 * Transaction history list with Stellar Expert links
 */
export function TransactionHistory({ transactions = [], loading, stellarExpertUrl }) {
    if (loading) {
        return (
            <div className="tx-history-section">
                <div className="section-title">Transaction History</div>
                <div className="card">
                    <SkeletonText lines={4} />
                </div>
            </div>
        );
    }

    return (
        <div className="tx-history-section">
            <div className="section-title">Transaction History</div>
            <div className="card">
                {transactions.length === 0 ? (
                    <div className="escrow-empty">
                        <p>No transactions yet.</p>
                    </div>
                ) : (
                    <div className="tx-list">
                        {transactions.map(tx => (
                            <div key={tx.id} className="tx-item">
                                <div className="tx-item-left">
                                    <span className={`badge ${tx.successful ? 'badge-completed' : 'badge-disputed'}`}>
                                        <span className="badge-dot" />
                                        {tx.successful ? 'Success' : 'Failed'}
                                    </span>
                                    <div>
                                        <div className="tx-type">{tx.memo || 'Transaction'}</div>
                                        <a
                                            href={`${stellarExpertUrl}/tx/${tx.hash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="explorer-link tx-hash"
                                        >
                                            {shortenAddress(tx.hash)} ↗
                                        </a>
                                    </div>
                                </div>
                                <div className="tx-time">
                                    {new Date(tx.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default TransactionHistory;
