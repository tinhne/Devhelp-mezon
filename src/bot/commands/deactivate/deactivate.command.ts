import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { BotStateService } from '../../services/bot-state.service';
import { BotGateway } from '../../events/bot.gateways';
import { Injectable } from '@nestjs/common';

@Command('deactivate')
@Injectable()
export class DeactivateCommand extends CommandMessage {
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
}