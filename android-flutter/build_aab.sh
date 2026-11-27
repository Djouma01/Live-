#!/usr/bin/env bash
set -euo pipefail

# Script de generation du Android App Bundle (.aab) pour Google Play Store - DJOUMA FOOT LIVE TV
# Prerequis : Flutter SDK + Android SDK + cle de signature (android/key.properties) configures localement

BACKEND_URL="${1:-https://ais-pre-6aduuaju7s3abta3ye5pqp-602470159748.europe-west3.run.app}"
USE_PROD_ADS="${2:-true}"

echo "1. Installation des dependances Flutter..."
flutter pub get

echo "2. Verification statique..."
flutter analyze

echo "3. Generation du Android App Bundle (.aab) pour Google Play Store..."
if [ "$USE_PROD_ADS" = "true" ]; then
  echo "Mode PRODUCTION AdMob officiel actif :"
  echo "  App ID       : ca-app-pub-9760174782619072~5851809978"
  echo "  App Open     : ca-app-pub-9760174782619072/2877784973"
  echo "  Banniere     : ca-app-pub-9760174782619072/6286924249"
  echo "  Interstitiel : ca-app-pub-9760174782619072/8992978639"
  flutter build appbundle --release \
    --dart-define=BACKEND_URL="$BACKEND_URL" \
    --dart-define=USE_PROD_ADS=true
else
  echo "Mode TEST Google AdMob actif"
  flutter build appbundle --release \
    --dart-define=BACKEND_URL="$BACKEND_URL" \
    --dart-define=USE_PROD_ADS=false
fi

echo "AAB pret pour Google Play Console : build/app/outputs/bundle/release/app-release.aab"
