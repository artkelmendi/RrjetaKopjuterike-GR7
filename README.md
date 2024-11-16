# File Management System with Real-Time Communication

## Overview

This project implements a client-server file management system with real-time communication capabilities and comprehensive user permissions. The system allows multiple clients to connect to a central server, manage files, and communicate in real-time while maintaining secure access controls.

## Features

- Real-time client-server communication
- File operations (read, write, execute, delete)
- User authentication and authorization
- Role-based access control
- File-specific permissions
- Live chat functionality
- Real-time notifications
- Secure file operations

## System Architecture

### Server Components

- **Express Server**: Handles HTTP requests and serves static files
- **Socket.IO Server**: Manages real-time communication
- **File System Manager**: Handles file operations
- **Permission System**: Controls access to resources
- **User Management**: Handles user authentication and sessions

### Client Components

- **UI Interface**: User-friendly interface for file operations
- **Socket.IO Client**: Manages real-time communication with server
- **Permission Manager**: Handles user permissions display and management
- **File Operation Interface**: Interface for file manipulation
- **Chat System**: Real-time communication between users

## Permission System

### User Roles

```javascript
const UserRole = {
  GUEST: "guest", // Limited access
  USER: "user", // Standard access
  MODERATOR: "mod", // Enhanced access
  ADMIN: "admin", // Full access
};
```

### Permission Levels

```javascript
const PermissionLevel = {
  NONE: 0, // No access
  VIEW: 1, // Can view files
  EDIT: 2, // Can edit files
  EXECUTE: 4, // Can execute files
  DELETE: 8, // Can delete files
  ADMIN: 15, // All permissions
};
```

## Setup and Installation

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)

### Installation Steps

1. Clone the repository:

```bash
git clone https://github.com/artkelmendi/RrjetaKopjuterike-GR7.git
cd RrjetaKopjuterike-GR7
```

2. Install dependencies:

```bash
npm install
```

3. Configure the environment:

```bash
cp .env.example .env
```

# Edit .env with your settings

4. Start the server:

```bash
npm start
```

## Usage

### Starting the Server

```bash
node Server/server.js
```

The server will start on the default port (3000) or the port specified in your environment variables.

### Connecting Clients

1. Open a web browser
2. Navigate to `http://localhost:3000/clientUI/clientHTML.html`
3. Enter connection details:
   - Name
   - Server ID (localhost or IP)
   - Port number

### File Operations

- **View Files**: Click on file to view contents
- **Edit Files**: Use the editor to modify file contents
- **Delete Files**: Use delete button (requires permission)
- **Execute Files**: Use execute button (requires permission)

### Managing Permissions

#### As Admin

1. Select a file
2. Click "Manage Permissions"
3. Choose user
4. Set permission levels
5. Save changes

#### Checking Permissions

```javascript
// Example permission check
if (user.hasPermission(PermissionLevel.EDIT, fileId)) {
  // Allow edit operation
}
```

## Project Structure

```
project/
├── clientUI/
│   ├── clientHTML.html    # Client interface
│   ├── clientSTYLE.css    # Client styling
│   └── clientSCRIPT.js    # Client logic
├── Server/
│   ├── server.js          # Main server file
│   ├── serverHTML.html    # Server interface
│   ├── serverSTYLE.css    # Server styling
│   ├── serverSCRIPT.js    # Server logic
│   └── models/
│       ├── permissions.js # Permission definitions
│       ├── users.js      # User management
│       └── files.js      # File operations
├── package.json
└── README.md
```

## API Endpoints

### File Operations

- `GET /files/:fileId` - Retrieve file
- `POST /files/:fileId/edit` - Edit file
- `POST /files/:fileId/execute` - Execute file
- `DELETE /files/:fileId` - Delete file

### Permission Management

- `POST /permissions/grant` - Grant permissions
- `POST /permissions/revoke` - Revoke permissions
- `GET /permissions/:fileId` - Get file permissions

## Socket Events

### Client -> Server

- `connectToServer` - Initialize connection
- `fileOperation` - Request file operation
- `chatMessage` - Send chat message
- `requestPermission` - Request permission change

### Server -> Client

- `connectionStatus` - Connection updates
- `fileOperationResult` - Operation results
- `newMessage` - New chat messages
- `permissionUpdate` - Permission changes

## Security

- All file operations are permission-checked
- Paths are sanitized to prevent directory traversal
- User sessions are authenticated
- Real-time operations are verified
- File access is logged

## Error Handling

The system includes comprehensive error handling for:

- Connection failures
- Permission denials
- File operation errors
- Invalid requests
- System errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Troubleshooting

### Common Issues

1. **Connection Failed**

   - Verify server is running
   - Check port availability
   - Confirm network connectivity

2. **Permission Denied**

   - Verify user role
   - Check file permissions
   - Confirm operation requirements

3. **File Operation Failed**
   - Check file existence
   - Verify file permissions
   - Confirm operation validity

### Debug Mode

Enable debug mode by setting `DEBUG=true` in your environment variables.

## Contact

For support or queries, please open an issue in the repository.
