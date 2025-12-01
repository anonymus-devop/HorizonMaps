# Changelog

All notable changes to HorizonMaps will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-01

### Added

#### Core Features
- **Interactive Map**: Dark-themed Mapbox map with 3D tilt and bearing support
- **Location Search**: Real-time geocoding with autocomplete suggestions for Colombian locations
- **Route Planning**: Advanced route calculation using Mapbox Directions API
- **Turn-by-Turn Navigation**: 
  - Voice-guided navigation with Spanish TTS
  - Step-by-step directions with distance indicators
  - Auto-progression to next step based on proximity
  - Off-route detection with automatic re-routing

#### Navigation Features
- **Live Location Tracking**: High-accuracy GPS tracking with smooth map following
- **Live View AR Mode**: Camera overlay with heads-up display for AR navigation
- **Smart Centering**: Auto-center on user location during navigation
- **Route Visualization**: Animated route lines with glow effects

#### User Interface
- **Liquid Glass Design**: Modern glassmorphism UI with backdrop blur effects
- **Responsive Layout**: Optimized for desktop and mobile devices
- **Dark Theme**: Sleek dark interface matching Mapbox dark style
- **Smooth Animations**: iOS-like spring animations throughout the app
- **Custom Controls**: Glass-styled buttons and panels with hover effects

#### Technical Features
- **Desktop App**: Electron-based Windows application with custom title bar
- **PWA Support**: Progressive Web App with offline capabilities
- **Permission Management**: Robust handling of geolocation and camera permissions
- **Service Worker**: Background caching for offline map tiles and assets

#### Platform Support
- Windows desktop application (NSIS installer)
- Windows MSI installer with custom installation wizard
- Web application (PWA) for cross-platform compatibility
- Android support via Capacitor integration

### Technical Details

#### Dependencies
- React 18.3.1 for UI framework
- Mapbox GL 3.16.0 for mapping
- Framer Motion 12.23.24 for animations
- Electron 39.2.4 for desktop app
- Vite 7.2.4 for build tooling

#### Configuration
- Custom Electron main process with permission handling
- Vite PWA plugin for service worker generation
- Tailwind CSS for utility-first styling
- PostCSS for CSS processing

### Known Limitations
- Requires Mapbox API token for full functionality
- GPS accuracy depends on device hardware
- AR Live View requires camera permission
- Network required for route calculation and geocoding

---

## [Unreleased]

### Planned Features
- Multiple route options (fastest, shortest, scenic)
- Traffic-aware routing
- Favorite locations
- Route history
- Offline map downloads
- Multi-language support
- iOS native app

[1.0.0]: https://github.com/anonymus-devop/HorizonMaps/releases/tag/v1.0.0
