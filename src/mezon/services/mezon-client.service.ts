import { Injectable, Logger } from '@nestjs/common';
import { MezonClient } from 'mezon-sdk';

@Injectable()
export class MezonClientService {
  private readonly logger = new Logger(MezonClientService.name);
  private client: MezonClient;
  private token: string;
  private reconnectBackoff = {
    attempts: 0,
    maxDelay: 30000
  };
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  constructor(token: string) {
    this.token = token;
    this.client = new MezonClient(token);

    // Tự động kiểm tra kết nối định kỳ
    this.startConnectionCheck();
  }

  private startConnectionCheck() {
    // Xóa interval cũ nếu có
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    // Thiết lập kiểm tra kết nối mỗi 5 phút
    this.connectionCheckInterval = setInterval(async () => {
      try {
        const isConnected = await this.checkConnection();
        if (!isConnected) {
          this.logger.warn('Connection check detected disconnection, attempting silent reconnect');
          await this.reconnectBot();
        }
      } catch (error) {
        this.logger.error(`Error during periodic connection check: ${error.message}`);
      }
    }, 5 * 60 * 1000); // 5 phút
  }

  async initializeClient() {
    try {
      this.logger.log('Attempting to login...');

      // Thêm timeout cho login để tránh bị treo
      const loginPromise = this.client.login();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login timed out after 15 seconds')), 15000)
      );

      // Race giữa login và timeout
      await Promise.race([loginPromise, timeoutPromise]);

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

      // Reset bộ đếm backoff vì login thành công
      this.reconnectBackoff.attempts = 0;

      // Chờ một chút để SDK khởi tạo đầy đủ các kết nối
      await new Promise(resolve => setTimeout(resolve, 500));

      return true;
    } catch (error) {
      this.logger.error(`Authentication error: ${error.message}`);

      // Tăng bộ đếm thử lại
      this.reconnectBackoff.attempts++;

      // Ném lỗi ra ngoài để caller có thể xử lý
      throw error;
    }
  }

  getClient() {
    return this.client;
  }

  // Phương thức reconnectBot để khởi động lại bot
  async reconnectBot() {
    this.logger.log('Attempting to reconnect bot client...');

    try {
      // Đóng kết nối hiện tại nếu có
      if (this.client) {
        this.logger.log('Safely closing current client connection');

        try {
          // Tạo promise với timeout để tránh treo khi đóng kết nối
          const closePromise = new Promise<void>(async (resolve) => {
            try {
              if (typeof (this.client as any).destroy === 'function') {
                await (this.client as any).destroy();
              } else if (typeof (this.client as any).disconnect === 'function') {
                await (this.client as any).disconnect();
              }
            } catch (e) {
              this.logger.warn(`Error during disconnect: ${e.message}`);
            }
            resolve();
          });

          // Thêm timeout 5 giây cho việc đóng kết nối
          const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              this.logger.warn('Client disconnect timed out, forcing new connection');
              resolve();
            }, 5000);
          });

          // Chờ cái nào hoàn thành trước
          await Promise.race([closePromise, timeoutPromise]);
        } catch (closeError) {
          this.logger.warn(`Error closing previous connection: ${closeError.message}`);
          // Tiếp tục dù có lỗi
        }
      }

      // Tạo client mới
      this.logger.log('Creating new client instance');
      this.client = new MezonClient(this.token);

      // Thêm sự kiện xử lý lỗi cho client
      if (typeof this.client.on === 'function') {
        this.client.on('error', (err) => {
          this.logger.error(`Mezon client error event: ${err.message}`);
        });
      }

      // Đăng nhập lại
      this.logger.log('Logging in with new client');
      await this.initializeClient();

      this.logger.log('Bot reconnection successful');
      return this.client;
    } catch (error) {
      this.logger.error(`Error during bot reconnection: ${error.message}`, error.stack);

      // Tính toán thời gian chờ cho lần thử tiếp theo
      const retryDelay = Math.min(
        this.reconnectBackoff.maxDelay,
        3000 * Math.pow(1.5, Math.min(10, this.reconnectBackoff.attempts))
      );

      this.logger.log(`Will attempt reconnect again in ${retryDelay / 1000} seconds`);

      throw error;
    }
  }

  // Phương thức kiểm tra kết nối
  async checkConnection() {
    try {
      // Kiểm tra nhiều điều kiện khác nhau để xác định kết nối
      const clientExists = !!this.client;
      let userExists = false;
      let isReady = false;
      let hasServers = false;
      let hasClans = false;

      // Kiểm tra an toàn từng thuộc tính
      if (clientExists) {
        userExists = !!this.client.user?.id;
        isReady = !!(this.client as any).ready;
        hasServers = !!this.client.servers && this.client.servers.size > 0;
        hasClans = !!(this.client as any).clans && (this.client as any).clans.size > 0;
      }

      const isConnected = clientExists && (userExists || isReady || hasServers || hasClans);

      this.logger.debug(`Connection check: ${isConnected ? 'Connected' : 'Disconnected'} ` +
        `(Client: ${clientExists}, User: ${userExists}, Ready: ${isReady}, ` +
        `Servers: ${hasServers}, Clans: ${hasClans})`);

      return isConnected;
    } catch (error) {
      this.logger.warn(`Connection check failed with error: ${error.message}`);
      return false;
    }
  }
}