import React, { useState, useCallback, useMemo, useRef, createContext, useContext } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const dismissRef = useRef(null);

    const dismissToast = useCallback((id) => {
        setToasts(prev =>
            prev.map(t => (t.id === id ? { ...t, exiting: true } : t))
        );
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300);
    }, []);

    dismissRef.current = dismissToast;

    const addToast = useCallback((type, title, message, duration = 5000) => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, type, title, message, exiting: false }]);

        if (duration > 0) {
            setTimeout(() => dismissRef.current(id), duration);
        }

        return id;
    }, []);

    const toast = useMemo(() => ({
        success: (title, message) => addToast('success', title, message),
        error: (title, message) => addToast('error', title, message, 8000),
        info: (title, message) => addToast('info', title, message),
    }), [addToast]);

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toast-container" role="alert" aria-live="polite">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`toast toast-${t.type} ${t.exiting ? 'toast-exiting' : ''}`}
                    >
                        <span className="toast-icon">
                            {t.type === 'success' && '✓'}
                            {t.type === 'error' && '✕'}
                            {t.type === 'info' && '○'}
                        </span>
                        <div className="toast-content">
                            <div className="toast-title">{t.title}</div>
                            {t.message && <div className="toast-message">{t.message}</div>}
                        </div>
                        <button
                            className="toast-close"
                            onClick={() => dismissToast(t.id)}
                            aria-label="Close notification"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export default ToastProvider;
