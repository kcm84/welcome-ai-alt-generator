import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";

const app = express();
const upload = multer({ dest: "uploads/" });

// 프론트엔드 도메인 (Render 프론트 배포 주소)
const FRONT_ORIGIN = "https://welcome-ai-alt-generator-frontend.onrender.com";

app.use(
  cors({
    origin: FRONT_ORIGIN,
    methods: ["POST"],
  })
);
app.use(express.json());

// Hugging Face Access Token (Render 환경변수에서 OPENAI_API_KEY로 등록 필요)
const HF_TOKEN = process.env.OPENAI_API_KEY;

// Alt tag 생성 프롬프트
const basePrompt = `
당신은 Alt tag 생성 AI입니다.
- 이미지 안의 모든 텍스트를 빠짐없이 추출하여 Alt tag에 포함하세요.
- 여러 문구는 줄바꿈으로 모두 포함하세요.
- 이미지에 텍스트만 있다면 전체 텍스트를 Alt tag로 출력하세요.
- 텍스트와 장면이 함께 있다면, 텍스트 + 장면 설명을 모두 포함하세요.
- 최종 결과는 Alt tag 용도로 자연스럽게 작성하세요.
- 한국어로 작성하고 100자 내외로 표현하세요.
`;

// Alt tag 생성 함수 (Florence-2-large 호출)
async function generateAltTag(imagePath) {
  try {
    // 이미지 크기 줄이기 (512px 폭, JPEG 변환)
    const resizedBuffer = await sharp(imagePath)
      .resize({ width: 512, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Base64 Data URI 변환
    const base64Image = `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;

    // Hugging Face Inference API 직접 호출 (image-to-text 태스크)
    const response = await fetch(
      "https://api-inference.huggingface.co/models/microsoft/Florence-2-large",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: base64Image,
          parameters: { prompt: basePrompt },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Florence-2 API 오류:", errorText);
      return "Alt tag 생성 실패";
    }

    const result = await response.json();
    console.log("Florence 결과:", result);

    // Florence-2 결과 형식 맞추기
    if (Array.isArray(result) && result[0]?.generated_text) {
      return result[0].generated_text;
    } else if (result.generated_text) {
      return result.generated_text;
    } else {
      return "Alt tag 생성 실패";
    }
  } catch (error) {
    console.error("⚠️ Florence-2 API 호출 에러:", error.message);
    return "Alt tag 생성 중 오류 발생";
  }
}

// 헬스체크 라우트
app.get("/", (req, res) => {
  res.send("✅ Welcome AI Alt Generator backend is running (Florence-2-large 적용)");
});

// Alt tag 생성 API
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

// 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));