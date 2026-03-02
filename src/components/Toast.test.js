import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

// Helper component that uses the toast hook
function TestToastTrigger() {
    const toast = useToast();
    return (
        <div>
            <button onClick={() => toast.success('Success Title', 'Success message')}>Trigger Success</button>
            <button onClick={() => toast.error('Error Title', 'Error message')}>Trigger Error</button>
            <button onClick={() => toast.info('Info Title', 'Info message')}>Trigger Info</button>
        </div>
    );
}

describe('Toast', () => {
    test('renders children', () => {
        render(
            <ToastProvider>
                <div>child content</div>
            </ToastProvider>
        );
        expect(screen.getByText('child content')).toBeInTheDocument();
    });

    test('shows success toast when triggered', () => {
        render(
            <ToastProvider>
                <TestToastTrigger />
            </ToastProvider>
        );

        fireEvent.click(screen.getByText('Trigger Success'));
        expect(screen.getByText('Success Title')).toBeInTheDocument();
        expect(screen.getByText('Success message')).toBeInTheDocument();
    });

    test('shows error toast when triggered', () => {
        render(
            <ToastProvider>
                <TestToastTrigger />
            </ToastProvider>
        );

        fireEvent.click(screen.getByText('Trigger Error'));
        expect(screen.getByText('Error Title')).toBeInTheDocument();
        expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    test('shows info toast when triggered', () => {
        render(
            <ToastProvider>
                <TestToastTrigger />
            </ToastProvider>
        );

        fireEvent.click(screen.getByText('Trigger Info'));
        expect(screen.getByText('Info Title')).toBeInTheDocument();
        expect(screen.getByText('Info message')).toBeInTheDocument();
    });

    test('renders close button on toasts', () => {
        render(
            <ToastProvider>
                <TestToastTrigger />
            </ToastProvider>
        );

        fireEvent.click(screen.getByText('Trigger Success'));
        const closeBtn = screen.getByLabelText('Close notification');
        expect(closeBtn).toBeInTheDocument();
    });

    test('shows correct icon for each type', () => {
        render(
            <ToastProvider>
                <TestToastTrigger />
            </ToastProvider>
        );

        fireEvent.click(screen.getByText('Trigger Success'));
        expect(screen.getByText('✓')).toBeInTheDocument();
    });
});
