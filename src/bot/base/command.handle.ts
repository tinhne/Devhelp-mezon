import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ChannelMessage } from 'mezon-sdk';
import { CommandStorage } from './storage';
import { extractMessage } from '../utils/helps';
import { CommandBaseInterface } from './interfaces/asterisk.interface';

@Injectable()
export class CommandBase implements CommandBaseInterface {
  private readonly logger = new Logger(CommandBase.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  execute(messageContent: string, message: ChannelMessage) {
    try {
      this.logger.log(`Processing command: ${messageContent}`);
      const [commandName, args] = extractMessage(messageContent);

      // Sửa lỗi ở đây - kiểm tra args phải là mảng trước khi gọi join
      const argsDisplay = Array.isArray(args) ? args.join(' ') : 'none';
      this.logger.debug(`Extracted command: ${commandName}, args: ${argsDisplay}`);

      const target = CommandStorage.getCommand(commandName as string);
      if (target) {
        this.logger.debug(`Found handler for command: ${commandName}`);
        const command = this.moduleRef.get(target);
        
        if (command) {
          this.logger.debug(`Executing command: ${commandName}`);
          return command.execute(args, message);
        } else {
          this.logger.warn(`Handler for command ${commandName} could not be instantiated`);
        }
      } else {
        this.logger.warn(`No handler registered for command: ${commandName}`);
      }
    } catch (error) {
      this.logger.error(`Error executing command: ${error.message}`, error.stack);
    }
    return [];
  }
}