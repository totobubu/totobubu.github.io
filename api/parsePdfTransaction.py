import os
import tempfile

from flask import Flask, request, jsonify

from scripts.extract_toss_transactions import extract_transactions_from_pdf

app = Flask(__name__)


@app.after_request
def apply_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.route("/api/parsePdfTransaction", methods=["POST", "OPTIONS"])
def parse_pdf_transaction():
    if request.method == "OPTIONS":
        return ("", 204)

    if request.method != "POST":
        return jsonify({"error": "Method not allowed"}), 405

    upload = request.files.get("file")
    brokerage = request.form.get("brokerage")

    if upload is None or upload.filename == "":
        return jsonify({"error": "파일이 없습니다."}), 400

    if not brokerage:
        return jsonify({"error": "증권사 정보가 없습니다."}), 400

    suffix = os.path.splitext(upload.filename)[1] or ".pdf"
    temp_file_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            upload.save(tmp.name)
            temp_file_path = tmp.name

        if brokerage == "toss":
            result = extract_transactions_from_pdf(temp_file_path, verbose=False)
        else:
            return jsonify({"error": "지원하지 않는 증권사입니다."}), 400

        return jsonify(result)
    except Exception as exc:
        app.logger.exception("PDF 파싱 오류")
        return (
            jsonify(
                {
                    "error": "PDF 파싱에 실패했습니다.",
                    "details": str(exc),
                }
            ),
            500,
        )
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                app.logger.warning("임시 파일 삭제 실패: %s", temp_file_path)


