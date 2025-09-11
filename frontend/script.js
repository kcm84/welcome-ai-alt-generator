const imageInput = document.getElementById("imageInput");
const generateBtn = document.getElementById("generateBtn");
const previewImage = document.getElementById("previewImage");
const altText = document.getElementById("altText");

generateBtn.addEventListener("click", async () => {
  if (!imageInput.files[0]) return alert("이미지를 선택하세요");

  const formData = new FormData();
  formData.append("image", imageInput.files[0]);

  // 미리보기 표시
  previewImage.src = URL.createObjectURL(imageInput.files[0]);
  altText.textContent = "⏳ Alt tag 생성 중...";

  try {
    // 백엔드 API 호출 (Render URL로 교체하세요)
    const res = await fetch("https://welcome-ai-alt-generator-backend.onrender.com/api/generate-alt", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    altText.textContent = data.altTag || "Alt tag 생성 실패";
    previewImage.alt = data.altTag || "";
  } catch (err) {
    console.error(err);
    altText.textContent = "⚠️ 서버 오류로 Alt tag 생성 실패";
  }
});