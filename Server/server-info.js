const express = require('express');
const os = require('os');
const serverInfoRouter = express.Router();

// Helper function to get the server's IP address
function getIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        const iface = interfaces[name];
        for (const alias of iface) {
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1'; // Fallback to localhost
}

// Middleware to provide server information
serverInfoRouter.get('/', (req, res) => {
    const ipAddress = getIPAddress();
    const port = process.env.PORT || 3000;
    res.json({ ip: ipAddress, port });
});

module.exports = serverInfoRouter;
