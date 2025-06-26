import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Events, EMarkdownType } from 'mezon-sdk';
import { CommandService } from '../services/command.service';
import { BugService } from '../services/bug.service';
import { SolutionService } from '../services/solution.service';
import { SearchService } from '../services/search.service';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { ButtonStyle, MessageComponentType, ButtonAction } from '../constants/types';
import { ActionRowComponent, ButtonComponent } from '../constants/interfaces';
import { getRandomColor } from '../utils/helps';
import { createButton, createActionRow } from '../utils/component-helpers';
import { BotStateService } from '../services/bot-state.service';
import { createPreMarkdown, safeReply, createReplyOptions } from '../utils/reply-helpers';

// Define the expected event payload type if not exported by mezon-sdk
interface MessageButtonClicked {
  custom_id: string;
  clan_id?: string;     // Keep for backward compatibility
  server_id: string;    // Add this field
  channel_id: string;
  message_id: string;
  user_id: string;
}

@Injectable()
export class ListenerMessageButtonClicked {
  private readonly logger = new Logger(ListenerMessageButtonClicked.name);

  constructor(
    private readonly commandService: CommandService,
    private readonly bugService: BugService,
    private readonly solutionService: SolutionService,
    private readonly searchService: SearchService,
    private readonly clientService: MezonClientService,
    private readonly botStateService: BotStateService
  ) {}

  @OnEvent(Events.MessageButtonClicked) // FIX: Removed the extra @ symbol
  async handleButtonClick(event: MessageButtonClicked) {
    // Skip if bot is inactive
    if (!this.botStateService.isActive()) {
      this.logger.debug(`Button click ignored - bot is inactive: ${event.custom_id}`);
      return;
    }
    
    try {
      const customId = event.custom_id;
      this.logger.debug(`Processing button click: ${customId}`);

      // Parse custom_id to get action type and ID
      const parts = customId.split(':');
      const action = parts[0];
      const type = parts[1];
      const id = parts[2];

      // Get client and channel to respond
      const client = this.clientService.getClient();
      
      // Check server/channel safely
      let channel;
      let message;
      
      if (client?.servers) {
        const server = client.servers.get(event.server_id);
        if (server) {
          channel = await server.channels.fetch(event.channel_id);
        }
      } else if ((client as any)?.clans) {
        const clan = (client as any).clans.get(event.clan_id || event.server_id);
        if (clan) {
          channel = await clan.channels.fetch(event.channel_id);
        }
      }
      
      if (!channel) {
        this.logger.warn(`Channel not found for button click: ${event.channel_id}`);
        return;
      }
      
      message = await channel.messages.fetch(event.message_id);

      if (!message) {
        this.logger.warn(`Message not found for button click: ${event.message_id}`);
        return;
      }

      // Process different button actions
      switch (action) {
        case ButtonAction.VIEW:
          await this.handleViewDetail(type, id, message);
          break;

        case ButtonAction.UPDATE:
          await this.handleUpdateForm(type, id, message);
          break;

        case ButtonAction.DELETE:
          await this.handleDelete(type, id, message);
          break;

        case ButtonAction.RESTORE:
          await this.handleRestore(type, id, message);
          break;

        case ButtonAction.CREATE:
          await this.handleAddForm(type, id, message);
          break;

        case ButtonAction.SEARCH:
          await this.handleSearch(type, id, message);
          break;

        case 'help':
          await this.handleHelp(type, message);
          break;

        default:
          this.logger.warn(`Unknown button action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Error handling button click: ${error.message}`, error.stack);
    }
  }

  // Helper methods để hiển thị chi tiết
    private async handleViewDetail(type: string, id: string, message: any) {
    try {
      switch (type) {
        case 'command':
          const command = await this.commandService.findById(parseInt(id));
          await this.displayCommandDetail(message, command);
          break;
        case 'bug':
          const bug = await this.bugService.findById(parseInt(id));
          await this.displayBugDetail(message, bug);
          break;
        case 'solution':
          const solution = await this.solutionService.findById(parseInt(id));
          await this.displaySolutionDetail(message, solution);
          break;
        default:
          this.logger.warn(`Unknown view type: ${type}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling view detail: ${error.message}`,
        error.stack,
      );
      await safeReply(
        message,
        createReplyOptions(
          `❌ Lỗi: ${error.message}`,
          createPreMarkdown(`❌ Lỗi: ${error.message}`)
        )
      );
    }
  }

  private async handleUpdateForm(type: string, id: string, message: any) {
    try {
      switch (type) {
        case 'command':
          const command = await this.commandService.findById(parseInt(id));
          await this.displayCommandUpdateForm(message, command);
          break;
        case 'bug':
          const bug = await this.bugService.findById(parseInt(id));
          await this.displayBugUpdateForm(message, bug);
          break;
        case 'solution':
          const solution = await this.solutionService.findById(parseInt(id));
          await this.displaySolutionUpdateForm(message, solution);
          break;
        default:
          this.logger.warn(`Unknown update type: ${type}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling update form: ${error.message}`,
        error.stack,
      );
      await safeReply(
        message,
        createReplyOptions(
          `❌ Lỗi: ${error.message}`,
          createPreMarkdown(`❌ Lỗi: ${error.message}`)
        )
      );
    }
  }

  private async handleDelete(type: string, id: string, message: any) {
    try {
      if (type === 'command') {
        const command = await this.commandService.findById(parseInt(id));
        await this.commandService.softDelete(parseInt(id));

        await safeReply(
          message,
          {
            ...createReplyOptions(
              `🗑️ Đã xóa lệnh #${id} "${command.title}"\nSử dụng /command restore --id=${id} để khôi phục.`,
              createPreMarkdown(`🗑️ Đã xóa lệnh #${id} "${command.title}"\nSử dụng /command restore --id=${id} để khôi phục.`)
            ),
            components: [
              {
                type: MessageComponentType.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentType.BUTTON,
                    style: ButtonStyle.GREEN,
                    label: 'Khôi Phục',
                    custom_id: `${ButtonAction.RESTORE}:command:${id}`,
                  },
                ],
              },
            ],
          }
        );
      } else {
        this.logger.warn(`Delete not implemented for type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Error handling delete: ${error.message}`, error.stack);
      await safeReply(
        message,
        createReplyOptions(
          `❌ Lỗi: ${error.message}`,
          createPreMarkdown(`❌ Lỗi: ${error.message}`)
        )
      );
    }
  }

  private async handleRestore(type: string, id: string, message: any) {
    try {
      if (type === 'command') {
        await this.commandService.restore(parseInt(id));
        const command = await this.commandService.findById(parseInt(id));

        await safeReply(
          message,
          {
            ...createReplyOptions(
              `♻️ Đã khôi phục lệnh #${id} "${command.title}"\nSử dụng /command detail --id=${id} để xem chi tiết.`,
              createPreMarkdown(`♻️ Đã khôi phục lệnh #${id} "${command.title}"\nSử dụng /command detail --id=${id} để xem chi tiết.`)
            ),
            components: [
              {
                type: MessageComponentType.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentType.BUTTON,
                    style: ButtonStyle.BLUE,
                    label: 'Xem Chi Tiết',
                    custom_id: `${ButtonAction.VIEW}:command:${id}`,
                  },
                ],
              },
            ],
          }
        );
      } else {
        this.logger.warn(`Restore not implemented for type: ${type}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling restore: ${error.message}`,
        error.stack,
      );
      await safeReply(
        message,
        createReplyOptions(
          `❌ Lỗi: ${error.message}`,
          createPreMarkdown(`❌ Lỗi: ${error.message}`)
        )
      );
    }
  }

  private async handleAddForm(type: string, id: string, message: any) {
    try {
      switch (type) {
        case 'solution':
          // id là bug id
          const bug = await this.bugService.findById(parseInt(id));

          // Hiển thị form thêm giải pháp cho bug này
          await safeReply(
            message,
            createReplyOptions(
              `💡 Thêm giải pháp cho bug #${bug.id}: "${bug.title}"\n\nSử dụng lệnh sau để thêm giải pháp:\n/solution create --bug-id=${bug.id} --title="Tiêu đề giải pháp" --desc="Mô tả giải pháp" --code="Code giải pháp"`,
              createPreMarkdown(
                `💡 Thêm giải pháp cho bug #${bug.id}: "${bug.title}"\n\nSử dụng lệnh sau để thêm giải pháp:\n/solution create --bug-id=${bug.id} --title="Tiêu đề giải pháp" --desc="Mô tả giải pháp" --code="Code giải pháp"`
              )
            )
          );
          break;
        default:
          this.logger.warn(`Add form not implemented for type: ${type}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling add form: ${error.message}`,
        error.stack,
      );
      await safeReply(
        message,
        createReplyOptions(
          `❌ Lỗi: ${error.message}`,
          createPreMarkdown(`❌ Lỗi: ${error.message}`)
        )
      );
    }
  }

  private async handleSearch(type: string, id: string, message: any) {
    try {
      // Chức năng tìm kiếm từ button
      const query = id; // id trong trường hợp này là query cần tìm kiếm

      await safeReply(
        message,
        createReplyOptions(
          `🔍 Đang tìm kiếm cho "${query}"...`,
          createPreMarkdown(`🔍 Đang tìm kiếm cho "${query}"...`)
        )
      );

      if (type === 'all') {
        const results = await this.searchService.search(query);
        // Hiển thị kết quả tìm kiếm (tương tự như trong SearchCommand)
      } else {
        const results = await this.searchService.searchByType(
          query,
          type as any,
        );
        // Hiển thị kết quả tìm kiếm theo loại
      }
    } catch (error) {
      this.logger.error(`Error handling search: ${error.message}`, error.stack);
      await safeReply(
        message,
        createReplyOptions(
          `❌ Lỗi khi tìm kiếm: ${error.message}`,
          createPreMarkdown(`❌ Lỗi khi tìm kiếm: ${error.message}`)
        )
      );
    }
  }

  private async handleHelp(type: string, message: any) {
    try {
      switch (type) {
        case 'command':
          await safeReply(message, {
            embed: [
              {
                color: getRandomColor(),
                title: '📝 Hướng dẫn quản lý lệnh',
                description: 'Chi tiết các lệnh quản lý command:',
                fields: [
                  {
                    name: '`/command save`',
                    value:
                      'Lưu lệnh mới\nCú pháp: `/command save --title="git-stash" --command="git stash apply" --desc="Áp dụng stash gần nhất" --category="git"`',
                  },
                  {
                    name: '`/command list`',
                    value:
                      'Xem danh sách lệnh theo danh mục\nCú pháp: `/command list --category="git"`',
                  },
                  {
                    name: '`/command detail`',
                    value:
                      'Xem chi tiết lệnh\nCú pháp: `/command detail --id=125`',
                  },
                  {
                    name: '`/command find`',
                    value:
                      'Tìm kiếm lệnh theo từ khóa\nCú pháp: `/command find --query="git stash"`',
                  },
                  {
                    name: '`/command update`',
                    value:
                      'Cập nhật lệnh\nCú pháp: `/command update --id=125 --title="git-stash-new" --desc="Mô tả mới"`',
                  },
                  {
                    name: '`/command delete`',
                    value: 'Xóa lệnh\nCú pháp: `/command delete --id=125`',
                  },
                  {
                    name: '`/command restore`',
                    value:
                      'Khôi phục lệnh đã xóa\nCú pháp: `/command restore --id=125`',
                  },
                ],
              },
            ],
          });
          break;
        case 'bug':
          await safeReply(message, {
            embed: [
              {
                color: getRandomColor(),
                title: '🐛 Hướng dẫn quản lý bug',
                description: 'Chi tiết các lệnh quản lý bug:',
                fields: [
                  {
                    name: '`/bug create`',
                    value:
                      'Báo cáo bug mới\nCú pháp: `/bug create --title="JWT token không refresh" --desc="Token mới không được tạo khi token cũ hết hạn" --severity="high" --steps="1. Đăng nhập\\n2. Đợi token hết hạn\\n3. Thực hiện API call" --environment=\'{"os": "Ubuntu 22.04", "browser": "Chrome 118"}\'`',
                  },
                  {
                    name: '`/bug list`',
                    value:
                      'Xem danh sách bug theo trạng thái\nCú pháp: `/bug list --status="open"`',
                  },
                  {
                    name: '`/bug detail`',
                    value: 'Xem chi tiết bug\nCú pháp: `/bug detail --id=47`',
                  },
                  {
                    name: '`/bug update`',
                    value:
                      'Cập nhật thông tin bug\nCú pháp: `/bug update --id=47 --status="in_progress"`',
                  },
                ],
              },
            ],
          });
          break;
        case 'solution':
          await safeReply(message, {
            embed: [
              {
                color: getRandomColor(),
                title: '💡 Hướng dẫn quản lý giải pháp',
                description: 'Chi tiết các lệnh quản lý giải pháp:',
                fields: [
                  {
                    name: '`/solution create`',
                    value:
                      'Thêm giải pháp cho bug\nCú pháp: `/solution create --bug-id=47 --title="Sửa lỗi refresh token" --desc="Token refresh không hoạt động do thiếu kiểm tra" --code="const checkToken = async (req, res, next) => {...}"`',
                  },
                  {
                    name: '`/solution list`',
                    value:
                      'Xem danh sách giải pháp cho bug\nCú pháp: `/solution list --bug-id=47`',
                  },
                  {
                    name: '`/solution detail`',
                    value:
                      'Xem chi tiết giải pháp\nCú pháp: `/solution detail --id=28`',
                  },
                  {
                    name: '`/solution update`',
                    value:
                      'Cập nhật giải pháp\nCú pháp: `/solution update --id=28 --desc="Mô tả mới"`',
                  },
                ],
              },
            ],
          });
          break;
        default:
          await safeReply(
            message,
            createReplyOptions(
              'Chọn một loại hướng dẫn cụ thể (command, bug, solution).',
              createPreMarkdown('Chọn một loại hướng dẫn cụ thể (command, bug, solution).')
            )
          );
      }
    } catch (error) {
      this.logger.error(`Error handling help: ${error.message}`, error.stack);
      await safeReply(
        message,
        createReplyOptions(
          `❌ Lỗi khi hiển thị hướng dẫn: ${error.message}`,
          createPreMarkdown(`❌ Lỗi khi hiển thị hướng dẫn: ${error.message}`)
        )
      );
    }
  }

  // Chỉ hiển thị phần cần sửa

  private async displayCommandDetail(message: any, command: any) {
    try {
      // Tạo hiển thị parameters
      let parametersText = '';
      if (command.parameters && Object.keys(command.parameters).length > 0) {
        parametersText = 'Tham số:\n';
        for (const [key, value] of Object.entries(command.parameters)) {
          parametersText += `• ${key}: ${value}\n`;
        }
      }

      // Tạo hiển thị examples
      let examplesText = '';
      if (command.examples && command.examples.length > 0) {
        examplesText = 'Ví dụ:\n';
        command.examples.forEach((example: string, index: number) => {
          examplesText += `• ${example}\n`;
        });
      }

      // Tạo button cho các hành động
      const buttons = [
        createButton(
          ButtonStyle.GREEN,
          'Cập Nhật Lệnh',
          `${ButtonAction.UPDATE}:command:${command.id}`,
        ),
        createButton(
          ButtonStyle.RED,
          command.deleted ? 'Khôi Phục Lệnh' : 'Xóa Lệnh',
          command.deleted
            ? `${ButtonAction.RESTORE}:command:${command.id}`
            : `${ButtonAction.DELETE}:command:${command.id}`,
        ),
      ];

      const components = [createActionRow(buttons)];

      return await message.reply({
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
                value: parametersText || '*(Không có tham số)*',
              },
              {
                name: 'Ví dụ',
                value: examplesText || '*(Không có ví dụ)*',
              },
              {
                name: 'Trạng thái',
                value: command.deleted ? '🗑️ Đã xóa' : '✅ Hoạt động',
              },
              {
                name: 'Đã tạo',
                value: new Date(command.createdAt).toLocaleString(),
              },
            ],
          },
        ],
        components,
      });
    } catch (error) {
      this.logger.error(
        `Error in displayCommandDetail: ${error.message}`,
        error.stack,
      );
      await message.reply({
        t: `❌ Lỗi khi hiển thị chi tiết lệnh: ${error.message}`,
        mk: createPreMarkdown(
          `❌ Lỗi khi hiển thị chi tiết lệnh: ${error.message}`,
        ),
      });
    }
  }

  private async displayBugDetail(message: any, bug: any) {
    // Tạo hiển thị environment
    let environmentText = '';
    if (bug.environment && Object.keys(bug.environment).length > 0) {
      environmentText = Object.entries(bug.environment)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }

    // Hiển thị solutions nếu có
    let solutionsText = '';
    if (bug.solutions && bug.solutions.length > 0) {
      solutionsText = bug.solutions
        .map((solution: any) => `• #${solution.id}: ${solution.title}`)
        .join('\n');
    } else {
      solutionsText = 'Chưa có giải pháp';
    }

    // Tạo button cho các hành động
    const components: ActionRowComponent[] = [
      {
        type: MessageComponentType.ACTION_ROW,
        components: [
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
        ],
      } as ActionRowComponent,
    ];

    // Thêm buttons cho solutions nếu có
    if (bug.solutions && bug.solutions.length > 0) {
      const solutionButtonComponents: ButtonComponent[] = [];

      for (let i = 0; i < Math.min(bug.solutions.length, 3); i++) {
        const solution = bug.solutions[i];
        solutionButtonComponents.push({
          type: MessageComponentType.BUTTON,
          style: ButtonStyle.BLUE,
          label: `Xem Giải Pháp #${solution.id}`,
          custom_id: `${ButtonAction.VIEW}:solution:${solution.id}`,
        } as ButtonComponent);
      }

      if (solutionButtonComponents.length > 0) {
        components.push({
          type: MessageComponentType.ACTION_ROW,
          components: solutionButtonComponents,
        } as ActionRowComponent);
      }
    }

    await message.reply({
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
              value: environmentText || '*(Không có thông tin môi trường)*',
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
        },
      ],
      components,
    });
  }

  private async displaySolutionDetail(message: any, solution: any) {
    // Format thời gian
    const createdAt = new Date(solution.createdAt);
    const formattedDate = `${createdAt.toLocaleDateString()}, ${createdAt.toLocaleTimeString()}`;

    // Tạo phần hiển thị code
    let codeDisplay = 'Không có code';
    if (solution.code) {
      codeDisplay = `\`\`\`\n${solution.code}\n\`\`\``;
    }

    await message.reply({
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
      components: [
        {
          type: MessageComponentType.ACTION_ROW,
          components: [
            {
              type: MessageComponentType.BUTTON,
              style: ButtonStyle.BLUE,
              label: 'Xem Bug',
              custom_id: `${ButtonAction.VIEW}:bug:${solution.bug.id}`,
            },
            {
              type: MessageComponentType.BUTTON,
              style: ButtonStyle.GREEN,
              label: 'Cập Nhật Giải Pháp',
              custom_id: `${ButtonAction.UPDATE}:solution:${solution.id}`,
            },
          ],
        },
      ],
    });
  }

  private async displayCommandUpdateForm(message: any, command: any) {
    await message.reply({
      t: `📝 Cập nhật lệnh #${command.id}: "${command.title}"\n\nSử dụng lệnh sau để cập nhật:\n/command update --id=${command.id} --title="Tiêu đề mới" --command="Lệnh mới" --desc="Mô tả mới" --category="Danh mục mới"`,
      mk: [
        {
          type: EMarkdownType.PRE,
          s: 0,
          e: `📝 Cập nhật lệnh #${command.id}: "${command.title}"\n\nSử dụng lệnh sau để cập nhật:\n/command update --id=${command.id} --title="Tiêu đề mới" --command="Lệnh mới" --desc="Mô tả mới" --category="Danh mục mới"`
            .length,
        },
      ],
    });
  }

  private async displayBugUpdateForm(message: any, bug: any) {
    await message.reply({
      t: `🐛 Cập nhật bug #${bug.id}: "${bug.title}"\n\nSử dụng lệnh sau để cập nhật:\n/bug update --id=${bug.id} --title="Tiêu đề mới" --desc="Mô tả mới" --severity="high" --status="in_progress"`,
      mk: [
        {
          type: EMarkdownType.PRE,
          s: 0,
          e: `🐛 Cập nhật bug #${bug.id}: "${bug.title}"\n\nSử dụng lệnh sau để cập nhật:\n/bug update --id=${bug.id} --title="Tiêu đề mới" --desc="Mô tả mới" --severity="high" --status="in_progress"`
            .length,
        },
      ],
    });
  }

  private async displaySolutionUpdateForm(message: any, solution: any) {
    await message.reply({
      t: `💡 Cập nhật giải pháp #${solution.id}: "${solution.title}"\n\nSử dụng lệnh sau để cập nhật:\n/solution update --id=${solution.id} --title="Tiêu đề mới" --desc="Mô tả mới" --code="Code mới"`,
      mk: [
        {
          type: EMarkdownType.PRE,
          s: 0,
          e: `💡 Cập nhật giải pháp #${solution.id}: "${solution.title}"\n\nSử dụng lệnh sau để cập nhật:\n/solution update --id=${solution.id} --title="Tiêu đề mới" --desc="Mô tả mới" --code="Code mới"`
            .length,
        },
      ],
    });
  }
}
