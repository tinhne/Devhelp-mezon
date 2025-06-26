import { OnEvent } from '@nestjs/event-emitter';
import { ChannelMessage, Events, EMarkdownType } from 'mezon-sdk';
import { CommandBase } from '../base/command.handle';
import { Injectable, Logger } from '@nestjs/common';
import { BotStateService } from '../services/bot-state.service';
import { BotGateway } from '../events/bot.gateways';
import { safeReply, createReplyOptions, createPreMarkdown } from '../utils/reply-helpers';

@Injectable()
export class ListenerChannelMessage {
  private readonly logger = new Logger(ListenerChannelMessage.name);
  // Khai báo mảng các prefix hợp lệ
  private validPrefixes: string[] = ['*', '/', '\\'];

  constructor(
    private commandBase: CommandBase,
    private botStateService: BotStateService,
    private botGateway: BotGateway
  ) {
    this.logger.log('ListenerChannelMessage initialized');
  }

  @OnEvent(Events.ChannelMessage)
  async handleCommand(message: ChannelMessage) {
    // Kiểm tra message có tồn tại không
    if (!message || !message.content || !message.content.t) {
      this.logger.debug('Received empty or invalid message');
      return;
    }
    
    // Log full message details for debugging
    this.logger.debug(`Full message structure: ${JSON.stringify({
      clan_id: (message as any).clan_id, 
      server_id: message.server_id, 
      channel_id: message.channel_id,
      content: message.content
    })}`);
    
    const content = message.content.t.trim();
    this.logger.log(`Received message: ${content}`);
    
    // Skip edited messages
    if (message.code) {
      this.logger.debug('Skipping edited message');
      return;
    }
    
    try {
      // Kiểm tra prefix của tin nhắn
      const firstChar = content[0];
      const hasValidPrefix = this.validPrefixes.includes(firstChar);
      
      // Quan trọng: Luôn cho phép xử lý lệnh activate ngay cả khi bot không active
      if (content.startsWith('*activate') || content.startsWith('/activate') || content.startsWith('\\activate')) {
        await this.handleActivation(message);
        return;
      }
      
      // Chỉ kiểm tra prefix hợp lệ cho các lệnh khác
      if (!hasValidPrefix) {
        this.logger.debug(`Message doesn't start with valid prefix: ${firstChar}`);
        return;
      }
      
      // Xử lý các lệnh deactivate và botstatus
      if (content.startsWith('*deactivate') || content.startsWith('/deactivate') || content.startsWith('\\deactivate')) {
        await this.handleDeactivation(message);
        return;
      }
      
      if (content.startsWith('*botstatus') || content.startsWith('/botstatus') || content.startsWith('\\botstatus')) {
        await this.handleBotStatus(message);
        return;
      }
      
      // Chỉ khi bot active mới xử lý các lệnh khác
      if (this.botStateService.isActive()) {
        this.logger.log(`Executing command: ${content}`);
        await this.commandBase.execute(content, message);
      } else {
        this.logger.debug(`Bot is inactive. Ignoring command: ${content}`);
      }
    } catch (error) {
      this.logger.error('Error handling message:', error);
    }
  }
  
  // Rest of the file remains unchanged
  // Handle bot deactivation
  private async handleDeactivation(message: ChannelMessage) {
    const messageChannel = await this.getMessageChannel(message);
    if (!messageChannel) return;

    if (!this.botStateService.isActive()) {
      // Sử dụng helper reply
      await safeReply(
        messageChannel,
        createReplyOptions(
          '❌ Bot đã ở trạng thái không hoạt động.',
          createPreMarkdown('❌ Bot đã ở trạng thái không hoạt động.')
        )
      );
      return;
    }
    
    // Extract reason if provided
const content = message?.content?.t || '';
    const reason = content.split(' ').slice(1).join(' ') || 'Được tắt bằng lệnh thủ công';

    await this.botGateway.deactivateBot(reason);

    await safeReply(
      messageChannel,
      createReplyOptions(
        `🛑 Bot đã tạm dừng hoạt động.\nLý do: ${reason}\n\nGõ *activate để kích hoạt lại bot.`,
        createPreMarkdown(`🛑 Bot đã tạm dừng hoạt động.\nLý do: ${reason}\n\nGõ *activate để kích hoạt lại bot.`)
      )
    );
  }

  // Handle bot activation
  private async handleActivation(message: ChannelMessage) {
    const messageChannel = await this.getMessageChannel(message);
    if (!messageChannel) return;

    if (this.botStateService.isActive()) {
      await safeReply(
        messageChannel,
        createReplyOptions(
          '✅ Bot đã đang hoạt động.',
          createPreMarkdown('✅ Bot đã đang hoạt động.')
        )
      );
      return;
    }

    const success = await this.botGateway.activateBot();

    if (success) {
      await safeReply(
        messageChannel,
        createReplyOptions(
          '✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!',
          createPreMarkdown('✅ Bot đã được kích hoạt và sẵn sàng nhận lệnh!')
        )
      );
    } else {
      const reason = this.botStateService.getInactiveReason();
      await safeReply(
        messageChannel,
        createReplyOptions(
          `❌ Kích hoạt bot thất bại: ${reason}`,
          createPreMarkdown(`❌ Kích hoạt bot thất bại: ${reason}`)
        )
      );
    }
  }  
  // Handle bot status request
  private async handleBotStatus(message: ChannelMessage) {
    // Giữ nguyên code hiện tại
    const messageChannel = await this.getMessageChannel(message);
    if (!messageChannel) return;
    
    const status = this.botGateway.getBotStatus();
    const stateEmoji = status.state === 'active' ? '🟢' : 
                      status.state === 'inactive' ? '🔴' : 
                      status.state === 'reconnecting' ? '🟡' : '🟠';
    
    const statusText = `${stateEmoji} Bot DevHelper Status\n` +
                      `Trạng thái: ${status.state}\n` +
                      `Từ: ${new Date(status.since).toLocaleString()}\n` +
                      `Prefix: ${status.commandPrefix}\n` +
                      `Số server: ${status.connectionInfo.clanCount || status.connectionInfo.serverCount || 0}\n` +
                      (status.state !== 'active' ? `Lý do: ${status.inactiveReason}\n` : '') +
                      `\nSử dụng *activate để kích hoạt hoặc *deactivate để tắt bot.`;
    
    await messageChannel.reply({
      t: statusText,
      mk: [{ type: EMarkdownType.PRE, s: 0, e: statusText.length }],
    });
  }
  
  // Helper to get message channel
  private async getMessageChannel(message: ChannelMessage) {
    try {
      const client = this.botGateway['client']; // Access private client
      const serverId = message.server_id || (message as any).clan_id;
      const channelId = message.channel_id;
      
      if ((client as any).clans) {
        const clan = (client as any).clans.get(serverId);
        if (clan) {
          const channel = await clan.channels.fetch(channelId);
          if (channel) {
            return { 
              reply: async (options: any) => {
                try {
                  // Xử lý nhiều phương thức khác nhau để đảm bảo tin nhắn được gửi
                  if (channel.messages && typeof channel.messages.create === 'function') {
                    return await channel.messages.create(options);
                  }
                  
                  if ((channel.messages as any).send) {
                    return await (channel.messages as any).send(options);
                  }
                  
                  if ((channel as any).send) {
                    return await (channel as any).send(options);
                  }
                  
                  if ((channel as any).createMessage) {
                    return await (channel as any).createMessage(options);
                  }
                  
                  // Fallback: gửi message trực tiếp qua client nếu các phương thức trên không khả dụng
                  if ((client as any).sendMessage) {
                    return await (client as any).sendMessage(channelId, options);
                  }
                  
                  if ((client as any).createMessage) {
                    return await (client as any).createMessage(channelId, options);
                  }
                  
                  throw new Error('No suitable method found to send message');
                } catch (err) {
                  this.logger.error(`Failed to send message: ${err.message}`);
                  throw err;
                }
              }
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Error getting message channel: ${error.message}`);
      return null;
    }
  }
}