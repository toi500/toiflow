const express = require('express');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const FormData = require('form-data');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const cors = require('cors');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;
const API_HOST = process.env.API_HOST;
const CHATFLOW_ID = process.env.CHATFLOW_ID;

if (!JWT_SECRET || !API_HOST || !CHATFLOW_ID) {
  process.exit(1);
}

app.use(express.json({ limit: '100mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static('public'));
app.use(cors({
  origin: null,
  methods: null,
  allowedHeaders: null
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/config', (req, res) => {
  const token = jwt.sign({ chatflowId: CHATFLOW_ID }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

const authenticateJWT = (req, res, next) => {
  const token = req.params.token;
  if (!token) return res.status(403).json({ error: 'No token provided' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.chatflowId = decoded.chatflowId;
    next();
  });
};

app.all('/api/v1/:endpoint/:token', authenticateJWT, async (req, res) => {
  const { endpoint } = req.params;
  const chatflowId = req.chatflowId;

  try {
    const method = req.method.toLowerCase();
    const url = `${API_HOST}/api/v1/${endpoint}/${chatflowId}`;

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
    res.status(error.response?.status || 500).json({ error: 'API Error' });
  }
});

app.post('/api/v1/attachments/:token/:chatId', authenticateJWT, multer().array('files'), async (req, res) => {
  try {
    const form = new FormData();
    if (!req.files?.length) throw new Error();
    
    req.files.forEach(file => {
      form.append('files', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    });

    const response = await axios({
      method: 'POST',
      url: `${API_HOST}/api/v1/attachments/${req.chatflowId}/${req.params.chatId}`,
      headers: { ...form.getHeaders() },
      data: form
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
