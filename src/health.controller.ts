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
      const isConnected = !!client?.user;

      let clanCount = 0;
      const clans = (client as any).clans;
      if (clans) {
        if (typeof clans.size === 'number') {
          clanCount = clans.size;
        } else if (typeof clans.keys === 'function') {
          clanCount = Array.from(clans.keys()).length;
        } else if (Array.isArray(clans)) {
          clanCount = clans.length;
        } else if (typeof clans === 'object') {
          clanCount = Object.keys(clans).length;
        }
      }

      return {
        status: isConnected ? 'UP' : 'DOWN',
        time: new Date().toISOString(),
        botState: this.botStateService.getState(),
        services: {
          mezon: {
            status: isConnected ? 'UP' : 'DOWN',
            details: {
              hasUser: !!client.user,
              hasClans: !!clans,
              clanCount
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