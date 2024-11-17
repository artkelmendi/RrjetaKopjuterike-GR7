const dgram = require("dgram");
const readline = require("readline");
const path = require("path");
const fs = require("fs");

class UDPClient {
  constructor() {
    this.client = dgram.createSocket("udp4");
    this.userName = null;
    this.isAdmin = false;
    this.serverPort = 3000;
    this.serverHost = "localhost";
    this.isExecuting = false;
    this.processEnded = false;
    this.connectedUsers = new Map();
    this.currentRole = null;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.colors = {
      success: '\x1b[32m%s\x1b[0m',  // Green
      error: '\x1b[31m%s\x1b[0m',    // Red
      info: '\x1b[36m%s\x1b[0m',     // Cyan
      warning: '\x1b[33m%s\x1b[0m'   // Yellow
    };

    this.setupMessageHandler();
    this.rl.setPrompt('');
  }

  async initialize() {
    try {
      await this.setupUserName();
      const message = JSON.stringify({
        type: "register",
        userName: this.userName,
      });
      this.client.send(message, this.serverPort, this.serverHost);
    } catch (error) {
      console.error(this.colors.error, `✗ Initialization error: ${error.message}`);
      this.cleanup();
    }
  }

  setupMessageHandler() {
    this.client.on("message", (msg) => {
      try {
        const data = JSON.parse(msg.toString());

        switch (data.type) {
          case "registration_success":
            this.isAdmin = data.isAdmin;
            this.currentRole = data.role;
            console.log(this.colors.success, `✓ ${data.message}`);
            console.log(this.colors.info, 
              `Role: ${this.currentRole.charAt(0).toUpperCase() + this.currentRole.slice(1)}`);
            this.startInteraction();
            break;

          case "user_connected":
            if (this.isAdmin) {
              this.connectedUsers.set(data.clientId, {
                userName: data.userName,
                role: data.role || 'user'
              });
              console.log(this.colors.info, 
                `\n→ New user connected: ${data.userName}`);
              this.displayUserList();
              this.rl.prompt();
            }
            break;

          case "user_disconnected":
            if (this.isAdmin) {
              const userName = this.connectedUsers.get(data.clientId)?.userName;
              this.connectedUsers.delete(data.clientId);
              console.log(this.colors.warning, `\n! User disconnected: ${userName}`);
              this.displayUserList();
              this.rl.prompt();
            }
            break;

          case "role_updated":
            if (this.isAdmin) {
              const targetClientId = data.targetClientId;
              if (this.connectedUsers.has(targetClientId)) {
                this.connectedUsers.get(targetClientId).role = data.newRole;
                console.log(this.colors.success, `\n✓ ${data.message}`);
                this.displayUserList();
              }
            } else {
              this.currentRole = data.newRole;
              console.log(this.colors.success, `✓ ${data.message}`);
              console.log('\nYour new permissions are:');
              this.showHelp();
            }
            this.rl.prompt();
            break;

          case "success":
            if (data.files) {
              // Handle file listing
              console.log(this.colors.success, `✓ ${data.message}`);
              console.log('\nFiles in managed directory:');
              console.log('─'.repeat(60));
              console.log(
                'Name'.padEnd(20) +
                'Size'.padEnd(10) +
                'Type'.padEnd(10) +
                'Last Modified'
              );
              console.log('─'.repeat(60));
              
              data.files.forEach(file => {
                if (file.error) {
                  console.log(
                    `${file.name.padEnd(20)}[Error reading file info]`
                  );
                } else {
                  console.log(
                    `${file.name.padEnd(20)}` +
                    `${file.size.padEnd(10)}` +
                    `${file.type.padEnd(10)}` +
                    `${file.modified}`
                  );
                }
              });
              console.log('─'.repeat(60));
            } else if (data.content) {
              console.log(this.colors.success, '✓ File content:');
              console.log(data.content);
              console.log(this.colors.info, `ℹ ${data.details}`);
            } else {
              console.log(this.colors.success, `✓ ${data.message}`);
              if (data.details) {
                console.log(this.colors.info, `ℹ ${data.details}`);
              }
            }
            break;

          case "error":
            console.log(this.colors.error, `✗ ${data.message}`);
            if (data.details) {
              console.log(this.colors.warning, `! ${data.details}`);
            }
            if (data.runtime) {
              console.log(this.colors.info, `ℹ Execution time: ${data.runtime}`);
            }
            break;

          case "execute_output":
            process.stdout.write(data.output);
            if (data.interactive && !this.isExecuting) {
              this.isExecuting = true;
              this.processEnded = false;
            }
            break;

          case "execute_error":
            console.log(this.colors.error, `! ${data.error}`);
            break;

          case "execute_end":
            this.processEnded = true;
            this.isExecuting = false;
            console.log(this.colors.info, `→ ${data.message}`);
            console.log();
            this.resetPrompt();
            break;
        }
      } catch (error) {
        console.error(this.colors.error, `✗ Message handling error: ${error.message}`);
      }
    });

    this.client.on('error', (err) => {
      console.error(this.colors.error, `✗ Client error: ${err.message}`);
      this.resetPrompt();
    });
  }

  resetPrompt() {
    setTimeout(() => {
      this.rl.setPrompt(`${this.userName}> `);
      this.rl.prompt();
    }, 100);
  }

  startInteraction() {
    this.showHelp();
    this.rl.setPrompt(`${this.userName}> `);
    this.rl.prompt();

    this.rl.on("line", async (input) => {
        if (this.isExecuting) {
            const message = JSON.stringify({
                type: "process_input",
                input: input
            });
            this.client.send(message, this.serverPort, this.serverHost);
            return;
        }

        if (!input.trim()) {
            this.rl.prompt();
            return;
        }

        const [command, ...args] = input.trim().split(" ");

        // Handle exit command first
        if (command === "exit") {
            console.log(this.colors.info, '→ Disconnecting...');
            this.cleanup();
            return;
        }

        // Handle help command
        if (command === "help") {
            this.showHelp();
            this.rl.prompt();
            return;
        }

        // Handle admin-specific commands
        if (this.isAdmin) {
            if (command === "users") {
                console.log('\nConnected Users:');
                console.log('─'.repeat(40));
                console.log('Username'.padEnd(20) + 'Role'.padEnd(20));
                console.log('─'.repeat(40));
                this.connectedUsers.forEach((user, clientId) => {
                    console.log(
                        `${user.userName.padEnd(20)}${user.role.padEnd(20)}`
                    );
                });
                console.log('─'.repeat(40));
                this.rl.prompt();
                return;
            }

            if (command === "setrole") {
                const [targetUser, newRole] = args;
                if (!targetUser || !newRole) {
                    console.log(this.colors.error, '✗ Usage: setrole <username> <role>');
                    this.rl.prompt();
                    return;
                }

                let targetClientId;
                for (const [clientId, user] of this.connectedUsers) {
                    if (user.userName === targetUser) {
                        targetClientId = clientId;
                        break;
                    }
                }

                if (!targetClientId) {
                    console.log(this.colors.error, `✗ User "${targetUser}" not found`);
                    this.rl.prompt();
                    return;
                }

                const message = JSON.stringify({
                    type: "role_management",
                    targetClientId,
                    newRole
                });

                this.client.send(message, this.serverPort, this.serverHost);
                this.rl.prompt();
                return;
            }
        }

        // Handle file operations
        const filename = args[0];
        const content = args.slice(1).join(" ");

        // Confirm operation if needed
        if (command === "write" || command === "execute" || command === "delete") {
            try {
                const confirmed = await this.confirmOperation(command, filename);
                if (!confirmed) {
                    console.log(this.colors.warning, '! Operation cancelled');
                    this.rl.prompt();
                    return;
                }
            } catch (error) {
                console.log(this.colors.error, `✗ Error: ${error.message}`);
                this.rl.prompt();
                return;
            }
        }

        const message = JSON.stringify({
            type: "fileAccess",
            operation: command,
            filename: filename,
            content: content
        });

        this.client.send(message, this.serverPort, this.serverHost);
        this.rl.prompt();
    });
  }

  async confirmOperation(operation, filename) {
    switch(operation) {
        case 'write':
            const writeAnswer = await this.askQuestion(
                this.colors.warning,
                `! Are you sure you want to write "${filename}"? (y/n): `
            );
            return writeAnswer.toLowerCase() === 'y';

        case 'execute':
            const execAnswer = await this.askQuestion(
                this.colors.warning,
                `! Are you sure you want to execute "${filename}"? (y/n): `
            );
            return execAnswer.toLowerCase() === 'y';

        case 'delete':
            const deleteAnswer = await this.askQuestion(
                this.colors.warning,
                `! Are you sure you want to delete "${filename}"? (y/n): `
            );
            return deleteAnswer.toLowerCase() === 'y';

        default:
            return true;
    }
  }

  askQuestion(color, question) {
    return new Promise((resolve) => {
      console.log(color, question);
      this.rl.question('', (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async setupUserName() {
    return new Promise((resolve) => {
      console.log(this.colors.info, '=== UDP File Manager ===');
      this.rl.question('Enter your name: ', (name) => {
        if (name.trim()) {
          this.userName = name.trim();
          resolve();
        } else {
          console.log(this.colors.error, '✗ Name cannot be empty');
          this.setupUserName().then(resolve);
        }
      });
    });
  }

  cleanup() {
    this.client.close();
    this.rl.close();
    process.exit(0);
  }

  handleCommand(input) {
    const [command, ...args] = input.trim().split(" ");

    if (command === "users" && this.isAdmin) {
      console.log('\nConnected Users:');
      console.log('─'.repeat(40));
      console.log('Username'.padEnd(20) + 'Role'.padEnd(20));
      console.log('─'.repeat(40));
      this.connectedUsers.forEach((user, clientId) => {
        console.log(
          `${user.userName.padEnd(20)}${user.role.padEnd(20)}`
        );
      });
      console.log('─'.repeat(40));
      return;
    }

    if (command === "setrole" && this.isAdmin) {
      const [targetUser, newRole] = args;
      let targetClientId;

      for (const [clientId, user] of this.connectedUsers) {
        if (user.userName === targetUser) {
          targetClientId = clientId;
          break;
        }
      }

      if (!targetClientId) {
        console.log(this.colors.error, `✗ User "${targetUser}" not found`);
        return;
      }

      const message = JSON.stringify({
        type: "role_management",
        targetClientId,
        newRole
      });

      this.client.send(message, this.serverPort, this.serverHost);
      return;
    }

    // ... handle other commands
  }

  showHelp() {
    console.log('\n=== Available Commands ===');
    
    // Basic commands for all users
    console.log(this.colors.info, 'Basic Commands:');
    console.log('  help              : Show this help message');
    console.log('  list              : Show all files');
    console.log('  read <filename>   : Show file content');
    console.log('  exit             : Quit application');
    
    // Role-specific commands
    const userRole = this.currentRole || (this.isAdmin ? 'admin' : 'user');
    
    switch(userRole) {
        case 'admin':
            console.log(this.colors.warning, '\nAdmin Commands:');
            console.log('  write <filename> <content>  : Create/Update file with content');
            console.log('  execute <filename>          : Execute file');
            console.log('  delete <filename>           : Delete a file');
            console.log('  users                       : List connected users');
            console.log('  setrole <username> <role>   : Set user role');
            console.log('\nAvailable Roles:');
            console.log('  - user       (Read-only access)');
            console.log('  - moderator  (Read and write access)');
            console.log('  - power_user (Read, write, and execute access)');
            console.log('  - admin      (Full system access)');
            break;
            
        case 'power_user':
            console.log(this.colors.warning, '\nPower User Commands:');
            console.log('  write <filename> <content>  : Create/Update file with content');
            console.log('  execute <filename>          : Execute file');
            break;
            
        case 'moderator':
            console.log(this.colors.warning, '\nModerator Commands:');
            console.log('  write <filename> <content>  : Create/Update file with content');
            break;
            
        case 'user':
            console.log(this.colors.info, '\nYou have read-only access.');
            break;
    }
    
    console.log('\n======================\n');
  }

  displayUserList() {
    if (!this.isAdmin) return;
    
    console.log('\nConnected Users:');
    console.log('────────────────────────────────────────');
    console.log('Username'.padEnd(20) + 'Role'.padEnd(20));
    console.log('────────────────────────────────────────');
    this.connectedUsers.forEach((user, clientId) => {
        console.log(
            `${user.userName.padEnd(20)}${user.role.padEnd(20)}`
        );
    });
    console.log('────────────────────────────────────────');
  }
}

const client = new UDPClient();
client.initialize();
