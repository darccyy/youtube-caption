console.log("\nStarting YT-CC by darcy\n");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const puppeteer = require("puppeteer");
const say = require("say");
const rl = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

var headless = true;
// headless = false; // Uncomment to see browser

async function main() {
  /* Get / Format video ID */
  var vidId;
  if (process.argv[2] && process.argv[2].length > 2) {
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

  /* Open browser */
  browser = await puppeteer.launch({headless, defaultViewport: null, args: ["--start-maximized"]});
  [page] = await browser.pages();
  await page.goto(`https://www.youtube.com/watch?v=${vidId}`);

  /* Skip all ads */
  await sleep(1);
  for (i = 0; i < 1e4; i++) {
    if (await page.$(".ytp-ad-button-icon") !== null) { // Check if video is ad
      await page.evaluate(el => { // Skip ad to end
        document.querySelector("video").currentTime = document.querySelector("video").duration;
      })
      console.log("Skipped Ad");
      await sleep(1);
    }
  }
  w
  /* Pause video to stop unnecessary network usage */
  await page.evaluate(el => {
    document.querySelector("video").currentTime = document.querySelector("video").duration;
  })

  /* Start collecting network data */
  await page.tracing.start({categories: ["devtools.timeline"], path: "./tracing.json"});

  /* Click captions button / Check if exists */
  var hasCaptions = true;
  try {
    element = await page.click("#movie_player > div.ytp-chrome-bottom > div.ytp-chrome-controls > div.ytp-right-controls > button.ytp-subtitles-button.ytp-button");
  } catch {
    console.error("No captions available for this video :(");
    hasCaptions = false;
  }

  if (hasCaptions) {
    /* Stop network collection */
    tracing = JSON.parse(await page.tracing.stop());

    /* Get caption url from tracing data */
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

    /* Get captions from url */
    if (url) {
      json = await new Promise(resolve => {
        fetch(url, {method: "Get"})
          .then(res => res.json())
          .then((json) => {
            resolve(json);
          });
      });

      /* Format captions */
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
      while (output.endsWith("\n")) {
        output = output.split("\n").slice(0, -1).join("\n");
      }

      /* Write to text file */
      fs.writeFileSync(path.join(__dirname, "output.txt"), output);
      console.log("-".repeat(20));
      console.log(output);
      console.log("-".repeat(20));
      console.log("Captions written to output.txt");

      /* Write to audio file */
      await new Promise(resolve => {
        say.export(output.split("\n").join(" "), null, parseInt(process.argv[3]) || 1, "output.mp3", (err) => {
          if (err) {
            console.error(err)
            resolve(false);
          }
          resolve();
        });
      });
      console.log("Text to Speech written to output.mp3");
    }
  }

  /* Ask to run again */
  let again = await new Promise(resolve => {
    rl.question("\n > Try Again? Maybe it was an ad? (Y/N) ", function (res) {
      resolve(res);
      rl.close();
    });
  });
  console.log();
  if (again.toLowerCase().startsWith("y")) {
    main();
  } else {
    console.log("Exiting...");
  }

  await browser.close();
}
main();

function sleep(time) {
  return new Promise(resolve => {
    setTimeout(resolve, time * 1000);
  });
}