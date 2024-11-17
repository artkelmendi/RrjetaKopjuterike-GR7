const readline = require("readline");

function factorial(n) {
  if (n === 0) return 1;
  return n * factorial(n - 1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function calculateFactorial() {
  rl.question("Enter a number to calculate factorial: ", (input) => {
    const number = parseInt(input);

    if (isNaN(number)) {
      console.log("Please enter a valid number!");
      calculateFactorial();
      return;
    }

    console.log(`Factorial of ${number} is: ${factorial(number)}`);

    rl.question("Would you like to calculate another factorial? (y/n): ", (answer) => {
      if (answer.toLowerCase() === "y") {
        calculateFactorial();
      } else {
        rl.close();
        process.exit(0);
      }
    });
  });
}

// Handle cleanup
rl.on('close', () => {
  process.exit(0);
});

console.log("Welcome to Factorial Calculator!");
calculateFactorial();
