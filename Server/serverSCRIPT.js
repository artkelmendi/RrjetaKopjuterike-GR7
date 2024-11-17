const elements = {
  ip: document.getElementById("ip"),
  port: document.getElementById("port"),
  clientList: document.getElementById("client-list"),
  chatLog: document.getElementById("chat-log"),
  chatMessage: document.getElementById("chat-message"),
  filePath: document.getElementById("file-path"),
  fileContent: document.getElementById("file-content"),
  activeClientCount: document.getElementById("active-client-count"),
  notificationContainer: document.getElementById("notification-container"),
  loadingIndicator: document.getElementById("loading-indicator"), // Add a loading indicator in the HTML
};

let serverAddress = '127.0.0.1'; // Default to localhost if fetching fails
let serverPort = 3000; // Default UDP port

// Fetch server info
async function fetchServerAddress() {
  try {
    const response = await fetch('/server-info'); // Server provides its info on this endpoint
    const data = await response.json();
    if (data.ip) serverAddress = data.ip;
    if (data.port) serverPort = data.port;

    if (elements.ip) elements.ip.textContent = serverAddress;
    if (elements.port) elements.port.textContent = serverPort;
  } catch (error) {
    console.error("Error fetching server info:", error);
    showNotification("Failed to fetch server info", "error");
  }
}

// Call this during initialization
fetchServerAddress();

// Helper function to show notifications
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  if (elements.notificationContainer) {
    elements.notificationContainer.appendChild(notification);
  }

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Helper function to toggle loading indicator
function toggleLoading(isLoading) {
  if (!elements.loadingIndicator) return;
  elements.loadingIndicator.style.display = isLoading ? "block" : "none";
}

// Send a message to the server (via HTTP)
async function sendMessageToServer(type, data = {}) {
  try {
    const response = await fetch('/send-udp-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    });

    if (!response.ok) throw new Error('Failed to send message');

    const result = await response.json();
    showNotification(result.message || 'Message sent', 'success');
  } catch (err) {
    console.error("Error sending message to server:", err);
    showNotification("Failed to send message to server", "error");
  }
}

// Fetch messages from the server
async function fetchMessages() {
  try {
    const response = await fetch('/get-udp-messages');
    if (!response.ok) throw new Error('Failed to fetch messages');

    const messages = await response.json();
    updateChatLog(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
  }
}

// Update the chat log
function updateChatLog(messages) {
  if (!elements.chatLog) return;

  elements.chatLog.innerHTML = '';
  messages.forEach((message) => displayChatMessage(message));
}

// Display a chat message
function displayChatMessage(data) {
  if (!elements.chatLog) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${data.isServer ? 'server-message' : 'client-message'}`;

  const time = new Date(data.timestamp).toLocaleTimeString();
  messageDiv.innerHTML = `
    <span class="sender">${data.name || 'Server'}:</span>
    <span class="content">${data.message}</span>
    <span class="time">${time}</span>
  `;

  elements.chatLog.appendChild(messageDiv);
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

// Send a chat message to the server
function sendServerMessage() {
  const message = elements.chatMessage?.value.trim();
  if (!message) {
    showNotification('Please enter a message', 'warning');
    return;
  }

  sendMessageToServer('CHAT', { message });

  if (elements.chatMessage) {
    elements.chatMessage.value = '';
  }
}

// Request list of files from the server
function listFiles() {
  sendMessageToServer('LIST_FILES');
}

// Request to read a file
async function readFile() {
  const filePath = elements.filePath?.value.trim();
  if (!filePath) {
    showNotification("Please enter a file path", "warning");
    return;
  }

  toggleLoading(true); // Show loading indicator
  try {
    const response = await fetch('/read-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    showNotification(`Error: ${error.message}`, "error");
  } finally {
    toggleLoading(false); // Hide loading indicator
  }
}


async function writeFile() {
  const filePath = elements.filePath?.value.trim();
  const content = elements.fileContent?.value.trim();

  if (!filePath || !content) {
    showNotification("Please provide both file path and content", "warning");
    return;
  }

  toggleLoading(true); // Show loading indicator
  try {
    const response = await fetch('/write-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    showNotification(`Error: ${error.message}`, "error");
  } finally {
    toggleLoading(false); // Hide loading indicator
  }
}
// Request to delete a file
async function deleteFile() {
  const filePath = elements.filePath?.value.trim();
  if (!filePath) {
    showNotification("Please enter a file path to delete", "warning");
    return;
  }


  const confirmDelete = confirm(`Are you sure you want to delete the file: ${filePath}?`);
  if (!confirmDelete) {
    showNotification("File deletion canceled", "info");
    return;
  }

  toggleLoading(true);
  try {
    const response = await fetch('/delete-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });

    const data = await response.json();
    if (data.success) {
      showNotification("File deleted successfully", "success");
      elements.fileContent.value = ""; // Clear file content area
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    showNotification(`Error: ${error.message}`, "error");
  } finally {
    toggleLoading(false);
  }
}
function sendChatMessage() {
  const message = elements.chatMessage?.value.trim();
  if (!message) {
    showNotification('Please enter a message to send', 'warning');
    return;
  }

  // Send the chat message to the server
  sendMessageToServer('CHAT', { message });

  // Clear the input field
  if (elements.chatMessage) {
    elements.chatMessage.value = '';
  }

  showNotification('Message sent', 'success');
}


async function fetchChatMessages() {
  try {
    const response = await fetch('/get-udp-messages');
    if (!response.ok) throw new Error('Failed to fetch chat messages');

    const messages = await response.json();
    updateChatLog(messages);
  } catch (err) {
    console.error("Error fetching chat messages:", err);
  }
}

function updateChatLog(messages) {
  if (!elements.chatLog) return;

  elements.chatLog.innerHTML = '';
  messages.forEach((message) => displayChatMessage(message));
}

function displayChatMessage(data) {
  if (!elements.chatLog) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${data.isServer ? 'server-message' : 'client-message'}`;

  const time = new Date(data.timestamp).toLocaleTimeString();
  messageDiv.innerHTML = `
        <span class="sender">${data.name || 'Server'}:</span>
        <span class="content">${data.message || 'No content provided'}</span>
        <span class="time">${time}</span>
    `;

  elements.chatLog.appendChild(messageDiv);
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight; // Scroll to the latest message
}



setInterval(fetchChatMessages, 5000);



// Update client list
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

  elements.clientList.innerHTML = clients
      .map(
          (client) => `
    <div class="client-card">
      <div class="client-info">
        <span class="client-name">${client.name || 'Anonymous'}</span>
        <span class="client-id">ID: ${client.id}</span>
      </div>
    </div>
  `
      )
      .join('');
}

// Periodically fetch messages
setInterval(fetchMessages, 5000);

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  fetchServerAddress();

  // Add event listener for chat input
  elements.chatMessage?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendServerMessage();
    }
  });
});
