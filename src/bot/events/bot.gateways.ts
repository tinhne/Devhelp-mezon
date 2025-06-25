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
  private maxReconnectAttempts = Infinity; // Không giới hạn số lần kết nối lại
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private reconnectResetInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly clientService: MezonClientService,
    private eventEmitter: EventEmitter2,
    private botStateService: BotStateService
  ) {
    this.client = this.clientService.getClient();
    // Thêm interval để reset bộ đếm kết nối lại mỗi giờ
    this.reconnectResetInterval = setInterval(() => {
      if (this.reconnectAttempts > 0) {
        this.logger.log('Reset reconnect counter from ' + this.reconnectAttempts + ' to 0');
        this.reconnectAttempts = 0;
      }
    }, 60 * 60 * 1000); // 1 giờ
  }

  onModuleDestroy() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.connectionCheckInterval) clearInterval(this.connectionCheckInterval);
    if (this.reconnectResetInterval) clearInterval(this.reconnectResetInterval);
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
      // Bảo vệ từ null hoặc undefined
      if (!message || !message.content) {
        this.logger.debug('Received empty or invalid message');
        return;
      }

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

      // Kiểm tra lệnh resetbot để buộc khởi động lại
      if (content.startsWith('*resetbot') || content.startsWith('/resetbot') ||
        content.startsWith('\\resetbot') || content === 'resetbot') {
        this.logger.log('Reset command received, resetting bot connection');
        this.resetBot().then(success => {
          if (success) {
            this.sendResetConfirmation(message);
          } else {
            this.sendResetFailedNotification(message);
          }
        });
        return;
      }

      // Nếu không có prefix hợp lệ, bỏ qua tin nhắn
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

      // Xử lý các lệnh đặc biệt liên quan đến quản lý bot
      if (content.startsWith('*bot ') || content.startsWith('/bot ') ||
        content.startsWith('\\bot ')) {
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
      if (!message || !message.custom_id) {
        this.logger.debug('Received invalid button click');
        return;
      }

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
        // Bỏ kiểm tra giới hạn reconnect, luôn thử kết nối lại
        this.reconnectAttempts++;
        this.logger.log(`Reconnect attempt ${this.reconnectAttempts}`);

        this.client = await this.clientService.reconnectBot();
        this.logger.log('Reconnection successful');
        this.botStateService.setActive();

        // Reinitialize events after reconnect
        await this.initEvent();
      } catch (error) {
        this.logger.error(`Reconnection failed: ${error.message}`);
        this.botStateService.setError(`Reconnection failed: ${error.message}`);

        // Try again after longer period if still failing
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

  // Handle connection error
  private async handleConnectionError(error: Error) {
    this.logger.error(`Bot connection error: ${error.message}`);
    this.botStateService.setError(`Connection error: ${error.message}`);

    // Luôn luôn thử kết nối lại, bất kể số lần đã thử
    setTimeout(async () => {
      this.logger.log('Attempting to reconnect after error...');
      try {
        this.reconnectAttempts++;
        this.client = await this.clientService.reconnectBot();
        this.logger.log(`Reconnection after error successful (attempt ${this.reconnectAttempts})`);
        this.botStateService.setActive();

        // Khởi tạo lại events
        await this.initEvent();
      } catch (e) {
        this.logger.error(`Reconnection failed (attempt ${this.reconnectAttempts}): ${e.message}`);
        this.botStateService.setError(`Reconnection failed: ${e.message}`);

        // Nếu thất bại, thử lại với thời gian chờ tăng dần
        const retryDelay = Math.min(30000, 3000 * Math.pow(1.5, Math.min(10, this.reconnectAttempts)));
        this.logger.log(`Will try again in ${retryDelay / 1000} seconds (attempt ${this.reconnectAttempts})`);

        // Thử lại sau khoảng thời gian delay
        setTimeout(() => this.handleConnectionError(error), retryDelay);
      }
    }, 5000);
  }

  // Manually reset bot
  // ...existing code...
  async resetBot() {
    this.logger.log('Manual bot reset initiated');
    this.reconnectAttempts = 0; // Reset counter for fresh start
    this.botStateService.setReconnecting();

    try {
      this.client = await this.clientService.reconnectBot();
      // Cập nhật lại client cho các event handler
      await this.initEvent();
      this.botStateService.setActive();
      return true;
    } catch (error) {
      this.logger.error(`Manual bot reset failed: ${error.message}`);
      this.botStateService.setError(`Manual reset failed: ${error.message}`);
      setTimeout(() => this.resetBot(), 10000);
      return false;
    }
  }

  // Send reset confirmation
  private async sendResetConfirmation(message: any) {
    try {
      const serverId = message.server_id || message.clan_id;
      const channelId = message.channel_id;
      let sent = false;

      if ((this.client as any).clans) {
        const clan = (this.client as any).clans.get(serverId);
        if (clan) {
          const channel = await clan.channels.fetch(channelId);
          if (channel) {
            if (typeof channel.sendMessage === 'function') {
              await channel.sendMessage({
                t: `✅ Bot đã được khởi động lại thành công!`,
                mk: [{ type: 'PRE', s: 0, e: 38 }],
              });
              sent = true;
            } else if (typeof channel.createMessage === 'function') {
              await channel.createMessage({
                t: `✅ Bot đã được khởi động lại thành công!`,
                mk: [{ type: 'PRE', s: 0, e: 38 }],
              });
              sent = true;
            }
          }
        }
      }
      if (!sent && typeof (this.client as any).sendMessage === 'function') {
        await (this.client as any).sendMessage(channelId, {
          t: `✅ Bot đã được khởi động lại thành công!`,
          mk: [{ type: 'PRE', s: 0, e: 38 }],
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send reset confirmation: ${error.message}`);
    }
  }


  // Send reset failed notification
  private async sendResetFailedNotification(message: any) {
    try {
      const serverId = message.server_id || message.clan_id;
      const channelId = message.channel_id;
      let sent = false;

      if ((this.client as any).clans) {
        const clan = (this.client as any).clans.get(serverId);
        if (clan) {
          const channel = await clan.channels.fetch(channelId);
          if (channel) {
            if (typeof channel.sendMessage === 'function') {
              await channel.sendMessage({
                t: `❌ Không thể khởi động lại bot. Đang thử lại tự động...`,
                mk: [{ type: 'PRE', s: 0, e: 46 }],
              });
              sent = true;
            } else if (typeof channel.createMessage === 'function') {
              await channel.createMessage({
                t: `❌ Không thể khởi động lại bot. Đang thử lại tự động...`,
                mk: [{ type: 'PRE', s: 0, e: 46 }],
              });
              sent = true;
            }
          }
        }
      }
      if (!sent && typeof (this.client as any).sendMessage === 'function') {
        await (this.client as any).sendMessage(channelId, {
          t: `❌ Không thể khởi động lại bot. Đang thử lại tự động...`,
          mk: [{ type: 'PRE', s: 0, e: 46 }],
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send reset failure notification: ${error.message}`);
    }
  }

  // Send activation confirmation
  private async sendActivationConfirmation(message: any) {
    try {
      const serverId = message.server_id || message.clan_id;
      const channelId = message.channel_id;
      let sent = false;

      if ((this.client as any).clans) {
        const clan = (this.client as any).clans.get(serverId);
        if (clan) {
          const channel = await clan.channels.fetch(channelId);
          if (channel) {
            if (typeof channel.sendMessage === 'function') {
              await channel.sendMessage({
                t: `✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!`,
                mk: [{ type: 'PRE', s: 0, e: 38 }],
              });
              sent = true;
            } else if (typeof channel.createMessage === 'function') {
              await channel.createMessage({
                t: `✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!`,
                mk: [{ type: 'PRE', s: 0, e: 38 }],
              });
              sent = true;
            }
          }
        }
      }
      // Nếu không gửi được qua clan/channel, thử gửi trực tiếp qua client
      if (!sent && typeof (this.client as any).sendMessage === 'function') {
        await (this.client as any).sendMessage(channelId, {
          t: `✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!`,
          mk: [{ type: 'PRE', s: 0, e: 38 }],
        });
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