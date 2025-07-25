import express from "express";
import cors from "cors";
import axios from "axios";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.raw({ type: "audio/wav", limit: "10mb" })); 



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

    
    const openaiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful expense parser." },
          {
            role: "user",
            content: `Extract amount and category from: "${transcript}". Respond ONLY in JSON like {"amount": 120, "category": "food"}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responseText = openaiRes.data.choices?.[0]?.message?.content;

    let parsed = {};
    try {
      parsed = JSON.parse(responseText);
    } catch (jsonErr) {
      console.error("Failed to parse OpenAI response JSON:", jsonErr);
      return res.status(500).json({ error: "Failed to parse OpenAI response" });
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
