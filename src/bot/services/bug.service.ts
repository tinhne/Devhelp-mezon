import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Bug, BugStatus } from '../models/bug.entity';

@Injectable()
export class BugService {
  constructor(
    @InjectRepository(Bug)
    private bugRepository: Repository<Bug>,
  ) {}

  async create(data: Partial<Bug>): Promise<Bug> {
    const bug = this.bugRepository.create(data);
    return this.bugRepository.save(bug);
  }

  async findById(id: number): Promise<Bug> {
    const bug = await this.bugRepository.findOne({ 
      where: { id },
      relations: ['solutions']
    });
    if (!bug) {
      throw new Error(`Bug with id ${id} not found`);
    }
    return bug;
  }

  async listByStatus(status: BugStatus): Promise<Bug[]> {
    return this.bugRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  async search(query: string): Promise<Bug[]> {
    return this.bugRepository.find({
      where: [
        { title: ILike(`%${query}%`) },
        { description: ILike(`%${query}%`) },
      ],
      order: { severity: 'DESC', createdAt: 'DESC' },
      relations: ['solutions'],
    });
  }

  async update(id: number, data: Partial<Bug>): Promise<Bug> {
    await this.bugRepository.update(id, data);
    return this.findById(id);
  }

  async updateStatus(id: number, status: BugStatus): Promise<Bug> {
    await this.bugRepository.update(id, { status });
    return this.findById(id);
  }
}