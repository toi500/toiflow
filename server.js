const jwt = require('jsonwebtoken');
const express = require("express");
const axios = require('axios');
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000; 

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('JWT_SECRET not set in environment variables');
  process.exit(1);
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(express.static("public"));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  next();
});

app.get('/api/config', (req, res) => {
  const chatflowId = process.env.CHATFLOW_ID;
  if (!chatflowId) {
    return res.status(500).json({ error: 'CHATFLOW_ID not set in environment variables' });
  }

  const token = jwt.sign({ chatflowId }, JWT_SECRET, { expiresIn: '24h' });
  
  res.json({ token }); 
});

app.get('/api/v1/chatflows-streaming', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.write('data: connected\n\n');
  
  const heartbeat = setInterval(() => {
    res.write(':\n\n'); 
  }, 30000);
  
  req.on('close', () => {
    clearInterval(heartbeat);
    res.end();
  });
});

app.get('/api/v1/public-chatbotConfig', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  });
  res.end('{}');
});

app.use('/api/v1/:endpoint/:token', async (req, res) => {
  const { endpoint, token } = req.params;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const chatflowId = decoded.chatflowId;

    const method = req.method.toLowerCase();
    const url = `${process.env.API_HOST}/api/v1/${endpoint}/${chatflowId}`;

    try {
      if (endpoint === 'prediction') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        const response = await axios.post(url, req.body, { responseType: 'stream' });
        response.data.pipe(res);
      } else {
        const axiosConfig = {
          method,
          url,
          headers: { 'Content-Type': 'application/json' },
          ...(method !== 'get' ? { data: req.body } : { params: req.query }),
        };

        const { data } = await axios(axiosConfig);
        res.json(data);
      }
    } catch (error) {
      console.error(`Error calling ${endpoint} API:`, error);
      res.status(error.response?.status || 500).json({ error: `Failed to fetch data from ${endpoint} API` });
    }
  } catch (error) {
    console.error('Invalid or expired token:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});
