import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import fs from "fs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  AggregatorClient,
  Env,
  Path,
  Router,
} from "@cetusprotocol/aggregator-sdk";
import { supportCoins, aggregatorURL } from "./config";
import { getKeysJsonFilePath } from "./storage";
import log from "./log";

interface Keys {
  address: string;
  privateKey: string;
}

const keysJsonFile = getKeysJsonFilePath();

type Network = "mainnet" | "testnet" | "devnet" | "localnet";

export const network: Network = (process.env.NETWORK || "mainnet") as Network;

// RPC URL based on network
export const rpc = getFullnodeUrl(network);

interface Keys {
  address: string;
  privateKey: string;
}

export const getAddress = () => {
  const pair = fs.readFileSync(keysJsonFile, "utf8");
  const keys = JSON.parse(pair) as Keys;
  return keys.address;
};

export const getSuiClient = () => {
  return new SuiClient({
    url: rpc,
  });
};

export const getBalance = async (address: string) => {
  const client = getSuiClient();

  const balances = await client.getAllBalances({
    owner: address,
  });
  return balances;
};

export const initKeypair = async () => {
  if (fs.existsSync(keysJsonFile)) {
    log.info(`${keysJsonFile} already exists`);
    return;
  }

  const keypair = Ed25519Keypair.generate();
  const address = keypair.getPublicKey().toSuiAddress();
  const j: Keys = {
    address: address,
    privateKey: keypair.getSecretKey().toString(),
  };

  fs.writeFileSync(keysJsonFile, JSON.stringify(j, null, 2));
};

export const getCoinName = (packageAddress: string): string => {
  for (const coin of supportCoins.values()) {
    if (coin.packageAddress === packageAddress) {
      return coin.name;
    }
  }
  return "";
};

export const getDecimal = (packageAddress: string): number => {
  for (const coin of supportCoins.values()) {
    if (coin.packageAddress === packageAddress) {
      return coin.decimal;
    }
  }
  return -1;
};

export const getAggregatorClient = async (
  signer: string
): Promise<AggregatorClient> => {
  return new AggregatorClient({
    endpoint: aggregatorURL,
    env: network === "mainnet" ? Env.Mainnet : Env.Testnet,
    signer: signer,
    client: getSuiClient(),
  });
};

export const getCoinMetadata = async (coinType: string) => {
  const client = getSuiClient();
  const coinMeta = await client.getCoinMetadata({
    coinType: coinType,
  });
  return coinMeta;
};

export const displayRouter = (router: Router) => {
  log.debug("--------------------------------");
  log.debug(router.path.map((p: Path) => p.provider).join(" -> "));
  log.debug(`Input : ${router.amountIn.toString()}`);
  log.debug(`Output : ${router.amountOut.toString()}`);
  log.debug(`Initial Price : ${router.initialPrice.toString()}`);
};

export const getSigner = (): Ed25519Keypair => {
  const pair = fs.readFileSync(keysJsonFile, "utf8");
  const keys = JSON.parse(pair) as Keys;
  return Ed25519Keypair.fromSecretKey(keys.privateKey);
};

export const transactionLink = (txHash: string) => {
  return `https://suiscan.xyz/tx/${txHash}`;
};
