const axios = require("axios");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const url = require("url");
const path = require("path");
const cliProgress = require("cli-progress");

//teste
// Read the URLs from the file
const urls = fs.readFileSync(path.join(__dirname, "urlHolder", "urls.txt"), "utf8").split("\n");

// Extract the audio and video URLs
const audioM3u8Url = urls[0];
const videoM3u8Url = urls[1];

const partsFolder = path.join(__dirname, "videoParts");

// Create the parts folder if it doesn't exist
if (!fs.existsSync(partsFolder)) {
	fs.mkdirSync(partsFolder);
}

function delay(t, v) {
	return new Promise(function (resolve) {
		setTimeout(resolve.bind(null, v), t);
	});
}

function downloadFile(tsAbsoluteUrl, tsFile, retries = 3) {
	return axios
		.get(tsAbsoluteUrl, { responseType: "arraybuffer" })
		.then((response) => {
			fs.writeFileSync(tsFile, response.data);
			return tsFile;
		})
		.catch((error) => {
			if (retries > 0) {
				return delay(5000).then(() => downloadFile(tsAbsoluteUrl, tsFile, retries - 1));
			} else {
				throw error;
			}
		});
}

function downloadAndConcatenate(m3u8Url, outputFileName) {
	return axios.get(m3u8Url).then((response) => {
		const m3u8Content = response.data;
		const tsUrls = m3u8Content.split("\n").filter((line) => line.endsWith(".ts"));

		let downloads = [];
		const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
		progressBar.start(tsUrls.length, 0);

		tsUrls.forEach((tsUrl, index) => {
			const tsAbsoluteUrl = url.resolve(m3u8Url, tsUrl);
			const tsFile = path.join(partsFolder, `${outputFileName}_${index}.ts`);

			downloads.push(
				delay(index % 100 === 0 ? 10000 : 0).then(() =>
					downloadFile(tsAbsoluteUrl, tsFile).then((tsFile) => {
						progressBar.increment();
						return tsFile;
					})
				)
			);
		});

		return Promise.allSettled(downloads).then((results) => {
			progressBar.stop();
			const tsFiles = results.filter((result) => result.status === "fulfilled").map((result) => result.value);

			return new Promise((resolve, reject) => {
				const outputFile = path.join(partsFolder, `${outputFileName}.ts`);
				ffmpeg()
					.input("concat:" + tsFiles.join("|"))
					.outputOptions("-c copy")
					.output(outputFile)
					.on("end", () => {
						console.log(`Finished processing ${outputFileName}`);
						resolve({ outputFile, tsFiles });
						console.log(outputName + ".mp4"); // log the final video filename
					})
					.on("error", reject)
					.run();
			});
		});
	});
}

// Generate a random string of 6 numbers
const randomString = Math.floor(Math.random() * 1000000)
	.toString()
	.padStart(6, "0");

const outputName = "VSL" + randomString;

downloadAndConcatenate(audioM3u8Url, "audio").then((audioResult) => {
	downloadAndConcatenate(videoM3u8Url, "video").then((videoResult) => {
		ffmpeg()
			.input(videoResult.outputFile)
			.input(audioResult.outputFile)
			.outputOptions("-c copy")
			.output(path.join(__dirname, "..", "static", outputName + ".mp4")) // Save the final video in the static folder
			.on("end", () => {
				console.log(outputName + ".mp4"); // log the final video filename
				console.log("Finished processing output");

				// Delete the urls.txt file
				fs.unlinkSync(path.join(__dirname, "urlHolder", "urls.txt"));

				// Delete the video and audio chunks
				videoResult.tsFiles.forEach((file) => fs.unlinkSync(file));
				audioResult.tsFiles.forEach((file) => fs.unlinkSync(file));

				// Delete the video.ts and audio.ts files
				fs.unlinkSync(videoResult.outputFile);
				fs.unlinkSync(audioResult.outputFile);
			})
			.run();
	});
});
