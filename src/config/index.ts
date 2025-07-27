import dotenv from 'dotenv';
import { parseGwei } from 'viem';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable ${name}: ${value}`);
  }
  return parsed;
}

export const config = {
  // Blockchain configuration
  privateKey: requireEnv('PRIVATE_KEY') as `0x${string}`,
  targetAddress: requireEnv('TARGET_ADDRESS') as `0x${string}`,
  baseRpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  baseRpcUrls: [
    process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base-mainnet.public.blastapi.io',
    'https://1rpc.io/base',
  ],
  diamondContractAddress: (process.env.DIAMOND_CONTRACT_ADDRESS || '0xA99c4B08201F2913Db8D28e71d020c4298F29dBF') as `0x${string}`,
  
  // Gas configuration removed - using default network gas settings
  
  // Telegram configuration
  telegram: {
    botToken: requireEnv('TELEGRAM_BOT_TOKEN'),
    chatId: requireEnv('TELEGRAM_CHAT_ID'),
  },
  
  // Monitoring configuration
  petIntervalHours: getEnvNumber('PET_INTERVAL_HOURS', 12),
  healthCheckIntervalMinutes: getEnvNumber('HEALTH_CHECK_INTERVAL_MINUTES', 30),
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Chain configuration
  chain: {
    id: 8453, // Base mainnet
    name: 'Base',
    rpcUrls: {
      default: {
        http: [
          process.env.BASE_RPC_URL || 'https://mainnet.base.org',
          'https://base.llamarpc.com',
          'https://base-mainnet.public.blastapi.io',
          'https://1rpc.io/base',
        ],
      },
      public: {
        http: [
          'https://mainnet.base.org',
          'https://base.llamarpc.com',
          'https://base-mainnet.public.blastapi.io',
          'https://1rpc.io/base',
        ],
      },
    },
    blockExplorers: {
      default: {
        name: 'BaseScan',
        url: 'https://basescan.org',
      },
    },
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
} as const;

// Validate configuration on load
export function validateConfig(): void {
  try {
    // Validate addresses
    if (!config.privateKey.startsWith('0x') || config.privateKey.length !== 66) {
      throw new Error('Invalid private key format');
    }
    
    if (!config.targetAddress.startsWith('0x') || config.targetAddress.length !== 42) {
      throw new Error('Invalid target address format');
    }
    
    if (!config.diamondContractAddress.startsWith('0x') || config.diamondContractAddress.length !== 42) {
      throw new Error('Invalid diamond contract address format');
    }
    
    // Validate numeric values
    if (config.petIntervalHours <= 0) {
      throw new Error('Pet interval must be positive');
    }
    
    console.log('✅ Configuration validated successfully');
  } catch (error) {
    console.error('❌ Configuration validation failed:', error);
    process.exit(1);
  }
}