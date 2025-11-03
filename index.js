const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");

const serviceAccount = require("./smart-deals-shop-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
  console.log("login info");
  next();
};

const verifyFirebaseToken = async(req, res, next) => {
  console.log("firebase verify", req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    req.token_email= userInfo.email
    // console.log(userInfo);
    next();
  } catch {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g0ilve4.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("smart deals server running");
});

async function run() {
  try {
    await client.connect();

    const db = client.db("smart_deals_db");
    const productsCollection = db.collection("products");
    const bidsCollection = db.collection("bids");
    const usersCollection = db.collection("users");

    //USERS APIS
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        res.send({
          message: "user already exist in db, do not need to add again",
        });
      } else {
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      }
    });

    // PRODUCTS APIS
    app.get("/products", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const cursor = productsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/latestProducts", async (req, res) => {
      const cursor = productsCollection
        .find()
        .sort({ created_at: -1 })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    app.post("/products", async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          name: updatedProduct.name,
          price: updatedProduct.price,
        },
      };
      const result = await productsCollection.updateOne(query, update);
      res.send(result);
    });

    app.get("/products", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (query.email) {
        query.sellerEmail = email;
      }
      const cursor = productsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // bids related apis
    app.get("/bids", logger, verifyFirebaseToken, async (req, res) => {
      // console.log(req.headers);
      const email = req.query.email;
      const query = {};
      if (email) {
        if(email !== req.token_email){
            return res.status(403).send({message:'frobidden access'})
        }
        query.buyerEmail = email;
      }

      const cursor = bidsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/products/bids/:productId", async (req, res) => {
      const productId = req.params.productId;
      const query = { productId: productId };
      const cursor = bidsCollection.find(query).sort({ offeredPrice: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // app.get('/bids',async(req,res)=>{
    //     const query = {}
    //     if(query.email){
    //         query.buyerEmail= email
    //     }
    //     const cursor = bidsCollection.find(query)
    //     const result = await cursor.toArray()
    // })

    app.post("/bids", async (req, res) => {
      const newBid = req.body;
      newBid.offeredPrice = Number(newBid.offeredPrice);
      const result = await bidsCollection.insertOne(newBid);
      res.send(result);
    });

    app.delete("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bidsCollection.deleteOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`smart deals server running on port : ${port}`);
});
