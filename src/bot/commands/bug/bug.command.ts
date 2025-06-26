import { Command } from 'src/bot/base/commandRegister.decorator';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { ChannelMessage } from 'mezon-sdk';
import { BugService } from 'src/bot/services/bug.service';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { getRandomColor } from 'src/bot/utils/helps';
import { ButtonAction, MessageComponentType, BugStatus, BugSeverity } from 'src/bot/constants/types';
import { ActionRowComponent, ButtonComponent } from 'src/bot/constants/interfaces';
import { parseArgs } from 'src/bot/utils/parse-args';
import { safeReply, createReplyOptions, createPreMarkdown } from 'src/bot/utils/reply-helpers';

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

    if (args.length === 0) {
      return this.showHelp(messageChannel);
    }

    const subCommand = args[0].toLowerCase();
    const remainingArgs = parseArgs(args.slice(1)); // Sử dụng helper mới

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
      t: '🐛 Hướng dẫn sử dụng lệnh bug',
      embed: [
        {
          color: getRandomColor(),
          title: 'DevHelper - Bug Tracker',
          description: 'Công cụ giúp quản lý báo cáo và theo dõi bug:',
          fields: [
            {
              name: '📝 Tạo báo cáo bug mới',
              value: '*bug create --title="JWT token không refresh" --desc="Mô tả lỗi" --severity="high"\n\n' +
                'Mức độ: `low`, `medium`, `high`, `critical`'
            },
            {
              name: '📋 Liệt kê bug theo trạng thái',
              value: '*bug list --status="open"\n\n' +
                'Trạng thái: `open`, `in_progress`, `closed`'
            },
            {
              name: '🔍 Xem chi tiết bug',
              value: '*bug detail --id=47\n\n' +
                'Hiển thị đầy đủ thông tin của bug, bao gồm các giải pháp.'
            },
            {
              name: '✏️ Cập nhật thông tin bug',
              value: '*bug update --id=47 --status="in_progress" --severity="high"'
            },
            {
              name: '💻 Tham số nâng cao',
              value: '*bug create --title="Bug XYZ" --steps="1. Đăng nhập\\n2. Đợi token hết hạn"\n' +
                '*bug create --environment=\'{"os":"Ubuntu 22.04","browser":"Chrome 118"}\''
            },
            {
              name: '📌 Lưu ý quan trọng',
              value: '• Tham số `--title` là bắt buộc khi tạo bug mới\n' +
                '• Với JSON dùng: `\'{"key":"value"}\'`\n' +
                '• Xuống dòng trong steps: `\\n`'
            }
          ],
          footer: {
            text: 'Gõ *bug hoặc *bug help để hiển thị hướng dẫn này',
          },
        },
      ],
    });
  }

  private async handleCreate(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { title, desc, severity, steps, environment } = args;

    if (!title) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          '❌ Thiếu thông tin: Vui lòng cung cấp --title.',
          createPreMarkdown('❌ Thiếu thông tin: Vui lòng cung cấp --title.')
        )
      );
    }

    if (severity && !Object.values(BugSeverity).includes(severity as BugSeverity)) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          `❌ Mức độ nghiêm trọng không hợp lệ. Vui lòng sử dụng một trong các giá trị: ${Object.values(BugSeverity).join(', ')}.`,
          createPreMarkdown(`❌ Mức độ nghiêm trọng không hợp lệ. Vui lòng sử dụng một trong các giá trị: ${Object.values(BugSeverity).join(', ')}.`)
        )
      );
    }

    let parsedEnvironment = {};
    if (environment) {
      try {
        parsedEnvironment = JSON.parse(environment);
      } catch (error) {
        return safeReply(
          messageChannel,
          createReplyOptions(
            `❌ Lỗi: Format JSON không hợp lệ cho environment: ${error.message}`,
            createPreMarkdown(`❌ Lỗi: Format JSON không hợp lệ cho environment: ${error.message}`)
          )
        );
      }
    }

    const newBug = await this.bugService.create({
      title,
      description: desc || '',
      severity: severity as BugSeverity || BugSeverity.MEDIUM,
      steps: steps || '',
      environment: parsedEnvironment,
      status: BugStatus.OPEN,
    });

    let environmentText = '';
    if (Object.keys(parsedEnvironment).length > 0) {
      environmentText = '\nMôi trường:\n';
      for (const [key, value] of Object.entries(parsedEnvironment)) {
        environmentText += `• ${key}: ${value}\n`;
      }
    }

    return safeReply(
      messageChannel,
      createReplyOptions(
        `✅ Đã báo cáo bug! ID: ${newBug.id}\nMức độ: ${newBug.severity}\nTrạng thái: ${newBug.status}${environmentText}\nSử dụng /bug detail --id=${newBug.id} để xem chi tiết.`,
        createPreMarkdown(`✅ Đã báo cáo bug! ID: ${newBug.id}\nMức độ: ${newBug.severity}\nTrạng thái: ${newBug.status}${environmentText}\nSử dụng /bug detail --id=${newBug.id} để xem chi tiết.`)
      )
    );
  }

  private async handleList(args: Record<string, string>, messageChannel: any): Promise<any> {
    const { status } = args;

    if (!status || !Object.values(BugStatus).includes(status as BugStatus)) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          `❌ Thiếu hoặc không hợp lệ: Vui lòng cung cấp --status với một trong các giá trị: ${Object.values(BugStatus).join(', ')}.`,
          createPreMarkdown(`❌ Thiếu hoặc không hợp lệ: Vui lòng cung cấp --status với một trong các giá trị: ${Object.values(BugStatus).join(', ')}.`)
        )
      );
    }

    const bugs = await this.bugService.listByStatus(status as BugStatus);

    if (bugs.length === 0) {
      return safeReply(
        messageChannel,
        createReplyOptions(
          `📋 Không tìm thấy bug nào ở trạng thái "${status}".`,
          createPreMarkdown(`📋 Không tìm thấy bug nào ở trạng thái "${status}".`)
        )
      );
    }

    let listText = `📋 Danh sách bug ở trạng thái "${status}":\n\n`;

    bugs.forEach((bug, index) => {
      const solutionCount = bug.solutions ? bug.solutions.length : 0;
      listText += `${index + 1}. #${bug.id}: ${bug.title} - ${bug.severity}${solutionCount > 0 ? ` (${solutionCount} giải pháp)` : ''}\n`;
    });

    listText += '\n📌 Các lệnh bạn có thể dùng:\n';
    listText += `• /bug detail --id=${bugs[0].id}    (Xem chi tiết bug)\n`;
    listText += `• /bug update --id=${bugs[0].id} --status="in_progress"    (Cập nhật trạng thái)\n`;
    listText += `• /solution create --bug-id=${bugs[0].id}    (Thêm giải pháp)\n`;

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
      const bug = await this.bugService.findById(parseInt(id));

      let environmentText = 'Không có';
      if (bug.environment && Object.keys(bug.environment).length > 0) {
        environmentText = Object.entries(bug.environment)
          .map(([key, value]) => `• ${key}: ${value}`)
          .join('\n');
      }

      let solutionsText = 'Chưa có giải pháp';
      if (bug.solutions && bug.solutions.length > 0) {
        solutionsText = bug.solutions.map((solution) =>
          `• #${solution.id}: ${solution.title}`
        ).join('\n');
      }

      return safeReply(
        messageChannel,
        {
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
    const { id, title, desc, severity, status, steps, environment } = args;

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
      const existingBug = await this.bugService.findById(parseInt(id));

      if (severity && !Object.values(BugSeverity).includes(severity as BugSeverity)) {
        return safeReply(
          messageChannel,
          createReplyOptions(
            `❌ Mức độ nghiêm trọng không hợp lệ. Vui lòng sử dụng một trong các giá trị: ${Object.values(BugSeverity).join(', ')}.`,
            createPreMarkdown(`❌ Mức độ nghiêm trọng không hợp lệ. Vui lòng sử dụng một trong các giá trị: ${Object.values(BugSeverity).join(', ')}.`)
          )
        );
      }

      if (status && !Object.values(BugStatus).includes(status as BugStatus)) {
        return safeReply(
          messageChannel,
          createReplyOptions(
            `❌ Trạng thái không hợp lệ. Vui lòng sử dụng một trong các giá trị: ${Object.values(BugStatus).join(', ')}.`,
            createPreMarkdown(`❌ Trạng thái không hợp lệ. Vui lòng sử dụng một trong các giá trị: ${Object.values(BugStatus).join(', ')}.`)
          )
        );
      }

      const updateData: any = {};
      if (title) updateData.title = title;
      if (desc !== undefined) updateData.description = desc;
      if (severity) updateData.severity = severity;
      if (status) updateData.status = status;
      if (steps !== undefined) updateData.steps = steps;

      if (environment) {
        try {
          updateData.environment = JSON.parse(environment);
        } catch (error) {
          return safeReply(
            messageChannel,
            createReplyOptions(
              `❌ Lỗi: Format JSON không hợp lệ cho environment: ${error.message}`,
              createPreMarkdown(`❌ Lỗi: Format JSON không hợp lệ cho environment: ${error.message}`)
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

      await this.bugService.update(parseInt(id), updateData);

      const updatedBug = await this.bugService.findById(parseInt(id));

      let changesText = '';
      for (const key of Object.keys(updateData)) {
        let oldValue = existingBug[key];
        let newValue = updatedBug[key];

        if (typeof oldValue === 'object') oldValue = JSON.stringify(oldValue);
        if (typeof newValue === 'object') newValue = JSON.stringify(newValue);

        changesText += `• ${key}: ${oldValue} ➔ ${newValue}\n`;
      }

      return safeReply(
        messageChannel,
        createReplyOptions(
          `✅ Đã cập nhật bug #${id}:\n\n${changesText}\nSử dụng /bug detail --id=${id} để xem chi tiết.`,
          createPreMarkdown(`✅ Đã cập nhật bug #${id}:\n\n${changesText}\nSử dụng /bug detail --id=${id} để xem chi tiết.`)
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
}