import { ChannelMessage } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { getRandomColor } from 'src/bot/utils/helps';
import { ButtonStyle } from 'src/bot/constants/types';
import { createButton, createActionRow } from 'src/bot/utils/component-helpers';
import { safeReply } from 'src/bot/utils/reply-helpers';

@Command('help')
export class HelpCommand extends CommandMessage {
  constructor(clientService: MezonClientService) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage): Promise<any> {
  const messageChannel = await this.getChannelMessage(message);
  if (!messageChannel) return;

  return safeReply(messageChannel, {
    embed: [
      {
        color: getRandomColor(),
        title: '🤖 DevHelper Bot - Hướng dẫn sử dụng',
        description: 'Bot hỗ trợ lập trình viên lưu trữ và tìm kiếm các lệnh, ghi nhận bugs và giải pháp.',
        fields: [
          {
            name: '📝 Quản lý lệnh',
            value: '• `*command save` - Lưu lệnh mới\n' +
                  '• `*command list` - Xem danh sách lệnh theo danh mục\n' +
                  '• `*command detail` - Xem chi tiết lệnh\n' +
                  '• `*command find` - Tìm kiếm lệnh theo từ khóa\n' +
                  '• `*command update` - Cập nhật lệnh\n' +
                  '• `*command delete` - Xóa lệnh\n' +
                  '• `*command restore` - Khôi phục lệnh đã xóa',
          },
          {
            name: '🐛 Quản lý bug',
            value: '• `*bug create` - Báo cáo bug mới\n' +
                  '• `*bug list` - Xem danh sách bug theo trạng thái\n' +
                  '• `*bug detail` - Xem chi tiết bug\n' +
                  '• `*bug update` - Cập nhật thông tin bug',
          },
          {
            name: '💡 Quản lý giải pháp',
            value: '• `*solution create` - Thêm giải pháp cho bug\n' +
                  '• `*solution list` - Xem danh sách giải pháp theo bug\n' +
                  '• `*solution detail` - Xem chi tiết giải pháp\n' +
                  '• `*solution update` - Cập nhật giải pháp',
          },
          {
            name: '🔍 Tìm kiếm',
            value: '• `*search` - Tìm kiếm đa loại (lệnh, bug, giải pháp)\n' +
                  '• `*search commands` - Tìm kiếm chỉ các lệnh\n' +
                  '• `*search bugs` - Tìm kiếm chỉ các bug\n' +
                  '• `*search solutions` - Tìm kiếm chỉ các giải pháp',
          },
          {
            name: '🤖 Quản lý Bot',
            value: '• `*bot status` - Xem trạng thái hiện tại của bot\n' +
                  '• `*bot deactivate` / `*bot off` - Tắt bot tạm thời\n' +
                  '• `*bot activate` / `*bot on` - Kích hoạt lại bot\n' +
                  '• `*bot reset` - Khởi động lại bot\n\n' +
                  '• `*activate` - Kích hoạt trực tiếp\n' +
                  '• `*deactivate` - Tắt bot trực tiếp\n' +
                  '• `*botstatus` - Kiểm tra trạng thái',
          },
          {
            name: '🔧 Các lệnh khác',
            value: '• `*ping` - Kiểm tra kết nối bot\n' +
                  '• `*help` - Hiển thị hướng dẫn này',
          },
          {
            name: '❓ Cách sử dụng',
            value: '• Gõ tên lệnh không có tham số để xem hướng dẫn chi tiết\n  (VD: `*command`)\n\n' +
                  '• Dùng cú pháp tham số `--name="value"` khi thực hiện lệnh\n\n' +
                  '• Với JSON, dùng ngoặc đơn bên ngoài:\n  `--parameters=\'{"key":"value"}\'`\n\n' +
                  '• Với mảng:\n  `--examples=\'["example1","example2"]\'`',
          },
        ],
        footer: {
          text: 'DevHelper Bot v1.0.0',
        },
      },
    ],
  });
}
}