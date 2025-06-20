import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { BotStateService } from '../../services/bot-state.service';
import { BotGateway } from '../../events/bot.gateways';
import { Injectable } from '@nestjs/common';
import { getRandomColor } from '../../utils/helps';
import { Logger } from '@nestjs/common';
@Command('bot')
@Injectable()
export class BotCommand extends CommandMessage {
  // Thay đổi private thành protected để phù hợp với lớp cha
//   protected readonly logger = this.logger;

  constructor(
    clientService: MezonClientService,
    private botStateService: BotStateService,
    private botGateway: BotGateway
  ) {
    super(clientService);
  }

  // Phần code còn lại giữ nguyên
  async execute(args: string[], message: ChannelMessage): Promise<any> {
    const messageChannel = await this.getChannelMessage(message);
    if (!messageChannel) return;

    // Process subcommands: status, deactivate, activate, reset
    if (args.length === 0) {
      return this.showHelp(messageChannel);
    }

    const subCommand = args[0].toLowerCase();

    try {
      switch (subCommand) {
        case 'status':
          return this.handleStatus(messageChannel);
        case 'deactivate':
        case 'off':
          return this.handleDeactivate(args.slice(1), messageChannel);
        case 'activate':
        case 'on':
          return this.handleActivate(messageChannel);
        case 'reset':
          return this.handleReset(messageChannel);
        default:
          return this.showHelp(messageChannel);
      }
    } catch (error) {
      this.logger.error(`Error in BotCommand: ${error.message}`, error.stack);
      return messageChannel.reply({
        t: `❌ Lỗi: ${error.message}`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `❌ Lỗi: ${error.message}`.length,
          },
        ],
      });
    }
  }
  private async showHelp(messageChannel: any): Promise<any> {
    return messageChannel.reply({
      t: '🤖 Hướng dẫn sử dụng lệnh bot:',
      embed: [
        {
          color: getRandomColor(),
          title: 'DevHelper - Bot Control',
          description: 'Các lệnh quản lý bot:',
          fields: [
            {
              name: '/bot status',
              value: 'Hiển thị trạng thái hiện tại của bot\n' +
                    'Ví dụ: `/bot status`',
            },
            {
              name: '/bot deactivate (hoặc /bot off)',
              value: 'Tắt bot tạm thời\n' +
                    'Ví dụ: `/bot off "Bảo trì"`',
            },
            {
              name: '/bot activate (hoặc /bot on)',
              value: 'Kích hoạt lại bot sau khi tắt\n' +
                    'Ví dụ: `/bot on`',
            },
            {
              name: '/bot reset',
              value: 'Khởi động lại bot (reconnect)\n' +
                    'Ví dụ: `/bot reset`',
            },
          ],
          footer: {
            text: 'DevHelper Bot',
          },
        },
      ],
    });
  }
  
  private async handleStatus(messageChannel: any): Promise<any> {
    const status = this.botGateway.getBotStatus();
    const stateEmoji = status.state === 'active' ? '🟢' : 
                      status.state === 'inactive' ? '🔴' : 
                      status.state === 'reconnecting' ? '🟡' : '🟠';
    
    const stateSince = new Date(status.since).toLocaleString();
    
    return messageChannel.reply({
      embed: [
        {
          color: getRandomColor(),
          title: `${stateEmoji} DevHelper Bot Status`,
          fields: [
            {
              name: 'Trạng thái',
              value: status.state,
              inline: true,
            },
            {
              name: 'Từ',
              value: stateSince,
              inline: true,
            },
            {
              name: 'Số server kết nối',
              value: String(status.connectionInfo.clanCount || status.connectionInfo.serverCount || 0),
              inline: true,
            },
            ...(status.state !== 'active' ? [
              {
                name: 'Lý do không hoạt động',
                value: status.inactiveReason || 'Không rõ',
              }
            ] : []),
            {
              name: 'Lần thử kết nối gần nhất',
              value: `${status.lastReconnectAttempt}/${status.maxReconnectAttempts}`,
              inline: true,
            },
            {
              name: 'Command prefix',
              value: status.commandPrefix,
              inline: true,
            }
          ],
          footer: {
            text: `DevHelper Bot - Last updated: ${new Date().toLocaleString()}`,
          },
        },
      ],
    });
  }
  
  private async handleDeactivate(args: string[], messageChannel: any): Promise<any> {
    // Check if already inactive
    if (!this.botStateService.isActive()) {
      return messageChannel.reply({
        t: '❌ Bot đã ở trạng thái không hoạt động.',
        mk: [{ type: EMarkdownType.PRE, s: 0, e: 38 }],
      });
    }
    
    // Extract reason if provided
    const reason = args.join(' ') || 'Được tắt bằng lệnh thủ công';
    
    // Deactivate the bot
    await this.botGateway.deactivateBot(reason);
    
    // Send confirmation
    return messageChannel.reply({
      t: `🛑 Bot đã tạm dừng hoạt động.\nLý do: ${reason}\n\nGõ *activate hoặc /bot on để kích hoạt lại bot.`,
      mk: [{ type: EMarkdownType.PRE, s: 0, e: 100 }],
    });
  }
  
  private async handleActivate(messageChannel: any): Promise<any> {
    // Check if already active
    if (this.botStateService.isActive()) {
      return messageChannel.reply({
        t: '✅ Bot đã đang hoạt động.',
        mk: [{ type: EMarkdownType.PRE, s: 0, e: 24 }],
      });
    }
    
    // Activate the bot
    const success = await this.botGateway.activateBot();
    
    // Send confirmation
    if (success) {
      return messageChannel.reply({
        t: '✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!',
        mk: [{ type: EMarkdownType.PRE, s: 0, e: 38 }],
      });
    } else {
      return messageChannel.reply({
        t: `❌ Kích hoạt bot thất bại: ${this.botStateService.getInactiveReason()}`,
        mk: [{ type: EMarkdownType.PRE, s: 0, e: 100 }],
      });
    }
  }
  
  private async handleReset(messageChannel: any): Promise<any> {
    // Send "processing" message
    await messageChannel.reply({
      t: '⏳ Đang khởi động lại bot...',
      mk: [{ type: EMarkdownType.PRE, s: 0, e: 26 }],
    });
    
    // Reset the bot
    const success = await this.botGateway.resetBot();
    
    // Send confirmation
    if (success) {
      return messageChannel.reply({
        t: '✅ Bot đã được khởi động lại thành công!',
        mk: [{ type: EMarkdownType.PRE, s: 0, e: 36 }],
      });
    } else {
      return messageChannel.reply({
        t: `❌ Khởi động lại bot thất bại: ${this.botStateService.getInactiveReason()}`,
        mk: [{ type: EMarkdownType.PRE, s: 0, e: 100 }],
      });
    }
  }
}