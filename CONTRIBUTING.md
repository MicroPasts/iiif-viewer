# Contributing

Thank you for helping improve the IIIF Viewer. Bug reports, documentation, tests, and code contributions are welcome.

## Getting started

Use Node.js 22 and npm. Fork and clone the repository, then create a branch from `main`:

```bash
git clone https://github.com/<your-username>/iiif-viewer.git
cd iiif-viewer
npm ci
npm run dev
```

The development server serves the demo. See the [README](./README.md) for usage, configuration, and the supported IIIF features.

## Making changes

- For significant changes, open an issue first to discuss the approach. For bugs, include reproduction steps, browser details, and a public or sanitized manifest where possible.
- Keep changes focused and follow the existing vanilla JavaScript, CSS, and component patterns.
- Preserve keyboard access, accessible labels, light and dark themes, and responsive layouts when changing the interface.
- Consider IIIF Presentation versions, language maps, resource URLs, CORS, and proxy routing when changing manifest handling.
- Clean up event listeners, network requests, map instances, and WebGL resources when changing component lifecycles.
- Add focused tests for behavior you change, including relevant failure or edge cases. Keep test fixtures local and free of private data.
- Update the README and any related documentation when behavior or the public API changes.

## Testing and building

Run the relevant checks before submitting a pull request:

```bash
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run build:docs
```

Vitest covers components and services; Playwright exercises browser journeys using local fixtures. See the [README](./README.md) for details.

## Pull requests

Describe the change and its motivation, link any related issue, and list the checks you ran. Include screenshots or recordings for visible UI changes when helpful. Keep unrelated changes out of the pull request.

By submitting a contribution, you agree that it may be distributed under this project's [MPL-2.0 license](./LICENSE.md).

For vulnerabilities, please follow the private reporting process in [SECURITY.md](./SECURITY.md) instead of opening a public issue.
