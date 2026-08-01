import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native shell for the iOS build.
 *
 * The product is a mobile app — the design is seventeen 390×844 screens — so
 * TestFlight distribution needs a native container around the same web build
 * that ships to the browser. Nothing about the screens changes.
 */
const config: CapacitorConfig = {
  appId: 'app.lading.mobile',
  appName: 'Lading',
  webDir: 'dist',

  ios: {
    // The design is set on ink; matching the shell stops a white flash behind
    // the status bar on launch and during rubber-band scrolling.
    backgroundColor: '#16181a',
    contentInset: 'always',
    // Traders are on mobile networks; a wedged request should surface as an
    // error in the UI rather than hang behind the platform default.
    limitsNavigationsToAppBoundDomains: true,
  },

  server: {
    // The app talks to the API over HTTPS at an absolute origin, supplied at
    // build time through VITE_API_BASE_URL. No cleartext, so no ATS exception.
    androidScheme: 'https',
    iosScheme: 'https',
  },
}

export default config
