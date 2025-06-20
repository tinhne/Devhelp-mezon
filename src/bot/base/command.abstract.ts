import { ChannelMessage, MezonClient } from 'mezon-sdk';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { Logger } from '@nestjs/common';

export abstract class CommandMessage {
  protected client: MezonClient;
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected clientService: MezonClientService) {
    this.client = this.clientService.getClient();
  }

  protected async getChannelMessage(message: ChannelMessage) {
    try {
      // Kiểm tra xem message có clan_id không
      const serverId = message.server_id || (message as any).clan_id;
      this.logger.debug(`Getting message details - server/clan: ${serverId}, channel: ${message.channel_id}, message: ${message.message_id}`);
      
      if (!serverId || serverId === "0") { // Thêm kiểm tra giá trị "0"
        this.logger.warn(`Invalid server_id or clan_id found in message: ${serverId}`);
        // Tiếp tục thực hiện vì một số tin nhắn có thể có clan_id = "0" nhưng vẫn hợp lệ
      }

      // Thêm log chi tiết hơn về trạng thái client
      this.logger.debug(`Client info: ${JSON.stringify({
        hasServers: !!this.client.servers,
        hasClans: !!(this.client as any).clans,
        clanCount: (this.client as any).clans?.size || 0,
        serverCount: this.client.servers?.size || 0,
        userId: this.client.user?.id
      })}`);

      // Tạo một đối tượng message giả để có phương thức reply
      return {
        reply: async (options: any) => {
          try {
            // Ưu tiên sử dụng clan và channel
            if ((this.client as any).clans) {
              const clan = (this.client as any).clans.get(serverId);
              if (clan) {
                this.logger.debug(`Found clan with ID: ${serverId}`);
                const channel = await clan.channels.fetch(message.channel_id);
                if (channel) {
                  this.logger.debug(`Successfully fetched channel ${message.channel_id} from clan ${serverId}`);
                  // Thử các phương thức gửi tin nhắn với kiểm tra an toàn
                  if (channel.messages && typeof channel.messages.create === 'function') {
                    this.logger.debug(`Using channel.messages.create() for channel ${message.channel_id}`);
                    return await channel.messages.create(options);
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
                this.logger.warn(`No clan found with ID: ${serverId}`);
              }
            }

            // Thử với servers nếu có
            if (this.client.servers) {
              const server = this.client.servers.get(serverId);
              if (server) {
                this.logger.debug(`Found server with ID: ${serverId}`);
                const channel = await server.channels.fetch(message.channel_id);
                if (channel) {
                  this.logger.debug(`Successfully fetched channel ${message.channel_id} from server ${serverId}`);
                  
                  // Thử từng phương thức với kiểm tra an toàn
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
                  
                  this.logger.warn(`No suitable message creation method found for channel ${message.channel_id}`);
                } else {
                  this.logger.warn(`Channel not found in server: ${message.channel_id}`);
                }
              } else {
                this.logger.warn(`No server found with ID: ${serverId}`);
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