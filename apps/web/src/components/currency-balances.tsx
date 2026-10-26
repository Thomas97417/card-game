import { GoldBalance } from "./gold-balance";
import { EmeraldBalance } from "./emerald-balance";
import { FriendshipBalance } from "./friendship-balance";

export function CurrencyBalances() {
  return (
    <div className="currency-balances">
      <GoldBalance />
      <EmeraldBalance />
      <FriendshipBalance />
    </div>
  );
}
