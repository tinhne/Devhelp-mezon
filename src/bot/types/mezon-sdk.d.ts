declare module 'mezon-sdk' {
  export class MezonClient {
    constructor(token?: string);
    login(token?: string): Promise<any>;
    servers?: Map<string, Server>;
    clans?: Map<string, Clan>;
    user?: User;
    on(event: string, listener: (...args: any[]) => void): this;
    
    // Thêm các phương thức API trực tiếp có thể có
    sendMessage?(channelId: string, options: any): Promise<Message>;
    createMessage?(channelId: string, options: any): Promise<Message>;
    getChannel?(channelId: string): Promise<Channel>;
    
    // Thêm phương thức destroy cho việc reset connection
    destroy?(): Promise<void>;
    disconnect?(): Promise<void>;
  }

  export interface User {
    id: string;
    username: string;
  }

  export interface Server {
    id: string;
    name: string;
    channels: ChannelManager;
    members: MemberManager;
  }

  export interface Member {
    id: string;
    permissions: string[];
  }

  export interface MemberManager {
    fetch(userId: string): Promise<Member>;
  }

  export interface Channel {
    id: string;
    messages: MessageManager;
  }

  export interface ChannelManager {
    fetch(channelId: string): Promise<Channel>;
  }

export interface MessageManager {
  fetch(messageId: string): Promise<Message>;
  create?(options: any): Promise<Message>; // Thêm phương thức create dạng optional
  send?(options: any): Promise<Message>;   // Thêm phương thức send dạng optional
  createMessage?(options: any): Promise<Message>; // Thêm phương thức thay thế
}

  export interface Message {
    id: string;
    content: {
      t?: string;
    };
    reply(options: any): Promise<Message>;
  }

  export interface ChannelMessage {
  server_id?: string;
  clan_id?: string;     // Thêm trường này để hỗ trợ cả cấu trúc cũ và mới
  channel_id: string;
  message_id: string;
  sender_id: string;
  content: {
    t?: string;
  };
  code?: string;
}

  export interface MessageButtonClicked {
    custom_id: string;
    server_id: string;
    channel_id: string;
    message_id: string;
    user_id: string;
  }

  export enum EMarkdownType {
    PRE = 'PRE',
    BOLD = 'BOLD',
    ITALIC = 'ITALIC',
    UNDERLINE = 'UNDERLINE',
    STRIKE = 'STRIKE',
    CODE = 'CODE'
  }

  export enum Events {
    ChannelMessage = 'channelMessage',
    MessageButtonClicked = 'messageButtonClicked'
  }
}