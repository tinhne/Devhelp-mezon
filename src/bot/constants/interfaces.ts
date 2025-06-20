import { ButtonStyle, MessageComponentType } from './types';

// Interface cho Button Component
export interface ButtonComponent {
  type: MessageComponentType.BUTTON;
  style: ButtonStyle;
  label: string;
  custom_id: string;
  disabled?: boolean;
  url?: string;
  emoji?: {
    id?: string;
    name?: string;
    animated?: boolean;
  };
}

// Interface cho ActionRow Component
export interface ActionRowComponent {
  type: MessageComponentType.ACTION_ROW;
  components: (ButtonComponent | SelectMenuComponent | TextInputComponent)[];
}

// Interface cho SelectMenu Component
export interface SelectMenuComponent {
  type: MessageComponentType.SELECT_MENU;
  custom_id: string;
  options: {
    label: string;
    value: string;
    description?: string;
    emoji?: {
      id?: string;
      name?: string;
      animated?: boolean;
    };
    default?: boolean;
  }[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  disabled?: boolean;
}

// Interface cho TextInput Component
export interface TextInputComponent {
  type: MessageComponentType.TEXT_INPUT;
  custom_id: string;
  style: number;
  label: string;
  min_length?: number;
  max_length?: number;
  required?: boolean;
  value?: string;
  placeholder?: string;
}

// Interface tổng thể cho Message Components
export type MessageComponent = ActionRowComponent | ButtonComponent | SelectMenuComponent | TextInputComponent;

// Interface cho MessageReplyOptions
export interface MessageReplyOptions {
  t?: string;
  mk?: any[];
  components?: ActionRowComponent[];
  embed?: any[];
}