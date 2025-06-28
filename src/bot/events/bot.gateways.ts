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
  private isEventInitialized = false;

  // Handler references
  private channelMessageHandler = this.handleChannelMessage.bind(this);
  private buttonClickedHandler = this.handleButtonClicked.bind(this);
  private errorHandler = this.handleError.bind(this);

  constructor(
    private readonly clientService: MezonClientService,
    private eventEmitter: EventEmitter2,
    private botStateService: BotStateService
  ) {
    this.client = this.clientService.getClient();
  }

  onModuleDestroy() {
    this.isEventInitialized = false;
  }

  async initEvent() {
    // Đảm bảo chỉ đăng ký event 1 lần duy nhất
    if (this.isEventInitialized) {
      this.logger.warn('Bot events already initialized, skipping duplicate registration.');
      return;
    }
    this.isEventInitialized = true;

    this.logger.log('Bot events initialized');

    // KHÔNG đăng ký lại các event đã đăng ký ở MezonClientService
    // Chỉ chuyển tiếp event nếu cần
    this.client.on(Events.ChannelMessage, this.channelMessageHandler);
    this.client.on(Events.MessageButtonClicked, this.buttonClickedHandler);
    this.client.on('error', this.errorHandler);

    this.botStateService.setActive();
    this.logger.log('Bot events initialized successfully');
  }

  private handleChannelMessage(message: any) {
    if (!message || !message.content) return;
    if (
      (message.sender_id && this.client.user && message.sender_id === this.client.user.id) ||
      (message.author_id && this.client.user && message.author_id === this.client.user.id)
    ) {
      this.logger.debug('Skipping message sent by bot itself');
      return;
    }

    const content = message?.content?.t || '';
    const shortContent = content.substring(0, 30) || '';
    const clanId = message.clan_id || message.server_id;
    this.logger.debug(`[RECEIVE] Message: "${shortContent}"... (clan_id: ${clanId}, channel: ${message.channel_id})`);

    const validPrefixes = ['*', '/', '\\'];
    const firstChar = (content.trim())[0];
    const hasValidPrefix = validPrefixes.includes(firstChar);

    // Luôn kiểm tra lệnh active trước, ngay cả khi bot không active
    if (content.startsWith('*activate') || content.startsWith('/activate') ||
      content.startsWith('\\activate') || content === 'activate' ||
      content.startsWith('activate ')) {
      this.logger.log(`[EMIT] Activation command received from clan_id: ${clanId}`);
      this.botStateService.setActive();
      this.sendActivationConfirmation(message);
      this.eventEmitter.emit(Events.ChannelMessage, message);
      return;
    }

    // Kiểm tra lệnh resetbot để buộc khởi động lại
    if (content.startsWith('*resetbot') || content.startsWith('/resetbot') ||
      content.startsWith('\\resetbot') || content === 'resetbot') {
      this.logger.log('Reset command received, but reset logic is disabled.');
      this.sendResetConfirmation(message);
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
      this.logger.log(`[EMIT] Deactivate command received from clan_id: ${clanId}`);
      this.eventEmitter.emit(Events.ChannelMessage, message);
      return;
    }

    if (content.startsWith('*botstatus') || content.startsWith('/botstatus') ||
      content.startsWith('\\botstatus') || content === 'botstatus' ||
      content.startsWith('botstatus ')) {
      this.logger.log(`[EMIT] Botstatus command received from clan_id: ${clanId}`);
      this.eventEmitter.emit(Events.ChannelMessage, message);
      return;
    }

    if (content.startsWith('*bot ') || content.startsWith('/bot ') || content.startsWith('\\bot ')) {
      this.logger.log(`[EMIT] Bot command received from clan_id: ${clanId}`);
      this.eventEmitter.emit(Events.ChannelMessage, message);
      return;
    }

    if (this.botStateService.isActive()) {
      this.logger.log(`[EMIT] Forwarding command to event emitter from clan_id: ${clanId}`);
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
  }

  private async sendChannelMessage(clanId: string, channelId: string, content: any) {
    try {
      let sent = false;
      if ((this.client as any).clans) {
        const clan = (this.client as any).clans.get(clanId);
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
    const clanId = message.clan_id || message.server_id;
    const channelId = message.channel_id;
    await this.sendChannelMessage(clanId, channelId, createReplyOptions(
      `✅ Bot đã nhận lệnh reset (không còn tự động reset/reconnect).`,
      createPreMarkdown(`✅ Bot đã nhận lệnh reset (không còn tự động reset/reconnect).`)
    ));
  }

  private async sendActivationConfirmation(message: any) {
    const clanId = message.clan_id || message.server_id;
    const channelId = message.channel_id;
    await this.sendChannelMessage(clanId, channelId, createReplyOptions(
      `✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!`,
      createPreMarkdown(`✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!`)
    ));
  }

  getBotStatus() {
    const clans = (this.client as any).clans;
    let clanCount = 0;
    if (clans) {
      if (typeof clans.size === 'number') {
        clanCount = clans.size;
      } else if (typeof clans.keys === 'function') {
        clanCount = Array.from(clans.keys()).length;
      } else if (Array.isArray(clans)) {
        clanCount = clans.length;
      } else if (typeof clans === 'object') {
        clanCount = Object.keys(clans).length;
      }
    }
    const clientInfo = {
      hasClans: !!clans,
      hasUser: !!this.client.user,
      clanCount,
    };

    return {
      ...this.botStateService.getStatusDetails(),
      connectionInfo: clientInfo,
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