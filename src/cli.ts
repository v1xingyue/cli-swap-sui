#!/usr/bin/env node

import commander from "commander";
import { Transaction } from "@mysten/sui/transactions";
import {
  getBalance,
  getAddress,
  initKeypair,
  getAggregatorClient,
  supportCoins,
  displayRouter,
  rpc,
  getSigner,
  transactionLink,
  getDecimal,
} from "./sdk";
import log from "./log";
import { SuiClient } from "@mysten/sui/client";

import BN from "bn.js";

const program = new commander.Command();
program.version("1.0.0");

program
  .command("balance")
  .description("Get balance")
  .action(async () => {
    log.info("Getting balance");
    const address = getAddress();
    const balances = await getBalance(address);
    const balanceTable = [];
    for (const balance of balances) {
      const decimal = getDecimal(balance.coinType);
      if (decimal === -1) {
        balanceTable.push({
          coinType: balance.coinType,
          balance: balance.totalBalance,
          decimal: decimal,
        });
        continue;
      } else {
        balanceTable.push({
          coinType: balance.coinType,
          balance: Number(balance.totalBalance) / 10 ** decimal,
          decimal: decimal,
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

program.parse(process.argv);
