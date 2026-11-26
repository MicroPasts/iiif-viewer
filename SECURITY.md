# Security Policy

## Supported versions

Security fixes are intended for the latest release. Please check whether an issue affects the latest version before reporting it.

## Reporting a vulnerability

Please do not report security vulnerabilities in public issues or pull requests. If private vulnerability reporting is enabled, use [GitHub's private advisory form](https://github.com/MicroPasts/iiif-viewer/security/advisories/new). Otherwise, contact the maintainer privately at info@micropasts.org.

Include a description of the issue, affected versions, steps to reproduce, and any relevant proof of concept. Avoid including private collections, credentials, or personal data in the report. Please allow time for investigation and a fix before public disclosure.

## Deployment considerations

- Manifests, metadata, annotations, image services, models, map styles, and other linked resources may come from third parties. Use sources you trust and consider appropriate content, file-size, and network restrictions for your deployment.
- Configure CORS and Content Security Policy for the services your deployment uses. The default map style and tiles are provided by OpenFreeMap; MapLibre uses a bundled worker that may require `blob:` workers and `data:` module imports. Draco-compressed models may require decoder files from the configured decoder path.
- If using a proxy, restrict allowed destinations and requests on the server to reduce risks such as server-side request forgery. Viewer URL rewriting is not a substitute for server-side validation.
- Do not embed credentials or secrets in client-side configuration, public manifests, or committed test fixtures.
