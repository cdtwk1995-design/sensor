import joblib
import numpy as np
import sys
import os
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

# ----------------------------------------------------------------------
# Load environment variables from .env
# ----------------------------------------------------------------------
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set in .env")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ----------------------------------------------------------------------
# Load the trained model
# ----------------------------------------------------------------------
MODEL_PATH = "anomaly_detect_2.pkl"
try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    print(f"Error loading model from {MODEL_PATH}: {e}")
    sys.exit(1)

if isinstance(model, dict):
    iso_forest = model.get("model")
    scaler = model.get("scaler")
else:
    iso_forest = model
    scaler = None

def predict_risk(temp_c: float, humidity_perc: float, co_ppm: float) -> int:
    """Return risk level: 0=Normal, 1=Warning, 2=Risk."""
    X = np.array([[temp_c, humidity_perc, co_ppm]])
    if scaler is not None:
        X = scaler.transform(X)
    iso_pred = iso_forest.predict(X)[0]
    if iso_pred == -1:
        return 2
    if temp_c >= 40:
        return 1
    return 0

def log_to_supabase(temp_c: float, humidity_perc: float, co_ppm: float, risk: int) -> None:
    """Insert a sensor reading into sensor_logs table."""
    data = {
        "temperature_c":    temp_c,
        "humidity_percent": humidity_perc,
        "co_ppm":           co_ppm,
        "risk_level":       risk,
        "created_at":       datetime.now(timezone.utc).isoformat(),  # ← 수정
    }
    try:
        response = supabase.table("sensor_logs").insert(data).execute()
        print(f"🗄️  Table: sensor_logs")
        print(f"✅ Supabase 저장 성공: {response.data}")
    except Exception as e:          # ← response.error 대신 try/except
        print(f"❌ Supabase 저장 실패: {e}")

def main() -> None:
    print("Hybrid Anomaly Detection Test")
    print('센서 값을 입력하세요. 종료하려면 "exit" 입력.')

    while True:
        try:
            temp_input = input("Temperature_C: ").strip()
            if temp_input.lower() == "exit":
                break
            temp_c = float(temp_input)

            hum_input = input("Humidity_Percent: ").strip()
            if hum_input.lower() == "exit":
                break
            humidity_perc = float(hum_input)

            co_input = input("CO_ppm: ").strip()
            if co_input.lower() == "exit":
                break
            co_ppm = float(co_input)
        except ValueError:
            print("숫자를 입력해주세요.")
            continue

        risk = predict_risk(temp_c, humidity_perc, co_ppm)
        level = {0: "정상 Normal (0)", 1: "경고 Warning (1)", 2: "위험 Risk (2)"}[risk]
        print(f"📊 예측 결과: {level}")

        log_to_supabase(temp_c, humidity_perc, co_ppm, risk)

    print("테스트 종료.")

if __name__ == "__main__":
    main()
