export interface CoinMetadata {
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
  [
    "IKA",
    {
      name: "IKA",
      packageAddress:
        "0x7262fb2f7a3a14c888c438a3cd9b912469a58cf60f367352c46584262e8299aa::ika::IKA",
      decimal: 9,
    },
  ],
]);

export const aggregatorURL = "https://api-sui.cetus.zone/router_v2/find_routes";

export const CETUS_POOLS = {
  SUI_USDC:
    "0xb8d7d9e66a60c239e7a60110efcf8de6c705580ed924d0dde141f4a0e2c90105",
  WAL_USDC:
    "0x4f665396e49a6a9f233580eed6dfdeff9b5e1054094f27dbb2bd568bdc4e75d5",
  IKA_USDC:
    "0x50c70f93287100fb2314dcf2d6703973828c501515d0867017f969dd3cfcaf64",
};

// 代币符号到池子ID的映射
export const POOL_MAPPING: Record<string, string> = {
  SUI_USDC: CETUS_POOLS.SUI_USDC,
  WAL_USDC: CETUS_POOLS.WAL_USDC,
  IKA_USDC: CETUS_POOLS.IKA_USDC,
};
