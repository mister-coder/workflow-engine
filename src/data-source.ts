import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/User";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "postgres",
  password: "admin",
  database: "workflow_engine_1",
  synchronize: true,
  logging: true,
  // entities: [User],
  entities: [__dirname + "/entities/**/*.ts"],
  migrations: [__dirname + "/migrations/**/*.ts"],
  subscribers: [],
});
