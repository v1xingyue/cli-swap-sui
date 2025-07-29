import { getDecimal, getSuiClient, network, rpc } from "./sdk";
import log from "./log";
import { CetusClmmSDK } from "@cetusprotocol/sui-clmm-sdk";
import { TickMath } from "@cetusprotocol/common-sdk";

import BN from "bn.js";
import { Decimal } from "decimal.js";
import { POOL_MAPPING } from "./config";

const sdk = CetusClmmSDK.createSDK({
  full_rpc_url: rpc,
  env: network as any,
  sui_client: getSuiClient(),
});

export const getPriceFromSqrtPrice = (
  sqrtPrice: BN,
  decimalA: number,
  decimalB: number
): Decimal => {
  return TickMath.sqrtPriceX64ToPrice(sqrtPrice, decimalA, decimalB);
};

// 获取 Cetus 池子的价格
export const getCetusPrice = async (poolId: string) => {
  log.info(`Getting price for pool ${poolId}`);
  const pool = await sdk.Pool.getPool(poolId);

  try {
    const decimalA = getDecimal(pool.coin_type_a);
    const decimalB = getDecimal(pool.coin_type_b);

    const price = getPriceFromSqrtPrice(
      new BN(pool.current_sqrt_price),
      decimalA,
      decimalB
    );

    return {
      poolId,
      price,
      ...pool,
    };
  } catch (error) {
    console.error("Error getting Cetus price:", error);
    return null;
  }
};

// 获取多个 Cetus 池子的价格
export const getCetusPrices = async (poolIds: string[]) => {
  const prices = [];

  for (const poolId of poolIds) {
    const price = await getCetusPrice(poolId);
    if (price) {
      prices.push(price);
    }
  }

  return prices;
};

// 通过代币符号获取价格
export const getCetusPriceBySymbol = async (
  fromSymbol: string,
  toSymbol: string
) => {
  fromSymbol = fromSymbol.toUpperCase();
  toSymbol = toSymbol.toUpperCase();

  const poolKey = `${fromSymbol}_${toSymbol}`;
  const reversePoolKey = `${toSymbol}_${fromSymbol}`;

  let poolId = POOL_MAPPING[poolKey];
  let isReversed = false;

  if (!poolId) {
    poolId = POOL_MAPPING[reversePoolKey];
    isReversed = true;
    log.info(`Is Reversed: ${isReversed}`);
  }

  if (!poolId) {
    throw new Error(`Pool not found for ${fromSymbol}/${toSymbol}`);
  }
  const priceInfo = await getCetusPrice(poolId);
  if (priceInfo && isReversed) {
    return {
      ...priceInfo,
      price: new Decimal(1).div(priceInfo.price),
    };
  }

  return priceInfo;
};

export const addLiquidity = async (poolId: string, amountA: number) => {
  const pool = await sdk.Pool.getPool(poolId);
  const decimalA = getDecimal(pool.coin_type_a);
  const decimalB = getDecimal(pool.coin_type_b);
  const sqrtPrice = TickMath.priceToSqrtPriceX64(
    new Decimal(amountA),
    decimalA,
    decimalB
  );

  // sdk.Pool.addLiquidity(poolId, sqrtPrice);

  return sqrtPrice;
};
