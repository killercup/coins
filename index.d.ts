interface CoinBalance {
  id: string, amount: string, amount_btc: string,
}

declare module 'poloniex-api-node' {
  interface PolinexBalance {
    available: string, onOrders: string, btcValue: string,
  }

  type PolinexBalances =
  { [coinId: string]: PolinexBalance }

  class Poloniex {
    constructor(key: string, secret: string)

    returnCompleteBalances(
        account: string|null,
        callback: (err: Error, res: PolinexBalances) => void): void;
  }
}