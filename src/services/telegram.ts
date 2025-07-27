import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { TelegramNotification } from '../types/aavegotchi.js';

export class TelegramService {
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly baseUrl: string;

  constructor() {
    this.botToken = config.telegram.botToken;
    this.chatId = config.telegram.chatId;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendNotification(notification: TelegramNotification): Promise<void> {
    try {
      const message = this.formatMessage(notification);
      
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Telegram API error: ${response.status} - ${errorData}`);
      }

      logger.debug('Telegram notification sent successfully', {
        type: notification.type,
        messageLength: message.length,
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification', {
        error,
        notification: {
          type: notification.type,
          message: notification.message.substring(0, 100),
        },
      });
      // Don't throw - notification failures shouldn't stop the bot
    }
  }

  private formatMessage(notification: TelegramNotification): string {
    const timestamp = new Date().toISOString();
    const emoji = this.getEmoji(notification.type);
    
    let message = `${emoji} *Aavegotchi Pet Sitter*\n\n`;
    message += `*Time:* ${timestamp}\n`;
    message += `*Type:* ${notification.type.toUpperCase()}\n`;
    message += `*Message:* ${notification.message}\n`;
    
    if (notification.transactionHash) {
      const explorerUrl = `https://basescan.org/tx/${notification.transactionHash}`;
      message += `*Transaction:* [View on BaseScan](${explorerUrl})\n`;
    }
    
    return message;
  }

  private getEmoji(type: TelegramNotification['type']): string {
    const emojis = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
    };
    return emojis[type] || 'ℹ️';
  }

  async sendSuccess(message: string, transactionHash?: `0x${string}`): Promise<void> {
    const notification: TelegramNotification = {
      type: 'success',
      message,
    };
    
    if (transactionHash) {
      notification.transactionHash = transactionHash;
    }
    
    await this.sendNotification(notification);
  }

  async sendError(message: string, error?: Error): Promise<void> {
    const errorMessage = error 
      ? `${message}\n\nError: ${error.message}`
      : message;
      
    await this.sendNotification({
      type: 'error',
      message: errorMessage,
    });
  }

  async sendInfo(message: string): Promise<void> {
    await this.sendNotification({
      type: 'info',
      message,
    });
  }
}