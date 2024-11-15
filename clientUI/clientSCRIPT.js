// DOM Elements
const elements = {
  clientName: document.getElementById("client-name"),
  serverId: document.getElementById("server-id"),
  port: document.getElementById("port"),
  messageInput: document.getElementById("message-input"),
  chatBox: document.getElementById("chat-box"),
  filePath: document.getElementById("file-path"),
  fileContent: document.getElementById("file-content"),
  connectionStatus: document.getElementById("connection-status"),
  notificationContainer: document.getElementById("notification-container"),
};

// Socket.IO connection
let socket = null;

// Helper Functions
const showNotification = (message, type = "info") => {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  elements.notificationContainer.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
};

const getServerUrl = () => {
  const serverId = elements.serverId.value;
  const port = elements.port.value;
  return `http://${serverId}:${port}`;
};

const updateConnectionStatus = (status) => {
  elements.connectionStatus.textContent = status;
  elements.connectionStatus.className = `status-indicator ${status.toLowerCase()}`;
};

// Function to connect client and request permissions
async function connectClient() {
  const name = elements.clientName.value || "Anonymous";
  const serverUrl = getServerUrl();

  try {
    const response = await fetch(`${serverUrl}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error("Failed to connect to the server");
    }

    const data = await response.json();
    initializePermissions(data.permission); // Apply permissions received from the server
    showNotification(`Connected with ${data.permission} permissions`, "success");
  } catch (error) {
    console.error("Connection error:", error);
    showNotification("Failed to connect to the server", "error");
  }
}

// Function to initialize permissions for the client
function initializePermissions(permission) {
  elements.filePath.disabled = !permission.includes("read");
  elements.fileContent.disabled = !permission.includes("write");
  document.querySelector('button[onclick="readFile()"]').disabled = !permission.includes("read");
  document.querySelector('button[onclick="writeFile()"]').disabled = !permission.includes("write");
  document.querySelector('button[onclick="deleteFile()"]').disabled = !permission.includes("execute");
}

// Server Connection
async function connectToServer() {
  const name = elements.clientName.value || "Anonymous";
  const serverId = elements.serverId.value;
  const port = elements.port.value;

  if (!serverId || !port) {
    showNotification("Please enter both Server ID and Port.", "error");
    return;
  }

  try {
    // Initialize Socket.IO connection
    const serverUrl = `http://${serverId}:${port}`;
    socket = io(serverUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      timeout: 10000,
    });

    // Socket event handlers
    socket.on("connect", async () => {
      console.log("Connected to server with socket ID:", socket.id);
      updateConnectionStatus("Connected");

      // Register with server
      try {
        const response = await fetch(`${serverUrl}/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            port,
            socketId: socket.id,
          }),
        });

        if (!response.ok) throw new Error("Connection registration failed");

        const data = await response.json();
        showNotification(data.message, "success");
      } catch (error) {
        console.error("Registration error:", error);
        showNotification("Failed to register with server", "error");
      }

      // Enable disconnect button and disable connect button
      document.getElementById("disconnect-btn").disabled = false;
      document.querySelector(".btn-primary").disabled = true;

      // Remove any existing listeners to prevent duplicates
      socket.off('newMessage');
      socket.off('fileAction');

      // Add new listeners
      socket.on('newMessage', handleNewMessage);
      socket.on('fileAction', handleFileAction);
    });

    socket.on("disconnect", () => {
      updateConnectionStatus("Disconnected");
      showNotification("Disconnected from server", "error");

      // Disable disconnect button and enable connect button
      document.getElementById("disconnect-btn").disabled = true;
      document.querySelector(".btn-primary").disabled = false;
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      showNotification(`Connection error: ${error.message}`, "error");
    });
  } catch (error) {
    console.error("Connection error:", error);
    showNotification(`Failed to connect: ${error.message}`, "error");
    updateConnectionStatus("Disconnected");
  }
}

// Message Handling
function handleNewMessage(message) {
  // Prevent duplicate messages by checking if message already exists
  const messageId = `${message.name}-${message.timestamp}`;
  if (document.getElementById(messageId)) {
    return; // Skip if message already exists
  }

  const messageDiv = document.createElement('div');
  messageDiv.id = messageId; // Add unique ID to message
  messageDiv.className = 'message';
  
  // Format timestamp
  const timestamp = new Date(message.timestamp).toLocaleTimeString();
  
  // Different styling for own messages vs others
  const isOwnMessage = message.name === elements.clientName.value;
  messageDiv.classList.add(isOwnMessage ? 'own-message' : 'other-message');

  messageDiv.innerHTML = `
    <strong>${message.name}</strong>: ${message.message}
    <span class="timestamp">${timestamp}</span>
  `;
  
  elements.chatBox.appendChild(messageDiv);
  elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
}

async function sendMessage() {
  if (!socket?.connected) {
    showNotification('Not connected to server', 'error');
    return;
  }

  const message = elements.messageInput.value.trim();
  const name = elements.clientName.value || 'Anonymous';

  if (!message) {
    showNotification('Please enter a message', 'warning');
    return;
  }

  try {
    // Emit the message directly through socket instead of fetch
    socket.emit('chatMessage', { name, message });
    elements.messageInput.value = ''; // Clear input after sending
  } catch (error) {
    console.error('Error sending message:', error);
    showNotification('Failed to send message', 'error');
  }
}

// File Operations
async function readFile() {
  const filePath = elements.filePath.value;

  if (!filePath) {
    showNotification("Please enter a file path", "error");
    return;
  }

  try {
    const response = await fetch(`${getServerUrl()}/read-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath }),
    });

    const data = await response.json();
    if (data.success) {
      elements.fileContent.value = data.content;
      showNotification("File read successfully", "success");
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Error reading file:", error);
    showNotification(`Error reading file: ${error.message}`, "error");
  }
}

async function writeFile() {
  const filePath = elements.filePath.value;
  const content = elements.fileContent.value;

  if (!filePath || !content) {
    showNotification("Please enter both file path and content", "error");
    return;
  }

  try {
    const response = await fetch(`${getServerUrl()}/write-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, content }),
    });

    const data = await response.json();
    if (data.success) {
      showNotification("File written successfully", "success");
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Error writing file:", error);
    showNotification(`Error writing file: ${error.message}`, "error");
  }
}

async function deleteFile() {
  const filePath = elements.filePath.value;

  if (!filePath) {
    showNotification("Please enter a file path", "error");
    return;
  }

  if (!confirm("Are you sure you want to delete this file?")) {
    return;
  }

  try {
    const response = await fetch(`${getServerUrl()}/delete-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath }),
    });

    const data = await response.json();
    if (data.success) {
      elements.fileContent.value = "";
      showNotification("File deleted successfully", "success");
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    showNotification(`Error deleting file: ${error.message}`, "error");
  }
}

// Event Handlers
function handleFileAction(data) {
  showNotification(
    `File ${data.action} action performed on: ${data.filePath}`,
    "info"
  );
}

function disconnectFromServer() {
  if (socket) {
    socket.disconnect();
    updateConnectionStatus("Disconnected");
    showNotification("Disconnected from server", "warning");

    // Disable disconnect button and enable connect button
    document.getElementById("disconnect-btn").disabled = true;
    document.querySelector(".btn-primary").disabled = false;

    // Clear chat box
    elements.chatBox.innerHTML = "";

    // Reset connection fields if needed
    // elements.clientName.value = '';
    // elements.serverId.value = '';
    // elements.port.value = '';
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  updateConnectionStatus("Disconnected");
});


