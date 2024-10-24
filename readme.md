# TopoJoy

A command line tool downloading and stitching together the [mapbox terrain-rgb](https://docs.mapbox.com/vector-tiles/reference/mapbox-terrain-v2/) tiles associated with the bounding box of a GeoJSON feature set.

## Requirements

- [vips](https://www.libvips.org/install.html)
- [node](https://nodejs.org/en/download/package-manager)

## Usage

`topoJoy <inputGeoJSONFile> <output> <zoomLevel>`

Prompts for a valid api token each time you use it. You can also specify one with the command `topoJoy token <YOUR MAPBOX TOKEN>`. This will save your token in a .env file. Get a token by following the instructions [here](https://docs.mapbox.com/help/getting-started/access-tokens/).

### Arguments

- inputGeoJSONFile: Path to a geoJSON feature file. You can use [geoJson](https://geojson.io) to produce valid input, though any well formed geoJson features file should work. See the example.
- output: The prefix name of the files that will be generated.
- zoomLevel: the [zoom level](https://docs.mapbox.com/help/glossary/zoom-level/) at which the map will be rendered.

### Output

- `<output>Bounds.json`:
  ```js
  {
    box: [x0, y0, x1, y1],
    width: 1 + x1 - x0,
    height: 1 + y1 - y0,
    zoomLevel
  },
  ```
  the box x and y are tileset numbers corresponding to the bounding box of the image at the given zoom level.
- `<output>.png`: a .png of the stitched tiles associated with the geoJSON feature file, at the given zoom level.
