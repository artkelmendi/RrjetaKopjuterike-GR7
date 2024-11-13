console.log("serverSCRIPT.js is loaded and running");

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

// Function to set the server's listening port
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
        })
        .catch(error => console.error('Error fetching clients:', error));
}

// Fetch client list every 10 seconds
setInterval(fetchClients, 1000);


// Fetch client list every 5 seconds
setInterval(fetchClients, 5000);

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

            // Wait a moment and reload the page on the new port
            setTimeout(() => {
                window.location.href = `http://${window.location.hostname}:${data.port}`;
            }, 1000);
        })
        .catch(error => console.error('Error setting port:', error));
}
