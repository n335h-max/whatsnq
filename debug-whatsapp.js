const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

function getExecutablePath() {
  const paths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "C:\\Users\\User\\AppData\\Local", "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ];

  return paths.find((filePath) => fs.existsSync(filePath));
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: getExecutablePath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled"
    ]
  });

  const page = (await browser.pages())[0];
  page.on("console", (msg) => console.log("PAGELOG", msg.type(), msg.text()));
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      console.log("NAV", frame.url());
    }
  });
  page.on("requestfailed", (req) => {
    console.log("REQFAIL", req.url(), req.failure() ? req.failure().errorText : "unknown");
  });

  await page.goto("https://web.whatsapp.com/", {
    waitUntil: "load",
    timeout: 0,
    referer: "https://whatsapp.com/"
  });

  await new Promise((resolve) => setTimeout(resolve, 15000));

  console.log("URL", page.url());
  console.log("TITLE", await page.title());

  const hasDebug = await page.evaluate(() => (
    typeof window.Debug !== "undefined" && typeof window.Debug.VERSION !== "undefined"
  )).catch((error) => `evalerr:${error.message}`);
  console.log("HAS_DEBUG", hasDebug);

  const bodyText = await page.evaluate(() => (
    document.body ? document.body.innerText.slice(0, 500) : "no-body"
  )).catch((error) => `evalerr:${error.message}`);
  console.log("BODY", bodyText);

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
