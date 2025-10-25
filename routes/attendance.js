import express from "express";
import { getDB } from "../database.js";
import crypto from "crypto"; 

const attendanceRouter = express.Router();

// anyone can join to sessions, rights to join are verified with inviteToken in case session is private
attendanceRouter.post("/:id/attend", async (req, res) => {
  try {
    const db = await getDB();
    const { name } = req.body || {}; // giving name/nickname is optional
    const sessionId = req.params.id;
    const inviteToken = req.query.inviteToken || null; 

    // verify session existence
    const session = await db.get("SELECT * FROM sessions WHERE id = ?", sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    // check if private session and validate inviteToken
    if (session.sessionType === "private") {
      if (!inviteToken || inviteToken !== session.inviteToken) {
        return res.status(403).json({ error: "Access denied to private session" });
      }
    }

    // check if session is already full
    const { count } = await db.get(
      "SELECT COUNT(*) AS count FROM attendances WHERE sessionId = ?",
      sessionId
    );

    if (count >= session.maxParticipants) {
      return res.status(400).json({ error: "Session is already full" });
    }
    // generate attendance code with crypto
    const attendanceCode = crypto.randomBytes(4).toString("hex");
    // add attendee to database
    const result = await db.run(
      `INSERT INTO attendances (sessionId, name, attendanceCode)
       VALUES (?, ?, ?)`,
      [sessionId, name || "Anonymous", attendanceCode]
    );
        // check insert to db was succesfull
        if (result.changes === 0) {
            return res.status(500).json({ error: "Failed to join session" });
        }
        // if successfull, return message and code
        res.status(201).json({
        message: "Joined session successfully",
        attendanceCode,
        });
    // catch if ther's internal sever error
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// route to cancel participation (anyone with attendance code to specific session)
attendanceRouter.delete("/:id/cancelAttendance", async (req, res) => {
  try {
    const db = await getDB();
    const sessionId = req.params.id;
    const attendanceCode = req.query.attendanceCode;
    // if code not given or wrong
    if (!attendanceCode) {
      return res.status(400).json({ error: "Wrong/missing attendance code" });
    }
    const result = await db.run(
      "DELETE FROM attendances WHERE sessionId = ? AND attendanceCode = ?",
      [sessionId, attendanceCode]
    );
        // check that there's session where to cancel participation (some row got actually removed)
        if (result.changes === 0) {
        return res.status(404).json({ error: "Attendance not found for this session" });
        }
        // if successfull, return message
        res.json({ message: "Attendance cancelled successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// route to check attendance code and get corresponding session
attendanceRouter.get("/check", async (req, res) => {
  try {
    const db = await getDB();
    const { attendanceCode } = req.query;

    if (!attendanceCode) {
      return res.status(400).json({ error: "Missing attendance code" });
    }
    // find attendance row
    const attendance = await db.get(
      "SELECT * FROM attendances WHERE attendanceCode = ?",
      attendanceCode
    );

    if (!attendance) {
      return res.status(404).json({ error: "Attendance code not found" });
    }
    // get the session corresponding to this attendance
    const session = await db.get(
      "SELECT * FROM sessions WHERE id = ?",
      attendance.sessionId
    );
    if (!session) {
      return res.status(404).json({ error: "Session not found for this attendance" });
    }
    // return session data + attendance code
    res.json({ session, attendanceCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// get all attendees (requiures management code from session creator)
attendanceRouter.get("/:id/attendees", async (req, res) => {
  try {
    const db = getDB();
    const { managementCode } = req.query;
    const sessionId = req.params.id;

    // check managemet code and session match
    const session = await db.get("SELECT * FROM sessions WHERE id = ?", sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.managementCode !== managementCode)
      return res.status(400).json({ error: "Incorrect management code" });

    // next get all attendees (id and possible name)
    const attendees = await db.all(
      "SELECT id, name FROM attendances WHERE sessionId = ?",
      sessionId
    );
    // check if there's attendees
     if (!attendees || attendees.length === 0) {
      return res.status(404).json({ error: "No attendees found for this session" });
    }
    // if successfull, return attendees
    res.json(attendees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// delete specific attendee (requires management code)
attendanceRouter.delete("/:id/attendees/:attendeeId", async (req, res) => {
  try {
    const db = getDB();
    const { managementCode } = req.query;
    const sessionId = req.params.id;
    const attendeeId = req.params.attendeeId;

    // verify session and management code
    const session = await db.get("SELECT * FROM sessions WHERE id = ?", sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.managementCode !== managementCode)
      return res.status(403).json({ error: "Invalid management code" });

    // remove attendee
    const result = await db.run(
      "DELETE FROM attendances WHERE id = ? AND sessionId = ?",
      [attendeeId, sessionId]
    );

    if (result.changes === 0)
      return res.status(404).json({ error: "Attendee not found" });

    res.json({ message: "Attendee removed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default attendanceRouter;