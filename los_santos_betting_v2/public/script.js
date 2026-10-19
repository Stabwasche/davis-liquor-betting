
const socket = io();

// UI Elementleri
const clerkText = document.getElementById('clerkText');
const ticketInput = document.getElementById('ticketCode');
const inputArea = document.getElementById('inputArea');
const deskArea = document.getElementById('deskArea');
const crtArea = document.getElementById('crtArea');
const playerBetInfo = document.getElementById('player-bet-info');

// Canvas
const canvas = document.getElementById('scratchCanvas');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let isScratched = true;

// At Yarışı State
let selectedHorseIndex = -1;
let currentRaceActive = false;
let hasBetOnCurrentRace = false;

const HORSE_NAMES = [
    "Bleeder", 
    "Hennigan's Steed", 
    "Pisswasser Express", 
    "Yellow Jack", 
    "Leonida Lightning"
];

// --- DİYALOG VE KOD SİSTEMİ ---
function typeWriter(text, i, cb) {
    if (i === 0) clerkText.innerHTML = "";
    if (i < text.length) {
        clerkText.innerHTML += text.charAt(i);
        setTimeout(() => typeWriter(text, i + 1, cb), 30);
    } else {
        if(cb) cb();
    }
}

function submitCode() {
    const code = ticketInput.value.trim().toUpperCase();
    if(code === "") return;
    
    inputArea.style.display = 'none';
    
    // Basit Rol Yapma Mantığı:
    // K- ile başlıyorsa Kazı Kazan
    // A- ile başlıyorsa At Yarışı
    if(code.startsWith('K-')) {
        typeWriter("Sistemden bakıyorum... Tamam, bu bir Kazı Kazan bileti. Masanın üzerine koydum, 1 cent ile kazı.", 0, () => {
            inputArea.style.display = 'flex';
            ticketInput.value = '';
            showScratchCard(code);
        });
    } 
    else if(code.startsWith('A-')) {
        // At numarasını koddaki son rakamdan alalım (Örn A-1234-3 => 3. ata basmış)
        let horseNum = parseInt(code.slice(-1));
        if(isNaN(horseNum) || horseNum < 1 || horseNum > 5) {
            // Rastgele ata ata eğer format yanlışsa
            horseNum = Math.floor(Math.random() * 5) + 1;
        }
        
        selectedHorseIndex = horseNum - 1;
        hasBetOnCurrentRace = true;

        typeWriter(`Sistem onayladı. ${horseNum} numaralı ata (${HORSE_NAMES[selectedHorseIndex]}) oynamışsın. Monitörden izle, iyi şanslar.`, 0, () => {
            inputArea.style.display = 'flex';
            ticketInput.value = '';
            showInsideTrack();
        });
    } 
    else {
        typeWriter("Bu kod geçersiz. Sisteme kayıtlı değil. Tekrar kontrol et. (K- veya A- ile başlamalı)", 0, () => {
            inputArea.style.display = 'flex';
        });
    }
}

// --- KAZI KAZAN MANTIĞI ---
function showScratchCard(code) {
    crtArea.classList.add('hidden');
    deskArea.classList.remove('hidden');
    
    // Yeni bilet hazırla
    canvas.style.opacity = "1";
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#b2bec3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#2d3436';
    ctx.font = 'bold 20px VT323';
    ctx.textAlign = 'center';
    ctx.fillText('DAVIS LOTTERY', canvas.width/2, 40);
    ctx.fillText('Kazımak için 1 Cent Sürün', canvas.width/2, 100);
    ctx.font = '14px VT323';
    ctx.fillText(`Bilet No: ${code}`, canvas.width/2, 160);
    
    isScratched = false;
    
    // Sonuç belirle
    const rng = Math.random();
    let resultText = "BOŞ ÇIKTI";
    let color = "#e74c3c";
    
    if (rng > 0.95) { resultText = "$500 KAZANDIN!"; color = "#2ecc71"; }
    else if (rng > 0.8) { resultText = "$50 KAZANDIN!"; color = "#2ecc71"; }
    else if (rng > 0.6) { resultText = "AMORTİ!"; color = "#f1c40f"; }
    
    const winLabel = document.getElementById('winAmount');
    winLabel.innerText = resultText;
    winLabel.style.color = color;
}

canvas.addEventListener('mousedown', (e) => { if(!isScratched) isDrawing = true; scratch(e); });
canvas.addEventListener('mousemove', (e) => { if (isDrawing) scratch(e); });
canvas.addEventListener('mouseup', () => { isDrawing = false; checkCompletion(); });
canvas.addEventListener('mouseleave', () => { isDrawing = false; });

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

function scratch(e) {
    if(!isDrawing) return;
    const pos = getMousePos(e);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 25, 0, Math.PI * 2); 
    ctx.fill();
}

function checkCompletion() {
    setTimeout(() => {
        if(!isScratched) {
            canvas.style.opacity = "0";
            isScratched = true;
            
            // Sonucu tezgahtara da söylet
            const result = document.getElementById('winAmount').innerText;
            if(result.includes("KAZANDIN") || result.includes("AMORTİ")) {
                typeWriter(`Tebrikler, biletinden ${result} Çıkan parayı kasanın yanından alabilirsin.`, 0);
            } else {
                typeWriter("Maalesef boş çıktı. Şansını tekrar denemek istersen buradayım.", 0);
            }
        }
    }, 1500);
}


// --- AT YARIŞI MANTIĞI ---
function showInsideTrack() {
    deskArea.classList.add('hidden');
    crtArea.classList.remove('hidden');
    playerBetInfo.innerText = `OYNANAN AT: ${HORSE_NAMES[selectedHorseIndex]} (#${selectedHorseIndex+1})`;
}

socket.on('raceUpdate', (positions) => {
    const lanes = document.querySelectorAll('.horse-lane .sprite');
    lanes.forEach((sprite, index) => {
        // CRT ekranındaki genişliğe göre CSS calc
        sprite.style.left = `calc(100px + ${positions[index]}% - 130px * (${positions[index]}/100))`; 
    });
});

socket.on('raceStatus', (status) => {
    document.getElementById('race-status').innerText = status;
    
    if(status.includes("BAŞLADI")) {
        currentRaceActive = true;
    }
    
    if(status.includes("BİTTİ")) {
        currentRaceActive = false;
        
        // Eğer oyuncu bu yarışa bahis yaptıysa sonucu bildir
        if(hasBetOnCurrentRace) {
            setTimeout(() => {
                // Status string'inden kazanan atın ismini bul
                if(status.includes(HORSE_NAMES[selectedHorseIndex].toUpperCase())) {
                    typeWriter(`İNANILMAZ! Atın ${HORSE_NAMES[selectedHorseIndex]} kazandı! Paran kasaya eklendi.`, 0);
                } else {
                    typeWriter(`Atın kaybetti... Sağlık olsun, Los Santos'ta her zaman yeni bir yarış vardır.`, 0);
                }
                hasBetOnCurrentRace = false;
            }, 2000); // 2 saniye sonra tezgahtar konuşsun
        }
    }
});
