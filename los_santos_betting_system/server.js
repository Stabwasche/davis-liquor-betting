
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Public klasörünü web'e aç
app.use(express.static('public'));

// --- AT YARIŞI MOTORU (INSIDE TRACK) ---
let raceInProgress = false;
// 5 Atın ilerleme yüzdesi (0 ile 100 arası)
let horsePositions = [0, 0, 0, 0, 0];

const HORSE_NAMES = [
    "Bleeder", 
    "Hennigan's Steed", 
    "Pisswasser Express", 
    "Yellow Jack", 
    "Leonida Lightning"
];

function startRace() {
    if(raceInProgress) return;
    
    raceInProgress = true;
    horsePositions = [0, 0, 0, 0, 0]; // Sıfırla
    io.emit('raceStatus', '🚨 YARIŞ BAŞLADI! TAHMİNLERİNİZİ İZLEYİN!');

    const raceInterval = setInterval(() => {
        let raceFinished = false;
        
        // Atları rastgele hızlarda hareket ettir (Olasılık Motoru)
        for(let i=0; i<5; i++) {
            // Her döngüde at %0.5 ile %3 arasında rastgele mesafe kat eder.
            // Olasılıkları manipüle etmek isterseniz (örneğin 1. at favori olsun), 
            // buradaki çarpanı o ata özel artırabilirsiniz.
            horsePositions[i] += (Math.random() * 2.5) + 0.5; 
            
            if(horsePositions[i] >= 100) {
                horsePositions[i] = 100;
                raceFinished = true;
            }
        }
        
        // Tüm oyunculara anlık konumları gönder
        io.emit('raceUpdate', horsePositions);

        // Bitiş çizgisine ulaşan varsa
        if(raceFinished) {
            clearInterval(raceInterval);
            raceInProgress = false;
            
            // Kazananı bul
            let maxPos = 0;
            let winnerIndex = -1;
            for(let i=0; i<5; i++) {
                if(horsePositions[i] >= 100) {
                    winnerIndex = i;
                    break;
                }
            }
            
            io.emit('raceStatus', `🏆 YARIŞ BİTTİ! KAZANAN: ${HORSE_NAMES[winnerIndex].toUpperCase()}`);
        }
    }, 400); // Saniyede yaklaşık 2.5 kez ekranı güncelle
}

// GERÇEK SİSTEMDE: setInterval(startRace, 60 * 60 * 1000); // 1 SAATTE BİR
// TEST İÇİN: Her 15 saniyede bir yarış başlatıyoruz
setInterval(() => {
    if(!raceInProgress) {
        startRace();
    }
}, 15000);

// Biri siteye girdiğinde
io.on('connection', (socket) => {
    console.log('Oyuncu bağlandı.');
    socket.emit('raceUpdate', horsePositions); // Mevcut konumları ver
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
