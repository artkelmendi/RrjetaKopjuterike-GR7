function connectToServer() {
    const name = document.getElementById('client-name').value || 'Anonymous';
    const serverId = document.getElementById('server-id').value;
    const port = document.getElementById('port').value;

    if (!serverId || !port) {
        alert("Please enter both Server ID and Port.");
        return;
    }

    console.log(`Attempting to connect to server with ID: ${serverId} on port: ${port}`);

    // Construct the URL for the connection request
    const url = `http://${serverId}:${port}/connect`;

    // Send connection request with client name and port
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, port })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log("Connection successful:", data);
            alert(data.message); // Show success message to the user
        })
        .catch(error => {
            console.error("Error connecting to server:", error);
            alert("Failed to connect to the server. Please check the Server ID and Port.");
        });
}
function sendMessage() {
    const message = document.getElementById('message-input').value;
    const clientName = document.getElementById('client-name').value || 'Anonymous';
    const serverId = document.getElementById('server-id').value;
    const port = document.getElementById('port').value;

    if (!message.trim()) {
        alert("Please enter a message.");
        return;
    }


    const url = `http://${serverId}:${port}/send-message`;

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clientName, message })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const chatBox = document.getElementById('chat-box');
                const msgElement = document.createElement('div');
                msgElement.textContent = `${clientName}: ${message}`;
                chatBox.appendChild(msgElement);

                // Clear the input
                document.getElementById('message-input').value = '';
            }
        })
        .catch(error => console.error('Error sending message:', error));
}

