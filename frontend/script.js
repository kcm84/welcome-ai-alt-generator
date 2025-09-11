const imageInput = document.getElementById("imageInput");
const generateBtn = document.getElementById("generateBtn");
const previewImage = document.getElementById("previewImage");
const altText = document.getElementById("altText");

generateBtn.addEventListener("click", async () => {
  if (!imageInput.files[0]) return alert("이미지를 선택하세요");

  const formData = new FormData();
  formData.append("image", imageInput.files[0]);

  previewImage.src = URL.createObjectURL(imageInput.files[0]);
  altText.textContent = "생성 중...";

  const res = await fetch("https://YOUR_RENDER_URL.onrender.com/api/generate-alt", {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  altText.textContent = data.altTag || "Alt tag 생성 실패";
  previewImage.alt = data.altTag || "";
});