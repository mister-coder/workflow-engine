import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, OneToMany } from "typeorm";
import { User } from "../User";
import { Child } from "./child";
import { SecondChild } from "./secondChild";

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

  @ManyToOne(() => User)
  updatedBy: User;

  @CreateDateColumn()
  changedAt: Date;

  @Column()
  currentStepKey: string;  // e.g. "MANAGER_REVIEW"

  @Column()
  status: string;          // pending, approved, rejected

  @OneToMany(() => Child, child => child.request) 
  children: Child[];

  @OneToMany(() => SecondChild, secondChild => secondChild.request) 
  secondChildren: SecondChild[];
}
