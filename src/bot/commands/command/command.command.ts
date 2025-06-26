import { Command } from 'src/bot/base/commandRegister.decorator';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { ChannelMessage } from 'mezon-sdk';
import { CommandService } from 'src/bot/services/command.service';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { getRandomColor } from 'src/bot/utils/helps';
import { ButtonAction, MessageComponentType } from 'src/bot/constants/types';
import { ActionRowComponent, ButtonComponent } from 'src/bot/constants/interfaces';
import { parseArgs } from 'src/bot/utils/parse-args';
import { safeReply, createReplyOptions, createPreMarkdown } from 'src/bot/utils/reply-helpers';

@Command('command')
export class CommandBotCommand extends CommandMessage {
  constructor(
    private commandService: CommandService,
    clientService: MezonClientService,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage): Promise<any> {
    const messageChannel = await this.getChannelMessage(message);
    if (!messageChannel) return;

    if (args.length === 0) {
      return this.showHelp(messageChannel);
    }

    const subCommand = args[0].toLowerCase();
    const remainingArgs = parseArgs(args.slice(1));

    try {
      switch (subCommand) {
        case 'save':
          return this.handleSave(remainingArgs, messageChannel);
        case 'list':
          return this.handleList(remainingArgs, messageChannel);
        case 'detail':
          return this.handleDetail(remainingArgs, messageChannel);
        case 'update':
          return this.handleUpdate(remainingArgs, messageChannel);
        case 'delete':
          return this.handleDelete(remainingArgs, messageChannel);
        case 'restore':
          return this.handleRestore(remainingArgs, messageChannel);
        case 'find':
          return this.handleFind(remainingArgs, messageChannel);
        default:
          return this.showHelp(messageChannel);
      }
    } catch (error) {
      console.error('Error in CommandCommand:', error);
      return safeReply(
        messageChannel,
        createReplyOptions(
          `❌ Lỗi: ${error.message}`,
          createPreMarkdown(`❌ Lỗi: ${error.message}`)
        )
      );
    }
  }

  private async showHelp(messageChannel: any): Promise<any> {
    return safeReply(messageChannel, {
      t: '📚 Hướng dẫn sử dụng lệnh command',
      embed: [
        {
          color: getRandomColor(),
          title: 'DevHelper - Command Help',
          description: 'Công cụ giúp bạn lưu trữ và quản lý các lệnh thường dùng:',
          fields: [
            {
              name: '1️⃣ Xem danh sách lệnh',
              value: '*command list --category="git"\n\nLiệt kê các lệnh trong danh mục (VD: git, docker).'
            },
            {
              name: '2️⃣ Tìm kiếm lệnh',
              value: '*command find --query="stash"\n\nTìm các lệnh liên quan đến từ khóa.'
            },
            {
              name: '3️⃣ Xem chi tiết lệnh',
              value: '*command detail --id=125\n\nHiển thị đầy đủ thông tin của lệnh có ID 125.'
            },
            {
              name: '4️⃣ Lưu lệnh mới',
              value: '*command save --title="git-stash" --command="git stash" --desc="Lưu thay đổi tạm thời" --category="git"\n\nThêm lệnh mới với tham số cơ bản.'
            },
            {
              name: '5️⃣ Lưu lệnh với tham số và ví dụ',
              value: '*command save --title="git-stash" --command="git stash" --category="git" --parameters=\'{"branch":"Tên nhánh"}\' --examples=\'["git stash apply"]\'\n\nLưu ý định dạng JSON đặc biệt cho parameters và examples.'
            },
            {
              name: '6️⃣ Quản lý lệnh đã lưu',
              value: '*command update --id=125 --title="Tên mới"\n*command delete --id=125\n*command restore --id=125\n\nCập nhật, xóa hoặc khôi phục lệnh theo ID.'
            },
            {
              name: '📝 Lưu ý quan trọng',
              value: '• Tham số bắt buộc khi tạo mới: `--title`, `--command` và `--category`\n\n' +
                '• Với JSON, dùng ngoặc đơn bên ngoài, ngoặc kép bên trong: `\'{"key":"value"}\'`\n\n' +
                '• Dùng `*command list` trước để biết ID các lệnh cần quản lý'
            }
          ],
          footer: {
            text: 'Gõ *command hoặc *command help để hiển thị hướng dẫn này',
          },
        },
      ],
    });
  }

  private async handleSave(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { title, command, desc, category, parameters, examples } = args;

    if (!title || !command || !category) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          '❌ Thiếu thông tin: Vui lòng cung cấp --title, --command và --category.',
          createPreMarkdown('❌ Thiếu thông tin: Vui lòng cung cấp --title, --command và --category.')
        )
      );
    }

    let parsedParameters = {};
    let parsedExamples = [];

    try {
      if (parameters) {
        parsedParameters = JSON.parse(parameters);
      }
      if (examples) {
        parsedExamples = JSON.parse(examples);
      }
    } catch (error) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          `❌ Lỗi: Format JSON không hợp lệ cho parameters hoặc examples: ${error.message}`,
          createPreMarkdown(`❌ Lỗi: Format JSON không hợp lệ cho parameters hoặc examples: ${error.message}`)
        )
      );
    }

    const newCommand = await this.commandService.create({
      title,
      command,
      description: desc || '',
      category,
      parameters: parsedParameters,
      examples: parsedExamples,
    });

    let parametersText = '';
    if (Object.keys(parsedParameters).length > 0) {
      parametersText = '\nLệnh có ' + Object.keys(parsedParameters).length + ' tham số:\n';
      for (const [param, desc] of Object.entries(parsedParameters)) {
        parametersText += `• ${param}: ${desc}\n`;
      }
    }

    return safeReply(
      messageChannel,
      createReplyOptions(
        `✅ Đã lưu lệnh! ID: ${newCommand.id}\n${parametersText}\nSử dụng /command detail --id=${newCommand.id} để xem chi tiết.`,
        createPreMarkdown(`✅ Đã lưu lệnh! ID: ${newCommand.id}\n${parametersText}\nSử dụng /command detail --id=${newCommand.id} để xem chi tiết.`)
      )
    );
  }

  private async handleList(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { category } = args;

    if (!category) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          '❌ Thiếu thông tin: Vui lòng cung cấp --category.',
          createPreMarkdown('❌ Thiếu thông tin: Vui lòng cung cấp --category.')
        )
      );
    }

    const commands = await this.commandService.listByCategory(category);

    if (commands.length === 0) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          `📋 Không tìm thấy lệnh nào trong danh mục "${category}".`,
          createPreMarkdown(`📋 Không tìm thấy lệnh nào trong danh mục "${category}".`)
        )
      );
    }

    let listText = `📋 Danh sách lệnh trong danh mục "${category}":\n\n`;

    commands.forEach((cmd, index) => {
      listText += `${index + 1}. #${cmd.id}: ${cmd.title} - ${cmd.description || 'Không có mô tả'}\n`;
    });

    listText += '\n📌 Các lệnh bạn có thể dùng:\n';
    listText += `• /command detail --id=${commands[0].id}    (Xem chi tiết lệnh)\n`;
    listText += `• /command update --id=${commands[0].id}    (Cập nhật lệnh)\n`;
    listText += `• /command delete --id=${commands[0].id}    (Xóa lệnh)\n`;

    return safeReply(
      messageChannel,
      createReplyOptions(
        listText,
        createPreMarkdown(listText)
      )
    );
  }

  private async handleDetail(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { id } = args;

    if (!id || isNaN(parseInt(id))) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).',
          createPreMarkdown('❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).')
        )
      );
    }

    try {
      const command = await this.commandService.findById(parseInt(id));

      let parametersText = 'Không có';
      if (command.parameters && Object.keys(command.parameters).length > 0) {
        parametersText = '';
        for (const [param, desc] of Object.entries(command.parameters)) {
          parametersText += `• ${param}: ${desc}\n`;
        }
      }

      let examplesText = 'Không có';
      if (command.examples && command.examples.length > 0) {
        examplesText = '';
        for (const example of command.examples) {
          examplesText += `• ${example}\n`;
        }
      }

      const createdAt = new Date(command.createdAt);
      const timeAgo = this.getTimeAgo(createdAt);

      return safeReply(
        messageChannel,
        {
          embed: [
            {
              color: getRandomColor(),
              title: `📝 Command #${command.id}: "${command.title}"`,
              fields: [
                {
                  name: 'Danh mục',
                  value: command.category,
                },
                {
                  name: 'Mô tả',
                  value: command.description || '*(Không có mô tả)*',
                },
                {
                  name: 'Lệnh',
                  value: '```\n' + command.command + '\n```',
                },
                {
                  name: 'Tham số',
                  value: parametersText,
                },
                {
                  name: 'Ví dụ',
                  value: examplesText,
                },
                {
                  name: 'Trạng thái',
                  value: command.deleted ? '🗑️ Đã xóa' : '✅ Hoạt động',
                },
                {
                  name: 'Đã tạo',
                  value: `${createdAt.toLocaleString()} (${timeAgo})`,
                },
              ],
              footer: {
                text: 'DevHelper Bot',
              },
            },
          ],
        }
      );
    } catch (error) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          `❌ Lỗi: ${error.message}`,
          createPreMarkdown(`❌ Lỗi: ${error.message}`)
        )
      );
    }
  }

  private async handleUpdate(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { id, title, command, desc, category, parameters, examples } = args;

    if (!id || isNaN(parseInt(id))) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).',
          createPreMarkdown('❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).')
        )
      );
    }

    try {
      const existingCommand = await this.commandService.findById(parseInt(id));

      const updateData: any = {};
      if (title) updateData.title = title;
      if (command) updateData.command = command;
      if (desc !== undefined) updateData.description = desc;
      if (category) updateData.category = category;

      if (parameters) {
        try {
          updateData.parameters = JSON.parse(parameters);
        } catch (error) {
          return safeReply(
            messageChannel,
            createReplyOptions(
              `❌ Lỗi: Format JSON không hợp lệ cho parameters: ${error.message}`,
              createPreMarkdown(`❌ Lỗi: Format JSON không hợp lệ cho parameters: ${error.message}`)
            )
          );
        }
      }

      if (examples) {
        try {
          updateData.examples = JSON.parse(examples);
        } catch (error) {
          return safeReply(
            messageChannel,
            createReplyOptions(
              `❌ Lỗi: Format JSON không hợp lệ cho examples: ${error.message}`,
              createPreMarkdown(`❌ Lỗi: Format JSON không hợp lệ cho examples: ${error.message}`)
            )
          );
        }
      }

      if (Object.keys(updateData).length === 0) {
        return safeReply(
          messageChannel,
          createReplyOptions(
            '❌ Không có thông tin nào để cập nhật.',
            createPreMarkdown('❌ Không có thông tin nào để cập nhật.')
          )
        );
      }

      await this.commandService.update(parseInt(id), updateData);

      const updatedCommand = await this.commandService.findById(parseInt(id));

      let changesText = '';
      for (const key of Object.keys(updateData)) {
        let oldValue = existingCommand[key];
        let newValue = updatedCommand[key];

        if (typeof oldValue === 'object') oldValue = JSON.stringify(oldValue);
        if (typeof newValue === 'object') newValue = JSON.stringify(newValue);

        changesText += `• ${key}: ${oldValue} ➔ ${newValue}\n`;
      }

      return safeReply(
        messageChannel,
        createReplyOptions(
          `✅ Đã cập nhật lệnh #${id}:\n\n${changesText}\nSử dụng /command detail --id=${id} để xem chi tiết.`,
          createPreMarkdown(`✅ Đã cập nhật lệnh #${id}:\n\n${changesText}\nSử dụng /command detail --id=${id} để xem chi tiết.`)
        )
      );
    } catch (error) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          `❌ Lỗi: ${error.message}`,
          createPreMarkdown(`❌ Lỗi: ${error.message}`)
        )
      );
    }
  }

  private async handleDelete(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { id } = args;

    if (!id || isNaN(parseInt(id))) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).',
          createPreMarkdown('❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).')
        )
      );
    }

    try {
      const command = await this.commandService.findById(parseInt(id));
      await this.commandService.softDelete(parseInt(id));

      return safeReply(
        messageChannel,
        createReplyOptions(
          `🗑️ Đã xóa lệnh #${id} "${command.title}"\nSử dụng /command restore --id=${id} để khôi phục.`,
          createPreMarkdown(`🗑️ Đã xóa lệnh #${id} "${command.title}"\nSử dụng /command restore --id=${id} để khôi phục.`)
        )
      );
    } catch (error) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          `❌ Lỗi: ${error.message}`,
          createPreMarkdown(`❌ Lỗi: ${error.message}`)
        )
      );
    }
  }

  private async handleRestore(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { id } = args;

    if (!id || isNaN(parseInt(id))) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).',
          createPreMarkdown('❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).')
        )
      );
    }

    try {
      await this.commandService.restore(parseInt(id));
      const command = await this.commandService.findById(parseInt(id));

      return safeReply(
        messageChannel,
        createReplyOptions(
          `♻️ Đã khôi phục lệnh #${id} "${command.title}"\nSử dụng /command detail --id=${id} để xem chi tiết.`,
          createPreMarkdown(`♻️ Đã khôi phục lệnh #${id} "${command.title}"\nSử dụng /command detail --id=${id} để xem chi tiết.`)
        )
      );
    } catch (error) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          `❌ Lỗi: ${error.message}`,
          createPreMarkdown(`❌ Lỗi: ${error.message}`)
        )
      );
    }
  }

  private async handleFind(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { query } = args;

    if (!query) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          '❌ Thiếu thông tin: Vui lòng cung cấp --query.',
          createPreMarkdown('❌ Thiếu thông tin: Vui lòng cung cấp --query.')
        )
      );
    }

    const commands = await this.commandService.search(query);

    if (commands.length === 0) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          `🔍 Không tìm thấy lệnh nào khớp với "${query}".`,
          createPreMarkdown(`🔍 Không tìm thấy lệnh nào khớp với "${query}".`)
        )
      );
    }

    let listText = `🔍 Tìm thấy ${commands.length} lệnh:\n`;

    commands.forEach((cmd, index) => {
      listText += `${index + 1}. #${cmd.id}: ${cmd.title} - ${cmd.description || 'Không có mô tả'}\n`;
    });

    listText += '\n📌 Để xem chi tiết, sử dụng:\n';
    commands.slice(0, 5).forEach(cmd => {
      listText += `• /command detail --id=${cmd.id}\n`;
    });

    return safeReply(
      messageChannel,
      createReplyOptions(
        listText,
        createPreMarkdown(listText)
      )
    );
  }

  // Helper để tính thời gian tương đối
  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
      return interval === 1 ? "1 năm trước" : `${interval} năm trước`;
    }

    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
      return interval === 1 ? "1 tháng trước" : `${interval} tháng trước`;
    }

    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
      return interval === 1 ? "1 ngày trước" : `${interval} ngày trước`;
    }

    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
      return interval === 1 ? "1 giờ trước" : `${interval} giờ trước`;
    }

    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
      return interval === 1 ? "1 phút trước" : `${interval} phút trước`;
    }

    return Math.floor(seconds) === 0 ? "vừa xong" : `${Math.floor(seconds)} giây trước`;
  }
}