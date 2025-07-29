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
} from "./sdk";
import { getCetusPrice, getCetusPriceBySymbol } from "./cetus";
import log from "./log";
import { SuiClient } from "@mysten/sui/client";
import { POOL_MAPPING, supportCoins } from "./config";

import BN from "bn.js";

const program = new commander.Command();
program.version("1.0.0");

program
  .command("info")
  .description("Get info")
  .action(async () => {
    log.info("Getting balance");
    const address = getAddress();
    log.info(`Address: ${address}`);
    const balances = await getBalance(address);
    const balanceTable = [];

    for (const balance of balances) {
      const decimal = getDecimal(balance.coinType);
      const coinName = getCoinName(balance.coinType);

      let price = 1.0;
      if (coinName !== "USDC") {
        const priceInfo = await getCetusPriceBySymbol("USDC", coinName);
        if (priceInfo) {
          price = priceInfo.price.toNumber();
        }
      }

      if (decimal === -1) {
        balanceTable.push({
          coinType: balance.coinType,
          balance: balance.totalBalance,
          decimal: decimal,
          price: price,
        });
        continue;
      } else {
        balanceTable.push({
          coinType: balance.coinType,
          balance: Number(balance.totalBalance) / 10 ** decimal,
          decimal: decimal,
          price: price,
        });
      }
    }
    console.table(balanceTable);
  });

program
  .command("init")
  .description("Init .env")
  .action(async () => {
    await initKeypair();
  });

program
  .command("swap")
  .description("swap tokens")
  .option("-v, --verbose", "verbose output")
  .option("-a, --amount <amount>", "amount to swap", "0.1")
  .option("-f, --from <from>", "from coin", "USDC")
  .option("-t, --to <to>", "to coin", "SUI")
  .option("-s, --slippage <slippage>", "slippage", "0.01")
  .action(async ({ amount, from, to, slippage, verbose }) => {
    if (verbose) {
      log.level = "debug";
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

    try {
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
      const bytes = await txb.build({ client: new SuiClient({ url: rpc }) });
      log.debug("transaction bytes", Buffer.from(bytes).toString("hex"));

      log.info("let's execute the transaction");

      const result = await client.signAndExecuteTransaction(txb, getSigner());

      log.info("transaction %s ", transactionLink(result.digest));
    } catch (error) {
      log.error(error);
    }
  });

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

program.parse(process.argv);
