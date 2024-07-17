const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jsonwebtoken = require('jsonwebtoken'); 

const app = express();

require('dotenv').config();

const port = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

app.use(cors());
app.use(express.json());

// Create connection to sql database 
app.use(async function(req, res, next) {
  try {
    req.db = await pool.getConnection();
    req.db.connection.config.namedPlaceholders = true;

    await req.db.query(`SET SESSION sql_mode = "TRADITIONAL"`);
    await req.db.query(`SET time_zone = '-8:00'`);

    await next();

    req.db.release();
  } catch (err) {
    console.log(err);

    if (req.db) req.db.release();
    throw err;
  }
});

// Home page 
app.get('/', async function(req, res) {
  res.send(`<h1>Welcome to my Travel Journal!<h1>`); 
}); 

// Get users 
app.get('/users', async function(req, res) {
  try {
    const [users] = await req.db.query('SELECT * FROM users'); 
    res.json({ users }); 
  } catch (err) {
    console.error(err); 
    res.status(500).json({ msg: `Server Error: ${err}`})
  }
});

// Post User - aka register 
app.post('/register', async function(req, res) {
  try {
    console.log('req.body', req.body)
    const { username, password } = req.body; 
    
    const query = await req.db.query(
      `INSERT INTO users (username, password)
      VALUES (:username, :password)`, 
      {username, password}
      ); 
      
      const jwtEncodedUser = jsonwebtoken.sign(
        { userId: username.insertId, ...req.body}, 
        process.env.JWT_KEY
        ); 
        
        res.json({ success: true, message: 'User successfully registered', data: { username, password }, jwt: jwtEncodedUser})
      } catch (err) {
        res.json({ success: false, message: err, data: null })
      }
    }); 
    
// Login 
app.post('/login', async (req, res) => {
  const { username, password } = req.body; 
  
  const [[user]] = await req.db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]); 
  
  if (user) {
    const token = jsonwebtoken.sign({ id: user.id, username: user.username }, process.env.JWT_KEY); 
    
    res.json({
      jwt: token, 
      success: true
    }); 
  } else {
    res.send('Username or password incorrect')
  }
    }); 
    
// Authenticate JWT 
app.use(async function authenticateJWT (req, res, next) {
  const authHeader = req.headers.authorization; 
  
  if (authHeader) {
    const token = authHeader.split(' ')[1]; 
    
    jsonwebtoken.verify(token, process.env.JWT_KEY, (err, user) => {
      if (err) {
        return res.sendStatus(403); 
      }
      
      req.user = user; 
      next(); 
    });
  } else {
    res.sendStatus(401); 
  }
}); 
    
// Add Entry 
// add later - check if any values are undefined before adding to query 
app.post('/addEntry', async (req, res) => {
  try {
    const { 
      newTitle, 
      newLocation, 
      newStartDate, 
      newEndDate, 
      newDescription, 
      newGoogleMapsUrl, 
      newImgUrl,
    } = req.body;

  const userId = req.user.id;

  const [insert] = await req.db.query(
    `INSERT INTO entries (title, location, startDate, endDate, description, googleMapsUrl, imgUrl, deletedFlag, userId)
    VALUES (:newTitle, :newLocation, :newStartDate, :newEndDate, :newDescription, :newGoogleMapsUrl, :newImgUrl, :deletedFlag, :userId )`,
    { newTitle, 
      newLocation, 
      newStartDate, 
      newEndDate, 
      newDescription, 
      newGoogleMapsUrl, 
      newImgUrl, 
      deletedFlag: 0,
      userId
    }); 

  res.json({ success: true, message: `Entry successfully added!`})
  } catch (err) {
  res.json({ success: false, message: err })
  }
});

// Get user entries
app.get('/home', async function(req, res) {
  try {
    const userId = req.user.id;
    const [entries] = await req.db.query('SELECT * FROM entries WHERE userId = :userId;', { userId }); 

    console.log('entries', entries)
    res.json({ success: true, message: `Welcome to your data!`, data: entries }); 
  } catch (err) {
    console.error(err); 
    res.status(500).json({ msg: `Server Error: ${err}`})
  }
});


// Start Express Server 
app.listen(port, () => console.log(`212 API Example listening on http://localhost:${port}`));