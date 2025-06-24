import { Command } from 'src/bot/base/commandRegister.decorator';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { CommandService } from 'src/bot/services/command.service';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { getRandomColor } from 'src/bot/utils/helps';
import { ButtonAction, MessageComponentType } from 'src/bot/constants/types';
import { ActionRowComponent, ButtonComponent } from 'src/bot/constants/interfaces';

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

    // Xử lý các subcommand: save, list, detail, update, delete, restore, find
    if (args.length === 0) {
      return this.showHelp(messageChannel);
    }

    const subCommand = args[0].toLowerCase();
    const remainingArgs = this.parseArgs(args.slice(1));

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
      return messageChannel.reply({
        t: `❌ Lỗi: ${error.message}`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `❌ Lỗi: ${error.message}`.length,
          },
        ],
      });
    }
  }

  private parseArgs(args: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    let currentKey = '';
    let currentValue = '';
    let inQuotes = false;

    for (const arg of args) {
      if (arg.startsWith('--')) {
        // Nếu đang trong dấu ngoặc kép thì tiếp tục với giá trị
        if (inQuotes) {
          currentValue += ' ' + arg;
          continue;
        }

        // Lưu key-value pair trước đó
        if (currentKey) {
          result[currentKey] = currentValue.trim();
        }

        // Bắt đầu key mới
        const keyParts = arg.substring(2).split('=');
        currentKey = keyParts[0];

        if (keyParts.length > 1) {
          currentValue = keyParts.slice(1).join('=');
          
          // Kiểm tra nếu bắt đầu với dấu ngoặc kép nhưng không kết thúc
          if (currentValue.startsWith('"') && !currentValue.endsWith('"')) {
            inQuotes = true;
            currentValue = currentValue.substring(1); // Bỏ dấu ngoặc kép mở
          } else if (currentValue.startsWith('"') && currentValue.endsWith('"')) {
            currentValue = currentValue.substring(1, currentValue.length - 1); // Bỏ cả hai dấu ngoặc kép
          }
        } else {
          currentValue = '';
        }
      } else {
        // Tiếp tục với phần giá trị
        if (currentValue) {
          if (inQuotes) {
            // Nếu đang trong dấu ngoặc kép
            currentValue += ' ' + arg;
            
            // Kiểm tra nếu kết thúc dấu ngoặc kép
            if (arg.endsWith('"')) {
              inQuotes = false;
              currentValue = currentValue.substring(0, currentValue.length - 1); // Bỏ dấu ngoặc kép đóng
            }
          } else {
            currentValue += ' ' + arg;
          }
        } else {
          currentValue = arg;
        }
      }
    }

    // Lưu key-value pair cuối cùng
    if (currentKey) {
      result[currentKey] = currentValue.trim();
    }

    return result;
  }

  private async showHelp(messageChannel: any): Promise<any> {
    return messageChannel.reply({
      t: '📚 Hướng dẫn sử dụng lệnh command:',
      embed: [
        {
          color: getRandomColor(),
          title: 'DevHelper - Command Help',
          description: 'Các lệnh quản lý command (lưu trữ lệnh):',
          fields: [
            {
              name: '*command save',
              value: 'Lưu lệnh mới\n' +
                    'Ví dụ: `*command save --title="git-stash" --command="git stash apply" --desc="Áp dụng stash gần nhất" --category="git" --parameters=\'{"branch":"Tên nhánh"}\' --examples=\'["git stash apply", "git stash apply stash@{1}"]\'`',
            },
            {
              name: '*command list',
              value: 'Liệt kê lệnh theo danh mục\n' +
                    'Ví dụ: `*command list --category="git"`',
            },
            {
              name: '*command detail',
              value: 'Xem chi tiết lệnh\n' +
                    'Ví dụ: `*command detail --id=125`',
            },
            {
              name: '*command update',
              value: 'Cập nhật lệnh\n' +
                    'Ví dụ: `*command update --id=125 --title="git-stash-apply" --desc="Áp dụng stash đã lưu"`',
            },
            {
              name: '*command delete',
              value: 'Xóa lệnh (soft delete)\n' +
                    'Ví dụ: `*command delete --id=125`',
            },
            {
              name: '*command restore',
              value: 'Khôi phục lệnh đã xóa\n' +
                    'Ví dụ: `*command restore --id=125`',
            },
            {
              name: '*command find',
              value: 'Tìm kiếm lệnh theo từ khóa\n' +
                    'Ví dụ: `*command find --query="git stash"`',
            },
          ],
          footer: {
            text: 'DevHelper Bot',
          },
        },
      ],
    });
  }

  private async handleSave(args: Record<string, string>, messageChannel: any): Promise<any> {
    // Kiểm tra các tham số bắt buộc
    const { title, command, desc, category, parameters, examples } = args;
    
    if (!title || !command || !category) {
      return messageChannel.reply({
        t: '❌ Thiếu thông tin: Vui lòng cung cấp --title, --command và --category.',
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: '❌ Thiếu thông tin: Vui lòng cung cấp --title, --command và --category.'.length,
          },
        ],
      });
    }

    // Parse parameters và examples nếu có
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
      return messageChannel.reply({
        t: `❌ Lỗi: Format JSON không hợp lệ cho parameters hoặc examples: ${error.message}`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `❌ Lỗi: Format JSON không hợp lệ cho parameters hoặc examples: ${error.message}`.length,
          },
        ],
      });
    }

    // Lưu lệnh vào database
    const newCommand = await this.commandService.create({
      title,
      command,
      description: desc || '',
      category,
      parameters: parsedParameters,
      examples: parsedExamples,
    });

    // Tạo phần hiển thị parameters nếu có
    let parametersText = '';
    if (Object.keys(parsedParameters).length > 0) {
      parametersText = '\nLệnh có ' + Object.keys(parsedParameters).length + ' tham số:\n';
      
      for (const [param, desc] of Object.entries(parsedParameters)) {
        parametersText += `• ${param}: ${desc}\n`;
      }
    }

    // Gửi thông báo thành công
    return messageChannel.reply({
      t: `✅ Đã lưu lệnh! ID: ${newCommand.id}\n${parametersText}\nSử dụng /command detail --id=${newCommand.id} để xem chi tiết.`,
      mk: [
        {
          type: EMarkdownType.PRE,
          s: 0,
          e: `✅ Đã lưu lệnh! ID: ${newCommand.id}\n${parametersText}\nSử dụng /command detail --id=${newCommand.id} để xem chi tiết.`.length,
        },
      ],
    });
  }

  private async handleList(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { category } = args;
    
    if (!category) {
      return messageChannel.reply({
        t: '❌ Thiếu thông tin: Vui lòng cung cấp --category.',
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: '❌ Thiếu thông tin: Vui lòng cung cấp --category.'.length,
          },
        ],
      });
    }

    // Lấy danh sách lệnh
    const commands = await this.commandService.listByCategory(category);
    
    if (commands.length === 0) {
      return messageChannel.reply({
        t: `📋 Không tìm thấy lệnh nào trong danh mục "${category}".`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `📋 Không tìm thấy lệnh nào trong danh mục "${category}".`.length,
          },
        ],
      });
    }

    // Tạo danh sách lệnh
    let listText = `📋 Danh sách lệnh trong danh mục "${category}":\n\n`;
    
    commands.forEach((cmd, index) => {
      listText += `${index + 1}. #${cmd.id}: ${cmd.title} - ${cmd.description || 'Không có mô tả'}\n`;
    });
    
    listText += '\n📌 Các lệnh bạn có thể dùng:\n';
    listText += `• /command detail --id=${commands[0].id}    (Xem chi tiết lệnh)\n`;
    listText += `• /command update --id=${commands[0].id}    (Cập nhật lệnh)\n`;
    listText += `• /command delete --id=${commands[0].id}    (Xóa lệnh)\n`;

    return messageChannel.reply({
      t: listText,
      mk: [
        {
          type: EMarkdownType.PRE,
          s: 0,
          e: listText.length,
        },
      ],
    } as any);
  }

  private async handleDetail(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { id } = args;
    
    if (!id || isNaN(parseInt(id))) {
      return messageChannel.reply({
        t: '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).',
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).'.length,
          },
        ],
      });
    }

    try {
      const command = await this.commandService.findById(parseInt(id));
      
      // Tạo chuỗi hiển thị tham số
      let parametersText = 'Không có';
      if (command.parameters && Object.keys(command.parameters).length > 0) {
        parametersText = '';
        for (const [param, desc] of Object.entries(command.parameters)) {
          parametersText += `• ${param}: ${desc}\n`;
        }
      }
      
      // Tạo chuỗi hiển thị ví dụ
      let examplesText = 'Không có';
      if (command.examples && command.examples.length > 0) {
        examplesText = '';
        for (const example of command.examples) {
          examplesText += `• ${example}\n`;
        }
      }
      
      // Tạo chuỗi hiển thị thời gian
      const createdAt = new Date(command.createdAt);
      const timeAgo = this.getTimeAgo(createdAt);

      return messageChannel.reply({
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
      } as any);
    } catch (error) {
      return messageChannel.reply({
        t: `❌ Lỗi: ${error.message}`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `❌ Lỗi: ${error.message}`.length,
          },
        ],
      });
    }
  }

  private async handleUpdate(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { id, title, command, desc, category, parameters, examples } = args;
    
    if (!id || isNaN(parseInt(id))) {
      return messageChannel.reply({
        t: '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).',
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).'.length,
          },
        ],
      });
    }

    try {
      // Kiểm tra lệnh có tồn tại không
      const existingCommand = await this.commandService.findById(parseInt(id));
      
      // Tạo object với các trường cần cập nhật
      const updateData: any = {};
      if (title) updateData.title = title;
      if (command) updateData.command = command;
      if (desc !== undefined) updateData.description = desc;
      if (category) updateData.category = category;
      
      // Parse parameters và examples nếu có
      if (parameters) {
        try {
          updateData.parameters = JSON.parse(parameters);
        } catch (error) {
          return messageChannel.reply({
            t: `❌ Lỗi: Format JSON không hợp lệ cho parameters: ${error.message}`,
            mk: [
              {
                type: EMarkdownType.PRE,
                s: 0,
                e: `❌ Lỗi: Format JSON không hợp lệ cho parameters: ${error.message}`.length,
              },
            ],
          });
        }
      }
      
      if (examples) {
        try {
          updateData.examples = JSON.parse(examples);
        } catch (error) {
          return messageChannel.reply({
            t: `❌ Lỗi: Format JSON không hợp lệ cho examples: ${error.message}`,
            mk: [
              {
                type: EMarkdownType.PRE,
                s: 0,
                e: `❌ Lỗi: Format JSON không hợp lệ cho examples: ${error.message}`.length,
              },
            ],
          });
        }
      }
      
      // Kiểm tra xem có gì để cập nhật không
      if (Object.keys(updateData).length === 0) {
        return messageChannel.reply({
          t: '❌ Không có thông tin nào để cập nhật.',
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: '❌ Không có thông tin nào để cập nhật.'.length,
            },
          ],
        });
      }
      
      // Cập nhật vào database
      await this.commandService.update(parseInt(id), updateData);
      
      // Lấy lệnh sau khi cập nhật
      const updatedCommand = await this.commandService.findById(parseInt(id));
      
      // So sánh và hiển thị các trường đã thay đổi
      let changesText = '';
      for (const key of Object.keys(updateData)) {
        let oldValue = existingCommand[key];
        let newValue = updatedCommand[key];
        
        // Format cho dễ đọc
        if (typeof oldValue === 'object') oldValue = JSON.stringify(oldValue);
        if (typeof newValue === 'object') newValue = JSON.stringify(newValue);
        
        changesText += `• ${key}: ${oldValue} ➔ ${newValue}\n`;
      }
      
      return messageChannel.reply({
        t: `✅ Đã cập nhật lệnh #${id}:\n\n${changesText}\nSử dụng /command detail --id=${id} để xem chi tiết.`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `✅ Đã cập nhật lệnh #${id}:\n\n${changesText}\nSử dụng /command detail --id=${id} để xem chi tiết.`.length,
          },
        ],
      } as any);
    } catch (error) {
      return messageChannel.reply({
        t: `❌ Lỗi: ${error.message}`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `❌ Lỗi: ${error.message}`.length,
          },
        ],
      });
    }
  }

  private async handleDelete(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { id } = args;
    
    if (!id || isNaN(parseInt(id))) {
      return messageChannel.reply({
        t: '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).',
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).'.length,
          },
        ],
      });
    }

    try {
      // Lấy thông tin lệnh trước khi xóa
      const command = await this.commandService.findById(parseInt(id));
      
      // Xóa mềm lệnh
      await this.commandService.softDelete(parseInt(id));
      
      return messageChannel.reply({
        t: `🗑️ Đã xóa lệnh #${id} "${command.title}"\nSử dụng /command restore --id=${id} để khôi phục.`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `🗑️ Đã xóa lệnh #${id} "${command.title}"\nSử dụng /command restore --id=${id} để khôi phục.`.length,
          },
        ],
      } as any);
    } catch (error) {
      return messageChannel.reply({
        t: `❌ Lỗi: ${error.message}`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `❌ Lỗi: ${error.message}`.length,
          },
        ],
      });
    }
  }

  private async handleRestore(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { id } = args;
    
    if (!id || isNaN(parseInt(id))) {
      return messageChannel.reply({
        t: '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).',
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --id (số).'.length,
          },
        ],
      });
    }

    try {
      // Khôi phục lệnh
      await this.commandService.restore(parseInt(id));
      
      // Lấy thông tin lệnh sau khi khôi phục
      const command = await this.commandService.findById(parseInt(id));

      return messageChannel.reply({
        t: `♻️ Đã khôi phục lệnh #${id} "${command.title}"\nSử dụng /command detail --id=${id} để xem chi tiết.`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `♻️ Đã khôi phục lệnh #${id} "${command.title}"\nSử dụng /command detail --id=${id} để xem chi tiết.`.length,
          },
        ],
      } as any);
    } catch (error) {
      return messageChannel.reply({
        t: `❌ Lỗi: ${error.message}`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `❌ Lỗi: ${error.message}`.length,
          },
        ],
      });
    }
  }

  private async handleFind(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { query } = args;
    
    if (!query) {
      return messageChannel.reply({
        t: '❌ Thiếu thông tin: Vui lòng cung cấp --query.',
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: '❌ Thiếu thông tin: Vui lòng cung cấp --query.'.length,
          },
        ],
      });
    }

    // Tìm kiếm lệnh
    const commands = await this.commandService.search(query);
    
    if (commands.length === 0) {
      return messageChannel.reply({
        t: `🔍 Không tìm thấy lệnh nào khớp với "${query}".`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `🔍 Không tìm thấy lệnh nào khớp với "${query}".`.length,
          },
        ],
      });
    }

    // Tạo danh sách lệnh tìm thấy
    let listText = `🔍 Tìm thấy ${commands.length} lệnh:\n`;
    
    commands.forEach((cmd, index) => {
      listText += `${index + 1}. #${cmd.id}: ${cmd.title} - ${cmd.description || 'Không có mô tả'}\n`;
    });
    
    listText += '\n📌 Để xem chi tiết, sử dụng:\n';
    commands.slice(0, 5).forEach(cmd => {
      listText += `• /command detail --id=${cmd.id}\n`;
    });

    return messageChannel.reply({
      t: listText,
      mk: [
        {
          type: EMarkdownType.PRE,
          s: 0,
          e: listText.length,
        },
      ],
    } as any);
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