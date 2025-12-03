import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from "typeorm";
import { LeaveRequest } from "./LeaveRequest";

@Entity()
export class SecondChild {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  data: string;

  @ManyToOne(() => LeaveRequest, request => request.secondChildren) // <<< References 'request.child'
  request: LeaveRequest;
}
