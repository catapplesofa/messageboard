"use strict";

const { Board: BoardModel, Thread: ThreadModel, Reply: ReplyModel } = require("../models.js");

module.exports = function (app) {
  app
    .route("/api/threads/:board")
    .post(async (req, res) => {
      try {
        const { text, delete_password } = req.body;
        let board = req.body.board || req.params.board;
        const newThread = new ThreadModel({
          text: text,
          delete_password: delete_password,
          replies: [],
          created_on: new Date().toISOString(),  // Consistent ISO format for created_on
          bumped_on: new Date().toISOString(),   // Consistent ISO format for bumped_on
        });

        const boardData = await BoardModel.findOne({ name: board });

        if (!boardData) {
          const newBoard = new BoardModel({
            name: board,
            threads: [newThread],
          });

          const savedBoard = await newBoard.save();
          return res.json(newThread);
        }

        boardData.threads.push(newThread);
        await boardData.save();
        res.json(newThread);
      } catch (err) {
        console.log(err);
        res.send("There was an error saving in post");
      }
    })
    .get(async (req, res) => {
      try {
        const board = req.params.board;
        const data = await BoardModel.findOne({ name: board });

        if (!data) {
          return res.json({ error: "No board with this name" });
        }

        const threads = data.threads
          .sort((a, b) => new Date(b.bumped_on) - new Date(a.bumped_on))  // Sort by bumped_on date
          .slice(0, 10)  // Only return the 10 most recent threads
          .map((thread) => {
            const { _id, text, created_on, bumped_on, reported, delete_password, replies } = thread;
            return {
              _id,
              text,
              created_on,
              bumped_on,
              reported,
              delete_password,
              replies: replies.slice(0, 3),  // Return only the 3 most recent replies
              replycount: thread.replies.length,
            };
          });
        res.json(threads);
      } catch (err) {
        console.log(err);
        res.json({ error: "There was an error fetching threads" });
      }
    })
    .put(async (req, res) => {
      try {
        const { report_id } = req.body;
        const board = req.params.board;

        const boardData = await BoardModel.findOne({ name: board });

        if (!boardData) {
          return res.json({ error: "Board not found" });
        }

        const date = new Date().toISOString();  // Use ISO format for bumped_on date
        const reportedThread = boardData.threads.id(report_id);

        if (reportedThread) {
          reportedThread.reported = true;
          reportedThread.bumped_on = date;

          await boardData.save();
          res.send("reported");  // Ensure response is 'reported'
        } else {
          res.json({ error: "Thread not found" });
        }
      } catch (err) {
        console.log(err);
        res.json({ error: "There was an error reporting the thread" });
      }
    })
    .delete(async (req, res) => {
      try {
        const { thread_id, delete_password } = req.body;
        const board = req.params.board;

        const boardData = await BoardModel.findOne({ name: board });

        if (!boardData) {
          return res.json({ error: "Board not found" });
        }

        const threadToDelete = boardData.threads.id(thread_id);

        if (threadToDelete.delete_password === delete_password) {
          // Mark the thread as deleted (instead of just setting 'text' to '[deleted]')
          threadToDelete.text = "[deleted]";
          await boardData.save();
          res.send("success");  // Return 'success' after deletion
        } else {
          res.send("incorrect password");
        }
      } catch (err) {
        console.log(err);
        res.json({ error: "There was an error deleting the thread" });
      }
    });

  app
    .route("/api/replies/:board")
    .post(async (req, res) => {
      try {
        const { thread_id, text, delete_password } = req.body;
        const board = req.params.board;
        const newReply = new ReplyModel({
          text: text,
          delete_password: delete_password,
          created_on: new Date().toISOString(),  // Consistent ISO format for replies
        });

        const boardData = await BoardModel.findOne({ name: board });

        if (!boardData) {
          return res.json({ error: "Board not found" });
        }

        const date = new Date().toISOString();  // Ensure bumped_on date is updated with ISO format
        const threadToAddReply = boardData.threads.id(thread_id);
        threadToAddReply.bumped_on = date;
        threadToAddReply.replies.push(newReply);

        await boardData.save();
        res.json(boardData);
      } catch (err) {
        console.log(err);
        res.json({ error: "There was an error adding the reply" });
      }
    })
    .get(async (req, res) => {
      try {
        const board = req.params.board;
        const data = await BoardModel.findOne({ name: board });

        if (!data) {
          return res.json({ error: "No board with this name" });
        }

        const thread = data.threads.id(req.query.thread_id);
        if (!thread) {
          return res.json({ error: "Thread not found" });
        }

        res.json(thread);
      } catch (err) {
        console.log(err);
        res.json({ error: "There was an error fetching the reply" });
      }
    })
    .put(async (req, res) => {
      try {
        const { thread_id, reply_id } = req.body;
        const board = req.params.board;

        const data = await BoardModel.findOne({ name: board });

        if (!data) {
          return res.json({ error: "No board with this name" });
        }

        const thread = data.threads.id(thread_id);
        const reply = thread.replies.id(reply_id);

        if (reply) {
          reply.reported = true;
          reply.bumped_on = new Date().toISOString();  // Consistent ISO format for replies
          await data.save();
          res.send("reported");  // Ensure response is 'reported' after reporting
        } else {
          res.json({ error: "Reply not found" });
        }
      } catch (err) {
        console.log(err);
        res.json({ error: "There was an error reporting the reply" });
      }
    })
    .delete(async (req, res) => {
      try {
        const { thread_id, reply_id, delete_password } = req.body;
        const board = req.params.board;

        const data = await BoardModel.findOne({ name: board });

        if (!data) {
          return res.json({ error: "No board with this name" });
        }

        const thread = data.threads.id(thread_id);
        const reply = thread.replies.id(reply_id);

        if (!reply) {
          return res.json({ error: "Reply not found" });
        }

        if (reply.delete_password === delete_password) {
          // Mark the reply as deleted instead of just removing it
          reply.text = "[deleted]";
          await data.save();
          res.send("success");  // Return 'success' after deletion
        } else {
          res.send("incorrect password");
        }
      } catch (err) {
        console.log(err);
        res.json({ error: "There was an error deleting the reply" });
      }
    });
};


