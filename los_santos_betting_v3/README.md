# Davis Liquor & Lotto v3

## Kurulum
    npm install
    ADMIN_PASSWORD=guclu-sifre npm start      (Windows PowerShell: $env:ADMIN_PASSWORD="guclu-sifre"; npm start)

- Oyuncu sayfası: http://localhost:3000
- Admin paneli:   http://localhost:3000/admin.html  (şifre ADMIN_PASSWORD, verilmezse "changeme")

## Nasıl çalışır
1. Admin panelinde **Biletler > Bilet oluştur** ile kod üret (oyuncu adı, bedel, at).
2. Kodu oyuncuya IC olarak ver (Kopyala butonu chat metni hazırlar).
3. Oyuncu gişede kodu ve karakter adını verir. Sonuç sunucuda belirlenir ve loglanır.
4. Kazananlar Panel sekmesinde "Ödeme bekleyen" listesine düşer. Parayı IC verince "Ödendi işaretle".

## Dosyalar
- data/db.json      biletler, yarışlar, ayarlar
- data/events.log   tüm olayların kalıcı kaydı (satır başına bir JSON)
- public/dialogues.js  tezgahtar cümleleri (istediğin kadar ekle)
