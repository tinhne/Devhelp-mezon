import { Injectable, Logger } from '@nestjs/common';
import { MezonClient, Events } from 'mezon-sdk';

@Injectable()
export class MezonClientService {
  private readonly logger = new Logger(MezonClientService.name);
  private client: MezonClient;
  private token: string;

  constructor(token: string) {
    this.token = token;
    this.client = new MezonClient(token);

    // Đăng ký event handler NGAY SAU khi khởi tạo, TRƯỚC khi login
    this.client.on(Events.ChannelMessage, (message) => {
      this.logger.debug(`[Mezon] Received ChannelMessage: ${JSON.stringify(message)}`);
      // Nếu dùng EventEmitter2, emit tại đây
      // this.eventEmitter.emit(Events.ChannelMessage, message);
    });

    this.client.on(Events.MessageButtonClicked, (event) => {
      this.logger.debug(`[Mezon] Button clicked: ${JSON.stringify(event)}`);
      // Nếu dùng EventEmitter2, emit tại đây
      // this.eventEmitter.emit(Events.MessageButtonClicked, event);
    });

    // Đăng ký các event khác nếu cần (AddClanUser, ...)
  }

  async initializeClient() {
    try {
      this.logger.log('Attempting to login...');
      await this.client.login();
      this.logger.log('Authentication successful');

      // Log client state sau khi login (chỉ clan)
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
        userId: this.client.user?.id,
        clanCount
      };

      this.logger.log(`Client state after login: ${JSON.stringify(clientInfo)}`);
      return true;
    } catch (error) {
      this.logger.error(`Authentication error: ${error.message}`);
      throw error;
    }
  }

  getClient() {
    return this.client;
  }
}