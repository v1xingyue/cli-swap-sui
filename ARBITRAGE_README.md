# 套利机器人使用指南

## 概述

这个套利机器人可以在 Sui 网络上的 Cetus 协议中寻找和执行套利交易。它通过监控不同交易对之间的价格差异来发现套利机会。

## 功能特性

- 🔍 **自动检测套利机会**: 持续监控多个交易对的价格差异
- ⚡ **快速执行**: 发现机会后立即执行交易
- 🛡️ **风险控制**: 可配置的最小利润阈值和滑点保护
- 📊 **实时监控**: 显示交易历史和总利润
- 🔧 **灵活配置**: 支持自定义交易对、金额和检查间隔

## 安装和设置

1. 确保已安装依赖：
```bash
pnpm install
```

2. 初始化密钥对：
```bash
pnpm cli init
```

3. 检查余额：
```bash
pnpm cli info
```

## 使用方法

### 基本用法

启动套利机器人（模拟模式）：
```bash
pnpm cli arbitrage
```

启动套利机器人（实际交易）：
```bash
pnpm cli arbitrage --execute
```

### 高级配置

#### 使用配置文件（推荐）
```bash
# 使用默认配置文件
pnpm cli arbitrage --config arbitrage-config.json

# 使用自定义配置文件
pnpm cli arbitrage --config my-config.json --execute
```

#### 使用命令行参数
```bash
pnpm cli arbitrage \
  --min-profit 0.3 \
  --max-amount 50 \
  --slippage 0.005 \
  --interval 3000 \
  --pairs "SUI_USDC,WAL_USDC" \
  --execute
```

#### 混合使用（命令行参数会覆盖配置文件）
```bash
pnpm cli arbitrage \
  --config arbitrage-config.json \
  --min-profit 0.3 \
  --execute
```

### 参数说明

#### 配置文件参数
- `--config <file>`: 配置文件路径（JSON格式）

#### 命令行参数
- `--min-profit <percentage>`: 最小利润百分比（默认: 0.5%）
- `--max-amount <amount>`: 最大交易金额（USDC，默认: 100）
- `--slippage <slippage>`: 最大滑点（默认: 0.01）
- `--interval <ms>`: 检查间隔（毫秒，默认: 5000）
- `--pairs <pairs>`: 交易对列表（逗号分隔，默认: "SUI_USDC,WAL_USDC,IKA_USDC"）
- `--execute`: 启用实际交易（默认: 模拟模式）

**注意**: 命令行参数会覆盖配置文件中的相同设置

## 测试

### 测试套利机会检测
```bash
pnpm tsx src/test-arbitrage.ts opportunity
```

### 测试套利机器人（5秒后自动停止）
```bash
pnpm tsx src/test-arbitrage.ts bot
```

## 配置说明

### 默认配置
```typescript
{
  minProfitPercentage: 0.5,    // 最小0.5%利润
  maxAmount: 100,              // 最大100 USDC
  minAmount: 10,               // 最小10 USDC
  maxSlippage: 0.01,           // 1%滑点
  checkInterval: 5000,         // 5秒检查一次
  maxRetries: 3,               // 最大重试次数
  enabledPairs: ["SUI_USDC", "WAL_USDC", "IKA_USDC"]
}
```

### 支持的交易对
- `SUI_USDC`: SUI 和 USDC
- `WAL_USDC`: WAL 和 USDC  
- `IKA_USDC`: IKA 和 USDC

## 安全注意事项

⚠️ **重要提醒**:

1. **资金风险**: 套利交易涉及实际资金，请确保理解风险
2. **测试模式**: 首次使用建议在模拟模式下测试
3. **小额开始**: 建议从小额开始，逐步增加交易金额
4. **监控运行**: 运行期间请保持监控，及时处理异常
5. **网络费用**: 注意 Sui 网络的交易费用

## 停止机器人

使用 `Ctrl+C` 优雅停止机器人，它会显示总利润和交易次数。

## 故障排除

### 常见问题

1. **"No routers found"**: 可能是网络问题或流动性不足
2. **"Invalid coin"**: 检查交易对配置是否正确
3. **"Transaction failed"**: 检查余额是否充足，滑点是否合理

### 日志级别

调整日志级别以获取更多信息：
```bash
DEBUG=* pnpm cli arbitrage
```

## 开发

### 文件结构
- `src/arbitrage.ts`: 套利机器人核心逻辑
- `src/cli.ts`: 命令行界面
- `src/test-arbitrage.ts`: 测试文件

### 扩展功能
可以通过修改 `ArbitrageBot` 类来添加新功能：
- 支持更多交易对
- 添加更复杂的套利策略
- 集成其他 DEX
- 添加风险管理功能

## 免责声明

本软件仅供学习和研究使用。使用本软件进行实际交易的风险由用户自行承担。作者不对任何损失负责。
