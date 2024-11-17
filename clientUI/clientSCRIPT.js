let socket;

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
	writeOperations: document.querySelector('.write-operations'),
	readOperations: document.querySelector('.read-operations'),
	fileListBtn: document.querySelector('.file-list-btn'),
	fileList: document.getElementById('file-list')
};

// Connection management
async function connectToServer() {
	const name = elements.clientName.value.trim();
	const serverId = elements.serverId.value.trim();
	const port = elements.port.value.trim();

	if (!serverId || !port) {
		showNotification('Please fill in server details', 'error');
		return;
	}

	try {
		socket = io(`http://${serverId}:${port}`, {
			query: { clientName: name || 'Anonymous' },
			reconnection: true,
			reconnectionAttempts: 5,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
			timeout: 20000
		});

		setupSocketListeners();
		
	} catch (error) {
		console.error('Connection error:', error);
			showNotification('Failed to connect to server', 'error');
	}
}

function disconnect() {
	if (socket) {
		socket.disconnect();
		updateConnectionStatus('Disconnected');
		elements.disconnectBtn.disabled = true;
	}
}

// Socket event listeners
function setupSocketListeners() {
	socket.on('connect', () => {
		updateConnectionStatus('Connected');
		elements.disconnectBtn.disabled = false;
		showNotification('Connected to server', 'success');
	});

	socket.on('disconnect', (reason) => {
		if (reason === 'io client disconnect') {
			updateConnectionStatus('Disconnected');
			elements.disconnectBtn.disabled = true;
			showNotification('Disconnected from server', 'warning');
		}
	});

	socket.on('reconnect', (attemptNumber) => {
		updateConnectionStatus('Connected');
		elements.disconnectBtn.disabled = false;
		showNotification('Reconnected to server', 'success');
	});

	socket.on('reconnect_attempt', (attemptNumber) => {
		showNotification(`Attempting to reconnect (${attemptNumber})...`, 'warning');
	});

	socket.on('reconnect_error', (error) => {
		showNotification('Failed to reconnect', 'error');
	});

	socket.on('accessLevelChanged', (newAccessLevel) => {
		updateUIForAccessLevel(newAccessLevel);
		showNotification(`Access level changed to: ${newAccessLevel}`, 'info');
	});

	socket.on('newMessage', (messageInfo) => {
		if (!elements.chatBox) return;

		const messageDiv = document.createElement('div');
		messageDiv.className = `message ${messageInfo.isServer ? 'server-message' : 'client-message'}`;
		
		const time = new Date(messageInfo.timestamp).toLocaleTimeString();
		messageDiv.innerHTML = `
			<span class="sender">${messageInfo.name}:</span>
			<span class="content">${messageInfo.message}</span>
			<span class="time">${time}</span>
		`;

		elements.chatBox.appendChild(messageDiv);
		elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
	});

	socket.on('fileList', (files) => {
		updateFileList(files);
	});

	socket.on('fileContent', (data) => {
		if (elements.fileContentDisplay) {
			elements.fileContentDisplay.value = data.content;
			showNotification('File content loaded successfully', 'success');
		}
	});

	socket.on('error', (error) => {
		showNotification(error, 'error');
	});

	socket.on('success', (message) => {
		showNotification(message, 'success');
	});
}

// File operations
function listFiles() {
	if (!socket?.connected) {
		showNotification('Not connected to server', 'error');
		return;
	}
	socket.emit('listFiles');
}

function updateFileList(files) {
	if (!elements.fileList) return;

	if (files.length === 0) {
		elements.fileList.innerHTML = '<p class="empty-message">No files available</p>';
		return;
	}

	elements.fileList.innerHTML = `
		<div class="file-list-header">Available Files:</div>
		<ul class="file-list-items">
			${files.map(file => `
				<li class="file-item">
					<i class="fas fa-file-alt"></i>
					<span>${file}</span>
					<div class="file-actions">
						<button onclick="readFile('${file}')" class="btn-small read-control">
							<i class="fas fa-eye"></i>
						</button>
						<button onclick="setWritePath('${file}')" class="btn-small write-control">
							<i class="fas fa-edit"></i>
						</button>
						<button onclick="executeFile('${file}')" class="btn-small execute-control">
							<i class="fas fa-play"></i>
						</button>
					</div>
				</li>
			`).join('')}
		</ul>
	`;
}

function readFile(filePath) {
	if (!socket?.connected) {
		showNotification('Not connected to server', 'error');
		return;
	}
	
	const path = filePath || elements.readFilePath.value.trim();
	if (!path) {
		showNotification('Please specify a file path', 'error');
		return;
	}

	socket.emit('readFile', { filePath: path });
}

function executeFile(filePath) {
	if (!socket?.connected) {
		showNotification('Not connected to server', 'error');
		return;
	}
	
	const path = filePath || elements.readFilePath.value.trim();
	if (!path) {
		showNotification('Please specify a file path', 'error');
		return;
	}

	socket.emit('executeFile', { filePath: path });
}

function writeFile() {
	if (!socket?.connected) {
		showNotification('Not connected to server', 'error');
		return;
	}

	const filePath = elements.writeFilePath.value.trim();
	const content = elements.fileContentWrite.value;

	if (!filePath || !content) {
		showNotification('Please enter both file path and content', 'error');
		return;
	}

	socket.emit('writeFile', { filePath, content });
}

function setWritePath(filename) {
	if (elements.writeFilePath) {
		elements.writeFilePath.value = filename;
	}
}

// Chat functionality
function sendMessage() {
	if (!socket?.connected) {
		showNotification('Not connected to server', 'error');
		return;
	}

	const message = elements.messageInput.value.trim();
	if (!message) {
		showNotification('Please enter a message', 'warning');
		return;
	}

	socket.emit('chatMessage', {
		message: message,
		timestamp: new Date()
	});

	elements.messageInput.value = '';
}

// UI updates
function updateConnectionStatus(status) {
	if (elements.connectionStatus) {
		elements.connectionStatus.textContent = status;
		elements.connectionStatus.className = `status-indicator ${status.toLowerCase()}`;
	}
}

function updateUIForAccessLevel(accessLevel) {
	const writeOperations = document.querySelector('.write-operations');
	const readOperations = document.querySelector('.read-operations');
	const fileListBtn = document.querySelector('.file-list-btn');
	const executeControls = document.querySelectorAll('.execute-control');
	const readControls = document.querySelectorAll('.read-control');
	const writeControls = document.querySelectorAll('.write-control');

	if (fileListBtn) {
		fileListBtn.style.display = accessLevel === 'none' ? 'none' : 'block';
	}

	if (readOperations) {
		readOperations.style.display = ['read', 'write', 'execute'].includes(accessLevel) ? 'block' : 'none';
	}

	if (writeOperations) {
		writeOperations.style.display = accessLevel === 'write' ? 'block' : 'none';
	}

	readControls.forEach(control => {
		control.style.display = ['read', 'write', 'execute'].includes(accessLevel) ? 'block' : 'none';
	});

	writeControls.forEach(control => {
		control.style.display = accessLevel === 'write' ? 'block' : 'none';
	});

	executeControls.forEach(control => {
		control.style.display = accessLevel === 'execute' ? 'block' : 'none';
	});
}

// Notification handling
function showNotification(message, type = 'info') {
	const notification = document.createElement('div');
	notification.className = `notification ${type}`;
	notification.textContent = message;
	
	const container = document.getElementById('notification-container');
	if (!container) return;
	
	notification.style.backgroundColor = getNotificationColor(type);
	notification.style.color = '#ffffff';
	notification.style.padding = '12px 24px';
	notification.style.marginBottom = '10px';
	notification.style.borderRadius = '5px';
	notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
	
	container.appendChild(notification);
	
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

// Event listeners
elements.messageInput?.addEventListener('keypress', (e) => {
	if (e.key === 'Enter') {
		sendMessage();
	}
});

