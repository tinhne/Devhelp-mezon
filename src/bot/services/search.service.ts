import { Injectable } from '@nestjs/common';
import { CommandService } from './command.service';
import { BugService } from './bug.service';
import { SolutionService } from './solution.service';

@Injectable()
export class SearchService {
  constructor(
    private commandService: CommandService,
    private bugService: BugService,
    private solutionService: SolutionService,
  ) {}

  async search(query: string) {
    const [commands, bugs, solutions] = await Promise.all([
      this.commandService.search(query),
      this.bugService.search(query),
      this.solutionService.search(query),
    ]);

    return {
      commands,
      bugs,
      solutions,
    };
  }

  async searchByType(query: string, type: string) {
    switch (type) {
      case 'commands':
        return await this.commandService.search(query);
      case 'bugs':
        return await this.bugService.search(query);
      case 'solutions':
        return await this.solutionService.search(query);
      default:
        throw new Error(`Không hỗ trợ tìm kiếm loại: ${type}`);
    }
  }

  // Tìm kiếm bugs với solutions
  async searchBugsWithSolutions(query: string) {
    const bugs = await this.bugService.search(query);

    // Lấy chi tiết các bug bao gồm solutions
    const detailedBugs = await Promise.all(
      bugs.map(async (bug) => {
        return await this.bugService.findById(bug.id);
      }),
    );

    return detailedBugs;
  }
}
