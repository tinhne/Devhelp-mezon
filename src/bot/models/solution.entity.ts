import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { Bug } from './bug.entity';

@Entity()
export class Solution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column('text', { nullable: true })
  code: string;

  @Column({ name: 'bug_id' })
  bugId: number;

  @ManyToOne(() => Bug, (bug) => bug.solutions)
  @JoinColumn({ name: 'bug_id' })
  bug: Bug;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}