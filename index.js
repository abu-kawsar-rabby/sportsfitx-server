const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xvfigcf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // database collection
        const database = client.db("sportsfitxDB");
        const userCollection = database.collection("users");
        const classCollection = database.collection("classes");

        // users api
        app.get('/users', async (req, res) => {
            result = await userCollection.find().toArray();
            res.send(result)
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            if (!email) {
                res.send([]);
            }
            const query = { email: email }
            result = await userCollection.findOne(query)
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id
            const role = req.body
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: role,
            }
            const result = await userCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        // classes api
        app.get('/classes', async (req, res) => {
            result = await classCollection.find().toArray();
            res.send(result);
        })

        app.get('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classCollection.findOne(query);
            res.send(result);
        })

        app.post('/classes', async (req, res) => {
            const newClass = req.body;
            const result = await classCollection.insertOne(newClass);
            res.send(result)
        })

        app.put('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const updatedClass = req.body;

            const query = { _id: new ObjectId(id) };
            const options = { upsert: true };

            const updateDoc = {
                $set: updatedClass,
            };
            const result = await classCollection.updateOne(query, updateDoc, options);
            res.send(result)

        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('sportfitx server in running')
})

app.listen(port, () => {
    console.log(`sportfitx running on port: ${port}`)
})
