const imageInput = document.getElementById("imageInput");
const generateBtn = document.getElementById("generateBtn");
const previewImage = document.getElementById("previewImage");
const altText = document.getElementById("altText");
const altTagBox = document.getElementById("altTagBox");
const altTagCode = document.getElementById("altTagCode");
const copyBtn = document.getElementById("copyBtn");

// 이미지 첨부 시 즉시 미리보기 표시
imageInput.addEventListener("change", () => {
  if (imageInput.files[0]) {
    previewImage.src = URL.createObjectURL(imageInput.files[0]);
    previewImage.alt = "";
    altText.textContent = "";
    altTagBox.style.display = "none";
  }
});

// Alt tag 생성 버튼 클릭
generateBtn.addEventListener("click", async () => {
  if (!imageInput.files[0]) return alert("이미지를 선택하세요");

  const formData = new FormData();
  formData.append("image", imageInput.files[0]);

  altText.textContent = "⏳ Alt tag 생성 중...";
  altTagBox.style.display = "none";

  try {
    const res = await fetch("https://welcome-ai-alt-generator-backend.onrender.com/api/generate-alt", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    const result = data.altTag || "Alt tag 생성 실패";

    // 결과 표시
    altText.textContent = result;
    previewImage.alt = result;

    // Alt tag 예시 표시
    altTagCode.textContent = `<img src="이미지주소" alt="${result}">`;
    altTagBox.style.display = "block";
  } catch (err) {
    console.error(err);
    altText.textContent = "⚠️ 서버 오류로 Alt tag 생성 실패";
  }
});

// 복사 버튼
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(altTagCode.textContent)
    .then(() => alert("Alt tag가 클립보드에 복사되었습니다 ✅"))
    .catch(err => console.error("복사 실패:", err));
});