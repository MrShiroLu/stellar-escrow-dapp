import React, { useState, useCallback } from 'react';
import { useToast } from './Toast';

/**
 * Escrow creation form
 * @param {Object} props
 * @param {string|null} props.publicKey - Connected wallet
 * @param {Function} props.onCreateEscrow - (escrowData) => void
 * @param {boolean} props.disabled
 */
export function EscrowForm({ publicKey, onCreateEscrow, disabled }) {
    const [formData, setFormData] = useState({
        beneficiary: '',
        arbiter: '',
        amount: '',
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const toast = useToast();

    const validate = useCallback(() => {
        const newErrors = {};

        if (!formData.beneficiary.trim()) {
            newErrors.beneficiary = 'Beneficiary address is required';
        } else if (formData.beneficiary.length !== 56 || !formData.beneficiary.startsWith('G')) {
            newErrors.beneficiary = 'Invalid Stellar address format';
        }

        if (!formData.arbiter.trim()) {
            newErrors.arbiter = 'Arbiter address is required';
        } else if (formData.arbiter.length !== 56 || !formData.arbiter.startsWith('G')) {
            newErrors.arbiter = 'Invalid Stellar address format';
        }

        if (!formData.amount.trim()) {
            newErrors.amount = 'Amount is required';
        } else if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
            newErrors.amount = 'Amount must be greater than 0';
        }

        if (formData.beneficiary === publicKey) {
            newErrors.beneficiary = 'Beneficiary cannot be yourself';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData, publicKey]);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error on change
        setErrors(prev => ({ ...prev, [name]: undefined }));
    }, []);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        try {
            await onCreateEscrow({
                depositor: publicKey,
                beneficiary: formData.beneficiary.trim(),
                arbiter: formData.arbiter.trim(),
                amount: formData.amount.trim(),
            });
            // Reset form on success
            setFormData({ beneficiary: '', arbiter: '', amount: '' });
        } catch (error) {
            toast.error('Creation Failed', error.message);
        } finally {
            setSubmitting(false);
        }
    }, [formData, publicKey, validate, onCreateEscrow, toast]);

    return (
        <div className="escrow-form-section">
            <div className="section-title">Create Escrow</div>
            <div className="card">
                <form className="escrow-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="beneficiary">Beneficiary Address</label>
                        <input
                            id="beneficiary"
                            name="beneficiary"
                            className="form-input"
                            type="text"
                            placeholder="G..."
                            value={formData.beneficiary}
                            onChange={handleChange}
                            disabled={disabled || submitting}
                            autoComplete="off"
                        />
                        {errors.beneficiary && <div className="form-error">{errors.beneficiary}</div>}
                        <div className="form-hint">The address that will receive funds upon completion</div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="arbiter">Arbiter Address</label>
                            <input
                                id="arbiter"
                                name="arbiter"
                                className="form-input"
                                type="text"
                                placeholder="G..."
                                value={formData.arbiter}
                                onChange={handleChange}
                                disabled={disabled || submitting}
                                autoComplete="off"
                            />
                            {errors.arbiter && <div className="form-error">{errors.arbiter}</div>}
                            <div className="form-hint">Trusted third party</div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="amount">Amount (XLM)</label>
                            <input
                                id="amount"
                                name="amount"
                                className="form-input"
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="100.00"
                                value={formData.amount}
                                onChange={handleChange}
                                disabled={disabled || submitting}
                            />
                            {errors.amount && <div className="form-error">{errors.amount}</div>}
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="submit"
                            className={`btn btn-primary ${submitting ? 'btn-loading' : ''}`}
                            disabled={disabled || submitting || !publicKey}
                            id="create-escrow-btn"
                        >
                            Create Escrow
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EscrowForm;
