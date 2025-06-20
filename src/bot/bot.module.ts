import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MezonModule } from 'src/mezon/mezon.module';

// Services
import { CommandService } from './services/command.service';
import { BugService } from './services/bug.service';
import { SolutionService } from './services/solution.service';
import { SearchService } from './services/search.service';
import { BotStateService } from './services/bot-state.service';

// Entities
import { Command } from './models/command.entity';
import { Bug } from './models/bug.entity';
import { Solution } from './models/solution.entity';

// Commands
import { CommandBotCommand } from './commands/command/command.command';
import { BugCommand } from './commands/bug/bug.command';
import { SolutionCommand } from './commands/solution/solution.command';
import { SearchCommand } from './commands/search/search.command';
import { HelpCommand } from './commands/help/help.command';
import { PingCommand } from './commands/ping/ping.command';
import { BotCommand } from './commands/bot/bot.command';
// Thêm import cho các lệnh mới
import { ActiveCommand } from './commands/active/active.command';
import { DeactivateCommand } from './commands/deactivate/deactivate.command';
import { BotstatusCommand } from './commands/botstatus/botstatus.command';

// Listeners
import { ListenerChannelMessage } from './listeners/onChannelMessage.listener';
import { ListenerMessageButtonClicked } from './listeners/onMessageButtonClicked.listener';
import { BotGateway } from './events/bot.gateways';
import { CommandBase } from './base/command.handle';

@Module({
  imports: [TypeOrmModule.forFeature([Command, Bug, Solution]), MezonModule],
  providers: [
    // Core
    BotGateway,
    CommandBase,
    BotStateService,

    // Services
    CommandService,
    BugService,
    SolutionService,
    SearchService,

    // Commands
    CommandBotCommand,
    BugCommand,
    SolutionCommand,
    SearchCommand,
    HelpCommand,
    PingCommand,
    BotCommand,
    // Thêm các lệnh mới
    ActiveCommand,
    DeactivateCommand,
    BotstatusCommand,

    // Listeners
    ListenerChannelMessage,
    ListenerMessageButtonClicked,
  ],
  exports: [BotGateway, BotStateService],
})
export class BotModule {}