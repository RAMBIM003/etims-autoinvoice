require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rate = require('express-rate-limit');

['JWT_SECRET','ENC_KEY','HMAC_KEY','DB_PASSWORD'].forEach(k => {
  if (!process.env[k]) {
    console.warn(`WARNING: ${k} is not set in .env`);
  }
});

const app = express();

const lim = n => rate({
  windowMs: 60000,
  max: n
});

app.set('trust proxy', 1);

app.use(cors({
  origin: [
    'http://127.0.0.1:5500',
    'http://127.0.0.1:550',
    'http://localhost:5500',
    'http://localhost:550'
  ]
}));

app.use(express.json({
  limit: '100kb'
}));

app.use('/api/otp', lim(10));
app.use('/api/kra', lim(20));
app.use('/api/auth', lim(20));
app.use('/api/dashboard', lim(30));

app.use(
  '/api',
  require('./routes/auth'),
  require('./routes/kra'),
  require('./routes/merchant'),
  require('./routes/buyer'),
  require('./routes/items'),
  require('./routes/sales'),
  require('./routes/dashboard')
);

app.use('/api/pay', require('./routes/pay'));

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log('API running on port ' + port);
});
