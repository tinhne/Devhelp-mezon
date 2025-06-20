import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Solution } from '../models/solution.entity';

@Injectable()
export class SolutionService {
  constructor(
    @InjectRepository(Solution)
    private solutionRepository: Repository<Solution>,
  ) {}

  async create(data: Partial<Solution>): Promise<Solution> {
    const solution = this.solutionRepository.create(data);
    return this.solutionRepository.save(solution);
  }

  async findById(id: number): Promise<Solution> {
  const solution = await this.solutionRepository.findOne({
    where: { id },
    relations: ['bug'],
  });
  
  if (!solution) {
    throw new Error(`Solution with id ${id} not found`);
  }
  
  return solution;
}

  async listByBugId(bugId: number): Promise<Solution[]> {
    return this.solutionRepository.find({
      where: { bugId },
      order: { createdAt: 'DESC' },
    });
  }

  async search(query: string): Promise<Solution[]> {
    return this.solutionRepository.find({
      where: [
        { title: ILike(`%${query}%`) },
        { description: ILike(`%${query}%`) },
        { code: ILike(`%${query}%`) },
      ],
      order: { createdAt: 'DESC' },
      relations: ['bug'],
    });
  }

  async update(id: number, data: Partial<Solution>): Promise<Solution> {
    await this.solutionRepository.update(id, data);
    return this.findById(id);
  }
}