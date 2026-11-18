# Los Santos Race Book v4 (yalnızca at yarışı)

## Kurulum
    npm install
    ADMIN_PASSWORD=guclu-sifre npm start

- Oyuncu sayfası: http://localhost:3000
- Admin paneli:   http://localhost:3000/admin.html

## Akış
1. Admin > **Biletler**: oyuncu adı ve bahis tutarıyla kod üret (atı sen seçebilir ya da oyuncuya bırakabilirsin).
2. Oyuncu **Yarışı izle ve bahis yap** ekranında kodu ve karakter adını girer, atını seçer.
3. Yarış otomatik koşulur (varsayılan 3 dakikada bir, ~40 sn). Sonuç sunucuda belirlenir ve loglanır.
4. Oyuncu **Ödeme ekranı**ndan kodunu sorgular, kazandıysa ödeme fişini yetkiliye gösterir.
5. Admin > **Ödemeler**: kazananlar listelenir, parayı IC verince "Ödendi işaretle".
6. Admin > **Yarışlar**: her yarışta kim hangi ata oynadı, kim kazandı/kaybetti, sıradaki yarış için risk tablosu.

## Kalıcı veri
Biletler, loglar ve yarış geçmişi `DATA_DIR` klasöründe tutulur (varsayılan ./data).
Render'da Persistent Disk bağlayıp `DATA_DIR=/var/data` ver, yoksa her yeniden başlatmada veriler silinir.
