import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EscrowForm } from './EscrowForm';
import { ToastProvider } from './Toast';

const renderWithToast = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

describe('EscrowForm', () => {
    const mockCreate = jest.fn();
    const testPublicKey = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEBD9AFZQ7TM4JRS9A';

    beforeEach(() => {
        mockCreate.mockClear();
    });

    test('renders form fields', () => {
        renderWithToast(
            <EscrowForm publicKey={testPublicKey} onCreateEscrow={mockCreate} disabled={false} />
        );

        expect(screen.getByLabelText(/beneficiary address/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/arbiter address/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    });

    test('renders create button', () => {
        renderWithToast(
            <EscrowForm publicKey={testPublicKey} onCreateEscrow={mockCreate} disabled={false} />
        );

        const btn = screen.getByRole('button', { name: /create escrow/i });
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveAttribute('id', 'create-escrow-btn');
    });

    test('shows validation errors for empty fields', () => {
        renderWithToast(
            <EscrowForm publicKey={testPublicKey} onCreateEscrow={mockCreate} disabled={false} />
        );

        fireEvent.click(screen.getByRole('button', { name: /create escrow/i }));

        expect(screen.getByText('Beneficiary address is required')).toBeInTheDocument();
        expect(screen.getByText('Arbiter address is required')).toBeInTheDocument();
        expect(screen.getByText('Amount is required')).toBeInTheDocument();
    });

    test('shows validation error for invalid address format', () => {
        renderWithToast(
            <EscrowForm publicKey={testPublicKey} onCreateEscrow={mockCreate} disabled={false} />
        );

        fireEvent.change(screen.getByLabelText(/beneficiary address/i), {
            target: { value: 'invalid_address', name: 'beneficiary' },
        });
        fireEvent.change(screen.getByLabelText(/arbiter address/i), {
            target: { value: 'invalid_address', name: 'arbiter' },
        });
        fireEvent.change(screen.getByLabelText(/amount/i), {
            target: { value: '100', name: 'amount' },
        });
        fireEvent.click(screen.getByRole('button', { name: /create escrow/i }));

        expect(screen.getAllByText('Invalid Stellar address format')).toHaveLength(2);
    });

    test('disables form when disabled prop is true', () => {
        renderWithToast(
            <EscrowForm publicKey={testPublicKey} onCreateEscrow={mockCreate} disabled={true} />
        );

        expect(screen.getByLabelText(/beneficiary address/i)).toBeDisabled();
        expect(screen.getByLabelText(/arbiter address/i)).toBeDisabled();
        expect(screen.getByLabelText(/amount/i)).toBeDisabled();
    });

    test('disables create button when no wallet connected', () => {
        renderWithToast(
            <EscrowForm publicKey={null} onCreateEscrow={mockCreate} disabled={false} />
        );

        expect(screen.getByRole('button', { name: /create escrow/i })).toBeDisabled();
    });

    test('shows section title', () => {
        const { container } = renderWithToast(
            <EscrowForm publicKey={testPublicKey} onCreateEscrow={mockCreate} disabled={false} />
        );

        const sectionTitle = container.querySelector('.section-title');
        expect(sectionTitle).toBeInTheDocument();
        expect(sectionTitle.textContent).toBe('Create Escrow');
    });
});
