# Firebase Storage Rules — taslak (referans, DEPLOY EDİLMEDİ)

Bu proje şu an Firebase Storage kullanmıyor (Blaze planına geçilemedi —
bkz. `src/lib/storage.js` üstündeki not: fotoğraflar Firestore'da ayrı
küçük belgeler olarak tutuluyor, `appdata/pp_photo_*`).

Storage bir gün açılırsa (Blaze planına geçilirse) ve fotoğraf/avatar/imza
yükleme gerçek Storage'a taşınırsa, uygulanması gereken kurallar — boyut ve
tip sınırı SADECE istemci tarafında değil, sunucu tarafında (Rules) da
zorunlu olmalı (Faz 15 gereksinimi):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Profil fotoğrafları — sadece kendi fotoğrafını yazabilir, herkes okuyabilir
    // (iç uygulama, tüm personel birbirinin profil fotoğrafını görür).
    match /profile-photos/{uid}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.uid == uid
                   && request.resource.size < 2 * 1024 * 1024        // 2 MB üst sınır
                   && request.resource.contentType.matches('image/.*');
    }

    // Görev/mahal/vardiya fotoğrafları — giriş yapmış herkes yazabilir
    // (saha personeli), herkes okuyabilir.
    match /task-photos/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024        // 5 MB üst sınır
                   && request.resource.contentType.matches('image/.*');
    }

    // Varsayılan: her şey kapalı.
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

Notlar:
- `request.resource.size` ve `.contentType` kontrolleri istemci tarafında
  (örn. `resizeImage()`) hile ile atlatılabilir — bu yüzden asıl sınır
  burada, Rules'ta olmalı.
- Şu anki Firestore-doküman geçici çözümünde (`src/lib/storage.js`)
  boyut sınırı (`MAX_DATA_URL_LENGTH`) sadece istemci tarafında —
  Firestore Rules'a da benzer bir `request.resource.size` kontrolü
  eklenmesi önerilir (bu depoda `firestore.rules` dosyası yok, Firebase
  Console'dan ya da ayrı bir deploy reposundan yönetiliyor olmalı).
