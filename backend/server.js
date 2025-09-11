const express = require("express");
const axios = require("axios");
const cors = require("cors");
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());

// Hugging Face API Key (Render 환경 변수에서 가져오기)
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;

// Hugging Face Qwen2.5-VL-Instruct 호출 함수
async function generateAltTag(imagePath) {
  const data = new FormData();
  data.append("inputs", fs.createReadStream(imagePath));

  const response = await axios.post(
    "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-VL-Instruct",
    data,
    {
      headers: {
        Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
        ...data.getHeaders(),
      },
    }
  );

  // 모델 응답에서 Alt tag 텍스트 추출
  return response.data?.[0]?.generated_text || "Alt tag 생성 실패";
}

// API 엔드포인트
app.post("/api/generate-alt", upload.single("image"), async (req, res) => {
  try {
    const altTag = await generateAltTag(req.file.path);
    fs.unlinkSync(req.file.path); // 임시 파일 삭제
    res.json({ altTag });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Alt tag 생성 실패" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));