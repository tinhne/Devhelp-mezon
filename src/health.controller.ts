import { Controller, Get } from '@nestjs/common';
import { MezonClientService } from './mezon/services/mezon-client.service';
import { BotStateService } from './bot/services/bot-state.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly mezonClientService: MezonClientService,
    private readonly botStateService: BotStateService
  ) {}

  @Get()
  async check() {
    try {
      const client = this.mezonClientService.getClient();
      const isConnected = await this.mezonClientService.checkConnection();
      
      return {
        status: isConnected ? 'UP' : 'DOWN',
        time: new Date().toISOString(),
        botState: this.botStateService.getState(),
        services: {
          mezon: {
            status: isConnected ? 'UP' : 'DOWN',
            details: {
              hasUser: !!client.user,
              hasServers: !!client.servers,
              hasClans: !!(client as any).clans,
              clanCount: (client as any).clans?.size || 0,
              serverCount: client.servers?.size || 0
            }
          },
        }
      };
    } catch (error) {
      return {
        status: 'ERROR',
        time: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}