const cors = require('cors');
const express = require('express');
const port = process.env.PORT || 4000;

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', async (req, res) => {
    res.send('Doctors Portal is Running');
});

app.listen(port, () => {
    console.log("app is running on", port);
});