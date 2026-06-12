const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const chalk = require('chalk');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const configPath = path.join(__dirname, 'config.json');
let config = {
  port: process.env.PORT || 80,
  secretToken: 'TradingView2026',
  mt4OutputMethod: 'file',
  mt4HttpEndpoint: 'http://localhost:8080/webhook',
  mt4DataFolder: path.join(__dirname, 'mt4_data'),
  logRetentionDays: 7,
  enableDebugging: true
};

if (fs.existsSync(configPath)) {
  try {
    const savedConfig = fs.readJsonSync(configPath);
    config = { ...config, ...savedConfig };
  } catch (err) {
    console.log(chalk.yellow('Config file error, using defaults'));
  }
} else {
  fs.writeJsonSync(configPath, config, { spaces: 2 });
}

fs.ensureDirSync(config.mt4DataFolder);

const logsFile = path.join(__dirname, 'webhook_logs.json');
let webhookLogs = [];
if (fs.existsSync(logsFile)) {
  try {
    webhookLogs = fs.readJsonSync(logsFile);
  } catch (err) {
    webhookLogs = [];
  }
} else {
  fs.writeJsonSync(logsFile, webhookLogs, { spaces: 2 });
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const authenticateWebhook = (req, res, next) => {
  const token = req.headers['x-webhook-token'] || req.query.token || req.body.token;
  if (!token || token !== config.secretToken) {
    console.log(chalk.red(`Auth failed from ${req.ip}`));
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
};

function logWebhook(data, status, error = null) {
  const logEntry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    ip: data.ip || 'unknown',
    payload: data.payload,
    status: status,
    error: error,
    forwarded: data.forwarded || false
  };
  webhookLogs.unshift(logEntry);
  if (webhookLogs.length > 1000) webhookLogs = webhookLogs.slice(0, 1000);
  fs.writeJsonSync(logsFile, webhookLogs, { spaces: 2 });
  io.emit('new-log', logEntry);
  return logEntry;
}

function sendToMT4File(signal) {
  try {
    const timestamp = Date.now();
    const fileName = `signal_${timestamp}.json`;
    const filePath = path.join(config.mt4DataFolder, fileName);
    const mt4Signal = { timestamp: new Date().toISOString(), unixTime: timestamp, ...signal, processed: false };
    fs.writeJsonSync(filePath, mt4Signal, { spaces: 2 });
    console.log(chalk.green(`Signal written: ${fileName}`));
    return { success: true, filePath };
  } catch (error) {
    console.log(chalk.red(`File error: ${error.message}`));
    return { success: false, error: error.message };
  }
}

app.post('/webhook', authenticateWebhook, (req, res) => {
  console.log(chalk.blue(`\nWebhook received at ${new Date().toISOString()}`));
  console.log(chalk.blue(`Body: ${JSON.stringify(req.body)}`));
  
  if (!req.body || !req.body.action) {
    const error = 'Missing action field';
    logWebhook({ ip: req.ip, payload: req.body }, 'REJECTED', error);
    return res.status(400).json({ error: error });
  }
  
  const signal = {
    action: req.body.action.toUpperCase(),
    symbol: req.body.symbol || req.body.ticker || 'EURUSD',
    price: req.body.price || 0,
    quantity: req.body.quantity || req.body.qty || 0.1,
    comment: req.body.comment || ''
  };
  
  if (signal.action === 'LONG') signal.action = 'BUY';
  if (signal.action === 'SHORT') signal.action = 'SELL';
  
  const result = sendToMT4File(signal);
  
  if (result.success) {
    logWebhook({ ip: req.ip, payload: req.body, forwarded: true }, 'ACCEPTED');
    res.json({ status: 'success', signal: signal });
  } else {
    logWebhook({ ip: req.ip, payload: req.body }, 'FAILED', result.error);
    res.status(500).json({ error: result.error });
  }
});

app.get('/test', (req, res) => {
  res.json({ status: 'test_success', message: 'Bridge is running' });
});

app.get('/api/config', (req, res) => {
  res.json({ ...config, secretToken: '***hidden***' });
});

app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(webhookLogs.slice(0, limit));
});

app.delete('/api/logs', (req, res) => {
  webhookLogs = [];
  fs.writeJsonSync(logsFile, webhookLogs, { spaces: 2 });
  res.json({ success: true });
});

app.get('/api/latest-signal', authenticateWebhook, (req, res) => {
  const signalFiles = fs.readdirSync(config.mt4DataFolder)
    .filter(f => f.startsWith('signal_') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (signalFiles.length === 0) {
    return res.status(404).json({ error: 'No signals available' });
  }
  
  const latestFile = path.join(config.mt4DataFolder, signalFiles[0]);
  const signal = fs.readJsonSync(latestFile);
  res.json(signal);
});

app.get('/api/generate-ea', (req, res) => {
  res.setHeader('Content-Type', 'application/x-mq4');
  res.setHeader('Content-Disposition', 'attachment; filename="TradingViewBridge_EA.mq4"');
  res.send('//+------------------------------------------------------------------+\n//| TradingView Bridge EA                                              |\n//+------------------------------------------------------------------+');
});

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  console.log(chalk.cyan('WebSocket client connected'));
  socket.emit('initial-logs', webhookLogs.slice(0, 50));
});

const PORT = process.env.PORT || config.port;
server.listen(PORT, '0.0.0.0', () => {
  console.log(chalk.green('\n========================================'));
  console.log(chalk.green('TradingView to MT4 Bridge v1.0'));
  console.log(chalk.green(`Running on http://0.0.0.0:${PORT}`));
  console.log(chalk.green('========================================\n'));
  console.log(chalk.cyan(`Webhook URL: http://localhost:${PORT}/webhook`));
  console.log(chalk.yellow(`Token: ${config.secretToken}`));
  console.log(chalk.cyan(`Dashboard: http://localhost:${PORT}\n`));
});
