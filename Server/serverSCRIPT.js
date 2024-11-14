/// DOM Elements
const elements = {
  ip: document.getElementById("ip"),
  port: document.getElementById("port"),
  portInput: document.getElementById("port-input"),
  clientList: document.getElementById("client-list"),
  chatLog: document.getElementById("chat-log"),
  chatName: document.getElementById("chat-name"),
  chatMessage: document.getElementById("chat-message"),
  filePath: document.getElementById("file-path"),
  fileContent: document.getElementById("file-content"),
  activeClientCount: document.getElementById("active-client-count"),
};

// Socket.IO connection
let socket = io();

// Initialize server info
async function initializeServerInfo() {
  try {
    const response = await fetch("/server-info", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Server info received:", data);

    if (data.ip && data.port) {
      elements.ip.textContent = data.ip;
      elements.port.textContent = data.port;
    } else {
      console.error("Invalid server info data:", data);
    }
  } catch (error) {
    console.error("Error fetching server info:", error);
  }
}

// Port management
async function setPort() {
  const port = elements.portInput.value;
  if (!port || port < 1 || port > 65535) {
    alert("Please enter a valid port number (1-65535)");
    return;
  }

  try {
    const response = await fetch(`/set-port?port=${port}`, { method: "POST" });
    const data = await response.json();

    if (data.error) {
      alert(`Error: ${data.error}`);
    } else {
      elements.port.textContent = data.port;
      alert(`Server now listening on port ${data.port}`);
    }
  } catch (error) {
    console.error("Error setting port:", error);
    alert("Failed to change port");
  }
}

// Client management
async function updateClientList() {
  try {
    const response = await fetch("/clients");
    const clients = await response.json();

    elements.clientList.innerHTML = clients
      .map(
        (client) => `
          <li>
              <strong>${client.name}</strong>
              <span class="client-info">Connected: ${new Date(
                client.connectedAt
              ).toLocaleString()}</span>
          </li>
      `
      )
      .join("");
  } catch (error) {
    console.error("Error updating client list:", error);
  }
}

// Message handling
async function sendMessage() {
  const message = elements.chatMessage.value;
  const name = elements.chatName.value || "Anonymous";

  if (!message.trim()) {
    alert("Please enter a message");
    return;
  }

  try {
    const response = await fetch("/send-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message }),
    });

    if (!response.ok) throw new Error("Failed to send message");

    elements.chatMessage.value = "";
  } catch (error) {
    console.error("Error sending message:", error);
    alert("Failed to send message");
  }
}

// File operations
async function readFile() {
  const filePath = elements.filePath.value;
  if (!filePath) {
    alert("Please enter a file path");
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
      alert("File read successfully");
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Error reading file:", error);
    alert(`Error reading file: ${error.message}`);
  }
}

async function writeFile() {
  const filePath = elements.filePath.value;
  const content = elements.fileContent.value;

  if (!filePath || !content) {
    alert("Please enter both file path and content");
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
      alert("File written successfully");
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Error writing file:", error);
    alert(`Error writing file: ${error.message}`);
  }
}

async function deleteFile() {
  const filePath = elements.filePath.value;
  if (!filePath) {
    alert("Please enter a file path");
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
      alert("File deleted successfully");
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    alert(`Error deleting file: ${error.message}`);
  }
}

// Socket event handlers
socket.on("clientCountUpdate", (count) => {
  elements.activeClientCount.textContent = `Active Clients: ${count}`;
  updateClientList();
});

socket.on("newMessage", (message) => {
  const messageDiv = document.createElement("div");
  messageDiv.className = "message";
  messageDiv.innerHTML = `
      <strong>${message.name}</strong>: ${message.message}
      <small class="timestamp">${new Date(
        message.timestamp
      ).toLocaleString()}</small>
  `;
  elements.chatLog.appendChild(messageDiv);
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
});

socket.on("fileAction", (data) => {
  alert(`File ${data.action} action performed on: ${data.filePath}`);
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initializeServerInfo();
  updateClientList();
});
