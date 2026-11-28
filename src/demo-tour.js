import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './demo-tour.css';

export function setupDemoTour(button) {
  let expandedByTour = null;
  const expandExample = (element) => {
    const details = element?.closest('details');
    if (details && !details.open) {
      details.open = true;
      expandedByTour = details;
    }
  };
  const restoreExample = () => {
    if (expandedByTour) {
      expandedByTour.open = false;
      expandedByTour = null;
    }
  };
  const tour = driver({
    showProgress: true,
    showButtons: ['previous', 'next', 'close'],
    closeBtnLabel: 'Close tour',
    doneBtnText: 'Finish',
    popoverClass: 'demo-tour-popover',
    disableActiveInteraction: true,
    smoothScroll: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onDestroyed: () => button.focus(),
    steps: [
      {
        element: '[data-preset]',
        popover: {
          title: 'Choose a manifest',
          description: 'Try the example buttons to load images, books, a 3D model, a map, or the Fitzwilliam miniature.',
        },
      },
      {
        element: () => document.querySelector('#iiif-viewer').shadowRoot.querySelector('[data-el="url-form"]'),
        popover: {
          title: 'Load your own manifest',
          description: 'Enter a IIIF manifest URL and select Load, or drop a manifest link onto the viewer.',
        },
      },
      {
        element: () => document.querySelector('#iiif-viewer').shadowRoot.querySelector('[data-action="toggle-fullscreen"]'),
        popover: {
          title: 'Explore the viewer',
          description: 'Use the toolbar for fullscreen, zoom, rotation and filters, or copy a link to the current view. Drag to pan; 3D scenes have their own controls.',
        },
      },
      {
        element: () => document.querySelector('#iiif-viewer').shadowRoot.querySelector('[data-action="toggle-sidebar"]'),
        popover: {
          title: 'Information and navigation',
          description: 'Open Info for metadata, the index, notes, search, and maps. Multiple canvases also have a filmstrip and previous/next controls.',
        },
      },
      {
        element: '#configuration-examples > div',
        popover: {
          title: 'Try configuration examples',
          description: 'Open an example to load a separate viewer and try options such as measurement, JSON inspection, downloads and a resizable Info panel.',
        },
      },
      {
        element: '[data-tour="colours"]',
        onHighlightStarted: expandExample,
        onDeselected: restoreExample,
        popover: {
          title: 'Customise viewer colours',
          description: 'Try accent colours after the tour and see how themeVars and setThemeVars update a viewer independently.',
        },
      },
      {
        element: '[data-tour="comparison"]',
        onHighlightStarted: expandExample,
        onDeselected: restoreExample,
        popover: {
          title: 'Compare canvases',
          description: 'After the tour, compare pages side by side, select another manifest and synchronize 2D views.',
        },
      },
      {
        element: '#demo-theme',
        popover: {
          title: 'Change the theme',
          description: 'Switch the page and all demo viewers between light and dark mode.',
        },
      },
      {
        element: '[data-tour="shadow-demo"]',
        popover: {
          title: 'See style isolation',
          description: 'Visit the Shadow DOM demo to mount a viewer alongside host-styled headings and buttons. Viewer styles stay inside its shadow root.',
        },
      },
      {
        element: 'a[aria-label="View source on GitHub"]',
        popover: {
          title: 'Explore the code',
          description: 'Find the source, documentation, and contribution information on GitHub.',
        },
      },
    ],
  });
  button.addEventListener('click', () => tour.drive());
}
