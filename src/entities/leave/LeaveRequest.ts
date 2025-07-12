import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { User } from "../User";

@Entity()
export class LeaveRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  subject: string;

  @Column()
  startDate: string;

  @Column()
  endDate: string;

  @ManyToOne(() => User)
  createdBy: User;

  @Column()
  currentStepKey: string;  // e.g. "MANAGER_REVIEW"

  @Column()
  status: string;          // pending, approved, rejected
}
