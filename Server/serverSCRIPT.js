console.log("serverSCRIPT.js is loaded and running");

// Initialize Socket.IO connection
const socket = io();

// Listen for real-time client count updates
socket.on('clientCountUpdate', (count) => {
    updateClientCount(count);
});

// Listen for real-time new messages
socket.on('newMessage', (msg) => {
    const chatLog = document.getElementById('chat-log');

    // Create and append the new message element
    const msgElement = document.createElement('div');
    msgElement.classList.add('message');

    const nameElement = document.createElement('span');
    nameElement.classList.add('name');
    nameElement.textContent = msg.name;

    const timeElement = document.createElement('span');
    timeElement.classList.add('timestamp');
    const timestamp = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    timeElement.textContent = `(${timestamp})`;

    const contentElement = document.createElement('span');
    contentElement.classList.add('content');
    contentElement.textContent = `: ${msg.message}`;

    msgElement.appendChild(nameElement);
    msgElement.appendChild(timeElement);
    msgElement.appendChild(contentElement);

    chatLog.appendChild(msgElement);
    chatLog.scrollTop = chatLog.scrollHeight; // Auto-scroll to the latest message
});

// Fetch and display server information
fetch('/server-info')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log("Server info fetched successfully:", data);
        document.getElementById('ip').textContent = data.ip;
        document.getElementById('port').textContent = data.port;
    })
    .catch(error => console.error('Error fetching server info:', error));

// Function to fetch and display the list of connected clients
function fetchClients() {
    fetch('/clients')
        .then(response => response.json())
        .then(clients => {
            const clientList = document.getElementById('client-list');
            clientList.innerHTML = ''; // Clear existing list

            clients.forEach(client => {
                // Format the connection time to display only hours and minutes
                const connectedAt = new Date(client.connectedAt);
                const formattedTime = connectedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                // Create list item for each client
                const li = document.createElement('li');
                li.textContent = `Name: ${client.name}, IP: ${client.ip}, Connected At: ${formattedTime}`;
                clientList.appendChild(li);
            });

            // Update active client count display
            updateClientCount(clients.length);
        })
        .catch(error => console.error('Error fetching clients:', error));
}

// Function to update the active client count display
function updateClientCount(count) {
    const clientCountElement = document.getElementById('active-client-count');
    clientCountElement.textContent = `Active Clients: ${count}`;
}

// Function to set the server's listening port
function setPort() {
    const port = document.getElementById('port-input').value;
    if (!port) {
        alert('Please enter a port number.');
        return;
    }

    console.log("Attempting to set new port to:", port);

    fetch(`/set-port?port=${port}`, { method: 'POST' })
        .then(response => {
            console.log("Received response from /set-port:", response);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log("Port successfully updated to:", data.port);
            document.getElementById('port').textContent = data.port;
            alert(`Server is now listening on port ${data.port}`);

            // Automatically redirect to the new port
            setTimeout(() => {
                window.location.href = `http://${window.location.hostname}:${data.port}`;
            }, 1000); // Delay by 1 second to allow server time to restart
        })
        .catch(error => console.error('Error setting port:', error));
}
