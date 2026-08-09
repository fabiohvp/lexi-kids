import io
import math
import numpy as np
import torch
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
import uvicorn
import soundfile as sf

app = FastAPI(title="Lexi-Kids Phoneme Recognition Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_NAME = "caiocrocha/wav2vec2-large-xlsr-53-phoneme-portuguese"
processor = None
model = None

# Mapeamento auxiliar de letras portuguesas para grupos fonéticos aproximados
LETTER_PHONEME_MAP = {
    'A': ['a', 'á', 'ã', 'â', 'ɐ', 'ã'],
    'B': ['b'],
    'C': ['k', 's', 'c', 'ʃ'],
    'D': ['d', 'dʒ', 'dʐ', 'd͡ʒ'],
    'E': ['e', 'é', 'ê', 'ɛ', 'ẽ', 'i'],
    'F': ['f'],
    'G': ['g', 'ʒ', 'ɡ'],
    'H': [], # Geralmente mudo em português
    'I': ['i', 'í', 'ĩ', 'j'],
    'J': ['ʒ', 'j'],
    'K': ['k'],
    'L': ['l', 'w', 'ʎ'],
    'M': ['m', 'm̃'],
    'N': ['n', 'ɲ', 'ñ'],
    'O': ['o', 'ó', 'ô', 'ɔ', 'õ', 'u'],
    'P': ['p'],
    'Q': ['k'],
    'R': ['r', 'ʁ', 'χ', 'h', 'ɾ'],
    'S': ['s', 'z', 'ʃ', 'ʒ'],
    'T': ['t', 'tʃ', 'tʃ', 't͡ʃ'],
    'U': ['u', 'ú', 'ũ', 'w'],
    'V': ['v'],
    'W': ['v', 'u', 'w'],
    'X': ['ʃ', 'ks', 'z', 's'],
    'Y': ['i', 'j'],
    'Z': ['z', 's', 'ʒ']
}

def load_model():
    global processor, model
    if processor is None or model is None:
        print(f"Carregando modelo {MODEL_NAME}...")
        processor = Wav2Vec2Processor.from_pretrained(MODEL_NAME)
        model = Wav2Vec2ForCTC.from_pretrained(MODEL_NAME)
        model.eval()
        print("Modelo carregado com sucesso!")

@app.on_event("startup")
async def startup_event():
    try:
        load_model()
    except Exception as e:
        print(f"Erro ao carregar modelo na inicialização: {e}")

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "model": MODEL_NAME,
        "model_loaded": model is not None
    }

def process_audio_tensor(audio_array: np.ndarray, sample_rate: int = 16000) -> str:
    """Processa array de áudio 16kHz Float32 e retorna fonemas reconhecidos."""
    load_model()
    
    if len(audio_array) == 0:
        return ""

    # Normaliza áudio se necessário
    if np.max(np.abs(audio_array)) > 0:
        audio_array = audio_array / np.max(np.abs(audio_array))

    inputs = processor(audio_array, sampling_rate=sample_rate, return_tensors="pt", padding=True)
    with torch.no_grad():
        logits = model(inputs.input_values).logits

    predicted_ids = torch.argmax(logits, dim=-1)
    transcription = processor.batch_decode(predicted_ids)[0]
    return transcription.strip()

def check_match(target: str, phonemes_str: str) -> bool:
    """Verifica se o som/fonema ouvido corresponde à letra ou palavra alvo."""
    if not target or not phonemes_str:
        return False
    
    target_clean = target.strip().upper()
    phonemes_clean = phonemes_str.lower()
    
    # Se for uma única letra
    if len(target_clean) == 1:
        target_char = target_clean
        # Checa fonemas diretos ou mapeados
        allowed_phonemes = LETTER_PHONEME_MAP.get(target_char, [target_char.lower()])
        allowed_phonemes.append(target_char.lower())
        
        for ph in allowed_phonemes:
            if ph in phonemes_clean:
                return True
        return False
    else:
        # Se for palavra completa
        # Checa se caracteres correspondentes aparecem nos fonemas ou na transcrição
        matched_chars = 0
        for char in target_clean:
            allowed = LETTER_PHONEME_MAP.get(char, [char.lower()])
            allowed.append(char.lower())
            if any(p in phonemes_clean for p in allowed):
                matched_chars += 1
        
        match_ratio = matched_chars / len(target_clean)
        return match_ratio >= 0.5

@app.post("/api/recognize")
async def recognize_audio(
    file: UploadFile = File(...),
    target: str = Form("")
):
    try:
        content = await file.read()
        sr = 16000
        try:
            audio_data, sr = sf.read(io.BytesIO(content))
        except Exception:
            # Fallback para buffer Float32Array se sf.read não reconhecer contêiner WebM
            audio_data = np.frombuffer(content, dtype=np.float32)
        
        if len(audio_data) == 0:
            return {"success": False, "error": "Áudio vazio"}

        # Garante mono
        if len(audio_data.shape) > 1:
            audio_data = audio_data.mean(axis=1)
        
        # Converte tipo para float32
        audio_data = audio_data.astype(np.float32)
        
        phonemes = process_audio_tensor(audio_data, sample_rate=sr)
        matched = check_match(target, phonemes)
        
        return {
            "success": True,
            "phonemes": phonemes,
            "target": target,
            "matched": matched
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.websocket("/ws/audio")
async def websocket_audio_endpoint(websocket: WebSocket):
    await websocket.accept()
    load_model()
    try:
        while True:
            # Recebe dados binários (Float32Array de 16kHz)
            data = await websocket.receive_bytes()
            audio_array = np.frombuffer(data, dtype=np.float32)
            
            if len(audio_array) > 0:
                phonemes = process_audio_tensor(audio_array, sample_rate=16000)
                await websocket.send_json({
                    "success": True,
                    "phonemes": phonemes
                })
    except WebSocketDisconnect:
        print("Cliente WebSocket desconectado")
    except Exception as e:
        print(f"Erro WebSocket: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
