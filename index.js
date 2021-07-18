const F = require("fnct");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const puppeteer = require("puppeteer");

var headless = true;
// headless = false; // Uncomment to see browser

(async () => {
  var vidId;
  try {
    vidId = fs.readFileSync(path.join(__dirname, "id.txt")).toString();
    if (!vidId) {
      throw "id_undefined";
    }
  } catch {
    vidId = process.argv[2];
  }
  if (!vidId) {
    console.error("No video ID");
    process.exit();
  }
  console.log("Fetching captions for ID:", vidId);

  browser = await puppeteer.launch({headless, defaultViewport: null, args: ['--start-maximized']});
  [page] = await browser.pages();
  await page.goto("https://www.youtube.com/watch?v={0}".format(vidId));

  await page.tracing.start({categories: ['devtools.timeline'], path: "./tracing.json"});

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

    fs.writeFileSync(path.join(__dirname, "output.txt"), output.join(""));
    console.log("-".repeat(20));
    console.log(output.join(""));
  }

  await browser.close();
})();