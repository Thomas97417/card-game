import { GoldBalance, GoldIcon } from "./gold-balance";
import { EmeraldBalance, EmeraldIcon } from "./emerald-balance";
import { FriendshipBalance } from "./friendship-balance";
import { CurrencyGain } from "./currency-gain";

export function CurrencyBalances() {
  return (
    <div className="currency-balances">
      <div className="currency-balance-slot">
        <GoldBalance />
        <CurrencyGain currency="gold">
          <GoldIcon />
        </CurrencyGain>
      </div>
      <div className="currency-balance-slot">
        <EmeraldBalance />
        <CurrencyGain currency="emeralds">
          <EmeraldIcon />
        </CurrencyGain>
      </div>
      <FriendshipBalance />
    </div>
  );
}
