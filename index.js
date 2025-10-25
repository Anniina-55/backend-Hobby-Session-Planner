
import express from "express";
import cors from "cors";
import dotenv from "dotenv"
dotenv.config();

import { initializeDB, getDB } from "./database.js";
import sessionsRouter from "./routes/sessions.js"
import attendanceRouter from "./routes/attendance.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors()); 
app.use(express.json());

// start db before starting server
initializeDB()
  .then(() => {
  app.use("/sessions", sessionsRouter); // sessions is the endpoint for all sessio-related routes
  app.use("/attendance", attendanceRouter) // and this for attendance-related routes

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

})
 .catch(err => {
    console.error("Failed to initialize database:", err);
  });



