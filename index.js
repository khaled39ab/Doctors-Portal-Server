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



        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };

            const updateDoc = {
                $set: user
            };

            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const accessToken = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })

            res.send({ result, accessToken });
        })



        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
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