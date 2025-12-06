import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from "typeorm";
import { Child } from "./child";

@Entity()
export class SubChild {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  data: string;

  // versioning fields in many to one relationship
  @Column({  default: 1, nullable: true })
  version: number;
  @Column({  default: true, nullable: true })
  isActive: boolean;

  @ManyToOne(() => Child, child => child.subChild) // <<< References 'request.child'
  child: Child;
}
