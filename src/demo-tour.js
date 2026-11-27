import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './demo-tour.css';

export function setupDemoTour(button) {
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
        element: '#iiif-viewer [data-el="url-form"]',
        popover: {
          title: 'Load your own manifest',
          description: 'Enter a IIIF manifest URL and select Load, or drop a manifest link onto the viewer.',
        },
      },
      {
        element: '#iiif-viewer [data-action="toggle-fullscreen"]',
        popover: {
          title: 'Explore the viewer',
          description: 'Use the toolbar for fullscreen, image zoom, rotation and filters. Drag to pan; 3D scenes have their own controls.',
        },
      },
      {
        element: '#iiif-viewer [data-action="toggle-sidebar"]',
        popover: {
          title: 'Information and navigation',
          description: 'Open Info for metadata, the index, notes, search, and maps. Multiple canvases also have a filmstrip and previous/next controls.',
        },
      },
      {
        element: '#configuration-examples > div',
        popover: {
          title: 'Try configuration examples',
          description: 'Open an example to explore viewer options, including image downloads and physical measurement.',
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
