import React, { useState, useCallback, useEffect } from 'react';
import './App.css';
import { ToastProvider } from './components/Toast';
import WalletConnect from './components/WalletConnect';
import EscrowForm from './components/EscrowForm';
import EscrowDashboard from './components/EscrowDashboard';
import TransactionHistory from './components/TransactionHistory';
import {
  getBalance, getTransactionHistory,
  buildSorobanTransaction, submitSorobanTransaction, readSorobanData,
  ESCROW_CONTRACT_ID, TOKEN_CONTRACT_ID
} from './services/stellar';
import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransactionXDR, shortenAddress } from './services/wallet';
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidateAll } from './services/cache';

const STELLAR_EXPERT_URL = 'https://stellar.expert/explorer/testnet';

function AppContent() {
  const [publicKey, setPublicKey] = useState(null);
  const [balance, setBalance] = useState(null);
  const [escrows, setEscrows] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [walletLoading] = useState(false);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [asciiArt, setAsciiArt] = useState('');

  // Load ASCII art background
  useEffect(() => {
    fetch('/sky.txt')
      .then(r => r.text())
      .then(text => setAsciiArt(text))
      .catch(() => { });
  }, []);

  // Load cached escrows on mount
  useEffect(() => {
    const cachedEscrows = cacheGet('my_escrows');
    if (cachedEscrows && Array.isArray(cachedEscrows)) {
      setEscrows(cachedEscrows);
    }
  }, []);

  const refreshOnChainEscrow = useCallback(async (currentEscrows) => {
    if (!currentEscrows || currentEscrows.length === 0) return;

    setEscrowLoading(true);
    let updatedNeeded = false;
    let newEscrowList = [...currentEscrows];

    for (let i = 0; i < newEscrowList.length; i++) {
      let e = newEscrowList[i];
      if (!e.id || ['completed', 'refunded', 'canceled'].includes(e.state)) continue; // Don't poll terminal states

      try {
        const args = [StellarSdk.nativeToScVal(window.BigInt(e.id), { type: "u64" })];
        const data = await readSorobanData(ESCROW_CONTRACT_ID, "get_escrow", args);

        let chainState = Array.isArray(data.state) ? data.state[0] : (data.state || '').toString();
        chainState = chainState.toLowerCase(); // e.g. "created", "funded", "completed", "canceled"

        // Map on-chain 'created' state to our UI 'awaiting_deposit'
        if (chainState === 'created') chainState = 'awaiting_deposit';

        if (chainState && chainState !== e.state) {
          newEscrowList[i] = { ...e, state: chainState };
          updatedNeeded = true;
        }
      } catch (err) {
        console.warn(`Could not read on-chain state for escrow ${e.id}:`, err);
      }
    }

    if (updatedNeeded) {
      setEscrows(newEscrowList);
      cacheSet('my_escrows', newEscrowList, 60000000); // 16 hrs Cache
    }
    setEscrowLoading(false);
  }, []);

  // Poll on-chain state every 10 seconds if there's any active escrow
  useEffect(() => {
    if (escrows.length === 0) return;
    const interval = setInterval(() => {
      refreshOnChainEscrow(escrows);
    }, 10000);
    return () => clearInterval(interval);
  }, [escrows, refreshOnChainEscrow]);

  // Read immediately on initial wallet load if escrows exist
  useEffect(() => {
    if (publicKey && escrows.length > 0) {
      refreshOnChainEscrow(escrows);
    }
  }, [publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load transaction history when wallet connects
  useEffect(() => {
    if (publicKey) {
      setTxLoading(true);
      getTransactionHistory(publicKey, 10)
        .then(tx => setTransactions(tx))
        .catch(() => setTransactions([]))
        .finally(() => setTxLoading(false));
    }
  }, [publicKey]);

  const refreshAfterTx = useCallback(async () => {
    if (!publicKey) return;
    cacheInvalidate(`balance_${publicKey}`);
    try {
      const newBal = await getBalance(publicKey);
      setBalance(newBal);

      cacheInvalidate(`tx_history_${publicKey}`);
      const txs = await getTransactionHistory(publicKey, 10);
      setTransactions(txs);
    } catch (e) { console.error("Refresh error", e); }
  }, [publicKey]);

  const handleConnect = useCallback((key, bal) => {
    setPublicKey(key);
    setBalance(bal);
  }, []);

  const handleDisconnect = useCallback(() => {
    setPublicKey(null);
    setBalance(null);
    setTransactions([]);
    cacheInvalidateAll();
  }, []);

  const handleCreateEscrow = useCallback(async (escrowData) => {
    if (!publicKey) return;

    const timestamp = Date.now();
    const randSuffix = Math.floor(Math.random() * 1000);
    const idStr = `${Math.floor(timestamp / 1000)}${randSuffix}`;
    const newEscrowId = window.BigInt(idStr);
    const amountStroops = window.BigInt(Math.floor(parseFloat(escrowData.amount) * 1e7));

    const args = [
      StellarSdk.nativeToScVal(newEscrowId, { type: "u64" }),
      StellarSdk.nativeToScVal(publicKey, { type: "address" }),
      StellarSdk.nativeToScVal(escrowData.beneficiary, { type: "address" }),
      StellarSdk.nativeToScVal(escrowData.arbiter, { type: "address" }),
      StellarSdk.nativeToScVal(amountStroops, { type: "i128" }),
      StellarSdk.nativeToScVal(TOKEN_CONTRACT_ID, { type: "address" })
    ];

    const xdr = await buildSorobanTransaction(publicKey, ESCROW_CONTRACT_ID, "initialize", args);
    const signedXdr = await signTransactionXDR(xdr, "TESTNET");
    const { hash } = await submitSorobanTransaction(signedXdr);

    const newEscrow = {
      ...escrowData,
      state: 'awaiting_deposit',
      createdAt: new Date().toISOString(),
      id: idStr,
      txHashes: [{ type: 'initialize', hash }],
      depositor: publicKey,
    };

    setEscrows(prev => {
      const updated = [newEscrow, ...prev];
      cacheSet('my_escrows', updated, 60000000);
      return updated;
    });
    await refreshAfterTx();
  }, [publicKey, refreshAfterTx]);

  const updateEscrowState = (id, newState, type, hash) => {
    setEscrows(prev => {
      const updated = prev.map(e => {
        if (e.id === id) {
          return {
            ...e,
            state: newState,
            txHashes: [...(e.txHashes || []), { type, hash }],
            lastTxHash: hash,
          };
        }
        return e;
      });
      cacheSet('my_escrows', updated, 60000000);
      return updated;
    });
  };

  const handleDeposit = useCallback(async (escrow) => {
    if (!escrow || !publicKey) return;
    const args = [
      StellarSdk.nativeToScVal(window.BigInt(escrow.id), { type: "u64" }),
      StellarSdk.nativeToScVal(publicKey, { type: "address" })
    ];

    const xdr = await buildSorobanTransaction(publicKey, ESCROW_CONTRACT_ID, "deposit", args);
    const signedXdr = await signTransactionXDR(xdr, "TESTNET");
    const { hash } = await submitSorobanTransaction(signedXdr);

    updateEscrowState(escrow.id, 'funded', 'deposit', hash);
    await refreshAfterTx();
  }, [publicKey, refreshAfterTx]);

  const handleApprove = useCallback(async (escrow) => {
    if (!escrow || !publicKey) return;
    const args = [
      StellarSdk.nativeToScVal(window.BigInt(escrow.id), { type: "u64" }),
      StellarSdk.nativeToScVal(publicKey, { type: "address" })
    ];

    const xdr = await buildSorobanTransaction(publicKey, ESCROW_CONTRACT_ID, "approve", args);
    const signedXdr = await signTransactionXDR(xdr, "TESTNET");
    const { hash } = await submitSorobanTransaction(signedXdr);

    updateEscrowState(escrow.id, 'completed', 'approve', hash);
    await refreshAfterTx();
  }, [publicKey, refreshAfterTx]);

  const handleRefund = useCallback(async (escrow) => {
    if (!escrow || !publicKey) return;
    const args = [
      StellarSdk.nativeToScVal(window.BigInt(escrow.id), { type: "u64" }),
      StellarSdk.nativeToScVal(publicKey, { type: "address" })
    ];

    const xdr = await buildSorobanTransaction(publicKey, ESCROW_CONTRACT_ID, "refund", args);
    const signedXdr = await signTransactionXDR(xdr, "TESTNET");
    const { hash } = await submitSorobanTransaction(signedXdr);

    updateEscrowState(escrow.id, 'refunded', 'refund', hash);
    await refreshAfterTx();
  }, [publicKey, refreshAfterTx]);

  const handleDispute = useCallback(async (escrow) => {
    if (!escrow || !publicKey) return;
    const args = [
      StellarSdk.nativeToScVal(window.BigInt(escrow.id), { type: "u64" }),
      StellarSdk.nativeToScVal(publicKey, { type: "address" })
    ];

    const xdr = await buildSorobanTransaction(publicKey, ESCROW_CONTRACT_ID, "dispute", args);
    const signedXdr = await signTransactionXDR(xdr, "TESTNET");
    const { hash } = await submitSorobanTransaction(signedXdr);

    updateEscrowState(escrow.id, 'disputed', 'dispute', hash);
    await refreshAfterTx();
  }, [publicKey, refreshAfterTx]);

  const handleCancel = useCallback(async (escrow) => {
    if (!escrow || !publicKey) return;
    const args = [
      StellarSdk.nativeToScVal(window.BigInt(escrow.id), { type: "u64" }),
      StellarSdk.nativeToScVal(publicKey, { type: "address" })
    ];

    const xdr = await buildSorobanTransaction(publicKey, ESCROW_CONTRACT_ID, "cancel", args);
    const signedXdr = await signTransactionXDR(xdr, "TESTNET");
    const { hash } = await submitSorobanTransaction(signedXdr);

    updateEscrowState(escrow.id, 'canceled', 'cancel', hash);
    await refreshAfterTx();
  }, [publicKey, refreshAfterTx]);

  const handleReset = useCallback((id) => { // Removes from view
    setEscrows(prev => {
      const updated = prev.filter(e => e.id !== id);
      cacheSet('my_escrows', updated, 60000000);
      return updated;
    });
  }, []);

  return (
    <div className="app">
      {/* ASCII Art Background */}
      <div className="ascii-background">
        <pre>{asciiArt}</pre>
      </div>

      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">◈</div>
          <div className="app-logo-text">
            stellar<span>/escrow</span>
          </div>
        </div>
        <div className="header-right">
          <span className="network-badge">testnet</span>
          {publicKey && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)'
            }}>
              {shortenAddress(publicKey)}
            </span>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="app-main">
        <WalletConnect
          publicKey={publicKey}
          balance={balance}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          loading={walletLoading}
        />

        {publicKey && (
          <>
            <EscrowForm
              publicKey={publicKey}
              onCreateEscrow={handleCreateEscrow}
              disabled={false}
            />

            {escrows.map(escrow => (
              <EscrowDashboard
                key={escrow.id}
                escrow={escrow}
                publicKey={publicKey}
                onDeposit={() => handleDeposit(escrow)}
                onApprove={() => handleApprove(escrow)}
                onRefund={() => handleRefund(escrow)}
                onDispute={() => handleDispute(escrow)}
                onCancel={() => handleCancel(escrow)}
                onReset={() => handleReset(escrow.id)}
                loading={escrowLoading}
                stellarExpertUrl={STELLAR_EXPERT_URL}
              />
            ))}

            {escrows.length === 0 && (
              <div className="escrow-dashboard-section">
                <div className="card">
                  <div className="escrow-empty" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                    <div className="escrow-empty-icon" style={{ fontSize: '2rem', marginBottom: 'var(--space-md)' }}>◇</div>
                    <p style={{ color: 'var(--text-secondary)' }}>No active escrows. Create one above to get started.</p>
                  </div>
                </div>
              </div>
            )}

            <TransactionHistory
              transactions={transactions}
              loading={txLoading}
              stellarExpertUrl={STELLAR_EXPERT_URL}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>stellar/escrow — decentralized escrow on soroban testnet</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
