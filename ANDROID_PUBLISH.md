# Android Publish

## Build and sync web assets

```sh
npm run cap:sync
```

## Open Android Studio

```sh
npm run cap:open
```

## Release signing

1. Copy `android/keystore.properties.example` to `android/keystore.properties`
2. Create or place your upload keystore file in a safe local path
3. Update `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`

The Gradle release build will automatically use this keystore when the file exists.

## Build release artifacts

```sh
cd android
.\gradlew.bat bundleRelease
.\gradlew.bat assembleRelease
```

## Output locations

- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

## Notes

- `android/local.properties` is machine-specific and should not be committed
- If Android SDK paths changed on your machine, update `android/local.properties`
- Play Console upload should use the `.aab` file
