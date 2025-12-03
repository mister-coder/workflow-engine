import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from "typeorm";
import { LeaveRequest } from "./LeaveRequest";

@Entity()
export class Child {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  data: string;

  @ManyToOne(() => LeaveRequest, request => request.children) // <<< References 'request.child'
  request: LeaveRequest;
}
