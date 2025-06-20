import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Solution } from './solution.entity';

export enum BugStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  CLOSED = 'closed',
}

export enum BugSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity()
export class Bug {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ 
    type: 'enum', 
    enum: BugStatus, 
    default: BugStatus.OPEN 
  })
  status: BugStatus;

  @Column({ 
    type: 'enum', 
    enum: BugSeverity, 
    default: BugSeverity.MEDIUM 
  })
  severity: BugSeverity;

  @Column('text', { nullable: true })
  steps: string;

  @Column('jsonb', { nullable: true, default: {} })
  environment: Record<string, string>;

  @OneToMany(() => Solution, (solution) => solution.bug)
  solutions: Solution[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}