import React from 'react';

export function SkeletonText({ lines = 3, className = '' }) {
    return (
        <div className={className}>
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className="skeleton skeleton-text"
                    style={{ width: i === lines - 1 ? '60%' : '100%' }}
                />
            ))}
        </div>
    );
}

export function SkeletonHeading({ className = '' }) {
    return <div className={`skeleton skeleton-heading ${className}`} />;
}

export function SkeletonBox({ height = 44, className = '' }) {
    return <div className={`skeleton skeleton-box ${className}`} style={{ height }} />;
}

export function SkeletonBadge({ className = '' }) {
    return <div className={`skeleton skeleton-badge ${className}`} />;
}

export function SkeletonCard({ className = '' }) {
    return (
        <div className={`card ${className}`}>
            <SkeletonHeading />
            <SkeletonText lines={3} />
            <SkeletonBox height={36} />
        </div>
    );
}

export default SkeletonCard;
