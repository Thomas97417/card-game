import { GoldBalance } from "./gold-balance";
import { DiamondBalance } from "./diamond-balance";

export function CurrencyBalances() {
  return (
    <div className="currency-balances">
      <GoldBalance />
      <DiamondBalance />
    </div>
  );
}
