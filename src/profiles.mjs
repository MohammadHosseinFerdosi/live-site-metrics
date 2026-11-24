/** Viewport / UA profiles for live collection (no network or CPU throttle). */

const ANDROID_MOBILE = {
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 1.75,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
  label: "Mobile (Android) · unthrottled",
};

export const PROFILES = {
  desktop: {
    viewport: { width: 1350, height: 940 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    label: "Desktop · unthrottled",
  },
  mobile: ANDROID_MOBILE,
  android: ANDROID_MOBILE,
  ios: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    label: "iOS (Safari) · unthrottled",
  },
};

export const BROWSERS = ["chromium", "firefox", "webkit"];
