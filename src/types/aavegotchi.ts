export interface AavegotchiInfo {
  tokenId: bigint;
  name: string;
  owner: `0x${string}`;
  randomNumber: bigint;
  status: bigint;
  numericTraits: readonly [number, number, number, number, number, number];
  modifiedNumericTraits: readonly [number, number, number, number, number, number];
  equippedWearables: readonly [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
  collateral: `0x${string}`;
  escrow: `0x${string}`;
  stakedAmount: bigint;
  minimumStake: bigint;
  kinship: bigint;
  lastInteracted: bigint;
  experience: bigint;
  toNextLevel: bigint;
  usedSkillPoints: bigint;
  level: bigint;
  hauntId: bigint;
  baseRarityScore: bigint;
  modifiedRarityScore: bigint;
  locked: boolean;
}

export interface PetTarget {
  address: `0x${string}`;
  aavegotchis: AavegotchiInfo[];
  nextPetTime?: number;
}

export interface PetResult {
  success: boolean;
  transactionHash?: `0x${string}`;
  error?: string;
  petCount: number;
}

export interface BotStatus {
  isRunning: boolean;
  lastPetTime?: number;
  nextPetTime?: number;
  totalPets: number;
  errors: number;
  currentTarget?: `0x${string}`;
}

export interface TelegramNotification {
  type: 'success' | 'error' | 'info';
  message: string;
  transactionHash?: `0x${string}`;
}

export interface PetTargetWithTiming {
  address: `0x${string}`;
  allTokenIds: bigint[];
  successfulAavegotchis: AavegotchiInfo[];
  sharedLastInteracted?: bigint;
  nextPetTime?: number;
}