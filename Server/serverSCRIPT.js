/// DOM Elements
const elements = {
  ip: document.getElementById("ip"),
  port: document.getElementById("port"),
  portInput: document.getElementById("port-input"),
  clientList: document.getElementById("client-list"),
  chatLog: document.getElementById("chat-log"),
  chatMessage: document.getElementById("chat-message"),
  filePath: document.getElementById("file-path"),
  fileContent: document.getElementById("file-content"),
  activeClientCount: document.getElementById("active-client-count"),
  notificationContainer: document.getElementById("notification-container")
};

// Socket.IO connection
let socket = io();

// Initialize server info
async function initializeServerInfo() {
  try {
    const response = await fetch("/server-info");
    const data = await response.json();
    
    if (elements.ip) elements.ip.textContent = data.ip;
    if (elements.port) elements.port.textContent = data.port;
  } catch (error) {
    console.error("Error fetching server info:", error);
    showNotification("Failed to fetch server info", "error");
  }
}

// Port management
async function setPort() {
  const newPort = elements.portInput?.value;
  if (!newPort) {
    showNotification('Please enter a port number', 'error');
    return;
  }

  try {
    const response = await fetch('/set-port', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port: newPort })
    });

    const data = await response.json();
    if (data.success) {
      showNotification(`Port updated to ${newPort}`, 'success');
      if (elements.port) elements.port.textContent = newPort;
    } else {
      throw new Error(data.error || 'Failed to update port');
    }
  } catch (error) {
    showNotification(`Error setting port: ${error.message}`, 'error');
  }
}

// Notification handling
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  if (!elements.notificationContainer) return;
  
  notification.style.backgroundColor = getNotificationColor(type);
  notification.style.color = '#ffffff';
  notification.style.padding = '12px 24px';
  notification.style.marginBottom = '10px';
  notification.style.borderRadius = '5px';
  notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
  
  elements.notificationContainer.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function getNotificationColor(type) {
  switch (type) {
    case 'success': return '#28a745';
    case 'error': return '#dc3545';
    case 'warning': return '#ffc107';
    default: return '#17a2b8';
  }
}

// Client management
function updateClientList(clients) {
  if (!elements.clientList) return;
  
  if (!clients || clients.length === 0) {
    elements.clientList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users-slash"></i>
        <p>No clients connected</p>
      </div>`;
    return;
  }

  elements.clientList.innerHTML = clients.map(client => `
    <div class="client-card">
      <div class="client-info">
        <div class="client-header">
          <i class="fas fa-user"></i>
          <span class="client-name">${client.name || 'Anonymous'}</span>
        </div>
        <span class="client-id">ID: ${client.id}</span>
        <span class="client-time">Connected: ${new Date(client.connectTime).toLocaleTimeString()}</span>
      </div>
      <div class="client-controls">
        <select class="access-select" onchange="updateClientAccess('${client.id}', this.value)">
          <option value="none" ${client.accessLevel === 'none' ? 'selected' : ''}>No Access</option>
          <option value="read" ${client.accessLevel === 'read' ? 'selected' : ''}>Read Only</option>
          <option value="write" ${client.accessLevel === 'write' ? 'selected' : ''}>Read & Write</option>
          <option value="execute" ${client.accessLevel === 'execute' ? 'selected' : ''}>Execute</option>
        </select>
        <button class="btn danger" onclick="disconnectClient('${client.id}')">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `).join('');
}

// Message handling
function sendServerMessage() {
  if (!socket?.connected) {
    showNotification('Not connected to socket server', 'error');
    return;
  }

  const message = elements.chatMessage?.value.trim();
  if (!message) {
    showNotification('Please enter a message', 'warning');
    return;
  }

  socket.emit('serverMessage', {
    message: message,
    timestamp: new Date().toISOString()
  });

  if (elements.chatMessage) {
    elements.chatMessage.value = '';
  }
}

// File operations
function listFiles() {
  if (!socket?.connected) {
    showNotification('Not connected to socket server', 'error');
    return;
  }
  socket.emit('listFiles');
}

async function readFile() {
  const filePath = elements.filePath?.value;
  if (!filePath) {
    showNotification("Please enter a file path", "warning");
    return;
  }

  try {
    const response = await fetch("/read-file", {
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
  const filePath = elements.filePath?.value;
  const content = elements.fileContent?.value;

  if (!filePath || !content) {
    showNotification("Please enter both file path and content", "warning");
    return;
  }

  try {
    const response = await fetch("/write-file", {
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
  const filePath = elements.filePath?.value;
  if (!filePath) {
    showNotification("Please enter a file path", "warning");
    return;
  }

  if (!confirm("Are you sure you want to delete this file?")) {
    return;
  }

  try {
    const response = await fetch("/delete-file", {
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

function updateClientAccess(clientId, accessLevel) {
  if (!socket?.connected) {
    showNotification('Not connected to socket server', 'error');
    return;
  }

  socket.emit('setAccessLevel', {
    clientId: clientId,
    accessLevel: accessLevel
  });
}

// Socket event handlers
function initializeSocketConnection() {
  socket = io();

  socket.on('connect', () => {
    showNotification('Socket server connected', 'success');
  });

  socket.on('disconnect', () => {
    showNotification('Socket server disconnected', 'error');
  });

  socket.on('clientListUpdate', (clients) => {
    updateClientList(clients);
    if (elements.activeClientCount) {
      elements.activeClientCount.textContent = `Active Clients: ${clients.length}`;
    }
  });

  socket.on('newMessage', (messageInfo) => {
    if (!elements.chatLog) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${messageInfo.isServer ? 'server-message' : 'client-message'}`;
    
    const time = new Date(messageInfo.timestamp).toLocaleTimeString();
    messageDiv.innerHTML = `
      <span class="sender">${messageInfo.name || 'Server'}:</span>
      <span class="content">${messageInfo.message}</span>
      <span class="time">${time}</span>
    `;

    elements.chatLog.appendChild(messageDiv);
    elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
  });

  socket.on('fileList', (files) => {
    showNotification(`Available files: ${files.join(', ')}`, 'info');
  });
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initializeServerInfo();
  initializeSocketConnection();
  
  // Add event listener for chat input
  elements.chatMessage?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendServerMessage();
    }
  });
});