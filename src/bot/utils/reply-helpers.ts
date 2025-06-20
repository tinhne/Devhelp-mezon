import { EMarkdownType } from 'mezon-sdk';
import { ActionRowComponent, MessageReplyOptions } from '../constants/interfaces';

/**
 * Gửi reply với components
 */
export function safeReply(messageChannel: any, options: MessageReplyOptions) {
  // Cast to any để tránh TypeScript error
  return messageChannel.reply(options as any);
}

/**
 * Tạo reply options với components
 */
export function createReplyOptions(
  content: string,
  markdownRanges: any[] = [],
  components: ActionRowComponent[] = [],
  embeds: any[] = []
): MessageReplyOptions {
  const options: MessageReplyOptions = {};
  
  if (content) {
    options.t = content;
    if (markdownRanges.length > 0) {
      options.mk = markdownRanges;
    } else {
      options.mk = [
        {
          type: EMarkdownType.PRE,
          s: 0,
          e: content.length,
        },
      ];
    }
  }
  
  if (components.length > 0) {
    options.components = components;
  }
  
  if (embeds.length > 0) {
    options.embed = embeds;
  }
  
  return options;
}

/**
 * Tạo markdown range cho PRE
 */
export function createPreMarkdown(content: string): any[] {
  return [
    {
      type: EMarkdownType.PRE,
      s: 0,
      e: content.length,
    },
  ];
}