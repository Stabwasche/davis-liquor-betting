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

## Sipariş sistemi (v3.1)
- Oyuncu ana menüsünde **Sipariş ver**: ürünler stok durumuyla listelenir, tükenenler seçilemez.
- Admin > **Ürünler**: ürün ekle/sil, ad ve fiyat değiştir, görsel yükle, stok durumunu (Stokta var / Tükendi) tek tuşla değiştir.
- Admin > **Siparişler**: yeni sipariş gelince rozet ve bip sesi çıkar. Hazır / Teslim edildi / İptal ile durumu değiştir, oyuncunun ekranında tezgahtar haber verir.

## Kalıcı veri (Render vb.)
Biletler, loglar, ürünler ve yüklenen görseller `DATA_DIR` klasöründe tutulur (varsayılan: ./data).
Render'da Persistent Disk ekleyip (örn. /var/data) `DATA_DIR=/var/data` ortam değişkenini ver; yoksa her yeniden başlatmada veriler silinir.

## v3.2
- Ana menü: dükkan giriş kamerası, slogan, övgü/şikayet defteri, CRT efekti açma/kapama.
- Admin > **Defter**: oyuncuların bıraktığı övgü ve şikayetler (yalnızca personel görür).
- Slogan `public/index.html` içinde `class="slogan"` satırında, değiştirmek için o satırı düzenle.
