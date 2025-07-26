import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { LeaveRequest } from "./LeaveRequest";
import { User } from "../User";

@Entity()
export class LeaveRequestSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  subject: string;

  @Column()
  startDate: string;

  @Column()
  endDate: string;

  @ManyToOne(() => LeaveRequest)
  request: LeaveRequest;

  @Column()
  currentStepKey: string;  // e.g. "MANAGER_REVIEW"

  @Column()
  status: string;          // pending, approved, rejected

  @ManyToOne(() => User)
  createdBy: User;

  @ManyToOne(() => User)
  updatedBy: User;

  @CreateDateColumn()
  changedAt: Date;
}
