const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const jwt = require('jsonwebtoken')

const app = express();
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}


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
        const selectedClassCollection = database.collection("selectedClasses");
        const paymentCollection = database.collection("payments");

        // Warning: use verifyJWT before using verifyInstructor
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        // Warning: use verifyJWT before using verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        // jwt implement
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        // users api
        app.get('/users', async (req, res) => {
            result = await userCollection.find().toArray();
            res.send(result)
        })

        app.get('/manage-users', verifyJWT, verifyAdmin, async (req, res) => {
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
            const query = { status: 'approved' };
            result = await classCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/popular-classes', async (req, res) => {
            const query = { status: 'approved' };
            const sortOptions = { enrollment: -1 }
            result = await classCollection.find(query).sort(sortOptions).limit(6).toArray();
            res.send(result);
        })

        app.get('/instructor', async (req, res) => {
            const query = { role: 'instructor' };
            result = await userCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/popular-instructor', async (req, res) => {
            const query = { role: 'instructor' };
            const sortOptions = { enrollment: -1 }
            result = await userCollection.find(query).sort(sortOptions).limit(6).toArray();
            res.send(result);
        })

        app.get('/manage-classes', verifyJWT, verifyAdmin, async (req, res) => {
            result = await classCollection.find().toArray();
            res.send(result);
        })

        app.get('/my-classes', verifyJWT, verifyInstructor, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }

            const query = { 'instructor.email': email };
            const result = await classCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/classes/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classCollection.findOne(query);
            res.send(result);
        })

        app.post('/add-class', verifyJWT, verifyInstructor, async (req, res) => {
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

        // selected class for student api
        app.get('/selected-class', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { studentEmail: email }
            const result = await selectedClassCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/selected-class/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassCollection.findOne(query);
            res.send(result);
        })

        app.post('/selected-class', verifyJWT, async (req, res) => {
            const newSelectedClass = req.body;
            const result = await selectedClassCollection.insertOne(newSelectedClass);
            res.send(result)
        })

        app.delete('/selected-class/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassCollection.deleteOne(query);
            res.send(result)

        })


        // create payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        // payment relate api
        app.get('/payments', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const sortOptions = { date: -1 };
            const query = { email: email }
            const result = await paymentCollection.find(query).sort(sortOptions).toArray();
            res.send(result)
        })

        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const id = payment.classId;
            const insertResult = await paymentCollection.insertOne(payment);
            // delete selected class
            const deletedQuery = { classId: id };
            console.log(id);
            const deleteResult = await selectedClassCollection.deleteOne(deletedQuery);
            // Update class enrollment and reduce seat
            const updatedQuery = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $inc: { total_seats: -1, enrollment: 1 }
            };
            const updatedResult = await classCollection.updateOne(updatedQuery, updateDoc, options);

            res.send({ insertResult, deleteResult, updatedResult });
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
