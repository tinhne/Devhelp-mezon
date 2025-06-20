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

    // Tạo các button hướng dẫn
    const helpButtons = [
      createButton(ButtonStyle.BLUE, 'Hướng dẫn Command', 'help:command'),
      createButton(ButtonStyle.RED, 'Hướng dẫn Bug', 'help:bug'),
      createButton(ButtonStyle.GREEN, 'Hướng dẫn Solution', 'help:solution'),
      createButton(ButtonStyle.GREY, 'Hướng dẫn Bot', 'help:bot'),
    ];

    const buttonRow = createActionRow(helpButtons);

    return safeReply(messageChannel, {
      embed: [
        {
          color: getRandomColor(),
          title: '🤖 DevHelper Bot - Hướng dẫn sử dụng',
          description: 'Bot hỗ trợ lập trình viên lưu trữ và tìm kiếm các lệnh, ghi nhận bugs và giải pháp.',
          fields: [
            {
              name: '📝 Quản lý lệnh',
              value: '`*command save` - Lưu lệnh mới\n' +
                    '`*command list` - Xem danh sách lệnh theo danh mục\n' +
                    '`*command detail` - Xem chi tiết lệnh\n' +
                    '`*command find` - Tìm kiếm lệnh theo từ khóa\n' +
                    '`*command update` - Cập nhật lệnh\n' +
                    '`*command delete` - Xóa lệnh\n' +
                    '`*command restore` - Khôi phục lệnh đã xóa',
            },
            {
              name: '🐛 Quản lý bug',
              value: '`*bug create` - Báo cáo bug mới\n' +
                    '`*bug list` - Xem danh sách bug theo trạng thái\n' +
                    '`*bug detail` - Xem chi tiết bug\n' +
                    '`*bug update` - Cập nhật thông tin bug',
            },
            {
              name: '💡 Quản lý giải pháp',
              value: '`*solution create` - Thêm giải pháp cho bug\n' +
                    '`*solution list` - Xem danh sách giải pháp cho bug\n' +
                    '`*solution detail` - Xem chi tiết giải pháp\n' +
                    '`*solution update` - Cập nhật giải pháp',
            },
            {
              name: '🔍 Tìm kiếm',
              value: '`*search` - Tìm kiếm đa loại (lệnh, bug, giải pháp)\n' +
                    '`*search bugs` - Tìm kiếm bugs với solutions\n' +
                    '`*search solutions` - Tìm kiếm giải pháp',
            },
            {
              name: '🔧 Quản lý Bot',
              value: '`*bot status` - Xem trạng thái hiện tại của bot\n' +
                    '`*bot deactivate` - Tắt bot tạm thời\n' +
                    '`*bot activate` - Kích hoạt lại bot\n' +
                    '`*bot reset` - Khởi động lại bot\n' +
                    '`*activate` - Kích hoạt trực tiếp\n' +
                    '`*deactivate` - Tắt bot trực tiếp\n' +
                    '`*botstatus` - Kiểm tra trạng thái',
            },
            {
              name: '🧪 Khác',
              value: '`*ping` - Kiểm tra kết nối bot\n' +
                    '`*help` - Xem hướng dẫn này',
            },
            {
              name: '❓ Cách sử dụng',
              value: 'Gõ `*help` để xem hướng dẫn này\n' +
                    'Mỗi lệnh có subcommand riêng, ví dụ: `*command save`\n' +
                    'Dùng cú pháp tham số `--name="value"` khi thực hiện lệnh\n' +
                    'Với trường JSON, dùng dấu ngoặc đơn bên ngoài và dấu ngoặc kép bên trong:\n' +
                    '`--environment={"os": "Ubuntu", "browser": "Chrome"}`',
            },
          ],
          footer: {
            text: 'DevHelper Bot v1.0.0',
          },
        },
      ],
      components: [buttonRow],
    });
  }
}