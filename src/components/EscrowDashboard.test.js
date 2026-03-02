import React from 'react';
import { render, screen } from '@testing-library/react';
import { EscrowDashboard } from './EscrowDashboard';
import { ToastProvider } from './Toast';

jest.mock('../services/wallet', () => ({
    shortenAddress: jest.fn((addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''),
}));

const renderWithToast = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

describe('EscrowDashboard', () => {
    const mockEscrow = {
        depositor: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEBD9AFZQ7TM4JRS9A',
        beneficiary: 'GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST6DUXR',
        arbiter: 'GCZFMH32MF5EAWETZTKF3ZV5SEVJPI53UEMDNSW55WBR75GMZJU4U573',
        amount: '100',
        state: 'awaiting_deposit',
        createdAt: '2025-01-01T00:00:00Z',
        id: '123',
    };

    test('renders empty state when no escrow', () => {
        renderWithToast(
            <EscrowDashboard
                escrow={null}
                publicKey={mockEscrow.depositor}
                onDeposit={() => { }}
                onApprove={() => { }}
                onRefund={() => { }}
                onDispute={() => { }}
                loading={false}
            />
        );

        expect(screen.getByText(/no active escrow/i)).toBeInTheDocument();
    });

    test('renders escrow details when escrow exists', () => {
        renderWithToast(
            <EscrowDashboard
                escrow={mockEscrow}
                publicKey={mockEscrow.depositor}
                onDeposit={() => { }}
                onApprove={() => { }}
                onRefund={() => { }}
                onDispute={() => { }}
                loading={false}
            />
        );

        expect(screen.getByText('100 XLM')).toBeInTheDocument();
        expect(screen.getByText('Depositor')).toBeInTheDocument();
        expect(screen.getByText('Beneficiary')).toBeInTheDocument();
        expect(screen.getByText('Arbiter')).toBeInTheDocument();
    });

    test('shows deposit button for depositor in awaiting_deposit state', () => {
        renderWithToast(
            <EscrowDashboard
                escrow={mockEscrow}
                publicKey={mockEscrow.depositor}
                onDeposit={() => { }}
                onApprove={() => { }}
                onRefund={() => { }}
                onDispute={() => { }}
                loading={false}
            />
        );

        expect(screen.getByText(/deposit 100 xlm/i)).toBeInTheDocument();
    });

    test('shows approve and refund buttons for arbiter in funded state', () => {
        const fundedEscrow = { ...mockEscrow, state: 'funded' };
        renderWithToast(
            <EscrowDashboard
                escrow={fundedEscrow}
                publicKey={mockEscrow.arbiter}
                onDeposit={() => { }}
                onApprove={() => { }}
                onRefund={() => { }}
                onDispute={() => { }}
                loading={false}
            />
        );

        expect(screen.getByText('Approve Release')).toBeInTheDocument();
        expect(screen.getByText('Refund')).toBeInTheDocument();
    });

    test('shows skeleton loading state', () => {
        const { container } = renderWithToast(
            <EscrowDashboard
                escrow={null}
                publicKey={mockEscrow.depositor}
                onDeposit={() => { }}
                onApprove={() => { }}
                onRefund={() => { }}
                onDispute={() => { }}
                loading={true}
            />
        );

        expect(container.querySelector('.skeleton')).toBeInTheDocument();
    });

    test('shows role label for connected user', () => {
        renderWithToast(
            <EscrowDashboard
                escrow={mockEscrow}
                publicKey={mockEscrow.depositor}
                onDeposit={() => { }}
                onApprove={() => { }}
                onRefund={() => { }}
                onDispute={() => { }}
                loading={false}
            />
        );

        expect(screen.getByText('(You: Depositor)')).toBeInTheDocument();
    });
});
