const cover = require("@mapbox/tile-cover");
const dotenv = require("dotenv");
const { uniqWith, isEqual } = require("lodash");
const fs = require("fs");
const { execSync } = require("child_process");
dotenv.config({ path: __dirname + "/.env" });
const { default: readline } = require("readline-promise");

/**
 * Merges images from a specified input directory into a single output file.
 *
 * @param {string} inputDirectory - Directory containing input images. Defaults to "temp".
 * @param {number} across - Number of images to join across horizontally. Defaults to 9.
 * @param {string} output - Name of the output file. Defaults to "vips".
 * @param {string} extension - File extension of the images to merge. Defaults to ".png".
 *
 * If the output file already exists, the function logs a cache hit message and returns.
 * Uses the 'vips arrayjoin' command to merge images based on their filenames' coordinates.
 */
function mergeImages(inputDirectory, across, output, extension = ".png") {
  if (fs.existsSync(output))
    return console.log("cache hit for output " + output);
  const files = fs.readdirSync(inputDirectory);

  const transform = (f) => f.split(".")[0].split("x").reverse().join("x");
  const filesArg = files
    .filter((f) => f.endsWith(extension))
    .sort((a, b) => (transform(a) > transform(b) ? 1 : -1))
    .map((file) => inputDirectory + "/" + file)
    .join(" ");
  const command = `vips arrayjoin "${filesArg}" --across ${across} ${output}${extension}`;
  execSync(command, () => {});
}

/**
 * Downloads a tile from the mapbox terrain-rgb tileset at the specified coordinates if it doesn't already exist.
 *
 * @param {string} dir - Directory to store the downloaded tile. Defaults to "tiles".
 * @param {boolean} verbose - If true, logs a message if a tile is already cached. Defaults to false.
 * @param {number} x - x-coordinate of the tile.
 * @param {number} y - y-coordinate of the tile.
 * @param {number} zoom - Zoom level of the tile.
 */
const downloadTile =
  (dir = "tiles", verbose = false) =>
  ([x, y, zoom]) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const file = `${dir}/${x}x${y}.png`;
    console.log(x, y);
    fs.existsSync(file)
      ? verbose && console.log("cache hit for " + file)
      : execSync(
          `curl https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${x}/${y}.pngraw?access_token=${process.env.MBX_TOKEN} --output ${file}`
        );
  };

/**
 * Finds the tiles and bounding box of a set of features at a given zoom level.
 * @param {Object} features - GeoJSON feature set.
 * @param {number} zoom - Zoom level to calculate tiles and bounding box at.
 * @returns {Object} An object with two properties: tiles and bounds.
 *   tiles is an array of [x, y, zoom] coordinates of the tiles that cover the features.
 *   bounds is an object with three properties: box, width, and height.
 *     box is an array of [x0, y0, x1, y1] coordinates of the bounding box of the tiles.
 *     width and height are the dimensions of the bounding box.
 */
function tilesForFeatures(features, zoom) {
  const limits = { min_zoom: zoom, max_zoom: zoom };
  const tiles = uniqWith(
    features.features.map((f) => cover.tiles(f.geometry, limits)).flat(),
    isEqual
  ).sort(([a1, a2], [b1, b2]) => a1 + a2 * 0.0001 - (b1 + b2 * 0.0001));
  const min = Math.min;
  const max = Math.max;
  const bounds = tiles.reduce(
    ([x0, y0, x1, y1], [x, y]) => {
      return [min(x0, x), min(y0, y), max(x1, x), max(y1, y)];
    },
    [Infinity, Infinity, -Infinity, -Infinity]
  );

  return {
    tiles,
    bounds: {
      box: bounds,
      width: 1 + bounds[2] - bounds[0],
      height: 1 + bounds[3] - bounds[1],
    },
  };
}

// const args = {features, tileFolder, output}
const tileFolder = "temp";
/**
 * Downloads the tiles associated with a set of features at a given zoom level,
 * stitches them together, and saves them to a file.
 *
 * @param {string} input - Path to a GeoJSON feature set file.
 * @param {string} output - Prefix for the output file name.
 * @param {number} zoom - Zoom level to generate tiles at.
 * @returns {Promise<void>}
 */
module.exports.run = async ([input, output, zoom, ...rest]) => {
  if (!process.env.MBX_TOKEN || input === "token") {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const token = await rl.question("please paste your token");
    fs.writeFileSync(join(__dirname, ".env"), token);

    rl.close();
  }

  const features = JSON.parse(fs.readFileSync(input).toString());
  console.log(features);
  const { tiles, bounds } = tilesForFeatures(features, zoom);
  console.log({
    tiles,
    bounds,
    length: tiles.length,
  });
  fs.writeFileSync(output + "Bounds.json", JSON.stringify(bounds));
  tiles.forEach(downloadTile(tileFolder));
  mergeImages(tileFolder, bounds.width, output);
  fs.rmdirSync(tileFolder, { recursive: true });
};
