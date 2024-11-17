const express = require("express");
const http = require("http");
const path = require("path");
const os = require("os");
const cors = require("cors");
const socketIo = require("socket.io");
const fs = require("fs").promises;
const fsSync = require("fs");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Serve static files
app.use(express.static(path.join(__dirname))); // Serve files from Server directory
app.use('/clientUI', express.static(path.join(__dirname, '../clientUI'))); // Serve client files

// Add root route to serve serverHTML.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'serverHTML.html'));
});

// Configuration
const config = {
  defaultPort: 3000,
  allowedDirectory: path.join(__dirname, "allowed_files"),
};

// State management
let currentPort = config.defaultPort;
const clients = new Map();
const messages = [];
const accessLevels = {
    NONE: 'none',
    READ: 'read',
    WRITE: 'write',
    EXECUTE: 'execute'
};

// Middleware
app.use(cors());
app.use(express.json());

// Ensure allowed_files directory exists
if (!fsSync.existsSync(config.allowedDirectory)) {
  fsSync.mkdirSync(config.allowedDirectory, { recursive: true });
}

// Helper Functions
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

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Get client name from query parameters
    const clientName = socket.handshake.query.clientName || 'Anonymous';
    
    // Add client to clients map
    clients.set(socket.id, {
        id: socket.id,
        name: clientName,
        accessLevel: accessLevels.NONE,
        connectedAt: new Date()
    });

    // Notify all clients about the updated client list
    io.emit('clientListUpdate', Array.from(clients.values()));

    // Handle chat messages
    socket.on('chatMessage', (messageInfo) => {
        const client = clients.get(socket.id);
        if (client) {
            const message = {
                name: client.name,
                message: messageInfo.message,
                timestamp: new Date(),
                isServer: false
            };
            io.emit('newMessage', message);
        }
    });

    // Handle server messages
    socket.on('serverMessage', (messageInfo) => {
        const message = {
            name: 'Server',
            message: messageInfo.message,
            timestamp: new Date(),
            isServer: true
        };
        io.emit('newMessage', message);
    });

    // Handle file operations
    socket.on('listFiles', async () => {
        try {
            const client = clients.get(socket.id);
            if (!client || client.accessLevel === accessLevels.NONE) {
                socket.emit('error', 'No permission to list files');
                return;
            }

            const files = await fs.readdir(config.allowedDirectory);
            socket.emit('fileList', files);
        } catch (error) {
            console.error('Error listing files:', error);
            socket.emit('error', 'Failed to list files');
        }
    });

    socket.on('readFile', async ({ filePath }) => {
        try {
            const client = clients.get(socket.id);
            if (!client || !['read', 'write', 'execute'].includes(client.accessLevel)) {
                socket.emit('error', 'No permission to read files');
                return;
            }

            const fullPath = path.join(config.allowedDirectory, filePath);
            const content = await fs.readFile(fullPath, 'utf8');
            socket.emit('fileContent', { content });
        } catch (error) {
            console.error('Error reading file:', error);
            socket.emit('error', `Failed to read file: ${error.message}`);
        }
    });

    socket.on('writeFile', async ({ filePath, content }) => {
        try {
            const client = clients.get(socket.id);
            if (!client || client.accessLevel !== 'write') {
                socket.emit('error', 'No permission to write files');
                return;
            }

            const fullPath = path.join(config.allowedDirectory, filePath);
            await fs.writeFile(fullPath, content, 'utf8');
            socket.emit('success', 'File written successfully');
        } catch (error) {
            console.error('Error writing file:', error);
            socket.emit('error', `Failed to write file: ${error.message}`);
        }
    });

    socket.on('executeFile', async ({ filePath }) => {
        try {
            const client = clients.get(socket.id);
            if (!client || client.accessLevel !== 'execute') {
                socket.emit('error', 'No permission to execute files');
                return;
            }

            // Add your file execution logic here
            socket.emit('success', 'File executed successfully');
        } catch (error) {
            console.error('Error executing file:', error);
            socket.emit('error', `Failed to execute file: ${error.message}`);
        }
    });

    // Handle access level changes
    socket.on('setAccessLevel', ({ clientId, accessLevel }) => {
        const client = clients.get(clientId);
        if (client) {
            client.accessLevel = accessLevel;
            clients.set(clientId, client);
            
            // Notify all clients about the updated client list
            io.emit('clientListUpdate', Array.from(clients.values()));
            
            // Notify the specific client about their access level change
            io.to(clientId).emit('accessLevelChanged', accessLevel);
            
            console.log(`Updated access level for client ${clientId} to ${accessLevel}`);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        clients.delete(socket.id);
        io.emit('clientListUpdate', Array.from(clients.values()));
    });
});

// Server info endpoint
app.get('/server-info', (req, res) => {
    res.json({
        ip: getIPAddress(),
        port: currentPort
    });
});

// Port configuration endpoint
app.post('/set-port', (req, res) => {
    const { port } = req.body;
    if (!port || port < 1 || port > 65535) {
        res.status(400).json({
            success: false,
            error: 'Invalid port number'
        });
        return;
    }

    currentPort = port;
    res.json({ success: true });
});

// Start server
server.listen(currentPort, () => {
    console.log(`Server running on port ${currentPort}`);
    console.log(`Server IP: ${getIPAddress()}`);
});
