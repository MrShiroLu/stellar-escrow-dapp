import React, { useState, useCallback } from 'react';
import { shortenAddress } from '../services/wallet';
import { SkeletonText, SkeletonBox } from './SkeletonLoader';
import EscrowStatus from './EscrowStatus';
import TransactionProgress from './TransactionProgress';
import { useToast } from './Toast';

/**
 * Escrow dashboard — shows escrow details and action buttons
 */
export function EscrowDashboard({ escrow, publicKey, onDeposit, onApprove, onRefund, onDispute, onCancel, onReset, loading, stellarExpertUrl }) {
    const [txStep, setTxStep] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const toast = useToast();

    const executeAction = useCallback(async (actionName, actionFn) => {
        setActionLoading(actionName);
        setTxStep('signing');
        try {
            setTxStep('submitting');
            await actionFn();
            setTxStep('confirming');
            await new Promise(r => setTimeout(r, 1000));
            setTxStep('done');
            toast.success('Transaction Successful', `${actionName} completed`);
            setTimeout(() => setTxStep(null), 1500);
        } catch (error) {
            toast.error('Transaction Failed', error.message);
            setTxStep(null);
        } finally {
            setActionLoading(null);
        }
    }, [toast]);

    if (loading) {
        return (
            <div className="escrow-dashboard-section">
                <div className="section-title">Active Escrow</div>
                <div className="card">
                    <SkeletonText lines={2} />
                    <SkeletonBox height={60} />
                    <SkeletonText lines={4} />
                </div>
            </div>
        );
    }

    if (!escrow) {
        return (
            <div className="escrow-dashboard-section">
                <div className="section-title">Active Escrow</div>
                <div className="card">
                    <div className="escrow-empty">
                        <div className="escrow-empty-icon">◇</div>
                        <p>No active escrow. Create one above to get started.</p>
                    </div>
                </div>
            </div>
        );
    }

    const isDepositor = publicKey === escrow.depositor;
    const isBeneficiary = publicKey === escrow.beneficiary;
    const isArbiter = publicKey === escrow.arbiter;

    const canDeposit = isDepositor && escrow.state === 'awaiting_deposit';
    const canCancel = isDepositor && escrow.state === 'awaiting_deposit';
    const canApprove = isArbiter && (escrow.state === 'funded' || escrow.state === 'disputed');
    const canRefund = isArbiter && (escrow.state === 'funded' || escrow.state === 'disputed');
    const canDispute = (isDepositor || isBeneficiary) && escrow.state === 'funded';
    const isTerminal = ['completed', 'refunded', 'canceled'].includes(escrow.state);

    return (
        <div className="escrow-dashboard-section">
            <div className="section-title">Active Escrow</div>
            <div className="card">
                <div className="card-header">
                    <span className="card-title">Escrow Details</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {isDepositor && '(You: Depositor)'}
                        {isBeneficiary && '(You: Beneficiary)'}
                        {isArbiter && '(You: Arbiter)'}
                        {!isDepositor && !isBeneficiary && !isArbiter && '(Observer)'}
                    </span>
                </div>

                <EscrowStatus state={escrow.state} />

                {escrow.state === 'disputed' && isArbiter && (
                    <div style={{
                        marginTop: 'var(--space-md)',
                        padding: 'var(--space-md)',
                        background: 'rgba(255, 60, 0, 0.1)',
                        border: '1px solid rgba(255, 60, 0, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)'
                    }}>
                        <strong style={{ color: 'var(--color-danger)' }}>⚠ Dispute Raised:</strong> As the Arbiter, please review the case and choose to <b>Approve</b> (send funds to Beneficiary) or <b>Refund</b> (send funds back to Depositor).
                    </div>
                )}

                <TransactionProgress currentStep={txStep} visible={!!txStep} />

                <div className="escrow-details">
                    <div className="escrow-detail-row">
                        <span className="escrow-detail-label">Depositor</span>
                        <span className="escrow-detail-value">
                            <a
                                href={`${stellarExpertUrl}/account/${escrow.depositor}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="explorer-link"
                            >
                                {shortenAddress(escrow.depositor)}
                            </a>
                            {isDepositor && ' (you)'}
                        </span>
                    </div>
                    <div className="escrow-detail-row">
                        <span className="escrow-detail-label">Beneficiary</span>
                        <span className="escrow-detail-value">
                            <a
                                href={`${stellarExpertUrl}/account/${escrow.beneficiary}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="explorer-link"
                            >
                                {shortenAddress(escrow.beneficiary)}
                            </a>
                            {isBeneficiary && ' (you)'}
                        </span>
                    </div>
                    <div className="escrow-detail-row">
                        <span className="escrow-detail-label">Arbiter</span>
                        <span className="escrow-detail-value">
                            <a
                                href={`${stellarExpertUrl}/account/${escrow.arbiter}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="explorer-link"
                            >
                                {shortenAddress(escrow.arbiter)}
                            </a>
                            {isArbiter && ' (you)'}
                        </span>
                    </div>
                    <div className="escrow-detail-row">
                        <span className="escrow-detail-label">Amount</span>
                        <span className="escrow-detail-value">{escrow.amount} XLM</span>
                    </div>
                    <div className="escrow-detail-row">
                        <span className="escrow-detail-label">Created</span>
                        <span className="escrow-detail-value">
                            {new Date(escrow.createdAt).toLocaleDateString()} {new Date(escrow.createdAt).toLocaleTimeString()}
                        </span>
                    </div>
                </div>

                {/* Transaction Hashes */}
                {escrow.txHashes && escrow.txHashes.length > 0 && (
                    <div className="escrow-tx-hashes">
                        <div className="card-title" style={{ marginTop: 'var(--space-lg)', marginBottom: 'var(--space-sm)' }}>
                            Transaction Hashes
                        </div>
                        {escrow.txHashes.map((tx, i) => (
                            <div key={i} className="escrow-detail-row">
                                <span className="escrow-detail-label">{tx.type}</span>
                                <span className="escrow-detail-value">
                                    <a
                                        href={`${stellarExpertUrl}/tx/${tx.hash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="explorer-link"
                                    >
                                        {shortenAddress(tx.hash)} ↗
                                    </a>
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="escrow-actions">
                    {canDeposit && (
                        <button
                            className={`btn btn-primary ${actionLoading === 'Deposit' ? 'btn-loading' : ''}`}
                            onClick={() => executeAction('Deposit', onDeposit)}
                            disabled={!!actionLoading}
                            id="deposit-btn"
                        >
                            Deposit {escrow.amount} XLM
                        </button>
                    )}
                    {canCancel && (
                        <button
                            className={`btn ${actionLoading === 'Cancel' ? 'btn-loading' : ''}`}
                            onClick={() => executeAction('Cancel', onCancel)}
                            disabled={!!actionLoading}
                            id="cancel-btn"
                            style={{ marginLeft: 'var(--space-md)' }}
                        >
                            Cancel Escrow
                        </button>
                    )}
                    {canApprove && (
                        <button
                            className={`btn btn-success ${actionLoading === 'Approve' ? 'btn-loading' : ''}`}
                            onClick={() => executeAction('Approve', onApprove)}
                            disabled={!!actionLoading}
                            id="approve-btn"
                        >
                            Approve Release
                        </button>
                    )}
                    {canRefund && (
                        <button
                            className={`btn btn-danger ${actionLoading === 'Refund' ? 'btn-loading' : ''}`}
                            onClick={() => executeAction('Refund', onRefund)}
                            disabled={!!actionLoading}
                            id="refund-btn"
                        >
                            Refund
                        </button>
                    )}
                    {canDispute && (
                        <button
                            className={`btn ${actionLoading === 'Dispute' ? 'btn-loading' : ''}`}
                            onClick={() => executeAction('Dispute', onDispute)}
                            disabled={!!actionLoading}
                            id="dispute-btn"
                        >
                            Raise Dispute
                        </button>
                    )}
                    {isTerminal && onReset && (
                        <button
                            className="btn"
                            onClick={onReset}
                            id="dismiss-escrow-btn"
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default EscrowDashboard;
