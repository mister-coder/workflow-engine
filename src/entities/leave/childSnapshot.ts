import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from "typeorm";
import { Child } from "./child";

@Entity()
export class ChildSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  data: string;

  @Column()
  request: string;

  @ManyToOne(() => Child)
  child: Child;
}
