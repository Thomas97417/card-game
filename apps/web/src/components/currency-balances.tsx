import { GoldBalance } from "./gold-balance";
import { EmeraldBalance } from "./emerald-balance";

export function CurrencyBalances() {
  return (
    <div className="currency-balances">
      <GoldBalance />
      <EmeraldBalance />
    </div>
  );
}
