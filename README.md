# WebView Flutter Bridge SDK

A JavaScript SDK for bidirectional communication between Flutter WebView and web applications.

## Features

- Bidirectional communication between Flutter and WebView
- Promise-based API for request/response pattern
- Event listener system for Flutter-initiated events
- Automatic initialization and bridge detection
- Timeout handling for requests
- TypeScript support with comprehensive type definitions

## Installation

1. Install the package:

```bash
npm install webview-flutter-bridge-sdk
```

2.Import and use in your web application:

```javascript
import bridge from 'webview-flutter-bridge-sdk';

bridge.postMessage('getUserInfo', { userId: 123 });
```

## Usage
### Sending messages to Flutter

```javascript
// Send a message and wait for response
try {
  const response = await bridge.postMessage('getUserInfo', { userId: 123 });
  console.log('User info:', response);
} catch (error) {
  console.error('Failed to get user info:', error);
}
```
### Listening to Flutter events

```javascript
// Register an event listener
const cancelListener = bridge.listen('userDidLogin', (userData) => {
  console.log('User logged in:', userData);
});

// Later, to remove the listener
cancelListener();
```

### Flutter-side Implementation
```dart
// Flutter WebView implementation should:
// 1. Inject a JavaScript object with postMessage method
// 2. Handle incoming messages from JavaScript
// 3. Send responses back to JavaScript
```

## API Reference
### postMessage(action: string, data?: any, timeout?: number): Promise<any>
Sends a message to Flutter and returns a Promise that resolves with the response.

### listen(action: string, callback: (data: any) => void): () => void
Registers an event listener for Flutter-initiated events. Returns a function to cancel the listener.

## Building from Source
1. Clone the repository
2. Install dependencies:
```bash
pnpm install
```
3. Build the project:
```bash
pnpm run build
```

## License
MIT

🚀 Powered by AI Assistant

This README provides a comprehensive overview of your SDK with installation instructions, usage examples, and API documentation. The "Powered by AI Assistant" note is included at the bottom as requested.