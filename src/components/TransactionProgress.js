import React from 'react';

const STEPS = [
    { key: 'signing', label: 'Signing', icon: '🔐' },
    { key: 'submitting', label: 'Submitting', icon: '📡' },
    { key: 'confirming', label: 'Confirming', icon: '✓' },
];

/**
 * Transaction progress stepper
 * @param {Object} props
 * @param {string} props.currentStep - 'signing' | 'submitting' | 'confirming' | 'done'
 * @param {boolean} props.visible
 */
export function TransactionProgress({ currentStep, visible }) {
    if (!visible) return null;

    const currentIndex = STEPS.findIndex(s => s.key === currentStep);

    return (
        <div className="progress-stepper" role="progressbar" aria-label="Transaction progress">
            {STEPS.map((step, i) => {
                const isCompleted = currentStep === 'done' || i < currentIndex;
                const isActive = i === currentIndex && currentStep !== 'done';

                return (
                    <React.Fragment key={step.key}>
                        <div className={`progress-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                            <div className="progress-step-icon">
                                {isActive ? (
                                    <div className="progress-step-spinner" />
                                ) : isCompleted ? (
                                    '✓'
                                ) : (
                                    step.icon
                                )}
                            </div>
                            <span>{step.label}</span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className={`progress-connector ${isCompleted ? 'completed' : ''}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

export default TransactionProgress;
