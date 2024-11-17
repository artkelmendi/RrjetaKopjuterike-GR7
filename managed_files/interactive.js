const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("What is your name? ", (name) => {
  console.log(`Hello, ${name}!`);
  rl.question("How old are you? ", (age) => {
    console.log(`You are ${age} years old!`);
    rl.close();
    process.exit(0);
  });
});

rl.on('close', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  rl.close();
  process.exit(0);
});
