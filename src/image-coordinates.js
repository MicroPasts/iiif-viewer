import OpenSeadragon from 'openseadragon';

export function mirrorViewerPoint(osd, point) {
  if (!osd.viewport.getFlip?.()) return point;
  return new OpenSeadragon.Point(osd.viewport.getContainerSize().x - point.x, point.y);
}

export function imageToViewerPoint(osd, image, point) {
  return mirrorViewerPoint(osd, image.imageToViewerElementCoordinates(point));
}

export function viewerToImagePoint(osd, image, point) {
  return image.viewportToImageCoordinates(osd.viewport.pointFromPixel(mirrorViewerPoint(osd, point), true), true);
}
