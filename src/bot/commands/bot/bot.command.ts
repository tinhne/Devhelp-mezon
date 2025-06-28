import { ChannelMessage } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { BotStateService } from '../../services/bot-state.service';
import { BotGateway } from '../../events/bot.gateways';
import { Injectable, Logger } from '@nestjs/common';
import { getRandomColor } from '../../utils/helps';
// Thêm helper reply
import { safeReply, createReplyOptions, createPreMarkdown } from 'src/bot/utils/reply-helpers';

@Command('bot')
@Injectable()
export class BotCommand extends CommandMessage {
  protected readonly logger = new Logger(BotCommand.name);

  constructor(
    clientService: MezonClientService,
    private botStateService: BotStateService,
    private botGateway: BotGateway
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage): Promise<any> {
    const messageChannel = await this.getChannelMessage(message);
    if (!messageChannel) return;

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
      return safeReply(
        messageChannel,
        createReplyOptions(
          `❌ Lỗi: ${error.message}`,
          createPreMarkdown(`❌ Lỗi: ${error.message}`)
        )
      );
    }
  }

  private async showHelp(messageChannel: any): Promise<any> {
    return safeReply(messageChannel, {
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

    return safeReply(messageChannel, {
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
              name: 'Số clan kết nối',
              value: String(status.connectionInfo.clanCount || 0),
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
    if (!this.botStateService.isActive()) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          '❌ Bot đã ở trạng thái không hoạt động.',
          createPreMarkdown('❌ Bot đã ở trạng thái không hoạt động.')
        )
      );
    }

    const reason = args.join(' ') || 'Được tắt bằng lệnh thủ công';
    await this.botGateway.deactivateBot(reason);

    return safeReply(
      messageChannel,
      createReplyOptions(
        `🛑 Bot đã tạm dừng hoạt động.\nLý do: ${reason}\n\nGõ *activate hoặc /bot on để kích hoạt lại bot.`,
        createPreMarkdown(`🛑 Bot đã tạm dừng hoạt động.\nLý do: ${reason}\n\nGõ *activate hoặc /bot on để kích hoạt lại bot.`)
      )
    );
  }

  private async handleActivate(messageChannel: any): Promise<any> {
    if (this.botStateService.isActive()) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          '✅ Bot đã đang hoạt động.',
          createPreMarkdown('✅ Bot đã đang hoạt động.')
        )
      );
    }

    const success = await this.botGateway.activateBot();

    if (success) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          '✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!',
          createPreMarkdown('✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!')
        )
      );
    } else {
      return safeReply(
        messageChannel,
        createReplyOptions(
          `❌ Kích hoạt bot thất bại: ${this.botStateService.getInactiveReason()}`,
          createPreMarkdown(`❌ Kích hoạt bot thất bại: ${this.botStateService.getInactiveReason()}`)
        )
      );
    }
  }

  private async handleReset(messageChannel: any): Promise<any> {
    // Không còn logic resetBot, chỉ trả về thông báo hướng dẫn
    return safeReply(
      messageChannel,
      createReplyOptions(
        '🔄 Lệnh reset bot đã bị vô hiệu hóa. Nếu gặp sự cố, hãy khởi động lại service bot trên server.',
        createPreMarkdown('🔄 Lệnh reset bot đã bị vô hiệu hóa. Nếu gặp sự cố, hãy khởi động lại service bot trên server.')
      )
    );
  }
}