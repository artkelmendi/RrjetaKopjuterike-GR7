const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const cors = require('cors');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app); // Create HTTP server
const io = socketIo(server); // Attach Socket.IO to the server

let currentPort = 3000;
const clients = []; // Array to store connected client information

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

// Helper function to get IP address
const getIPAddress = () => {
    const interfaces = os.networkInterfaces();
    for (let name in interfaces) {
        for (let iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
};

// Serve the main HTML file at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'serverHTML.html'));
});

// Endpoint to test client connection and log connection details
app.post('/connect', (req, res) => {
    const { name, port } = req.body;
    const clientIP = req.ip;

    const clientInfo = {
        ip: clientIP,
        name: name || 'Anonymous',
        port: port,
        connectedAt: new Date().toISOString()
    };

    clients.push(clientInfo); // Add client info to the array

    // Emit the updated client count to all connected clients
    io.emit('clientCountUpdate', clients.length);

    res.json({ message: 'Connection successful!', clientInfo });
});

// Endpoint to get the list of connected clients
app.get('/clients', (req, res) => {
    res.json(clients);
});

// Endpoint to test client-server connection
app.get('/test-connection', (req, res) => {
    res.json({ message: 'Connection successful!' });
});

// Endpoint to get server info
app.get('/server-info', (req, res) => {
    res.json({
        ip: getIPAddress(),
        port: currentPort,
    });
});

// Endpoint to set the listening port
app.post('/set-port', (req, res) => {
    const port = parseInt(req.query.port, 10);
    if (isNaN(port) || port <= 0 || port > 65535) {
        return res.status(400).json({ error: 'Invalid port number' });
    }

    console.log(`Received request to change port to: ${port}`);

    // Close the existing server if it's running
    if (server) {
        server.close(err => {
            if (err) {
                console.error("Error closing the server:", err);
                return res.status(500).json({ error: 'Error closing the server' });
            }
            console.log(`Server stopped listening on port ${currentPort}`);
            startServer(port, res);  // Start on the new port
        });
    } else {
        startServer(port, res);
    }
});

// Function to start the server on a specific port
const startServer = (port, res = null) => {
    currentPort = port;
    server.listen(currentPort, () => {
        console.log(`Server is now listening on http://${getIPAddress()}:${currentPort}`);
        if (res) {
            res.json({ port: currentPort });
        }
    }).on('error', (err) => {
        console.error(`Error starting server on port ${currentPort}:`, err);
        if (res) {
            res.status(500).json({ error: 'Could not start server on this port' });
        }
    });
};

// Array to store chat messages
const messages = [];

// Endpoint to receive and store chat messages
app.post('/send-message', (req, res) => {
    const { name, message } = req.body;

    if (!name || !message) {
        return res.status(400).json({ error: 'Name and message are required' });
    }

    // Get the current time and format it as HH:MM
    const timestamp = new Date().toISOString();

    // Store the message with name and timestamp
    const chatMessage = { name, message, timestamp };
    messages.push(chatMessage);

    // Emit the new message to all connected clients
    io.emit('newMessage', chatMessage);

    res.status(200).json({ success: true, message: 'Message received' });
});

// Endpoint to retrieve chat log
app.get('/chat-log', (req, res) => {
    res.json(messages);
});

// Endpoint to get the count of active clients
app.get('/client-count', (req, res) => {
    res.json({ count: clients.length });
});

// Handle WebSocket connection and disconnection
io.on('connection', (socket) => {
    console.log('A client connected');

    // Update client count when a client disconnects
    socket.on('disconnect', () => {
        clients.pop(); // Simulate client disconnection by removing from array
        io.emit('clientCountUpdate', clients.length); // Broadcast updated client count
        console.log('A client disconnected');
    });
});

// Initial server start
startServer(currentPort);
