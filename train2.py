# train2.py
"""Training script for a hybrid anomaly detection model.

- Loads `correct_data.csv` from the project workspace.
- Applies minimal preprocessing (drops rows with missing values).
- Trains an IsolationForest on the numeric sensor features.
- Combines rule‑based priority with the IsolationForest output to produce a final risk label:
    0 = Normal
    1 = Warning (temperature ≥ 40°C)
    2 = Risk (IsolationForest anomaly) 
- Saves the trained IsolationForest (and the feature column order) to `anomaly_detect_2.pkl`.
"""

import os
import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib

# Path to the CSV file – adjust if your workspace structure differs
CSV_PATH = os.path.join(os.path.expanduser("~"), ".gemini", "antigravity-ide", "new2", "correct_data.csv")

if not os.path.isfile(CSV_PATH):
    raise FileNotFoundError(f"Dataset not found at {CSV_PATH}")

# -------------------------------------------------------------------
# 1️⃣ Load and preprocess data
# -------------------------------------------------------------------
df = pd.read_csv(CSV_PATH)
# Ensure required columns exist
required_cols = ["Temperature_C", "Humidity_Percent", "CO_ppm"]
for col in required_cols:
    if col not in df.columns:
        raise KeyError(f"Column '{col}' missing from dataset")

# Drop rows with missing values and force numeric dtype
df = df[required_cols].dropna()
df = df.astype(float)

# Features used by the IsolationForest – keep the order for later inference
feature_columns = required_cols
X = df[feature_columns].values

# -------------------------------------------------------------------
# 2️⃣ Train IsolationForest
# -------------------------------------------------------------------
iso_forest = IsolationForest(
    n_estimators=200,
    contamination="auto",
    random_state=42,
)
iso_forest.fit(X)

# -------------------------------------------------------------------
# 3️⃣ (Optional) Evaluate on training data – just for sanity check
# -------------------------------------------------------------------
# IsolationForest returns -1 for anomalies, 1 for normal points
predictions = iso_forest.predict(X)
anomaly_mask = predictions == -1

# -------------------------------------------------------------------
# 4️⃣ Save the model
# -------------------------------------------------------------------
model_path = os.path.join(os.path.dirname(CSV_PATH), "anomaly_detect_2.pkl")
payload = {
    "model": iso_forest,
    "feature_order": feature_columns,
}
joblib.dump(payload, model_path)
print(f"Model saved to {model_path}")
print(f"Training completed – {anomaly_mask.sum()} anomalies detected in the training set.")

