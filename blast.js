const { Client, ClientInfo, LocalAuth, MessageMedia } = require('whatsapp-web.js');
//const qrcode = require('qrcode-terminal');
const qrcode = require('qrcode');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer(); // Untuk parsing data form-data (gambar)
const cors = require('cors');
const path = require('path');

const fs = require('fs');
const SESSION_DIR = path.join(__dirname, '.wwebjs_auth');

const events = require('events');
const eventEmitter = new events.EventEmitter();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, './frontend')));
app.use(cors()); // Ini akan memungkinkan semua origin. Untuk produksi, tentukan origin yang diizinkan.

let client = null;
let qrCodeDataURL = null;
let qrGenerated = false; // Flag untuk mengetahui apakah QR code sudah di-generate

let logs = [];

function addLog(message) {
  logs.push(message);
  // Opsional: batasi jumlah log untuk menghindari memori yang terlalu besar
  if (logs.length > 100) logs.shift(); // Buang log terlama
}

app.get('/logs', (req, res) => {
  res.json(logs);
});


const initializeWhatsAppClient = () => {
  logs=[];
  client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: { headless: true }
  });
  clientinfo = new ClientInfo();
  addLog('Loading ....');
  client.initialize();
};

const generateQRCode = (qr) => {
  return new Promise((resolve, reject) => {
    qrcode.toDataURL(qr, (err, url) => {
      if (err) {
        reject(err);
      } else {
        resolve(url);
      }
    });
  });
};


// Fungsi untuk menghapus session
const clearSession = () => {
  fs.rm(SESSION_DIR, { recursive: true, force: true }, (err) => {
    if (err) {
      // Handle error jika proses penghapusan gagal
      addLog('Error clearing session:', err);
    } else {
      // Log jika berhasil
      addLog('Session cleared.');
    }
  });
};

// Panggil fungsi ini di awal kode lo, sebelum inisialisasi Client

initializeWhatsAppClient();

client.on('ready', () => {
  logs=[];
  addLog("No WA: " + client.info.wid.user);
  addLog('Client is ready! Click \'Kirim\' to send messages.');
  addLog('Generate New QR if you want to send from a different number.');
});


// Fungsi utama
app.post('/send', upload.single('image'), (req, res) => {
  logs = [];
  addLog("Sending messages ...");
  const messageText = req.body.message;
  const numbers = req.body.numbers.trim().replace(/\r\n/g, '\n').split('\n').filter(Boolean);

  if(req.file){
    const image = new MessageMedia(req.file.mimetype,req.file.buffer.toString('base64'),req.file.originalname); // Gambar dari frontend
    sendImages(numbers, messageText, image);
  } else{
    sendMessages(numbers, messageText );
  }

  res.send({ status: 'Pesan sedang dikirim' });
});


const sendMessages = (numbers, message) => {
  let delay = 2000; // Delay 2 detik
  numbers.forEach((number, index) => {
    setTimeout(() => {
        
        number = number.includes('@c.us') ? number : `${number}@c.us`;
        client.sendMessage(number, message).then(response => {
            // Pesan terkirim
            addLog(`Message sent to ${number}`);
        }).catch(err => {
            // Ada error saat mengirim, handle di sini
            console.error('Error sending message: ', err);
        });
    }, delay * index); // delay diperbanyak dengan index array
  });
};

const sendImages = (numbers, message, image) => {
  let delay = 2000; // Delay 2 detik
  numbers.forEach((number, index) => {
    setTimeout(() => {
        
        number = number.includes('@c.us') ? number : `${number}@c.us`;
                  
        client.sendMessage(number, image, {caption:message}).then(response => {
            // Pesan terkirim
            addLog(`Image sent to ${number}`);
        }).catch(err => {
            // Ada error saat mengirim, handle di sini
            console.error('Error sending image: ', err);
        });
        
    }, delay * index); // delay diperbanyak dengan index array
  });
};

client.on('qr', (qr) => {
  generateQRCode(qr).then(url => {
    qrCodeDataURL = url;
    eventEmitter.emit('qrReady');
  }).catch(err => {
    console.error('Error generating QR code:', err);
  });
});

// Endpoint untuk mendapatkan QR code.
app.get('/qr_code', (req, res) => {
  logs=[];
  clearSession();
  addLog('Last session is cleared ...');
  if (qrCodeDataURL) {
    res.json({ qrCode: qrCodeDataURL });
    addLog('New QR Code is ready. Please scan ...');
  } else {
    // Tunggu event 'qrReady' sebelum mengirim respon.
    addLog('Generating new QR Code...');
    eventEmitter.once('qrReady', () => {
      res.json({ qrCode: qrCodeDataURL });
      addLog('New QR Code is ready. Please scan ...');
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});



