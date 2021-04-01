const cover = require("@mapbox/tile-cover");
const dotenv = require("dotenv");
const { uniqWith, isEqual } = require("lodash");
const fs = require("fs");
const { execSync } = require("child_process");
dotenv.config({ path: __dirname + "/.env" });
const { default: readline } = require("readline-promise");

function mergeImages(
  inputDirectory = "temp",
  across = 9,
  output = "vips",
  extension = ".png"
) {
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

const downloadTile = (dir = "tiles", verbose = false) => ([x, y, zoom]) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const file = `${dir}/${x}x${y}.png`;
  console.log(x, y);
  fs.existsSync(file)
    ? verbose && console.log("cache hit for " + file)
    : execSync(
        `curl https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${x}/${y}.pngraw?access_token=${process.env.MBX_TOKEN} --output ${file}`
      );
};

function tilesForFeatures(features, zoom = 13) {
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
module.exports.run = async ([input, output, zoom, keep, ...rest]) => {
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
