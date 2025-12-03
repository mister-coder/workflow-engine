import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from "typeorm";
import { LeaveRequest } from "./LeaveRequest";

@Entity()
export class Child {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  data: string;

  // versioning fields in many to one relationship
  @Column({  default: 1, nullable: true })
  version: number;
  @Column({  default: true, nullable: true })
  isActive: boolean;

  @ManyToOne(() => LeaveRequest, request => request.children) // <<< References 'request.child'
  request: LeaveRequest;
}
