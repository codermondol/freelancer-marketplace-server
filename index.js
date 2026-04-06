require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Smart server is running");
});

async function run() {
  try {
    await client.connect();

    const db = client.db("marketplace_db");
    const jobCollection = db.collection("allJobs");
    const taskCollection = db.collection("tasks");

    // add jobs

    app.get("/allJobs", async (req, res) => {
      // const jobFields = {title: 1, coverImage: 1, postedBy: 1, category: 1}
      // const cursor = jobCollection.find().sort({postedAt: 1}).limit(6).project(jobFields);

      const email = req.query.userEmail;
      const query = {};
      if (email) {
        query.userEmail = email;
      }

      const cursor = jobCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/allJobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    app.post("/allJobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobCollection.insertOne(newJob);
      res.send(result);
    });

    app.patch("/allJobs/:id", async (req, res) => {
      const id = req.params.id;
      const updatedAllJobs = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          title: updatedAllJobs.title,
          postedBy: updatedAllJobs.postedBy,
        },
      };
      const result = await jobCollection.updateOne(query, update);
      res.send(result);
    });

    app.delete("/allJobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.deleteOne(query);
      res.send(result);
    });

    // Task manage APis

    app.get("/tasks", async (req, res) => {
      const email = req.query.userEmail;
      const query = {};
      if (email) {
        query.userEmail = email;
      }

      const cursor = taskCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post('/tasks', async(req, res) => {
      const newTask = req.body;
      const result = await taskCollection.insertOne(newTask);
      res.send(result)
    })

    app.delete('/tasks/:id', async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const result = await taskCollection.deleteOne(query)
      res.send(result)
    })

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Smart server is running on port ${port}`);
});
