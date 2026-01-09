const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());

app.post('/test', (req, res) => {
  console.log('Body:', req.body);
  res.json({ received: req.body });
});

app.listen(3001, () => {
  console.log('Test server on http://localhost:3001');
});
