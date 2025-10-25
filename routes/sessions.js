
import express from "express";
import { getDB } from "../database.js";
import crypto from "crypto"; 

const sessionsRouter = express.Router();

// read all sessions
sessionsRouter.get("/", async (req, res) => {
  try {
    const db = getDB();
    // only public sessions, check type from database
    const allSessions = await db.all("SELECT * FROM sessions WHERE sessionType = 'public'");
    res.json(allSessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// read private session (with management code/invite token)
sessionsRouter.get("/private/:managementCode", async (req, res) => {
  try {
    const db = getDB();
    
    const privateSession = await db.get(
      "SELECT * FROM sessions WHERE sessionType = 'private' AND (managementCode = ? OR inviteToken = ?)",
      [req.params.managementCode, req.params.managementCode]
    );
    if (!privateSession) return res.status(404).json({ error: "Session not found or invalid code/token" });
    res.json(privateSession);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// check management code for all sessions (public + private)
sessionsRouter.get("/check-management/:managementCode", async (req, res) => {
  try {
    const db = getDB();

    const session = await db.get(
      "SELECT * FROM sessions WHERE managementCode = ?",
      [req.params.managementCode]
    );

    if (!session) {
      return res.status(404).json({ error: "Invalid management code" });
    }

    res.json(session); // palauttaa session tiedot, sisältäen id:n
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// read one session (from public sessions)
sessionsRouter.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const specificSession = await db.get("SELECT * FROM sessions WHERE id = ? AND sessionType = 'public'", req.params.id);
    if (!specificSession) return res.status(404).json({ error: "Session not found" });
    
    // get attendance count
    const result = await db.get(
      "SELECT COUNT(*) as count FROM attendances WHERE sessionId = ?",
      req.params.id
    );
    // return all session details including participant count from attendances table 
    res.json({
      ...specificSession, 
      participants: result?.count ?? 0 // varmistetaan aina numero 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// read session with participants (public or private)
sessionsRouter.get("/:id/details", async (req, res) => {
  try {
    const db = getDB();
    const session = await db.get("SELECT * FROM sessions WHERE id = ?", req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const attendees = await db.all("SELECT * FROM attendances WHERE sessionId = ?", req.params.id);

    res.json({
      ...session,
      participants: attendees.length,
      attendees
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// create session (generates also management code and inviteToken)
sessionsRouter.post("/", async (req, res) => {
  console.log("/sessions POST received with body:", req.body);
  try {
    const db = getDB();
    const { title, description, date, time, maxParticipants, sessionType, location } = req.body;
    const managementCode = crypto.randomBytes(4).toString("hex"); // managemnt code generated randomly
    let inviteToken = null; // this will be generated if session type is private

    if (sessionType === "private") {
      inviteToken = crypto.randomBytes(8).toString("hex"); // code for private session
    }
    // sql lite returns result-object, which has method lastID (returns automatically created id)
    const result = await db.run(
      `INSERT INTO sessions (title, description, date, time, maxParticipants, sessionType, managementCode, location, inviteToken)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, date, time, maxParticipants, sessionType, managementCode, location, inviteToken]);

      // shareable session link depending on session type
      const shareSessionLink = sessionType === "private"
      ? `/sessions/${result.lastID}/attend?inviteToken=${inviteToken}`
      : `/sessions/${result.lastID}/attend`; // if not private, gives direct link to public session attend

    res.status(201).json({
      message: "Session created succesfully",
      id: result.lastID,
      managementCode,
      managementLink: `/sessions/${result.lastID}/edit?managementCode=${managementCode}`,
      shareSessionLink
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// update session (requires management code)
sessionsRouter.patch("/edit/:id", async (req, res) => {
  try {
    const db = getDB();
    const { managementCode } = req.query; // takes code from url 

    const sessionToUpdate = await db.get("SELECT * FROM sessions WHERE id = ? AND managementCode = ?", [req.params.id, managementCode])
    if (!sessionToUpdate)
            return res.status(404).json({error: "Session not found"}) 
    if (sessionToUpdate.managementCode !== managementCode)
            return res.status(400).json({error: "Incorrect management code"})    
       
        // store new updates
        const updates = [];
        const values = [];

        for(const key of ["title", "description", "date", "time", "maxParticipants", "sessionType", "location"])
          if (req.body[key] !== undefined) {
            updates.push(`${key} = ?`)
            values.push(req.body[key])
        }
      
      if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
      }
      values.push(req.params.id);
      
      await db.run(`UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`, values);
      res.json({ message: "Session updated successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get session details for editing
sessionsRouter.get("/edit/:id", async (req, res) => {
  try {
    const { managementCode } = req.query;
    const db = getDB();

    const session = await db.get(
      "SELECT * FROM sessions WHERE id = ? AND managementCode = ?",
      [req.params.id, managementCode]
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found or incorrect management code" });
    }

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// delete session (requires management code)
sessionsRouter.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { managementCode } = req.query;
    const sessionToDelete = await db.get("SELECT * FROM sessions WHERE id = ?", req.params.id)
        if (!sessionToDelete) 
            return res.status(404).json({error: "Session not found"})
        if (sessionToDelete.managementCode !== managementCode)
            return res.status(400).json({error: "Incorrect management code"})

    await db.run("DELETE FROM sessions WHERE id=?", req.params.id);

    res.json({ message: "Session deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default sessionsRouter;
