import { Command } from 'src/bot/base/commandRegister.decorator';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { SolutionService } from 'src/bot/services/solution.service';
import { BugService } from 'src/bot/services/bug.service';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { getRandomColor } from 'src/bot/utils/helps';
import { ButtonAction, ButtonStyle, MessageComponentType, BugStatus } from 'src/bot/constants/types';
import { ActionRowComponent, ButtonComponent } from 'src/bot/constants/interfaces';

@Command('solution')
export class SolutionCommand extends CommandMessage {
  constructor(
    private solutionService: SolutionService,
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
      console.error('Error in SolutionCommand:', error);
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
      t: '💡 Hướng dẫn sử dụng lệnh solution:',
      embed: [
        {
          color: getRandomColor(),
          title: 'DevHelper - Solution Help',
          description: 'Các lệnh quản lý giải pháp:',
          fields: [
            {
              name: '*solution create',
              value: 'Thêm giải pháp cho bug\n' +
                    'Ví dụ: `*solution create --bug-id=47 --title="Sửa lỗi refresh token" --desc="Token refresh không hoạt động do thiếu kiểm tra" --code="const checkToken = async (req, res, next) => {...}"`',
            },
            {
              name: '*solution list',
              value: 'Liệt kê giải pháp theo bug\n' +
                    'Ví dụ: `*solution list --bug-id=47`',
            },
            {
              name: '*solution detail',
              value: 'Xem chi tiết giải pháp\n' +
                    'Ví dụ: `*solution detail --id=28`',
            },
            {
              name: '*solution update',
              value: 'Cập nhật giải pháp\n' +
                    'Ví dụ: `*solution update --id=28 --title="Tiêu đề mới" --desc="Mô tả mới" --code="Code mới"`',
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
    const { 'bug-id': bugId, title, desc, code } = args;
    
    if (!bugId || isNaN(parseInt(bugId))) {
      return messageChannel.reply({
        t: '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --bug-id (số).',
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --bug-id (số).'.length,
          },
        ],
      });
    }

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

    try {
      // Kiểm tra bug có tồn tại không
      const bug = await this.bugService.findById(parseInt(bugId));
      
      // Lưu giải pháp vào database
      const newSolution = await this.solutionService.create({
        title,
        description: desc || '',
        code: code || '',
        bug: bug,
      });
      
      // Cập nhật trạng thái bug nếu cần
      if (bug.status === 'open') {
        await this.bugService.update(bug.id, {
          status: BugStatus.IN_PROGRESS,
        });
      }

      // Tạo buttons cho các actions
      const buttons: ButtonComponent[] = [
        {
          type: MessageComponentType.BUTTON,
          style: ButtonStyle.GREEN,
          label: 'Xem Chi Tiết',
          custom_id: `${ButtonAction.VIEW}:solution:${newSolution.id}`,
        } as ButtonComponent,
        {
          type: MessageComponentType.BUTTON,
          style: ButtonStyle.BLUE,
          label: 'Xem Bug',
          custom_id: `${ButtonAction.VIEW}:bug:${bug.id}`,
        } as ButtonComponent,
      ];

      const actionRow: ActionRowComponent = {
        type: MessageComponentType.ACTION_ROW,
        components: buttons,
      } as ActionRowComponent;

      // Gửi thông báo thành công
      return messageChannel.reply({
        t: `✅ Đã thêm giải pháp! ID: ${newSolution.id}\nBug: #${bug.id} - ${bug.title}\n\nSử dụng /solution detail --id=${newSolution.id} để xem chi tiết.`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `✅ Đã thêm giải pháp! ID: ${newSolution.id}\nBug: #${bug.id} - ${bug.title}\n\nSử dụng /solution detail --id=${newSolution.id} để xem chi tiết.`.length,
          },
        ],
        components: [actionRow],
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

  private async handleList(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { 'bug-id': bugId } = args;
    
    if (!bugId || isNaN(parseInt(bugId))) {
      return messageChannel.reply({
        t: '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --bug-id (số).',
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: '❌ Thiếu thông tin hoặc định dạng không hợp lệ: Vui lòng cung cấp --bug-id (số).'.length,
          },
        ],
      });
    }

    try {
      // Kiểm tra bug có tồn tại không
      const bug = await this.bugService.findById(parseInt(bugId));
      
      // Lấy danh sách giải pháp cho bug
      const solutions = await this.solutionService.listByBugId(parseInt(bugId));
      
      if (solutions.length === 0) {
        // Tạo button thêm giải pháp
        const createButton: ButtonComponent = {
          type: MessageComponentType.BUTTON,
          style: ButtonStyle.BLUE,
          label: 'Thêm Giải Pháp',
          custom_id: `${ButtonAction.CREATE}:solution:${bugId}`,
        } as ButtonComponent;

        const actionRow: ActionRowComponent = {
          type: MessageComponentType.ACTION_ROW,
          components: [createButton],
        } as ActionRowComponent;

        return messageChannel.reply({
          t: `📋 Không tìm thấy giải pháp nào cho bug #${bugId}: "${bug.title}".\n\nSử dụng /solution create --bug-id=${bugId} để thêm giải pháp.`,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: `📋 Không tìm thấy giải pháp nào cho bug #${bugId}: "${bug.title}".\n\nSử dụng /solution create --bug-id=${bugId} để thêm giải pháp.`.length,
            },
          ],
          components: [actionRow],
        } as any);
      }

      // Tạo danh sách giải pháp
      let listText = `📋 Giải pháp cho bug #${bugId}: "${bug.title}":\n\n`;
      
      solutions.forEach((solution, index) => {
        listText += `${index + 1}. #${solution.id}: ${solution.title}\n`;
      });
      
      listText += '\n📌 Các lệnh bạn có thể dùng:\n';
      listText += `• /solution detail --id=${solutions[0].id}    (Xem chi tiết giải pháp)\n`;
      listText += `• /solution update --id=${solutions[0].id}    (Cập nhật giải pháp)\n`;
      listText += `• /solution create --bug-id=${bugId}    (Thêm giải pháp mới)\n`;

      // Tạo các button để xem chi tiết
      const buttons: ButtonComponent[] = [];
      for (let i = 0; i < Math.min(5, solutions.length); i++) {
        buttons.push({
          type: MessageComponentType.BUTTON,
          style: ButtonStyle.GREEN,
          label: `Xem Chi Tiết #${solutions[i].id}`,
          custom_id: `${ButtonAction.VIEW}:solution:${solutions[i].id}`,
        } as ButtonComponent);
      }
      
      const createButton: ButtonComponent = {
        type: MessageComponentType.BUTTON,
        style: ButtonStyle.BLUE,
        label: 'Thêm Giải Pháp',
        custom_id: `${ButtonAction.CREATE}:solution:${bugId}`,
      } as ButtonComponent;
      
      const actionRows: ActionRowComponent[] = [];
      if (buttons.length > 0) {
        actionRows.push({
          type: MessageComponentType.ACTION_ROW,
          components: buttons,
        } as ActionRowComponent);
      }
      
      actionRows.push({
        type: MessageComponentType.ACTION_ROW,
        components: [createButton],
      } as ActionRowComponent);

      return messageChannel.reply({
        t: listText,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: listText.length,
          },
        ],
        components: actionRows,
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
      const solution = await this.solutionService.findById(parseInt(id));
      
      // Format thời gian
      const createdAt = new Date(solution.createdAt);
      const formattedDate = `${createdAt.toLocaleDateString()}, ${createdAt.toLocaleTimeString()}`;
      
      // Tạo phần hiển thị code
      let codeDisplay = 'Không có code';
      if (solution.code) {
        codeDisplay = `\`\`\`\n${solution.code}\n\`\`\``;
      }

      // Tạo các button
      const buttons: ButtonComponent[] = [
        {
          type: MessageComponentType.BUTTON,
          style: ButtonStyle.BLUE,
          label: 'Xem Bug',
          custom_id: `${ButtonAction.VIEW}:bug:${solution.bug.id}`,
        } as ButtonComponent,
        {
          type: MessageComponentType.BUTTON,
          style: ButtonStyle.GREEN,
          label: 'Cập Nhật Giải Pháp',
          custom_id: `${ButtonAction.UPDATE}:solution:${solution.id}`,
        } as ButtonComponent,
      ];
      
      const actionRow: ActionRowComponent = {
        type: MessageComponentType.ACTION_ROW,
        components: buttons,
      } as ActionRowComponent;

      return messageChannel.reply({
        embed: [
          {
            color: getRandomColor(),
            title: `💡 Giải pháp #${solution.id}: "${solution.title}"`,
            fields: [
              {
                name: 'Cho bug',
                value: `#${solution.bug.id} - ${solution.bug.title}`,
              },
              {
                name: 'Mô tả',
                value: solution.description || 'Không có mô tả',
              },
              {
                name: 'Code',
                value: codeDisplay,
              },
              {
                name: 'Đã tạo',
                value: formattedDate,
              },
            ],
            footer: {
              text: 'DevHelper Bot',
            },
          },
        ],
        components: [actionRow],
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
    const { id, title, desc, code } = args;
    
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
      // Kiểm tra solution có tồn tại không
      const existingSolution = await this.solutionService.findById(parseInt(id));
      
      // Tạo object với các trường cần cập nhật
      const updateData: any = {};
      if (title) updateData.title = title;
      if (desc !== undefined) updateData.description = desc;
      if (code !== undefined) updateData.code = code;
      
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
      await this.solutionService.update(parseInt(id), updateData);
      
      // Lấy solution sau khi cập nhật
      const updatedSolution = await this.solutionService.findById(parseInt(id));
      
      // So sánh và hiển thị các trường đã thay đổi
      let changesText = '';
      for (const key of Object.keys(updateData)) {
        let oldValue = existingSolution[key];
        let newValue = updatedSolution[key];
        
        // Format cho dễ đọc nếu là code
        if (key === 'code') {
          oldValue = oldValue ? '(có code)' : '(không có code)';
          newValue = newValue ? '(có code mới)' : '(không có code)';
        }
        
        changesText += `• ${key}: ${oldValue} ➔ ${newValue}\n`;
      }
      
      // Tạo button xem chi tiết
      const viewButton: ButtonComponent = {
        type: MessageComponentType.BUTTON,
        style: ButtonStyle.GREEN,
        label: 'Xem Chi Tiết',
        custom_id: `${ButtonAction.VIEW}:solution:${id}`,
      } as ButtonComponent;
      
      const actionRow: ActionRowComponent = {
        type: MessageComponentType.ACTION_ROW,
        components: [viewButton],
      } as ActionRowComponent;

      return messageChannel.reply({
        t: `✅ Đã cập nhật giải pháp #${id}:\n\n${changesText}\nSử dụng /solution detail --id=${id} để xem chi tiết.`,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: `✅ Đã cập nhật giải pháp #${id}:\n\n${changesText}\nSử dụng /solution detail --id=${id} để xem chi tiết.`.length,
          },
        ],
        components: [actionRow],
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