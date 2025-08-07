#!/usr/bin/env node

import { ArbitrageBot, createDefaultArbitrageConfig } from "./arbitrage";
import log from "./log";

async function testArbitrageOpportunity() {
  log.info("Testing arbitrage opportunity detection...");

  try {
    // 创建机器人实例来测试套利机会检测
    const config = createDefaultArbitrageConfig();
    const bot = new ArbitrageBot(config);

    // 使用反射来访问私有方法（仅用于测试）
    const opportunity = await (bot as any).findArbitrageOpportunity("SUI_USDC");

    if (opportunity) {
      log.info("Found arbitrage opportunity:");
      log.info(`From: ${opportunity.fromCoin} -> ${opportunity.toCoin}`);
      log.info(`Amount: ${opportunity.amount}`);
      log.info(`Expected Profit: ${opportunity.expectedProfit} USDC`);
      log.info(
        `Profit Percentage: ${opportunity.profitPercentage.toFixed(2)}%`
      );
      log.info(
        `Route 1: ${opportunity.route1.from} -> ${opportunity.route1.to} @ ${opportunity.route1.price}`
      );
      log.info(
        `Route 2: ${opportunity.route2.from} -> ${opportunity.route2.to} @ ${opportunity.route2.price}`
      );
    } else {
      log.info("No arbitrage opportunity found for SUI_USDC");
    }
  } catch (error) {
    log.error("Error testing arbitrage opportunity:", error);
  }
}

async function testArbitrageBot() {
  log.info("Testing arbitrage bot...");

  try {
    const config = createDefaultArbitrageConfig();
    config.checkInterval = 10000; // 10秒检查一次
    config.minProfitPercentage = 0.1; // 降低最小利润要求用于测试

    const bot = new ArbitrageBot(config);

    // 运行5秒后停止
    setTimeout(() => {
      log.info("Stopping test after 5 seconds...");
      bot.stop();
    }, 5000);

    await bot.start();
  } catch (error) {
    log.error("Error testing arbitrage bot:", error);
  }
}

async function main() {
  const testType = process.argv[2] || "opportunity";

  switch (testType) {
    case "opportunity":
      await testArbitrageOpportunity();
      break;
    case "bot":
      await testArbitrageBot();
      break;
    default:
      log.error("Unknown test type. Use 'opportunity' or 'bot'");
  }
}

if (require.main === module) {
  main().catch(console.error);
}
