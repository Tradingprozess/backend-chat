require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { setupSocketServer } = require('./sockets/socket');
const autoSyncRouter = require('./routes/auto-sync-router');
const bodyParser = require("body-parser");

// Create Express app
const app = express();
setupSocketServer(app);

// Middleware

app.use(bodyParser.json({limit: "100mb"}));
app.use(bodyParser.urlencoded({limit: "100mb", extend: true, parameterLimit: 50000}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use('/auto-sync', autoSyncRouter)

app.use("/heath-check",(req,res)=>{
  res.send("Everything working fine")
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;