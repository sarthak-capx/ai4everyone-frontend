export function formatWalletError(error: unknown): string {
    const raw = typeof error === 'string' ? error : (error as any)?.message || '';
    const code = (error as any)?.code ?? (error as any)?.error?.code;
    const reason = (error as any)?.reason;

    // Common user rejection
    if (code === 4001 || code === 'ACTION_REJECTED' || /user denied|user rejected|ACTION_REJECTED/i.test(raw)) {
        return 'Transaction cancelled by user.';
    }

    // Insufficient funds
    if (/insufficient funds/i.test(raw)) {
        return 'Insufficient funds to complete the transaction.';
    }

    // Gas/fee issues
    if (/replacement fee too low|gas price too low|fee too low/i.test(raw)) {
        return 'Network fee too low. Try again with default fees.';
    }

    // Nonce / replacement
    if (/nonce too low|replacement transaction underpriced/i.test(raw)) {
        return 'Please wait and try again (network sync issue).';
    }

    // RPC / network connectivity
    if (/network error|failed to fetch|timeout|429|502|503|504/i.test(raw)) {
        return 'Network error. Please try again in a moment.';
    }

    // CORS issues surfaced to UI
    if (/CORS|Access-Control-Allow-Origin/i.test(raw)) {
        return 'Network error. Please refresh and try again.';
    }

    // Generic server errors
    if ((error as any)?.status >= 500 || /internal server error|server error/i.test(raw)) {
        return 'Server error. Please try again later.';
    }

    // Backend validation
    if ((error as any)?.status === 400 || /invalid request|validation/i.test(raw)) {
        return 'Invalid request. Please check details and try again.';
    }

    // Explicit reason string from ethers
    if (typeof reason === 'string' && reason.length < 120) {
        return reason;
    }

    // Default fallback
    return 'Something went wrong. Please try again.';
} 