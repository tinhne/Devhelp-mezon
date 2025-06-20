import { Command } from '../../base/commandRegister.decorator';
import { CommandMessage } from '../../base/command.abstract';
import { Injectable } from '@nestjs/common';
import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';

@Command('ping')
@Injectable()
export class PingCommand extends CommandMessage {
  constructor(clientService: MezonClientService) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage): Promise<any> {
    this.logger.log(`Executing ping command from ${message.sender_id}`);
    
    try {
      // Log client info
      let clientInfo = {
        hasServers: !!this.client.servers,
        hasClans: !!(this.client as any).clans,
        hasUser: !!this.client.user,
        clanCount: (this.client as any).clans?.size,
        serverCount: this.client.servers?.size
      };
      
      this.logger.debug(`Client info: ${JSON.stringify(clientInfo)}`);
      
      const messageChannel = await this.getChannelMessage(message);
      if (!messageChannel) {
        this.logger.error('Could not get message channel');
        return null;
      }
      
      // Thêm fallback khi không có access đến server collections
      const serverCount = this.client.servers?.size || 
                         (this.client as any).clans?.size || 
                         'không xác định số lượng';
      
      this.logger.log('Sending ping response');
      return await messageChannel.reply({
        t: `🏓 Pong! Bot đang hoạt động.\nKết nối với ${serverCount} server.`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `🏓 Pong! Bot đang hoạt động.\nKết nối với ${serverCount} server.`.length,
          },
        ],
      });
    } catch (error) {
      this.logger.error(`Error in ping command: ${error.message}`, error.stack);
      return null;
    }
  }
}