import { ChannelMessage } from 'mezon-sdk';

export interface CommandBaseInterface {
  execute: (
    messageContent: string,
    message: ChannelMessage,
    commandName?: string,
  ) => null[];
}
