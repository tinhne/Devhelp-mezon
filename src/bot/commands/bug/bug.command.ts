import { Command } from 'src/bot/base/commandRegister.decorator';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { BugService } from 'src/bot/services/bug.service';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { getRandomColor } from 'src/bot/utils/helps';
import { ButtonAction, ButtonStyle, MessageComponentType, BugStatus, BugSeverity } from 'src/bot/constants/types';
import { ActionRowComponent, ButtonComponent } from 'src/bot/constants/interfaces';

@Command('bug')
export class BugCommand extends CommandMessage {
  constructor(
    private bugService: BugService,
    clientService: MezonClientService,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage): Promise<any> {
    const messageChannel = await this.getChannelMessage(message);
    if (!messageChannel) return;

    // Xử lý các subcommand: create, list, detail, update
    if (args.length === 0) {
      return this.showHelp(messageChannel);
    }

    const subCommand = args[0].toLowerCase();
    const remainingArgs = this.parseArgs(args.slice(1));

    try {
      switch (subCommand) {
        case 'create':
          return this.handleCreate(remainingArgs, messageChannel);
        case 'list':
          return this.handleList(remainingArgs, messageChannel);
        case 'detail':
          return this.handleDetail(remainingArgs, messageChannel);
        case 'update':
          return this.handleUpdate(remainingArgs, messageChannel);
        default:
          return this.showHelp(messageChannel);
      }
    } catch (error) {
      console.error('Error in BugCommand:', error);
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
      t: '🐛 Hướng dẫn sử dụng lệnh bug:',
      embed: [
        {
          color: getRandomColor(),
          title: 'DevHelper - Bug Help',
          description: 'Các lệnh quản lý bug:',
          fields: [
            {
              name: '*bug create',
              value: 'Báo cáo bug mới\n' +
                    'Ví dụ: `*bug create --title="JWT token không refresh" --desc="Token mới không được tạo khi token cũ hết hạn" --severity="high" --steps="1. Đăng nhập\\n2. Đợi token hết hạn\\n3. Thực hiện API call" --environment=\'{"os": "Ubuntu 22.04", "browser": "Chrome 118"}\'`',
            },
            {
              name: '*bug list',
              value: 'Liệt kê bug theo trạng thái\n' +
                    'Ví dụ: `/bug list --status="open"` (open, in_progress, closed)',
            },
            {
              name: '*bug detail',
              value: 'Xem chi tiết bug\n' +
                    'Ví dụ: `*bug detail --id=47`',
            },
            {
              name: '*bug update',
              value: 'Cập nhật thông tin bug\n' +
                    'Ví dụ: `*bug update --id=47 --status="in_progress" --severity="high" --title="Tiêu đề mới" --desc="Mô tả mới"`',
            },
          ],
          footer: {
            text: 'DevHelper Bot',
          },
        },
      ],
    });
  }

  private async handleCreate(args: Record<string, string>, messageChannel: any): Promise<any> {
    // Kiểm tra các tham số bắt buộc
    const { title, desc, severity, steps, environment } = args;
    
    if (!title) {
      return messageChannel.reply({
        t: '❌ Thiếu thông tin: Vui lòng cung cấp --title.',
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: '❌ Thiếu thông tin: Vui lòng cung cấp --title.'.length,
          },
        ],
      });
    }

    // Validate severity nếu có
    if (severity && !Object.values(BugSeverity).includes(severity as BugSeverity)) {
      return messageChannel.reply({
        t: `❌ Mức độ nghiêm trọng không hợp lệ. Vui lòng sử dụng một trong các giá trị: ${Object.values(BugSeverity).join(', ')}.`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `❌ Mức độ nghiêm trọng không hợp lệ. Vui lòng sử dụng một trong các giá trị: ${Object.values(BugSeverity).join(', ')}.`.length,
          },
        ],
      });
    }

    // Parse environment nếu có
    let parsedEnvironment = {};
    if (environment) {
      try {
        parsedEnvironment = JSON.parse(environment);
      } catch (error) {
        return messageChannel.reply({
          t: `❌ Lỗi: Format JSON không hợp lệ cho environment: ${error.message}`,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: `❌ Lỗi: Format JSON không hợp lệ cho environment: ${error.message}`.length,
            },
          ],
        });
      }
    }

    // Lưu bug vào database
    const newBug = await this.bugService.create({
      title,
      description: desc || '',
      severity: severity as BugSeverity || BugSeverity.MEDIUM,
      steps: steps || '',
      environment: parsedEnvironment,
      status: BugStatus.OPEN,
    });

    // Hiển thị các thông tin về environment nếu có
    let environmentText = '';
    if (Object.keys(parsedEnvironment).length > 0) {
      environmentText = '\nMôi trường:\n';
      for (const [key, value] of Object.entries(parsedEnvironment)) {
        environmentText += `• ${key}: ${value}\n`;
      }
    }

    // Gửi thông báo thành công
    return messageChannel.reply({
      t: `✅ Đã báo cáo bug! ID: ${newBug.id}\nMức độ: ${newBug.severity}\nTrạng thái: ${newBug.status}${environmentText}\nSử dụng /bug detail --id=${newBug.id} để xem chi tiết.`,
      mk: [
        {
          type: EMarkdownType.PRE,
          s: 0,
          e: `✅ Đã báo cáo bug! ID: ${newBug.id}\nMức độ: ${newBug.severity}\nTrạng thái: ${newBug.status}${environmentText}\nSử dụng /bug detail --id=${newBug.id} để xem chi tiết.`.length,
        },
      ],
    });
  }

  private async handleList(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { status } = args;
    
    if (!status || !Object.values(BugStatus).includes(status as BugStatus)) {
      return messageChannel.reply({
        t: `❌ Thiếu hoặc không hợp lệ: Vui lòng cung cấp --status với một trong các giá trị: ${Object.values(BugStatus).join(', ')}.`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `❌ Thiếu hoặc không hợp lệ: Vui lòng cung cấp --status với một trong các giá trị: ${Object.values(BugStatus).join(', ')}.`.length,
          },
        ],
      });
    }

    // Lấy danh sách bug theo trạng thái
    const bugs = await this.bugService.listByStatus(status as BugStatus);
    
    if (bugs.length === 0) {
      return messageChannel.reply({
        t: `📋 Không tìm thấy bug nào ở trạng thái "${status}".`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `📋 Không tìm thấy bug nào ở trạng thái "${status}".`.length,
          },
        ],
      });
    }

    // Tạo danh sách bug
    let listText = `📋 Danh sách bug ở trạng thái "${status}":\n\n`;
    
    bugs.forEach((bug, index) => {
      const solutionCount = bug.solutions ? bug.solutions.length : 0;
      listText += `${index + 1}. #${bug.id}: ${bug.title} - ${bug.severity}${solutionCount > 0 ? ` (${solutionCount} giải pháp)` : ''}\n`;
    });
    
    listText += '\n📌 Các lệnh bạn có thể dùng:\n';
    listText += `• /bug detail --id=${bugs[0].id}    (Xem chi tiết bug)\n`;
    listText += `• /bug update --id=${bugs[0].id} --status="in_progress"    (Cập nhật trạng thái)\n`;
    listText += `• /solution create --bug-id=${bugs[0].id}    (Thêm giải pháp)\n`;

    // Tạo các button để xem chi tiết
    const buttons: ButtonComponent[] = [];
    for (let i = 0; i < Math.min(5, bugs.length); i++) {
      buttons.push({
        type: MessageComponentType.BUTTON,
        style: ButtonStyle.RED,
        label: `Xem Chi Tiết #${bugs[i].id}`,
        custom_id: `${ButtonAction.VIEW}:bug:${bugs[i].id}`,
      } as ButtonComponent);
    }

    const actionRow: ActionRowComponent = {
      type: MessageComponentType.ACTION_ROW,
      components: buttons,
    } as ActionRowComponent;

    return messageChannel.reply({
      t: listText,
      mk: [
        {
          type: EMarkdownType.PRE,
          s: 0,
          e: listText.length,
        },
      ],
      components: [actionRow],
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
      const bug = await this.bugService.findById(parseInt(id));
      
      // Tạo chuỗi hiển thị environment
      let environmentText = 'Không có';
      if (bug.environment && Object.keys(bug.environment).length > 0) {
        environmentText = Object.entries(bug.environment)
          .map(([key, value]) => `• ${key}: ${value}`)
          .join('\n');
      }
      
      // Tạo chuỗi hiển thị solutions
      let solutionsText = 'Chưa có giải pháp';
      if (bug.solutions && bug.solutions.length > 0) {
        solutionsText = bug.solutions.map((solution) => 
          `• #${solution.id}: ${solution.title}`
        ).join('\n');
      }
      
      // Tạo các button cho actions
      const buttons: ButtonComponent[] = [
        {
          type: MessageComponentType.BUTTON,
          style: ButtonStyle.GREEN,
          label: 'Cập Nhật Bug',
          custom_id: `${ButtonAction.UPDATE}:bug:${bug.id}`,
        } as ButtonComponent,
        {
          type: MessageComponentType.BUTTON,
          style: ButtonStyle.BLUE,
          label: 'Thêm Giải Pháp',
          custom_id: `${ButtonAction.CREATE}:solution:${bug.id}`,
        } as ButtonComponent,
      ];
      
      const actionRow: ActionRowComponent = {
        type: MessageComponentType.ACTION_ROW,
        components: buttons,
      } as ActionRowComponent;
      
      // Tạo row cho các solution buttons nếu có
      const solutionButtons: ButtonComponent[] = [];
      if (bug.solutions && bug.solutions.length > 0) {
        for (let i = 0; i < Math.min(3, bug.solutions.length); i++) {
          solutionButtons.push({
            type: MessageComponentType.BUTTON,
            style: ButtonStyle.BLUE,
            label: `Xem Giải Pháp #${bug.solutions[i].id}`,
            custom_id: `${ButtonAction.VIEW}:solution:${bug.solutions[i].id}`,
          } as ButtonComponent);
        }
      }
      
      const components = [actionRow];
      if (solutionButtons.length > 0) {
        components.push({
          type: MessageComponentType.ACTION_ROW,
          components: solutionButtons,
        } as ActionRowComponent);
      }

      return messageChannel.reply({
        embed: [
          {
            color: getRandomColor(),
            title: `🐛 Bug #${bug.id}: "${bug.title}"`,
            fields: [
              {
                name: 'Mức độ',
                value: bug.severity,
                inline: true,
              },
              {
                name: 'Trạng thái',
                value: bug.status,
                inline: true,
              },
              {
                name: 'Mô tả',
                value: bug.description || '*(Không có mô tả)*',
              },
              {
                name: 'Các bước tái hiện',
                value: bug.steps || '*(Không có các bước tái hiện)*',
              },
              {
                name: 'Môi trường',
                value: environmentText,
              },
              {
                name: '💡 Giải pháp đã có',
                value: solutionsText,
              },
              {
                name: 'Đã tạo',
                value: new Date(bug.createdAt).toLocaleString(),
              },
            ],
            footer: {
              text: 'DevHelper Bot',
            },
          },
        ],
        components: components,
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
    const { id, title, desc, severity, status, steps, environment } = args;
    
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
      // Kiểm tra bug có tồn tại không
      const existingBug = await this.bugService.findById(parseInt(id));
      
      // Validate severity nếu có
      if (severity && !Object.values(BugSeverity).includes(severity as BugSeverity)) {
        return messageChannel.reply({
          t: `❌ Mức độ nghiêm trọng không hợp lệ. Vui lòng sử dụng một trong các giá trị: ${Object.values(BugSeverity).join(', ')}.`,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: `❌ Mức độ nghiêm trọng không hợp lệ. Vui lòng sử dụng một trong các giá trị: ${Object.values(BugSeverity).join(', ')}.`.length,
            },
          ],
        });
      }
      
      // Validate status nếu có
      if (status && !Object.values(BugStatus).includes(status as BugStatus)) {
        return messageChannel.reply({
          t: `❌ Trạng thái không hợp lệ. Vui lòng sử dụng một trong các giá trị: ${Object.values(BugStatus).join(', ')}.`,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: `❌ Trạng thái không hợp lệ. Vui lòng sử dụng một trong các giá trị: ${Object.values(BugStatus).join(', ')}.`.length,
            },
          ],
        });
      }
      
      // Tạo object với các trường cần cập nhật
      const updateData: any = {};
      if (title) updateData.title = title;
      if (desc !== undefined) updateData.description = desc;
      if (severity) updateData.severity = severity;
      if (status) updateData.status = status;
      if (steps !== undefined) updateData.steps = steps;
      
      // Parse environment nếu có
      if (environment) {
        try {
          updateData.environment = JSON.parse(environment);
        } catch (error) {
          return messageChannel.reply({
            t: `❌ Lỗi: Format JSON không hợp lệ cho environment: ${error.message}`,
            mk: [
              {
                type: EMarkdownType.PRE,
                s: 0,
                e: `❌ Lỗi: Format JSON không hợp lệ cho environment: ${error.message}`.length,
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
      await this.bugService.update(parseInt(id), updateData);
      
      // Lấy bug sau khi cập nhật
      const updatedBug = await this.bugService.findById(parseInt(id));
      
      // So sánh và hiển thị các trường đã thay đổi
      let changesText = '';
      for (const key of Object.keys(updateData)) {
        let oldValue = existingBug[key];
        let newValue = updatedBug[key];
        
        // Format cho dễ đọc
        if (typeof oldValue === 'object') oldValue = JSON.stringify(oldValue);
        if (typeof newValue === 'object') newValue = JSON.stringify(newValue);
        
        changesText += `• ${key}: ${oldValue} ➔ ${newValue}\n`;
      }
      
      return messageChannel.reply({
        t: `✅ Đã cập nhật bug #${id}:\n\n${changesText}\nSử dụng /bug detail --id=${id} để xem chi tiết.`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `✅ Đã cập nhật bug #${id}:\n\n${changesText}\nSử dụng /bug detail --id=${id} để xem chi tiết.`.length,
          },
        ],
        components: [
          {
            type: MessageComponentType.ACTION_ROW,
            components: [
              {
                type: MessageComponentType.BUTTON,
                style: ButtonStyle.RED,
                label: 'Xem Chi Tiết',
                custom_id: `${ButtonAction.VIEW}:bug:${id}`,
              } as ButtonComponent,
            ],
          } as ActionRowComponent,
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
}