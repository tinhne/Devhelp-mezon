import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Command } from '../models/command.entity';

@Injectable()
export class CommandService {
  constructor(
    @InjectRepository(Command)
    private commandRepository: Repository<Command>,
  ) {}

  async create(data: Partial<Command>): Promise<Command> {
    const command = this.commandRepository.create(data);
    return this.commandRepository.save(command);
  }

  async findById(id: number): Promise<Command> {
    const command = await this.commandRepository.findOne({ where: { id } });
    if (!command) {
      throw new Error(`Command with id ${id} not found`);
    }
    return command;
  }

  async listByCategory(category: string): Promise<Command[]> {
    return this.commandRepository.find({
      where: { category, deleted: false },
      order: { title: 'ASC' },
    });
  }

  async search(query: string): Promise<Command[]> {
    return this.commandRepository.find({
      where: [
        { title: ILike(`%${query}%`), deleted: false },
        { command: ILike(`%${query}%`), deleted: false },
        { description: ILike(`%${query}%`), deleted: false },
      ],
      order: { title: 'ASC' },
    });
  }

  async update(id: number, data: Partial<Command>): Promise<Command> {
    await this.commandRepository.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: number): Promise<void> {
    await this.commandRepository.update(id, { deleted: true });
  }

  async restore(id: number): Promise<void> {
    await this.commandRepository.update(id, { deleted: false });
  }
}