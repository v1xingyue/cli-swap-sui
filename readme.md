# cli-swap-sui

Help you swap tokens by Cetus aggregator fast and run arbitrage bot.

## Features

- 🔄 **Token Swapping**: Fast token swaps using Cetus aggregator
- 🤖 **Arbitrage Bot**: Automated arbitrage trading bot
- 💰 **Balance Management**: View and manage your token balances
- 🛡️ **Risk Control**: Configurable slippage and profit thresholds

## How to use it

### Basic Setup

```shell
npx cli-swap-sui init 
# transfer some coin to generated wallet address
npx cli-swap-sui info  # check your balances
```

### Token Swapping

```shell
npx cli-swap-sui swap --from USDC --to SUI --amount 10
npx cli-swap-sui swap --from SUI --to USDC --amount 5 --execute
```

### Arbitrage Bot

```shell
# Start arbitrage bot (simulation mode)
npx cli-swap-sui arbitrage

# Start arbitrage bot with real trading
npx cli-swap-sui arbitrage --execute

# Use config file
npx cli-swap-sui arbitrage --config arbitrage-config.json

# Custom configuration
npx cli-swap-sui arbitrage \
  --min-profit 0.3 \
  --max-amount 50 \
  --pairs "SUI_USDC,WAL_USDC" \
  --execute
```

For detailed arbitrage bot documentation, see [ARBITRAGE_README.md](./ARBITRAGE_README.md).
