import express from "express";
import cors from "cors";
import axios from "axios";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import job from "./cron.js";
const app = express();
app.use(cors());
job.start();
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
              text: `You are a helpful expense parser. 
            From the given sentence, extract the **amount spent** and assign it to one of these **5 categories** ONLY:

            1. "Essentials" → groceries, rent, electricity, internet, bills, water, household needs  
            2. "Dining & Leisure" → food, restaurants, cafes, movies, bars, entertainment  
            3. "Transport & Travel" → fuel, uber, ola, metro, bus, train, flights, cabs  
            4. "Personal & Shopping" → clothing, electronics, personal care, gifts, shopping  
            5. "Other" → if it doesn't fit above

            Respond ONLY in valid JSON format like:
            {"amount": 120, "category": "Essentials"}

            Here is the transcribed text:
            "${transcript}"`,
            },
          ],
        },
      ],
    });

    let geminiText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    geminiText = geminiText.replace(/```json|```/g, "").trim();
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
