export interface EmbedProps {
  color?: string;
  title?: string;
  url?: string;
  author?: {
    name: string;
    icon_url?: string;
    url?: string;
  };
  description?: string;
  thumbnail?: { url: string, height?: string, width?: string };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
    options?: any[];
    inputs?: {};
  }>;
  image?: { url: string, height?: string, width?: string };
  timestamp?: string;
  footer?: { text: string; icon_url?: string };
}

export const MEZON_IMAGE_URL =
  'https://cdn.mezon.vn/1837043892743049216/1840654271217930240/1827994776956309500/857_0246x0w.webp';

export const MEZON_EMBED_FOOTER = {
  text: 'Powered by Mezon',
  icon_url: MEZON_IMAGE_URL,
};

export enum EmbebButtonType {
  CONFIRM = 'CONFIRM',
  CANCEL = 'CANCEL',
  VOTE = 'VOTE',
  FINISH = 'FINISH',
  ORDER = 'ORDER',
  REPORT = 'REPORT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  SAVE = 'SAVE',
  LIXI = 'LIXI',
  SUBMITCREATE = 'SUBMITCREATE',
  BET5000 = 'BET5000',
  BET10000 = 'BET10000',
  BET20000 = 'BET20000',
  BET50000 = 'BET50000',
  DELETE = 'DELETE',
  SELL = 'SELL',
  DONE = 'DONE',
  BUY = 'BUY'
}

export enum FuncType {
  RUT = 'rut',
  SLOTS = 'slots',
  LIXI = 'lixi',
  SICBO = 'sicbo',
  TRANSACTION = 'transaction',
  ALL = 'all'
}