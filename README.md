# Ramanujan Academy Connect

Make a website of my brand "Ramanujan Academy" a couching class and make that they can call to number "7774848245" and WhatsApp to that number. make It very nice with animations.add a from also. add a admin pannel were I can see the forms given and the visits and logo is provided

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ramanujanacademy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d92803a2-6f0b-438b-a2b2-1a9d29d5029a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


<!-- production rebuild marker: 2026-09-25 -->


## Native mobile app (Capacitor)

This repository is being prepared to package the existing React/Vite application as **Ramanujan Academy** for Android and iOS. It reuses the current Supabase backend and role-based portals.

### Requirements
- Node.js 22+
- Android Studio and Android SDK for local Android development
- macOS with Xcode for local iOS builds

### Local Android setup
```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio, select a device/emulator and press Run. To build a debug APK locally, run:
```bash
cd android
./gradlew assembleDebug
```
The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

### Local iOS setup (macOS only)
```bash
npm install
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```
Use Xcode to select a simulator or a connected iPhone. App Store distribution requires Apple signing and store setup.

### Build an Android test APK on GitHub
Open **Actions → Build Android App → Run workflow**. When the workflow completes, download the `ramanujan-academy-android-debug` artifact. This is a testing APK, not a Play Store release.

### Important
- Capacitor 8 requires Node.js 22 or newer.
- The app requires internet access for Supabase-backed login, data and AI features.
- The native shell bundles the web app at build time; after web changes, rebuild and run `npx cap sync` before producing a new app.
- Before store release, test all role logins, deep links, file uploads, camera/location permissions, payment flows, and WhatsApp links on real devices. Configure production signing, app icons/splash screens, privacy disclosures and store metadata.
