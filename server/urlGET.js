const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

app.use("/video", express.static(path.join(__dirname, "..", "static")));

app.post("/download", async (req, res) => {
	const { url } = req.body;
	await logNetworkRequests(url);
	res.send({ message: "Download started" });
});

let videoStatus = "Not started";
let videoName = "";

app.get("/status", (req, res) => {
	res.send({ status: videoStatus, videoFile: videoName });
});

async function logNetworkRequests(url) {
	videoStatus = "Processing";

	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	let processedUrls = new Set();

	// Create the urlHolder directory if it doesn't exist
	const dir = "./urlHolder";
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir);
	}

	page.on("request", (request) => {
		if (
			!processedUrls.has(request.url()) &&
			request.url().includes("https://cdn.converteai.net/") &&
			request.url().endsWith("/main.m3u8")
		) {
			console.log("Main URL:", request.url());

			// Construct the audio and video URLs
			const baseUrl = request.url().replace("/main.m3u8", "/");
			const audioUrl = baseUrl + "audio_media.m3u8";
			const videoUrl = baseUrl + "h264_432p_1000.m3u8";

			console.log("Audio URL:", audioUrl);
			console.log("Video URL:", videoUrl);

			// Write the URLs to a file in the urlHolder directory
			fs.writeFileSync(path.join(dir, "urls.txt"), `${audioUrl}\n${videoUrl}`);

			// Add the URL to the set of processed URLs
			processedUrls.add(request.url());
		}
	});

	await page.goto(url);

	// Wait for 5 seconds
	await new Promise((resolve) => setTimeout(resolve, 5000));

	await browser.close();

	// Run downloadVSL.js
	const downloadVSL = spawn("node", ["downloadVSL.js"]);
	console.log("Download started");

	downloadVSL.stdout.on("data", (data) => {
		console.log(`downloadVSL.js output: ${data}`);
		const dataStr = data.toString();
		if (dataStr.includes(".mp4")) {
			videoName = dataStr.match(/(\w+\.mp4)/)[0];
		}
	});

	downloadVSL.stderr.on("data", (data) => {
		console.error(`downloadVSL.js error: ${data}`);
	});
	downloadVSL.on("close", (code) => {
		console.log(`downloadVSL.js process exited with code ${code}`);
		videoStatus = "✅ VSL Disponível";
	});
}

const PORT = 3001;
app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});
