const express = require('express');
const cors = require("cors");
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 4000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

// app.use(cors());
app.use(express.json());
const corsConfig = {
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  };
  
  app.use(cors(corsConfig));
  app.options(cors(corsConfig));


const uri = `mongodb+srv://${process.env.DOC_user}:${process.env.DOC_password}@cluster0.f1kxzik.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});




function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' })
    };

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
    });

    next();
};




async function run() {
    try {

        const appointmentCollection = client.db("doctors-portal").collection("AvailableAppointment");
        const bookingsCollection = client.db("doctors-portal").collection("Bookings");
        const usersCollection = client.db("doctors-portal").collection("users");
        const doctorsCollection = client.db("doctors-portal").collection("Doctors");
        const paymentCollection = client.db("doctors-portal").collection("Payment");



        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester })

            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                res.status(403).send({ message: 'forbidden' })
            }
        }


        /* ========================================================================================================== */
        app.get('/availableAppointment', async (req, res) => {
            const date = req.query.date;
            const query = {};
            const options = await appointmentCollection.find(query).toArray();

            const bookingQuery = { appointmentDate: date }
            const bookedDate = await bookingsCollection.find(bookingQuery).toArray();

            options.forEach(option => {
                const optionBooked = bookedDate.filter(booked => booked.treatment === option.name)

                const bookedSlots = optionBooked.map(book => book.period);
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots;
            })

            res.send(options)
        });



        app.get('/specialty', async (req, res) => {
            const result = await appointmentCollection.find().project({ name: 1 }).toArray();
            res.send(result);
        });


        /* ========================================================================================================== */
        app.get('/doctors', verifyJWT, async (req, res) => {
            const doctors = await doctorsCollection.find().toArray();
            res.send(doctors);
        });


        app.post('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result)
        });


        app.delete('/doctors/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const result = await doctorsCollection.deleteOne(filter);
            res.send(result);
        });


        /* ========================================================================================================== */

        app.get('/users', verifyJWT, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });


        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            res.send(result);
        });



        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;

            const filter = { email: email };
            const options = { upsert: true };

            const updateDoc = {
                $set: user
            };

            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN)

            res.send({ result, token });
        });


        /* ========================================================================================================== */
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        });



        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };

            const updateDoc = {
                $set: { role: 'admin' }
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        });



        /* ========================================================================================================== */
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req?.decoded?.email;

            if (email === decodedEmail) {
                const query = { email: email };
                const result = await bookingsCollection.find(query).toArray();
                return res.send(result);
            } else {
                return res.status(403).send({ message: 'forbidden access' })
            }
        });



        app.get('/bookings/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const booking = await bookingsCollection.findOne(query)
            res.send(booking)
        });


        app.post('/bookings', async (req, res) => {
            const booking = req.body;

            const query = {
                appointmentDate: booking.appointmentDate,
                email: booking.email,
                treatment: booking.treatment
            }

            const alreadyBooked = await bookingsCollection.findOne(query);
            if (alreadyBooked) {
                res.send({ success: false, booking: alreadyBooked })
            }

            const result = bookingsCollection.insertOne(booking);
            res.send({ success: true, result });
        });



        app.patch('/bookings/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: new ObjectId(id) }
            // console.log(payment.transactionId);

            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentCollection.insertOne(payment)
            const updatedBooking = await bookingsCollection.updateOne(filter, updateDoc)
            res.send(updatedBooking);
        });




        /* ========================================================================================================== */
        app.get('/all-payment', verifyJWT, async (req, res) => {
            const result = await paymentCollection.find().toArray();
            res.send(result);
        });


        /* ========================================================================================================== */
        app.post('/create-payment-intent', async (req, res) => {
            const service = req.body;
            // console.log(service);
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });

            res.send({ clientSecret: paymentIntent.client_secret });
        });

    }

    finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
    res.send('Doctors Portal is Running');
});

app.listen(port, () => {
    console.log("app is running on", port);
});