import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MezonClient, Events } from 'mezon-sdk';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { BotStateService } from '../services/bot-state.service';

@Injectable()
export class BotGateway {
  private readonly logger = new Logger(BotGateway.name);
  private client: MezonClient;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly clientService: MezonClientService,
    private eventEmitter: EventEmitter2,
    private botStateService: BotStateService
  ) {
    this.client = this.clientService.getClient();
  }

  async initEvent() {
    // Log client state when initializing
    const clientInfo = {
      hasServers: !!this.client.servers,
      hasClans: !!(this.client as any).clans,
      hasUser: !!this.client.user,
      clanCount: (this.client as any).clans?.size,
      serverCount: this.client.servers?.size
    };

    this.logger.log(`Bot client initialized: ${JSON.stringify(clientInfo)}`);

    // Add events for connected and disconnected
    this.client.on('connected', () => {
      this.logger.log('Bot connected to Mezon API');
      this.reconnectAttempts = 0; // Reset reconnect attempt counter
      this.botStateService.setActive();
    });

    this.client.on('disconnected', () => {
      this.logger.warn('Bot disconnected from Mezon API');
      this.botStateService.setReconnecting();
      // Auto reconnect after disconnection
      this.handleDisconnect();
    });

    this.client.on(Events.ChannelMessage, (message) => {
  const content = message?.content?.t || '';
  const shortContent = content.substring(0, 30) || '';
  this.logger.debug(`Received message: ${shortContent}... (clan_id: ${message.clan_id || message.server_id}, channel: ${message.channel_id})`);

  // Kiểm tra xem tin nhắn có prefix hợp lệ không
  const validPrefixes = ['*', '/', '\\'];
  const firstChar = (content.trim())[0];
  const hasValidPrefix = validPrefixes.includes(firstChar);

  // Quan trọng: Luôn kiểm tra lệnh active trước, ngay cả khi bot không active
  if (content.startsWith('*activate') || content.startsWith('/activate') || 
      content.startsWith('\\activate') || content === 'activate' || 
      content.startsWith('activate ')) {
    this.logger.log('Activation command received, activating bot');
    this.botStateService.setActive();
    
    // Get message channel to send confirmation
    this.sendActivationConfirmation(message);
    
    // Now process the message
    this.eventEmitter.emit(Events.ChannelMessage, message);
    return;
  }

  // Nếu không có prefix hợp lệ và bot không đang ở chế độ active, bỏ qua tin nhắn
  if (!hasValidPrefix) {
    this.logger.debug(`Skipping message without valid prefix: ${shortContent}`);
    return;
  }

  // Luôn xử lý các lệnh quản lý trạng thái của bot
  if (content.startsWith('*deactivate') || content.startsWith('/deactivate') || 
      content.startsWith('\\deactivate') || content === 'deactivate' || 
      content.startsWith('deactivate ')) {
    this.eventEmitter.emit(Events.ChannelMessage, message);
    return;
  }

  if (content.startsWith('*botstatus') || content.startsWith('/botstatus') || 
      content.startsWith('\\botstatus') || content === 'botstatus' || 
      content.startsWith('botstatus ')) {
    this.eventEmitter.emit(Events.ChannelMessage, message);
    return;
  }

  // Chỉ xử lý các lệnh thông thường khi bot active
  if (this.botStateService.isActive()) {
    this.eventEmitter.emit(Events.ChannelMessage, message);
  }
});

    // Process button clicks
    this.client.on(Events.MessageButtonClicked, (message) => {
      this.logger.debug(`Button click: ${message.custom_id} (channel: ${message.channel_id})`);

      // Only process button clicks if bot is active
      if (this.botStateService.isActive()) {
        this.eventEmitter.emit(Events.MessageButtonClicked, message);
      }
    });

    // Handle connection errors
    this.client.on('error', (error) => {
      this.logger.error(`Error in Mezon client: ${error.message}`, error.stack);
      this.botStateService.setError(error.message);
      this.handleConnectionError(error);
    });

    // Set up periodic connection check (5 minutes)
    this.startConnectionCheck();

    // Set initial bot state to active
    this.botStateService.setActive();

    this.logger.log('Bot events initialized successfully');
  }

  // Start periodic connection check
  private startConnectionCheck() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    this.connectionCheckInterval = setInterval(async () => {
      try {
        const isConnected = await this.clientService.checkConnection();
        if (!isConnected) {
          this.logger.warn('Connection check failed, attempting to reconnect');
          this.botStateService.setReconnecting();
          await this.handleConnectionError(new Error('Connection check failed'));
        }
      } catch (error) {
        this.logger.error(`Error during connection check: ${error.message}`);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Handle disconnection
  private async handleDisconnect() {
    // Skip if already handling reconnection
    if (this.reconnectTimeout) return;

    this.logger.warn('Bot disconnected, attempting to reconnect');
    this.botStateService.setReconnecting();

    // Try reconnecting after 3 seconds
    this.reconnectTimeout = setTimeout(async () => {
      try {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.logger.log(`Reconnect attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts}`);

          this.client = await this.clientService.reconnectBot();
          this.logger.log('Reconnection successful');
          this.botStateService.setActive();

          // Reinitialize events after reconnect
          await this.initEvent();
        } else {
          this.logger.error(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached. Manual intervention required.`);
          this.botStateService.setError(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached`);
        }
      } catch (error) {
        this.logger.error(`Reconnection failed: ${error.message}`);
        this.botStateService.setError(`Reconnection failed: ${error.message}`);

        // Try again after longer period if still failing
        const retryTime = Math.min(30000, 3000 * Math.pow(2, this.reconnectAttempts));
        this.logger.log(`Will retry in ${retryTime / 1000} seconds...`);

        this.reconnectTimeout = setTimeout(() => {
          this.handleDisconnect();
        }, retryTime);
      } finally {
        this.reconnectTimeout = null;
      }
    }, 3000);
  }

  // Handle connection error
  private async handleConnectionError(error: Error) {
    this.logger.error(`Bot connection error: ${error.message}`);
    this.botStateService.setError(`Connection error: ${error.message}`);

    // Try reconnecting after 5 seconds
    setTimeout(async () => {
      this.logger.log('Attempting to reconnect after error...');
      try {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.client = await this.clientService.reconnectBot();
          this.logger.log('Reconnection after error successful');
          this.botStateService.setActive();
        } else {
          this.logger.error(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached after error. Manual intervention required.`);
          this.botStateService.setError(`Maximum reconnection attempts reached after error`);
        }
      } catch (e) {
        this.logger.error(`Reconnection after error failed: ${e.message}`);
        this.botStateService.setError(`Reconnection failed: ${e.message}`);
      }
    }, 5000);
  }

  // Manually reset bot
  async resetBot() {
    this.logger.log('Manual bot reset initiated');
    this.reconnectAttempts = 0;
    this.botStateService.setReconnecting();

    try {
      this.client = await this.clientService.reconnectBot();
      await this.initEvent();
      this.botStateService.setActive();
      return true;
    } catch (error) {
      this.logger.error(`Manual bot reset failed: ${error.message}`);
      this.botStateService.setError(`Manual reset failed: ${error.message}`);
      return false;
    }
  }

  // Manually deactivate bot
  async deactivateBot(reason: string) {
    this.logger.log(`Manual bot deactivation: ${reason}`);
    this.botStateService.setInactive(reason);
    // Stop connection check to avoid auto-reconnect
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    return true;
  }

  // Manually activate bot
  async activateBot() {
    this.logger.log('Manual bot activation');
    try {
      // Check connection first
      const isConnected = await this.clientService.checkConnection();
      if (!isConnected) {
        this.logger.log('Connection lost, reconnecting before activation');
        this.client = await this.clientService.reconnectBot();
      }

      this.botStateService.setActive();
      this.startConnectionCheck();
      return true;
    } catch (error) {
      this.logger.error(`Manual bot activation failed: ${error.message}`);
      this.botStateService.setError(`Activation failed: ${error.message}`);
      return false;
    }
  }

  // Send activation confirmation
  private async sendActivationConfirmation(message: any) {
    try {
      const serverId = message.server_id || (message as any).clan_id;
      const channelId = message.channel_id;

      if ((this.client as any).clans) {
        const clan = (this.client as any).clans.get(serverId);
        if (clan) {
          const channel = await clan.channels.fetch(channelId);
          if (channel) {
            await channel.messages.create({
              t: `✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!`,
              mk: [{ type: 'PRE', s: 0, e: 38 }],
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send activation confirmation: ${error.message}`);
    }
  }

  // Get current bot status
  getBotStatus() {
    const clientInfo = {
      hasServers: !!this.client.servers,
      hasClans: !!(this.client as any).clans,
      hasUser: !!this.client.user,
      clanCount: (this.client as any).clans?.size,
      serverCount: this.client.servers?.size
    };

    return {
      ...this.botStateService.getStatusDetails(),
      connectionInfo: clientInfo,
      lastReconnectAttempt: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      timestamp: new Date().toISOString()
    };
  }
}