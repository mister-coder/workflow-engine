import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from "typeorm";
import { SubChild } from "./subChild";

@Entity()
export class SubChildSnapshot {
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

  @ManyToOne(() => SubChild)
  subChild: SubChild;
}
