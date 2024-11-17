const elements = {
	clientName: document.getElementById('client-name'),
	serverId: document.getElementById('server-id'),
	port: document.getElementById('port'),
	connectionStatus: document.getElementById('connection-status'),
	disconnectBtn: document.getElementById('disconnect-btn'),
	chatBox: document.getElementById('chat-box'),
	messageInput: document.getElementById('message-input'),
	readFilePath: document.getElementById('read-file-path'),
	writeFilePath: document.getElementById('write-file-path'),
	fileContentDisplay: document.getElementById('file-content-display'),
	fileContentWrite: document.getElementById('file-content-write'),
	fileListBtn: document.querySelector('.file-list-btn'),
	fileList: document.getElementById('file-list'),
};

let serverAddress = '127.0.0.1';
let httpPort = 3001;

// Update connection status
function updateConnectionStatus(status) {
	if (elements.connectionStatus) {
		elements.connectionStatus.textContent = status;
		elements.connectionStatus.className = `status-indicator ${status.toLowerCase()}`;
	}
}

// Show notifications
function showNotification(message, type = 'info') {
	const notification = document.createElement('div');
	notification.className = `notification ${type}`;
	notification.textContent = message;

	document.getElementById('notification-container')?.appendChild(notification);
	setTimeout(() => notification.remove(), 3000);
}

// Connect to server
async function connectToServer() {
	const clientName = elements.clientName.value.trim() || "Anonymous";
	serverAddress = elements.serverId.value.trim() || serverAddress;
	httpPort = parseInt(elements.port.value.trim(), 10) || httpPort;

	try {
		const response = await fetch(`http://${serverAddress}:${httpPort}/send-udp-message`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				type: 'CONNECT',
				data: { clientName } // Ensure this matches the server's expectations
			})
		});

		if (response.ok) {
			updateConnectionStatus('Connected');
			showNotification('Connected to server', 'success');
		} else {
			const errorData = await response.json();
			console.error('Server response:', errorData);
			throw new Error(errorData.message || 'Failed to connect');
		}
	} catch (error) {
		console.error('Error connecting to server:', error);
		showNotification('Failed to connect to server', 'error');
	}
}


// Disconnect (simply updates UI)
function disconnect() {
	updateConnectionStatus('Disconnected');
	showNotification('Disconnected from server', 'warning');
}

// Send a chat message
async function sendMessage() {
	const message = elements.messageInput.value.trim();
	if (!message) {
		showNotification('Please enter a message', 'warning');
		return;
	}

	try {
		const response = await fetch(`http://${serverAddress}:${httpPort}/send-udp-message`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'CHAT', data: { message } }),
		});

		if (response.ok) {
			elements.messageInput.value = '';
			showNotification('Message sent', 'success');
		} else {
			throw new Error('Failed to send message');
		}
	} catch (error) {
		console.error('Error sending message:', error);
		showNotification('Failed to send message', 'error');
	}
}

// List files
async function listFiles() {
	try {
		const response = await fetch(`http://${serverAddress}:${httpPort}/get-udp-messages`);
		const data = await response.json();

		updateFileList(data);
		showNotification('File list updated', 'success');
	} catch (error) {
		console.error('Error listing files:', error);
		showNotification('Failed to list files', 'error');
	}
}

function updateFileList(files) {
	if (!elements.fileList) return;

	if (!files || files.length === 0) {
		elements.fileList.innerHTML = '<p class="empty-message">No files available</p>';
		return;
	}

	elements.fileList.innerHTML = files
		.map(
			(file) => `
        <li class="file-item">
            <span>${file}</span>
            <button onclick="readFile('${file}')">Read</button>
        </li>`
		)
		.join('');
}

// Read a file
async function readFile(filePath) {
	if (!filePath) {
		showNotification('Please provide a file path', 'warning');
		return;
	}

	try {
		const response = await fetch(`http://${serverAddress}:${httpPort}/read-file`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filePath }),
		});
		const data = await response.json();

		if (data.success) {
			elements.fileContentDisplay.value = data.content;
			showNotification('File content loaded', 'success');
		} else {
			throw new Error(data.message || 'Failed to read file');
		}
	} catch (error) {
		console.error('Error reading file:', error);
		showNotification('Failed to read file', 'error');
	}
}

// Write a file
async function writeFile() {
	const filePath = elements.writeFilePath.value.trim();
	const content = elements.fileContentWrite.value.trim();

	if (!filePath || !content) {
		showNotification('Please provide both file path and content', 'warning');
		return;
	}

	try {
		const response = await fetch(`http://${serverAddress}:${httpPort}/write-file`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filePath, content }),
		});
		const data = await response.json();

		if (data.success) {
			showNotification('File written successfully', 'success');
		} else {
			throw new Error(data.message || 'Failed to write file');
		}
	} catch (error) {
		console.error('Error writing file:', error);
		showNotification('Failed to write file', 'error');
	}
}

// Event listeners
elements.messageInput?.addEventListener('keypress', (e) => {
	if (e.key === 'Enter') sendMessage();
});
async function listFiles() {
	if (!serverAddress || !httpPort) {
		showNotification("Server details are missing", "error");
		return;
	}

	try {
		// Send request to fetch file list
		const response = await fetch(`http://${serverAddress}:${httpPort}/send-udp-message`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type: "LIST_FILES" }),
		});

		if (response.ok) {
			const result = await response.json();
			if (result.success) {
				updateFileList(result.files);
			} else {
				throw new Error(result.message);
			}
		} else {
			throw new Error("Failed to fetch file list");
		}
	} catch (error) {
		console.error("Error listing files:", error);
		showNotification("Failed to list files", "error");
	}
}

function updateFileList(files) {
	if (!elements.fileList) return;

	if (!files || files.length === 0) {
		elements.fileList.innerHTML = '<p class="empty-message">No files available</p>';
		return;
	}

	elements.fileList.innerHTML = files
		.map(
			(file) => `
        <li class="file-item">
            <span>${file}</span>
            <button onclick="readFile('${file}')" class="btn small secondary">
                <i class="fas fa-eye"></i> Read
            </button>
        </li>`
		)
		.join("");
}
