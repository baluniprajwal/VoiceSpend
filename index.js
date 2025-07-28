import express from "express";
import cors from "cors";
import axios from "axios";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
const app = express();
app.use(cors());
app.use(express.raw({ type: "audio/wav", limit: "10mb" })); 

const ai = new GoogleGenAI({apiKey : process.env.GEMINI_API_KEY});

app.post("/transcribeAndParse", async (req, res) => {
  try {
    const audioBuffer = req.body;
    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: "No audio data received" });
    }

    
    const deepgramRes = await axios.post(
      "https://api.deepgram.com/v1/listen?punctuate=true",
      audioBuffer,
      {
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
          "Content-Type": "audio/wav",
        },
      }
    );

    const transcript =
      deepgramRes.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    console.log("Transcript:", transcript);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a helpful expense parser. Extract amount and category from the text. Respond ONLY in JSON like {"amount": 120, "category": "food"}.\n\nText: ${transcript}`,
            },
          ],
        },
      ],
    });

    const geminiText = await response.response.text();
    console.log("Gemini response:", geminiText);
    let parsed = {};
    try {
      parsed = JSON.parse(geminiText);
    } catch (error) {
      console.error("Failed to parse Gemini response JSON:", error);
      return res.status(500).json({ error: "Failed to parse Gemini response" });
    }

    res.status(200).json({
      transcript,
      parsed,
    });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
