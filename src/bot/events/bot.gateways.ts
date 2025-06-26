import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MezonClient, Events } from 'mezon-sdk';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { BotStateService } from '../services/bot-state.service';
import { safeReply, createReplyOptions, createPreMarkdown } from '../utils/reply-helpers';

@Injectable()
export class BotGateway {
  private readonly logger = new Logger(BotGateway.name);
  private client: MezonClient;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = Infinity;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private reconnectResetInterval: NodeJS.Timeout | null = null;
  private isResetting = false;
  private lastResetFailed = false;
  private isEventInitialized = false;

  // Handler references (for future-proofing, but MezonClient does not support .off)
  private channelMessageHandler = this.handleChannelMessage.bind(this);
  private buttonClickedHandler = this.handleButtonClicked.bind(this);
  private errorHandler = this.handleError.bind(this);

  constructor(
    private readonly clientService: MezonClientService,
    private eventEmitter: EventEmitter2,
    private botStateService: BotStateService
  ) {
    this.client = this.clientService.getClient();
    this.reconnectResetInterval = setInterval(() => {
      if (this.reconnectAttempts > 0) {
        this.logger.log('Reset reconnect counter from ' + this.reconnectAttempts + ' to 0');
        this.reconnectAttempts = 0;
      }
    }, 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.connectionCheckInterval) clearInterval(this.connectionCheckInterval);
    if (this.reconnectResetInterval) clearInterval(this.reconnectResetInterval);
    this.isEventInitialized = false;
  }

  async initEvent() {
    // MezonClient không hỗ trợ .off(), chỉ đăng ký 1 lần duy nhất
    if (this.isEventInitialized) {
      this.logger.warn('Bot events already initialized, skipping duplicate registration.');
      return;
    }
    this.isEventInitialized = true;

    this.logger.log('Bot events initialized');

    this.client.on('connected', () => {
      this.logger.log('Bot connected to Mezon API');
      this.reconnectAttempts = 0;
      this.botStateService.setActive();
    });

    this.client.on('disconnected', () => {
      this.logger.warn('Bot disconnected from Mezon API');
      this.botStateService.setReconnecting();
      this.handleDisconnect();
    });

    this.client.on(Events.ChannelMessage, this.channelMessageHandler);
    this.client.on(Events.MessageButtonClicked, this.buttonClickedHandler);
    this.client.on('error', this.errorHandler);

    this.startConnectionCheck();
    this.botStateService.setActive();
    this.logger.log('Bot events initialized successfully');
  }

  private handleChannelMessage(message: any) {
    if (!message || !message.content) return;
    if (this.isResetting) {
      this.logger.debug('Bot is resetting. Ignoring all messages.');
      return;
    }
    if (
      (message.sender_id && this.client.user && message.sender_id === this.client.user.id) ||
      (message.author_id && this.client.user && message.author_id === this.client.user.id)
    ) {
      this.logger.debug('Skipping message sent by bot itself');
      return;
    }

    const content = message?.content?.t || '';
    const shortContent = content.substring(0, 30) || '';
    this.logger.debug(`Received message: ${shortContent}... (clan_id: ${message.clan_id || message.server_id}, channel: ${message.channel_id})`);

    const validPrefixes = ['*', '/', '\\'];
    const firstChar = (content.trim())[0];
    const hasValidPrefix = validPrefixes.includes(firstChar);

    // Luôn kiểm tra lệnh active trước, ngay cả khi bot không active
    if (content.startsWith('*activate') || content.startsWith('/activate') ||
      content.startsWith('\\activate') || content === 'activate' ||
      content.startsWith('activate ')) {
      this.logger.log('Activation command received, activating bot');
      this.botStateService.setActive();
      this.sendActivationConfirmation(message);
      this.eventEmitter.emit(Events.ChannelMessage, message);
      return;
    }

    // Kiểm tra lệnh resetbot để buộc khởi động lại
    if (content.startsWith('*resetbot') || content.startsWith('/resetbot') ||
      content.startsWith('\\resetbot') || content === 'resetbot') {
      this.logger.log('Reset command received, resetting bot connection');
      this.resetBot().then(success => {
        if (success) {
          this.sendResetConfirmation(message);
          this.lastResetFailed = false;
        } else if (!this.lastResetFailed) {
          this.sendResetFailedNotification(message);
          this.lastResetFailed = true;
        }
      });
      return;
    }

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

    if (content.startsWith('*bot ') || content.startsWith('/bot ') || content.startsWith('\\bot ')) {
      this.eventEmitter.emit(Events.ChannelMessage, message);
      return;
    }

    if (this.botStateService.isActive()) {
      this.eventEmitter.emit(Events.ChannelMessage, message);
    }
  }

  private handleButtonClicked(message: any) {
    if (!message || !message.custom_id) {
      this.logger.debug('Received invalid button click');
      return;
    }
    this.logger.debug(`Button click: ${message.custom_id} (channel: ${message.channel_id})`);
    if (this.botStateService.isActive()) {
      this.eventEmitter.emit(Events.MessageButtonClicked, message);
    }
  }

  private handleError(error: any) {
    this.logger.error(`Error in Mezon client: ${error.message}`, error.stack);
    this.botStateService.setError(error.message);
    this.handleConnectionError(error);
  }

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
    }, 5 * 60 * 1000);
  }

  private async handleDisconnect() {
    if (this.reconnectTimeout) return;
    this.logger.warn('Bot disconnected, attempting to reconnect');
    this.botStateService.setReconnecting();
    this.reconnectTimeout = setTimeout(async () => {
      try {
        this.reconnectAttempts++;
        this.logger.log(`Reconnect attempt ${this.reconnectAttempts}`);
        this.client = await this.clientService.reconnectBot();
        this.logger.log('Reconnection successful');
        this.botStateService.setActive();
        // Không gọi lại initEvent() để tránh đăng ký lặp event handler
      } catch (error) {
        this.logger.error(`Reconnection failed: ${error.message}`);
        this.botStateService.setError(`Reconnection failed: ${error.message}`);
        const retryTime = Math.min(30000, 3000 * Math.pow(1.5, Math.min(10, this.reconnectAttempts)));
        this.logger.log(`Will retry in ${retryTime / 1000} seconds...`);
        this.reconnectTimeout = setTimeout(() => {
          this.handleDisconnect();
        }, retryTime);
      } finally {
        this.reconnectTimeout = null;
      }
    }, 3000);
  }

  private async handleConnectionError(error: Error) {
    this.logger.error(`Bot connection error: ${error.message}`);
    this.botStateService.setError(`Connection error: ${error.message}`);
    setTimeout(async () => {
      this.logger.log('Attempting to reconnect after error...');
      try {
        this.reconnectAttempts++;
        this.client = await this.clientService.reconnectBot();
        this.logger.log(`Reconnection after error successful (attempt ${this.reconnectAttempts})`);
        this.botStateService.setActive();
        // Không gọi lại initEvent() để tránh đăng ký lặp event handler
      } catch (e) {
        this.logger.error(`Reconnection failed (attempt ${this.reconnectAttempts}): ${e.message}`);
        this.botStateService.setError(`Reconnection failed: ${e.message}`);
        const retryDelay = Math.min(30000, 3000 * Math.pow(1.5, Math.min(10, this.reconnectAttempts)));
        this.logger.log(`Will try again in ${retryDelay / 1000} seconds (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.handleConnectionError(error), retryDelay);
      }
    }, 5000);
  }

  async resetBot() {
    if (this.isResetting) {
      this.logger.warn('Reset already in progress, skipping duplicate reset.');
      return false;
    }
    this.isResetting = true;
    this.logger.log('Manual bot reset initiated');
    this.reconnectAttempts = 0;
    this.botStateService.setReconnecting();

    try {
      this.client = await this.clientService.reconnectBot();
      // Không gọi lại initEvent() để tránh đăng ký lặp event handler
      this.botStateService.setActive();
      this.isResetting = false;

      if (process.env.NODE_ENV === 'production') {
        this.logger.warn('Restarting process after bot reset to clear all listeners');
        setTimeout(() => process.exit(0), 1000);
      }

      return true;
    } catch (error) {
      this.logger.error(`Manual bot reset failed: ${error.message}`);
      this.botStateService.setError(`Manual reset failed: ${error.message}`);
      this.isResetting = false;
      return false;
    }
  }

  private async sendChannelMessage(serverId: string, channelId: string, content: any) {
    try {
      let sent = false;
      if ((this.client as any).clans) {
        const clan = (this.client as any).clans.get(serverId);
        if (clan) {
          const channel = await clan.channels.fetch(channelId);
          if (channel) {
            if (typeof channel.sendMessage === 'function') {
              await channel.sendMessage(content);
              sent = true;
            } else if (typeof channel.createMessage === 'function') {
              await channel.createMessage(content);
              sent = true;
            }
          }
        }
      }
      if (!sent && typeof (this.client as any).sendMessage === 'function') {
        await (this.client as any).sendMessage(channelId, content);
      }
    } catch (error) {
      this.logger.error(`Failed to send channel message: ${error.message}`);
    }
  }

  private async sendResetConfirmation(message: any) {
    const serverId = message.server_id || message.clan_id;
    const channelId = message.channel_id;
    await this.sendChannelMessage(serverId, channelId, createReplyOptions(
      `✅ Bot đã được khởi động lại thành công!`,
      createPreMarkdown(`✅ Bot đã được khởi động lại thành công!`)
    ));
  }

  private async sendResetFailedNotification(message: any, errorMsg?: string) {
    const serverId = message.server_id || message.clan_id;
    const channelId = message.channel_id;
    await this.sendChannelMessage(serverId, channelId, createReplyOptions(
      `❌ Không thể khởi động lại bot. Đang thử lại tự động...${errorMsg ? ` (${errorMsg})` : ''}`,
      createPreMarkdown(`❌ Không thể khởi động lại bot. Đang thử lại tự động...${errorMsg ? ` (${errorMsg})` : ''}`)
    ));
  }

  private async sendActivationConfirmation(message: any) {
    const serverId = message.server_id || message.clan_id;
    const channelId = message.channel_id;
    await this.sendChannelMessage(serverId, channelId, createReplyOptions(
      `✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!`,
      createPreMarkdown(`✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!`)
    ));
  }

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
      maxReconnectAttempts: this.maxReconnectAttempts !== Infinity ? this.maxReconnectAttempts : "No limit",
      timestamp: new Date().toISOString()
    };
  }

  async activateBot(): Promise<boolean> {
    this.botStateService.setActive();
    this.logger.log('Bot activated by command');
    return true;
  }

  async deactivateBot(reason = ''): Promise<void> {
    this.botStateService.setInactive(reason);
    this.logger.log(`Bot deactivated by command${reason ? `: ${reason}` : ''}`);
  }
}