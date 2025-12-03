import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from "typeorm";
import { SecondChild } from "./secondChild";

@Entity()
export class SecondChildSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  data: string;

  @Column()
  request: string;

  @ManyToOne(() => SecondChild)
  secondChild: SecondChild;
}
