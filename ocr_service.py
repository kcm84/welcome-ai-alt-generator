import os
from flask import Flask, request, jsonify
from paddleocr import PaddleOCR

app = Flask(__name__)

ocr = None  # 지연 초기화

@app.route("/")
def health():
    return "✅ OCR Service Running"

@app.route("/ocr", methods=["POST"])
def run_ocr():
    global ocr
    try:
        # 최초 요청 시 OCR 모델 초기화
        if ocr is None:
            ocr = PaddleOCR(
                lang="korean",
                use_textline_orientation=True
            )

        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        image_file = request.files["image"]
        temp_path = "temp.jpg"
        image_file.save(temp_path)

        results = ocr.predict(temp_path)
        os.remove(temp_path)

        texts = []
        for res in results:
            for line in res:
                texts.append(line[1][0])

        return jsonify({
            "ocr_texts": texts,
            "ocr_text_joined": " ".join(texts)
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)