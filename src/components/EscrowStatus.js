import React from 'react';

const STATES = [
    { key: 'awaiting_deposit', label: 'Created' },
    { key: 'funded', label: 'Funded' },
    { key: 'completed', label: 'Completed' },
];

const STATES_WITH_REFUND = [
    { key: 'awaiting_deposit', label: 'Created' },
    { key: 'funded', label: 'Funded' },
    { key: 'refunded', label: 'Refunded' },
];

const STATES_WITH_DISPUTE = [
    { key: 'awaiting_deposit', label: 'Created' },
    { key: 'funded', label: 'Funded' },
    { key: 'disputed', label: 'Disputed' },
];

const STATES_WITH_CANCEL = [
    { key: 'awaiting_deposit', label: 'Created' },
    { key: 'canceled', label: 'Canceled' },
];

function getTimeline(currentState) {
    if (currentState === 'refunded') return STATES_WITH_REFUND;
    if (currentState === 'disputed') return STATES_WITH_DISPUTE;
    if (currentState === 'canceled') return STATES_WITH_CANCEL;
    return STATES;
}

function getStateIndex(states, currentState) {
    return states.findIndex(s => s.key === currentState);
}

/**
 * Escrow status timeline
 * @param {Object} props
 * @param {string} props.state - Current escrow state
 */
export function EscrowStatus({ state }) {
    if (!state) return null;

    const timeline = getTimeline(state);
    const currentIndex = getStateIndex(timeline, state);

    const getBadgeClass = () => {
        switch (state) {
            case 'awaiting_deposit': return 'badge-awaiting';
            case 'funded': return 'badge-funded';
            case 'completed': return 'badge-completed';
            case 'refunded': return 'badge-refunded';
            case 'disputed': return 'badge-disputed';
            case 'canceled': return 'badge-refunded'; // Reuse red/gray styling from refunded
            default: return '';
        }
    };

    return (
        <div>
            <div style={{ marginBottom: 'var(--space-md)' }}>
                <span className={`badge ${getBadgeClass()}`}>
                    <span className="badge-dot" />
                    {state.replace('_', ' ')}
                </span>
            </div>

            <div className="status-timeline">
                {timeline.map((step, i) => {
                    const isCompleted = i < currentIndex;
                    const isActive = i === currentIndex;

                    return (
                        <React.Fragment key={step.key}>
                            <div className={`timeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                                <div className="timeline-dot" />
                                <span className="timeline-label">{step.label}</span>
                            </div>
                            {i < timeline.length - 1 && (
                                <div className={`timeline-connector ${isCompleted ? 'completed' : ''}`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

export default EscrowStatus;
