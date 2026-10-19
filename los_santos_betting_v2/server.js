
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let raceInProgress = false;
let horsePositions = [0, 0, 0, 0, 0];

const HORSE_NAMES = [
    "Bleeder", "Hennigan's Steed", "Pisswasser Express", "Yellow Jack", "Leonida Lightning"
];

function startRace() {
    if(raceInProgress) return;
    
    raceInProgress = true;
    horsePositions = [0, 0, 0, 0, 0]; 
    io.emit('raceStatus', '🚨 YARIŞ BAŞLADI!');

    const raceInterval = setInterval(() => {
        let raceFinished = false;
        
        for(let i=0; i<5; i++) {
            horsePositions[i] += (Math.random() * 3) + 0.5; 
            
            if(horsePositions[i] >= 100) {
                horsePositions[i] = 100;
                raceFinished = true;
            }
        }
        
        io.emit('raceUpdate', horsePositions);

        if(raceFinished) {
            clearInterval(raceInterval);
            raceInProgress = false;
            
            let winnerIndex = -1;
            for(let i=0; i<5; i++) {
                if(horsePositions[i] >= 100) {
                    winnerIndex = i; break;
                }
            }
            
            io.emit('raceStatus', `🏆 YARIŞ BİTTİ! KAZANAN: ${HORSE_NAMES[winnerIndex].toUpperCase()}`);
        }
    }, 400); 
}

// TEST İÇİN 20 SANİYEDE BİR
setInterval(() => {
    if(!raceInProgress) startRace();
}, 20000);

io.on('connection', (socket) => {
    socket.emit('raceUpdate', horsePositions); 
    if(!raceInProgress) {
        socket.emit('raceStatus', 'Bir sonraki yarış bekleniyor...');
    } else {
        socket.emit('raceStatus', 'Yarış devam ediyor...');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde başlatıldı.`);
});
