const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ status: 'OK', token: process.env.BOT_TOKEN ? 'SET' : 'MISSING' });
});

app.listen(PORT, () => {
    console.log('Server running on port', PORT);
    console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? 'SET' : 'MISSING');
});