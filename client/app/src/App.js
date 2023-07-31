import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
	const [url, setUrl] = useState("");
	const [status, setStatus] = useState("");
	const [videoFile, setVideoFile] = useState("");

	const handleInputChange = (e) => {
		setUrl(e.target.value);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setStatus("Processing VSL...");
		setUrl("");
		try {
			await axios.post("http://localhost:3001/download", { url });
		} catch (error) {
			console.error(error);
		}
	};

	useEffect(() => {
		const interval = setInterval(async () => {
			try {
				const response = await axios.get("http://localhost:3001/status");
				setStatus(response.data.status);
				if (response.data.status === "✅ VSL Disponível") {
					console.log(response); // Log the response when the video is available
					clearInterval(interval);
				}
				if (response.data.videoFile) {
					setVideoFile(response.data.videoFile);
				}
			} catch (error) {
				console.error(error);
			}
		}, 5000);

		return () => clearInterval(interval);
	}, []);

	return (
		<div>
			<form onSubmit={handleSubmit}>
				<input type='text' value={url} onChange={handleInputChange} placeholder='Enter URL' />
				<button type='submit'>Download</button>
			</form>
			<p>{status}</p>
			{status === "✅ VSL Disponível" && (
				<>
					<video controls src={`http://localhost:3001/video/${videoFile}`} style={{ display: "block" }}></video>
				</>
			)}
		</div>
	);
}

export default App;
