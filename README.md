# UDP Multi-User File Management System

## University Details

- University: University of Prishtina "Hasan Prishtina"
- Faculty: Faculty of Electrical and Computer Enigneering
- Department: Computer and Software Engineering
- Course: Computer Network
- Semester: 5th Semester

## Supervisors

- Professor: Blerim Rexha
- Assistent: Mergim Hoti

## Contributors

- [Art Kelmendi](https://github.com/artkelmendi)
- [Art Jashari](https://github.com/Art-Jashari)
- [Argjend Nimanaj](https://github.com/Argjend1of1)
- [Armenie Sadikaj](https://github.com/armeniasadikaj)

## Overview

A Node.js-based file management system with real-time user interaction, role-based access control, and file operations support.

## Features

### Role-Based Access Control

- **Admin**: Full system access, user management
- **Power User**: Read, write, and execute files
- **Moderator**: Read and write files
- **User**: Read-only access

### File Operations

- List files in managed directory
- Read file contents
- Create and edit files
- Execute supported file types (.js, .py, .sh, .bat)
- Delete files (admin only)

### User Management

- Real-time user tracking
- Dynamic role assignment
- Live status updates
- Connection/disconnection monitoring

## Commands

### Basic Commands (All Users)

```bash
list
read <filename>
exit: Quit application
```

### Moderator Commands (+ Basic Commands)

```bash
write <filename> <content> : Create/Update file with content
```

### Power User Commands (+ Moderator Commands)

```bash
execute <filename> : Execute file
```

### Admin Commands (+ All Commands)

```bash
delete <filename> : Delete file (admin only)
users : List connected users
setrole <username> <role> : Set user role
```

## Installation

1. Clone the repository

```bash
git clone https://github.com/artkelmendi/RrjetaKopjuterike-GR7.git
```

2. Dependencies

The project uses only Node.js built-in modules:

- [dgram](https://nodejs.org/api/dgram.html) - UDP networking
- [fs](https://nodejs.org/api/fs.html) - File system operations
- [path](https://nodejs.org/api/path.html) - Path manipulation
- [child_process](https://nodejs.org/api/child_process.html) - Process management
- [readline](https://nodejs.org/api/readline.html) - Interactive input

## Usage

1. Start the server

```bash
node server.js
```

2. Start the client

```bash
node client.js
```

3. First connected user becomes admin, subsequent users join as regular users

## System Requirements

- Node.js v12.0.0 or higher
- UDP port 3000 available

## File Structure

```bash
project/
├── server.js # Server implementation
├── client.js # Client implementation
└── managed_files/ # Directory for managed files
```

## Security Features

- Role-based permission checks
- Operation confirmations
- Path validation
- Process execution timeouts
- Interactive process management

## File Support

- Javascript (.js)
- Python (.py),
- Bash (.sh),
- Batch files (.bat)

## Technical Details

- Built with Node.js
- Uses UDP for communication
- Real-time updates
- Interactive command-line interface
- Support for multiple file types

## Example Usage

```bash
# Start server
$ node server.js
✓ Server running on 0.0.0.0:3000
→ Managing files in: ./managed_files

# Start client
$ node client.js
Enter your name: Admin
✓ Welcome Admin!
Role: Administrator

# Connect as user
$ node client.js
Enter your name: User
✓ Welcome User!
Role: User
```

## Error Handling

- Invalid permissions
- File not found
- Invalid commands
- Connection errors
- Process execution errors

## Notes

- First connected user becomes admin
- File operations are managed in a dedicated directory
- Interactive process execution with timeout (5 minutes)
- Real-time user management and status updates
- Color-coded console output for enhanced readability
