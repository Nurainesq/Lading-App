# Getting Lading onto TestFlight

**Status: the pipeline is written but has never run.** It could not be built or
tested in the environment this was developed in — TestFlight builds require
macOS and Xcode, and this repository was developed on Linux with no Apple
Developer account. Treat the first run as a debugging session, not a formality.

Everything below is what *you* have to supply. None of it can be obtained on
your behalf: an Apple Developer Program membership is a paid legal agreement
tied to your identity or your company's.

## What Lading is, and why a wrapper is needed

The app is a React web app. TestFlight only distributes native iOS builds, so
there is a [Capacitor](https://capacitorjs.com) shell (`apps/web/capacitor.config.ts`)
that wraps the identical web build inside a native container. The seventeen
screens do not change — the same bundle serves the browser and the app, so they
cannot drift apart.

The generated `ios/` project is **not committed**. It is derived from
`capacitor.config.ts` and regenerated on each run, which keeps it from rotting.

## One-time setup

### 1. Apple Developer Program — $99/year

Enrol at <https://developer.apple.com/programs/>. A company enrolment needs a
D-U-N-S number and takes longer than a personal one. Note your **Team ID**
(Membership details).

### 2. Register the app

In App Store Connect, create an app record with the bundle identifier
**`app.lading.mobile`**. It must match `appId` in `capacitor.config.ts` exactly;
change one and you change the other.

### 3. Distribution certificate

Create an **Apple Distribution** certificate, export it from Keychain Access as
a `.p12` with a password, then:

```bash
base64 -i dist.p12 | pbcopy
```

### 4. Provisioning profile

Create an **App Store** provisioning profile for `app.lading.mobile`, download
it, and note its exact name.

```bash
base64 -i Lading_App_Store.mobileprovision | pbcopy
```

### 5. App Store Connect API key

Users and Access → Integrations → App Store Connect API → generate a key with
**App Manager** access. The `.p8` downloads **once** — Apple will not show it
again.

```bash
base64 -i AuthKey_XXXXXXXX.p8 | pbcopy
```

An API key is used rather than an Apple ID so the upload does not stall waiting
on two-factor auth.

## Repository secrets

Settings → Secrets and variables → Actions:

| Secret | What it is |
| --- | --- |
| `APPLE_TEAM_ID` | Team ID, e.g. `A1B2C3D4E5` |
| `IOS_DIST_CERT_P12_BASE64` | base64 of the `.p12` |
| `IOS_DIST_CERT_PASSWORD` | password you set on export |
| `IOS_PROVISIONING_PROFILE_BASE64` | base64 of the `.mobileprovision` |
| `IOS_PROVISIONING_PROFILE_NAME` | its exact name |
| `APP_STORE_CONNECT_KEY_ID` | the key's ID |
| `APP_STORE_CONNECT_ISSUER_ID` | issuer UUID on the same page |
| `APP_STORE_CONNECT_KEY_P8_BASE64` | base64 of the `.p8` |

None of these belong in the repository, in a commit, or pasted into a chat.
Rotate any that are ever exposed — a distribution certificate signs software as
you.

## Running it

Actions → **iOS TestFlight** → Run workflow, with:

- **api_base_url** — the absolute HTTPS origin of the deployed API, e.g.
  `https://api.lading.app`. A native app has no origin to be relative to, so
  the web build's default `/api` will not work. **The API must be deployed and
  publicly reachable over HTTPS before a TestFlight build is useful** — the app
  will otherwise install and then fail at sign-in.
- **build_number** — must be strictly higher than the last upload. Apple
  rejects a duplicate.

Processing on Apple's side takes 5–30 minutes before the build appears in
TestFlight.

## Things that will probably bite on the first run

- **Bundle ID mismatch** between the profile, the App Store Connect record and
  `capacitor.config.ts`. All three must agree.
- **Build number already used.** Bump and re-run.
- **Export compliance.** First upload asks about encryption. Lading uses HTTPS
  only, which is normally the exempt answer, but confirm against your own legal
  position — add `ITSAppUsesNonExemptEncryption` to `Info.plist` once decided.
- **Missing privacy strings.** The document picker will need
  `NSPhotoLibraryUsageDescription`, and a camera capture flow would need
  `NSCameraUsageDescription`. Apple rejects builds that touch these without a
  purpose string.
- **CocoaPods drift.** `pod install --repo-update` is in the workflow, but a
  stale Xcode on the runner image can still fail; pin `macos-14` to something
  newer if so.

## What is genuinely not done

- No app icon or launch screen. Capacitor's placeholder ships unless you add
  assets — App Store review rejects placeholder icons.
- No push notifications. The seller invite arrives by link, not by push.
- No deep linking. `lading.app/invite/<token>` opens in Safari, not the app;
  Universal Links need an `apple-app-site-association` file served from the API
  domain and an associated-domains entitlement.
- Nothing here has been run. See the status note at the top.
