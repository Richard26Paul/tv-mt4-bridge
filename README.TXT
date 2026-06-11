# TradingView to MT4 Webhook Bridge

A complete solution to receive TradingView webhook alerts and forward them to MetaTrader 4 for automated trading execution.

## 🚀 Features

- **Webhook Receiver** - Accepts TradingView alerts via HTTP POST
- **GUI Dashboard** - Web-based interface to monitor and manage signals
- **Real-time Logging** - Live debug console with WebSocket updates
- **Multiple MT4 Integration Methods**:
  - File-based (recommended) - Most reliable, no network configuration needed
  - HTTP Bridge - Direct API calls to MT4 bridge server
- **MT4 Expert Advisor** - Auto-generated EA file included
- **Signal Validation** - Handles multiple TradingView payload formats
- **Debug Console** - Live debugging of incoming/outgoing alerts
- **Security** - Token-based authentication for webhooks

## 📋 Prerequisites

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **MetaTrader 4** - Running on Windows
- **TradingView Account** - For creating webhook alerts

## 🔧 Installation

### 1. Install Node.js and npm

Download and install Node.js from the official website. This includes npm (Node Package Manager).

### 2. Download the Bridge

Create a new folder for the bridge:

```bash
mkdir tradingview-mt4-bridge
cd tradingview-mt4-bridge
