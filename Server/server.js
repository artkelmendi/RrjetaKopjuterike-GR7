const express = require("express");
const http = require("http");
const path = require("path");
const os = require("os");
const cors = require("cors");
const socketIo = require("socket.io");
const fs = require("fs");
const dgram = require("dgram");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// UDP server setup
const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg, rinfo) => {
  console.log(`Received message: ${msg} from ${rinfo.address}:${rinfo.port}`);
  // Based on the received message, you can handle it accordingly

  io.emit('udpMessage', msg.toString()); 
  // Sends the message to all connected clients using Socket.IO
});

udpServer.on('listening', () => {
  const address = udpServer.address();
  console.log(`UDP server listening on ${address.address}:${address.port}`);
});

udpServer.bind(41234);  // Port used for UDP communication

// Function to give access to a client
const giveAccessToClient = (socketId) => {
  if (!clients.has(socketId)) {
    clients.set(socketId, { access: false });
  }
  clients.get(socketId).access = true; // Client has access
};

// Configuration
const config = {
  defaultPort: 3000,
  allowedDirectory: path.join(__dirname, "allowed_files"),
};

// State management
let currentPort = config.defaultPort;
const clients = new Map();
const messages = [];

// Middleware
app.use(cors());
app.use(express.json());

// Ensure allowed_files directory exists
if (!fs.existsSync(config.allowedDirectory)) {
  fs.mkdirSync(config.allowedDirectory, { recursive: true });
}

// Helper functions
const getIPAddress = () => {
  const interfaces = os.networkInterfaces();
  for (let name in interfaces) {
    for (let iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
};

const isPathSafe = (filePath) => {
  const normalizedPath = path.normalize(filePath);
  return normalizedPath.startsWith(config.allowedDirectory);
};

// API Routes
app.get("/server-info", (req, res) => {
  const serverInfo = {
    ip: getIPAddress(),
    port: currentPort,
  };
  console.log("Sending server info:", serverInfo);
  res.json(serverInfo);
});

app.post("/connect", (req, res) => {
  const { name, port, socketId } = req.body;
  const clientInfo = {
    name: name || "Anonymous",
    port: port,
    socketId: socketId,
    connectedAt: new Date().toISOString(),
  };

  clients.set(socketId, clientInfo);
  io.emit("clientCountUpdate", clients.size);

  res.json({ message: "Connection successful!", clientInfo });
});

app.get("/clients", (req, res) => {
  res.json(Array.from(clients.values()));
});

app.post("/send-message", (req, res) => {
  const { name, message } = req.body;
  const messageInfo = {
    name,
    message,
    timestamp: new Date().toISOString(),
  };

  messages.push(messageInfo);
  io.emit("newMessage", messageInfo);
  res.json({ success: true });
});

app.post("/read-file", (req, res) => {
  const { filePath } = req.body;
  const fullPath = path.join(config.allowedDirectory, filePath);

  if (!isPathSafe(fullPath)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  fs.readFile(fullPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res
        .status(500)
        .json({ success: false, message: "File read error" });
    }
    res.json({ success: true, content: data });
  });
});

app.post("/write-file", (req, res) => {
  const { filePath, content } = req.body;
  const fullPath = path.join(config.allowedDirectory, filePath);

  if (!isPathSafe(fullPath)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  fs.writeFile(fullPath, content, "utf8", (err) => {
    if (err) {
      console.error("Error writing file:", err);
      return res
        .status(500)
        .json({ success: false, message: "File write error" });
    }
    io.emit("fileAction", { action: "write", filePath });
    res.json({ success: true, message: "File written successfully" });
  });
});

app.post("/delete-file", (req, res) => {
  const { filePath } = req.body;
  const fullPath = path.join(config.allowedDirectory, filePath);

  if (!isPathSafe(fullPath)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  fs.unlink(fullPath, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
      return res
        .status(500)
        .json({ success: false, message: "File delete error" });
    }
    io.emit("fileAction", { action: "delete", filePath });
    res.json({ success: true, message: "File deleted successfully" });
  });
});

// Socket.IO event handlers
// In your Socket.IO event handlers section
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("chatMessage", (messageData) => {
    const messageInfo = {
      name: messageData.name,
      message: messageData.message,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all clients including sender
    io.emit("newMessage", messageInfo);
  });

  socket.on("disconnect", () => {
    clients.delete(socket.id);
    io.emit("clientCountUpdate", clients.size);
  });
});

// Socket.IO handler për lidhje
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  socket.on('requestAccess', () => {
    giveAccessToClient(socket.id);
    socket.emit('accessGranted');
  });
});

// Remove or modify the /send-message endpoint since we're using socket events

// Static files
app.use(express.static(path.join(__dirname)));

// Catch-all route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "serverHTML.html"));
});

// Port finding and server start
const findAvailablePort = async (startPort) => {
  let port = startPort;
  const maxPort = startPort + 10;

  while (port < maxPort) {
    try {
      await new Promise((resolve, reject) => {
        const testServer = http.createServer();
        testServer.listen(port, () => {
          testServer.close();
          resolve();
        });
        testServer.on("error", () => {
          reject();
        });
      });
      return port;
    } catch {
      port++;
    }
  }
  throw new Error("No available ports found");
};

const startServer = async (port = config.defaultPort) => {
  try {
    const availablePort = await findAvailablePort(port);
    currentPort = availablePort;

    return new Promise((resolve, reject) => {
      server
        .listen(currentPort, () => {
          const address = getIPAddress();
          console.log(`Server running at http://${address}:${currentPort}`);
          resolve(currentPort);
        })
        .on("error", (err) => {
          console.error(`Error starting server:`, err);
          reject(err);
        });
    });
  } catch (error) {
    console.error("Server start failed:", error);
    throw error;
  }
};

// Handle port changes
app.post("/set-port", async (req, res) => {
  const { port } = req.query;
  const newPort = parseInt(port);

  if (!port || newPort < 1 || newPort > 65535) {
    return res.status(400).json({ error: "Invalid port number" });
  }

  try {
    await server.close();
    const usedPort = await startServer(newPort);
    res.json({ success: true, port: usedPort });
  } catch (error) {
    res.status(500).json({ error: "Failed to change port" });
  }
});

// Start the server
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
