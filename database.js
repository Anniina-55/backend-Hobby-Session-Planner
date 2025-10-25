// database initializion 
import pkg from "pg";
import dotenv from "dotenv"; // library that reads the .env file
import { open } from "sqlite";

dotenv.config(); // loads the .env file into Node.js environment variables

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT,
  ssl: { rejectUnauthorized: false },
});

// DATABASE_URL-variable from azure
export async function initializeDB() {
  // table for sessions
  // this command is executed without blocking the program,
  // but the function itself waits for it to complete
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      maxParticipants INTEGER,
      sessionType TEXT NOT NULL,
      managementCode TEXT UNIQUE NOT NULL,
      location TEXT NOT NULL,
      inviteToken TEXT UNIQUE
    )`
  );

  //table for attendances
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendances (
      id SERIAL PRIMARY KEY,
      sessionId INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      name TEXT,
      attendanceCode TEXT UNIQUE NOT NULL
    )
  `);

  return pool; 
}

// return db-object
export function getDB() {
  if (!pool) {
    throw new Error("Database not initialized yet")
  } 
    return pool;  
}
