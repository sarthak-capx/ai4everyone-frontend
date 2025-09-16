import { API_ENDPOINTS } from '../config';

export type SupportedAsset = 'USDC' | 'USDT';

export interface PaymentQuoteResponse {
    success: boolean;
    data: {
        receiptId: string;
        asset: `0x${string}`;
        amount: string;
        timestamp: number;
        signature: `0x${string}`;
        paymaster: `0x${string}`;
        expiresAt: number;
        chainId: number;
        network: string;
    };
}

export interface AssetInfo { symbol: SupportedAsset; decimals: number }

export const ERC20_ABI = [
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 value) returns (bool)'
];

export const CAPX_PAYMASTER_ABI = [
    'function pay(string _receiptId, address _asset, uint256 _amount, uint256 _timestamp, bytes _signature) external'
];

export const chainIdToNetwork: Record<number, string> = {
    11155111: 'sepolia'
};

export async function fetchAssets(network: string): Promise<AssetInfo[]> {
    const res = await fetch(API_ENDPOINTS.PAYMENTS_ASSETS(network));
    if (!res.ok) throw new Error('Failed to load assets');
    const json = await res.json();
    return json.data as AssetInfo[];
}

export async function createPaymentQuote(params: {
    user_id: string;
    user_address: `0x${string}`;
    pay_asset: SupportedAsset;
    pay_amount: number;
    chainId: number;
}): Promise<PaymentQuoteResponse['data']> {
    const network = chainIdToNetwork[params.chainId];
    if (!network) throw new Error('Unsupported chain');
    const res = await fetch(API_ENDPOINTS.PAYMENTS_QUOTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: params.user_id,
            user_address: params.user_address,
            pay_asset: params.pay_asset,
            pay_amount: params.pay_amount,
            network
        })
    });
    if (!res.ok) {
        let msg = 'Failed to create payment quote';
        try { const j = await res.json(); msg = j.error || msg; } catch { }
        throw new Error(msg);
    }
    const json: PaymentQuoteResponse = await res.json();
    return json.data;
} 