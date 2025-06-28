import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { BotGateway } from './bot/events/bot.gateways';
import { BotStateService } from './bot/services/bot-state.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly botGateway: BotGateway,
    private readonly botStateService: BotStateService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Đã loại bỏ hoàn toàn logic resetBot, chỉ trả về thông báo hướng dẫn
  @Get('/reset-bot')
  async resetBot() {
    return { 
      success: false,
      message: '🔄 Lệnh reset bot đã bị vô hiệu hóa. Nếu gặp sự cố, hãy khởi động lại service bot trên server.',
      timestamp: new Date().toISOString(),
      status: this.botStateService.getState()
    };
  }
  
  @Post('/deactivate-bot')
  async deactivateBot(@Body() body: { reason?: string }) {
    try {
      const reason = body.reason || 'Deactivated via API';
      await this.botGateway.deactivateBot(reason);
      return {
        success: true,
        message: `Bot deactivated: ${reason}`,
        timestamp: new Date().toISOString(),
        status: this.botStateService.getState()
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  @Post('/activate-bot')
  async activateBot() {
    try {
      const success = await this.botGateway.activateBot();
      return {
        success,
        message: success ? 'Bot activated successfully' : 'Bot activation failed',
        timestamp: new Date().toISOString(),
        status: this.botStateService.getState()
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  @Get('/bot-status')
  async getBotStatus() {
    try {
      return this.botGateway.getBotStatus();
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}