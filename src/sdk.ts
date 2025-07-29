import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import fs from "fs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  AggregatorClient,
  Env,
  Path,
  Router,
} from "@cetusprotocol/aggregator-sdk";
import path from "path";

export const getHomePath = () => {
  return process.env.HOME || ".";
};

export const getKeysJsonFilePath = () => {
  return path.join(getHomePath(), ".cli-swap-sui.keys.json");
};

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
    console.log(`${keysJsonFile} already exists`);
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

interface CoinMetadata {
  name: string;
  packageAddress: string;
  decimal: number;
}

export const supportCoins = new Map<string, CoinMetadata>([
  ["SUI", { name: "SUI", packageAddress: "0x2::sui::SUI", decimal: 9 }],
  [
    "USDC",
    {
      name: "USDC",
      packageAddress:
        "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
      decimal: 6,
    },
  ],
  [
    "WAL",
    {
      name: "WAL",
      packageAddress:
        "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
      decimal: 9,
    },
  ],
]);

export const getDecimal = (packageAddress: string): number => {
  for (const coin of supportCoins.values()) {
    if (coin.packageAddress === packageAddress) {
      return coin.decimal;
    }
  }
  return -1;
};

export const aggregatorURL = "https://api-sui.cetus.zone/router_v2/find_routes";

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
  console.log("--------------------------------");
  console.log(router.path.map((p: Path) => p.provider).join(" -> "));
  console.log(`Input : ${router.amountIn.toString()}`);
  console.log(`Output : ${router.amountOut.toString()}`);
  console.log(`Initial Price : ${router.initialPrice.toString()}`);
};

export const getSigner = (): Ed25519Keypair => {
  const pair = fs.readFileSync(keysJsonFile, "utf8");
  const keys = JSON.parse(pair) as Keys;
  return Ed25519Keypair.fromSecretKey(keys.privateKey);
};

export const transactionLink = (txHash: string) => {
  return `https://suiscan.xyz/tx/${txHash}`;
};
