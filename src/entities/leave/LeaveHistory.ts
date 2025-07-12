import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from "typeorm";
import { LeaveRequest } from "./LeaveRequest";
import { User } from "../User";

@Entity()
export class LeaveHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => LeaveRequest)
  request: LeaveRequest;

  @Column()
  fromStepKey: string;

  @Column()
  toStepKey: string;

  @Column()
  action: string;

  @ManyToOne(() => User)
  performedBy: User;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ nullable: true })
  comment: string;
}
