import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from "typeorm";
import { SecondChild } from "./secondChild";

@Entity()
export class SecondChildSnapshot {
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

  @ManyToOne(() => SecondChild)
  secondChild: SecondChild;
}
