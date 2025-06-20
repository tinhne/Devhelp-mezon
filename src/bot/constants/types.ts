export enum ButtonStyle {
  PRIMARY = 1,
  SECONDARY = 2,
  SUCCESS = 3,
  DANGER = 4,
  LINK = 5,

  // Để tương thích với code hiện tại
  BLUE = 1,
  GREY = 2,
  GREEN = 3,
  RED = 4,
}

export enum MessageComponentType {
  ACTION_ROW = 1,
  BUTTON = 2,
  SELECT_MENU = 3,
  TEXT_INPUT = 4,
}

export enum BugStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  CLOSED = 'closed',
}

export enum BugSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ButtonAction {
  VIEW = 'view',
  UPDATE = 'update',
  DELETE = 'delete',
  RESTORE = 'restore',
  CREATE = 'create',
  SUBMIT = 'submit',
  CANCEL = 'cancel',
  SEARCH = 'search',
  HELP = 'help',
}

// Tạo alias cho tương thích với mezon-sdk
export const EButtonMessageStyle = ButtonStyle;
export const EMessageComponentType = MessageComponentType;
