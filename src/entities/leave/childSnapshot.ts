import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from "typeorm";
import { Child } from "./child";

@Entity()
export class ChildSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  data: string;

  // versioning fields in many to one relationship
  @Column({  nullable: true })
  version: number;
  @Column({  nullable: true })
  isActive: boolean;

  @Column()
  request: string;

  @ManyToOne(() => Child)
  child: Child;
}
