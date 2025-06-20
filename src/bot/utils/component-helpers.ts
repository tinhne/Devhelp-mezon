import { ButtonStyle, MessageComponentType, ButtonAction } from '../constants/types';
import { ActionRowComponent, ButtonComponent } from '../constants/interfaces';

/**
 * Tạo button component
 */
export function createButton(
  style: ButtonStyle,
  label: string,
  customId: string,
  disabled = false
): ButtonComponent {
  return {
    type: MessageComponentType.BUTTON,
    style,
    label,
    custom_id: customId,
    disabled,
  };
}

/**
 * Tạo action row với các button
 */
export function createActionRow(buttons: ButtonComponent[]): ActionRowComponent {
  return {
    type: MessageComponentType.ACTION_ROW,
    components: buttons,
  };
}

/**
 * Tạo view button cho một item
 */
export function createViewButton(type: 'command' | 'bug' | 'solution', id: number): ButtonComponent {
  return createButton(
    type === 'command' ? ButtonStyle.BLUE : type === 'bug' ? ButtonStyle.RED : ButtonStyle.GREEN,
    `Xem #${id}`,
    `${ButtonAction.VIEW}:${type}:${id}`
  );
}

/**
 * Tạo update button cho một item
 */
export function createUpdateButton(type: 'command' | 'bug' | 'solution', id: number): ButtonComponent {
  return createButton(
    ButtonStyle.GREEN,
    `Cập Nhật ${type === 'command' ? 'Lệnh' : type === 'bug' ? 'Bug' : 'Giải Pháp'}`,
    `${ButtonAction.UPDATE}:${type}:${id}`
  );
}

/**
 * Tạo delete button cho một item
 */
export function createDeleteButton(type: 'command', id: number, isDeleted: boolean): ButtonComponent {
  return createButton(
    ButtonStyle.RED,
    isDeleted ? 'Khôi Phục' : 'Xóa',
    isDeleted ? `${ButtonAction.RESTORE}:${type}:${id}` : `${ButtonAction.DELETE}:${type}:${id}`
  );
}

/**
 * Tạo một nhóm các button (action row) theo grid
 * @param buttons Mảng các button
 * @param buttonsPerRow Số button trên mỗi hàng
 */
export function createButtonGrid(buttons: ButtonComponent[], buttonsPerRow = 3): ActionRowComponent[] {
  const rows: ActionRowComponent[] = [];
  
  for (let i = 0; i < buttons.length; i += buttonsPerRow) {
    const rowButtons = buttons.slice(i, i + buttonsPerRow);
    rows.push(createActionRow(rowButtons));
  }
  
  return rows;
}