/**
 * Raw ABI encodings for the three calls real trading needs on Robinhood
 * Chain: ERC20 approve + allowance, Uniswap V3 QuoterV2 quoteExactInputSingle,
 * and SwapRouter02 exactInputSingle. Selectors and field orders were verified
 * against the live deployments on chainId 4663 (2026-09-08), including a dry
 * run that reached the router's token-pull step. No SDK, 100 bytes of hex.
 */

/** Uniswap V3 SwapRouter02 and QuoterV2 on Robinhood Chain. */
export const SWAP_ROUTER = '0xcaf681a66d020601342297493863e78c959e5cb2';
export const QUOTER_V2 = '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7';

const word = (n: bigint | number) => BigInt(n).toString(16).padStart(64, '0');
const addr = (a: string) => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');

/** approve(spender, amount), the ERC20 call every swap needs first. */
export function encodeApprove(spender: string, amount: bigint): string {
  return '0x095ea7b3' + addr(spender) + word(amount);
}

/** allowance(owner, spender), view. */
export function encodeAllowance(owner: string, spender: string): string {
  return '0xdd62ed3e' + addr(owner) + addr(spender);
}

/**
 * QuoterV2.quoteExactInputSingle((tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96)).
 * This deployment takes fee BEFORE sqrtPriceLimitX96 (the newer ABI order);
 * the old order reverts. Returns amountOut as the first return word.
 */
export function encodeQuoteExactInputSingle(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  fee: number,
): string {
  return '0xc6a5026a' + addr(tokenIn) + addr(tokenOut) + word(amountIn) + word(fee) + word(0);
}

/** SwapRouter02.exactInputSingle((tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96)). */
export function encodeExactInputSingle(
  tokenIn: string,
  tokenOut: string,
  fee: number,
  recipient: string,
  amountIn: bigint,
  minOut: bigint,
): string {
  return (
    '0x04e45aaf' +
    addr(tokenIn) +
    addr(tokenOut) +
    word(fee) +
    addr(recipient) +
    word(amountIn) +
    word(minOut) +
    word(0)
  );
}

/** First return word of an abi-encoded result as uint. */
export function decodeUint(result: string): bigint {
  return BigInt(result && result !== '0x' ? result.slice(0, 66) : '0x0');
}

/** eth_call through the injected wallet, answered by the wallet's own RPC. */
export function walletCall(to: string, data: string): Promise<string> {
  return window.ethereum!.request({
    method: 'eth_call',
    params: [{ from: undefined, to, data }, 'latest'],
  }) as Promise<string>;
}

/** eth_sendTransaction through the injected wallet; the wallet signs, not Kovra. */
export function sendTx(from: string, to: string, data: string): Promise<string> {
  return window.ethereum!.request({
    method: 'eth_sendTransaction',
    params: [{ from, to, data, value: '0x0' }],
  }) as Promise<string>;
}

type Receipt = { status?: string } | null;

/** Poll the receipt until the chain confirms, ~2s apart. Rejects after ~2 min. */
export function waitForReceipt(hash: string): Promise<'success' | 'reverted'> {
  const eth = window.ethereum!;
  return new Promise((resolve, reject) => {
    let tries = 0;
    const tick = async () => {
      const r = (await eth
        .request({ method: 'eth_getTransactionReceipt', params: [hash] })
        .catch(() => null)) as Receipt;
      if (r?.status) {
        resolve(r.status === '0x1' ? 'success' : 'reverted');
        return;
      }
      if (++tries > 60) {
        reject(new Error('receipt-timeout'));
        return;
      }
      setTimeout(tick, 2000);
    };
    void tick();
  });
}
