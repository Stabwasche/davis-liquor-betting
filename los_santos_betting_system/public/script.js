
// -----------------------------------------
// 1. KAZI KAZAN SİSTEMİ (CANVAS)
// -----------------------------------------
const canvas = document.getElementById('scratchCanvas');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let isScratched = true; // Başlangıçta kazınamaz durumda
let ticketActive = false;

function setupCanvasLayer() {
    canvas.style.opacity = "1";
    ctx.globalCompositeOperation = 'source-over';
    
    // Gümüş kazıma katmanı
    ctx.fillStyle = '#b2bec3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Üzerine marka ve talimat yazısı
    ctx.fillStyle = '#636e72';
    ctx.font = 'bold 22px Roboto';
    ctx.textAlign = 'center';
    ctx.fillText('💰 KAZIMAK İÇİN SÜRTMEYE BAŞLA 💰', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '14px Roboto';
    ctx.fillText('Davis Liquor Özel Üretim Bilet', canvas.width / 2, canvas.height / 2 + 20);
    
    isScratched = false;
}

// Bilet Satın Alma Simülasyonu
function buyTicket(price) {
    if(ticketActive && !isScratched) {
        alert('Önce elinizdeki bileti kazıyın!');
        return;
    }
    
    ticketActive = true;
    setupCanvasLayer();
    
    // Rastgele Kazanç Algoritması (Kasa Avantajı Simülasyonu)
    const rng = Math.random();
    let resultText = "MAALESEF, BOŞ ÇIKTI!";
    let color = "#e74c3c";
    
    if (rng > 0.999) {
        resultText = `$${price * 1000} - BÜYÜK İKRAMİYE!`;
        color = "#f1c40f";
    } else if (rng > 0.95) {
        resultText = `$${price * 50} KAZANDINIZ!`;
        color = "#2ecc71";
    } else if (rng > 0.85) {
        resultText = `$${price * 10} KAZANDINIZ!`;
        color = "#2ecc71";
    } else if (rng > 0.70) {
        resultText = `$${price * 2} AMORTİ!`;
        color = "#3498db";
    }

    const winLabel = document.getElementById('winAmount');
    winLabel.innerText = resultText;
    winLabel.style.color = color;
}

// Fare / Dokunmatik Kazıma Olayları
canvas.addEventListener('mousedown', (e) => { if(!isScratched && ticketActive) isDrawing = true; scratch(e); });
canvas.addEventListener('mousemove', (e) => { if (isDrawing) scratch(e); });
canvas.addEventListener('mouseup', () => { isDrawing = false; checkCompletion(); });
canvas.addEventListener('mouseleave', () => { isDrawing = false; });

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function scratch(e) {
    if(!isDrawing) return;
    const pos = getMousePos(e);
    
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2); // 20px kalınlığında fırça
    ctx.fill();
}

function checkCompletion() {
    // Basit bir tamamlama mekaniği: Oyuncu fareyi birkaç kez kaldırdığında
    // Veya %60 kazındığında (Basitleştirilmiş simülasyon)
    // Gerçek projede getImageData ile saydam piksel oranı ölçülür.
    // Şimdilik zaman bazlı kolaylaştırılmış bir temizleme yapıyoruz:
    setTimeout(() => {
        if(!isScratched) {
            canvas.style.opacity = "0"; // Otomatik kalanını sil
            isScratched = true;
            ticketActive = false;
        }
    }, 1500); // 1.5 saniyelik kazıma işleminden sonra sonucu göster
}


// -----------------------------------------
// 2. INSIDE TRACK (AT YARIŞI) SİSTEMİ
// -----------------------------------------
const socket = io();

socket.on('raceUpdate', (positions) => {
    // positions dizisi [at1_yuzde, at2_yuzde, ...]
    const lanes = document.querySelectorAll('.horse-lane .sprite');
    lanes.forEach((sprite, index) => {
        // CSS calc ile 180px başlangıç payının üzerine yüzde ekliyoruz
        // Kalan bitiş çizgisi aralığını (yaklaşık %100 - sağ pay) hesaplayarak
        sprite.style.left = `calc(180px + ${positions[index]}% - 220px * (${positions[index]}/100))`; 
    });
});

socket.on('raceStatus', (status) => {
    document.getElementById('race-status').innerText = status;
});
