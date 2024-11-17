const dgram = require("dgram");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const server = dgram.createSocket("udp4");
const PORT = 3000;
const HOST = "0.0.0.0";

// Global state management
let adminClient = null;
const connectedClients = new Map();
const activeProcesses = new Map();
const userRoles = new Map(); // Store user roles

// Color constants for better logging
const colors = {
  success: "\x1b[32m%s\x1b[0m", // Green
  error: "\x1b[31m%s\x1b[0m", // Red
  info: "\x1b[36m%s\x1b[0m", // Cyan
  warning: "\x1b[33m%s\x1b[0m", // Yellow
};

// Create managed directory
const MANAGED_DIR = path.join(__dirname, "managed_files");
if (!fs.existsSync(MANAGED_DIR)) {
  fs.mkdirSync(MANAGED_DIR);
  console.log(colors.success, "✓ Created managed directory");
}

// Add at the top of server.js
const ROLE_PERMISSIONS = {
  admin: {
    canRead: true,
    canWrite: true,
    canExecute: true,
    canDelete: true,
    canManageUsers: true,
    description: "Full system access",
  },
  power_user: {
    canRead: true,
    canWrite: true,
    canExecute: true,
    canDelete: false,
    canManageUsers: false,
    description: "Can read, write, and execute files",
  },
  moderator: {
    canRead: true,
    canWrite: true,
    canExecute: false,
    canDelete: false,
    canManageUsers: false,
    description: "Can read and write files",
  },
  user: {
    canRead: true,
    canWrite: false,
    canExecute: false,
    canDelete: false,
    canManageUsers: false,
    description: "Can only read files",
  },
};

// Server message handler
server.on("message", (message, remote) => {
  try {
    console.log(
      colors.info,
      `→ Received message from ${remote.address}:${remote.port}`
    );
    const data = JSON.parse(message.toString());
    const clientId = `${remote.address}:${remote.port}`;

    switch (data.type) {
      case "register":
        handleRegistration(clientId, data.userName, remote);
        break;
      case "fileAccess":
        handleFileAccess(clientId, data.operation, data.filename, data.content);
        break;
      case "process_input":
        handleProcessInput(clientId, data.input);
        break;
      case "role_management":
        handleRoleManagement(clientId, data.targetClientId, data.newRole);
        break;
      default:
        console.log(colors.warning, `! Unknown message type: ${data.type}`);
    }
  } catch (error) {
    console.error(colors.error, `✗ Error processing message: ${error.message}`);
  }
});

function handleRegistration(clientId, userName, remote) {
  const isFirstUser = adminClient === null;

  if (isFirstUser) {
    adminClient = clientId;
    userRoles.set(clientId, "admin");
    console.log(colors.success, `✓ Admin registered: ${userName}`);
  } else {
    userRoles.set(clientId, "user");
    console.log(colors.info, `→ User registered: ${userName}`);

    // Notify admin of new user connection
    const admin = connectedClients.get(adminClient);
    if (admin) {
      sendToClient(
        admin,
        JSON.stringify({
          type: "user_connected",
          userName,
          clientId,
          role: "user",
        })
      );
    }
  }

  connectedClients.set(clientId, {
    userName,
    address: remote.address,
    port: remote.port,
    id: clientId,
  });

  const response = JSON.stringify({
    type: "registration_success",
    message: `Welcome ${userName}!`,
    isAdmin: isFirstUser,
    role: isFirstUser ? "admin" : "user",
  });

  server.send(response, remote.port, remote.address);
}

function handleFileAccess(clientId, operation, filename, content) {
  const client = connectedClients.get(clientId);
  if (!client) {
    console.error(colors.error, `✗ Unknown client: ${clientId}`);
    return;
  }

  const userRole = userRoles.get(clientId) || "user";
  const permissions = ROLE_PERMISSIONS[userRole];

  // Check if file path is provided (except for 'list' operation)
  if (operation !== "list" && !filename) {
    sendError(client, `No filename provided for operation: ${operation}`);
    return;
  }

  const filePath = path.join(MANAGED_DIR, filename || "");

  // Ensure file path is within managed directory
  if (!filePath.startsWith(MANAGED_DIR)) {
    sendError(client, "Invalid file path");
    return;
  }

  switch (operation) {
    case "list":
      handleList(client);
      break;

    case "read":
      if (!permissions.canRead) {
        sendError(client, "Permission denied: Your role cannot read files");
        return;
      }
      handleRead(client, filePath, filename);
      break;

    case "write":
      if (!permissions.canWrite) {
        sendError(client, "Permission denied: Your role cannot write files");
        return;
      }
      handleWrite(client, filePath, filename, content);
      break;

    case "execute":
      if (!permissions.canExecute) {
        sendError(client, "Permission denied: Your role cannot execute files");
        return;
      }
      if (!fs.existsSync(filePath)) {
        sendError(client, `File "${filename}" does not exist`);
        return;
      }
      handleExecute(client, filePath, filename);
      break;

    case "delete":
      if (!permissions.canDelete) {
        sendError(client, "Permission denied: Your role cannot delete files");
        return;
      }
      if (!fs.existsSync(filePath)) {
        sendError(client, `File "${filename}" does not exist`);
        return;
      }
      handleDelete(client, filePath, filename);
      break;

    default:
      sendError(client, `Unknown operation: ${operation}`);
  }
}

function handleList(client) {
  fs.readdir(MANAGED_DIR, (err, files) => {
    if (err) {
      sendError(client, "Failed to list files");
      return;
    }

    const fileDetails = files.map((file) => {
      const filePath = path.join(MANAGED_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: formatFileSize(stats.size),
          modified: formatDate(stats.mtime),
          type: path.extname(file) || "No extension",
        };
      } catch (error) {
        return {
          name: file,
          error: "Cannot read file info",
        };
      }
    });

    sendSuccess(client, {
      message: "File listing:",
      files: fileDetails,
    });
  });
}

function handleRead(client, filePath, filename) {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      const errorMsg =
        err.code === "ENOENT"
          ? `File "${filename}" not found`
          : `Cannot read "${filename}": ${err.message}`;
      sendError(client, errorMsg);
    } else {
      const stats = fs.statSync(filePath);
      sendSuccess(client, {
        content: data,
        details: `File size: ${formatFileSize(
          stats.size
        )} | Last modified: ${formatDate(stats.mtime)}`,
      });
    }
  });
}

function handleWrite(client, filePath, filename, content) {
  fs.writeFile(filePath, content, (err) => {
    if (err) {
      sendError(client, `Failed to write "${filename}": ${err.message}`);
    } else {
      const stats = fs.statSync(filePath);
      sendSuccess(client, {
        message: `File ${filename} ${
          fs.existsSync(filePath) ? "updated" : "created"
        } successfully`,
        details: `Size: ${formatFileSize(stats.size)} | Location: ${filePath}`,
      });
    }
  });
}

function handleExecute(client, filePath, filename) {
  const ext = path.extname(filename).toLowerCase();
  let childProcess;

  try {
    switch (ext) {
      case ".js":
        const absolutePath = path.resolve(filePath);
        const wrappedCode = `
          const originalProcess = process;
          const readline = require('readline');
          
          // Ensure any existing readline interface is properly closed
          process.on('SIGTERM', () => {
            process.exit(0);
          });

          // Wrap the original file in a try-catch
          try {
            require(${JSON.stringify(absolutePath)});
          } catch (error) {
            console.error('Execution error:', error);
            process.exit(1);
          }
        `;

        const tempFile = path.join(
          path.dirname(absolutePath),
          `._temp_${Date.now()}.js`
        );
        fs.writeFileSync(tempFile, wrappedCode);

        childProcess = spawn("node", [tempFile], {
          stdio: ["pipe", "pipe", "pipe"],
          detached: false,
          cwd: path.dirname(absolutePath),
        });

        // Cleanup temp file
        setTimeout(() => {
          try {
            fs.unlinkSync(tempFile);
          } catch (err) {
            console.error(
              colors.error,
              `Failed to cleanup temp file: ${err.message}`
            );
          }
        }, 1000);
        break;

      case ".py":
        childProcess = spawn("python", [filePath]);
        break;

      case ".bat":
        childProcess = spawn("cmd", ["/c", filePath]);
        break;

      default:
        sendError(client, {
          message: `Cannot execute "${filename}"`,
          details: `Unsupported file type: ${ext}`,
        });
        return;
    }

    console.log(colors.info, `→ Started interactive process: ${filename}`);

    childProcess.stdout.on("data", (data) => {
      sendToClient(client, {
        type: "execute_output",
        output: data.toString(),
        interactive: true,
      });
    });

    childProcess.stderr.on("data", (data) => {
      sendToClient(client, {
        type: "execute_error",
        error: data.toString(),
      });
    });

    activeProcesses.set(client.id, childProcess);

    // Add timeout for long-running processes
    const timeout = setTimeout(() => {
      if (childProcess && !childProcess.killed) {
        childProcess.kill();
        sendError(client, "Process timed out and was terminated");
      }
    }, 300000); // 5 minutes timeout

    childProcess.on("close", (code) => {
      clearTimeout(timeout);
      console.log(colors.info, `→ Process ended: ${filename} (code: ${code})`);
      activeProcesses.delete(client.id);

      // Force cleanup
      if (childProcess.stdin) childProcess.stdin.end();
      if (childProcess.stdout) childProcess.stdout.destroy();
      if (childProcess.stderr) childProcess.stderr.destroy();

      sendToClient(client, {
        type: "execute_end",
        message: `Process ended with code ${code}`,
        shouldPrompt: true,
      });
    });
  } catch (error) {
    console.error(colors.error, `Execution error: ${error.message}`);
    sendError(client, `Failed to execute "${filename}": ${error.message}`);
  }
}

function handleProcessInput(clientId, input) {
  const process = activeProcesses.get(clientId);
  if (process) {
    process.stdin.write(input + "\n");
  }
}

function handleDelete(client, filePath, filename) {
  // Check if file exists first
  if (!fs.existsSync(filePath)) {
    sendError(client, `File "${filename}" does not exist`);
    return;
  }

  try {
    fs.unlinkSync(filePath);
    sendSuccess(client, {
      message: `File "${filename}" has been deleted successfully`,
      details: `Location: ${filePath}`,
    });
  } catch (error) {
    sendError(client, {
      message: `Failed to delete "${filename}"`,
      details: error.message,
    });
  }
}

// Helper functions
function formatFileSize(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(date) {
  return new Date(date).toLocaleString();
}

function sendSuccess(client, data) {
  const response = JSON.stringify({
    type: "success",
    ...data,
  });
  sendToClient(client, response);
}

function sendError(client, data) {
  const response = JSON.stringify({
    type: "error",
    ...(typeof data === "string" ? { message: data } : data),
  });
  sendToClient(client, response);
}

function sendToClient(client, data) {
  const message = typeof data === "string" ? data : JSON.stringify(data);
  server.send(message, client.port, client.address);
}

// Error handling
server.on("error", (err) => {
  console.error(colors.error, `Server error: ${err.message}`);
  if (err.code === "EADDRINUSE") {
    console.log(colors.info, "Attempting to bind to another port...");
    server.bind(PORT + 1, HOST);
  }
});

server.on("listening", () => {
  const address = server.address();
  console.log(
    colors.success,
    `✓ Server running on ${address.address}:${address.port}`
  );
  console.log(colors.info, `→ Managing files in: ${MANAGED_DIR}`);
});

// Start server
server.bind(PORT, HOST);

// Add new function to handle role management
function handleRoleManagement(clientId, targetClientId, newRole) {
  const client = connectedClients.get(clientId);
  const targetClient = connectedClients.get(targetClientId);
  const userRole = userRoles.get(clientId);

  if (!client || !targetClient) {
    sendError(client, "Invalid client ID");
    return;
  }

  if (!ROLE_PERMISSIONS[userRole]?.canManageUsers) {
    sendError(client, "Permission denied: Your role cannot manage users");
    return;
  }

  if (targetClientId === adminClient) {
    sendError(client, "Cannot change admin's role");
    return;
  }

  const validRoles = ["user", "moderator", "power_user"];
  if (!validRoles.includes(newRole)) {
    sendError(
      client,
      `Invalid role. Valid roles are: ${validRoles.join(", ")}`
    );
    return;
  }

  userRoles.set(targetClientId, newRole);

  // Notify admin with updated information
  sendSuccess(client, {
    type: "role_updated",
    targetClientId: targetClientId, // Include targetClientId
    newRole: newRole,
    message: `Role updated for ${targetClient.userName} to ${newRole}`,
  });

  // Notify target user
  sendToClient(
    targetClient,
    JSON.stringify({
      type: "role_updated",
      newRole: newRole,
      message: `Your role has been updated to: ${newRole}`,
    })
  );
}

// Add to server setup
server.on("close", () => {
  // Handle server shutdown
  connectedClients.forEach((client, clientId) => {
    if (clientId !== adminClient) {
      const admin = connectedClients.get(adminClient);
      if (admin) {
        sendToClient(
          admin,
          JSON.stringify({
            type: "user_disconnected",
            clientId,
          })
        );
      }
    }
  });
});

function cleanup(clientId) {
  const client = connectedClients.get(clientId);
  if (!client) return;

  // Remove from connected clients
  connectedClients.delete(clientId);
  userRoles.delete(clientId);

  // Notify admin if it's not the admin disconnecting
  if (clientId !== adminClient) {
    const admin = connectedClients.get(adminClient);
    if (admin) {
      sendToClient(
        admin,
        JSON.stringify({
          type: "user_disconnected",
          clientId,
        })
      );
    }
  }

  console.log(colors.warning, `! User disconnected: ${client.userName}`);
}
