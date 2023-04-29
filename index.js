const cors = require('cors');
const express = require('express');
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

        app.get('/availableAppointment', async(req, res) =>{
            const query = {};
            const result = await appointmentCollection.find(query).toArray();
            res.send(result)
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