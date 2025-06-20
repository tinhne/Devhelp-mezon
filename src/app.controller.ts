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
  
  @Get('/reset-bot')
  async resetBot() {
    try {
      const success = await this.botGateway.resetBot();
      return { 
        success, 
        message: success ? 'Bot restarted successfully' : 'Bot restart failed',
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