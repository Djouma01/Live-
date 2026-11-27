# DJOUMA FOOT LIVE — Guide Sportradar, Firebase & Génération APK/AAB Android

**Créée par Djouma Coulibaly**

## 1. Sécurisation de Sportradar Soccer API v4 & Firebase (`djouma-foot-live`)
- La clé **`SPORTRADAR_API_KEY`** n'est **jamais** intégrée dans le code frontend ni dans l'application Android Flutter.
- Elle est stockée exclusivement côté serveur Express et dans **Firebase Secret Manager** :

```bash
# 1. Enregistrer votre clé Sportradar dans Firebase Secret Manager
firebase functions:secrets:set SPORTRADAR_API_KEY --project djouma-foot-live

# 2. Déployer les Cloud Functions (synchronisation, cache Firestore, notifications FCM)
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions,firestore:rules --project djouma-foot-live
```

## 2. Architecture & SDK Google AdMob intégré
- **Application Android native Flutter** (`android-flutter/`) équipée du SDK officiel **`google_mobile_ads: ^5.2.0`** et du consentement **UMP (RGPD)**.
- **Identifiants officiels DJOUMA FOOT LIVE TV** :
  - **App ID** (`AndroidManifest.xml`) : `ca-app-pub-9760174782619072~5851809978`
  - **App Open Ad (Ouverture / reprise)** : `ca-app-pub-9760174782619072/2877784973`
  - **Bannière (Accueil uniquement)** : `ca-app-pub-9760174782619072/6286924249`
  - **Interstitiel (Transitions espacées)** : `ca-app-pub-9760174782619072/8992978639`
- **Protection pendant les essais** :
  - En mode Debug (`flutter run`) ou avec `USE_PROD_ADS=false`, l'application utilise automatiquement les **identifiants de TEST officiels Google**.
  - En build Release avec `--dart-define=USE_PROD_ADS=true`, elle utilise vos identifiants officiels ci-dessus.

## 3. Générer le nouvel APK et le fichier AAB (Google Play Store)
Sur un poste disposant de **Flutter SDK (3.19+)**, **Java 17** et **Android SDK / Gradle** :
```bash
cd android-flutter
flutter pub get
chmod +x build_apk.sh build_aab.sh

# 1. APK d'essai (annonces TEST Google)
./build_apk.sh https://ais-pre-6aduuaju7s3abta3ye5pqp-602470159748.europe-west3.run.app false

# 2. Nouvel APK Release officiel DJOUMA FOOT LIVE (AdMob prod + 12 rubriques + temps réel 1s)
./build_apk.sh https://ais-pre-6aduuaju7s3abta3ye5pqp-602470159748.europe-west3.run.app true

# 3. Android App Bundle (.aab) pour Google Play Store
# Pensez à placer votre fichier de signature android/key.properties avant de publier sur Play Console.
./build_aab.sh https://ais-pre-6aduuaju7s3abta3ye5pqp-602470159748.europe-west3.run.app true
```
Sorties générées :
- **Nouvel APK** : `android-flutter/build/app/outputs/flutter-apk/app-release.apk`
- **AAB (Play Store)** : `android-flutter/build/app/outputs/bundle/release/app-release.aab`
