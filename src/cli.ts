#!/usr/bin/env node

import commander from "commander";
import { Transaction } from "@mysten/sui/transactions";
import {
  getBalance,
  getAddress,
  initKeypair,
  getAggregatorClient,
  displayRouter,
  rpc,
  getSigner,
  transactionLink,
  getDecimal,
  getCoinName,
  sleep,
  getZeroCoins,
} from "./sdk";
import { getCetusPrice, getCetusPriceBySymbol, getPositions } from "./cetus";
import log from "./log";
import { SuiClient } from "@mysten/sui/client";
import { supportCoins } from "./config";
import { ensureStoragePath } from "./storage";
import BN from "bn.js";
import { ArbitrageBot, createDefaultArbitrageConfig } from "./arbitrage";

const program = new commander.Command();
program.version("1.0.0");

program
  .command("info")
  .description("Get info")
  .option("-s, --silent", "silent output")
  .action(async ({ silent }) => {
    if (silent) {
      log.level = "warn";
    }
    const address = getAddress();
    log.info(`Address: ${address}`);
    const balances = await getBalance(address);
    const balanceTable = [];

    let usdcValue = 0;
    for (const balance of balances) {
      log.debug("--------------------------------");
      log.debug("balance", balance);

      if (balance.totalBalance === "0") {
        continue;
      }

      const decimal = getDecimal(balance.coinType);
      const coinName = getCoinName(balance.coinType);
      if (!coinName) {
        balanceTable.push({
          coinType: balance.coinType,
          balance: Number(balance.totalBalance),
          decimal: 0,
          price: 0,
          usdcValue: 0,
        });
        continue;
      }

      let price = 1.0;
      if (coinName !== "USDC") {
        log.debug("coinName", coinName);
        const priceInfo = await getCetusPriceBySymbol("USDC", coinName);
        if (priceInfo) {
          price = priceInfo.price.toNumber();
        }
      }

      let balanceLine = {
        coinType: balance.coinType,
        balance: Number(balance.totalBalance),
        decimal: decimal,
        price: price,
        usdcValue: 0,
      };

      if (decimal !== -1) {
        balanceLine.balance = Number(balance.totalBalance) / 10 ** decimal;
        balanceLine.usdcValue =
          (price * Number(balance.totalBalance)) / 10 ** decimal;
      }
      balanceTable.push(balanceLine);
      usdcValue += balanceLine.usdcValue;
    }
    balanceTable.push({
      coinType: "Total USDC",
      balance: 0,
      decimal: 0,
      price: 1,
      usdcValue: usdcValue,
    });
    console.table(balanceTable);
  });

program
  .command("init")
  .description("Init .env")
  .action(async () => {
    await initKeypair();
  });

program
  .command("clean-zero")
  .description("clean zero balance coins")
  .action(async () => {
    const client = await getAggregatorClient(getAddress());
    const address = getAddress();
    const balances = await getBalance(address);
    const zeroBalanceCoins = balances.filter(
      (balance) => balance.totalBalance === "0"
    );
    log.info(`zero balance coins: ${zeroBalanceCoins.length}`);

    const txb = new Transaction();
    txb.setSender(address);

    for (const balance of zeroBalanceCoins) {
      log.info(`clean ${balance.coinType}`);
      const zeroCoins = await getZeroCoins(address, balance.coinType);
      log.info(`zero coins: ${zeroCoins.data.length}`);
      for (let i = 0; i < zeroCoins.data.length; i++) {
        const coinData = zeroCoins.data[i].data as any;
        console.log(coinData.objectId);
        txb.moveCall({
          target: `0x2::coin::destroy_zero`,
          typeArguments: [balance.coinType],
          arguments: [txb.object(coinData.objectId)],
        });
      }
    }

    const signer = getSigner();
    const result = await client.signAndExecuteTransaction(txb, signer);
    log.info(`transaction %s `, transactionLink(result.digest));
    log.info(`transaction link : ${transactionLink(result.digest)}`);
  });

program
  .command("swap")
  .description("swap tokens")
  .option("-v, --verbose", "verbose output")
  .option("-a, --amount <amount>", "amount to swap", "0.1")
  .option("-f, --from <from>", "from coin", "USDC")
  .option("-t, --to <to>", "to coin", "USDC")
  .option(
    "-p, --price <price>",
    "limit price for swap , if price > 0, it will check if the price is too high if price < 0, it will check if the price is too low",
    "0"
  )
  .option("-s, --slippage <slippage>", "slippage", "0.01")
  .option("-e, --execute ", "execute the transaction", false)
  .option("-l, --loop <loop> ", "loop times", "1")
  .option("-w, --wait <wait> ", "wait time as milliseconds", "1000")
  .option(
    "-d, --diff <diff> ",
    "diff price will change when loop 30 times",
    "0"
  )
  .action(
    async ({
      amount,
      from,
      to,
      slippage,
      verbose,
      execute,
      price,
      loop,
      wait,
      diff,
    }: {
      amount: number;
      from: string;
      to: string;
      slippage: number;
      verbose: boolean;
      execute: boolean;
      price: number;
      loop: number;
      wait: number;
      diff: number;
    }) => {
      if (verbose) {
        log.level = "debug";
      }
      if (from === to) {
        log.error("from and to cannot be the same");
        return;
      }

      from = from.toUpperCase();
      to = to.toUpperCase();

      const address = getAddress();
      const client = await getAggregatorClient(address);
      const supoortCoins = supportCoins;
      const fromCoin = supoortCoins.get(from);
      const toCoin = supoortCoins.get(to);
      if (!fromCoin || !toCoin) {
        log.error("Invalid coin");
        return;
      }

      const amountIn = new BN(amount * 10 ** fromCoin.decimal);
      log.info(`You will swap ${amount} ${fromCoin.name} to ${toCoin.name}`);

      for (let i = 0; i < loop; i++) {
        try {
          if (diff % 30 === 0) {
            price = price + diff;
            log.info(`change price to : ${price}`);
          }

          const routers = await client.findRouters({
            from: fromCoin.packageAddress,
            target: toCoin.packageAddress,
            amount: amountIn,
            byAmountIn: true,
          });

          if (!routers) {
            log.error("No routers found");
            return;
          }

          console.table([
            {
              direction: "from",
              coionName: fromCoin.name,
              amountIn: routers.amountIn.toString(),
              decimal: fromCoin.decimal,
              floatAmount: routers.amountIn.toNumber() / 10 ** fromCoin.decimal,
            },
            {
              direction: "to",
              coionName: toCoin.name,
              amountIn: routers.amountOut.toString(),
              decimal: toCoin.decimal,
              floatAmount: routers.amountOut.toNumber() / 10 ** toCoin.decimal,
            },
          ]);

          if (price > 0) {
            const expectAmountOut = Number(price * amount);
            log.info(`expectAmountOut: ${expectAmountOut}`);
            log.info(
              `routers.amountOut: ${
                routers.amountOut.toNumber() / 10 ** toCoin.decimal
              }`
            );
            log.info(
              `router.price: ${
                routers.amountOut.toNumber() /
                10 ** toCoin.decimal /
                (routers.amountIn.toNumber() / 10 ** fromCoin.decimal)
              }`
            );
            log.info(`expect price: ${price}`);
            log.info(`reverse price: ${1 / price}`);
            if (
              expectAmountOut >
              routers.amountOut.toNumber() / 10 ** toCoin.decimal
            ) {
              log.error(
                "Limit Price is too high, please change the limit price or try again"
              );
              await sleep(wait);
              continue;
            }
          }

          for (const router of routers.routes) {
            displayRouter(router);
          }

          const txb = new Transaction();
          await client.fastRouterSwap({
            routers: routers.routes,
            byAmountIn: true,
            txb: txb,
            slippage: slippage,
          });

          txb.setSender(address);
          const bytes = await txb.build({
            client: new SuiClient({ url: rpc }),
          });
          log.debug("transaction bytes", Buffer.from(bytes).toString("hex"));

          if (execute) {
            log.info("let's execute the transaction");
            const result = await client.signAndExecuteTransaction(
              txb,
              getSigner()
            );
            log.info("transaction %s ", transactionLink(result.digest));
          } else {
            log.info("skip execute");
          }
          break;
        } catch (error) {
          log.error(error);
        }
      }
    }
  );

program
  .command("price")
  .description("Get direct Cetus price")
  .option("-p, --pool <poolId>", "pool ID")
  .option("-f, --from <from>", "from coin symbol", "SUI")
  .option("-t, --to <to>", "to coin symbol", "USDC")
  .action(async ({ pool, from, to }) => {
    try {
      if (pool) {
        // 直接通过池子ID获取价格
        const priceInfo = await getCetusPrice(pool);
        if (priceInfo) {
          log.info("Pool Price Info:");
          log.info(`Pool ID: ${priceInfo.poolId}`);
          log.info(`Coin X Amount: ${priceInfo.coin_amount_a}`);
          log.info(`Coin Y Amount: ${priceInfo.coin_amount_b}`);
          log.info(`Price: ${priceInfo.price}`);
          log.info(`1 ${to} = ${priceInfo.price} ${from}`);
        } else {
          log.error("Failed to get price for pool");
        }
      } else {
        const priceInfo = await getCetusPriceBySymbol(from, to);
        if (priceInfo) {
          log.info(`Get price for ${from}/${to}:`);
          log.info(`Price is: ${priceInfo.price}`);
          log.info(`1 ${from} = ${priceInfo.price} ${to}`);
        } else {
          log.error(`Failed to get price for ${from}/${to}`);
        }
      }
    } catch (error) {
      log.error(error);
    }
  });

program
  .command("arbitrage")
  .description("Start arbitrage bot")
  .option("-c, --config <file>", "config file path (JSON format)")
  .option("-m, --min-profit <percentage>", "minimum profit percentage", "0.5")
  .option("-a, --max-amount <amount>", "maximum trade amount in USDC", "100")
  .option("-s, --slippage <slippage>", "maximum slippage", "0.01")
  .option("-i, --interval <ms>", "check interval in milliseconds", "5000")
  .option(
    "-p, --pairs <pairs>",
    "trading pairs (comma separated)",
    "SUI_USDC,WAL_USDC,IKA_USDC"
  )
  .option("-e, --execute", "execute trades (default: simulation only)", false)
  .action(
    async ({
      config: configFile,
      minProfit,
      maxAmount,
      slippage,
      interval,
      pairs,
      execute,
    }) => {
      let config: any = {};

      // 如果提供了配置文件，先读取配置文件
      if (configFile) {
        try {
          const fs = await import("fs");
          const path = await import("path");

          const configPath = path.resolve(configFile);
          if (!fs.existsSync(configPath)) {
            log.error(`Config file not found: ${configPath}`);
            return;
          }

          const configContent = fs.readFileSync(configPath, "utf8");
          config = JSON.parse(configContent);
          log.info(`Loaded config from: ${configPath}`);
        } catch (error) {
          log.error(`Failed to load config file: ${error}`);
          return;
        }
      }

      // 命令行参数会覆盖配置文件中的设置
      if (minProfit !== undefined)
        config.minProfitPercentage = parseFloat(minProfit);
      if (maxAmount !== undefined) config.maxAmount = parseFloat(maxAmount);
      if (slippage !== undefined) config.maxSlippage = parseFloat(slippage);
      if (interval !== undefined) config.checkInterval = parseInt(interval);
      if (pairs !== undefined)
        config.enabledPairs = pairs.split(",").map((p: string) => p.trim());

      // 设置默认值
      if (!config.minAmount) config.minAmount = 10;
      if (!config.maxRetries) config.maxRetries = 3;

      log.info("Starting arbitrage bot with config:", config);

      if (!execute) {
        log.warn(
          "Running in simulation mode. Use --execute to enable real trading."
        );
      }

      try {
        const defaultConfig = createDefaultArbitrageConfig();
        const finalConfig = { ...defaultConfig, ...config };

        const bot = new ArbitrageBot(finalConfig);

        // 设置优雅退出
        process.on("SIGINT", () => {
          log.info("Received SIGINT, stopping arbitrage bot...");
          bot.stop();
          process.exit(0);
        });

        process.on("SIGTERM", () => {
          log.info("Received SIGTERM, stopping arbitrage bot...");
          bot.stop();
          process.exit(0);
        });

        await bot.start();
      } catch (error) {
        log.error("Failed to start arbitrage bot:", error);
      }
    }
  );

const run = async () => {
  ensureStoragePath();
  program.parse(process.argv);
};

run();
