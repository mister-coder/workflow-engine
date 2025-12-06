import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, OneToMany } from "typeorm";
import { LeaveRequest } from "./LeaveRequest";
import { SubChild } from "./subChild";

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
  
  @OneToMany(() => SubChild, subChild => subChild.child) 
  subChild: SubChild[];
}
