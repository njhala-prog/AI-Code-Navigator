const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const codeRoutes = require('./routes/codeRoutes');  
const errorHandler = require('./utils/errorhandler');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api', codeRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));