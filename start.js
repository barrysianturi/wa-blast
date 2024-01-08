const { spawn } = require('child_process');

// Jalankan blast.js sebagai child process
const child = spawn('node', ['blast.js']);

// Tangani keluaran dari child process jika diperlukan
child.stdout.on('data', (data) => {
  console.log(`Output from child process: ${data}`);
});

// Tangani jika child process keluar dengan kode tertentu
child.on('exit', (code) => {
  console.log(`Child process exited with code ${code}`);
});
