// Tezgahtar diyalogları (Türkçe, Chicago sokak ağzı havasında).
// Her anahtar için birden fazla cümle var, rastgele biri seçilir. Yeni cümle eklemek için listeye satır ekle.
// Değişkenler: {name} {horse} {n} {amount} {price} {mult} {owner} {secs} {race} {items} {id} {total}
const CLERK = {
  greeting: [
    "Ee, ne var ne yok? Gişe açık, fişini uzat bakalım.",
    "Ayo, sırada mısın yoksa sadece bakıyor musun? Kodu ver.",
    "Davis Liquor'a hoş geldin. Bira soğuk, oranlar değil. Ne getirdin?",
    "Çabuk ol bro, Bears maçı başlayacak. Kod.",
    "Ope, bir tane daha. Tamam tamam, ver şunu."
  ],
  askName: [
    "Bu kimin adına yazılacak? İsim.",
    "Fişe isim lazım, man. Tahminle iş yapmam.",
    "Kayda geçiyorum. Sen kimsin bakalım?"
  ],
  needName: [
    "Dur bi' dakka. Karakter adın boş. Önce adını söyle.",
    "İsim lazım bro, kör uçuş yapmam."
  ],
  invalid: [
    "Yok man, sistemde böyle bir kod yok. Bir daha bak, doğru oku.",
    "Bu sahte, dude. Ekranımda hiçbir şey çıkmıyor.",
    "Doğru mu okuyorsun? Bilgisayar böyle bir şey duymamış.",
    "Kod yok. Vaktimi alma, ben yemek yemeye çalışıyorum.",
    "Yok yok, bu bizim kağıt değil."
  ],
  invalidAnnoyed: [
    "Come on now. Üçüncü kez? Fişi düzgün oku, bro.",
    "Ben bunu bütün gece yaparım, sen yapabilir misin? Doğrusunu getir.",
    "Böyle devam edersen camı kapatırım, I swear on my mama."
  ],
  locked: [
    "Bu kadar. Gişe {secs} saniye kapalı. Git biraz soğu.",
    "Nah, spam yapıyorsun. Panjur {secs} saniye inik. Düşün biraz ne yaptığını."
  ],
  lockedStill: [
    "Gişe kapalı. {secs} saniye sonra gel.",
    "Dedim {secs} saniye. Cama vurma."
  ],
  void: [
    "O bilet iptal edilmiş. Ölü kağıt. Patronla konuş.",
    "Yönetim onu listeden sildi. Çöpe at gitsin."
  ],
  ownerMismatch: [
    "Dur bakalım, bu biletin üstünde {owner} yazıyor. Sen {owner} değilsin. Kimi kandırıyorsun?",
    "Nah nah nah. Fişte {owner} yazıyor, sen başka birine benziyorsun. Reddedildi.",
    "Bu {owner}'in kağıdı, seninki değil. Beni zorlama."
  ],
  scratchStart: [
    "Tamam, kazı kazan. Masaya koydum. Madeni parayı kullan, tırnakla kazıma.",
    "Kazı kazan, tanesi {price}. Bozuk para tezgahta. Yap işini.",
    "Şanslı numara mı arıyorsun? Kazı hadi, bütün gece burada değilim."
  ],
  scratchResume: [
    "Bunu zaten açmıştın. Hâlâ masada, bitir şunu.",
    "Ope, kazımamış mıydın? Devam et bakalım."
  ],
  scratchWin: [
    "Ayo!! {amount}! Bak sen! Patron o parayı sana sayar.",
    "Damn, {amount}?! Tamam tamam, bu gece yemek sende. Para geliyor.",
    "Tahtada {amount} var. İlk tur sana ait, my guy."
  ],
  scratchBigWin: [
    "NE?! {amount}?! Dur, fişe bir daha bakayım... evet, gerçek. Holy hell.",
    "Büyük ikramiye! {amount}! Bu camın arkasında bunca yıldır böyle bir şey görmedim!"
  ],
  scratchRefund: [
    "Amorti. {amount} geri cebine. Ne kazandın ne kaybettin. Chicago havası gibi.",
    "Başabaş bro. {amount} geri döndü. Daha kötüsü olabilirdi."
  ],
  scratchLose: [
    "Hiçbir şey. Sıfır. Oyun bu, chief.",
    "Ahh, şanssızlık. Boş. Bir tane daha al, kasa her zaman fazla.",
    "Kaybettin. Üzgünüm ama üzgün değilim. Sıradaki!",
    "Hayatın buna bağlıymış gibi kazıdın ve yine hiçbir şey. Acımasız."
  ],
  pickHorse: [
    "Fişte at yazmıyor. Panodan birini seç, senin yerine ben seçmem.",
    "Hangi at? Monitörden birine dokun, {price} ortaya konuyor.",
    "Bir at seç. Paranı sevmiyorsan Yellow Jack'i seç."
  ],
  horseRegistered: [
    "Tamam, {n}. {horse}, {price} bahis, {mult}x ödüyor. #{race} numaralı yarıştasın. Monitörü izle.",
    "Kilitledim: {horse}. {price} yatırdın, yarış #{race}. Ekrana nefes verme.",
    "{horse} mu? Cesur. Yarış #{race}. Bir tabure çek ve dua et."
  ],
  horseNextRace: [
    "Bu yarışın bahisleri kapandı, seni #{race} numaralı yarışa yazdım. Sıranı bekle.",
    "Kapılar açılmak üzere. #{race} numaralı yarışa yazıldın bro. Sabret."
  ],
  horseResume: [
    "Zaten #{race} numaralı yarışta {horse} üstündesin. Otur ve izle.",
    "Seni {horse} üstüne yazdım. Yarış #{race}. Sorup durma."
  ],
  raceCountdown: [
    "Bir dakika sonra yarış var millet. Son fiş çağrısı.",
    "Kapılar açılıyor. Ya bahsini yap ya da çekil."
  ],
  raceStart: [
    "Ve başladılar! Hadi hadi hadi...",
    "Yarış koşuluyor! Gözler ekranda!",
    "İşte başlıyoruz, başlıyoruz..."
  ],
  horseWin: [
    "BRO! {horse} getirdi! {amount} senin! Hepsini aynı yerde harcama.",
    "Ayyy! {horse} birinci! {amount}, my guy. İçten içe gurur duydum.",
    "İşte bunu diyorum! {amount}! Para için patrona uğra."
  ],
  horseLose: [
    "{horse} çuvalladı. Yazık oldu. Bu {price} kasaya.",
    "Damn, {horse} sürünüyordu. Bir dahaki sefere, chief.",
    "Günün değildi. {price} gitti. Cesaretin varsa bir daha oyna.",
    "O at sanki kası yırtılmış gibi koştu. Üzgünüm, bro."
  ],
  alreadyPaid: [
    "Bunun parasını zaten aldın. Açgözlü olma.",
    "Ödendi bile. Cebine bak, benim camıma değil."
  ],
  alreadyWon: [
    "O bilet tuttu zaten — {amount}. Para patronda, henüz ödenmedi. Sabret.",
    "Kazanan bilet. {amount}. Yönetime git, unutmadan."
  ],
  alreadyLost: [
    "O bilet bitti, kaybetti. Yeni bir tane al.",
    "Bunu zaten oynadın bro. İçinde bir şey kalmadı."
  ],
  idle: [
    "...Orada dikilecek misin, ne yapacaksın?",
    "Sayaç işliyor, my guy. Kod.",
    "Tik tak. Cubs kendi kendine kazanmaz.",
    "Bütün gecem var. Yok aslında yok. Acele et."
  ],
  menuOpen: [
    "Pencere açık. Ne işin var?",
    "Yaklaş. Bira mı, sigara mı, yoksa zengin olma şansı mı?"
  ],

  // ---- Övgü / şikayet defteri ----
  feedbackOpen: [
    "Deftere yazmak istediğin bir şey mi var? Övgü olsun şikayet olsun, kısa tut.",
    "Müşteri defteri burada. Beğendiysen yaz, beğenmediysen daha da çok yaz."
  ],
  feedbackPraise: [
    "Aww, thanks man. Patrona ileteceğim, belki zam yapar. Belki.",
    "Güzel sözler. Deftere yazdım. Böyle devam, bro.",
    "Damn, bu bana mı yazıldı? Tamam, kaydettim. Bir bira ısmarlarım."
  ],
  feedbackComplaint: [
    "Şikayet mi? Tamam, deftere yazdım. Patron okuyunca bir şey yapar. Belki.",
    "Kayıt altında, bro. Ama burası Davis, beş yıldızlı otel değil.",
    "Not aldım. Soğutucu bozuksa ben de biliyorum, bana yazma."
  ],
  feedbackShort: [
    "Bu kadar kısa mı? En az bir cümle yaz, man.",
    "Boş kağıda mühür basmam. Biraz daha yaz."
  ],
  feedbackFast: [
    "Yavaş, bro. Önceki yazdığını daha okumadım.",
    "Bir seferde bir şikayet. Sıraya gir."
  ],

  // ---- Sipariş ekranı ----
  orderGreet: [
    "Raflar dolu, soğutucu çalışıyor. Ne istiyorsan sepete at, ben hazırlarım.",
    "Hadi bakalım, ne alıyoruz? Stokta olanlar listede, tükenenlere bakma bile.",
    "Sipariş mi? Tamam. Seç, adını yaz, gerisi bende."
  ],
  orderAdded: [
    "Tamam, onu da yazdım.",
    "Güzel seçim. Devam.",
    "Bir tane daha, ha? Olur."
  ],
  orderEmpty: [
    "Sepet boş bro. Hava mı sipariş ediyorsun?",
    "Hiçbir şey seçmemişsin. Önce bir şey seç."
  ],
  orderSoldOut: [
    "{items} bitti man, stokta yok. Onu sepetten çıkar.",
    "Kusura bakma, {items} tükenmiş. Tedarikçi gelmedi, ne yapayım."
  ],
  orderFast: [
    "Yavaş ol, bir önceki siparişi daha yazmadım.",
    "Sakin. Aynı anda iki sipariş yetiştiremem."
  ],
  orderPlaced: [
    "Tamam, sipariş #{id}, toplam {total}. Hazır olunca haber veririm.",
    "Kaydettim. #{id} numaralı sipariş, {total}. Kenara çekil, hallederim.",
    "Sipariş #{id} alındı. Toplam {total}. Param hazırsa tezgaha bırak."
  ],
  orderReady: [
    "Siparişin hazır bro! Gel al, soğumadan.",
    "Hazır! Gel de al, tezgahta bekliyor.",
    "Ayo, siparişin tamam. Gelip al, yer kaplıyor."
  ],
  orderDone: [
    "Teslim edildi. İyi günler, my guy.",
    "Tamamdır, iş bitti. Yine bekleriz."
  ],
  orderCancelled: [
    "Siparişin iptal edildi. Patrona sor, ben karışmam.",
    "O sipariş iptal oldu bro. Üzgünüm."
  ]
};

const lastPicked = {};
function say(key, vars = {}) {
  const pool = CLERK[key] || [''];
  let i;
  do { i = Math.floor(Math.random() * pool.length); } while (pool.length > 1 && i === lastPicked[key]);
  lastPicked[key] = i;
  return pool[i].replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}
