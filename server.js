const express = require("express");
const axios = require('axios');
const crypto = require('crypto');
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000; // Set the port to 3000 or use the PORT environment variable if set

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(express.static("public"));

const chatflowMap = new Map();

app.get('/api/config', (req, res) => {
  const chatflowId = process.env.CHATFLOW_ID;
  if (!chatflowId) {
    return res.status(500).json({ error: 'CHATFLOW_ID not set in environment variables' });
  }
  
  const token = crypto.randomBytes(16).toString('hex'); // Generate a random token for the chatflow
  chatflowMap.set(token, chatflowId);
  
  res.json({
    token: token,
    apiHost: process.env.API_HOST,
    chatflowConfig: {
      fileUpload: {
        enabled: true,
      }
    }
  });
});

app.use('/api/v1/:endpoint/:token', async (req, res) => {
  const { endpoint, token } = req.params;
  const chatflowId = chatflowMap.get(token);

  if (!chatflowId) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  const method = req.method.toLowerCase();
  const url = `${process.env.API_HOST}/api/v1/${endpoint}/${chatflowId}`; // Construct the URL for the Flowise API

  try {
    if (endpoint === 'prediction') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const response = await axios({
        method: 'post',
        url: url,
        data: req.body,
        responseType: 'stream'
      });

      response.data.on('data', (chunk) => {
        res.write(chunk);
      });

      response.data.on('end', () => {
        res.end();
      });
    } else {
      const axiosConfig = {
        method: method,
        url: url,
        headers: {
          'Content-Type': 'application/json',
        },
        data: method !== 'get' ? req.body : undefined,
        params: method === 'get' ? req.query : undefined,
      };

      const response = await axios(axiosConfig);
      res.json(response.data);
    }
  } catch (error) {
    console.error(`Error calling ${endpoint} API:`, error);
    res.status(error.response?.status || 500).json({ error: `Failed to fetch data from ${endpoint} API` });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});
