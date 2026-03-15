'use client';

import React, { useState, useEffect } from 'react';

function formatDateDMY(date: string | Date) {
    return new Date(date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

interface TransferTabProps {
    playerId: string;
    playerName: string;
    playerTeamId: string | null;
    askingPrice: number | null;
    transferStatus: string;
    userTeamId: string;
    marketValue: number;
    onBidSuccess?: () => void;
}

export function TransferTab({
    playerId,
    playerName,
    playerTeamId,
    askingPrice,
    transferStatus,
    userTeamId,
    marketValue,
    onBidSuccess
}: TransferTabProps) {
    const [amount, setAmount] = useState<number>(0);
    const [signOnBonus, setSignOnBonus] = useState<number>(0);
    const [userBalance, setUserBalance] = useState<number>(0);
    const [loadingBalance, setLoadingBalance] = useState(true);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [askingPriceValue, setAskingPriceValue] = useState<number>(askingPrice || 0);
    const [selectedTransferStatus, setSelectedTransferStatus] = useState<string>(transferStatus);
    const [isUpdating, setIsUpdating] = useState(false);
    const [acceptedDeal, setAcceptedDeal] = useState<any>(null);
    const [pendingDeal, setPendingDeal] = useState<any>(null);
    const [loadingBids, setLoadingBids] = useState(true);

    const isFreeAgent = !playerTeamId;

    // Set default amount when props change
    useEffect(() => {
        const defaultAmount = (askingPrice && askingPrice > 0) ? askingPrice : marketValue;
        setAmount(defaultAmount);

        // Also default askingPriceValue for user's team management
        if (playerTeamId === userTeamId && (!askingPrice || askingPrice === 0)) {
            setAskingPriceValue(marketValue);
        }
    }, [askingPrice, marketValue, playerTeamId, userTeamId]);
    useEffect(() => {
        if (!userTeamId) return;
        // Fetch user team balance
        const fetchBalance = async () => {
            setLoadingBalance(true);
            try {
                const res = await fetch(`/api/finances?teamId=${userTeamId}`);
                if (res.ok) {
                    const data = await res.json();
                    const balance = data.balance || 0;
                    setUserBalance(balance);
                    // Cap offer to balance so button is not silently disabled
                    if (!isFreeAgent) {
                        setAmount(prev => (prev > balance && balance > 0) ? balance : prev);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch balance', error);
            } finally {
                setLoadingBalance(false);
            }
        };
        fetchBalance();
    }, [userTeamId, isFreeAgent]);

    useEffect(() => {
        if (!playerId) return;
        const fetchExistingBids = async () => {
            setLoadingBids(true);
            try {
                // If user is owner, they see ALL bids for this player
                // If user is not owner, they only see their own bids
                const url = playerTeamId === userTeamId
                    ? `/api/market/bids?playerId=${playerId}`
                    : `/api/market/bids?teamId=${userTeamId}&playerId=${playerId}`;

                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    const nowTs = Date.now();

                    if (playerTeamId === userTeamId) {
                        // Seller case: only real, still-pending accepted transfers should block management.
                        // Ignore invalid self-to-self rows and already-expired accepted bids.
                        const deal = data.bids.find((b: any) => {
                            const isAccepted = b.status === 'ACCEPTED';
                            const isSelfTransfer = b.fromTeamId && b.toTeamId && b.fromTeamId === b.toTeamId;
                            const windowEndsTs = b.windowEnds ? Number(new Date(b.windowEnds).getTime()) : null;
                            const isExpired = windowEndsTs !== null && Number.isFinite(windowEndsTs) && windowEndsTs < nowTs;
                            return isAccepted && !isSelfTransfer && !isExpired;
                        });
                        setAcceptedDeal(deal);
                    } else {
                        // Buyer case: user's own accepted or pending bid blocks management
                        const accepted = data.bids.find((b: any) => b.fromTeamId === userTeamId && b.status === 'ACCEPTED');
                        const pending = data.bids.find((b: any) => b.fromTeamId === userTeamId && b.status === 'PENDING');
                        setAcceptedDeal(accepted);
                        setPendingDeal(pending);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch existing bids', error);
            } finally {
                setLoadingBids(false);
            }
        };
        fetchExistingBids();
    }, [userTeamId, playerId, playerTeamId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const confirmMsg = isFreeAgent
            ? `คุณแน่ใจหรือไม่ที่จะเซ็นสัญญากับ ${playerName}?`
            : `คุณแน่ใจหรือไม่ที่จะยื่นข้อเสนอซื้อ ${playerName} เป็นเงิน $${amount.toLocaleString()}?`;

        if (!window.confirm(confirmMsg)) return;

        setLoading(true);
        setMessage('');

        try {
            const res = await fetch('/api/market/bid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId,
                    fromTeamId: userTeamId,
                    amount: isFreeAgent ? 0 : amount,
                    signOnBonus,
                    isFreeAgent
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage(data.message || 'Bid successfully submitted!');
                setIsSuccess(true);
                if (onBidSuccess) onBidSuccess();
            } else {
                setMessage(data.error || 'Failed to submit bid.');
                setIsSuccess(false);
            }
        } catch (error) {
            setMessage('An error occurred while submitting the bid.');
            setIsSuccess(false);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async () => {
        const confirmMsg = selectedTransferStatus === 'RELEASED'
            ? `คุณแน่ใจหรือไม่ที่จะปล่อยตัว ${playerName} ออกจากทีมฟรี?`
            : `คุณแน่ใจหรือไม่ที่จะอัปเดตสถานะของ ${playerName}?`;

        if (!window.confirm(confirmMsg)) return;

        setIsUpdating(true);
        setMessage('');
        try {
            const res = await fetch(`/api/player/${playerId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transferStatus: selectedTransferStatus,
                    askingPrice: askingPriceValue
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage('Player status updated successfully!');
                setIsSuccess(true);
            } else {
                setMessage(data.error || 'Failed to update player status.');
                setIsSuccess(false);
            }
        } catch (error) {
            setMessage('An error occurred while updating status.');
            setIsSuccess(false);
        } finally {
            setIsUpdating(false);
        }
    };

    if (!userTeamId) return <div>Loading...</div>;

    if (playerTeamId === userTeamId) {
        return (
            <div className="card" style={{ padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                    Manage Player
                </h3>

                {acceptedDeal ? (
                    <div style={{
                        padding: '1.5rem',
                        borderRadius: '8px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid var(--success)',
                        color: 'var(--success)',
                        textAlign: 'center'
                    }}>
                        <h4 style={{ margin: '0 0 0.5rem 0' }}>Transfer Agreed! 🤝</h4>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                            You have accepted an offer from <strong>{acceptedDeal.fromTeam.name}</strong> for <strong>${acceptedDeal.amount.toLocaleString()}</strong>.
                            Transfer is pending official confirmation on {formatDateDMY(acceptedDeal.windowEnds)}.
                        </p>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Transfer Status</label>
                                <select
                                    className="input"
                                    value={selectedTransferStatus}
                                    onChange={(e) => {
                                        const newStatus = e.target.value;
                                        setSelectedTransferStatus(newStatus);
                                        if (newStatus === 'RELEASED') {
                                            setAskingPriceValue(0);
                                        } else if (newStatus === 'NOT_LISTED') {
                                            setAskingPriceValue(askingPrice || marketValue);
                                        }
                                    }}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                                >
                                    <option value="NOT_LISTED">Not Listed</option>
                                    <option value="LISTED">Listed for Transfer</option>
                                    <option value="RELEASED">ปล่อยตัวฟรี (Free Transfer)</option>
                                </select>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <label style={{ fontWeight: 'bold' }}>Asking Price ($)</label>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                        {askingPriceValue.toLocaleString()} $
                                    </span>
                                </div>
                                <input
                                    type="number"
                                    className="input"
                                    value={askingPriceValue}
                                    onChange={(e) => setAskingPriceValue(Number(e.target.value))}
                                    min="0"
                                    disabled={selectedTransferStatus !== 'LISTED'}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: selectedTransferStatus !== 'LISTED' ? '#f1f5f9' : 'white',
                                        color: selectedTransferStatus !== 'LISTED' ? 'var(--muted)' : 'inherit'
                                    }}
                                />
                            </div>
                        </div>


                        {message && (
                            <div style={{
                                padding: '1rem',
                                borderRadius: '8px',
                                background: isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: isSuccess ? 'var(--success)' : 'var(--error)',
                                marginTop: '1rem'
                            }}>
                                {message}
                            </div>
                        )}

                        <button
                            onClick={handleUpdateStatus}
                            className="btn btn-primary"
                            disabled={isUpdating}
                            style={{ padding: '1rem', marginTop: '1.5rem', fontWeight: 'bold', width: '100%' }}
                        >
                            {isUpdating ? 'Updating...' : 'Update Player Status'}
                        </button>
                    </>
                )
                }
            </div >
        );
    }

    return (
        <div className="card" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                {isFreeAgent ? 'Sign Free Agent' : 'Make Transfer Offer'}
            </h3>

            <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {!isFreeAgent && (
                    <>
                        <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Transfer Status</div>
                            <div style={{ fontWeight: 'bold', color: transferStatus === 'LISTED' || transferStatus === 'RELEASED' ? 'var(--success)' : 'var(--accent)' }}>
                                {transferStatus === 'LISTED' ? 'Listed for Transfer' :
                                    transferStatus === 'RELEASED' ? 'Listed for Free' : 'Not Listed'}
                            </div>
                        </div>
                        <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Asking Price</div>
                            <div style={{ fontWeight: 'bold' }}>
                                {askingPrice ? `$${askingPrice.toLocaleString()}` : 'Not Set'}
                            </div>
                        </div>
                    </>
                )}
                <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Your Available Balance</div>
                    <div style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                        {loadingBalance ? 'Loading...' : `$${userBalance.toLocaleString()}`}
                    </div>
                </div>
            </div>

            {acceptedDeal ? (
                <div style={{
                    padding: '1.5rem',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid var(--success)',
                    color: 'var(--success)',
                    textAlign: 'center'
                }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Deal in Progress! 🤝</h4>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        Your offer of <strong>${acceptedDeal.amount.toLocaleString()}</strong> has already been <strong>ACCEPTED</strong>.
                        We are currently waiting for the official confirmation (estimated: {formatDateDMY(acceptedDeal.windowEnds)}).
                    </p>
                </div>
            ) : pendingDeal ? (
                <div style={{
                    padding: '1.5rem',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid #f59e0b',
                    color: '#b45309',
                    textAlign: 'center'
                }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Offer Pending... ⏳</h4>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        You have a <strong>PENDING</strong> offer of <strong>${pendingDeal.amount.toLocaleString()}</strong> for this player.
                        Please wait for the club to respond before submitting a new offer.
                    </p>
                    <div style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                        Decision date: {formatDateDMY(pendingDeal.windowEnds)}
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {!isFreeAgent && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Transfer Fee Offer ($)</label>
                            <input
                                type="number"
                                className="input"
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                min="0"
                                max={userBalance}
                                required
                                style={{
                                    width: '100%', padding: '0.75rem', borderRadius: '8px',
                                    border: `1px solid ${amount > userBalance ? 'var(--error, #ef4444)' : 'var(--border)'}`
                                }}
                            />
                            {amount > userBalance ? (
                                <div style={{ fontSize: '0.8rem', color: 'var(--error, #ef4444)', marginTop: '0.25rem', fontWeight: 'bold' }}>
                                    ⚠️ Offer exceeds your balance (${userBalance.toLocaleString()}). Please lower the amount.
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                                    Available balance: ${userBalance.toLocaleString()}
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Sign-on Bonus ($)</label>
                        <input
                            type="number"
                            className="input"
                            value={signOnBonus}
                            onChange={(e) => setSignOnBonus(Number(e.target.value))}
                            min="0"
                            max={isFreeAgent ? userBalance : userBalance - amount}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                        />
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                            Used as a powerful incentive, especially for Free Agents. Max: ${(isFreeAgent ? userBalance : userBalance - amount).toLocaleString()}
                        </div>
                    </div>

                    {message && (
                        <div style={{
                            padding: '1rem',
                            borderRadius: '8px',
                            background: isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: isSuccess ? 'var(--success)' : 'var(--error)',
                            marginTop: '1rem'
                        }}>
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || (!isFreeAgent && amount > userBalance) || (signOnBonus + (isFreeAgent ? 0 : amount) > userBalance)}
                        style={{ padding: '1rem', marginTop: '1rem', fontWeight: 'bold' }}
                    >
                        {loading ? 'Submitting...' : 'Submit Offer'}
                    </button>
                </form>
            )}
        </div>
    );
}
