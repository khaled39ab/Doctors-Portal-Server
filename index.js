const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 4000;

const app = express();

app.use(cors());
app.use(express.json());



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
    // console.log(authHeader);
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



        app.get('/users', async (req, res) => {
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
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '10h' })

            res.send({ result, token });
        });



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