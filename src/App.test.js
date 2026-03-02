import React from 'react';
import { render, screen, act } from '@testing-library/react';
import App from './App';

// Mock the services
jest.mock('./services/wallet', () => ({
  connectWallet: jest.fn(),
  checkFreighterInstalled: jest.fn(),
  getWalletPublicKey: jest.fn(),
  signTransactionXDR: jest.fn(),
  disconnectWallet: jest.fn(),
  shortenAddress: jest.fn((addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''),
}));

jest.mock('./services/stellar', () => ({
  getBalance: jest.fn(),
  fundWithFriendbot: jest.fn(),
  buildPaymentTransaction: jest.fn(),
  submitTransaction: jest.fn(),
  getTransactionHistory: jest.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  // Mock fetch for ASCII art loading
  global.fetch = jest.fn().mockResolvedValue({
    text: () => Promise.resolve('* * * ASCII ART * * *'),
    ok: true,
  });
  localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('App', () => {
  test('renders the app header with logo', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('stellar')).toBeInTheDocument();
  });

  test('renders testnet network badge', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('testnet')).toBeInTheDocument();
  });

  test('renders connect wallet button', async () => {
    await act(async () => {
      render(<App />);
    });
    const connectBtn = screen.getByText('Connect Wallet');
    expect(connectBtn).toBeInTheDocument();
    expect(connectBtn).toHaveAttribute('id', 'connect-wallet-btn');
  });

  test('renders footer', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText(/decentralized escrow on soroban testnet/i)).toBeInTheDocument();
  });

  test('does not render escrow form when wallet is not connected', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.queryByText('Create Escrow')).not.toBeInTheDocument();
  });

  test('renders wallet connection prompt', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText(/connect your freighter wallet/i)).toBeInTheDocument();
  });
});
