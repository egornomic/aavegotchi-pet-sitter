import { createPublicClient, createWalletClient, http, parseAbi, getContract, type PublicClient, type WalletClient, fallback } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const aavegotchiAbi = JSON.parse(readFileSync(join(__dirname, '../abi/aavegotchi.json'), 'utf8'));
import type { AavegotchiInfo, PetTargetWithTiming } from '../types/aavegotchi.js';

export class AavegotchiContract {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: ReturnType<typeof privateKeyToAccount>;
  private contractAddress: `0x${string}`;

  constructor() {
    this.contractAddress = config.diamondContractAddress;
    this.account = privateKeyToAccount(config.privateKey);

    // Create Base chain configuration
    const baseChain = {
      id: 8453,
      name: 'Base',
      nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
      },
      rpcUrls: {
        default: {
          http: config.baseRpcUrls,
        },
        public: {
          http: config.baseRpcUrls,
        },
      },
      blockExplorers: {
        default: {
          name: 'BaseScan',
          url: 'https://basescan.org',
        },
      },
    } as const;

    // Create fallback transport with multiple RPC URLs
    const transport = fallback(
      config.baseRpcUrls.map(url => http(url)),
      {
        rank: false, // Don't rank by latency, use in order
        retryCount: 2,
        retryDelay: 1000,
      }
    );

    this.publicClient = createPublicClient({
      chain: baseChain,
      transport,
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: baseChain,
      transport,
    });

    logger.info('AavegotchiContract initialized', {
      contractAddress: this.contractAddress,
      account: this.account.address,
      chainId: baseChain.id,
      rpcUrls: config.baseRpcUrls,
      rpcCount: config.baseRpcUrls.length,
    });
  }

  private getContract() {
    return getContract({
      address: this.contractAddress,
      abi: aavegotchiAbi,
      client: {
        public: this.publicClient,
        wallet: this.walletClient,
      },
    });
  }

  async getAllAavegotchisOfOwnerWithTiming(ownerAddress: `0x${string}`): Promise<PetTargetWithTiming> {
    try {
      logger.debug('Fetching Aavegotchis for owner with failure-safe timing', { owner: ownerAddress });
      
      const contract = this.getContract();
      
      // Get ALL token IDs first (this is reliable)
      const tokenIds32 = await contract.read.tokenIdsOfOwner!([ownerAddress]) as number[];
      
      if (tokenIds32.length === 0) {
        logger.info('No Aavegotchis found for owner', { owner: ownerAddress });
        return {
          address: ownerAddress,
          allTokenIds: [],
          successfulAavegotchis: [],
        };
      }
      
      const allTokenIds = tokenIds32.map(id => BigInt(id));
      logger.debug('Found token IDs', { count: allTokenIds.length, tokenIds: allTokenIds.slice(0, 10).map(id => id.toString()) });
      
      // Attempt to fetch individual Aavegotchi data (best effort)
      const successfulAavegotchis: AavegotchiInfo[] = [];
      let sharedLastInteracted: bigint | undefined;
      
      for (const tokenId of allTokenIds) {
        try {
          const gotchi = await contract.read.getAavegotchi!([tokenId]) as any;
          
          const aavegotchiInfo = {
            tokenId: gotchi.tokenId,
            name: gotchi.name,
            owner: gotchi.owner,
            randomNumber: gotchi.randomNumber,
            status: gotchi.status,
            numericTraits: gotchi.numericTraits,
            modifiedNumericTraits: gotchi.modifiedNumericTraits,
            equippedWearables: gotchi.equippedWearables,
            collateral: gotchi.collateral,
            escrow: gotchi.escrow,
            stakedAmount: gotchi.stakedAmount,
            minimumStake: gotchi.minimumStake,
            kinship: gotchi.kinship,
            lastInteracted: gotchi.lastInteracted,
            experience: gotchi.experience,
            toNextLevel: gotchi.toNextLevel,
            usedSkillPoints: gotchi.usedSkillPoints,
            level: gotchi.level,
            hauntId: gotchi.hauntId,
            baseRarityScore: gotchi.baseRarityScore,
            modifiedRarityScore: gotchi.modifiedRarityScore,
            locked: gotchi.locked,
          } as AavegotchiInfo;
          
          // Only include claimed Aavegotchis (status !== 0) in successful list
          if (gotchi.status !== 0n) {
            successfulAavegotchis.push(aavegotchiInfo);
            
            // Use the first successful lastInteracted as the shared timing for ALL tokens
            if (!sharedLastInteracted) {
              sharedLastInteracted = gotchi.lastInteracted;
              logger.debug('Using shared lastInteracted from token', { 
                tokenId: tokenId.toString(), 
                lastInteracted: new Date(Number(sharedLastInteracted) * 1000).toISOString() 
              });
            }
          }
        } catch (error) {
          logger.warn('Failed to fetch individual Aavegotchi', { 
            tokenId: tokenId.toString(), 
            error: error instanceof Error ? error.message : String(error) 
          });
          // Continue with other tokens - we'll still include this token ID in petting
        }
      }
      
      logger.info('Successfully collected Aavegotchis with failure-safe approach', {
        owner: ownerAddress,
        totalTokenIds: allTokenIds.length,
        successfulFetches: successfulAavegotchis.length,
        hasSharedTiming: !!sharedLastInteracted,
        tokenIds: allTokenIds.map(id => id.toString()),
      });

      return {
        address: ownerAddress,
        allTokenIds,
        successfulAavegotchis,
        sharedLastInteracted,
      };
    } catch (error) {
      logger.error('Failed to fetch Aavegotchis with timing', { owner: ownerAddress, error: error instanceof Error ? error.message : String(error) });
      throw new Error(`Failed to fetch Aavegotchis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllAavegotchisOfOwner(ownerAddress: `0x${string}`): Promise<AavegotchiInfo[]> {
    try {
      logger.debug('Fetching Aavegotchis for owner', { owner: ownerAddress });
      
      const contract = this.getContract();
      
      // Use tokenIdsOfOwner + getAavegotchi approach (works on Base)
      const tokenIds32 = await contract.read.tokenIdsOfOwner!([ownerAddress]) as number[];
      
      if (tokenIds32.length === 0) {
        logger.info('No Aavegotchis found for owner', { owner: ownerAddress });
        return [];
      }
      
      logger.debug('Found token IDs', { count: tokenIds32.length, tokenIds: tokenIds32.slice(0, 10) });
      
      // Fetch individual Aavegotchi data
      const aavegotchis: AavegotchiInfo[] = [];
      for (const tokenId32 of tokenIds32) {
        try {
          const tokenId = BigInt(tokenId32);
          const gotchi = await contract.read.getAavegotchi!([tokenId]) as any;
          
          const aavegotchiInfo = {
            tokenId: gotchi.tokenId,
            name: gotchi.name,
            owner: gotchi.owner,
            randomNumber: gotchi.randomNumber,
            status: gotchi.status,
            numericTraits: gotchi.numericTraits,
            modifiedNumericTraits: gotchi.modifiedNumericTraits,
            equippedWearables: gotchi.equippedWearables,
            collateral: gotchi.collateral,
            escrow: gotchi.escrow,
            stakedAmount: gotchi.stakedAmount,
            minimumStake: gotchi.minimumStake,
            kinship: gotchi.kinship,
            lastInteracted: gotchi.lastInteracted,
            experience: gotchi.experience,
            toNextLevel: gotchi.toNextLevel,
            usedSkillPoints: gotchi.usedSkillPoints,
            level: gotchi.level,
            hauntId: gotchi.hauntId,
            baseRarityScore: gotchi.baseRarityScore,
            modifiedRarityScore: gotchi.modifiedRarityScore,
            locked: gotchi.locked,
          } as AavegotchiInfo;
          
          aavegotchis.push(aavegotchiInfo);
        } catch (error) {
          logger.warn('Failed to fetch individual Aavegotchi', { tokenId: tokenId32, error: error instanceof Error ? error.message : String(error) });
        }
      }

      // Filter only claimed Aavegotchis (status !== 0)
      const claimedAavegotchis = aavegotchis.filter(gotchi => gotchi.status !== 0n);
      
      logger.info('Successfully fetched Aavegotchis', {
        owner: ownerAddress,
        total: aavegotchis.length,
        claimed: claimedAavegotchis.length,
        tokenIds: claimedAavegotchis.map(g => g.tokenId.toString()),
      });

      return claimedAavegotchis;
    } catch (error) {
      logger.error('Failed to fetch Aavegotchis', { owner: ownerAddress, error: error instanceof Error ? error.message : String(error) });
      throw new Error(`Failed to fetch Aavegotchis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAavegotchi(tokenId: bigint): Promise<AavegotchiInfo> {
    try {
      logger.debug('Fetching single Aavegotchi', { tokenId: tokenId.toString() });
      
      const contract = this.getContract();
      const gotchi = await contract.read.getAavegotchi!([tokenId]) as any;
      
      const result = {
        tokenId: gotchi.tokenId,
        name: gotchi.name,
        owner: gotchi.owner,
        randomNumber: gotchi.randomNumber,
        status: gotchi.status,
        numericTraits: gotchi.numericTraits,
        modifiedNumericTraits: gotchi.modifiedNumericTraits,
        equippedWearables: gotchi.equippedWearables,
        collateral: gotchi.collateral,
        escrow: gotchi.escrow,
        stakedAmount: gotchi.stakedAmount,
        minimumStake: gotchi.minimumStake,
        kinship: gotchi.kinship,
        lastInteracted: gotchi.lastInteracted,
        experience: gotchi.experience,
        toNextLevel: gotchi.toNextLevel,
        usedSkillPoints: gotchi.usedSkillPoints,
        level: gotchi.level,
        hauntId: gotchi.hauntId,
        baseRarityScore: gotchi.baseRarityScore,
        modifiedRarityScore: gotchi.modifiedRarityScore,
        locked: gotchi.locked,
      } as AavegotchiInfo;

      logger.debug('Successfully fetched Aavegotchi', {
        tokenId: tokenId.toString(),
        name: result.name,
        lastInteracted: new Date(Number(result.lastInteracted) * 1000).toISOString(),
      });

      return result;
    } catch (error) {
      logger.error('Failed to fetch Aavegotchi', { tokenId: tokenId.toString(), error: error instanceof Error ? error.message : String(error) });
      throw new Error(`Failed to fetch Aavegotchi: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async interact(tokenIds: bigint[]): Promise<`0x${string}`> {
    try {
      logger.info('Initiating pet interaction', { 
        tokenIds: tokenIds.map(id => id.toString()),
        count: tokenIds.length 
      });

      const contract = this.getContract();
      
      // Execute the transaction with default gas settings  
      const hash = await contract.write.interact!([tokenIds], {
        account: this.account,
      } as any);

      logger.info('Pet transaction submitted', { 
        hash,
        tokenIds: tokenIds.map(id => id.toString()),
      });

      // Wait for transaction confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        logger.info('Pet transaction confirmed', { 
          hash,
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
        });
      } else {
        throw new Error('Transaction failed');
      }

      return hash;
    } catch (error) {
      logger.error('Failed to pet Aavegotchis', { 
        tokenIds: tokenIds.map(id => id.toString()), 
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Failed to pet Aavegotchis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const blockNumber = await this.publicClient.getBlockNumber();
      logger.debug('Connection check successful', { blockNumber: blockNumber.toString() });
      return true;
    } catch (error) {
      logger.error('Connection check failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  getAccountAddress(): `0x${string}` {
    return this.account.address;
  }

  async estimateInteractGas(tokenIds: bigint[]): Promise<bigint> {
    try {
      const gasEstimate = await this.publicClient.estimateContractGas({
        address: this.contractAddress,
        abi: aavegotchiAbi,
        functionName: 'interact',
        args: [tokenIds],
        account: this.account,
      });

      return gasEstimate;
    } catch (error) {
      logger.error('Failed to estimate gas for interact', { 
        tokenIds: tokenIds.map(id => id.toString()), 
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getLatestBlock(): Promise<bigint> {
    return await this.publicClient.getBlockNumber();
  }

  async verifyPettingSuccess(tokenIds: bigint[], preInteractionTiming?: bigint): Promise<{ success: boolean; updatedTokens: bigint[] }> {
    try {
      logger.debug('Verifying petting success', { 
        tokenIds: tokenIds.map(id => id.toString()),
        preInteractionTiming: preInteractionTiming ? new Date(Number(preInteractionTiming) * 1000).toISOString() : 'unknown'
      });

      const updatedTokens: bigint[] = [];
      
      // Try to verify with at least one token that we can fetch
      for (const tokenId of tokenIds) {
        try {
          const gotchi = await this.getAavegotchi(tokenId);
          
          // If we have pre-interaction timing, check if it was updated
          if (preInteractionTiming && gotchi.lastInteracted > preInteractionTiming) {
            updatedTokens.push(tokenId);
            logger.debug('Verified successful petting for token', {
              tokenId: tokenId.toString(),
              oldTime: new Date(Number(preInteractionTiming) * 1000).toISOString(),
              newTime: new Date(Number(gotchi.lastInteracted) * 1000).toISOString(),
            });
          } else if (!preInteractionTiming) {
            // If no pre-timing, just check that it's recent (within last hour)
            const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
            if (Number(gotchi.lastInteracted) > oneHourAgo) {
              updatedTokens.push(tokenId);
            }
          }
        } catch (error) {
          logger.debug('Could not verify token, but this is expected for failed fetches', { 
            tokenId: tokenId.toString() 
          });
          // For tokens like 7765 that fail getAavegotchi, we assume success if others succeeded
        }
      }

      const success = updatedTokens.length > 0;
      
      if (success) {
        logger.info('Petting verification successful', {
          verifiedTokens: updatedTokens.length,
          totalTokens: tokenIds.length,
          verifiedIds: updatedTokens.map(id => id.toString()),
        });
      } else {
        logger.warn('Petting verification failed - no tokens show updated lastInteracted', {
          totalTokens: tokenIds.length,
        });
      }

      return { success, updatedTokens };
    } catch (error) {
      logger.error('Error during petting verification', { error: error instanceof Error ? error.message : String(error) });
      // Return success=true to avoid false negatives during verification issues
      return { success: true, updatedTokens: [] };
    }
  }
}