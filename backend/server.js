import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";
import fetch from "node-fetch";
import FormData from "form-data";
import { OpenAI } from "openai";

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());

// Hugging Face Router (Qwen 멀티모달) API 키
const HF_TOKEN = process.env.OPENAI_API_KEY;
const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: HF_TOKEN,
});

// ⚠️ Render에 배포된 PaddleOCR 서비스 URL
const OCR_SERVICE_URL = "https://welcome-ai-alt-generator-ocr.onrender.com/ocr";

// OCR API 호출 (재시도 포함)
async function runOCR(imagePath, retries = 3) {
  const formData = new FormData();
  formData.append("image", fs.createReadStream(imagePath));

  try {
    const res = await fetch(OCR_SERVICE_URL, {
      method: "POST",
      body: formData,
      headers: formData.getHeaders(), // 올바른 Content-Type 설정
    });

    if (!res.ok) {
      throw new Error(`OCR API 오류: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return {
      texts: data.ocr_texts || [],
      joined: data.ocr_text_joined || "",
    };
  } catch (err) {
    console.error("OCR 호출 실패:", err.message);
    if (retries > 0) {
      console.log(`🔄 OCR 재시도 (${3 - retries + 1})...`);
      await new Promise((r) => setTimeout(r, 2000)); // 2초 대기 후 재시도
      return runOCR(imagePath, retries - 1);
    }
    return { texts: [], joined: "" };
  }
}

// Qwen 멀티모달 호출
async function runVLModel(imagePath, ocrText) {
  const resizedBuffer = await sharp(imagePath)
    .resize({ width: 512 })
    .jpeg({ quality: 80 })
    .toBuffer();

  const base64Image = `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: ocrText
            ? `이미지에서 추출된 텍스트: "${ocrText}". 이를 참고하여 장면과 조합해 Alt tag를 100자 내외로 생성해 주세요.`
            : "이 이미지를 설명하는 Alt tag를 100자 내외로 생성해 주세요.",
        },
        { type: "image_url", image_url: { url: base64Image } },
      ],
    },
  ];

  const chatCompletion = await client.chat.completions.create({
    model: "Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic",
    messages,
  });

  return chatCompletion.choices[0].message.content || "Alt tag 생성 실패";
}

// Alt tag API 엔드포인트
app.post("/api/generate-alt", upload.single("image"), async (req, res) => {
  try {
    const { texts, joined } = await runOCR(req.file.path);
    const altTag = await runVLModel(req.file.path, joined);
    fs.unlinkSync(req.file.path); // 임시 파일 삭제
    res.json({ altTag, ocrTexts: texts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Alt tag 생성 실패" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 addleOCR+Qwen backend running on port ${PORT}`)
);