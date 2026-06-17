require('dotenv').config();
const checkEnv = require('./utils/envCheck');
checkEnv();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const codeRoutes = require('./routes/codeRoutes');
const errorHandler = require('./utils/errorhandler');
const requestId = require('./middleware/requestId');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];

app.use(cors({ origin: allowedOrigins, optionsSuccessStatus: 200 }));
app.use(express.json({ limit: '1mb' }));
app.use(requestId);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api', codeRoutes);
app.use(errorHandler);

connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
