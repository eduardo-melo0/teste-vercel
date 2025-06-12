import os
import httpx
import supabase
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# --- Modelos de Dados ---
class VehicleInfo(BaseModel):
    placa: str; modelo: str; marca: str; cor: str; ano: str; ano_modelo: str; combustivel: str; segmento: str
class CepDetails(BaseModel):
    is_metropolitan: bool
class QuotationRequest(BaseModel):
    valor_fipe: str; vehicle_info: VehicleInfo; cep_details: CepDetails
class Plan(BaseModel):
    nome: str; descricao: str; valor_mensalidade: float; valor_adesao: float
class QuotationResponse(BaseModel):
    valor_fipe: float; planos: List[Plan]

# --- Configuração da Aplicação ---
app = FastAPI()

# --- Configuração das APIs Externas ---
PLACA_FIPE_API_KEY = os.environ.get("PLACA_FIPE_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase_client = supabase.create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# --- Funções Auxiliares ---
def get_vehicle_type(vehicle_info: VehicleInfo) -> str:
    segmento = (vehicle_info.segmento or '').lower()
    combustivel = (vehicle_info.combustivel or '').lower()
    if 'caminhao' in segmento or 'cao.trator' in segmento: return 'caminhao'
    if 'moto' in segmento: return 'moto'
    if 'diesel' in combustivel or 'camionete' in segmento or 'van' in segmento: return 'diesel_van'
    return 'carro_passeio'

# --- Endpoints da API ---
@app.get("/api")
def read_root():
    return {"status": "API Python Online"}

@app.get("/api/consultar-placa/{plate}")
async def consult_plate(plate: str):
    if not PLACA_FIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Chave da API de placas não configurada.")
    url = f"https://api.placafipe.com.br/getplacafipe/{plate}/{PLACA_FIPE_API_KEY}"
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url, timeout=15.0)
            res.raise_for_status()
            data = res.json()
            if data.get("codigo") != 1 or not data.get("fipe"):
                raise HTTPException(status_code=404, detail=data.get("msg", "Dados FIPE não encontrados."))
            return data
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Erro de comunicação com API de placas: {e}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/calcular-cotacao")
def calculate_quotation(request: QuotationRequest):
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Base de dados indisponível.")
    # Lógica de cálculo da cotação aqui (simplificada para o exemplo)
    # A sua lógica completa de consulta ao Supabase iria aqui.
    fipe_value = float(String(request.valor_fipe).replace(/[^\d.]/g, ''))
    mock_plans = [
        Plan(nome="Plano Ouro (Calculado)", descricao="Cobertura completa", valor_mensalidade=fipe_value * 0.05, valor_adesao=100),
        Plan(nome="Plano Prata (Calculado)", descricao="Cobertura essencial", valor_mensalidade=fipe_value * 0.03, valor_adesao=100)
    ]
    return QuotationResponse(valor_fipe=fipe_value, planos=mock_plans)
