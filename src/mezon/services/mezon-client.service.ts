import { Injectable, Logger } from '@nestjs/common';
import { MezonClient } from 'mezon-sdk';

@Injectable()
export class MezonClientService {
  private readonly logger = new Logger(MezonClientService.name);
  private client: MezonClient;
  private token: string;

  constructor(token: string) {
    this.token = token;
    this.client = new MezonClient(token);
  }

  async initializeClient() {
    try {
      this.logger.log('Attempting to login...');
      const result = await this.client.login();
      this.logger.log('Authentication successful');
      
      // Log client state sau khi login
      const clientInfo = {
        hasServers: !!this.client.servers,
        hasClans: !!(this.client as any).clans,
        userId: this.client.user?.id,
        clanCount: (this.client as any).clans?.size,
        serverCount: this.client.servers?.size
      };
      
      this.logger.log(`Client state after login: ${JSON.stringify(clientInfo)}`);
      
      // Chờ một chút để SDK khởi tạo đầy đủ các kết nối
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return result;
    } catch (error) {
      this.logger.error(`Authentication error: ${error.message}`);
      throw error;
    }
  }

  getClient() {
    return this.client;
  }
  
  // Thêm phương thức reconnectBot để khởi động lại bot
  async reconnectBot() {
    this.logger.log('Attempting to reconnect bot client...');
    
    try {
      // Đóng kết nối hiện tại nếu có
      if (this.client) {
        this.logger.log('Destroying current client connection');
        // Kiểm tra an toàn và sử dụng type assertion
        if (typeof (this.client as any).destroy === 'function') {
          await (this.client as any).destroy();
        } else if (typeof (this.client as any).disconnect === 'function') {
          await (this.client as any).disconnect();
        } else {
          this.logger.warn('No destroy/disconnect method available on client, creating new instance directly');
        }
      }
      
      // Tạo client mới
      this.logger.log('Creating new client instance');
      this.client = new MezonClient(this.token);
      
      // Đăng nhập lại
      this.logger.log('Logging in with new client');
      await this.initializeClient();
      
      this.logger.log('Bot reconnection successful');
      return this.client;
    } catch (error) {
      this.logger.error(`Error during bot reconnection: ${error.message}`, error.stack);
      throw error;
    }
  }  
  // Phương thức kiểm tra kết nối
  async checkConnection() {
    try {
      // Thử một API call đơn giản để kiểm tra kết nối
      const isConnected = this.client.user?.id || (this.client as any).ready;
      this.logger.debug(`Connection check: ${isConnected ? 'Connected' : 'Disconnected'}`);
      return !!isConnected;
    } catch (error) {
      this.logger.warn(`Connection check failed: ${error.message}`);
      return false;
    }
  }
}