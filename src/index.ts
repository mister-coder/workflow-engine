const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
import { AppDataSource } from "./data-source";
// import leaveRoutes from "./routes/leaveRoutes";

app.use(express.json()); // enable JSON body parsing

app.get('/', (req: any, res: any) => {
    res.send('Hello, World!');
});

// app.use("/leave", leaveRoutes);

async function start() {
  await AppDataSource.initialize();
  console.log("DB connected.");

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
