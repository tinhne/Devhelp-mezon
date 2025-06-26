import { ChannelMessage } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { BotStateService } from '../../services/bot-state.service';
import { BotGateway } from '../../events/bot.gateways';
import { Injectable } from '@nestjs/common';
// Thêm helper reply
import { safeReply, createReplyOptions, createPreMarkdown } from 'src/bot/utils/reply-helpers';

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
      return safeReply(
        messageChannel,
        createReplyOptions(
          '✅ Bot đã đang hoạt động.',
          createPreMarkdown('✅ Bot đã đang hoạt động.')
        )
      );
    }
    
    // Activate the bot
    const success = await this.botGateway.activateBot();
    
    // Send confirmation
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
}