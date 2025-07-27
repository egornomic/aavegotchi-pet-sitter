import { AavegotchiContract } from './contract.js';
import { TelegramService } from './telegram.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { AavegotchiInfo, PetTarget, PetTargetWithTiming, PetResult, BotStatus } from '../types/aavegotchi.js';

export class PetSitterService {
  private contract: AavegotchiContract;
  private telegram: TelegramService;
  private targetAddress: `0x${string}`;
  private petIntervalMs: number;
  private isRunning: boolean = false;
  private stats: BotStatus;
  private monitoringInterval?: NodeJS.Timeout | undefined;
  private healthCheckInterval?: NodeJS.Timeout | undefined;

  constructor() {
    this.contract = new AavegotchiContract();
    this.telegram = new TelegramService();
    this.targetAddress = config.targetAddress;
    this.petIntervalMs = config.petIntervalHours * 60 * 60 * 1000;
    
    this.stats = {
      isRunning: false,
      totalPets: 0,
      errors: 0,
      currentTarget: this.targetAddress,
    };

    logger.info('PetSitterService initialized', {
      targetAddress: this.targetAddress,
      petIntervalHours: config.petIntervalHours,
      botAccount: this.contract.getAccountAddress(),
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Pet sitter is already running');
      return;
    }

    logger.info('Starting Aavegotchi Pet Sitter');
    
    try {
      // Check initial connection
      const isConnected = await this.contract.checkConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to Base network');
      }

      // Validate target address has Aavegotchis
      const aavegotchis = await this.contract.getAllAavegotchisOfOwner(this.targetAddress);
      if (aavegotchis.length === 0) {
        throw new Error(`No claimed Aavegotchis found for address ${this.targetAddress}`);
      }

      this.isRunning = true;
      this.stats.isRunning = true;

      await this.telegram.sendInfo(
        `🚀 Pet Sitter started successfully!\n\n` +
        `Target: ${this.targetAddress}\n` +
        `Aavegotchis: ${aavegotchis.length}\n` +
        `Interval: ${config.petIntervalHours} hours\n` +
        `Bot Account: ${this.contract.getAccountAddress()}`
      );

      // Start monitoring loop
      this.startMonitoringLoop();
      
      // Start health check
      this.startHealthCheck();

      logger.info('Pet sitter started successfully', {
        aavegotchiCount: aavegotchis.length,
        interval: `${config.petIntervalHours}h`,
      });

    } catch (error) {
      this.isRunning = false;
      this.stats.isRunning = false;
      logger.error('Failed to start pet sitter', { error });
      await this.telegram.sendError('Failed to start pet sitter', error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Pet sitter is not running');
      return;
    }

    logger.info('Stopping Aavegotchi Pet Sitter');
    
    this.isRunning = false;
    this.stats.isRunning = false;

    if (this.monitoringInterval !== undefined) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.healthCheckInterval !== undefined) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    await this.telegram.sendInfo('🛑 Pet Sitter stopped');
    logger.info('Pet sitter stopped successfully');
  }

  private startMonitoringLoop(): void {
    const checkInterval = 60 * 1000; // Check every minute
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAndPetIfNeeded();
      } catch (error) {
        logger.error('Error in monitoring loop', { error });
        this.stats.errors++;
      }
    }, checkInterval);

    // Run initial check immediately
    setTimeout(() => this.checkAndPetIfNeeded(), 1000);
  }

  private startHealthCheck(): void {
    const healthCheckInterval = config.healthCheckIntervalMinutes * 60 * 1000;
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isConnected = await this.contract.checkConnection();
        if (!isConnected) {
          throw new Error('Lost connection to Base network');
        }
        
        logger.debug('Health check passed');
      } catch (error) {
        logger.error('Health check failed', { error });
        await this.telegram.sendError('Health check failed - connection issues detected', error as Error);
        this.stats.errors++;
      }
    }, healthCheckInterval);
  }

  private async checkAndPetIfNeeded(): Promise<void> {
    try {
      const petTargetWithTiming = await this.fetchPetTargetWithTiming();
      
      if (petTargetWithTiming.allTokenIds.length === 0) {
        logger.warn('No Aavegotchis available for petting');
        return;
      }

      const nextPetTime = this.calculateNextPetTimeWithTiming(petTargetWithTiming);
      const now = Date.now();

      if (nextPetTime <= now) {
        logger.info('Pet time reached, initiating failure-safe pet sequence', {
          totalTokenIds: petTargetWithTiming.allTokenIds.length,
          successfulFetches: petTargetWithTiming.successfulAavegotchis.length,
          hasSharedTiming: !!petTargetWithTiming.sharedLastInteracted,
        });
        await this.petAllTokenIds(petTargetWithTiming.allTokenIds, petTargetWithTiming.sharedLastInteracted);
      } else {
        const minutesLeft = Math.ceil((nextPetTime - now) / (60 * 1000));
        
        // Log less frequently to avoid spam
        if (minutesLeft % 30 === 0) {
          logger.info(`Next pet in ${minutesLeft} minutes`, {
            nextPetTime: new Date(nextPetTime).toISOString(),
            totalTokenIds: petTargetWithTiming.allTokenIds.length,
            successfulFetches: petTargetWithTiming.successfulAavegotchis.length,
          });
        }
      }

      this.stats.nextPetTime = nextPetTime;
    } catch (error) {
      logger.error('Error checking pet status', { error });
      this.stats.errors++;
      
      // Send error notification but don't stop the service
      await this.telegram.sendError(
        'Error occurred while checking pet status. Will retry on next cycle.',
        error as Error
      );
    }
  }

  private async fetchPetTargetWithTiming(): Promise<PetTargetWithTiming> {
    const petTargetWithTiming = await this.contract.getAllAavegotchisOfOwnerWithTiming(this.targetAddress);
    return petTargetWithTiming;
  }

  private async fetchPetTarget(): Promise<PetTarget> {
    const aavegotchis = await this.contract.getAllAavegotchisOfOwner(this.targetAddress);
    
    return {
      address: this.targetAddress,
      aavegotchis,
    };
  }

  private calculateNextPetTimeWithTiming(petTarget: PetTargetWithTiming): number {
    if (petTarget.allTokenIds.length === 0) {
      return Date.now() + this.petIntervalMs;
    }

    // Use shared timing if available from any successful fetch
    if (petTarget.sharedLastInteracted) {
      const lastInteracted = Number(petTarget.sharedLastInteracted);
      logger.debug('Using shared lastInteracted for timing calculation', {
        lastInteracted: new Date(lastInteracted * 1000).toISOString(),
        petIntervalHours: this.petIntervalMs / (60 * 60 * 1000),
      });
      return (lastInteracted * 1000) + this.petIntervalMs;
    }

    // Fallback: Use current time + interval if no timing data available
    logger.warn('No shared timing available, using fallback timing');
    return Date.now() + this.petIntervalMs;
  }

  private calculateNextPetTime(aavegotchis: AavegotchiInfo[]): number {
    if (aavegotchis.length === 0) {
      return Date.now() + this.petIntervalMs;
    }

    // Find the most recently interacted Aavegotchi
    const lastInteracted = Math.max(
      ...aavegotchis.map(g => Number(g.lastInteracted))
    );

    // Convert from seconds to milliseconds and add pet interval
    return (lastInteracted * 1000) + this.petIntervalMs;
  }

  private async petAllTokenIds(tokenIds: bigint[], sharedLastInteracted?: bigint): Promise<PetResult> {
    try {
      logger.info('Starting failure-safe pet transaction', {
        tokenIds: tokenIds.map(id => id.toString()),
        count: tokenIds.length,
      });

      const transactionHash = await this.contract.interact(tokenIds);
      
      // Wait a moment for the transaction to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Send control Interact transaction after 10 seconds
      setTimeout(async () => {
        try {
          logger.info('Sending control Interact transaction', {
            tokenIds: tokenIds.map(id => id.toString()),
            count: tokenIds.length,
          });
          
          const controlTransactionHash = await this.contract.interact(tokenIds);
          
          logger.info('Control transaction completed', {
            controlTransactionHash,
            originalTransactionHash: transactionHash,
            tokenIds: tokenIds.map(id => id.toString()),
          });
          
          await this.telegram.sendInfo(
            `🔄 Control transaction sent for ${tokenIds.length} Aavegotchi${tokenIds.length > 1 ? 's' : ''}!\n\n` +
            `Control TX: ${controlTransactionHash}\n` +
            `Original TX: ${transactionHash}`
          );
        } catch (controlError) {
          logger.error('Control transaction failed', {
            error: controlError instanceof Error ? controlError.message : String(controlError),
            originalTransactionHash: transactionHash,
            tokenIds: tokenIds.map(id => id.toString()),
          });
          
          await this.telegram.sendError(
            `Control transaction failed for ${tokenIds.length} Aavegotchi${tokenIds.length > 1 ? 's' : ''}`,
            controlError as Error
          );
        }
      }, 10000); // 10 seconds delay
      
      // Verify that the petting actually worked
      const verification = await this.contract.verifyPettingSuccess(tokenIds, sharedLastInteracted);
      
      if (verification.success) {
        this.stats.totalPets++;
        this.stats.lastPetTime = Date.now();

        const successMessage = 
          `🎉 Successfully petted ${tokenIds.length} Aavegotchi${tokenIds.length > 1 ? 's' : ''}!\n\n` +
          `Transaction: ${transactionHash}\n` +
          `Verified: ${verification.updatedTokens.length} tokens\n` +
          `Total pets: ${this.stats.totalPets}\n` +
          `Control transaction will be sent in 10 seconds`;

        await this.telegram.sendSuccess(successMessage, transactionHash);
        
        logger.info('Pet transaction completed and verified successfully', {
          transactionHash,
          petCount: tokenIds.length,
          verifiedCount: verification.updatedTokens.length,
          totalPets: this.stats.totalPets,
        });

        return {
          success: true,
          transactionHash,
          petCount: tokenIds.length,
        };
      } else {
        logger.warn('Pet transaction completed but verification failed - may have hit cooldown', {
          transactionHash,
          tokenIds: tokenIds.map(id => id.toString()),
        });
        
        // Don't count as error, but log for investigation
        return {
          success: false,
          error: 'Petting verification failed - likely hit cooldown period',
          transactionHash,
          petCount: 0,
        };
      }
    } catch (error) {
      this.stats.errors++;
      const errorMessage = `Failed to pet ${tokenIds.length} Aavegotchi${tokenIds.length > 1 ? 's' : ''}`;
      
      logger.error('Pet transaction failed', {
        error: error instanceof Error ? error.message : String(error),
        tokenIds: tokenIds.map(id => id.toString()),
      });
      
      await this.telegram.sendError(errorMessage, error as Error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        petCount: 0,
      };
    }
  }

  private async petAavegotchis(aavegotchis: AavegotchiInfo[]): Promise<PetResult> {
    const tokenIds = aavegotchis.map(g => g.tokenId);
    
    try {
      logger.info('Starting pet transaction', {
        tokenIds: tokenIds.map(id => id.toString()),
        count: tokenIds.length,
      });

      const transactionHash = await this.contract.interact(tokenIds);
      
      this.stats.totalPets++;
      this.stats.lastPetTime = Date.now();

      const successMessage = 
        `🎉 Successfully petted ${tokenIds.length} Aavegotchi${tokenIds.length > 1 ? 's' : ''}!\n\n` +
        `Token IDs: ${tokenIds.map(id => id.toString()).join(', ')}\n` +
        `Total pets: ${this.stats.totalPets}`;

      await this.telegram.sendSuccess(successMessage, transactionHash);

      return {
        success: true,
        transactionHash,
        petCount: tokenIds.length,
      };

    } catch (error) {
      this.stats.errors++;
      
      const errorMessage = `Failed to pet ${tokenIds.length} Aavegotchi${tokenIds.length > 1 ? 's' : ''}`;
      logger.error(errorMessage, { 
        tokenIds: tokenIds.map(id => id.toString()),
        error 
      });

      await this.telegram.sendError(errorMessage, error as Error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        petCount: 0,
      };
    }
  }

  getStatus(): BotStatus {
    return { ...this.stats };
  }

  async getTargetInfo(): Promise<{ address: `0x${string}`; aavegotchis: AavegotchiInfo[]; totalTokenIds: number }> {
    const petTargetWithTiming = await this.contract.getAllAavegotchisOfOwnerWithTiming(this.targetAddress);
    return {
      address: this.targetAddress,
      aavegotchis: petTargetWithTiming.successfulAavegotchis,
      totalTokenIds: petTargetWithTiming.allTokenIds.length,
    };
  }
}