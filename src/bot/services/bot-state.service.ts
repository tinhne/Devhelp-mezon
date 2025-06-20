import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export enum BotState {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

@Injectable()
export class BotStateService {
  private readonly logger = new Logger(BotStateService.name);
  private state: BotState = BotState.INACTIVE;
  private lastStateChange: Date = new Date();
  private inactiveReason: string = '';
  private commandPrefix = '*'; // Default prefix
  
  constructor(private eventEmitter: EventEmitter2) {}
  
  getState(): BotState {
    return this.state;
  }
  
  setActive(): void {
    this.logger.log('Bot state set to ACTIVE');
    this.state = BotState.ACTIVE;
    this.lastStateChange = new Date();
    this.inactiveReason = '';
    this.eventEmitter.emit('bot.state.changed', this.state);
  }
  
  setInactive(reason: string): void {
    this.logger.log(`Bot state set to INACTIVE: ${reason}`);
    this.state = BotState.INACTIVE;
    this.lastStateChange = new Date();
    this.inactiveReason = reason;
    this.eventEmitter.emit('bot.state.changed', this.state);
  }
  
  setReconnecting(): void {
    this.logger.log('Bot state set to RECONNECTING');
    this.state = BotState.RECONNECTING;
    this.lastStateChange = new Date();
    this.eventEmitter.emit('bot.state.changed', this.state);
  }
  
  setError(error: string): void {
    this.logger.log(`Bot state set to ERROR: ${error}`);
    this.state = BotState.ERROR;
    this.lastStateChange = new Date();
    this.inactiveReason = error;
    this.eventEmitter.emit('bot.state.changed', this.state);
  }
  
  isActive(): boolean {
    return this.state === BotState.ACTIVE;
  }
  
  getInactiveReason(): string {
    return this.inactiveReason;
  }
  
  getLastStateChange(): Date {
    return this.lastStateChange;
  }
  
  getStatusDetails(): any {
    return {
      state: this.state,
      since: this.lastStateChange,
      inactiveReason: this.inactiveReason,
      commandPrefix: this.commandPrefix
    };
  }
  
  setCommandPrefix(prefix: string): void {
    this.commandPrefix = prefix;
    this.logger.log(`Command prefix set to "${prefix}"`);
  }
  
  getCommandPrefix(): string {
    return this.commandPrefix;
  }
}