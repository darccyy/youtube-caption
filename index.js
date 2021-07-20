const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const puppeteer = require("puppeteer");
const say = require("say");

var headless = true;
// headless = false; // Uncomment to see browser

(async () => {
  var vidId;
  if (process.argv[2]) {
    vidId = process.argv[2];
  } else {
    try {
      vidId = fs.readFileSync(path.join(__dirname, "id.txt")).toString();
      if (!vidId) {
        throw "id_undefined";
      }
    } catch {
      console.error("No video ID");
      process.exit();
    }
  }
  console.log("Fetching captions for ID:", vidId);

  browser = await puppeteer.launch({headless, defaultViewport: null, args: ["--start-maximized"]});
  [page] = await browser.pages();
  await page.goto(`https://www.youtube.com/watch?v=${vidId}`);

  await page.tracing.start({categories: ["devtools.timeline"], path: "./tracing.json"});

  try {
    element = await page.click("#movie_player > div.ytp-chrome-bottom > div.ytp-chrome-controls > div.ytp-right-controls > button.ytp-subtitles-button.ytp-button");
  } catch {
    console.error("No captions available for this video :(");
    process.exit();
  }
  tracing = JSON.parse(await page.tracing.stop());

  url = null;
  for (i = 0; i < tracing.traceEvents.length; i++) {
    t = tracing.traceEvents[i];
    if (
      t
      && t.args
      && t.args.data
      && t.args.data.url
      && t.args.data.url.includes("timedtext")
    ) {
      url = t.args.data.url;
      break;
    }
  }

  if (url) {
    json = await new Promise(resolve => {
      fetch(url, {method: "Get"})
        .then(res => res.json())
        .then((json) => {
          resolve(json);
        });
    });

    output = [];
    for (i = 0; i < json.events.length; i++) {
      if (
        json.events[i]
        && json.events[i].segs
      ) {
        output[i] = [];
        for (j = 0; j < json.events[i].segs.length; j++) {
          if (
            json.events[i].segs[j]
            && json.events[i].segs[j].utf8
          ) {
            output[i].push(json.events[i].segs[j].utf8);
          }
        }
        output[i] = output[i].join("");
        if (output[i] != "\n") {
          output[i] += "\n";
        }
      }
    }
    output = output.join("");
    while (output.includes("\n\n")) {
      output = output.split("\n\n").join("\n");
    }

    fs.writeFileSync(path.join(__dirname, "output.txt"), output);
    console.log("-".repeat(20));
    console.log(output);
    console.log("Captions written to output.txt");

    say.export(output.split("\n").join(", "), null, 1, "output.mp3", (err) => {
      if (err) {
        return console.error(err);
      }

      console.log("Text to Speech written to output.mp3");
    })
  }

  await browser.close();
})();