import { ChannelMessage, MezonClient } from 'mezon-sdk';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { Logger } from '@nestjs/common';

export abstract class CommandMessage {
  protected client: MezonClient;
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected clientService: MezonClientService) {
    this.client = this.clientService.getClient();
  }

  protected filterReplyOptions(options: any): any {
    // Clone options để không thay đổi object ban đầu
    const filteredOptions = { ...options };

    // Loại bỏ components nếu có
    if (filteredOptions.components) {
      this.logger.debug('Removing button components from reply');
      delete filteredOptions.components;
    }

    return filteredOptions;
  }

  protected async getChannelMessage(message: ChannelMessage) {
    try {
      // Lấy clanId (clan_id hoặc server_id)
      const clanId = message.clan_id || message.server_id;
      this.logger.debug(`Getting message details - clan: ${clanId}, channel: ${message.channel_id}, message: ${message.message_id}`);

      // --- Tự động fetch clan nếu chưa có ---
      if ((this.client as any).clans && clanId && clanId !== "0") {
        let clan = (this.client as any).clans.get(clanId);
        if (!clan) {
          this.logger.warn(`[AUTO-FETCH] Clan ${clanId} chưa có trong cache, tiến hành fetch lại...`);
          try {
            clan = await (this.client as any).clans.fetch(clanId);
            this.logger.log(`[AUTO-FETCH] Đã fetch clan ${clanId} thành công`);
          } catch (err) {
            this.logger.error(`[AUTO-FETCH] Không thể fetch clan ${clanId}: ${err.message}`);
            // Trả về null để các lệnh không bị lỗi nặng hơn
            return null;
          }
        }
      }

      // Log trạng thái client chỉ liên quan đến clan
      this.logger.debug(`Client info: ${JSON.stringify({
        hasClans: !!(this.client as any).clans,
        clanCount: (this.client as any).clans?.size || 0,
        userId: this.client.user?.id
      })}`);

      // Đối tượng message giả để có phương thức reply
      return {
        reply: async (options: any) => {
          try {
            // Luôn ưu tiên sử dụng clan và channel
            if ((this.client as any).clans) {
              const clan = (this.client as any).clans.get(clanId);
              if (clan) {
                this.logger.debug(`Found clan with ID: ${clanId}`);
                const channel = await clan.channels.fetch(message.channel_id);
                if (channel) {
                  this.logger.debug(`Successfully fetched channel ${message.channel_id} from clan ${clanId}`);
                  // Thử các phương thức gửi tin nhắn với kiểm tra an toàn
                  if (channel.messages && typeof channel.messages.create === 'function') {
                    this.logger.debug(`Using channel.messages.create() for channel ${message.channel_id}`);
                    return await channel.messages.create(this.filterReplyOptions(options));                  
                  }

                  if ((channel.messages as any).send) {
                    this.logger.debug(`Using channel.messages.send() for channel ${message.channel_id}`);
                    return await (channel.messages as any).send(options);
                  }

                  if ((channel as any).send) {
                    this.logger.debug(`Using channel.send() for channel ${message.channel_id}`);
                    return await (channel as any).send(options);
                  }

                  if ((channel as any).createMessage) {
                    this.logger.debug(`Using channel.createMessage() for channel ${message.channel_id}`);
                    return await (channel as any).createMessage(options);
                  }

                  this.logger.warn(`No suitable message creation method found for channel ${message.channel_id}`);
                } else {
                  this.logger.warn(`Channel not found in clan: ${message.channel_id}`);
                }
              } else {
                this.logger.warn(`No clan found with ID: ${clanId}`);
              }
            }

            // Các phương thức trực tiếp với client
            if ((this.client as any).sendMessage) {
              this.logger.debug(`Using direct sendMessage to ${message.channel_id}`);
              return await (this.client as any).sendMessage(message.channel_id, options);
            }

            if ((this.client as any).createMessage) {
              this.logger.debug(`Using createMessage for ${message.channel_id}`);
              return await (this.client as any).createMessage(message.channel_id, options);
            }

            if ((this.client as any).getChannel) {
              this.logger.debug(`Trying to get channel ${message.channel_id} directly`);
              const channel = await (this.client as any).getChannel(message.channel_id);
              if (channel) {
                this.logger.debug(`Successfully got channel ${message.channel_id} directly`);
                if ((channel as any).send) {
                  return await (channel as any).send(options);
                } else if ((channel as any).createMessage) {
                  return await (channel as any).createMessage(options);
                }
                this.logger.warn(`Direct channel has no valid send methods`);
              } else {
                this.logger.warn(`Failed to get channel ${message.channel_id} directly`);
              }
            }

            this.logger.warn('No method available to send message to channel');
            return null;
          } catch (error) {
            this.logger.error(`Error sending reply: ${error.message}`, error.stack);
            return null;
          }
        }
      };
    } catch (error) {
      this.logger.error(`Error in getChannelMessage: ${error.message}`, error.stack);
      return null;
    }
  }

  abstract execute(
    args: string[],
    message: ChannelMessage,
    commandName?: string,
  ): any;
}