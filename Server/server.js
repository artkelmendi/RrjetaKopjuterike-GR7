const dgram = require('dgram');
const path = require("path");
const os = require("os");
const fs = require("fs").promises;
const fsSync = require("fs");
const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors({ origin: '*' }));



// Configuration
const config = {
    udpPort: 3000, // Fixed UDP port
    allowedDirectory: path.join(__dirname, "allowed_files"),
    clientTimeout: 30000, // Client timeout duration in ms
    httpPort: 3001 // HTTP server port
};

// State management
const clients = new Map(); // Map of client address info
const messages = []; // List of recent messages
const accessLevels = {
    NONE: 'none',
    READ: 'read',
    WRITE: 'write',
    EXECUTE: 'execute'
};
const safeResolve = (base, target) => {
    const resolvedPath = path.resolve(base, target);
    if (!resolvedPath.startsWith(base)) {
        throw new Error('Invalid path');
    }
    return resolvedPath;
};


// Message types for communication`
const MessageTypes = {
    CONNECT: 'CONNECT',
    CHAT: 'CHAT',
    SERVER_MESSAGE: 'SERVER_MESSAGE',
    LIST_FILES: 'LIST_FILES',
    READ_FILE: 'READ_FILE',
    WRITE_FILE: 'WRITE_FILE',
    CLIENT_LIST_UPDATE: 'CLIENT_LIST_UPDATE',
    PING: 'PING',
    ERROR: 'ERROR',
    SUCCESS: 'SUCCESS'
};

// Create UDP server
const udpServer = dgram.createSocket('udp4');

// Ensure allowed_files directory exists
if (!fsSync.existsSync(config.allowedDirectory)) {
    fsSync.mkdirSync(config.allowedDirectory, { recursive: true });
}

// Helper functions
function getIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (const alias of iface) {
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return 'localhost';
}

function createClientKey(address, port) {
    return `${address}:${port}`;
}

function broadcastToAll(messageType, data, isServer = false) {
    const message = {
        type: messageType,
        data: data,
        timestamp: new Date(),
        isServer: isServer
    };

    const messageString = JSON.stringify(message);

    // Broadcast to all clients
    clients.forEach((client, clientKey) => {
        udpServer.send(messageString, client.port, client.address, (err) => {
            if (err) console.error(`Error broadcasting to ${clientKey}:`, err);
        });
    });

    // Add to the server's messages array
    messages.push(message);

    // Limit stored messages to 100 for memory efficiency
    if (messages.length > 100) messages.shift();
}


// Cleanup disconnected clients
setInterval(() => {
    const now = Date.now();
    for (const [clientKey, client] of clients.entries()) {
        if (now - client.lastSeen > config.clientTimeout) {
            console.log(`Client timeout: ${clientKey}`);
            clients.delete(clientKey);
            broadcastToAll(MessageTypes.CLIENT_LIST_UPDATE, Array.from(clients.values()));
        }
    }
}, 10000);

// UDP server event handlers
udpServer.on('error', (err) => {
    console.error(`UDP server error:\n${err.stack}`);
    udpServer.close();
});

udpServer.on('listening', () => {
    const address = udpServer.address();
    console.log(`UDP server listening on ${address.address}:${address.port}`);
    console.log(`Server IP: ${getIPAddress()}`);
});

udpServer.on('message', async (msg, rinfo) => {
    const clientKey = createClientKey(rinfo.address, rinfo.port);

    try {
        const data = JSON.parse(msg.toString());

        if (clients.has(clientKey)) {
            const client = clients.get(clientKey);
            client.lastSeen = Date.now();
            clients.set(clientKey, client);
        }

        switch (data.type) {
            case MessageTypes.CONNECT:
                clients.set(clientKey, {
                    address: rinfo.address,
                    port: rinfo.port,
                    name: data.data.clientName || 'Anonymous',
                    connectedAt: new Date(),
                    lastSeen: Date.now()
                });
                broadcastToAll(MessageTypes.CLIENT_LIST_UPDATE, Array.from(clients.values()));
                break;

            case MessageTypes.CHAT:
                const client = clients.get(clientKey);
                if (client) {
                    broadcastToAll(MessageTypes.CHAT, {
                        name: client.name,
                        message: data.data.message,
                        timestamp: new Date(),
                        isServer: false
                    });
                }
                break;

            case MessageTypes.LIST_FILES:
                try {
                    const files = await fs.readdir(config.allowedDirectory);
                    broadcastToAll(MessageTypes.LIST_FILES, files);
                } catch (error) {
                    broadcastToAll(MessageTypes.ERROR, 'Failed to list files');
                }
                break;

            case MessageTypes.PING:
                broadcastToAll(MessageTypes.PING, { timestamp: Date.now() });
                break;

            default:
                console.warn(`Unknown message type: ${data.type}`);
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
});

// Start UDP server
udpServer.bind(config.udpPort, () => {
    console.log(`UDP server running on port ${config.udpPort}`);
});

// HTTP routes for browser communication
app.use(express.json());

// Provide server info to the client
app.get('/server-info', (req, res) => {
    res.json({ ip: getIPAddress(), port: config.udpPort });
});

// Send a message to the UDP server
app.post('/send-udp-message', (req, res) => {
    const { type, data } = req.body;

    if (type === MessageTypes.LIST_FILES) {
        try {
            const files = await fs.readdir(config.allowedDirectory);
            broadcastToAll(MessageTypes.LIST_FILES, files);
            return res.json({ success: true, files });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Failed to list files" });
        }
    }

    if (!type || !data) {
        return res.status(400).json({
            success: false,
            message: "Request must include 'type' and 'data'."
        });
    }

    if (type === MessageTypes.CHAT) {
        const serverMessage = {
            name: "Server",
            message: data.message,
        };
        broadcastToAll(MessageTypes.CHAT, serverMessage, true);
        return res.json({
            success: true,
            message: "Message broadcasted from server."
        });
    }

    if (type === MessageTypes.CONNECT) {
        if (!data.clientName) {
            return res.status(400).json({
                success: false,
                message: "'data.clientName' is required for CONNECT."
            });
        }
        console.log(`Client connected: ${data.clientName}`);
        return res.json({
            success: true,
            message: `Welcome, ${data.clientName}!`
        });
    }

    res.status(400).json({
        success: false,
        message: "Invalid message type."
    });
});



// Read a file
app.post('/read-file', async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) {
        return res.status(400).json({ success: false, message: "File path is required" });
    }

    try {
        const fullPath = path.join(config.allowedDirectory, filePath);
        const content = await fs.readFile(fullPath, 'utf8');
        res.json({ success: true, content });
    } catch (error) {
        console.error("Error reading file:", error);
        res.status(500).json({ success: false, message: "Failed to read file" });
    }
});

// Write a file
app.post('/write-file', async (req, res) => {
    const { filePath, content } = req.body;
    if (!filePath || content === undefined) {
        return res.status(400).json({ success: false, message: "File path and content are required" });
    }

    try {
        const fullPath = path.join(config.allowedDirectory, filePath);
        await fs.writeFile(fullPath, content, 'utf8');
        res.json({ success: true, message: "File written successfully" });
    } catch (error) {
        console.error("Error writing file:", error);
        res.status(500).json({ success: false, message: "Failed to write file" });
    }
});
// Delete a file
app.post('/delete-file', async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) {
        return res.status(400).json({ success: false, message: "File path is required" });
    }

    try {
        const fullPath = path.join(config.allowedDirectory, filePath);

        // Ensure the file exists
        if (!fsSync.existsSync(fullPath)) {
            return res.status(404).json({ success: false, message: "File not found" });
        }

        // Delete the file
        await fs.unlink(fullPath);
        res.json({ success: true, message: "File deleted successfully" });
    } catch (error) {
        console.error("Error deleting file:", error);
        res.status(500).json({ success: false, message: "Failed to delete file" });
    }
});

// Fetch recent messages
app.get('/get-udp-messages', (req, res) => {
    res.json(messages);
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'serverHTML.html'));
});

// Serve static files
app.use('/static', express.static(__dirname));

// Start HTTP server
app.listen(config.httpPort, () => {
    console.log(`HTTP server running on port ${config.httpPort}`);
});
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

