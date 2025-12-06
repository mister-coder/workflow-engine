import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Child } from "./entities/leave/child";
import { ChildSnapshot } from "./entities/leave/childSnapshot";
import { SubChild } from "./entities/leave/subChild";
import { SubChildSnapshot } from "./entities/leave/subChildSnapshot";
import { SecondChild } from "./entities/leave/secondChild";
import { SecondChildSnapshot } from "./entities/leave/secondChildSnapshot";
import { LeaveRequest } from "./entities/leave/LeaveRequest";
import { LeaveRequestSnapshot } from "./entities/leave/LeaveRequestSnapshot";
import { LeaveHistory } from "./entities/leave/LeaveHistory";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "postgres",
  password: "admin",
  database: "workflow_engine_1",
  synchronize: true,
  logging: true,
  entities: [Child, ChildSnapshot, LeaveRequest, User, LeaveRequestSnapshot, SecondChild, SecondChildSnapshot, LeaveHistory, SubChild, SubChildSnapshot],
  // entities: [__dirname + "/entities/leave/*.ts"],
  migrations: [__dirname + "/migrations/**/*.ts"],
  subscribers: [],
});
