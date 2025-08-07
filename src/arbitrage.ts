import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import BN from "bn.js";
import { Decimal } from "decimal.js";
import log from "./log";
import {
  getAddress,
  getAggregatorClient,
  getSigner,
  transactionLink,
  rpc,
  getBalance,
  getDecimal,
  getCoinName,
  sleep,
} from "./sdk";
import { getCetusPrice, getCetusPriceBySymbol } from "./cetus";
import { supportCoins, CETUS_POOLS } from "./config";

export interface ArbitrageOpportunity {
  fromCoin: string;
  toCoin: string;
  amount: number;
  expectedProfit: number;
  profitPercentage: number;
  route1: {
    from: string;
    to: string;
    price: number;
  };
  route2: {
    from: string;
    to: string;
    price: number;
  };
}

export interface ArbitrageConfig {
  minProfitPercentage: number; // 最小利润百分比
  maxAmount: number; // 最大交易金额
  minAmount: number; // 最小交易金额
  maxSlippage: number; // 最大滑点
  checkInterval: number; // 检查间隔（毫秒）
  maxRetries: number; // 最大重试次数
  enabledPairs: string[]; // 启用的交易对
}

export class ArbitrageBot {
  private config: ArbitrageConfig;
  private isRunning: boolean = false;
  private totalProfit: number = 0;
  private totalTrades: number = 0;

  constructor(config: ArbitrageConfig) {
    this.config = config;
  }

  /**
   * 启动套利机器人
   */
  async start() {
    if (this.isRunning) {
      log.warn("Arbitrage bot is already running");
      return;
    }

    this.isRunning = true;
    log.info("Starting arbitrage bot...");
    log.info(`Config: ${JSON.stringify(this.config, null, 2)}`);

    while (this.isRunning) {
      try {
        await this.checkArbitrageOpportunities();
        await sleep(this.config.checkInterval);
      } catch (error) {
        log.error("Error in arbitrage loop:", error);
        await sleep(this.config.checkInterval);
      }
    }
  }

  /**
   * 停止套利机器人
   */
  stop() {
    this.isRunning = false;
    log.info("Stopping arbitrage bot...");
    log.info(`Total profit: ${this.totalProfit} USDC`);
    log.info(`Total trades: ${this.totalTrades}`);
  }

  /**
   * 检查套利机会
   */
  private async checkArbitrageOpportunities() {
    const opportunities: ArbitrageOpportunity[] = [];

    // 检查所有启用的交易对
    for (const pair of this.config.enabledPairs) {
      const opportunity = await this.findArbitrageOpportunity(pair);
      if (opportunity) {
        opportunities.push(opportunity);
      }
    }

    // 按利润排序
    opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);

    // 执行最有利可图的套利
    for (const opportunity of opportunities) {
      if (opportunity.profitPercentage >= this.config.minProfitPercentage) {
        await this.executeArbitrage(opportunity);
        break; // 一次只执行一个套利
      }
    }
  }

  /**
   * 寻找特定交易对的套利机会
   */
  private async findArbitrageOpportunity(
    pair: string
  ): Promise<ArbitrageOpportunity | null> {
    try {
      const [coin1, coin2] = pair.split("_");

      // 获取两个方向的价格
      const price1to2 = await getCetusPriceBySymbol(coin1, coin2);
      const price2to1 = await getCetusPriceBySymbol(coin2, coin1);

      if (!price1to2 || !price2to1) {
        return null;
      }

      // 计算套利机会
      const price1 = price1to2.price.toNumber();
      const price2 = price2to1.price.toNumber();

      // 如果价格有差异，可能存在套利机会
      const priceDiff = Math.abs(price1 - 1 / price2);
      const profitPercentage = (priceDiff / Math.min(price1, 1 / price2)) * 100;

      if (profitPercentage > 0.1) {
        // 至少0.1%的利润
        const amount = Math.min(this.config.maxAmount, this.config.minAmount);

        return {
          fromCoin: coin1,
          toCoin: coin2,
          amount: amount,
          expectedProfit: amount * priceDiff,
          profitPercentage: profitPercentage,
          route1: {
            from: coin1,
            to: coin2,
            price: price1,
          },
          route2: {
            from: coin2,
            to: coin1,
            price: price2,
          },
        };
      }
    } catch (error) {
      log.error(`Error finding arbitrage opportunity for ${pair}:`, error);
    }

    return null;
  }

  /**
   * 执行套利交易
   */
  private async executeArbitrage(opportunity: ArbitrageOpportunity) {
    log.info(
      `Executing arbitrage: ${opportunity.fromCoin} <-> ${opportunity.toCoin}`
    );
    log.info(
      `Expected profit: ${
        opportunity.expectedProfit
      } USDC (${opportunity.profitPercentage.toFixed(2)}%)`
    );

    try {
      const address = getAddress();
      const client = await getAggregatorClient(address);

      // 第一步：从 coin1 到 coin2
      const result1 = await this.executeSwap(
        client,
        opportunity.fromCoin,
        opportunity.toCoin,
        opportunity.amount,
        this.config.maxSlippage
      );

      if (!result1) {
        log.error("First swap failed");
        return;
      }

      // 等待交易确认
      await sleep(2000);

      // 第二步：从 coin2 回到 coin1
      const result2 = await this.executeSwap(
        client,
        opportunity.toCoin,
        opportunity.fromCoin,
        opportunity.amount * opportunity.route1.price,
        this.config.maxSlippage
      );

      if (!result2) {
        log.error("Second swap failed");
        return;
      }

      // 计算实际利润
      const actualProfit = this.calculateActualProfit(opportunity);
      this.totalProfit += actualProfit;
      this.totalTrades++;

      log.info(`Arbitrage completed successfully!`);
      log.info(`Actual profit: ${actualProfit} USDC`);
      log.info(`Total profit so far: ${this.totalProfit} USDC`);
      log.info(`Total trades: ${this.totalTrades}`);
    } catch (error) {
      log.error("Error executing arbitrage:", error);
    }
  }

  /**
   * 执行单个交换
   */
  private async executeSwap(
    client: any,
    fromCoin: string,
    toCoin: string,
    amount: number,
    slippage: number
  ): Promise<boolean> {
    try {
      const fromCoinMeta = supportCoins.get(fromCoin);
      const toCoinMeta = supportCoins.get(toCoin);

      if (!fromCoinMeta || !toCoinMeta) {
        log.error(`Invalid coin: ${fromCoin} or ${toCoin}`);
        return false;
      }

      const amountIn = new BN(amount * 10 ** fromCoinMeta.decimal);

      // 查找路由
      const routers = await client.findRouters({
        from: fromCoinMeta.packageAddress,
        target: toCoinMeta.packageAddress,
        amount: amountIn,
        byAmountIn: true,
      });

      if (!routers || routers.routes.length === 0) {
        log.error("No routers found");
        return false;
      }

      // 构建交易
      const txb = new Transaction();
      await client.fastRouterSwap({
        routers: routers.routes,
        byAmountIn: true,
        txb: txb,
        slippage: slippage,
      });

      txb.setSender(getAddress());

      // 执行交易
      const result = await client.signAndExecuteTransaction(txb, getSigner());
      log.info(`Swap transaction: ${transactionLink(result.digest)}`);

      return true;
    } catch (error) {
      log.error(`Error executing swap ${fromCoin} -> ${toCoin}:`, error);
      return false;
    }
  }

  /**
   * 计算实际利润
   */
  private calculateActualProfit(opportunity: ArbitrageOpportunity): number {
    // 这里可以根据实际交易结果计算利润
    // 简化版本，使用预期利润
    return opportunity.expectedProfit;
  }

  /**
   * 获取机器人状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      totalProfit: this.totalProfit,
      totalTrades: this.totalTrades,
      config: this.config,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ArbitrageConfig>) {
    this.config = { ...this.config, ...newConfig };
    log.info("Arbitrage bot config updated");
  }
}

/**
 * 创建默认的套利机器人配置
 */
export function createDefaultArbitrageConfig(): ArbitrageConfig {
  return {
    minProfitPercentage: 0.5, // 最小0.5%利润
    maxAmount: 100, // 最大100 USDC
    minAmount: 10, // 最小10 USDC
    maxSlippage: 0.01, // 1%滑点
    checkInterval: 5000, // 5秒检查一次
    maxRetries: 3,
    enabledPairs: ["SUI_USDC", "WAL_USDC", "IKA_USDC"],
  };
}

/**
 * 快速启动套利机器人的便捷函数
 */
export async function startArbitrageBot(config?: Partial<ArbitrageConfig>) {
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
  return bot;
}
