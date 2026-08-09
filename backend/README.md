# Lexi-Kids Python Phoneme Recognition Backend

Este backend utilza o modelo HuggingFace `caiocrocha/wav2vec2-large-xlsr-53-phoneme-portuguese` para transcrever áudio recebido via streaming/HTTP em fonemas do português e validar a pronúncia de letras e palavras do aplicativo Lexi Kids.

## Como Executar

### 1. Instalar dependências
```bash
pip install -r requirements.txt
```

### 2. Iniciar o Servidor
```bash
python server.py
```
O servidor estará rodando em `http://localhost:8000`.

## Endpoints Disponíveis
- `GET /health` - Status do servidor e modelo.
- `POST /api/recognize` - Recebe arquivo de áudio (WAV/PCM) + parâmetro `target` (letra ou palavra alvo).
- `WS /ws/audio` - Endpoint WebSocket para streaming de áudio em tempo real.
