import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Command {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  command: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column()
  category: string;

  @Column('jsonb', { nullable: true, default: {} })
  parameters: Record<string, string>; // { paramName: description }

  @Column('jsonb', { nullable: true, default: [] })
  examples: string[];

  @Column({ default: false })
  deleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
