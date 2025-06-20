import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { BotStateService } from '../../services/bot-state.service';
import { BotGateway } from '../../events/bot.gateways';
import { Injectable } from '@nestjs/common';

@Command('active')
@Injectable()
export class ActiveCommand extends CommandMessage {
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
}